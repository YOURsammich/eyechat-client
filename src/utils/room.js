// The room this page is for, read from its URL: cope.chat/ is main,
// cope.chat/degen is degen. The server decides whether the room exists (an
// unknown one is refused at /preconnect); this only says which one to ask for.
export function roomFromPath(pathname) {
  const name = String(pathname || '').replace(/^\/+|\/+$/g, '').split('/')[0];
  return name || 'main';
}

export const ROOM = typeof window === 'undefined' ? 'main' : roomFromPath(window.location.pathname);

// Games, the whiteboard, plugins and What's New only exist in main (for now).
export const IN_MAIN = ROOM === 'main';

// Go to another room: a page load of its URL. Used when the server sends
// someone to /degen (or a ban from /degen sends them back to main). Why rides
// along in the query so the room they land in can say so (see arrivalNotice).
export function goToRoom(room, { from, kind } = {}) {
  const path = room === 'main' ? '/' : '/' + room;
  const query = from && kind ? `?from=${encodeURIComponent(from)}&why=${encodeURIComponent(kind)}` : '';
  window.location.replace(path + query);
}

function roomLabel(name) {
  return name === 'main' ? 'the main room' : '/' + name;
}

// The line to show on arriving by goToRoom, or null. Read once, then the query
// is dropped from the address bar so a reload or a shared link doesn't repeat it.
export function arrivalNotice(search = typeof window === 'undefined' ? '' : window.location.search) {
  const q = new URLSearchParams(search);
  const from = q.get('from');
  const why = q.get('why');
  if (!from || !why) return null;
  if (typeof window !== 'undefined' && window.history?.replaceState) {
    window.history.replaceState(null, '', window.location.pathname);
  }
  const where = roomLabel(from);
  if (ROOM !== 'degen') return `You were banned from ${where}.`;
  switch (why) {
    case 'spam': return 'You were banned for spamming for a few hours, so you\'re in /degen until it runs out.';
    case 'proxy': return `${where[0].toUpperCase() + where.slice(1)} doesn't allow proxies or VPNs, so you're in /degen.`;
    case 'sent': return `A mod sent you to /degen. You can go back to ${where} whenever you like.`;
    default: return `You're banned from ${where}, so you're in /degen until the ban is lifted.`;
  }
}
