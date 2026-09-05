import { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

import Store from './utils/store';
import socket from './utils/socket';

import ChatWindow from './comps/Chat/ChatWindow';
import CodeRunWindow from './comps/CodeRunner/CodeRunWindow';
import { preloadFontsFromText, loadFont } from './comps/Chat/Messages';

const COPE_CLOUD = 'http://localhost:8080/';

// SVG filter definitions for the message `effect` MWs (src/middlewares.js).
// Mounted once for the whole app, not per message: a filter is referenced by id
// from CSS, so one definition serves every message wearing the class, and
// duplicating it per message would put a full turbulence generator in the DOM
// for each cursed line.
//
// Two variants of each. `#fx-liquid` animates; `#fx-liquid-static` is the same
// distortion frozen, which is what the stylesheet switches to under
// prefers-reduced-motion — the text still looks submerged, but nothing moves.
//
// Tuning (see liquid-effect-spec.md): scale is the intensity knob, and past
// roughly 8 short words start coming apart. The x/y base frequencies are kept
// different from each other so the noise reads as a liquid surface rather than
// uniform static, and the animation moves between a rolling swell and a tighter
// shimmer, which is what makes it flow instead of vibrate.
//
// The filter region is far taller than the default because this applies to the
// whole message row, and a hat hangs ~50px above the line on negative margins
// (.nick .hat in chat-messages.css). Anything outside the region is clipped, so
// a tight box would decapitate every cursed message wearing one. Height is a
// percentage of the row, so a one-line message gets the least slack — that is
// the case to check if a hat ever looks cut off.
function MessageEffectFilters() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <filter id="fx-liquid" x="-10%" y="-150%" width="120%" height="400%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.028"
            numOctaves="2" seed="7" result="noise">
            <animate attributeName="baseFrequency"
              dur="14s" repeatCount="indefinite"
              values="0.012 0.028; 0.018 0.020; 0.012 0.028" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise"
            scale="10" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        <filter id="fx-liquid-static" x="-10%" y="-150%" width="120%" height="400%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.028"
            numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise"
            scale="6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

function App() {
  const [showApp, setShowApp] = useState(false);
  const [showPluginBar, setShowPluginBar] = useState(false);
  const [userlist, setUserlist] = useState([]);
  const [userID, setUserID] = useState(null);
  const [plugins, setPlugins] = useState([]);
  // Set when /preconnect refuses us (ban, rate-limit, whitelist mode); shows a
  // blocking overlay instead of a silent, never-connecting chat shell.
  const [rejection, setRejection] = useState(null);

  const storeRef = useRef(null);
  const iframeRef = useRef(null);

  // Build the store synchronously so the chat shell can render on first paint,
  // before the WebSocket connects. It only reads localStorage.
  if (!storeRef.current) storeRef.current = window.store = new Store();

  const myUser = userlist.find(u => u.id === userID);

  useEffect(() => {
    // Register handlers up front (they only fire once events arrive over the
    // socket, which can't happen until it connects), then connect. The shell
    // renders immediately instead of waiting on the preconnect + WS handshake.
    socket.on('userlist', (list) => {
      // Load any fonts used in flairs up front, so styled nicks don't wait for a
      // message using that font to render before the font appears.
      for (const u of list) preloadFontsFromText(u.flair);
      setUserlist(list);
    });

    socket.on('setID', (id) => setUserID(id));

    socket.on('userJoin', (user) => {
      preloadFontsFromText(user.flair);
      setUserlist(prev => [...prev, user]);
    });

    socket.on('userLeft', (user) => {
      setUserlist(prev => {
        const index = prev.findIndex(a => a.id === user.id);
        if (index === -1) return prev;
        const next = [...prev];
        next.splice(index, 1);
        return next;
      });
    });

    socket.on('userStateChange', ({ user, stateChange }) => {
      // Both a flair and a message text style can name a font, so pull either in
      // before something rendered with it appears. A flair carries its font as a
      // "$Family|" token inside the markup; the text style's is a bare family
      // name in its own field, so it loads directly.
      if (stateChange.flair) preloadFontsFromText(stateChange.flair);
      if (stateChange.font) loadFont(stateChange.font);
      setUserlist(prev => {
        const index = prev.findIndex(a => a.id === user.id);
        if (index === -1) return prev;
        const next = [...prev];
        next[index] = { ...next[index], ...stateChange };
        return next;
      });
    });

    socket.on('setState', (data) => {
      if (data[0] === 'showPluginBar') setShowPluginBar(data[1]);
    });

    socket.on('channelInfo', (channelInfo) => {
      if (channelInfo.showPluginBar !== undefined) {
        setShowPluginBar(channelInfo.showPluginBar);
      }
    });

    // After an automatic reconnect, rejoin the channel so the server re-adds us
    // and resends the userlist + recent history (deduped by count in ChatWindow).
    socket.onReconnect(() => {
      socket.emit('joinChannel');
    });

    // Register before init() so a rejection from the in-flight preconnect is caught.
    socket.onRejected((message) => setRejection(message));

    socket.init({ getActiveChannel: () => 'main' }).then((ok) => {
      if (!ok) return;
      socket.emit('joinChannel');

      // fetch(COPE_CLOUD + 'getPublicApps')
      //   .then(res => res.json())
      //   .then(res => setPlugins(Object.keys(res)))
      //   .catch(() => {});
    });

    window.addEventListener('message', (e) => {
      if (e.data === 'requestnick' && iframeRef.current && myUser) {
        iframeRef.current.contentWindow.postMessage('nick: ' + myUser.nick, '*');
      } else if (e.data === 'requesttrust' && iframeRef.current && myUser) {
        iframeRef.current.contentWindow.postMessage('trust: ' + myUser.trust, '*');
      }
    });
  }, []);

  // Persist a *guest* nick so a refresh keeps the same name. Registered users are
  // re-authed by their loginToken (and /preconnect refreshes their nick cookie
  // server-side), so we must NOT write their display nick here: a second tab is
  // renamed on a nick collision, and persisting that random name would clobber
  // the shared, cross-tab nick cookie and knock the original tab down to guest.
  useEffect(() => {
    if (!myUser?.nick || myUser.registered) return;
    fetch('/set-nick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nick: myUser.nick })
    });
  }, [myUser?.nick, myUser?.registered]);

  // One-time hand-off of an old localStorage text style onto the account.
  //
  // /color and /font used to persist to the browser only, which meant the value
  // was invisible to the cosmetics menu and couldn't be captured by a style
  // profile. They now write to the account, but anyone who set a color before
  // that still has it sitting in localStorage — this adopts it on next load and
  // clears it, so the browser copy can't linger and be re-adopted.
  //
  // Only runs when the account has no text style of its own, so it can never
  // overwrite something set deliberately from the menu.
  const styleAdopted = useRef(false);
  useEffect(() => {
    if (styleAdopted.current || !myUser?.registered) return;
    if (myUser.color || myUser.glow || myUser.font || myUser.style?.length) return;

    const store = storeRef.current;
    const color = store.get('color') || null;
    const font = store.get('font') || null;
    if (!color && !font) return;

    // Latched before the request, not after: the effect re-runs on every user
    // state change, and two in-flight adoptions would race.
    styleAdopted.current = true;
    fetch('/a/textstyle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color, font, glow: null, style: null }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data?.success) return;
        store.setState('color', '');
        store.setState('font', '');
      })
      .catch(() => { styleAdopted.current = false; });
  }, [myUser?.registered, myUser?.color, myUser?.font, myUser?.glow, myUser?.style]);

  return (
    <div style={{ flexDirection: 'column', display: 'flex', flex: 1, overflow: 'hidden' }}>
      <MessageEffectFilters />

      {rejection ? (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.75)', padding: '1rem'
        }}>
          <div style={{
            maxWidth: '420px', width: '100%', textAlign: 'center',
            background: '#1e1e24', color: '#f2f2f2', borderRadius: '10px',
            padding: '1.75rem 1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Can’t join the channel
            </div>
            <div style={{ opacity: 0.85, lineHeight: 1.4 }}>{rejection}</div>
          </div>
        </div>
      ) : null}

      <div id='main-container'>

        {showPluginBar ? (
          <div className="sideBar">
            <div className="appViewToggle" onClick={() => setShowApp(s => !s)}>
              <span className="material-symbols-outlined">code</span>
            </div>
            <div className='pluginSelectionContainer'>
              {plugins.map((plugin) => (
                <div key={plugin} className="pluginSelect" onClick={() => setShowApp(plugin)}>
                  {plugin.slice(0, 2) + plugin.slice(-2)}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {showApp ? (
          <CodeRunWindow
            socket={socket}
            userlist={userlist}
            giveRefresh={(refresh) => { window._refreshIframe = refresh; }}
            focusOnCode={false}
            draggingWindow={false}
            pluginName={showApp}
            giveIframe={(iframe) => { iframeRef.current = iframe; }}
            copeCloud={COPE_CLOUD}
          />
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowX: 'hidden' }}>
          <ChatWindow
            socket={socket}
            userlist={userlist}
            channelName='main'
            user={myUser}
            focusOnChat={true}
            store={storeRef.current}
          />
        </div>

      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
