// Fonts (feedback #48): every Google Font name the picker offers, most popular
// first (fonts.json, written by scripts/update-fonts.js in the server repo), and
// the admin blacklist the server sends on join and whenever it changes. A
// blacklisted font is never loaded: text that uses it shows in the normal font.
import FONT_NAMES from '../fonts.json';

export { FONT_NAMES };

const byLower = new Map(FONT_NAMES.map(n => [n.toLowerCase(), n]));
const blocked = new Set();

// The font's real name if it's a Google Font, else null.
export function canonicalFont(name) {
  return byLower.get(String(name ?? '').trim().toLowerCase()) ?? null;
}

export function isBlockedFont(name) {
  return blocked.has(String(name ?? '').trim().toLowerCase());
}

// Replace the blacklist; the picker listens for 'fonts:blocked' to refresh.
export function setBlockedFonts(list) {
  blocked.clear();
  for (const name of list || []) blocked.add(String(name).toLowerCase());
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('fonts:blocked'));
}

// The fonts someone may pick: every Google Font that isn't blacklisted.
export function availableFonts() {
  return FONT_NAMES.filter(n => !blocked.has(n.toLowerCase()));
}
