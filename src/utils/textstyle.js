// The message text style, client side. Mirror of src/textstyle.js on the server,
// which owns the authoritative composition (the prefix snapshotted onto each
// outgoing message) and all validation. The client needs its own copy because
// previews can't round-trip to the server per keystroke, and because a local
// message (/echo) has to render the style the real message is about to carry.
//
// Lives in utils rather than beside the cosmetics components so both the menu and
// handleInput can use it without a component importing from a sibling feature.

// The four properties, as stored (TEXT_STYLE_COLUMNS in src/db.js).
export const TEXT_STYLE_COLUMNS = ['color', 'glow', 'font', 'style'];

// Pull the four properties off a user object, in the shape /a/textstyle accepts.
export function pickTextStyle(user) {
  return {
    color: user?.color ?? null,
    glow:  user?.glow ?? null,
    font:  user?.font ?? null,
    style: Array.isArray(user?.style) ? user.style : null,
  };
}

// Compose the properties into a markup prefix. Order must match how the parser
// reads a style run, and how buildFlair emits one: font token ($Name|), style
// tokens, glow (###hex), color (#hex). Keep in step with composeTextStyle in
// src/textstyle.js.
export function composeTextStyle({ color, glow, font, style } = {}) {
  let out = font ? '$' + font + '|' : '';
  if (Array.isArray(style)) out += style.join('');
  if (glow) out += '###' + glow;
  if (color) out += '#' + color;

  // Delimit a trailing hex token from the text that follows, or a 3-digit color
  // runs into it ("#a9d" + "def…" reads as the 6-digit "#a9ddef"). The parser
  // strips this space.
  if (color || glow) out += ' ';

  return out || null;
}
