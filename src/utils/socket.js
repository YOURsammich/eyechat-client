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
        this._triggerEvent(data.event, data.data);
      });

      ws.addEventListener('close', (e) => {
        // Stale close from a socket we've already replaced — ignore.
        if (this._socket !== ws) return;

        const wasConnected = this._connected;
        this._connected = false;
        // This attempt's socket is done (dropped, or never opened) — release the
        // guard so the next scheduled/foreground reconnect can proceed.
        this._reconnectInFlight = false;
        console.log('socket closed', e && e.code, e && e.reason);

        // Only surface a disconnect once, on the live→down transition — not on
        // every failed reconnect attempt.
        if (wasConnected) for (const cb of this._disconnectCbs) cb(e);

        // Server-side rejections we shouldn't hammer with reconnects: 4003 is a
        // ban/kick, 4004 is whitelist mode. (/preconnect normally blocks these
        // before a socket opens; this covers a socket closed post-upgrade.)
        if (e && (e.code === 4003 || e.code === 4004)) this._shouldReconnect = false;

        if (this._shouldReconnect) this._scheduleReconnect();
      });

    });
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
    fetch('/preconnect', { method: 'POST' })
      .then(res => res.json())
      .then((message) => {
        if (message && message.success) return this.initSocket(true);
        // Fatal (e.g. banned or now whitelisted): stop retrying and tell the user.
        this._reconnectInFlight = false;
        this._shouldReconnect = false;
        console.log('reconnect preconnect failed', message);
        this._fireRejection(message);
      })
      .catch((err) => {
        this._reconnectInFlight = false;
        console.log('reconnect attempt failed', err);
        if (this._shouldReconnect) this._scheduleReconnect();
      });
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
