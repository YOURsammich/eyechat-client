const COMMANDS = {
  nick: {
    params: ['nick']
  },
  login: {
    params: ['nick', 'password'],
    secureFetch: true
  },
  register: {
    params: ['nick', 'password'],
    secureFetch: true
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

    if (cmd.secureFetch) {
      fetch('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ params: paramaObj, type: commandName })
      })
      return;
    }

    return {
      commandName,
      params: paramaObj
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