const COMMANDS = {
  nick: {
    params: ['nick'],
    handler (params, {channelName}) {

      params.channelName = channelName;

      fetch('/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ params, type: 'nickAvailable' })
      });
    }
  },
  register: {
    params: ['nick', 'password'],
    handler (params, {channelName}) {

      params.channelName = channelName;

      fetch('/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ params, type: 'register' })
      });
    }
  },
  login: {
    params: ['nick', 'password'],
    handler (params, {channelName}) {

      params.channelName = channelName;

      fetch('/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ params, type: 'login' })
      });
    }
  },
  color: {
    params: ['code'],
    handler (params, {channelName, store}) {
      store.setState('color', params.code);
    }
  },
  get: {
    params: ['attribute'],
    handler (params, {store, addMessage}) {
      const storeValue = store.get(params.attribute);
      const message = (typeof storeValue == 'string' || typeof storeValue == 'number') ? storeValue : 'Attribute not found';
      
      addMessage({
        message: params.attribute + ' is set to ' + message,
        type: 'info',
        count: Math.random(),
      })
    }
  },
  echo: {
    params: ['message'],
    parseMethod: 'leaveSpace',
    handler (params, {addMessage, user}) {

      addMessage({
        message: params.message,
        type: 'chat',
        count: Math.random(),
        nick: user.nick
      })

    }
  },
  flair: {
    params: ['flair'],
    parseMethod: 'leaveSpace'
  },
  background: {
    params: ['code'],
    parseMethod: 'leaveSpace'
  },
  topic: {
    params: ['topic'],
    parseMethod: 'leaveSpace'
  },
  pay: {
    params: ['recipient', 'amount'],
  },
  part: {
    params: ['message'],
    parseMethod: 'leaveSpace'
  },
  me: {
    params: ['message'],
    parseMethod: 'leaveSpace'
  },
  afk : {
    params : ['message'],
    parseMethod: 'leaveSpace'
  },
  pm: {
    params: ['recipient', 'message'],
    parseMethod: 'leaveSpace'
  },
  kick: {
    params: ['nick']
  },
  ban: {
    params: ['nick']
  },
  banip: {
    params: ['ip']
  },
  hat: {
    params: ['hat']
  },
  whois: {
    params: ['nick']
  },
  theme: {
    params: ['id', 'color']
  }
}

const handleCommand = {
  parseParamSpaces(params, paramQuantity) {
    const parsedInput = [];

    for (let i = 0; i < params.length; i++) {
      if (i === paramQuantity - 1) {
        parsedInput.push(params.slice(i).join(' '));
        break;
      } else {
        parsedInput.push(params[i]);
      }
    }
    return parsedInput;
  },
  formatParams(cmd, params) {
    const parseMethod = {
      leaveSpace: this.parseParamSpaces(params, cmd.params.length),
    }

    const paramObj = {};
    const paramKeys = cmd.params;
    const paramValues = parseMethod[cmd.parseMethod] ?? params;

    paramKeys.forEach((key, i) => {
      paramObj[key] = paramValues[i];
    });

    return paramObj;
  },
  handle(command) {
    const [, commandName, params] = command;
    const cmd = COMMANDS[commandName];

    if (!cmd) throw new Error("Invalid Command");

    const paramaObj = this.formatParams(cmd, params.split(' '));
    console.log('command sent', paramaObj)
    return {
      commandName,
      params: paramaObj,
      handler: cmd.handler
    }
  }
}

const handleInput = {
  getStylePrefix (store) {
    return {
      color: store.get('color') ? ( '#' + store.get('color') ) : ''
    }
  },
  handle (input, socket, store, channelName, addMessage, user) {
    const command = /^\/(\w+) ?([\s\S]*)/.exec(input);
    if (command) {
      const cmdData = handleCommand.handle(command);
      if (cmdData.handler) {
        cmdData.handler(cmdData.params, {
          channelName: channelName,
          store: store,
          user: user,
          addMessage: addMessage
        });
      } else {
        socket.emit('command', cmdData);
      }

    } else {

      const { color } = this.getStylePrefix(store);

      console.log(color + input);

      socket.emit('message', {
        message: color + input
      });
    }
  },
  getCommands() {
    return Object.keys(COMMANDS);
  }
}

export default handleInput;