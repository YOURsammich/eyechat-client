// Everything the room can *do* as opposed to configure: games and the shared
// tools that open in their own floating window. This array drives
//
//   • the launcher in the chat header (ActivityLauncher),
//   • which panel ChatWindow mounts (the component itself lives in
//     activityPanels.js — see the note there for why they are apart),
//   • the typed command that opens it (handleInput builds /uno, /whiteboard, /wb
//     from `id` and `aliases` rather than hand-rolling a handler each time),
//   • the "N live" badge and the per-row status line, from the server's
//     `activity` events,
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
// The plugin bar (`/sidebar`, channel.showPluginBar) is deliberately untouched
// by this: plugins are a separate surface that opens the code runner, not the
// draggable panels below.

export const ACTIVITIES = [
  {
    id: 'uno',
    label: 'UNO',
    kind: 'game',
    icon: 'playing_cards',
    blurb: 'The card game, with a pot of coins riding on it.',

    // What the launcher prints beside the label, given this activity's slice of
    // the live state the server broadcasts. Null means "nothing going on", which
    // is what keeps an idle launcher quiet instead of a column of zeroes.
    status(state) {
      const sessions = state?.sessions ?? [];
      if (!sessions.length) return null;

      const players = state.players ?? 0;
      const open = sessions.filter(s => s.open).length;
      // "2 waiting to start" is the line that actually recruits someone; the
      // player count alone reads as a game you've already missed.
      if (open) return `${open} open · ${players} playing`;
      return `${players} playing`;
    },

    // Whether this counts toward the header's "N live" badge.
    live(state) {
      return (state?.sessions?.length ?? 0) > 0;
    },
  },
  {
    id: 'minesweeper',
    label: 'Minesweeper',
    kind: 'game',
    icon: 'bomb',
    aliases: ['ms'],
    blurb: 'One huge shared grid, everyone at once. Flags score, bombs cost.',

    // There is no lobby to join — the map is always there — so the row goes
    // quiet when nobody has clicked lately rather than always reading "0
    // playing", and shows how far the current map has got when someone has.
    status(state) {
      if (!state?.players) return null;
      const progress = state.progress ?? 0;
      return `${state.players} playing · ${progress}% cleared`;
    },

    live(state) {
      return (state?.players ?? 0) > 0;
    },
  },
  {
    id: 'solvex',
    label: 'Solve for X',
    kind: 'game',
    icon: 'function',
    aliases: ['sx', 'solve'],
    blurb: 'Ten equations, same for everyone, fastest set of answers takes the pot.',

    // One lobby at a time, so the row is about that lobby: recruiting while it
    // waits, a race while it runs, quiet in between.
    status(state) {
      if (!state || state.state === 'none') return null;
      const bet = state.bet ? ` · ₵${state.bet}` : '';
      if (state.state === 'lobby') return `${state.players} waiting · ${state.difficulty}${bet}`;
      return `${state.players} racing · ${state.difficulty}`;
    },

    live(state) {
      return !!state && state.state !== 'none';
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

    status(state) {
      if (!state?.holder) return null;
      const waiting = state.waiting ?? 0;
      return waiting
        ? `${state.holder} drawing · ${waiting} waiting`
        : `${state.holder} drawing`;
    },

    live(state) {
      return !!state?.holder;
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
