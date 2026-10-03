// The plugins this viewer opened lately, newest first, so the Play menu can
// lead with them instead of copecloud's arbitrary order. Per browser, like the
// display-mode overrides in pluginMode.js; nothing breaks without it.

const KEY = 'pluginRecent';
const MAX = 10;

export function readRecent() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(parsed) ? parsed.filter(name => typeof name === 'string') : [];
  } catch {
    // private mode, blocked storage, or corrupt JSON
    return [];
  }
}

export function noteOpened(appname) {
  if (!appname) return;
  const next = [appname, ...readRecent().filter(name => name !== appname)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // the order just won't survive a reload
  }
}

// `plugins` with the recently opened ones first (newest first), the rest in
// the order they came.
export function recentFirst(plugins, recent = readRecent()) {
  const rank = new Map(recent.map((name, i) => [name, i]));
  return plugins
    .map((plugin, i) => ({ plugin, i, r: rank.has(plugin.appname) ? rank.get(plugin.appname) : Infinity }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(({ plugin }) => plugin);
}
