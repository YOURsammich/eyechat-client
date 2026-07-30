import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import handleInput from '../utils/handleInput';
import DraggableWindow from './DraggableWindow';
import CosmeticsPanel from './Cosmetics/CosmeticsPanel';
import {
  ParsedContent, inlineStyles,
  STYLE_LIMIT_MIN, STYLE_LIMIT_MAX,
  MSG_HEIGHT_MIN, MSG_HEIGHT_MAX, MSG_HEIGHT_STEP, MSG_HEIGHT_OFF, effectiveMessageHeight,
} from './Chat/Messages';

export const SUB_MENUS = [
  { name: 'users',     label: 'User List', icon: 'group' },
  { name: 'account',   label: 'Account',   icon: 'account_circle' },
  { name: 'settings',  label: 'Settings',  icon: 'settings' },
  { name: 'shop',      label: 'Shop',      icon: 'shopping_cart' },
  { name: 'cosmetics', label: 'Cosmetics', icon: 'face' },
  { name: 'channel',   label: 'Channel',   icon: 'palette' },
];

const STORE_CATS = [
  { name: 'filters',    label: 'Filters',    description: 'One word becomes another',    icon: 'find_replace' },
  { name: 'mws',        label: 'MWs',        description: 'Mods text in a variety of ways', icon: 'wand_stars' },
  { name: 'join names', label: 'Join Names', description: 'Modify default join names',   icon: 'wand_stars' },
];

function getUserActions(nick, socket, blocked) {
  return [
    { name: 'PM',    callback: () => {} },
    { name: 'whois', callback: () => handleInput.handle('/whois ' + nick, socket) },
    // Blocking asks for a duration, so it opens the box (the same one a
    // moderator's /separate raises); unblocking has nothing to ask, so it just
    // goes straight to the server.
    blocked
      ? { name: 'unblock', callback: () => handleInput.handle('/unblock ' + nick, socket) }
      : { name: 'block', callback: () => window.dispatchEvent(new CustomEvent('block:open', { detail: { nick } })) },
    { name: 'MOD',   callback: () => {} },
  ];
}

