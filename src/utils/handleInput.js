const COMMANDS = {
  nick: {
    params: ['nick'],
    handler (params) {
      console.log(window.sessionID)
      fetch('/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ params, type: 'nickAvailable', sessionID: window.sessionID })
      });
    }
  },
  register: {
    params: ['nick', 'password'],
    handler (params) {
      fetch('/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ params, type: 'register', sessionID: window.sessionID })
      });
    }
  },
  login: {
    params: ['nick', 'password'],
    handler (params) {
      fetch('/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ params, type: 'login', sessionID: window.sessionID })
      });
    }
  },
  flair: {
    params: ['flair']
  }
}

const handleCommand = {
  formatParams (cmd, params, type='firstWord') {

    if (cmd.params.length > 1) {
      
      const paramObj = {};
      const paramKeys = cmd.params;
      const paramValues = params.split(' ');

      paramKeys.forEach((key, i) => {
        paramObj[key] = paramValues[i];
      });

      return paramObj;

    } else {
      const paramKey = cmd.params[0];
      return {
        [paramKey]:  params.split(' ')[0]
      }
    }
  },
  handle(command) {
    const [, commandName, params] = command;
    const cmd = COMMANDS[commandName];

    if (!cmd) throw new Error("Invalid Command");

    const paramaObj = this.formatParams(cmd, params);

    return {
      commandName,
      params: paramaObj,
      handler: cmd.handler
    }
  }
}

const handleInput = {
  handle (input) {
    const command = /^\/(\w+) ?([\s\S]*)/.exec(input);
    if (command) {
      const cmdData = handleCommand.handle(command);

      return cmdData;
    } else {
      return { message: input }
    }
  }
}

export default handleInput;