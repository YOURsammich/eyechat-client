import { forwardRef, useState, useRef, useEffect } from 'react';

import { ACTIVITIES } from '../activities';
import GameCard from './GameCard';
import { rankGames, allGames, isFeatured } from './gameRanking';

// What the Play button opens: games as cards, home-made and player-made
// alike, ranked by what's on (gameRanking.js): being played now, then
// featured, and when neither has anything, the games most played lately.
// Under them the Whiteboard as a strip, then the ways out: every game ("All
// games", with a search), the games hub page and the whiteboard gallery.
//
// A featured game wears a star. Admins get the star as a button on every
// card, to feature a game or stop featuring it; everyone's picker updates.
//
// `sheet` is the phone layout: a sheet up from the bottom, two cards a row.
// ActivityLauncher owns opening, closing and placement; this is what's inside.

function matchesGame(game, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [game.label, game.owner, game.blurb]
    .some(field => typeof field === 'string' && field.toLowerCase().includes(q));
}

function CardSlot({ game, featured, isAdmin, onLaunch, onToggleFeatured }) {
  return (
    <div className='gameCardSlot'>
      <GameCard role='menuitem' activity={game} state={game.state} onLaunch={() => onLaunch(game)} />
      {isAdmin ? (
        <button
          type='button'
          className={'gameFeatureBtn' + (featured ? ' on' : '')}
          onClick={() => onToggleFeatured(game, !featured)}
          aria-pressed={featured}
          aria-label={(featured ? 'Stop featuring ' : 'Feature ') + game.label}
          title={featured ? 'Featured: click to stop featuring it' : 'Feature this game'}
        >
          <span className='material-symbols-outlined'>star</span>
        </button>
      ) : featured ? (
        <span className='gameFeatureBtn on' title='Featured' aria-label='Featured'>
          <span className='material-symbols-outlined'>star</span>
        </span>
      ) : null}
    </div>
  );
}

const GamePicker = forwardRef(function GamePicker({
  activities, plugins = [], featured = [], popular = [], isAdmin = false,
  onLaunch, onToggleFeatured, onClose, sheet = false, style,
}, ref) {
  const [view, setView] = useState('top');
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    // ready to type on desktop; on a phone that would throw up the keyboard
    if (view === 'all' && !sheet) searchRef.current?.focus();
  }, [view, sheet]);

  const { games: ranked, reason } = rankGames({ activities, plugins, featured, popular });
  const everything = allGames(activities, plugins);
  const shown = view === 'all' ? everything.filter(g => matchesGame(g, query)) : ranked;
  const tools = ACTIVITIES.filter(a => a.kind !== 'game');

  const slot = (g) => (
    <CardSlot
      key={g.key}
      game={g}
      featured={isFeatured(featured, g)}
      isAdmin={isAdmin}
      onLaunch={onLaunch}
      onToggleFeatured={onToggleFeatured}
    />
  );

  return (
    <div
      ref={ref}
      className={'gamePicker' + (sheet ? ' gamePickerSheet' : '')}
      role='menu'
      aria-label='Games'
      style={style}
    >
      <div className='gamePickerHeader'>
        {view === 'all' ? (
          <button type='button' className='gamePickerBack' onClick={() => { setView('top'); setQuery(''); }} aria-label='Back'>
            <span className='material-symbols-outlined'>arrow_back</span>
            <span className='gamePickerTitle'>All games <span className='gamePickerCount'>{everything.length}</span></span>
          </button>
        ) : (
          <span className='gamePickerTitle'>
            {reason === 'popular' ? 'Popular lately' : 'Play'}
          </span>
        )}
        {sheet ? (
          <button type='button' className='gamePickerClose' onClick={onClose} aria-label='Close'>
            <span className='material-symbols-outlined'>close</span>
          </button>
        ) : null}
      </div>

      {view === 'all' ? (
        <div className='gamePickerSearch'>
          <span className='material-symbols-outlined' aria-hidden='true'>search</span>
          <input
            ref={searchRef}
            type='search'
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder='Search games'
            aria-label='Search games'
          />
        </div>
      ) : reason === 'popular' ? (
        <p className='gamePickerNote'>Nothing on right now. These are the games people opened most this week.</p>
      ) : reason === 'quiet' ? (
        <p className='gamePickerNote'>Nothing on right now. Start something, or see all games below.</p>
      ) : null}

      {shown.length ? (
        <div className='gamePickerGrid'>{shown.map(slot)}</div>
      ) : (
        <p className='gamePickerNote'>No games match &ldquo;{query.trim()}&rdquo;.</p>
      )}

      {view === 'top' ? tools.map(a => (
        <GameCard key={a.id} wide role='menuitem' activity={a} state={activities[a.id]}
          onLaunch={() => onLaunch({ kind: 'activity', id: a.id })} />
      )) : null}

      {/* The ways out: every game, and pages of their own. */}
      <div className='gamePickerFooter'>
        {view === 'top' ? (
          <button type='button' className='gamePickerLink gamePickerAll' role='menuitem' onClick={() => setView('all')}>
            <span className='material-symbols-outlined'>apps</span>
            All games ({everything.length})
            <span className='material-symbols-outlined' aria-hidden='true'>arrow_forward</span>
          </button>
        ) : null}
        <a className='gamePickerLink' role='menuitem' href='/games' target='_blank' rel='noopener' onClick={onClose}>
          <span className='material-symbols-outlined'>open_in_new</span>
          Games hub
        </a>
        <a className='gamePickerLink' role='menuitem' href='/gallery' target='_blank' rel='noopener' onClick={onClose}>
          <span className='material-symbols-outlined'>photo_library</span>
          Whiteboard gallery
        </a>
      </div>
    </div>
  );
});

export default GamePicker;
