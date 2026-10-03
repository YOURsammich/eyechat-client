import { Fragment, useState, useEffect, useRef } from 'react';

import PluginIcon from './PluginIcon';
import { matches } from './PluginPanel';
import { wantsWallet } from './pluginTrust';
import { setPinned, usePinnedPlugins } from './pluginPins';

// The plugin bar: the one home for plugins on desktop. A narrow column of
// plugin tiles down the left of the main room; clicking one opens it.
//
// The chevron at the top widens the bar itself, the way the menu bar on the
// right widens: the tiles stay where they are and grow a name, owner, one-line
// description, coin marker and pin button beside them, and a search box
// appears over the list. Same list, same order, just more of it. It pushes the
// chat over rather than lying on top of it, and stays wide until folded back.
//
// Each viewer shows or hides the bar for themselves; it's on until they hide
// it with the button at its foot (the chat header gets a button to bring it
// back). Phones don't get it (theme.css hides it under 768px): there the chat
// header's plugins button opens PluginPanel as a sheet instead.
//
// `plugins` arrive already in bar order (pinned first); `pinnedCount` says
// where the pinned ones end. The rest keep copecloud's order, so tiles don't
// move about as plugins are opened.
function PluginRail({ plugins, pinnedCount, openPlugin, onOpen, expanded, onToggleExpanded, onHide }) {
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  const pins = usePinnedPlugins();

  // Widened: ready to type. Folded: the search is gone, so is what was typed.
  useEffect(() => {
    if (expanded) searchRef.current?.focus();
    else setQuery('');
  }, [expanded]);

  const searching = expanded && query.trim() !== '';
  const shown = searching ? plugins.filter(p => matches(p, query)) : plugins;
  const pinnedShown = searching ? 0 : pinnedCount;

  return (
    <div
      className={'sideBar' + (expanded ? ' expanded' : '')}
      onKeyDown={(e) => { if (expanded && e.key === 'Escape') onToggleExpanded(); }}
    >
      <div className='railTop'>
        <button
          type='button'
          className='railToggle'
          onClick={onToggleExpanded}
          title={expanded ? 'Fold the plugin bar' : 'Widen the plugin bar'}
          aria-label={expanded ? 'Fold the plugin bar' : 'Widen the plugin bar'}
          aria-expanded={expanded}
        >
          <span className='material-symbols-outlined'>
            {expanded ? 'keyboard_double_arrow_left' : 'keyboard_double_arrow_right'}
          </span>
        </button>
        {expanded ? (
          <span className='railTitle'>Plugins <span className='railCount'>{plugins.length}</span></span>
        ) : null}
      </div>

      {expanded ? (
        <div className='railSearch'>
          <span className='material-symbols-outlined' aria-hidden='true'>search</span>
          <input
            ref={searchRef}
            type='search'
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder='Search plugins'
            aria-label='Search plugins'
          />
        </div>
      ) : null}

      <div className='pluginSelectionContainer'>
        {shown.map((plugin, i) => {
          const pinned = pins.includes(plugin.appname);
          const isOpen = plugin.appname === openPlugin;
          return (
            <Fragment key={plugin.appname}>
              {/* where the pinned ones end: a rule, labelled when widened */}
              {i === pinnedShown && i > 0 ? (
                expanded ? <div className='railHeading'>All plugins</div> : <hr className='pluginSelectRule' />
              ) : null}
              {i === 0 && pinnedShown > 0 && expanded ? <div className='railHeading'>Pinned</div> : null}

              <div className={'railItem' + (isOpen ? ' railItemOpen' : '')}>
                <button
                  type='button'
                  title={expanded ? undefined : (plugin.description ? `${plugin.appname}: ${plugin.description}` : plugin.appname)}
                  aria-label={plugin.appname}
                  aria-pressed={isOpen}
                  className={'pluginSelect' + (isOpen ? ' pluginSelectActive' : '')}
                  onClick={() => onOpen(plugin.appname)}
                >
                  <PluginIcon plugin={plugin} size={40} />
                  {expanded ? (
                    <>
                      <span className='railItemText'>
                        <span className='railItemName'>{plugin.appname}</span>
                        <span className='railItemMeta'>
                          {plugin.description || (plugin.owner ? `by ${plugin.owner}` : '')}
                        </span>
                      </span>
                      {wantsWallet(plugin) ? (
                        <span
                          className='material-symbols-outlined railItemCoins'
                          title='Can take coins from you once you allow it'
                          aria-label='Uses your coins'
                        >paid</span>
                      ) : null}
                    </>
                  ) : null}
                </button>
                {expanded ? (
                  <button
                    type='button'
                    className={'railPin' + (pinned ? ' pinned' : '')}
                    onClick={() => setPinned(plugin.appname, !pinned)}
                    aria-pressed={pinned}
                    aria-label={(pinned ? 'Unpin ' : 'Pin ') + plugin.appname}
                    title={pinned ? 'Unpin' : 'Pin to the top of the bar'}
                  >
                    <span className='material-symbols-outlined'>push_pin</span>
                  </button>
                ) : null}
              </div>
            </Fragment>
          );
        })}

        {searching && !shown.length ? (
          <p className='railEmpty'>No plugins match &ldquo;{query.trim()}&rdquo;.</p>
        ) : null}
        {expanded && !plugins.length ? (
          <p className='railEmpty'>
            No plugins yet. They&apos;re made on <a href='https://cloud.cope.chat/' target='_blank' rel='noopener noreferrer'>copecloud</a>.
          </p>
        ) : null}
      </div>

      <button
        type='button'
        className='pluginRailHide'
        onClick={onHide}
        title='Hide the plugin bar'
        aria-label='Hide the plugin bar'
      >
        <span className='material-symbols-outlined'>visibility_off</span>
        {expanded ? <span className='railHideLabel'>Hide the bar</span> : null}
      </button>
    </div>
  );
}

export default PluginRail;
