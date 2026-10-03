import { useSyncExternalStore } from 'react';
import socket from '../../utils/socket';

// The plugins this viewer has pinned, in the order they pinned them. They
// lead the plugin bar and the Play menu, and have their own section in the
// drawer. A logged-in account's pins live on the server (pluginPins.js there)
// and arrive as `pluginPinList`; a guest has no account, so the server says
// `account: false` and their pins are kept in this browser instead.

const KEY = 'pluginPins';

function readLocal() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(parsed) ? parsed.filter(name => typeof name === 'string') : [];
  } catch {
    return [];
  }
}

function writeLocal(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // they just won't survive a reload
  }
}

// Until the server answers, the browser's copy, so a guest's bar doesn't jump.
let state = { list: readLocal(), account: false };
const listeners = new Set();

function set(next) {
  state = next;
  listeners.forEach(fn => fn());
}

socket.on('pluginPinList', (data) => {
  const account = !!data?.account;
  set({ list: account && Array.isArray(data.list) ? data.list : readLocal(), account });
});

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function usePinnedPlugins() {
  return useSyncExternalStore(subscribe, () => state.list);
}

export function requestPins() {
  socket.emit('pluginPinList');
}

export function setPinned(appname, pinned) {
  if (state.account) {
    // shown at once; the server's answer confirms it, or puts it right
    const list = pinned
      ? [...state.list.filter(n => n !== appname), appname]
      : state.list.filter(n => n !== appname);
    set({ ...state, list });
    socket.emit('pluginPin', { appname, pinned });
    return;
  }
  const list = pinned
    ? [...readLocal().filter(n => n !== appname), appname]
    : readLocal().filter(n => n !== appname);
  writeLocal(list);
  set({ ...state, list });
}

// `plugins` in the order every plugin list uses: pinned first (in pin
// order), then recently opened (newest first), then the rest as they came.
export function pinnedThenRecent(plugins, pins, recent) {
  const pinRank = new Map(pins.map((name, i) => [name, i]));
  const recentRank = new Map(recent.map((name, i) => [name, i]));
  const rank = (p) => pinRank.has(p.appname)
    ? pinRank.get(p.appname)
    : pins.length + (recentRank.has(p.appname) ? recentRank.get(p.appname) : recent.length);
  return plugins
    .map((plugin, i) => ({ plugin, i, r: rank(plugin) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ plugin }) => plugin);
}
