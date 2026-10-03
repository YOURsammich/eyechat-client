import { Fragment } from 'react';

import PluginIcon from './PluginIcon';
import PluginPanel from './PluginPanel';

// The plugin bar: the one home for plugins on desktop. A narrow column down
// the left of the main room with, top to bottom, the button that reopens or
// closes the last plugin, the grid button that opens the bar out into
// PluginPanel, the viewer's pinned plugins, a rule, the rest, and at the foot
// a button that hides the bar (the chat header gets a button to bring it back).
//
// Each viewer shows or hides it for themselves; it's on until they hide it.
// Phones don't get it (theme.css hides it under 768px): there the chat
// header's plugins button opens PluginPanel as a sheet instead.
//
// `plugins` arrive already in bar order (pinned first); `pinnedCount` says
// where the rule goes. The rest keep copecloud's order, so tiles don't move
// about as plugins are opened.
function PluginRail({
  plugins, pinnedCount, openPlugin, onOpen, onToggleLast,
  panelOpen, onTogglePanel, onClosePanel, onHide,
}) {
  return (
    <div className='sideBar'>
      <div className='appViewToggle' onClick={onToggleLast} title={openPlugin ? 'Close plugin' : 'Reopen last plugin'}>
        <span className='material-symbols-outlined'>code</span>
      </div>
      <button
        type='button'
        className={'pluginBrowseBtn' + (panelOpen ? ' active' : '')}
        onClick={onTogglePanel}
        title={panelOpen ? 'Fold away' : 'All plugins'}
        aria-label='All plugins'
        aria-expanded={panelOpen}
        data-plugin-panel-toggle
      >
        <span className='material-symbols-outlined'>apps</span>
      </button>

      <div className='pluginSelectionContainer'>
        {plugins.map((plugin, i) => (
          <Fragment key={plugin.appname}>
            {i === pinnedCount && i > 0 ? <hr className='pluginSelectRule' /> : null}
            <button
              type='button'
              title={plugin.description ? `${plugin.appname}: ${plugin.description}` : plugin.appname}
              aria-label={plugin.appname}
              aria-pressed={plugin.appname === openPlugin}
              className={'pluginSelect' + (plugin.appname === openPlugin ? ' pluginSelectActive' : '')}
              onClick={() => onOpen(plugin.appname)}
            >
              <PluginIcon plugin={plugin} size={40} />
            </button>
          </Fragment>
        ))}
      </div>

      <button
        type='button'
        className='pluginRailHide'
        onClick={onHide}
        title='Hide the plugin bar'
        aria-label='Hide the plugin bar'
      >
        <span className='material-symbols-outlined'>keyboard_double_arrow_left</span>
      </button>

      {panelOpen ? (
        <PluginPanel
          plugins={plugins}
          openPlugin={openPlugin}
          onOpen={onOpen}
          onClose={onClosePanel}
        />
      ) : null}
    </div>
  );
}

export default PluginRail;
