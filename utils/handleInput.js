const COMMANDS = {
  nick: {
    params: ['nick']
  }
}

const handleCommand = {
  formatParams (cmd, params, type='firstWord') {
    const paramKey = cmd.params[0];

    return {
      [paramKey]:  params.split(' ')[0]
    }

  },
  handle (command) {
    const [, commandName, params] = command;
    const cmd = COMMANDS[commandName];

    if (!cmd) throw new Error("Invalid Command");

    const paramaObj = this.formatParams(cmd, params);
    return {
      commandName,
      params: paramaObj
    }
  }
}

const handleInput = {
  handle (input) {
    const command = /\/(\w+) ?([\s\S]*)/.exec(input);
    if (command) {
      const cmdData = handleCommand.handle(command);

      return cmdData;
    } else {
      return { message: input }
    }
  }
}

export default handleInput;