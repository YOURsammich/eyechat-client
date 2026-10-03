import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { ACTIVITIES, openEvent } from '../activities';
import GamePicker from './GamePicker';
import useNarrow from '../../utils/useNarrow';

// The one entry point to everything the room can *do* — games and shared tools.
// Lives in the chat header because that is the only surface about the room right
// now; the side menu next to it is about you and the channel's configuration,
// which is a different question and a different answer.
//
// Deliberately one button. The alternative shapes both cost more than they give:
// a permanent dock or games sidebar takes width from the log forever to show
// something used for a few minutes an evening, and a seventh icon in the quickNav
// bar files a game under settings.
//
// What it opens is the game picker (GamePicker): cards with live status rather
// than a list of words. Placement copies the ⋮ dropdown in ChatWindow: portaled
// to <body> and placed from the button's own rect, so no ancestor's overflow can
// clip it and the header does not need a stacking context. On a phone it's a
// sheet up from the bottom instead.
//
// `activities` is the live state, keyed by activity id, that the server pushes
// over the `activity` socket event. An empty object is the normal case and the
// picker still opens — it just has nothing to report.
//
// Plugins aren't listed here: the plugin bar is their one home. Someone who
// comes looking for player-made games gets a single link at the foot that opens
// the bar's plugin panel (`onShowPlugins`).
function ActivityLauncher({ activities, onShowPlugins }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 51, right: 8 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const narrow = useNarrow();

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    // Escape closes too: the picker is a transient overlay, and reaching for the
    // mouse to dismiss one you opened by mistake is a small, repeated cost.
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }

    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    }
    setOpen(v => !v);
  }

  function launch(id) {
    window.dispatchEvent(new CustomEvent(openEvent(id)));
    setOpen(false);
  }

  function showPlugins() {
    onShowPlugins?.();
    setOpen(false);
  }

  // How many activities have something happening in them. Drives the badge,
  // which is the whole reason the button is worth looking at: nobody starts UNO
  // alone, so what recruits a player is seeing that a game is already up.
  const liveCount = ACTIVITIES.filter(a => a.live?.(activities[a.id])).length;

  const picker = (
    <GamePicker
      ref={menuRef}
      sheet={narrow}
      activities={activities}
      onLaunch={launch}
      onShowPlugins={onShowPlugins ? showPlugins : null}
      onClose={() => setOpen(false)}
      style={narrow ? undefined : { top: pos.top, right: pos.right }}
    />
  );

  return (
    <>
      <button
        type='button'
        className={'activityBtn' + (liveCount ? ' hasLive' : '')}
        ref={btnRef}
        onClick={toggle}
        title='Games and tools'
        aria-haspopup='menu'
        aria-expanded={open}
      >
        <span className='material-symbols-outlined'>sports_esports</span>
        <span className='activityBtnLabel'>Play</span>
        {liveCount ? <span className='activityLiveDot' aria-label={`${liveCount} live`} /> : null}
      </button>

      {open && createPortal(
        // a phone: the sheet over a dimmed chat; a tap on the dim closes it
        narrow ? <div className='gamePickerBackdrop'>{picker}</div> : picker,
        document.body,
      )}
    </>
  );
}

export default ActivityLauncher;
