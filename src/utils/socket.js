// Heartbeat: the browser only fires 'close' on a clean TCP teardown, so a socket
// that dies silently (laptop sleep, a NAT/router dropping an idle connection, or a
// crashed origin behind Cloudflare that never propagates the close) keeps reporting
// OPEN forever. We ping on an interval and, if the matching pong doesn't come back
// in time, treat the socket as dead and close it ourselves — which runs the normal
// reconnect path. This is the only liveness check that doesn't depend on a proxy or
// the network delivering a close.
const HEARTBEAT_INTERVAL = 15000; // send a ping this often while connected
const PONG_TIMEOUT = 10000;       // no pong within this long after a ping → socket is dead
const PRECONNECT_TIMEOUT = 10000; // abort a reconnect /preconnect that hangs this long

const socket = {

  _serverEvents: {},
  _pendingEmits: [],
  _disconnectCbs: [],
  _reconnectCbs: [],
  _rejectionCbs: [],

  _connected: false,      // a socket is currently open
  _everConnected: false,  // we have opened at least once
  _shouldReconnect: true, // cleared only on a fatal preconnect rejection (e.g. banned)
  _reconnecting: false,   // a reconnect timer is pending (waiting out the backoff)
  _reconnectInFlight: false, // a reconnect attempt is actually running (preconnect
                             // fetch → socket open); spans the async gap so a
                             // second trigger can't start a parallel reconnect
  _reconnectAttempts: 0,
  _reconnectTimer: null,
  _heartbeatTimer: null,  // interval that sends pings while connected
  _pongTimer: null,       // watchdog armed after a ping; fires if no pong arrives

  init ({ getActiveChannel } = {}) {
    this.getActiveChannel = getActiveChannel;

    // Mobile browsers freeze page JS while backgrounded, so a socket can die
    // silently (no 'close' fires until the tab wakes). When the user returns,
    // reconnect right away instead of waiting out the backoff timer.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !this._connected && this._shouldReconnect) {
          this._reconnectNow();
        }
      });
    }

    // Reuse the preconnect kicked off by the inline script in index.html so it
    // overlaps bundle download/parse; fall back to firing it here if absent.
    const preconnect = window.__preconnect
      ? window.__preconnect
      : fetch('/preconnect', { method: 'POST' }).then(res => res.json());

    return preconnect.then((message) => {
      if (message && message.success) {
        return this.initSocket().then(() => true);
      }
      console.log('preconnect', message);
      // Rejected (ban, rate-limit, whitelist mode…): surface the server's reason.
      this._fireRejection(message);
      return false;
    });
  },

  initSocket (isReconnect = false) {
    return new Promise((resolve) => {

      const prefix = window.location.protocol === 'https:' ? 'wss' : 'ws';

      // Supersede any previous socket before opening the new one: assign
      // this._socket first (so the old socket's handlers see themselves as stale
      // and stop acting), then close it. Overlapping reconnects (e.g. a scheduled
      // retry racing a foreground/visibility reconnect) could otherwise leave two
      // live sockets, and since both feed the same event registry every message
      // was processed twice — the "double messages" bug.
      const previous = this._socket;
      const ws = new WebSocket(prefix + '://' + location.host);
      this._socket = ws;
      if (previous && previous !== ws) { try { previous.close(); } catch { /* already closing */ } }

      ws.addEventListener('error', (err) => {
        console.log('socket error', err);
      });

      ws.addEventListener('open', () => {
        this._connected = true;
        this._everConnected = true;
        this._reconnectAttempts = 0;
        this._reconnectInFlight = false;   // attempt succeeded
        this._startHeartbeat();

        // Flush any emits queued while the socket was down / still connecting.
        for (const payload of this._pendingEmits) ws.send(payload);
        this._pendingEmits = [];

        // On a reconnect, let listeners resync (rejoin the channel, etc.). The
        // very first connection is handled by init()'s resolve() instead.
        if (isReconnect) for (const cb of this._reconnectCbs) cb();

        resolve();
      });

      ws.addEventListener('message', (e) => {
        // Belt-and-suspenders: ignore a socket we've already superseded so a
        // briefly-overlapping old connection can't deliver duplicate messages.
        if (this._socket !== ws) return;
        const data = JSON.parse(e.data);
        // Heartbeat reply — clear the watchdog and don't surface it to app listeners.
        if (data.event === 'pong') { this._onPong(); return; }
        this._triggerEvent(data.event, data.data);
      });

      ws.addEventListener('close', (e) => {
        this._teardown(ws, e);
      });

    });
  },

  // Bring the connection down and start recovery. Called both by the socket's own
  // 'close' event and directly by the heartbeat watchdog: a graceful ws.close() on
  // a silently-dead socket (frozen / half-open server) may not fire 'close' for a
  // long time, so we can't wait for it. Nulling _socket makes any later, stale
  // 'close' for the same ws a no-op (guard below), which also stops it from
  // clobbering a reconnect that's already in flight.
  _teardown (ws, e) {
    if (this._socket !== ws) return; // already torn down or superseded
    this._socket = null;

    const wasConnected = this._connected;
    this._connected = false;
    this._stopHeartbeat();
    // This socket is done — release the guard so the next scheduled/foreground
    // reconnect can proceed.
    this._reconnectInFlight = false;
    console.log('socket down', e && e.code, e && e.reason);

    // Only surface a disconnect once, on the live→down transition — not on every
    // failed reconnect attempt.
    if (wasConnected) for (const cb of this._disconnectCbs) cb(e);

    // Server-side rejections we shouldn't hammer with reconnects: 4003 is a
    // ban/kick, 4004 is whitelist mode. (/preconnect normally blocks these before a
    // socket opens; this covers a socket closed post-upgrade.)
    if (e && (e.code === 4003 || e.code === 4004)) this._shouldReconnect = false;

    if (this._shouldReconnect) this._scheduleReconnect();
  },

  _scheduleReconnect () {
    if (this._reconnecting || this._reconnectInFlight) return;
    this._reconnecting = true;

    const attempt = this._reconnectAttempts++;
    // Exponential backoff 1s → 30s, with jitter to avoid a thundering herd.
    const delay = Math.min(30000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 1000);

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._reconnecting = false;
      this._reconnect();
    }, delay);
  },

  // Skip the backoff wait and reconnect immediately (e.g. tab back to foreground).
  _reconnectNow () {
    if (this._connected) return;
    if (this._reconnectInFlight) return;   // an attempt is already running
    if (this._socket && this._socket.readyState === WebSocket.CONNECTING) return;
    if (this._reconnectTimer) { clearTimeout(this._reconnectTimer); this._reconnectTimer = null; }
    this._reconnecting = false;
    this._reconnectAttempts = 0;
    this._reconnect();
  },

  _reconnect () {
    // Only one attempt at a time: the flag spans the async preconnect fetch (and
    // stays set until the new socket opens or closes), so a second trigger
    // (a scheduled retry racing a foreground/visibility reconnect) can't spin up
    // a parallel connection. Cleared in the socket open/close handlers, and in the
    // fetch-failure/rejection paths below where no socket ever gets created.
    if (this._reconnectInFlight) return;
    this._reconnectInFlight = true;

    // Re-run preconnect to refresh the upgrade approval + userID cookie. This
    // also recovers when the server restarted and dropped its in-memory
    // session (approvedForUpgrade), which a bare WS reopen could not.
    // Guard the fetch with a timeout: a reconnect that reaches a half-dead origin
    // (accepts the socket but never responds) would otherwise hang forever with no
    // 'close' and no rejection, wedging _reconnectInFlight permanently. AbortError
    // lands in .catch below and reschedules like any other failed attempt.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PRECONNECT_TIMEOUT);

    fetch('/preconnect', { method: 'POST', signal: controller.signal })
      .then(res => res.json())
      .then((message) => {
        clearTimeout(timeout);
        if (message && message.success) return this.initSocket(true);
        // Fatal (e.g. banned or now whitelisted): stop retrying and tell the user.
        this._reconnectInFlight = false;
        this._shouldReconnect = false;
        console.log('reconnect preconnect failed', message);
        this._fireRejection(message);
      })
      .catch((err) => {
        clearTimeout(timeout);
        this._reconnectInFlight = false;
        console.log('reconnect attempt failed', err);
        if (this._shouldReconnect) this._scheduleReconnect();
      });
  },

  // --- heartbeat ---
  // Started on every socket open, stopped on every close. While running, it pings
  // on an interval and arms a watchdog; a missing pong closes the socket, which the
  // 'close' handler then turns into a reconnect. See the note by HEARTBEAT_INTERVAL.

  _startHeartbeat () {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => this._beat(), HEARTBEAT_INTERVAL);
  },

  _beat () {
    const ws = this._socket;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    // A watchdog from the previous beat is still pending — don't stack pings.
    if (this._pongTimer) return;

    this.emit('ping');
    this._pongTimer = setTimeout(() => {
      this._pongTimer = null;
      // Still the current socket and no pong came back in time → it's dead even if
      // the browser still reports OPEN. Drive the disconnect ourselves: a graceful
      // ws.close() on a frozen / half-open server may not fire 'close' for a long
      // time, so we can't wait for it — _teardown runs the disconnect + reconnect
      // now. We still call ws.close() to release the underlying socket. This is what
      // catches silent deaths the browser never reported (e.g. Cloudflare holding
      // the socket open after the origin died).
      if (this._socket !== ws) return;
      console.log('heartbeat: no pong in time, treating socket as dead');
      try { ws.close(); } catch { /* already closing */ }
      this._teardown(ws);
    }, PONG_TIMEOUT);
  },

  _onPong () {
    if (this._pongTimer) { clearTimeout(this._pongTimer); this._pongTimer = null; }
  },

  _stopHeartbeat () {
    if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }
    if (this._pongTimer) { clearTimeout(this._pongTimer); this._pongTimer = null; }
  },

  _triggerEvent (event, data) {
    const events = this._serverEvents[event];

    if (events) {
      for (let callback of events) {
        callback(data);
      }
    }
  },

  on (event, callback) {
    if (!this._serverEvents[event]) this._serverEvents[event] = [];
    this._serverEvents[event].push(callback);

    return () => {
      this.off(event, callback);
    }
  },

  off (event, callback) {
    const events = this._serverEvents[event];
    if (events) {
      const index = events.indexOf(callback);

      if (index !== -1) {
        events.splice(index, 1);
      }
    }
  },

  emit (event, data) {
    const payload = JSON.stringify({
      event, data, channelName: this.getActiveChannel()
    });

    if (this._socket && this._socket.readyState === WebSocket.OPEN) {
      this._socket.send(payload);
    } else {
      // Queue until the socket (re)opens (see flush in initSocket).
      this._pendingEmits.push(payload);
    }
  },

  onDisconnect (callback) {
    this._disconnectCbs.push(callback);
    return () => {
      const i = this._disconnectCbs.indexOf(callback);
      if (i !== -1) this._disconnectCbs.splice(i, 1);
    };
  },

  onReconnect (callback) {
    this._reconnectCbs.push(callback);
    return () => {
      const i = this._reconnectCbs.indexOf(callback);
      if (i !== -1) this._reconnectCbs.splice(i, 1);
    };
  },

  _fireRejection (message) {
    const text = (message && message.message) || 'Unable to connect.';
    for (const cb of this._rejectionCbs) cb(text);
  },

  // Fires when /preconnect refuses the connection (ban, rate-limit, whitelist)
  // with the server's human-readable reason. Register before init().
  onRejected (callback) {
    this._rejectionCbs.push(callback);
    return () => {
      const i = this._rejectionCbs.indexOf(callback);
      if (i !== -1) this._rejectionCbs.splice(i, 1);
    };
  }


}

export default socket;
