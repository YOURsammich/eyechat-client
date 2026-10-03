import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { ACTIVITIES, ACTIVITY_KINDS, openEvent } from '../activities';
import PluginIcon from '../CodeRunner/PluginIcon';
import { wantsWallet } from '../CodeRunner/pluginTrust';
import { readRecent } from '../CodeRunner/pluginRecent';
import { usePinnedPlugins, pinnedThenRecent } from '../CodeRunner/pluginPins';

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
// Positioning copies the ⋮ dropdown in ChatWindow: portaled to <body> and placed
// from the button's own rect, so no ancestor's overflow can clip it and the
// header does not need a stacking context.
//
// `activities` is the live state, keyed by activity id, that the server pushes
// over the `activity` socket event. An empty object is the normal case and the
// menu still opens — it just has nothing to report.
//
// Below the built-in groups come plugins: copecloud's public apps, written by
// other people. They open the plugin panel (`onOpenPlugin`) rather than an
// activity panel, and each row says whose it is and whether it can take coins,
// so nobody mistakes one for a game of ours. Only the first few are listed,
// the viewer's pinned and then recently opened ones first, so the room's own
// games stay in view however big copecloud's catalogue gets; "Browse all"
// opens the plugin panel (`onBrowsePlugins`) for the rest. `openPlugin` is
// the one showing now, if any.
export const PLUGINS_SHOWN = 5;

function ActivityLauncher({ activities, plugins = [], onOpenPlugin, openPlugin = null, onBrowsePlugins }) {
  const [open, setOpen] = useState(false);
  const pins = usePinnedPlugins();
  const [pos, setPos] = useState({ top: 51, right: 8 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (btnRef.current?.contains(e.target)) return;
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    }
    // Escape closes too: the menu is a transient overlay, and reaching for the
    // mouse to dismiss a menu you opened by mistake is a small, repeated cost.
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

  function launchPlugin(appname) {
    onOpenPlugin?.(appname);
    setOpen(false);
  }

  function browse() {
    onBrowsePlugins?.();
    setOpen(false);
  }

  // How many activities have something happening in them. Drives the badge,
  // which is the whole reason the button is worth looking at: nobody starts UNO
  // alone, so what recruits a player is seeing that a game is already up.
  const liveCount = ACTIVITIES.filter(a => a.live?.(activities[a.id])).length;

  // recents are read when the menu renders, so a plugin opened from the
  // plugin bar counts too
  const shownPlugins = open
    ? pinnedThenRecent(plugins, pins, readRecent()).slice(0, PLUGINS_SHOWN)
    : [];

  return (
    <>
      <button
        type='button'
        className={'activityBtn' + (liveCount ? ' hasLive' : '')}
        ref={btnRef}
        onClick={toggle}
        title='Games, tools and plugins'
        aria-haspopup='menu'
        aria-expanded={open}
      >
        <span className='material-symbols-outlined'>sports_esports</span>
        <span className='activityBtnLabel'>Play</span>
        {liveCount ? <span className='activityLiveDot' aria-label={`${liveCount} live`} /> : null}
      </button>

      {open && createPortal(
        <div
          className='activityMenu'
          ref={menuRef}
          role='menu'
          style={{ top: pos.top, right: pos.right }}
        >
          {ACTIVITY_KINDS.map(({ kind, label }) => {
            const rows = ACTIVITIES.filter(a => a.kind === kind);
            if (!rows.length) return null;

            return (
              <div className='activityGroup' key={kind}>
                <div className='activityGroupLabel'>{label}</div>
                {rows.map(a => {
                  const state = activities[a.id];
                  const status = a.status?.(state) ?? null;

                  return (
                    <button
                      type='button'
                      className='activityItem'
                      role='menuitem'
                      key={a.id}
                      onClick={() => launch(a.id)}
                    >
                      <span className='material-symbols-outlined activityItemIcon'>{a.icon}</span>
                      <span className='activityItemText'>
                        <span className='activityItemLabel'>{a.label}</span>
                        {/* The blurb is what makes this a front door rather than
                            a list of words someone has to already know. */}
                        <span className='activityItemBlurb'>{a.blurb}</span>
                      </span>
                      {status
                        ? <span className='activityItemStatus'>{status}</span>
                        : null}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {plugins.length && onOpenPlugin ? (
            <div className='activityGroup'>
              <div className='activityGroupLabel'>Plugins</div>
              {shownPlugins.map(p => (
                <button
                  type='button'
                  className={'activityItem' + (p.appname === openPlugin ? ' activityItemOpen' : '')}
                  role='menuitem'
                  key={p.appname}
                  title={p.appname}
                  aria-current={p.appname === openPlugin ? 'true' : undefined}
                  onClick={() => launchPlugin(p.appname)}
                >
                  <PluginIcon plugin={p} size={24} className='activityItemPluginIcon' />
                  <span className='activityItemText'>
                    <span className='activityItemLabel'>
                      {p.appname}
                      {p.owner ? <span className='activityItemOwner'> by {p.owner}</span> : null}
                    </span>
                    {p.description
                      ? <span className='activityItemBlurb'>{p.description}</span>
                      : null}
                  </span>
                  {wantsWallet(p) ? (
                    <span
                      className='material-symbols-outlined activityItemCoins'
                      title='Can take coins from you once you allow it'
                      aria-label='Uses your coins'
                    >paid</span>
                  ) : null}
                </button>
              ))}
              {onBrowsePlugins ? (
                <button
                  type='button'
                  className='activityBrowseAll'
                  role='menuitem'
                  onClick={browse}
                >
                  Browse all {plugins.length} plugins
                </button>
              ) : null}
            </div>
          ) : null}

          {/* The same games, on their own page: for playing without the chat
              open, or on a second screen. It is the one row that leaves the
              room, so it sits apart from the rows that open something here. */}
          <a
            className='activityHubLink'
            role='menuitem'
            href='/games'
            target='_blank'
            rel='noopener'
            onClick={() => setOpen(false)}
          >
            <span className='material-symbols-outlined activityItemIcon'>open_in_new</span>
            <span className='activityItemText'>
              <span className='activityItemLabel'>Games hub</span>
              <span className='activityItemBlurb'>Play from a page of its own, without the chat.</span>
            </span>
          </a>
          {/* Also a page of its own: drawings saved off the whiteboard. */}
          <a
            className='activityHubLink'
            role='menuitem'
            href='/gallery'
            target='_blank'
            rel='noopener'
            onClick={() => setOpen(false)}
          >
            <span className='material-symbols-outlined activityItemIcon'>photo_library</span>
            <span className='activityItemText'>
              <span className='activityItemLabel'>Whiteboard gallery</span>
              <span className='activityItemBlurb'>Drawings saved off the board — upvote them, watch them replay.</span>
            </span>
          </a>
        </div>,
        document.body,
      )}
    </>
  );
}

export default ActivityLauncher;
