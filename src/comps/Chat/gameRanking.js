import { ACTIVITIES } from '../activities';
import { monogram } from '../CodeRunner/PluginIcon';
import { wantsWallet } from '../CodeRunner/pluginTrust';

// What the Play picker shows: games, home-made and player-made alike, in one
// ranked list.
//
//   1. being played now, most players first
//   2. featured by an admin, in the order they were featured
//   3. only if neither has anything: the games most people opened lately
//      (and with no history at all, the home games)
//
// A "game" here is a built-in activity of kind 'game' (UNO, Minesweeper, ...)
// or a copecloud plugin, turned into the same shape so GameCard can draw
// either: { key, kind, id, label, blurb, art, live(), chips(), action(),
// players, owner }. Kept free of React so it can be tested on its own.

export const PICKER_LIMIT = 9;

export const gameKey = (kind, id) => `${kind}:${id}`;

// A built-in game, as the picker sees it. Its live facts come from the state
// the server broadcasts (`activities[id]`).
function fromActivity(a, state) {
  return {
    ...a,
    key: gameKey('activity', a.id),
    kind: 'activity',
    players: a.live?.(state) ? (state?.players ?? 1) : 0,
    state,
  };
}

// A plugin, as the picker sees it: its icon (or letter) for art, its
// description for a blurb, and copecloud's count of who has it open.
export function fromPlugin(p) {
  const { letter, hue } = monogram(p.appname);
  const players = p.playing || 0;
  return {
    key: gameKey('plugin', p.appname),
    kind: 'plugin',
    id: p.appname,
    label: p.appname,
    owner: p.owner || null,
    blurb: p.description || (p.owner ? `A game by ${p.owner}.` : 'A player-made game.'),
    art: {
      from: `hsl(${hue} 50% 30%)`,
      to: `hsl(${(hue + 40) % 360} 55% 42%)`,
      image: typeof p.icon === 'string' && /^https?:\/\//i.test(p.icon) ? p.icon : null,
      letter,
    },
    players,
    live: () => players > 0,
    chips: () => [
      players ? `${players} playing` : null,
      p.owner ? `by ${p.owner}` : null,
      wantsWallet(p) ? 'uses coins' : null,
    ].filter(Boolean),
    action: () => (players ? 'Join' : 'Play'),
  };
}

// Every game there is: the built-in ones first (in their fixed order), then
// plugins by name. What "All games" lists.
export function allGames(activities, plugins) {
  return [
    ...ACTIVITIES.filter(a => a.kind === 'game').map(a => fromActivity(a, activities?.[a.id])),
    ...[...plugins].sort((a, b) => a.appname.localeCompare(b.appname, undefined, { sensitivity: 'base' })).map(fromPlugin),
  ];
}

// The picker's list and what it is: { games, reason } where reason is 'ranked'
// (live and/or featured games), 'popular' (the fallback) or 'quiet' (no
// history either: the home games).
export function rankGames({ activities = {}, plugins = [], featured = [], popular = [], limit = PICKER_LIMIT }) {
  const games = allGames(activities, plugins);
  const byKey = new Map(games.map(g => [g.key, g]));

  const live = games
    .filter(g => g.players > 0)
    .sort((a, b) => b.players - a.players);

  const taken = new Set(live.map(g => g.key));
  const featuredGames = featured
    .map(f => byKey.get(gameKey(f.kind, f.id)))
    .filter(g => g && !taken.has(g.key));

  const ranked = [...live, ...featuredGames];
  if (ranked.length) return { games: ranked.slice(0, limit), reason: 'ranked' };

  const popularGames = popular
    .map(p => byKey.get(gameKey(p.kind, p.id)))
    .filter(Boolean);
  if (popularGames.length) return { games: popularGames.slice(0, limit), reason: 'popular' };

  // nothing on record yet (a new site): the home games, so Play is never empty
  return { games: games.filter(g => g.kind === 'activity').slice(0, limit), reason: 'quiet' };
}

export function isFeatured(featured, game) {
  return featured.some(f => gameKey(f.kind, f.id) === game.key);
}
