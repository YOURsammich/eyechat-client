import { forwardRef } from 'react';

import { ACTIVITIES } from '../activities';
import GameCard from './GameCard';

// What the Play button opens: the room's games as cards in a grid, the
// Whiteboard as a strip under them, then the ways out (the games hub page, the
// whiteboard gallery, and player-made games in the plugin bar).
//
// The cards keep a fixed order, so nothing moves under the cursor as games
// start and finish. `sheet` is the phone layout: a sheet up from the bottom,
// two cards to a row. ActivityLauncher owns opening, closing and placement;
// this is only what's inside.

const GamePicker = forwardRef(function GamePicker(
  { activities, onLaunch, onShowPlugins, onClose, sheet = false, style },
  ref,
) {
  const games = ACTIVITIES.filter(a => a.kind === 'game');
  const tools = ACTIVITIES.filter(a => a.kind !== 'game');

  return (
    <div
      ref={ref}
      className={'gamePicker' + (sheet ? ' gamePickerSheet' : '')}
      role='menu'
      aria-label='Games and tools'
      style={style}
    >
      <div className='gamePickerHeader'>
        <span className='gamePickerTitle'>Play</span>
        {sheet ? (
          <button type='button' className='gamePickerClose' onClick={onClose} aria-label='Close'>
            <span className='material-symbols-outlined'>close</span>
          </button>
        ) : null}
      </div>

      <div className='gamePickerGrid'>
        {games.map(a => (
          <GameCard key={a.id} role='menuitem' activity={a} state={activities[a.id]} onLaunch={onLaunch} />
        ))}
      </div>

      {tools.map(a => (
        <GameCard key={a.id} wide role='menuitem' activity={a} state={activities[a.id]} onLaunch={onLaunch} />
      ))}

      {/* The ways out: pages of their own, and plugins' own home. */}
      <div className='gamePickerFooter'>
        <a className='gamePickerLink' role='menuitem' href='/games' target='_blank' rel='noopener' onClick={onClose}>
          <span className='material-symbols-outlined'>open_in_new</span>
          Games hub
        </a>
        <a className='gamePickerLink' role='menuitem' href='/gallery' target='_blank' rel='noopener' onClick={onClose}>
          <span className='material-symbols-outlined'>photo_library</span>
          Whiteboard gallery
        </a>
        {onShowPlugins ? (
          <button type='button' className='gamePickerLink gamePickerPlugins' role='menuitem' onClick={onShowPlugins}>
            <span className='material-symbols-outlined'>extension</span>
            Player-made games
            <span className='material-symbols-outlined' aria-hidden='true'>arrow_forward</span>
          </button>
        ) : null}
      </div>
    </div>
  );
});

export default GamePicker;
