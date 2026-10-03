import { useState, useEffect, useRef } from 'react';

import PluginIcon from './PluginIcon';
import { wantsWallet } from './pluginTrust';
import { usePinnedPlugins, setPinned } from './pluginPins';
import { readRecent } from './pluginRecent';

// The plugin bar, opened out: every plugin on copecloud, with a search box,
// then the viewer's pinned and recent plugins, then all of them by name.
//
// On desktop it docks against the right edge of the bar (PluginRail) and
// shares its colour, so it reads as the bar getting wider; it lays over a
// docked plugin and the chat rather than pushing them about. On a phone, where
// there is no bar, it is a full-screen sheet (`sheet`) opened from the chat
// header. Opened by the bar's grid button and the Play menu's "Player-made
// games" row.
//
// Picking a plugin opens it and folds the panel away. The pin button beside
// each row pins it to the top of the bar.

export const RECENT_SHOWN = 5;

export function matches(plugin, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [plugin.appname, plugin.owner, plugin.description]
    .some(field => typeof field === 'string' && field.toLowerCase().includes(q));
}

function byName(a, b) {
  return a.appname.localeCompare(b.appname, undefined, { sensitivity: 'base' });
}

function PluginRow({ plugin, isOpen, pinned, onOpen }) {
  return (
    <li className={'pluginPanelRow' + (isOpen ? ' pluginPanelRowOpen' : '')}>
      <button
        type='button'
        className='pluginPanelOpen'
        onClick={() => onOpen(plugin.appname)}
        aria-current={isOpen ? 'true' : undefined}
      >
        <PluginIcon plugin={plugin} size={36} />
        <span className='pluginPanelText'>
          <span className='pluginPanelName'>
            {plugin.appname}
            {plugin.owner ? <span className='pluginPanelOwner'> by {plugin.owner}</span> : null}
          </span>
          {plugin.description
            ? <span className='pluginPanelDesc'>{plugin.description}</span>
            : null}
        </span>
        {wantsWallet(plugin) ? (
          <span
            className='material-symbols-outlined pluginPanelCoins'
            title='Can take coins from you once you allow it'
            aria-label='Uses your coins'
          >paid</span>
        ) : null}
      </button>
      <button
        type='button'
        className={'pluginPanelPin' + (pinned ? ' pinned' : '')}
        onClick={() => setPinned(plugin.appname, !pinned)}
        aria-pressed={pinned}
        aria-label={(pinned ? 'Unpin ' : 'Pin ') + plugin.appname}
        title={pinned ? 'Unpin' : 'Pin to the top of the plugin bar'}
      >
        <span className='material-symbols-outlined'>push_pin</span>
      </button>
    </li>
  );
}

function Section({ title, plugins, openPlugin, pins, onOpen }) {
  if (!plugins.length) return null;
  return (
    <section className='pluginPanelSection' aria-label={title}>
      <h3 className='pluginPanelHeading'>{title}</h3>
      <ul className='pluginPanelList'>
        {plugins.map(p => (
          <PluginRow
            key={p.appname}
            plugin={p}
            isOpen={p.appname === openPlugin}
            pinned={pins.includes(p.appname)}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </section>
  );
}

function PluginPanel({ plugins = [], openPlugin = null, onOpen, onClose, sheet = false }) {
  const [query, setQuery] = useState('');
  const pins = usePinnedPlugins();
  const panelRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Ready to type on desktop. Not on a phone, where focusing would throw up
    // the keyboard over the list someone opened the sheet to look at.
    if (!sheet) inputRef.current?.focus();
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    // A click outside closes it, as the Play menu does; not one on the button
    // that toggles it, which would close it and open it again.
    function onDoc(e) {
      if (!panelRef.current || panelRef.current.contains(e.target)) return;
      if (e.target.closest?.('[data-plugin-panel-toggle]')) return;
      onClose();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [onClose, sheet]);

  function open(appname) {
    onOpen(appname);
    onClose();
  }

  const byAppname = new Map(plugins.map(p => [p.appname, p]));
  const pinned = pins.map(name => byAppname.get(name)).filter(Boolean);
  const recent = readRecent()
    .filter(name => !pins.includes(name))
    .map(name => byAppname.get(name))
    .filter(Boolean)
    .slice(0, RECENT_SHOWN);
  const all = [...plugins].sort(byName);
  const results = query.trim() ? all.filter(p => matches(p, query)) : null;

  const shared = { openPlugin, pins, onOpen: open };

  return (
    <div
      className={'pluginPanel ' + (sheet ? 'pluginPanelSheet' : 'pluginPanelDocked')}
      ref={panelRef}
      role='dialog'
      aria-label='Plugins'
    >
      <div className='pluginPanelHeader'>
        <span className='pluginPanelTitle'>Plugins <span className='pluginPanelCount'>{plugins.length}</span></span>
        <button
          type='button'
          className='pluginPanelClose'
          onClick={onClose}
          aria-label={sheet ? 'Close' : 'Fold away'}
          title={sheet ? 'Close' : 'Fold away'}
        >
          <span className='material-symbols-outlined'>{sheet ? 'close' : 'left_panel_close'}</span>
        </button>
      </div>

      <div className='pluginPanelSearch'>
        <span className='material-symbols-outlined' aria-hidden='true'>search</span>
        <input
          ref={inputRef}
          type='search'
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder='Search plugins'
          aria-label='Search plugins'
        />
      </div>

      <div className='pluginPanelBody'>
        {!plugins.length ? (
          <p className='pluginPanelEmpty'>
            No plugins yet. They&apos;re made on <a href='https://cloud.cope.chat/' target='_blank' rel='noopener noreferrer'>copecloud</a>.
          </p>
        ) : results ? (
          results.length
            ? <Section title={`${results.length} found`} plugins={results} {...shared} />
            : <p className='pluginPanelEmpty'>No plugins match &ldquo;{query.trim()}&rdquo;.</p>
        ) : (
          <>
            <Section title='Pinned' plugins={pinned} {...shared} />
            <Section title='Recent' plugins={recent} {...shared} />
            <Section title='All plugins' plugins={all} {...shared} />
          </>
        )}
      </div>
    </div>
  );
}

export default PluginPanel;
