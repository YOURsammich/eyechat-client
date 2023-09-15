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
  ban: {
    params: ['nick']
  },
  banip: {
    params: ['ip']
  },
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