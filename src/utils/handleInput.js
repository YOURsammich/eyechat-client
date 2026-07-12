// Parse a single hex color (3- or 6-digit, leading "#" optional) into an
// [r, g, b] triple normalized to 0..1, or null if it isn't valid hex.
function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const num = parseInt(h, 16);
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

// Parse a comma-separated list of hex colors into up to 6 [r,g,b] triples for a
// custom /fluid gradient. Returns null when no valid colors are found so the
// caller can fall back to a named preset.
function parseFluidColors(str) {
  if (!str) return null;
  const colors = [];
  for (const part of str.split(',')) {
    const rgb = hexToRgb(part);
    if (rgb) colors.push(rgb);
  }
  return colors.length ? colors.slice(0, 6) : null;
}

// The nick / register / login commands all POST to /login and share the same
// response contract ({ error } on failure, { success, nick } otherwise).
// Centralize the request so every auth path reports what happened — previously
// register swallowed its response entirely and success was never surfaced,
// making failures look like nothing happened at all.
async function postAuth(type, params, addMessage) {
  const tell = (message, msgType) =>
    addMessage({ message, type: msgType, count: Math.random() });

  let res;
  try {
    res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params, type })
    });
  } catch (err) {
    tell('Could not reach the server. Check your connection and try again.', 'error');
    return;
  }

  // Success responses can have an empty body, so guard the JSON parse.
  let body = {};
  try {
    const text = await res.text();
    if (text) body = JSON.parse(text);
  } catch (err) {
    // Non-JSON / empty body — treat as no structured error.
  }

  if (!res.ok || body.error) {
    tell(body.error || `Request failed (${res.status}).`, 'error');
    return;
  }

  // Positive confirmation. The server also emits a channel notice on a real
  // login/registration, but an explicit line makes the outcome unambiguous.
  if (type === 'register') tell(`Registered and logged in as ${params.nick}.`, 'info');
  else if (type === 'login') tell(`Logged in as ${params.nick}.`, 'info');
}

