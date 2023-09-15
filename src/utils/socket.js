const socket = {

  init ({ getActiveChannel } = {}) {    
    this.getActiveChannel = getActiveChannel;

    return new Promise ((resolve, reject) => {
      fetch('/preconnect', { method: 'POST' })
        .then(res => res.json())
        .then((message) => {
          if (message.success) {
            this.initSocket()
              .then(resolve);
          } else {
            console.log('preconnect', message);
          }
        });
    });

  },

  initSocket () {
    return new Promise((resolve, reject) => {

      const prefix = window.location.protocol === 'https:' ? 'wss' : 'ws';

      this._socket = new WebSocket(prefix + '://' + location.host);
  
      this._serverEvents = {};
      
      this._socket.addEventListener('error', (err,r) => {
        console.log('error', err,r);
      });

      this._socket.addEventListener('open', resolve);
    
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
    this._socket.send(JSON.stringify({
      event, data, channelName: this.getActiveChannel()
    }))
  },

  onDisconnect (callback) {
    this._socket.addEventListener('close', callback);
  }


}

export default socket;