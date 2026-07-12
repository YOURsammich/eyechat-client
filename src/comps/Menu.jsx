import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import handleInput from '../utils/handleInput';
import AvatarDisplay from './Chat/AvatarDisplay';
import PixelCanvas from './Pixel/PixelCanvas';
import DrawCanvas from './Pixel/DrawCanvas';
import DraggableWindow from './DraggableWindow';
import AvatarComposer from './Avatar/AvatarComposer';

const SUB_MENUS = [
  { name: 'users',    label: 'User List',    icon: 'group' },
  { name: 'settings', label: 'Settings', icon: 'settings' },
  { name: 'shop',     label: 'Shop',     icon: 'shopping_cart' },
  { name: 'avatar',   label: 'Avatar',   icon: 'face' },
  { name: 'channel',  label: 'Channel',  icon: 'palette' },
];

const AVATAR_PART_ORDER = ['heads', 'eyes', 'noses', 'mouths', 'hair'];

const STORE_CATS = [
  { name: 'filters',    label: 'Filters',    description: 'One word becomes another',    icon: 'find_replace' },
  { name: 'mws',        label: 'MWs',        description: 'Mods text in a variety of ways', icon: 'wand_stars' },
  { name: 'join names', label: 'Join Names', description: 'Modify default join names',   icon: 'wand_stars' },
];

function getUserActions(nick, socket) {
  return [
    { name: 'PM',    callback: () => {} },
    { name: 'whois', callback: () => handleInput.handle('/whois ' + nick, socket) },
    { name: 'block', callback: () => {} },
    { name: 'MOD',   callback: () => {} },
  ];
}

// ─── Menu ──────────────────────────────────────────────────────────────────────

