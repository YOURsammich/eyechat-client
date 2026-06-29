import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import handleInput from '../utils/handleInput';
import AvatarDisplay from './Chat/AvatarDisplay';

const SUB_MENUS = [
  { name: 'users',    label: 'Users',    icon: 'group' },
  { name: 'settings', label: 'Settings', icon: 'settings' },
  { name: 'shop',     label: 'Shop',     icon: 'shopping_cart' },
  { name: 'avatar',   label: 'Avatar',   icon: 'face' },
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

function Menu({ themeColor, socket, userlist, bridgeNicks, toggles, toggleStateChange, layout, changeLayout, hats, user }) {
  const [selectedList, setSelectedList] = useState('users');
  const selected = SUB_MENUS.find(m => m.name === selectedList);

  return (
    <div className='menuPane' style={{ background: themeColor }}>
      <ul className='quickNav'>
        {SUB_MENUS.map(m => (
          <li className={`navBtn${m.name === selectedList ? ' active' : ''}`} key={m.name} onClick={() => setSelectedList(m.name)}>
            <span className="material-symbols-outlined">{m.icon}</span>
          </li>
        ))}
      </ul>

      <div className='menuContent'>
        <div className='menuHeader'>
          <h4>{selected?.label}</h4>
        </div>

        {selectedList === 'users' && (
          <UserList socket={socket} userlist={userlist} bridgeNicks={bridgeNicks} />
        )}
        {selectedList === 'settings' && (
          <Settings toggles={toggles} toggleStateChange={toggleStateChange} layout={layout} changeLayout={changeLayout} />
        )}
        {selectedList === 'shop' && (
          <Shop hats={hats} />
        )}
        {selectedList === 'avatar' && (
          <AvatarBuilder user={user} />
        )}
      </div>
    </div>
  );
}

Menu.propTypes = {
  themeColor:        PropTypes.string,
  socket:            PropTypes.object.isRequired,
  userlist:          PropTypes.array.isRequired,
  bridgeNicks:       PropTypes.array,
  toggles:           PropTypes.object.isRequired,
  toggleStateChange: PropTypes.func.isRequired,
  hats:              PropTypes.array.isRequired,
};

// ─── UserList ──────────────────────────────────────────────────────────────────

function UserList({ socket, userlist, bridgeNicks }) {
  return (
    <div className='userLi'>
      {userlist.map(user => (
        <div className='userLiSpan' key={user.id}>
          <span className='userLiName'>{user.nick}</span>
          <span className='userLiCurrency'>₵{user.tokens}</span>
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

      <i className='bridgeUserHeader'>Bridge Users</i>

      {bridgeNicks?.map(user => (
        <div className='userLiSpan bridgeUser' key={'bridgeuser-' + user.nick}>
          {user.nick}
        </div>
      ))}
    </div>
  );
}

UserList.propTypes = {
  socket:      PropTypes.object.isRequired,
  userlist:    PropTypes.array.isRequired,
  bridgeNicks: PropTypes.array,
};

// ─── Settings ─────────────────────────────────────────────────────────────────

const LAYOUTS = ['classic', 'cozy', 'discord'];

function Settings({ toggles, toggleStateChange, layout, changeLayout }) {
  return (
    <div className='settingsContainer'>
      {Object.entries(toggles).map(([key, value]) => (
        <label className='settingsLabel' key={key} onClick={() => toggleStateChange(key, !value)}>
          {key}
          <button className='stdBtn'>{value ? 'On' : 'Off'}</button>
        </label>
      ))}
      <label className='settingsLabel'>
        layout
        <div style={{ display: 'flex', gap: 4 }}>
          {LAYOUTS.map(l => (
            <button key={l} className='stdBtn' style={{ opacity: layout === l ? 1 : 0.4 }} onClick={() => changeLayout(l)}>{l}</button>
          ))}
        </div>
      </label>
    </div>
  );
}

Settings.propTypes = {
  toggles:           PropTypes.object.isRequired,
  toggleStateChange: PropTypes.func.isRequired,
  layout:            PropTypes.string.isRequired,
  changeLayout:      PropTypes.func.isRequired,
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

function AvatarBuilder({ user }) {
  const [parts, setParts] = useState({});
  const [selected, setSelected] = useState({});
  const [status, setStatus] = useState(null); // null | 'saving' | 'saved' | 'error'

  useEffect(() => {
    fetch('/channel/getAvatarParts')
      .then(r => r.json())
      .then(data => setParts(data));

    if (user?.avatar) {
      try {
        const parsed = typeof user.avatar === 'string' ? JSON.parse(user.avatar) : user.avatar;
        setSelected(parsed || {});
      } catch {}
    }
  }, []);

  function toggle(category, file) {
    setSelected(prev => ({ ...prev, [category]: prev[category] === file ? null : file }));
    setStatus(null);
  }

  function save() {
    setStatus('saving');
    const avatar = {};
    for (const [k, v] of Object.entries(selected)) {
      if (v) avatar[k] = v;
    }
    fetch('/a/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar }),
    })
      .then(r => r.json())
      .then(d => setStatus(d.error ? 'error' : 'saved'))
      .catch(() => setStatus('error'));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 12px', flexShrink: 0, borderBottom: '1px solid #333' }}>
        <AvatarDisplay avatar={selected} size={80} />
      </div>

      <div style={{ overflowY: 'auto', overflowX: 'hidden', flex: 1, minHeight: 0, padding: '8px 10px' }}>
        {AVATAR_PART_ORDER.map(category => (
          <div key={category} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#777', textTransform: 'capitalize', marginBottom: 4 }}>
              {category}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {(parts[category] || []).map(file => (
                <img
                  key={file}
                  src={`/images/avatars/${category}/${file}`}
                  title={file}
                  onClick={() => toggle(category, file)}
                  style={{
                    width: 38, height: 38, cursor: 'pointer', borderRadius: 4,
                    border: selected[category] === file ? '2px solid #555' : '2px solid transparent',
                    background: 'white', objectFit: 'contain', boxSizing: 'border-box',
                  }}
                />
              ))}
            </div>
          </div>
        ))}

        <button
          className='stdBtn'
          onClick={save}
          disabled={status === 'saving'}
          style={{ width: '100%', marginTop: 6, padding: '6px 0' }}
        >
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved!' : status === 'error' ? 'Error — try again' : 'Save Avatar'}
        </button>
      </div>
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
