import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import handleInput from '../utils/handleInput';

const SUB_MENUS = [
  { name: 'users',    label: 'Users',    icon: 'group' },
  { name: 'settings', label: 'Settings', icon: 'settings' },
  { name: 'shop',     label: 'Shop',     icon: 'shopping_cart' },
];

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

function Menu({ themeColor, socket, userlist, bridgeNicks, toggles, toggleStateChange, hats }) {
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
          <Settings toggles={toggles} toggleStateChange={toggleStateChange} />
        )}
        {selectedList === 'shop' && (
          <Shop hats={hats} />
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

function Settings({ toggles, toggleStateChange }) {
  return (
    <div className='settingsContainer'>
      {Object.entries(toggles).map(([key, value]) => (
        <label className='settingsLabel' key={key} onClick={() => toggleStateChange(key, !value)}>
          {key}
          <button className='stdBtn'>{value ? 'On' : 'Off'}</button>
        </label>
      ))}
    </div>
  );
}

Settings.propTypes = {
  toggles:           PropTypes.object.isRequired,
  toggleStateChange: PropTypes.func.isRequired,
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
