import { useState, useEffect } from 'react';

import PluginIcon from './PluginIcon';
import { wantsWallet } from './pluginTrust';
import { usePinnedPlugins, setPinned } from './pluginPins';
import { readRecent } from './pluginRecent';

// Plugins on a phone, where there is no plugin bar: a full-screen sheet with
// a search box, then the viewer's pinned and recent plugins, then all of them
// by name. Opened from the chat header's plugins button. (On desktop the bar
// itself widens out instead; see PluginRail.)
//
// Picking a plugin opens it and closes the sheet. The pin button beside each
// row pins it to the top of the bar.

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

function PluginPanel({ plugins = [], openPlugin = null, onOpen, onClose }) {
  const [query, setQuery] = useState('');
  const pins = usePinnedPlugins();

  // The search box isn't focused: on a phone that would throw up the keyboard
  // over the list someone opened the sheet to look at.
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
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
    <div className='pluginPanel pluginPanelSheet' role='dialog' aria-label='Plugins'>
      <div className='pluginPanelHeader'>
        <span className='pluginPanelTitle'>Plugins <span className='pluginPanelCount'>{plugins.length}</span></span>
        <button type='button' className='pluginPanelClose' onClick={onClose} aria-label='Close' title='Close'>
          <span className='material-symbols-outlined'>close</span>
        </button>
      </div>

      <div className='pluginPanelSearch'>
        <span className='material-symbols-outlined' aria-hidden='true'>search</span>
        <input
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
