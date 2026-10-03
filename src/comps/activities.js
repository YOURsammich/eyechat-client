// Everything the room can *do* as opposed to configure: games and the shared
// tools that open in their own floating window. This array drives
//
//   • the game cards (GameCard) in the chat header's Play picker
//     (ActivityLauncher) and on the games hub page,
//   • which panel ChatWindow mounts (the component itself lives in
//     activityPanels.js — see the note there for why they are apart),
//   • the typed command that opens it (handleInput builds /uno, /whiteboard, /wb
//     from `id` and `aliases` rather than hand-rolling a handler each time),
//   • the "N live" badge and each card's chips, from the server's `activity`
//     events,
//   • the client-command section of the public features page.
//
// Deliberately free of React imports so that last one stays cheap: the features
// page needs the names and the blurbs, not the games themselves.
//
// Anything that configures you or the room — cosmetics, settings, the shop, the
// ban list — is NOT an activity. Those live in the side menu, which is a
// different surface with a different job. The test is whether two people can be
// *in* it at once.
//
// Plugins are not in this array: they come from copecloud at runtime, open the
// code runner rather than the draggable panels below, and live in the plugin
// bar (PluginRail). The Play picker ranks them alongside these games
// (Chat/gameRanking.js turns a plugin into the same shape).

export const ACTIVITIES = [
  {
    id: 'uno',
    label: 'UNO',
    kind: 'game',
    icon: 'playing_cards',
    blurb: 'The card game, with a pot of coins riding on it.',

    // Whether this counts toward the header's "N live" badge.
    live(state) {
      return (state?.sessions?.length ?? 0) > 0;
    },

    // The game's card (GameCard, in the Play picker and the games hub): `art`
    // is the band across its top, `chips` the live facts under the blurb,
    // given this activity's slice of the live state the server broadcasts
    // (none when idle, which keeps an idle card quiet instead of a row of
    // zeroes), and `action` the word on its button. Placeholder art — swap
    // `glyph` for an image later.
    art: { from: '#c81d3a', to: '#f97316', glyph: 'playing_cards' },

    chips(state) {
      const sessions = state?.sessions ?? [];
      if (!sessions.length) return [];
      const open = sessions.filter(s => s.open).length;
      // every player in a game has put in its bet
      const pot = sessions.reduce((sum, s) => sum + (s.bet || 0) * (s.players || 0), 0);
      return [
        `${state.players ?? 0} playing`,
        open ? `${open} open to join` : null,
        pot ? `₵${pot} in play` : null,
      ].filter(Boolean);
    },

    action(state) {
      return (state?.sessions ?? []).some(s => s.open) ? 'Join' : 'Start a game';
    },
  },
  {
    id: 'minesweeper',
    label: 'Minesweeper',
    kind: 'game',
    icon: 'bomb',
    aliases: ['ms'],
    blurb: 'One huge shared grid, everyone at once. Flags score, bombs cost.',

    // There is no lobby to join — the map is always there — so it only counts
    // as live while someone is on it.
    live(state) {
      return (state?.players ?? 0) > 0;
    },

    art: { from: '#1e3a5f', to: '#2f855a', glyph: 'bomb' },

    // How far the map has got is worth showing even when nobody's on it.
    chips(state) {
      if (!state) return [];
      return [
        state.players ? `${state.players} playing` : null,
        `${state.progress ?? 0}% cleared`,
      ].filter(Boolean);
    },

    // there's always a map to play on
    action(state) {
      return state?.players ? 'Join' : 'Play';
    },
  },
  {
    id: 'solvex',
    label: 'Solve for X',
    kind: 'game',
    icon: 'function',
    aliases: ['sx', 'solve'],
    blurb: 'Ten equations, same for everyone, fastest set of answers takes the pot.',

    // One lobby at a time, so the card is about that lobby: recruiting while
    // it waits, a race while it runs, quiet in between.
    live(state) {
      return !!state && state.state !== 'none';
    },

    art: { from: '#3730a3', to: '#0891b2', glyph: 'function' },

    chips(state) {
      if (!state || state.state === 'none') return [];
      if (state.state === 'lobby') {
        return [
          `${state.players} waiting`,
          state.difficulty,
          state.bet ? `₵${state.bet} to enter` : null,
        ].filter(Boolean);
      }
      return [`${state.players} racing`, state.difficulty].filter(Boolean);
    },

    action(state) {
      if (state?.state === 'lobby') return 'Join';
      if (state && state.state !== 'none') return 'Watch';
      return 'Start a race';
    },
  },
  {
    id: 'whiteboard',
    label: 'Whiteboard',
    kind: 'tool',
    icon: 'draw',
    // `/whiteboard` comes from the id; this is the short form people actually type.
    aliases: ['wb'],
    blurb: 'One shared board. The marker gets passed around.',

    live(state) {
      return !!state?.holder;
    },

    // a tool, so a strip under the game cards rather than a card
    art: { from: '#7e22ce', to: '#db2777', glyph: 'draw' },

    chips(state) {
      if (!state?.holder) return [];
      return [
        `${state.holder} drawing`,
        state.waiting ? `${state.waiting} waiting` : null,
      ].filter(Boolean);
    },

    action(state) {
      return state?.holder ? 'Watch' : 'Open';
    },
  },
];

// The window event that opens an activity. Kept as a function rather than a
// field so an entry can't drift from what ChatWindow listens for — both sides
// call this. Note these are `window` CustomEvents, a different namespace from
// the socket's `uno:` / `wb:` traffic, so they can never collide with a
// server-sent event of the same name.
export const openEvent = (id) => `${id}:open`;
export const closeEvent = (id) => `${id}:close`;

export function getActivity(id) {
  return ACTIVITIES.find(a => a.id === id) ?? null;
}

// Every name that should open `id` from the input bar: the id itself plus its
// aliases. Used to build the client command table.
export function activityCommandNames(activity) {
  return [activity.id, ...(activity.aliases ?? [])];
}

// How the launcher groups its rows. Order matters — games first, since that is
// what someone opens the menu looking for.
export const ACTIVITY_KINDS = [
  { kind: 'game', label: 'Games' },
  { kind: 'tool', label: 'Tools' },
];