// When a timed block lapses, for the indicator's tooltip. A block with no expiry
// runs until the user lifts it.
function blockedUntil(expires) {
  if (expires == null) return 'Blocked until you unblock them';
  return 'Blocked until ' + new Date(Number(expires)).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

// ─── Menu ──────────────────────────────────────────────────────────────────────

function Menu({ themeColor, sidebarColor, socket, userlist, toggles, toggleStateChange, layout, changeLayout, joinLeave, changeJoinLeave, styleLimit, changeStyleLimit, channelStyleLimit, msgHeight, changeMsgHeight, channelMsgHeight, hats, emojis, user, themecolors, channelName, mobileOpen, setMobileOpen, mobileSection, requestSection, blocks }) {
  const [selectedList, setSelectedList] = useState('users');
  const [navExpanded, setNavExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(true);

  // On mobile the quickNav icon bar is hidden, so the section is chosen by the
  // chat-header buttons (users / settings / the "more" dropdown). Whenever the
  // mobile overlay is opened for a section, switch this panel to show it.
  useEffect(() => {
    if (mobileOpen && mobileSection) {
      setSelectedList(mobileSection);
      setMenuOpen(true);
    }
  }, [mobileOpen, mobileSection]);

  // Something outside the menu asked for a section (the input bar's profile
  // switcher handing off to Cosmetics). The nonce, not the name, is the trigger,
  // so asking for the section that's already selected still re-opens the panel.
  useEffect(() => {
    if (!requestSection?.nonce || !requestSection.section) return;
    setSelectedList(requestSection.section);
    setMenuOpen(true);
    if (setMobileOpen) setMobileOpen(true);
  }, [requestSection?.nonce]);

  // Bumped when the already-active nav item is re-clicked; used as a remount key
  // so a panel with its own internal navigation (e.g. Shop) resets to its root.
  const [navNonce, setNavNonce] = useState(0);
  const selected = SUB_MENUS.find(m => m.name === selectedList);

  function selectNav(name) {
    // Re-clicking the current tab has no state change to react to, so force a
    // reset by bumping the remount key; a real switch just changes the section.
    if (name === selectedList) setNavNonce(n => n + 1);
    setSelectedList(name);
    setMenuOpen(true);
  }

  return (
    <div className={'menuPane' + (menuOpen ? '' : ' collapsed') + (mobileOpen ? ' mobileOpen' : '')} style={{ background: themeColor }}>
      <ul className={'quickNav' + (navExpanded ? ' expanded' : '')} style={{ background: sidebarColor || undefined }}>
        {SUB_MENUS.map(m => (
          <li className={`navBtn${m.name === selectedList ? ' active' : ''}`} key={m.name} onClick={() => selectNav(m.name)}>
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
          <UserList socket={socket} userlist={userlist} emojis={emojis} blocks={blocks} />
        )}
        {selectedList === 'account' && (
          <AccountPanel user={user} channelName={channelName} />
        )}
        {selectedList === 'settings' && (
          <Settings toggles={toggles} toggleStateChange={toggleStateChange} layout={layout} changeLayout={changeLayout} joinLeave={joinLeave} changeJoinLeave={changeJoinLeave} />
        )}
        {selectedList === 'shop' && (
          <Shop key={navNonce} hats={hats} emojis={emojis} user={user} channelName={channelName} userlist={userlist} />
        )}
        {selectedList === 'cosmetics' && (
          <CosmeticsPanel
            key={navNonce}
            user={user}
            emojis={emojis}
            hats={hats}
            handleInput={(text) => handleInput.handle(text, socket)}
          />
        )}
        {selectedList === 'channel' && (
          <ChannelTheme
            themecolors={themecolors}
            channelName={channelName}
            styleLimit={styleLimit}
            changeStyleLimit={changeStyleLimit}
            channelStyleLimit={channelStyleLimit}
            msgHeight={msgHeight}
            changeMsgHeight={changeMsgHeight}
            channelMsgHeight={channelMsgHeight}
          />
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
  styleLimit:        PropTypes.number,
  changeStyleLimit:  PropTypes.func,
  channelStyleLimit: PropTypes.number,
  msgHeight:         PropTypes.number,
  changeMsgHeight:   PropTypes.func,
  channelMsgHeight:  PropTypes.number,
  blocks:            PropTypes.array,
};

// ─── UserList ──────────────────────────────────────────────────────────────────

// getipintel's proxy/VPN score for a guest's address. The field only reaches trust
// 0 and 1 — the server omits it from clientInfo for everyone else — so rendering it
// whenever it's present is the whole gate; there's nothing to check here. Absent
// for registered users, and for guests whose address couldn't be scored.
//
// Banded per the service's own guidance: > 0.99 "most likely proxies", > 0.95
// "should be looked at". Shown to 3 decimals because 0.999 and 1 mean different
// things (1 is an explicit ban) and rounding to 2 would blur them together.
function ProxyScore({ score }) {
  if (typeof score !== 'number') return null;

  const band = score > 0.99 ? 'high' : score > 0.95 ? 'mid' : 'low';

  return (
    <span
      className={`userLiProxy userLiProxy-${band}`}
      title={
        `getipintel proxy score: ${score}\n` +
        '> 0.95 worth a look, > 0.99 most likely a proxy, 1 = explicitly banned.\n' +
        'Guests only. Visible to trust 0-1.'
      }
    >
      {Number(score.toFixed(3))}
    </span>
  );
}

ProxyScore.propTypes = {
  score: PropTypes.number,
};

// Connecting from a published Tor exit node. Its own marker rather than a score,
// because it's an exact fact off the Tor Project's list rather than an inference —
// and because getipintel routinely scores exits 0, so the number beside it can be
// misleadingly clean. Gated the same way: the server only sends `tor` to trust 0-1.
function TorMark({ tor }) {
  if (!tor) return null;

  return (
    <span
      className='userLiProxy userLiProxy-tor'
      title={'Connecting through a Tor exit node (Tor Project exit list).\nVisible to trust 0-1.'}
    >
      TOR
    </span>
  );
}

TorMark.propTypes = {
  tor: PropTypes.bool,
};

function UserList({ socket, userlist, emojis, blocks = [] }) {
  // Keyed lowercase: nicks are matched case-insensitively everywhere else, and
  // the list is small enough that rebuilding this per render costs nothing.
  const blocked = new Map(blocks.map(b => [String(b.nick).toLowerCase(), b.expires]));

  return (
    <div className='userLi'>
      {userlist.map(user => {
        const isBlocked = blocked.has(user.nick.toLowerCase());
        return (
          <div className={'userLiSpan' + (isBlocked ? ' userLiBlocked' : '')} key={user.id}>
            <span className='userLiName'>{user.nick}</span>
            <TorMark tor={user.tor} />
            <ProxyScore score={user.proxyScore} />
            {isBlocked ? (
              <span
                className='material-symbols-outlined userLiBlockMark'
                title={blockedUntil(blocked.get(user.nick.toLowerCase()))}
              >block</span>
            ) : null}
            <span className='userLiCurrency'>₵{user.coins}</span>
            <div className='userLiActions'>
              {getUserActions(user.nick, socket, isBlocked).map(action => (
                <button key={action.name} className='userActionBtn' onClick={action.callback}>
                  {action.name}
                </button>
              ))}
            </div>
            <div className='userLiAFK'><ParsedContent text={user.afk} emojis={emojis} styles={inlineStyles} /></div>
          </div>
        );
      })}
    </div>
  );
}

UserList.propTypes = {
  socket:      PropTypes.object.isRequired,
  userlist:    PropTypes.array.isRequired,
  emojis:      PropTypes.array,
  blocks:      PropTypes.array,
};

// ─── AccountPanel ───────────────────────────────────────────────────────────

// Login/register form + a logged-in "welcome" state. Identity is a loginToken
// cookie (see /login); a successful login makes the server broadcast
// registered=true live, so the `user` prop flips and this swaps to the welcome
// view without a reload. Logout clears the token server-side then reloads, which
// re-runs /preconnect with no token and drops us to a fresh guest.
function AccountPanel({ user, channelName }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [nick, setNick] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!nick || !password || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: mode, params: { nick, password, channelName } }),
      });
      // Success bodies can be empty, so guard the parse.
      const text = await res.text();
      const body = text ? JSON.parse(text) : {};
      if (!res.ok || body.error) {
        setError(body.error || `Request failed (${res.status}).`);
        setBusy(false);
        return;
      }
      // Server broadcasts registered=true live; the welcome view takes over on
      // the next user-state update. Just clear the password.
      setPassword('');
    } catch {
      setError('Could not reach the server. Try again.');
      setBusy(false);
    }
  }

  async function logout() {
    // Best-effort: even if the request fails, reload to a clean guest state.
    try { await fetch('/logout', { method: 'POST' }); } catch { /* ignore */ }
    window.location.reload();
  }

  if (user?.registered) {
    return (
      <div className='accountPanel'>
        <div className='accountWelcome'>welcome {user.nick} :)</div>
        <button className='stdBtn' onClick={logout}>Log out</button>
      </div>
    );
  }

  return (
    <form className='accountPanel' onSubmit={submit}>
      <div className='segmented accountTabs'>
        {['login', 'register'].map(m => (
          <button
            type='button'
            key={m}
            className={'segmentBtn' + (mode === m ? ' active' : '')}
            onClick={() => { setMode(m); setError(''); }}
          >
            {m}
          </button>
        ))}
      </div>
      <input
        className='stdInput'
        placeholder='Nick'
        maxLength={20}
        value={nick}
        autoComplete='username'
        onChange={e => setNick(e.target.value)}
      />
      <input
        className='stdInput'
        type='password'
        placeholder='Password'
        value={password}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        onChange={e => setPassword(e.target.value)}
      />
      {error && <div className='accountError'>{error}</div>}
      <button className='stdBtn' type='submit' disabled={!nick || !password || busy}>
        {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Register'}
      </button>
    </form>
  );
}

