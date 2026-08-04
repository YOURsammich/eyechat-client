// What an equipped cursor value means, in one place.
//
// `users.cursor` holds one of two things, and every screen that draws a cursor
// (the live layer, your own pointer, the picker's preview and tiles) has to
// agree on which is which:
//
//   'wyatt-1738-a1b2.png'  -> an uploaded cursor from the shared catalog
//   'emoji:kek.png'        -> one of the room's chat emojis, same catalog the
//                             avatar builder quick-picks from
//
// The `emoji:` prefix is what keeps the two apart without a second column: an
// uploaded cursor filename is server-generated (see /a/upload/cursor) and can
// never contain a colon, so the prefix is unambiguous.

export const EMOJI_CURSOR_PREFIX = 'emoji:';

// True when this cursor value names a chat emoji rather than an uploaded file.
export function isEmojiCursor(cursor) {
  return typeof cursor === 'string' && cursor.startsWith(EMOJI_CURSOR_PREFIX);
}

// Build the `emoji:` value stored for a chat emoji's image filename.
export function emojiCursor(imageName) {
  return EMOJI_CURSOR_PREFIX + imageName;
}

// The URL to draw for an equipped cursor, or null when nothing is equipped.
export function cursorSrc(cursor) {
  if (!cursor || typeof cursor !== 'string') return null;
  if (isEmojiCursor(cursor)) return '/images/emojis/' + cursor.slice(EMOJI_CURSOR_PREFIX.length);
  return '/images/cursors/' + cursor;
}

// A human name for a cursor tile. Uploaded filenames are generated as
// `<nick>-<timestamp>-<random>.png`, which is far too long for a 70px tile and
// is mostly noise — strip the machine-generated tail so the tile shows who made
// it. Anything not matching that shape (a file an admin dropped in by hand) is
// left alone apart from its extension.
export function cursorLabel(fileName) {
  const base = String(fileName).replace(/\.[^.]+$/, '');
  return base.replace(/-\d{10,}-[a-z0-9]{4,8}$/i, '') || base;
}
