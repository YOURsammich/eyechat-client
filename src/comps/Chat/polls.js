import { useEffect, useSyncExternalStore } from 'react';
import socket from '../../utils/socket';

// /qpoll cards (feedback #106). The chat line only carries the poll's id; the
// poll itself lives here, keyed by id, as this viewer's view of it: the server
// leaves out the counts and voters until you've voted or it's closed.
//
// A card on screen asks for its poll (`pollGet`, batched so a screenful of
// scrollback is one request), and every vote or close in the room sends each
// viewer a fresh `pollState`. Messages caches rendered rows, so a card can't be
// handed new props; it reads this store instead.

const polls = new Map();
const listeners = new Set();
let wanted = new Set();
let flushQueued = false;

socket.on('pollState', (state) => {
  if (!state || !Number.isInteger(state.id)) return;
  polls.set(state.id, state);
  listeners.forEach(fn => fn());
});

// After a reconnect the server may have moved on: ask again for every card.
socket.onReconnect(() => {
  if (polls.size) socket.emit('pollGet', { ids: [...polls.keys()] });
});

function request(id) {
  wanted.add(id);
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(() => {
    flushQueued = false;
    const ids = [...wanted];
    wanted = new Set();
    if (ids.length) socket.emit('pollGet', { ids });
  });
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// The poll for a card, or undefined until the server answers.
export function usePoll(id) {
  useEffect(() => {
    if (Number.isInteger(id) && !polls.has(id)) request(id);
  }, [id]);
  return useSyncExternalStore(subscribe, () => polls.get(id));
}

export function vote(pollId, answer) {
  socket.emit('pollVote', { pollId, answer });
}
