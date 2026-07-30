import { composeTextStyle, pickTextStyle } from './textstyle';

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

// --- text style ---
//
// See utils/textstyle.js for how the four properties compose into markup.
//
// A registered user's message text style lives on their account as four columns
// (color, glow, font, style — see src/textstyle.js), which is what the cosmetics
// menu edits and what style profiles snapshot. /color and /font are the chat
// shorthand for two of those properties, so they write there too; otherwise a
// color set from the input bar would be invisible to the menu and to profiles.
//
// Guests have no account row, and /a/* is login-only, so they keep the older
// localStorage path: styling that lasts the session and is applied by prefixing
// the outgoing message (see getStylePrefix).

// /a/textstyle replaces all four properties, so the ones we aren't changing are
// sent back alongside the patch. The live user updates via userStateChange, so
// there's nothing to set locally.
function saveTextStyle(user, patch, addMessage) {
  const tell = (message, type) =>
    addMessage?.({ message, type, noparse: true, count: Math.random() });

  fetch('/a/textstyle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...pickTextStyle(user), ...patch }),
  })
    .then(r => r.json())
    .then(data => {
      if (data.error || !data.success) {
        tell(data.error || data.message || 'Could not save your text style.', 'error');
        return;
      }
      // The server drops a property it can't accept, so report anything that
      // didn't stick rather than letting it look applied.
      for (const [key, value] of Object.entries(patch)) {
        if (value && data[key] == null) tell(`"${value}" isn't a valid ${key}.`, 'error');
      }
    })
    .catch(() => tell('Could not reach the server.', 'error'));
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
    handler (params, {store, user, addMessage}) {
      const color = params.code === 'none' ? null : params.code;
      if (user?.registered) saveTextStyle(user, { color }, addMessage);
      else store.setState('color', color ?? '');
    }
  },
  font: {
    params: ['font'],
    parseMethod: 'leaveSpace',
    handler (params, {store, user, addMessage}) {
      // A Google Font name (e.g. "Comic Neue"); "/font none" clears it.
      const font = params.font === 'none' ? null : params.font;
      if (user?.registered) saveTextStyle(user, { font }, addMessage);
      else store.setState('font', font ?? '');
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
      // An owner must hold an actual *value*, not just the key: clientInfo carries
      // every cosmetic field whether or not it's set, so a bare hasOwnProperty
      // check would stop at `user` and report "color is set to null". It also has
      // to fall through for a guest, whose color and font are still local-only.
      const isSet = (v) =>
        v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);
      const has = (obj) => obj && Object.prototype.hasOwnProperty.call(obj, attr) && isSet(obj[attr]);

      let value;
      if (has(user)) value = user[attr];
      else if (has(channelState)) value = channelState[attr];
      else value = store.get(attr);

      if (!isSet(value)) {
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
  // Renders a chat line locally and sends nothing — a preview of how a message
  // will look once styled, without putting it in the room or the log. The fields
  // mirror what the server attaches to a real 'message' event (see the message
  // branch of handleConnection), since each one feeds the rendered line: the
  // nick/flair/hat/avatar row, the timestamp, and the 'chat'-only parsing
  // (greentext, word filters) in Messages.
  echo: {
    params: ['message'],
    parseMethod: 'leaveSpace',
    handler (params, {addMessage, store, user}) {
      if (!params?.message) {
        addMessage({
          message: 'Usage: /echo <message>',
          type: 'error',
          noparse: true,
          count: Math.random()
        });
        return;
      }

      // Prepend the sender's /color and /font exactly as an outgoing message
      // would (see handle() below) — otherwise the preview drops the styling the
      // real message is about to carry. Contributes nothing for a registered
      // user, whose style the renderer applies from their own state instead.
      const { color, font } = handleInput.getStylePrefix(store, user);

      addMessage({
        message: font + color + params.message,
        type: 'chat',
        nick: user?.nick,
        flair: user?.flair ?? null,
        hat: user?.hat ?? null,
        avatar: user?.avatar ?? null,
        // A registered user's text style isn't in the prefix above (the server
        // applies it), so it has to ride along the way a real message's snapshot
        // does — otherwise this preview under-styles what's about to be sent.
        textstyle: composeTextStyle(pickTextStyle(user)),
        emojiNick: '',
        flairOverRide: 0,
        nostyle: 0,
        time: Date.now(),
        // Local-only, so there's no message number to quote; a random count
        // still gives the render cache and React key something unique.
        count: Math.random()
      });
    }
  },
  // Blocking needs a duration, so the typed form opens the same box the userlist
  // button and a moderator's /separate raise; the box is what emits the command
  // (with the duration) to the server, which owns the list.
  block: {
    params: ['nick'],
    handler (params, {addMessage}) {
      const nick = params?.nick;
      if (!nick) {
        addMessage({ message: 'Usage: /block <nick>', type: 'error', noparse: true, count: Math.random() });
        return;
      }
      window.dispatchEvent(new CustomEvent('block:open', { detail: { nick } }));
    }
  },
  // Nothing to ask, so no client handler — it goes straight to the server.
  unblock: {
    params: ['nick']
  },
  // Moderator-only, checked server-side: offers both users the block box.
  separate: {
    params: ['nick1', 'nick2']
  },
  trust: {
    params: ['nick', 'level'],
  },
  whitelist: {
    params: ['state'],
  },
  // off | guests | all. Param name must match the server's (see COMMANDS in
  // src/commands.js) — the object is built by name, not position.
  proxyblock: {
    params: ['mode'],
  },
  proxyscan: {
    params: ['nick'],
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
  scare: {
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
  ask: {
    params: ['question'],
    parseMethod: 'leaveSpace'
  },
  addcope: {
    params: ['answer'],
    parseMethod: 'leaveSpace'
  },
  // /unban has no client handler, so it emits to the server (trust-gated there).
  unban: {
    params: ['target']
  },
  // banlist / seecope open a client-side management panel (like /uno) — no
  // server round-trip; the panel fetches its own data over REST.
  banlist: {
    handler() {
      window.dispatchEvent(new CustomEvent('banlist:open'));
    }
  },
  seecope: {
    handler() {
      window.dispatchEvent(new CustomEvent('seecope:open'));
    }
  },
  // The command list panel — like /banlist, client-side only; it fetches the
  // levels itself and the server gates who may change them.
  commands: {
    handler() {
      window.dispatchEvent(new CustomEvent('commands:open'));
    }
  },
  // The user role panel. Same shape: the server gates both viewing (trust 2)
  // and changing (trust 1).
  roles: {
    handler() {
      window.dispatchEvent(new CustomEvent('roles:open'));
    }
  },
  // No client handler, so it emits to the server, which is where the trust
  // check and the write live.
  lock_command: {
    params: ['command', 'level']
  },
  avatar: {
    params: ['type', 'id'],
  },
  weather: {
    params: ['location'],
    parseMethod: 'leaveSpace'
  },
  // /find takes a nick or an IP; no client handler, so it emits to the server
  // (trust-gated there).
  find: {
    params: ['target']
  },
  // Takes the >>N message number that clicking a timestamp inserts.
  whosaid: {
    params: ['msgnum']
  },
  // The argument is optional — bare /nothrottle uses the default window, and
  // "off" ends it early. Declared here anyway so the arg gets parsed when it is
  // given (and shows up in the param hint); the server treats it as optional.
  nothrottle: {
    params: ['minutes']
  },
  // Optional too — bare /hatdrop forces a Dunce. Admin-gated on the server.
  hatdrop: {
    params: ['hat']
  },
  // Like /banlist, /deepfind opens a client-side panel that fetches its own
  // data; the server gates the fetch at trust 0 and resolves the nick-or-IP.
  deepfind: {
    params: ['target'],
    handler (params, {addMessage}) {
      const target = params?.target;
      if (!target) {
        addMessage({
          message: 'Usage: /deepfind <nick or IP>',
          type: 'error',
          noparse: true,
          count: Math.random()
        });
        return;
      }
      window.dispatchEvent(new CustomEvent('deepfind:open', { detail: { target } }));
    }
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

// Commonwealth spellings, mapped to the command they stand in for. Each alias
// gets the same command object, so autocomplete and the param hints pick them
// up for free; handle() resolves back to the canonical name before anything is
// emitted, keeping aliases invisible to the server.
const ALIASES = {
  colour: 'color'
};

for (const [alias, target] of Object.entries(ALIASES)) {
  COMMANDS[alias] = COMMANDS[target];
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
    const [, typedName, params] = command;
    const commandName = ALIASES[typedName] ?? typedName;
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
  // The guest text-style path: prefix the outgoing message with the localStorage
  // color and font.
  //
  // A registered user's style is applied by the server instead — composed from
  // their four columns and snapshotted onto the message (see
  // User.textStyleMarkup), then prepended at render time. Prefixing here as well
  // would stack the two, with the inline copy winning. So this contributes
  // nothing once you're logged in.
  getStylePrefix (store, user) {
    if (user?.registered) return { color: '', font: '' };

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
      const { color, font } = this.getStylePrefix(store, user);

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