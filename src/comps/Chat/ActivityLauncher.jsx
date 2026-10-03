import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { ACTIVITIES, openEvent } from '../activities';
import GamePicker from './GamePicker';
import useNarrow from '../../utils/useNarrow';
import socket from '../../utils/socket';

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
// Player-made games (copecloud plugins, `plugins`) are ranked alongside the
// home games, by who's playing and what's featured (gameRanking.js). The
// server keeps the featured list and what's been popular lately: asked for
// each time the picker opens (`gamesInfo`), and pushed to everyone when an
// admin (`isAdmin`) features a game (`gamesFeatured`). Plugin player counts
// come from copecloud, so the plugin list is refetched too
// (`onRefreshPlugins`). A plugin opens through `onOpenPlugin`.
function ActivityLauncher({ activities, plugins = [], onOpenPlugin, onRefreshPlugins, isAdmin = false }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 51, right: 8 });
  const [featured, setFeatured] = useState([]);
  const [popular, setPopular] = useState([]);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const narrow = useNarrow();

  useEffect(() => {
    const offs = [
      socket.on('gamesInfo', (data) => {
        setFeatured(Array.isArray(data?.featured) ? data.featured : []);
        setPopular(Array.isArray(data?.popular) ? data.popular : []);
      }),
      socket.on('gamesFeatured', (list) => setFeatured(Array.isArray(list) ? list : [])),
    ];
    return () => offs.forEach(off => off && off());
  }, []);

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
    if (!open) {
      // fresh rankings and player counts each time it opens
      socket.emit('gamesInfo');
      onRefreshPlugins?.();
    }
    setOpen(v => !v);
  }

  function launch(game) {
    if (game.kind === 'plugin') onOpenPlugin?.(game.id);
    else window.dispatchEvent(new CustomEvent(openEvent(game.id)));
    setOpen(false);
  }

  function toggleFeatured(game, on) {
    socket.emit('gameFeature', { kind: game.kind, id: game.id, featured: on });
  }

  // How many activities have something happening in them. Drives the badge,
  // which is the whole reason the button is worth looking at: nobody starts UNO
  // alone, so what recruits a player is seeing that a game is already up.
  const liveCount = ACTIVITIES.filter(a => a.live?.(activities[a.id])).length
    + plugins.filter(p => p.playing > 0).length;

  const picker = (
    <GamePicker
      ref={menuRef}
      sheet={narrow}
      activities={activities}
      plugins={plugins}
      featured={featured}
      popular={popular}
      isAdmin={isAdmin}
      onLaunch={launch}
      onToggleFeatured={toggleFeatured}
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
        title='Games'
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