function Menu({ themeColor, sidebarColor, socket, userlist, toggles, toggleStateChange, layout, changeLayout, joinLeave, changeJoinLeave, hats, emojis, user, themecolors, channelName, mobileOpen, setMobileOpen }) {
  const [selectedList, setSelectedList] = useState('users');
  const [navExpanded, setNavExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(true);
  const selected = SUB_MENUS.find(m => m.name === selectedList);

  return (
    <div className={'menuPane' + (menuOpen ? '' : ' collapsed') + (mobileOpen ? ' mobileOpen' : '')} style={{ background: themeColor }}>
      <ul className={'quickNav' + (navExpanded ? ' expanded' : '')} style={{ background: sidebarColor || undefined }}>
        {SUB_MENUS.map(m => (
          <li className={`navBtn${m.name === selectedList ? ' active' : ''}`} key={m.name} onClick={() => { setSelectedList(m.name); setMenuOpen(true); }}>
            <span className='navLabel'>{m.label}</span>
            <span className="material-symbols-outlined">{m.icon}</span>
          </li>
        ))}
        <li className='navBtn navToggle' onClick={() => setNavExpanded(e => !e)} title={navExpanded ? 'Collapse' : 'Expand'}>
          <span className="material-symbols-outlined">{navExpanded ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}</span>
        </li>
      </ul>

      <div className='menuContent'>
        <div className='menuHeader'>
          <span className='menuHeaderLabel'>{selected?.label}</span>
          <span className="material-symbols-outlined menuCloseBtn" onClick={() => { setMenuOpen(false); if (setMobileOpen) setMobileOpen(false); }} title='Close menu'>close</span>
        </div>

        {selectedList === 'users' && (
          <UserList socket={socket} userlist={userlist} />
        )}
        {selectedList === 'settings' && (
          <Settings toggles={toggles} toggleStateChange={toggleStateChange} layout={layout} changeLayout={changeLayout} joinLeave={joinLeave} changeJoinLeave={changeJoinLeave} />
        )}
        {selectedList === 'shop' && (
          <Shop hats={hats} />
        )}
        {selectedList === 'avatar' && (
          <AvatarBuilder user={user} emojis={emojis} />
        )}
        {selectedList === 'channel' && (
          <ChannelTheme themecolors={themecolors} channelName={channelName} />
        )}
      </div>
    </div>
  );
}

Menu.propTypes = {
  themeColor:        PropTypes.string,
  socket:            PropTypes.object.isRequired,
  userlist:          PropTypes.array.isRequired,
  toggles:           PropTypes.object.isRequired,
  toggleStateChange: PropTypes.func.isRequired,
  hats:              PropTypes.array.isRequired,
};

// ─── UserList ──────────────────────────────────────────────────────────────────

function UserList({ socket, userlist }) {
  return (
    <div className='userLi'>
      {userlist.map(user => (
        <div className='userLiSpan' key={user.id}>
          <span className='userLiName'>{user.nick}</span>
          <span className='userLiCurrency'>₵{user.coins}</span>
          <div className='userLiActions'>
            {getUserActions(user.nick, socket).map(action => (
              <button key={action.name} className='userActionBtn' onClick={action.callback}>
                {action.name}
              </button>
            ))}
          </div>
          <div className='userLiAFK'>{user.afk}</div>
        </div>
      ))}
    </div>
  );
}

UserList.propTypes = {
  socket:      PropTypes.object.isRequired,
  userlist:    PropTypes.array.isRequired,
};

// ─── Settings ─────────────────────────────────────────────────────────────────

const LAYOUTS = ['classic', 'cozy'];
const JOIN_LEAVE_MODES = ['all', 'registered', 'none'];

// A connected pill of mutually-exclusive options: the selected segment is filled,
// the rest sit flat/muted. Keeps multi-option rows compact and visually distinct
// from the single On/Off toggle rows.
function Segmented({ options, value, onChange }) {
  return (
    <div className='segmented'>
      {options.map(opt => (
        <button
          key={opt}
          className={'segmentBtn' + (value === opt ? ' active' : '')}
          onClick={() => onChange(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function Settings({ toggles, toggleStateChange, layout, changeLayout, joinLeave, changeJoinLeave }) {
  return (
    <div className='settingsContainer'>
      {Object.entries(toggles).map(([key, value]) => (
        <label className='settingsLabel' key={key}>
          {key}
          <Segmented
            options={['On', 'Off']}
            value={value ? 'On' : 'Off'}
            onChange={(v) => toggleStateChange(key, v === 'On')}
          />
        </label>
      ))}
      <label className='settingsLabel'>
        layout
        <Segmented options={LAYOUTS} value={layout} onChange={changeLayout} />
      </label>
      <label className='settingsLabel'>
        join/leave
        <Segmented options={JOIN_LEAVE_MODES} value={joinLeave} onChange={changeJoinLeave} />
      </label>
    </div>
  );
}

Settings.propTypes = {
  toggles:           PropTypes.object.isRequired,
  toggleStateChange: PropTypes.func.isRequired,
  layout:            PropTypes.string.isRequired,
  changeLayout:      PropTypes.func.isRequired,
  joinLeave:         PropTypes.string.isRequired,
  changeJoinLeave:   PropTypes.func.isRequired,
};

// ─── Shop ─────────────────────────────────────────────────────────────────────

function Shop({ hats }) {
  const [selectedCat, setSelectedCat] = useState('nav');

  function selectCat(name) {
    setSelectedCat(prev => prev === name ? 'nav' : name);
  }

  return (
    <div className='shopContainer'>
      {selectedCat === 'nav' && (
        <div className='shopNav'>
          {STORE_CATS.map(cat => (
            <div className='shopNavItem' key={cat.name} onClick={() => selectCat(cat.name)}>
              <span className="material-symbols-outlined">{cat.icon}</span>
              <div>
                <div>{cat.label}</div>
                <p>{cat.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedCat === 'hats' && (
        <div className='hatContainer'>
          {hats.map(hat => (
            <div key={hat.hatName} className='hatItem'>
              <img src={'./images/hats/' + hat.hat} alt={hat.hatName} style={{ width: '50px', height: '50px' }} />
            </div>
          ))}
        </div>
      )}

      {selectedCat === 'filters'    && <div><h3>Filters</h3></div>}
      {selectedCat === 'mws'        && <div><h3>MWs</h3></div>}
      {selectedCat === 'join names' && <JoinNames />}
    </div>
  );
}

Shop.propTypes = {
  hats: PropTypes.array.isRequired,
};

// ─── JoinNames ────────────────────────────────────────────────────────────────

function JoinNames() {
  const [joinNames, setJoinNames] = useState({});

  useEffect(() => {
    fetch('/channel/info/main/joinnick')
      .then(res => res.json())
      .then(data => {
        setJoinNames({
          nouns:      data.filter(a => a.type === 'noun').map(a => a.name),
          adjectives: data.filter(a => a.type === 'adjective').map(a => a.name),
        });
      });
  }, []);

  return (
    <div className='joinNamesContainer'>
      <div className='randomNameDisplay'>
        <h3>Random Name</h3>
      </div>
      <div className='nameCategory'>
        <b>Nouns</b>
        <b>Adjectives</b>
      </div>
    </div>
  );
}

// ─── AvatarBuilder ────────────────────────────────────────────────────────────

// Cap how many emoji tiles we render at once — the room can have thousands, so
// rendering them all would be slow. Users narrow down with the search box.
const EMOJI_RENDER_CAP = 60;

function AvatarBuilder({ user, emojis = [] }) {
  const [parts, setParts] = useState({}); // the single part library, grouped by type
  const [selected, setSelected] = useState({});
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const [builderOpen, setBuilderOpen] = useState(false); // pop-out avatar builder visible
  const [builderMode, setBuilderMode] = useState('build'); // 'build' (compose) | 'part' (draw a part)
  const [drawSlot, setDrawSlot] = useState('hair'); // which slot a drawn part is published under
  const [drawMode, setDrawMode] = useState('brush'); // 'brush' (freehand) | 'pixel'
  const [partStatus, setPartStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const pixelRef = useRef(null);

  function refreshParts() {
    return fetch('/channel/getAvatarParts')
      .then(r => r.json())
      .then(data => setParts(data || {}))
      .catch(() => {});
  }

  useEffect(() => {
    refreshParts();

    if (user?.avatar) {
      try {
        const parsed = typeof user.avatar === 'string' ? JSON.parse(user.avatar) : user.avatar;
        setSelected(parsed || {});
      } catch {}
    }
  }, []);

  function pickEmoji(imageName) {
    // Choosing a chat emoji replaces the whole avatar; clicking the selected
    // one again clears it.
    setSelected(prev => (prev.emoji === imageName ? {} : { emoji: imageName }));
    setStatus(null);
  }

  function persist(avatar) {
    setStatus('saving');
    return fetch('/a/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar }),
    })
      .then(r => r.json())
      .then(d => { setStatus(d.error ? 'error' : 'saved'); return d; })
      .catch(() => setStatus('error'));
  }

  function save() {
    // Persists the current selection — used by the emoji quick-pick and to
    // re-save a built avatar. Legacy layered selections are dropped now that
    // parts are composed in the builder.
    const avatar = selected.emoji ? { emoji: selected.emoji } : selected.whole ? { whole: selected.whole } : {};
    persist(avatar);
  }

  // The composer already uploaded the flattened image + project; store its ref
  // as our avatar so it renders and propagates live.
  function onBuiltAvatarSaved(avatar) {
    setSelected(avatar);
    persist(avatar);
  }

  // Publish a painted part into its type folder so anyone can import it in the
  // builder. Does not change your avatar (you compose in Build mode).
  async function publishPart() {
    if (!pixelRef.current) return;
    setPartStatus('saving');
    try {
      const blob = await pixelRef.current.exportPNGBlob();
      const formData = new FormData();
      formData.append('image', blob, 'part.png');
      formData.append('slot', drawSlot);
      const res = await fetch('/a/upload/avatarPart', { method: 'POST', body: formData }).then(r => r.json());
      if (res.error || !res.ref) { setPartStatus('error'); return; }
      await refreshParts();
      setPartStatus('saved');
    } catch {
      setPartStatus('error');
    }
  }

  const q = search.trim().toLowerCase();
  const matchedEmojis = q ? emojis.filter(e => e.id.toLowerCase().includes(q)) : emojis;
  const shownEmojis = matchedEmojis.slice(0, EMOJI_RENDER_CAP);

  // If the current avatar is a built one, its re-edit project sits beside the PNG.
  const projectUrl = selected.whole ? `/images/avatars/whole/${selected.whole.replace(/\.png$/, '.json')}` : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 12px', flexShrink: 0, borderBottom: '1px solid #333' }}>
        <AvatarDisplay avatar={selected} size={80} />
      </div>

      <div style={{ overflowY: 'auto', overflowX: 'hidden', flex: 1, minHeight: 0, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button
          className='stdBtn'
          onClick={() => setBuilderOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 14px' }}
        >
          <span className='material-symbols-outlined' style={{ fontSize: 18 }}>draw</span>
          {builderOpen ? 'Avatar builder open' : 'Open Avatar Builder'}
        </button>

        <div>
          <div style={{ fontSize: 11, color: '#777', marginBottom: 6 }}>Or quick-pick an emoji as your avatar</div>
          <input
            type='text'
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='Search emojis…'
            style={{
              width: '100%', padding: '6px 8px', marginBottom: 8, fontSize: 13,
              borderRadius: 4, border: '1px solid #444', background: '#222', color: '#eee', boxSizing: 'border-box',
            }}
          />
          {emojis.length === 0 ? (
            <div style={{ fontSize: 11, color: '#666' }}>No chat emojis uploaded yet.</div>
          ) : matchedEmojis.length === 0 ? (
            <div style={{ fontSize: 11, color: '#666' }}>No emojis match “{search.trim()}”.</div>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {shownEmojis.map(e => (
                  <img
                    key={e.id}
                    src={`/images/emojis/${e.imageName}`}
                    title={e.id}
                    loading='lazy'
                    onClick={() => pickEmoji(e.imageName)}
                    style={{
                      width: 38, height: 38, cursor: 'pointer', borderRadius: 4, padding: 2,
                      border: selected.emoji === e.imageName ? '2px solid #39f' : '2px solid transparent',
                      objectFit: 'contain', boxSizing: 'border-box',
                    }}
                  />
                ))}
              </div>
              {matchedEmojis.length > shownEmojis.length && (
                <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>
                  Showing {shownEmojis.length} of {matchedEmojis.length} — keep typing to narrow it down.
                </div>
              )}
            </>
          )}
        </div>

        <button
          className='stdBtn'
          onClick={save}
          disabled={status === 'saving'}
          style={{ width: '100%', padding: '6px 0' }}
        >
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved!' : status === 'error' ? 'Error — try again' : 'Save Avatar'}
        </button>
      </div>

      {builderOpen && (
        <DraggableWindow title='Avatar Builder' width={520} onClose={() => { setBuilderOpen(false); setPartStatus(null); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[['build', 'Build Avatar'], ['part', 'Draw Part']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setBuilderMode(id)}
                  style={{
                    flex: 1, padding: '6px 0', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    borderRadius: 4, boxSizing: 'border-box',
                    background: builderMode === id ? '#2a2a2a' : 'transparent',
                    color: builderMode === id ? '#eee' : '#888',
                    border: builderMode === id ? '1px solid #39f' : '1px solid #333',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {builderMode === 'build' ? (
              <AvatarComposer
                key={selected.whole || 'new'}
                parts={parts}
                projectUrl={projectUrl}
                onSaved={onBuiltAvatarSaved}
              />
            ) : (
              <>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#777', marginBottom: 4 }}>Publish under slot</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {AVATAR_PART_ORDER.map(slot => (
                        <button
                          key={slot}
                          onClick={() => { setDrawSlot(slot); setPartStatus(null); }}
                          style={{
                            padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                            textTransform: 'capitalize', borderRadius: 4, boxSizing: 'border-box',
                            background: drawSlot === slot ? '#2a2a2a' : 'transparent',
                            color: drawSlot === slot ? '#eee' : '#888',
                            border: drawSlot === slot ? '1px solid #39f' : '1px solid #333',
                          }}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#777', marginBottom: 4 }}>Style</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[['brush', 'Brush'], ['pixel', 'Pixel']].map(([id, label]) => (
                        <button
                          key={id}
                          onClick={() => setDrawMode(id)}
                          style={{
                            padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                            borderRadius: 4, boxSizing: 'border-box',
                            background: drawMode === id ? '#2a2a2a' : 'transparent',
                            color: drawMode === id ? '#eee' : '#888',
                            border: drawMode === id ? '1px solid #39f' : '1px solid #333',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {drawMode === 'pixel' ? (
                  <PixelCanvas key='pixel' ref={pixelRef} width={32} height={32} scale={14} maxViewport={520} />
                ) : (
                  <DrawCanvas key='brush' ref={pixelRef} width={128} height={128} scale={3.5} maxViewport={520} />
                )}

                <button
                  className='stdBtn'
                  onClick={publishPart}
                  disabled={partStatus === 'saving'}
                  style={{ width: '100%', padding: '6px 0' }}
                >
                  {partStatus === 'saving'
                    ? 'Publishing…'
                    : partStatus === 'saved'
                      ? `Published to ${drawSlot} — import it in Build`
                      : partStatus === 'error'
                        ? 'Error — try again'
                        : `Publish to ${drawSlot} library`}
                </button>

                {(parts[drawSlot] || []).length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: '#777', marginBottom: 4 }}>
                      Load a {drawSlot} to edit or trace
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxHeight: 92, overflowY: 'auto' }}>
                      {(parts[drawSlot] || []).map(file => (
                        <img
                          key={file}
                          src={`/images/avatars/${drawSlot}/${file}`}
                          title='Load into canvas to edit'
                          onClick={() => { pixelRef.current?.loadImage(`/images/avatars/${drawSlot}/${file}`); setPartStatus(null); }}
                          style={{
                            width: 38, height: 38, cursor: 'pointer', borderRadius: 4,
                            border: '2px solid #3a3a3a', background: 'white', objectFit: 'contain', boxSizing: 'border-box',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DraggableWindow>
      )}
    </div>
  );
}

// ─── ChannelTheme ─────────────────────────────────────────────────────────────

const THEME_KEYS = [
  { key: 'topbarpri', label: 'Top Bar' },
  { key: 'inputbar',  label: 'Input Bar' },
  { key: 'menupri',   label: 'Menu' },
  { key: 'sidebar',   label: 'Icon Bar' },
  { key: 'bubblebg',  label: 'Bubble BG', alpha: true },
];

function parseRgba(val) {
  const m = val?.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/);
  if (m) {
    const r = parseInt(m[1]).toString(16).padStart(2, '0');
    const g = parseInt(m[2]).toString(16).padStart(2, '0');
    const b = parseInt(m[3]).toString(16).padStart(2, '0');
    return { hex: `#${r}${g}${b}`, alpha: m[4] !== undefined ? parseFloat(m[4]) : 1 };
  }
  return { hex: val || '#ffffff', alpha: 1 };
}

function hexAlphaToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function ChannelTheme({ themecolors, channelName }) {
  const [colors, setColors] = useState(themecolors || {});
  const [status, setStatus] = useState(null);

  useEffect(() => {
    setColors(themecolors || {});
  }, [themecolors]);

  function save() {
    setStatus('saving');
    Promise.all(
      THEME_KEYS.map(({ key }) =>
        fetch('/a/theme', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelName, key, color: colors[key] || '' }),
        }).then(r => r.json())
      )
    )
      .then(results => setStatus(results.some(r => r.error) ? 'error' : 'saved'))
      .catch(() => setStatus('error'));
  }

  return (
    <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ fontSize: 11, color: '#777', marginBottom: 12 }}>Theme Colors</div>
      {THEME_KEYS.map(({ key, label, alpha: hasAlpha }) => {
        if (hasAlpha) {
          const { hex, alpha } = parseRgba(colors[key] || 'rgba(255,255,255,0.05)');
          return (
            <div key={key} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ flex: 1, fontSize: 13 }}>{label}</span>
                <input
                  type="color"
                  value={hex}
                  onChange={e => { setColors(prev => ({ ...prev, [key]: hexAlphaToRgba(e.target.value, parseRgba(prev[key] || 'rgba(255,255,255,0.05)').alpha) })); setStatus(null); }}
                  style={{ width: 36, height: 28, cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#777' }}>opacity</span>
                <input
                  type="range"
                  min="0" max="1" step="0.01"
                  value={alpha}
                  onChange={e => { setColors(prev => ({ ...prev, [key]: hexAlphaToRgba(parseRgba(prev[key] || 'rgba(255,255,255,0.05)').hex, parseFloat(e.target.value)) })); setStatus(null); }}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 11, color: '#aaa', width: 28, textAlign: 'right' }}>{Math.round(alpha * 100)}%</span>
              </div>
            </div>
          );
        }
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ flex: 1, fontSize: 13 }}>{label}</span>
            <input
              type="color"
              value={colors[key] || '#181818'}
              onChange={e => { setColors(prev => ({ ...prev, [key]: e.target.value })); setStatus(null); }}
              style={{ width: 36, height: 28, cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
            />
          </div>
        );
      })}
      <button
        className='stdBtn'
        onClick={save}
        disabled={status === 'saving'}
        style={{ width: '100%', marginTop: 8, padding: '6px 0' }}
      >
        {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved!' : status === 'error' ? 'Error — try again' : 'Save Colors'}
      </button>
    </div>
  );
}

// ─── Overlay ──────────────────────────────────────────────────────────────────

export function Overlay({ type }) {
  return (
    <div className='overlayMask'>
      <h3>{type}</h3>
    </div>
  );
}

Overlay.propTypes = {
  type: PropTypes.string.isRequired,
};

export default Menu;
