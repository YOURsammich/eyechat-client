// "My font" (feedback #42, from #70): a font that replaces the room's font on
// this screen only. Saved in this browser, so each device has its own. Other
// people's own text-style fonts still show as they chose.
const KEY = 'ec_myFont';

export function getMyFont() {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}

export function setMyFont(font) {
  try {
    if (font) localStorage.setItem(KEY, font);
    else localStorage.removeItem(KEY);
  } catch { /* storage blocked: it just won't stick */ }
  window.dispatchEvent(new Event('myfont:change'));
}
