const socket = {

  _serverEvents: {},
  _pendingEmits: [],
  _pendingDisconnectCbs: [],

  init ({ getActiveChannel } = {}) {
    this.getActiveChannel = getActiveChannel;

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
      return false;
    });
  },

  initSocket () {
    return new Promise((resolve, reject) => {

      const prefix = window.location.protocol === 'https:' ? 'wss' : 'ws';

      this._socket = new WebSocket(prefix + '://' + location.host);

      // Attach any disconnect handlers registered before the socket existed.
      for (const cb of this._pendingDisconnectCbs) this._socket.addEventListener('close', cb);
      this._pendingDisconnectCbs = [];

      this._socket.addEventListener('error', (err,r) => {
        console.log('error', err,r);
      });

      this._socket.addEventListener('open', () => {
        // Flush any emits queued while the socket was still connecting.
        for (const payload of this._pendingEmits) this._socket.send(payload);
        this._pendingEmits = [];
        resolve();
      });

      this._socket.addEventListener('message', (e) => {
        const data = JSON.parse(e.data);
        this._triggerEvent(data.event, data.data);
      });

      this._socket.addEventListener('close', (e,r) => {
        console.log('socket closed', e,r);
      });

    })
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
      // Queue until the socket opens (see flush in initSocket).
      this._pendingEmits.push(payload);
    }
  },

  onDisconnect (callback) {
    if (this._socket) {
      this._socket.addEventListener('close', callback);
    } else {
      this._pendingDisconnectCbs.push(callback);
    }
  }


}

export default socket;