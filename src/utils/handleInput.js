const COMMANDS = {
  nick: {
    params: ['nick'],
    handler (params) {
      fetch('/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ params, type: 'nickAvailable' })
      });
    }
  },
  register: {
    params: ['nick', 'password'],
    handler (params) {
      fetch('/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ params, type: 'register' })
      });
    }
  },
  login: {
    params: ['nick', 'password'],
    handler (params) {
      fetch('/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ params, type: 'login' })
      });
    }
  },
  flair: {
    params: ['flair']
  },
  background: {
    params: ['code']
  },
  topic: {
    params: ['topic'],
    leaveSpace: true
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
        [paramKey]:  cmd.leaveSpace ? params : params.split(' ')[0]
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
  handle (input, channelName) {
    const command = /^\/(\w+) ?([\s\S]*)/.exec(input);
    if (command) {
      const cmdData = handleCommand.handle(command);
      cmdData.params.channelName = channelName; // inject channelName for fetch requests

      return cmdData;
    } else {
      return { message: input }
    }
  }
}

export default handleInput;