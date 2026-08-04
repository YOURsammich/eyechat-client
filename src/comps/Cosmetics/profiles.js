// Client mirror of TEXT_STYLE_COLUMNS / PROFILE_COLUMNS in src/db.js — the
// cosmetic columns a style profile snapshots. Keep the two in step: a column
// missing here silently stops being saved into (and compared against) profiles.

// The message text style: four independent properties rather than one packed
// markup string, so each is validated and edited on its own.
export const TEXT_STYLE_COLUMNS = ['color', 'glow', 'font', 'style'];

export const PROFILE_COLUMNS = ['flair', 'hat', 'avatar', 'cursor', 'part', ...TEXT_STYLE_COLUMNS];

// Mirror of MAX_PROFILES in src/db.js, for disabling the create actions before
// they fail. The server enforces the real cap.
export const MAX_PROFILES = 10;

// How the menu groups those columns into the sections a user actually navigates.
// The four text-style properties are one "Message text" aspect.
export const ASPECT_COLUMNS = {
  flair:     ['flair'],
  avatar:    ['avatar'],
  hat:       ['hat'],
  cursor:    ['cursor'],
  textstyle: TEXT_STYLE_COLUMNS,
  part:      ['part'],
};

// Parse an avatar ref, which arrives as a JSON string from the DB or an already-
// parsed object from a live state change.
export function parseAvatar(avatar) {
  if (!avatar) return null;
  if (typeof avatar !== 'string') return avatar;
  try {
    return JSON.parse(avatar);
  } catch {
    return null;
  }
}

// Avatars are stored as a JSON string server-side but arrive as either a string
// or an already-parsed object depending on the path (session row vs. setState).
// Normalize so a profile's avatar column and the live one compare as text.
function normalizeAvatar(avatar) {
  if (!avatar) return null;
  if (typeof avatar === 'string') return avatar || null;
  try {
    return JSON.stringify(avatar);
  } catch {
    return null;
  }
}

// `style` is a text[] column, so it arrives as an array. Compare by value, and
// keep order and duplicates significant — a repeated token compounds in the
// parser, so ['/^','/^'] is genuinely not ['/^'].
function sameStyle(a, b) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length !== right.length) return false;
  return left.every((t, i) => t === right[i]);
}

// The user's current look, in the same shape as a saved profile row. Empty
// strings collapse to null so "unset" has one representation on both sides of a
// comparison.
export function liveBundle(user) {
  return {
    flair:  user?.flair || null,
    hat:    user?.hat || null,
    avatar: normalizeAvatar(user?.avatar),
    cursor: user?.cursor || null,
    part:   user?.part || null,
    color:  user?.color || null,
    glow:   user?.glow || null,
    font:   user?.font || null,
    style:  Array.isArray(user?.style) && user.style.length ? user.style : null,
  };
}

// Which columns of the live look differ from the profile that's selected. A null
// column in the profile means it doesn't set that aspect at all, so it can't
// disagree with anything — otherwise a flair-only profile would read as
// permanently modified just because you also happen to wear a hat.
export function driftedColumns(user, profile) {
  if (!profile) return [];
  const live = liveBundle(user);
  return PROFILE_COLUMNS.filter(col => {
    if (col === 'style') {
      const saved = Array.isArray(profile.style) && profile.style.length ? profile.style : null;
      if (saved === null) return false;
      return !sameStyle(saved, live.style);
    }
    const saved = col === 'avatar' ? normalizeAvatar(profile[col]) : (profile[col] || null);
    if (saved === null) return false;
    return saved !== live[col];
  });
}

// The same drift, reported as the menu sections it falls under, so "modified"
// names things a user can go and look at ("text", "hat") rather than columns.
export function driftedAspects(user, profile) {
  const drifted = new Set(driftedColumns(user, profile));
  return Object.entries(ASPECT_COLUMNS)
    .filter(([, cols]) => cols.some(c => drifted.has(c)))
    .map(([aspect]) => (aspect === 'textstyle' ? 'text' : aspect));
}

// Which sections a profile sets at all — so a flair-only profile reads
// differently from one that also carries a hat and an avatar.
export function definedAspects(profile) {
  if (!profile) return [];
  return Object.entries(ASPECT_COLUMNS)
    .filter(([, cols]) => cols.some(c => {
      const val = profile[c];
      return Array.isArray(val) ? val.length > 0 : !!val;
    }))
    .map(([aspect]) => (aspect === 'textstyle' ? 'text' : aspect));
}
