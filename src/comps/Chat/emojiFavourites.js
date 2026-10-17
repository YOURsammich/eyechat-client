import { useSyncExternalStore } from 'react';
import socket from '../../utils/socket';

// This viewer's pinned and most-used emoji (feedback #102). They live on the
// server (emojiFavourites.js there), per account, and arrive as
// `emojiFavourites` { pins, used: [{ id, uses, last }], account }: when asked,
// after a pin change, and after a message of theirs changed the counts, on
// every tab they have open. A guest gets `account: false` and neither.

export const MAX_PINS = 20;

const EMPTY = { pins: [], used: [], account: false };
let state = EMPTY;
const listeners = new Set();

function set(next) {
  state = next;
  listeners.forEach(fn => fn());
}

socket.on('emojiFavourites', (data) => {
  const account = !!data?.account;
  set(account
    ? { pins: Array.isArray(data.pins) ? data.pins : [], used: Array.isArray(data.used) ? data.used : [], account }
    : EMPTY);
});

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useEmojiFavourites() {
  return useSyncExternalStore(subscribe, () => state);
}

export function requestFavourites() {
  socket.emit('emojiFavourites');
}

export function setPinned(id, pinned) {
  if (!state.account) return;
  if (pinned && !state.pins.includes(id) && state.pins.length >= MAX_PINS) return;
  // shown at once; the server's answer confirms it, or puts it right
  const pins = pinned ? [...state.pins.filter(p => p !== id), id] : state.pins.filter(p => p !== id);
  set({ ...state, pins });
  socket.emit('emojiPin', { id, pinned });
}

const byName = (a, b) => a.id.toLowerCase().localeCompare(b.id.toLowerCase()) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// `emojis` (anything with an `id`) in the order every emoji list uses:
// pinned (in pin order), then most-used (the server sends them most uses
// first, ties to the most recent), then the rest A to Z. An id that's no
// longer in `emojis` (a deleted emoji) simply drops out.
export function orderEmojis(emojis, favs = state) {
  const pinRank = new Map(favs.pins.map((id, i) => [id, i]));
  const usedRank = new Map(favs.used.map((u, i) => [u.id, i]));
  const rank = (e) => pinRank.has(e.id)
    ? pinRank.get(e.id)
    : usedRank.has(e.id) ? pinRank.size + usedRank.get(e.id) : Infinity;
  return [...emojis].sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    return byName(a, b);
  });
}

// The side panel's sections from the room's emoji: Pinned, Most used (the top
// `top`, leaving out what's pinned) and All, every one, sorted by `sort`:
// 'used' (your most used first, the rest A to Z) or 'name' (A to Z).
export function emojiSections(emojis, favs = state, top = 24, sort = 'used') {
  const byId = new Map(emojis.map(e => [e.id, e]));
  const pinned = favs.pins.map(id => byId.get(id)).filter(Boolean);
  const pinSet = new Set(favs.pins);
  const used = favs.used.filter(u => !pinSet.has(u.id)).map(u => byId.get(u.id)).filter(Boolean).slice(0, top);
  const all = sort === 'used' ? orderEmojis(emojis, { pins: [], used: favs.used }) : [...emojis].sort(byName);
  return { pinned, used, all };
}
