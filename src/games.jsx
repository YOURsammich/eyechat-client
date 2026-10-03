import { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

import socket from './utils/socket';
import { ACTIVITIES, ACTIVITY_KINDS, getActivity, openEvent, closeEvent } from './comps/activities';
import { activityPanel } from './comps/activityPanels';
import GameCard from './comps/Chat/GameCard';

// The games hub: every game and shared tool the room has, playable without
// being in the chat. The chat's floating panels are mounted here unchanged,
// over a lobby instead of over the log, on a socket of their own (/games/ws)
// that carries game traffic and nothing else — so what you play here is the
// same live game the chat is playing, but you are not in the room.
//
// Logged-in only: the page and its handshake sit behind the 'page:games' gate
// (src/routes/games.js), so by the time this runs the server knows who we are
// and says so in `hub:hello`.
//
// One page, two views: the lobby (/games) and the lobby with panels open
// (/games/<id>, which opens that one on load). The panels are draggable
// windows already, so several can be up at once, exactly as in the chat.

const TOAST_MS = 6000;

// What the URL says should be open on arrival, if anything.
function activityFromPath() {
  const id = location.pathname.replace(/^\/games\/?/, '').split('/')[0];
  return getActivity(id) ? id : null;
}

// ─── the lobby ───────────────────────────────────────────────────────────────

// The lobby's cards are the chat's Play picker cards (GameCard), so the two
// look and read the same. The gallery isn't an activity — nothing to join —
// but it's where the whiteboard's saved drawings live, so it gets a strip
// beside the whiteboard's, shaped like an activity for the card.
const GALLERY = {
  id: 'gallery',
  label: 'Whiteboard gallery',
  blurb: 'Drawings saved off the board. Upvote them, watch them replay.',
  icon: 'photo_library',
  art: { from: '#334155', to: '#64748b', glyph: 'photo_library' },
  action: () => 'Browse',
};

// ─── the page ────────────────────────────────────────────────────────────────

function App() {
  const [user, setUser] = useState(null);        // { nick, trust, coins } from hub:hello
  const [conn, setConn] = useState('connecting'); // 'connecting' | 'online' | 'offline' | 'rejected'
  const [rejection, setRejection] = useState('');
  const [activities, setActivities] = useState({});
  const [openActivities, setOpenActivities] = useState(() => new Set());
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  // The game a /games/<id> link asked for, captured before anything rewrites
  // the URL (see the deep-link open below).
  const arrivedFor = useRef(activityFromPath());

  const toast = useCallback((text, kind = 'info', action = null) => {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, text, kind, action }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), TOAST_MS);
  }, []);

  // Open/close go through the same window events the chat uses, so anything
  // that opens a game there (the invite line, a panel's own buttons) opens it
  // here without knowing which page it is on.
  const open = useCallback((id) => window.dispatchEvent(new CustomEvent(openEvent(id))), []);
  const close = useCallback((id) => window.dispatchEvent(new CustomEvent(closeEvent(id))), []);

  useEffect(() => {
    const bound = ACTIVITIES.flatMap((a) => {
      const onOpen = () => setOpenActivities(prev => new Set(prev).add(a.id));
      const onClose = () => setOpenActivities(prev => { const n = new Set(prev); n.delete(a.id); return n; });
      window.addEventListener(openEvent(a.id), onOpen);
      window.addEventListener(closeEvent(a.id), onClose);
      return [[openEvent(a.id), onOpen], [closeEvent(a.id), onClose]];
    });
    return () => { for (const [ev, fn] of bound) window.removeEventListener(ev, fn); };
  }, []);

  // The URL follows what is open: /games/<id> for the panel opened most
  // recently, /games with nothing up. replaceState, not push — closing a
  // window is not a page you want the back button to return to.
  const lastOpened = useRef(null);
  useEffect(() => {
    const ids = [...openActivities];
    if (!ids.length) lastOpened.current = null;
    else if (!ids.includes(lastOpened.current)) lastOpened.current = ids[ids.length - 1];
    const want = lastOpened.current ? `/games/${lastOpened.current}` : '/games';
    if (location.pathname !== want) history.replaceState(null, '', want);
  }, [openActivities]);

  useEffect(() => {
    const offs = [
      socket.on('hub:hello', (me) => setUser(me)),

      socket.on('activity', (data) => {
        if (!data?.id) return;
        setActivities(prev => ({ ...prev, [data.id]: data.state ?? null }));
      }),

      // The chat renders this as a line in the log; here it is a toast with a
      // way in, since there is no log for it to sit in.
      socket.on('activityInvite', (invite) => {
        const a = getActivity(invite?.id);
        if (!a) return;
        toast(`${invite.host} started ${a.label}${invite.detail ? ` · ${invite.detail}` : ''}`, 'invite', { label: 'Join', id: a.id });
      }),

      // A game's errors and notices arrive as chat messages ("It's x's turn",
      // "Invalid funds"), because that is how the modules talk to a player.
      // There is no log here, so they are toasts.
      socket.on('message', (m) => {
        if (!m?.message || !m.messageType) return;
        if (m.messageType !== 'error' && m.messageType !== 'info') return;
        toast(String(m.message).trim(), m.messageType);
      }),

      // The balance moves when a bet is placed or a pot is paid out; the
      // server sends the same event the chat's userlist listens to.
      socket.on('userStateChange', ({ user: who, stateChange }) => {
        if (!who || !stateChange || !('coins' in stateChange)) return;
        setUser(me => (me && me.nick === who.nick) ? { ...me, coins: stateChange.coins } : me);
      }),

      socket.onDisconnect(() => setConn('offline')),
      socket.onReconnect(() => setConn('online')),
      socket.onRejected((text) => { setConn('rejected'); setRejection(text); }),
    ];

    socket.init({
      getActiveChannel: () => 'games',
      preconnectUrl: '/games/preconnect',
      wsPath: '/games/ws',
    }).then((ok) => {
      if (!ok) return;
      setConn('online');
      // Arrived by deep link: open that game once the socket is up, so its
      // first sync has somewhere to go. Read from the path as it was on
      // arrival — by now the URL-follows-panels effect has already rewritten
      // it to /games, since nothing was open on the first render.
      if (arrivedFor.current) open(arrivedFor.current);
    });

    return () => offs.forEach(off => off && off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const liveCount = ACTIVITIES.filter(a => a.live?.(activities[a.id])).length;

  return (
    <div className='wrap games'>
      <header className='gamesHeader'>
        <div>
          <h1>Games</h1>
          <p>
            The room’s games and shared tools, playable from here without being in the chat.
            What you join is the same live game the chat is playing.
            &nbsp;<a href='/'>Back to chat →</a>
          </p>
        </div>
        <div className='gamesMe'>
          {user ? (
            <>
              <span className='gamesMeNick'>{user.nick}</span>
              <span className='gamesMeCoins' title='Your coins'>₵{user.coins ?? 0}</span>
            </>
          ) : null}
          <span className={'gamesConn ' + conn}>
            {conn === 'connecting' ? 'Connecting…'
              : conn === 'online' ? (liveCount ? `${liveCount} live` : 'Online')
              : conn === 'offline' ? 'Reconnecting…'
              : 'Not connected'}
          </span>
        </div>
      </header>

      {conn === 'rejected' ? (
        <div className='status err'>{rejection || 'Unable to connect.'}</div>
      ) : null}

      {ACTIVITY_KINDS.map(({ kind, label }) => {
        const rows = ACTIVITIES.filter(a => a.kind === kind);
        if (!rows.length) return null;
        return (
          <section className='gamesSection' key={kind}>
            <h2>{label}</h2>
            {/* games as cards in a grid; tools as strips, as in the picker */}
            <div className={kind === 'game' ? 'gameGrid' : 'gameStrips'}>
              {rows.map(a => (
                <GameCard
                  key={a.id}
                  wide={kind !== 'game'}
                  activity={a}
                  state={activities[a.id]}
                  open={openActivities.has(a.id)}
                  onLaunch={open}
                />
              ))}
              {kind === 'tool' ? <GameCard wide activity={GALLERY} href='/gallery' /> : null}
            </div>
          </section>
        );
      })}

      {/* Every open panel, on the same prop bag the chat gives them — a panel
          that doesn't need channelName simply ignores it. */}
      {ACTIVITIES.filter((a) => openActivities.has(a.id)).map((a) => {
        const Panel = activityPanel(a.id);
        if (!Panel) return null;
        return (
          <Panel
            key={a.id}
            socket={socket}
            user={user}
            channelName='games'
            onClose={() => close(a.id)}
          />
        );
      })}

      <div className='toasts' aria-live='polite'>
        {toasts.map(t => (
          <div className={'toast ' + t.kind} key={t.id}>
            <span>{t.text}</span>
            {t.action ? (
              <button type='button' className='btn btn-primary' onClick={() => open(t.action.id)}>{t.action.label}</button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