const COMMANDS = {
  nick: {
    params: ['nick'],
    handler (params, {channelName, addMessage}) {
      params.channelName = channelName;
      postAuth('nickAvailable', params, addMessage);
    }
  },
  register: {
    params: ['nick', 'password'],
    handler (params, {channelName, addMessage}) {
      params.channelName = channelName;
      postAuth('register', params, addMessage);
    }
  },
  login: {
    params: ['nick', 'password'],
    handler (params, {channelName, addMessage}) {
      params.channelName = channelName;
      postAuth('login', params, addMessage);
    }
  },
  gif: {
    params: ['query'],
    handler () { /* handled by InputBar before reaching here */ }
  },
  color: {
    params: ['code'],
    handler (params, {channelName, store}) {
      store.setState('color', params.code);
    }
  },
  font: {
    params: ['font'],
    parseMethod: 'leaveSpace',
    handler (params, {store}) {
      // Persist a Google Font name (e.g. "Comic Neue") that gets prefixed onto
      // each message as a $Font| token; "/font none" clears it.
      store.setState('font', params.font === 'none' ? '' : params.font);
    }
  },
  get: {
    params: ['attribute'],
    handler (params, {store, channelState, user, addMessage}) {
      const attr = params.attribute;

      // An attribute can live in three places depending on its kind: the
      // current user's state (flair, hat, afk, avatar…), the channel's shared
      // state (topic, background, themecolors…), or the local client store
      // (color, font…). Resolve in that order — first owner wins. Only `store`
      // was consulted before, which is why `/get flair`, `/get topic`, etc.
      // never resolved.
      const has = (obj) => obj && Object.prototype.hasOwnProperty.call(obj, attr);

      let value;
      if (has(user)) value = user[attr];
      else if (has(channelState)) value = channelState[attr];
      else value = store.get(attr);

      if (value === undefined || value === '') {
        addMessage({
          message: attr + ' is not set.',
          type: 'info',
          noparse: true,
          count: Math.random(),
        });
        return;
      }

      const message = (typeof value === 'string' || typeof value === 'number') ? value : JSON.stringify(value);

      addMessage({
        message: attr + ' is set to ' + message,
        type: 'info',
        noparse: true,
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
  block: {
    params: ['nick'],
    handler (params, {store, addMessage}) {
      const blocked = store.get('block') || [];
      blocked.push(params.nick);
      store.setState('block', blocked);
      addMessage({
        message: params.nick + ' is now blocked',
        type: 'info',
        count: Math.random()
      });
    }
  },
  trust: {
    params: ['nick', 'level'],
  },
  whitelist: {
    params: ['state'],
  },
  change_password: {
    params: ['oldpass', 'newpass'],
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
  },
  msg: {
    params: ['msg'],
    parseMethod: 'leaveSpace'
  },
  note: {
    params: ['note'],
    parseMethod: 'leaveSpace'
  },
  chatgpt: {
    params: ['message'],
    parseMethod: 'leaveSpace'
  },
  sidebar: {},
  flipcoin: {},
  avatar: {
    params: ['type', 'id'],
  },
  weather: {
    params: ['location'],
    parseMethod: 'leaveSpace'
  },
  findmsg: {
    params: ['text'],
    parseMethod: 'leaveSpace'
  },
  fluid: {
    params: ['duration', 'palette'],
    handler(params) {
      const secs = parseInt(params.duration) || 30;
      const palettes = { paint: 0, fire: 1, ocean: 2, acid: 3, cosine: 4, hsv: 5, plasma: 6, voronoi: 7 };
      // A palette arg of one or more hex colors (e.g. "#f00,#00f" or "f00,0f0,00f")
      // builds a custom gradient; otherwise fall back to a named preset.
      const customColors = parseFluidColors(params.palette);
      const palette = customColors ? 8 : (palettes[params.palette] ?? 0);
      window.dispatchEvent(new CustomEvent('fluid', { detail: { duration: secs, palette, customColors } }));
    }
  },
  uno: {
    handler() {
      window.dispatchEvent(new CustomEvent('uno:open'));
    }
  },
  whiteboard: {
    handler() {
      window.dispatchEvent(new CustomEvent('whiteboard:open'));
    }
  },
  wb: {
    handler() {
      window.dispatchEvent(new CustomEvent('whiteboard:open'));
    }
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
    const paramObj = {};
    const paramKeys = cmd.params;

    let paramValues;
    if (cmd.parseMethod === 'leaveSpace') {
      paramValues = this.parseParamSpaces(params, cmd.params.length);
    } else {
      paramValues = params;
    }

    paramKeys.forEach((key, i) => {
      paramObj[key] = paramValues[i];
    });

    return paramObj;
  },
  handle(command) {
    const [, commandName, params] = command;
    const cmd = COMMANDS[commandName];

    if (!cmd) throw new Error("Invalid Command");
    
    const paramaObj = params ? this.formatParams(cmd, params.split(' ')) : false;

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
      // Trailing space delimits the color from the message so a 3-digit color
      // (e.g. #a9d) doesn't merge with following hex-like text (e.g. "def") and
      // get misparsed as a 6-digit color. The parser strips this space.
      color: store.get('color') ? ( '#' + store.get('color') + ' ' ) : '',
      font: store.get('font') ? ( '$' + store.get('font') + '|' ) : ''
    }
  },
  handle (input, socket, store, channelName, addMessage, user, channelState) {
    const command = /^\/(\w+) ?([\s\S]*)/.exec(input);
    if (command) {
      const cmdData = handleCommand.handle(command);
      if (cmdData.handler) {
        cmdData.handler(cmdData.params, {
          channelName: channelName,
          store: store,
          user: user,
          channelState: channelState,
          addMessage: addMessage
        });
      } else {
        socket.emit('command', cmdData);
      }

    } else {
      const { color, font } = this.getStylePrefix(store);

      socket.emit('message', {
        message: font + color + input
      });
    }
  },
  getCommands() {
    return Object.keys(COMMANDS);
  },
  getCommandParams(name) {
    return COMMANDS[name]?.params ?? [];
  }
}

export default handleInput;