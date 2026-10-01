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