AccountPanel.propTypes = {
  user:        PropTypes.object,
  channelName: PropTypes.string,
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

function Shop({ hats, emojis, user, channelName, userlist }) {
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

      {selectedCat === 'filters'    && <FiltersShop emojis={emojis} />}
      {selectedCat === 'mws'        && <MwsShop user={user} channelName={channelName} userlist={userlist} />}
      {selectedCat === 'join names' && <JoinNames channelName={channelName} />}
    </div>
  );
}

Shop.propTypes = {
  hats:        PropTypes.array.isRequired,
  emojis:      PropTypes.array,
  user:        PropTypes.object,
  channelName: PropTypes.string,
  userlist:    PropTypes.array,
};

// ─── MwsShop ────────────────────────────────────────────────────────────────

// Middlewares: server-defined transform functions (shrek, uwu, etc) that run
// against a *target user's* message text when they send it — this is a curse
// you pay coins to inflict on someone else, not something you equip on
// yourself. `/mw <nick> <id>` is the chat-command equivalent; this panel is
// the GUI version: pick a target, pick an MW, pay the cost.
//
// `user.middlewares` here is the list of MWs currently cursing *you* (placed
// on you by other people), each `{ id, appliedBy, messagesLeft }`, pushed live
// by the server the same way `registered` flips post-login. It's read-only from
// your side apart from paying again to shake one off.
//
// Nothing here is enforcement — the buttons disable on price and the datalist
// only knows who's online, but the server re-checks the balance, the target and
// the block list on every request (see src/middlewareActions.js).
function MwsShop({ user, channelName, userlist = [] }) {
  const [catalog, setCatalog] = useState([]);
  const [target, setTarget] = useState('');
  const [applyingId, setApplyingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetch('/channel/middlewares')
      .then(res => res.json())
      .then(data => setCatalog(Array.isArray(data) ? data : []))
      .catch(() => setError('Could not load the MW list.'));
  }, []);

  // Read straight off the live user rather than mirroring into local state: the
  // server is the only thing that changes this list, and it pushes every change
  // through userStateChange — a local copy would just be a second source of
  // truth to keep in sync after an apply lands on someone else's screen.
  const active = Array.isArray(user?.middlewares) ? user.middlewares : [];

  const byId = new Map(catalog.map(mw => [mw.id, mw]));
  const coins = user?.coins ?? 0;
  const nick = target.trim();
  const busy = !!applyingId || !!removingId;

  function say(err, ok) {
    setError(err ?? '');
    setNotice(ok ?? '');
  }

  function apply(mw) {
    if (busy) return;
    if (!nick) { say('Pick who to target first.'); return; }
    if (coins < mw.cost) { say(`Not enough coins for ${mw.name}.`); return; }
    setApplyingId(mw.id);
    say();
    fetch('/a/middleware/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName, targetNick: nick, id: mw.id }),
    })
      .then(res => res.json())
      .then(res => {
        if (res.error) { say(res.error); return; }
        say(null, `${res.name} applied to ${res.target} for their next ${res.messages} messages.`);
      })
      .catch(() => say('Could not reach the server.'))
      .finally(() => setApplyingId(null));
  }

  function clear(id) {
    if (busy) return;
    const mw = byId.get(id);
    if (mw && coins < mw.cost) { say(`Shaking off ${mw.name} costs ₵${mw.cost}.`); return; }
    setRemovingId(id);
    say();
    fetch('/a/middleware/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName, id }),
    })
      .then(res => res.json())
      .then(res => {
        // No local removal: the server broadcasts the new list, which arrives as
        // a userStateChange and re-renders this panel on its own.
        if (res.error) { say(res.error); return; }
        say(null, `You shook off ${res.name}.`);
      })
      .catch(() => say('Could not reach the server.'))
      .finally(() => setRemovingId(null));
  }

  return (
    <div className='mwShop'>
      {error && <div className='mwError'>{error}</div>}
      {notice && <div className='mwNotice'>{notice}</div>}

      <div className='mwSectionLabel'>Apply a MW to someone</div>
      <div className='mwTargetRow'>
        <input
          className='stdInput mwTargetInput'
          list='mwUserlist'
          placeholder='Target nick'
          value={target}
          onChange={e => { setTarget(e.target.value); say(); }}
        />
        <datalist id='mwUserlist'>
          {userlist.filter(u => u.nick).map(u => <option key={u.id} value={u.nick} />)}
        </datalist>
      </div>

      <div className='mwCatalogList'>
        {catalog.length === 0 && <div className='mwEmpty'>No MWs available yet.</div>}
        {catalog.map(mw => (
          <div className='mwCatalogRow' key={mw.id}>
            <div className='mwCatalogBody'>
              <div className='mwCatalogName'>{mw.name}</div>
              <p className='mwCatalogDesc'>{mw.description}</p>
              <div className='mwCatalogMeta'>{mw.messages} messages</div>
            </div>
            <button
              className='stdBtn mwApplyBtn'
              onClick={() => apply(mw)}
              // Disabled for the whole panel while any request is in flight, not
              // just this row — apply() refuses concurrent calls anyway, and a
              // button that looks live but silently no-ops reads as broken.
              disabled={busy || !nick || coins < mw.cost}
              title={!nick ? 'Pick a target first' : coins < mw.cost ? 'Not enough coins' : `Apply to ${nick}`}
            >
              {applyingId === mw.id ? '…' : `₵${mw.cost}`}
            </button>
          </div>
        ))}
      </div>

      {active.length > 0 && (
        <>
          <div className='mwSectionLabel'>Currently affecting you</div>
          <div className='mwActiveList'>
            {active.map(a => {
              const mw = byId.get(a.id);
              return (
                <div className='mwActiveRow' key={a.id}>
                  <div className='mwActiveBody'>
                    <span className='mwActiveName'>{mw?.name || a.id}</span>
                    <span className='mwActiveMeta'>
                      {a.appliedBy && `from ${a.appliedBy} · `}
                      {a.messagesLeft} message{a.messagesLeft === 1 ? '' : 's'} left
                    </span>
                  </div>
                  <span
                    className='mwActiveRemoveBtn material-symbols-outlined'
                    onClick={() => { if (!busy) clear(a.id); }}
                    title={mw ? `Shake it off (₵${mw.cost})` : 'Shake it off'}
                  >{removingId === a.id ? 'hourglass_empty' : 'close'}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

MwsShop.propTypes = {
  user:        PropTypes.object,
  channelName: PropTypes.string,
  userlist:    PropTypes.array,
};

// ─── FiltersShop ────────────────────────────────────────────────────────────

// Word filters: a word/phrase a user types gets swapped (client-side, at render
// time) for a styled replacement. `withThis` carries the same message markup the
// chat renderer uses (colors like #red, fonts like $Font|, styles like /^), so
// we preview it live with ParsedContent. The narrow side panel only lists
// filters + an Add button; adding/editing happens in a roomy pop-out
// (FilterEditor). Who may add and who may remove are both trust levels an admin
// sets from the commands panel (filter:add / filter:remove) — the server is the
// one that decides, so the buttons are always offered and a refusal comes back
// as the error the panel shows. A cope-coin cost is planned.
function FiltersShop({ emojis = [] }) {
  const [filters, setFilters] = useState([]);
  // null when the editor is closed; otherwise { replace, withThis, isNew }.
  const [editor, setEditor] = useState(null);
  // Errors from the list itself (a refused delete); the editor shows its own.
  const [listError, setListError] = useState('');

  useEffect(() => {
    fetch('/channel/info/main/filteredWords')
      .then(res => res.json())
      .then(data => setFilters(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  function deleteFilter(word) {
    return fetch('/a/filter', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName: 'main', replace: word }),
    }).then(res => res.json());
  }

  // Persist a new/edited filter. `original` is the trigger word being edited (or
  // null when adding); if a rename changed it, the old row is deleted first so we
  // don't leave a stale duplicate (POST upserts by the *new* word).
  function saveFilter(original, replace, withThis) {
    const renamed = original && original.toLowerCase() !== replace.toLowerCase();
    // A rename is a delete plus an add, so it needs the delete permission. Abort
    // before the POST if the server refuses — otherwise the new word is created
    // while the old row survives, leaving the duplicate this step exists to avoid.
    const pre = renamed
      ? deleteFilter(original).then(res => {
        if (res.error) throw new Error(res.error);
      })
      : Promise.resolve();

    return pre
      .then(() => fetch('/a/filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName: 'main', replace, withThis }),
      }))
      .then(res => res.json())
      .then(res => {
        if (res.error) throw new Error(res.error);
        setFilters(prev => {
          const cleaned = prev.filter(f =>
            f.replace.toLowerCase() !== replace.toLowerCase() &&
            (!original || f.replace.toLowerCase() !== original.toLowerCase()));
          return [...cleaned, { replace, withThis }];
        });
      });
  }

  // Removing is moderator-only server-side, so drop the row from the list only
  // once the server confirms it. Optimistically removing here would show the
  // filter as gone to a user who isn't allowed to remove it, until they reload.
  function removeFilter(word) {
    setListError('');
    deleteFilter(word)
      .then(res => {
        if (res.error) { setListError(res.error); return; }
        setFilters(prev => prev.filter(f => f.replace !== word));
      })
      .catch(() => setListError('Could not remove filter.'));
  }

  return (
    <div className='filtersShop'>
      <button className='stdBtn filterAddBtn' onClick={(e) => setEditor({ replace: '', withThis: '', isNew: true, y: e.clientY })}>
        <span className='material-symbols-outlined'>add</span> Add filter
      </button>

      {listError && <div className='filterEmpty filterError'>{listError}</div>}

      <div className='filterList'>
        {filters.length === 0 && <div className='filterEmpty'>No filters yet.</div>}
        {filters.map(f => (
          <div
            className='filterRow'
            key={f.replace}
            onClick={(e) => setEditor({ replace: f.replace, withThis: f.withThis, isNew: false, y: e.clientY })}
            title='Edit filter'
          >
            <div className='filterRowBody'>
              <span className='filterTrigger'>{f.replace}</span>
              <span className='filterResult'><ParsedContent text={f.withThis} emojis={emojis} /></span>
            </div>
            <span
              className='filterDelete material-symbols-outlined'
              onClick={(e) => { e.stopPropagation(); removeFilter(f.replace); }}
              title='Remove filter'
            >close</span>
          </div>
        ))}
      </div>

      {editor && (
        <FilterEditor
          emojis={emojis}
          initial={editor}
          existing={filters}
          onClose={() => setEditor(null)}
          onSave={(replace, withThis) =>
            saveFilter(editor.isNew ? null : editor.replace, replace, withThis).then(() => setEditor(null))
          }
        />
      )}
    </div>
  );
}

FiltersShop.propTypes = {
  emojis: PropTypes.array,
};

// ─── FilterEditor ───────────────────────────────────────────────────────────

// The roomy add/edit surface for a single word filter, floated in a
// DraggableWindow so it isn't constrained by the ~250px side panel. Full-width
// inputs, a large live preview, and space for a styling helper later.
function FilterEditor({ emojis = [], initial, existing = [], onClose, onSave }) {
  const [replace, setReplace] = useState(initial.replace);
  const [withThis, setWithThis] = useState(initial.withThis);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Re-load the editor when a different filter is picked from the list while the
  // window is open — each pick passes a fresh `initial` object, so this fires on
  // switch (and on Add, which passes empty fields) without remounting the window.
  useEffect(() => {
    setReplace(initial.replace);
    setWithThis(initial.withThis);
    setError('');
    setSaving(false);
  }, [initial]);

  // X is frozen just left of the side panel (screen right) so the cursor barely
  // moves; dragging then sticks. Computed once.
  const leftRef = useRef(null);
  if (leftRef.current === null) {
    const w = 340;
    const menu = document.querySelector('.menuPane');
    leftRef.current = menu
      ? Math.max(12, menu.getBoundingClientRect().left - w - 12)
      : Math.max(12, window.innerWidth - w - 320);
  }

  // Y follows the click that opened/switched the editor (initial.y), so it lands
  // next to the row you clicked. Clamped against the window's own height so it
  // never spills off the top or bottom. Height is measured post-render (below);
  // 360 is a first-paint estimate.
  const bodyRef = useRef(null);
  const [winH, setWinH] = useState(360);
  useLayoutEffect(() => {
    if (!bodyRef.current) return;
    const h = bodyRef.current.offsetHeight + 58; // + title bar & body padding
    setWinH(prev => (Math.abs(prev - h) > 2 ? h : prev));
  });

  const margin = 12;
  const clickY = initial.y ?? window.innerHeight / 2;
  const top = Math.min(
    Math.max(margin, clickY - 40),
    Math.max(margin, window.innerHeight - winH - margin)
  );

  const word = replace.trim();
  // Warn (don't block) when adding a trigger that already exists — save overwrites.
  const dupe = !!word && initial.isNew &&
    existing.some(f => f.replace.toLowerCase() === word.toLowerCase());

  function save() {
    if (!word || !withThis || saving) return;
    setSaving(true);
    setError('');
    onSave(word, withThis).catch(err => {
      setError(err.message || 'Could not save filter.');
      setSaving(false);
    });
  }

  return (
    <DraggableWindow
      title={initial.isNew ? 'New filter' : 'Edit filter'}
      onClose={onClose}
      width={340}
      initialLeft={leftRef.current}
      initialTop={top}
    >
      <div className='filterEditor' ref={bodyRef}>
        <label className='filterField'>
          <span className='filterFieldLabel'>Replace this word or phrase</span>
          <input
            className='stdInput'
            maxLength={100}
            value={replace}
            placeholder='e.g. chad'
            onChange={e => setReplace(e.target.value)}
            autoFocus
          />
        </label>

        <label className='filterField'>
          <span className='filterFieldLabel'>With this</span>
          <input
            className='stdInput'
            maxLength={500}
            value={withThis}
            placeholder='e.g. #redGIGA CHAD'
            onChange={e => setWithThis(e.target.value)}
          />
        </label>

        <div className='filterEditorPreview'>
          <span className='filterFieldLabel'>Preview</span>
          <div className='filterPreviewBox'>
            {withThis ? <ParsedContent text={withThis} emojis={emojis} /> : <span className='filterPreviewEmpty'>Nothing yet…</span>}
          </div>
        </div>

        <p className='filtersHint'>
          The replacement should be visually distinct
        </p>

        {dupe && <div className='filterWarn'>A filter for “{word}” already exists — saving overwrites it.</div>}
        {error && <div className='filterError'>{error}</div>}

        <div className='filterEditorActions'>
          <button className='stdBtn ghost' onClick={onClose}>Cancel</button>
          <button className='stdBtn' onClick={save} disabled={!word || !withThis || saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </DraggableWindow>
  );
}

FilterEditor.propTypes = {
  emojis:   PropTypes.array,
  initial:  PropTypes.object.isRequired,
  existing: PropTypes.array,
  onClose:  PropTypes.func.isRequired,
  onSave:   PropTypes.func.isRequired,
};

// ─── JoinNames ────────────────────────────────────────────────────────────────

// The word lists a guest's random nick is built from: one adjective plus one
// noun. Adding is open to any logged-in user by default and removing is a
// moderator action, but both are trust levels an admin retunes from the commands
// panel (joinnick:add / joinnick:remove) — so, like the filters panel, the
// controls are always offered and a refusal comes back as an error to show.
//
// Editing a word isn't a thing: a name is its own identity in the table (the
// primary key is channel + type + name), so a fix is a remove plus an add.
const JOIN_NAME_TYPES = [
  { type: 'adjective', label: 'Adjectives' },
  { type: 'noun',      label: 'Nouns' },
];

// The same name the server would assemble (see Channel.assignName), so the
// preview stays honest as either list empties out.
function sampleJoinName(adjectives, nouns) {
  const pick = list => list[Math.floor(Math.random() * list.length)];
  if (adjectives.length && nouns.length) return pick(adjectives) + pick(nouns);
  if (adjectives.length || nouns.length) {
    return pick(adjectives.length ? adjectives : nouns) + Math.floor(Math.random() * 999);
  }
  return 'ChatUser' + Math.floor(Math.random() * 9999);
}

function JoinNames({ channelName = 'main' }) {
  const [lists, setLists] = useState({ adjective: [], noun: [] });
  const [drafts, setDrafts] = useState({ adjective: '', noun: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Bumped to re-roll the preview; the lists changing re-rolls it too, which is
  // what makes an add or a remove visibly land on the sample name.
  const [roll, setRoll] = useState(0);

  useEffect(() => {
    fetch('/channel/info/' + encodeURIComponent(channelName) + '/joinnick')
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        const byType = type => data.filter(a => a.type === type).map(a => a.name).sort((a, b) => a.localeCompare(b));
        setLists({ adjective: byType('adjective'), noun: byType('noun') });
      })
      .catch(() => setError('Could not load the join names.'));
  }, [channelName]);

  // Memoised, or every unrelated re-render (typing in an input) would reshuffle
  // the sample under the user.
  const preview = useMemo(() => sampleJoinName(lists.adjective, lists.noun), [lists, roll]);

  function add(type) {
    const name = drafts[type].trim();
    if (!name || busy) return;

    setBusy(true);
    setError('');
    fetch('/a/joinnick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName, type, name }),
    })
      .then(res => res.json())
      // `message` covers the /a/ login gate, which answers with that rather than
      // an `error` — without it a guest's click would do nothing at all.
      .then(res => {
        if (res.error || res.message) { setError(res.error || res.message); return; }
        setLists(prev => ({ ...prev, [type]: [...prev[type], res.name].sort((a, b) => a.localeCompare(b)) }));
        setDrafts(prev => ({ ...prev, [type]: '' }));
        setRoll(n => n + 1);
      })
      .catch(() => setError('Could not reach the server.'))
      .finally(() => setBusy(false));
  }

  // Removing is moderator-only by default, so the word leaves the list only once
  // the server confirms it — dropping it here first would show it as gone to
  // someone who isn't allowed to remove it, until they reload.
  function remove(type, name) {
    if (busy) return;

    setBusy(true);
    setError('');
    fetch('/a/joinnick', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName, type, name }),
    })
      .then(res => res.json())
      .then(res => {
        if (res.error || res.message) { setError(res.error || res.message); return; }
        setLists(prev => ({ ...prev, [type]: prev[type].filter(n => n !== name) }));
        setRoll(n => n + 1);
      })
      .catch(() => setError('Could not reach the server.'))
      .finally(() => setBusy(false));
  }

  return (
    <div className='joinNamesContainer'>
      <div className='randomNameDisplay' onClick={() => setRoll(n => n + 1)} title='Roll another'>
        <span className='joinNameSample' key={roll}>{preview}</span>
        <span className='joinNameHint'>Click to roll another</span>
      </div>

      {error && <div className='joinNameError'>{error}</div>}

      <div className='nameCategory'>
        {JOIN_NAME_TYPES.map(({ type, label }) => (
          <div className='joinNameColumn' key={type}>
            <b>{label} <span className='joinNameCount'>{lists[type].length}</span></b>

            <div className='joinNameAddRow'>
              <input
                className='stdInput joinNameInput'
                placeholder={type === 'adjective' ? 'Sneaky' : 'Wizard'}
                value={drafts[type]}
                maxLength={20}
                onChange={e => { setDrafts(prev => ({ ...prev, [type]: e.target.value })); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') add(type); }}
              />
              <span
                className='joinNameAddBtn material-symbols-outlined'
                onClick={() => add(type)}
                title={'Add ' + type}
              >add</span>
            </div>

            <div className='joinNameList'>
              {lists[type].length === 0 && <div className='joinNameEmpty'>None yet.</div>}
              {lists[type].map(name => (
                <div className='joinNameRow' key={name}>
                  <span className='joinNameWord' title={name}>{name}</span>
                  <span
                    className='joinNameDelete material-symbols-outlined'
                    onClick={() => remove(type, name)}
                    title='Remove'
                  >close</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

JoinNames.propTypes = {
  channelName: PropTypes.string,
};

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

// One render-cap slider. Every half of both settings (each viewer's own value
// and the channel's) is the same control, so they all read the same way.
//
// `offAtMax` puts the "off" setting — 0, i.e. never clip — one step past the top
// of the range, so the far right of the slider means "never" rather than a
// height nobody reaches.
function RenderSlider({ label, value, min, max, step = 1, offAtMax = false, format, onChange, disabled }) {
  const sliderMax = offAtMax ? max + step : max;
  const sliderValue = (offAtMax && value === 0) ? sliderMax : value;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, opacity: disabled ? 0.5 : 1 }}>
      <span style={{ fontSize: 12, width: 58 }}>{label}</span>
      <input
        type="range"
        min={min} max={sliderMax} step={step}
        value={sliderValue}
        disabled={disabled}
        onChange={e => {
          const next = parseInt(e.target.value, 10);
          onChange(offAtMax && next > max ? 0 : next);
        }}
        style={{ flex: 1, cursor: disabled ? 'default' : 'pointer' }}
      />
      <span style={{ fontSize: 11, color: '#aaa', width: 44, textAlign: 'right' }}>
        {format ? format(value) : value}
      </span>
    </div>
  );
}

RenderSlider.propTypes = {
  label:    PropTypes.string.isRequired,
  value:    PropTypes.number.isRequired,
  min:      PropTypes.number.isRequired,
  max:      PropTypes.number.isRequired,
  step:     PropTypes.number,
  offAtMax: PropTypes.bool,
  format:   PropTypes.func,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

const formatHeight = h => (h === MSG_HEIGHT_OFF ? 'Off' : h + 'px');

function ChannelTheme({
  themecolors, channelName,
  styleLimit, changeStyleLimit, channelStyleLimit,
  msgHeight, changeMsgHeight, channelMsgHeight,
}) {
  const [colors, setColors] = useState(themecolors || {});
  const [status, setStatus] = useState(null);
  // Whether we're a mod, i.e. whether the channel sliders are ours to move. The
  // server decides — and re-checks on the POST — so this only drives the UI.
  const [canEditLimits, setCanEditLimits] = useState(false);
  const [chLimit, setChLimit] = useState(channelStyleLimit);
  const [chHeight, setChHeight] = useState(channelMsgHeight);
  const [limitStatus, setLimitStatus] = useState(null);

  useEffect(() => {
    setColors(themecolors || {});
  }, [themecolors]);

  // A mod elsewhere moved a channel slider (broadcast as a themecolors row), so
  // follow it — unless we have unsaved edits of our own in the controls.
  useEffect(() => {
    if (limitStatus === 'unsaved') return;
    setChLimit(channelStyleLimit);
    setChHeight(channelMsgHeight);
  }, [channelStyleLimit, channelMsgHeight]);

  useEffect(() => {
    fetch('/channel/theme')
      .then(r => r.json())
      .then(d => setCanEditLimits(!!d.canEdit))
      .catch(() => setCanEditLimits(false));
  }, []);

  const limitsDirty = chLimit !== channelStyleLimit || chHeight !== channelMsgHeight;

  function saveLimits() {
    setLimitStatus('saving');
    Promise.all([
      ['stylelimit', chLimit],
      ['msgheight', chHeight],
    ].map(([key, value]) =>
      fetch('/a/rendersetting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName, key, value }),
      }).then(r => r.json())
    ))
      // A guest gets {message: 'You must be logged in'} rather than an error
      // key, so treat anything without an explicit success as a failure.
      .then(results => setLimitStatus(results.every(d => d.success) ? 'saved' : 'error'))
      .catch(() => setLimitStatus('error'));
  }

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
    <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto' }}>
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

      <div style={{ fontSize: 11, color: '#777', margin: '22px 0 4px' }}>Style Limit</div>
      <div style={{ fontSize: 11, color: '#777', marginBottom: 10, lineHeight: 1.4 }}>
        How many styles a message may stack (/*, /^, …). Past the limit the rest of
        the message is shown as plain text.
      </div>

      <RenderSlider
        label='Yours' value={styleLimit} onChange={changeStyleLimit}
        min={STYLE_LIMIT_MIN} max={STYLE_LIMIT_MAX}
      />
      <RenderSlider
        label='Channel' value={chLimit} disabled={!canEditLimits}
        min={STYLE_LIMIT_MIN} max={STYLE_LIMIT_MAX}
        onChange={v => { setChLimit(v); setLimitStatus('unsaved'); }}
      />

      <div style={{ fontSize: 11, color: '#777', margin: '18px 0 4px' }}>Message Height</div>
      <div style={{ fontSize: 11, color: '#777', marginBottom: 10, lineHeight: 1.4 }}>
        How tall a message may get before it is cut off behind a “Show more”
        button. Far right is off — never cut anything off.
      </div>

      <RenderSlider
        label='Yours' value={msgHeight} onChange={changeMsgHeight}
        min={MSG_HEIGHT_MIN} max={MSG_HEIGHT_MAX} step={MSG_HEIGHT_STEP}
        offAtMax format={formatHeight}
      />
      <RenderSlider
        label='Channel' value={chHeight} disabled={!canEditLimits}
        min={MSG_HEIGHT_MIN} max={MSG_HEIGHT_MAX} step={MSG_HEIGHT_STEP}
        offAtMax format={formatHeight}
        onChange={v => { setChHeight(v); setLimitStatus('unsaved'); }}
      />

      {canEditLimits ? (
        <button
          className='stdBtn'
          onClick={saveLimits}
          disabled={limitStatus === 'saving' || !limitsDirty}
          style={{ width: '100%', marginTop: 4, padding: '6px 0' }}
        >
          {limitStatus === 'saving' ? 'Saving…' : limitStatus === 'saved' ? 'Saved!' : limitStatus === 'error' ? 'Error — try again' : 'Save Channel Limits'}
        </button>
      ) : (
        <div style={{ fontSize: 11, color: '#777' }}>Channel limits are set by moderators.</div>
      )}

      {/* Whichever cap is lower is the one messages actually render at, so say
          so — otherwise setting your own slider past the channel's looks broken. */}
      <div style={{ fontSize: 11, color: '#aaa', margin: '10px 0 4px' }}>
        Rendering at {Math.min(styleLimit, channelStyleLimit)} styles,{' '}
        {formatHeight(effectiveMessageHeight(msgHeight, channelMsgHeight))} tall.
      </div>
    </div>
  );
}

ChannelTheme.propTypes = {
  themecolors:       PropTypes.object,
  channelName:       PropTypes.string,
  styleLimit:        PropTypes.number.isRequired,
  changeStyleLimit:  PropTypes.func.isRequired,
  channelStyleLimit: PropTypes.number.isRequired,
  msgHeight:         PropTypes.number.isRequired,
  changeMsgHeight:   PropTypes.func.isRequired,
  channelMsgHeight:  PropTypes.number.isRequired,
};

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
