// The plugins this viewer opened lately, newest first, for the plugin panel's
// Recent section. Per browser, like the display-mode overrides in
// pluginMode.js; nothing breaks without it.

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
