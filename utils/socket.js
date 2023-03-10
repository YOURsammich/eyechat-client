const socket = {

  init () {
    return new Promise((resolve, reject) => {
      this._socket = new WebSocket('ws://' + location.host);
  
      this._serverEvents = {};
  
      this._socket.addEventListener('open', resolve);
    
      this._socket.addEventListener('message', (e) => {
        const data = JSON.parse(e.data);
        this._triggerEvent(data.event, data.data);
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
  },

  emit (event, data) {
    this._socket.send(JSON.stringify({
      event, data
    }))
  }


}

export default socket;