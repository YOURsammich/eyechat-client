import { useState, useEffect, useRef } from 'react';

import PluginIcon from './PluginIcon';
import { wantsWallet } from './pluginTrust';
import { usePinnedPlugins, setPinned } from './pluginPins';
import { readRecent } from './pluginRecent';

// Every plugin on copecloud, for when the Play menu's short list isn't enough:
// a search box, then the viewer's pinned and recent plugins, then all of them
// by name. A panel on the right on desktop, the whole screen on a phone.
// Opened from the Play menu's "Browse all" and the plugin bar's grid button.
//
// Picking a plugin opens it and closes the drawer. The pin button beside each
// row pins it to the plugin bar and the top of the Play menu.

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
    <li className={'pluginDrawerRow' + (isOpen ? ' pluginDrawerRowOpen' : '')}>
      <button
        type='button'
        className='pluginDrawerOpen'
        onClick={() => onOpen(plugin.appname)}
        aria-current={isOpen ? 'true' : undefined}
      >
        <PluginIcon plugin={plugin} size={36} />
        <span className='pluginDrawerText'>
          <span className='pluginDrawerName'>
            {plugin.appname}
            {plugin.owner ? <span className='pluginDrawerOwner'> by {plugin.owner}</span> : null}
          </span>
          {plugin.description
            ? <span className='pluginDrawerDesc'>{plugin.description}</span>
            : null}
        </span>
        {wantsWallet(plugin) ? (
          <span
            className='material-symbols-outlined pluginDrawerCoins'
            title='Can take coins from you once you allow it'
            aria-label='Uses your coins'
          >paid</span>
        ) : null}
      </button>
      <button
        type='button'
        className={'pluginDrawerPin' + (pinned ? ' pinned' : '')}
        onClick={() => setPinned(plugin.appname, !pinned)}
        aria-pressed={pinned}
        aria-label={(pinned ? 'Unpin ' : 'Pin ') + plugin.appname}
        title={pinned ? 'Unpin' : 'Pin to the plugin bar and the top of Play'}
      >
        <span className='material-symbols-outlined'>push_pin</span>
      </button>
    </li>
  );
}

function Section({ title, plugins, openPlugin, pins, onOpen }) {
  if (!plugins.length) return null;
  return (
    <section className='pluginDrawerSection' aria-label={title}>
      <h3 className='pluginDrawerHeading'>{title}</h3>
      <ul className='pluginDrawerList'>
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

function PluginDrawer({ plugins = [], openPlugin = null, onOpen, onClose }) {
  const [query, setQuery] = useState('');
  const pins = usePinnedPlugins();
  const panelRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    // A click outside closes it, as the Play menu does; not one on the button
    // that toggles it, which would close it and open it again.
    function onDoc(e) {
      if (!panelRef.current || panelRef.current.contains(e.target)) return;
      if (e.target.closest?.('[data-plugin-drawer-toggle]')) return;
      onClose();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [onClose]);

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
    <div className='pluginDrawer' ref={panelRef} role='dialog' aria-label='Plugins'>
      <div className='pluginDrawerHeader'>
        <span className='pluginDrawerTitle'>Plugins <span className='pluginDrawerCount'>{plugins.length}</span></span>
        <button type='button' className='pluginDrawerClose' onClick={onClose} aria-label='Close' title='Close'>
          <span className='material-symbols-outlined'>close</span>
        </button>
      </div>

      <div className='pluginDrawerSearch'>
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

      <div className='pluginDrawerBody'>
        {!plugins.length ? (
          <p className='pluginDrawerEmpty'>
            No plugins yet. They&apos;re made on <a href='https://cloud.cope.chat/' target='_blank' rel='noopener noreferrer'>copecloud</a>.
          </p>
        ) : results ? (
          results.length
            ? <Section title={`${results.length} found`} plugins={results} {...shared} />
            : <p className='pluginDrawerEmpty'>No plugins match &ldquo;{query.trim()}&rdquo;.</p>
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

export default PluginDrawer;
