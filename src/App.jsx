import { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

import Store from './utils/store';
import socket from './utils/socket';

import ChatWindow from './comps/Chat/ChatWindow';
import CodeRunWindow from './comps/CodeRunner/CodeRunWindow';
import PluginWindow from './comps/CodeRunner/PluginWindow';
import { readOverrides, writeOverrides, resolveMode } from './comps/CodeRunner/pluginMode';
import PluginConsentDialog from './comps/CodeRunner/PluginConsentDialog';
import { parsePluginRequest, originOf } from './comps/CodeRunner/pluginBridge';
import {
  isTrusted, requestTrustList, setPluginTrusted, useTrustedPlugins, useTrustLoaded, wantsWallet,
} from './comps/CodeRunner/pluginTrust';
import { preloadFontsFromText, loadFont } from './comps/Chat/Messages';

// copecloud's API (the app list) and the host its plugin pages are served
// from. The two are separate origins so plugin code can never reach the
// editor's storage, where developers' dev tokens live.
const COPE_CLOUD = 'https://cloud.cope.chat/';
const COPE_PLUGINS = 'https://plugins.cope.chat/';
const PLUGIN_ORIGIN = originOf(COPE_PLUGINS);

const PAYMENT_TIMEOUT_MS = 15000;

// Answers to a plugin's coin requests go to copecloud's origin only, so a
// plugin frame that has navigated somewhere else never receives them.
function replyToPlugin(win, message) {
  try {
    win.postMessage(message, PLUGIN_ORIGIN);
  } catch {
    // the frame is gone
  }
}

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
  // The open plugin's name, or null. Its record is looked up in `plugins`, so
  // an author changing the display mode lands on the next fetch without the
  // viewer having to reopen anything.
  const [showApp, setShowApp] = useState(null);
  const [showPluginBar, setShowPluginBar] = useState(false);
  const [userlist, setUserlist] = useState([]);
  const [userID, setUserID] = useState(null);
  const [plugins, setPlugins] = useState([]);
  // Per-plugin viewer overrides of the author's display mode.
  const [modeOverrides, setModeOverrides] = useState(readOverrides);
  // Set when /preconnect refuses us (ban, rate-limit, whitelist mode); shows a
  // blocking overlay instead of a silent, never-connecting chat shell.
  const [rejection, setRejection] = useState(null);

  const storeRef = useRef(null);
  const iframeRef = useRef(null);
  const lastAppRef = useRef(null);
  const myUserRef = useRef(null);
  // A plugin's payment on its way to the server, held until the plugin has its
  // answer (one at a time).
  const pendingPayRef = useRef(null);
  // Identity passes asked of the server, by request id (see sendIdentity).
  const ticketRequestsRef = useRef(new Map());
  const pluginRequestRef = useRef(null);
  const openPluginRef = useRef(null);
  // Plugins this account has given wallet access (see pluginTrust.js).
  const trustedPlugins = useTrustedPlugins();
  const trustLoaded = useTrustLoaded();

  // Build the store synchronously so the chat shell can render on first paint,
  // before the WebSocket connects. It only reads localStorage.
  if (!storeRef.current) storeRef.current = window.store = new Store();

  const myUser = userlist.find(u => u.id === userID);

  // The message bridge is registered once, so it must not close over `myUser`
  // directly: it would capture the undefined value from the first render and
  // never answer a plugin's getNick/getTrust.
  myUserRef.current = myUser;

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

      // Public apps come back as records, not just names, because the plugin
      // bar needs each one's display mode as well as its name.
      fetch(COPE_CLOUD + 'getPublicApps')
        .then(res => res.json())
        .then(res => setPlugins(Array.isArray(res) ? res : []))
        .catch(() => {});
    });

    window.addEventListener('message', (e) => {
      const user = myUserRef.current;
      if (!iframeRef.current || !user) return;

      if (e.data === 'requestnick') {
        iframeRef.current.contentWindow.postMessage('nick: ' + user.nick, '*');
      } else if (e.data === 'requesttrust') {
        iframeRef.current.contentWindow.postMessage('trust: ' + user.trust, '*');
      }

      // Coin requests are only taken from the open plugin's own frame.
      const request = parsePluginRequest(e.data);
      if (request && e.source === iframeRef.current.contentWindow) {
        pluginRequestRef.current(request, e.source);
      }
    });

    // Identity passes coming back from the server, each for the plugin frame
    // that asked (see sendIdentity).
    socket.on('pluginTicket', ({ requestId, ticket } = {}) => {
      const waiting = ticketRequestsRef.current.get(requestId);
      if (!waiting) return;
      ticketRequestsRef.current.delete(requestId);
      if (ticket) replyToPlugin(waiting.win, { copecloud: 'identity', id: waiting.id, ticket });
    });

    socket.on('pluginPayResult', (result) => {
      const pending = pendingPayRef.current;
      if (!pending || result?.requestId !== pending.requestId) return;
      finishPayment(pending, { ok: !!result.ok, receipt: result.receipt, error: result.error });
    });
  }, []);

  // Everything a plugin's coin request needs from the current render — who is
  // logged in, which plugin is open — so the once-registered listener above
  // calls through a ref instead of closing over the first render.
  pluginRequestRef.current = (request, win) => {
    const user = myUserRef.current;
    const appname = openPluginRef.current?.appname;
    if (!appname) return;

    if (request.type === 'requestCoins') {
      replyToPlugin(win, { copecloud: 'coins', id: request.id, coins: user.registered ? (user.coins ?? 0) : null });
      return;
    }

    if (request.type === 'requestIdentity') {
      sendIdentity(appname, win, request.id);
      return;
    }

    // No prompt: the player agreed to wallet access when they opened the
    // plugin. The server checks that grant again before moving anything.
    const fail = (error) => replyToPlugin(win, { copecloud: 'paymentResult', id: request.id, ok: false, error });
    if (request.type === 'invalid') return fail(request.error);
    if (!user.registered) return fail('Log in to pay with coins.');
    if (!wantsWallet(openPluginRef.current)) return fail("This plugin didn't ask for wallet access. Add the wallet permission in its settings.");
    if (!isTrusted(appname)) return fail("You haven't given this plugin wallet access.");
    if (pendingPayRef.current) return fail('Another payment is still waiting.');

    const pending = {
      requestId: Math.random().toString(36).slice(2),
      id: request.id,
      appname,
      amount: request.amount,
      memo: request.memo,
      win,
    };
    pendingPayRef.current = pending;
    sendPayment(pending);
  };

  function sendPayment(pending) {
    socket.emit('pluginPay', {
      requestId: pending.requestId,
      appname: pending.appname,
      amount: pending.amount,
      memo: pending.memo,
    });
    // Don't leave the plugin waiting forever on a socket that dropped. If the
    // payment did go through, the balance shows it.
    setTimeout(() => {
      if (pendingPayRef.current === pending) {
        finishPayment(pending, { ok: false, error: 'No answer from the server. Check your balance before trying again.' });
      }
    }, PAYMENT_TIMEOUT_MS);
  }

  function finishPayment(pending, result) {
    if (pendingPayRef.current === pending) pendingPayRef.current = null;
    replyToPlugin(pending.win, { copecloud: 'paymentResult', id: pending.id, ...result });
  }

  // Ask the server for an identity pass for this plugin and hand it to the
  // plugin's frame, which gives it to copecloud so the plugin's server knows
  // who is on its socket (see src/pluginIdentity.js on the server). `id` is the
  // frame's own request id, or null when we're telling it unasked.
  function sendIdentity(appname, win, id) {
    const requestId = Math.random().toString(36).slice(2);
    ticketRequestsRef.current.set(requestId, { win, id });
    socket.emit('pluginTicket', { requestId, appname });
  }

  // A nick change (a guest's /nick, a login) would leave the plugin's server
  // with the old name, so the open plugin gets a fresh pass. The frame's own
  // request covers the first one.
  const lastIdentityRef = useRef(null);
  useEffect(() => {
    const appname = openPluginRef.current?.appname;
    const win = iframeRef.current?.contentWindow;
    const key = appname + '\n' + myUser?.nick;
    if (!appname || !win || !myUser?.nick) return;
    if (lastIdentityRef.current && lastIdentityRef.current.appname === appname && lastIdentityRef.current.key !== key) {
      sendIdentity(appname, win, null);
    }
    lastIdentityRef.current = { appname, key };
  }, [myUser?.nick, showApp]);

  // Tell the open plugin whenever the viewer's balance changes (tools.onCoins),
  // so it doesn't have to guess when a payout has landed: its own result and
  // the chat's balance update travel separate paths and can arrive either way
  // round. It reveals nothing tools.getCoins() doesn't.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || !myUser?.registered) return;
    replyToPlugin(iframe.contentWindow, { copecloud: 'coinsChanged', coins: myUser.coins ?? 0 });
  }, [myUser?.coins, myUser?.registered]);

  // Fetch the account's trusted plugins once we know who they are.
  useEffect(() => {
    if (myUser?.registered) requestTrustList();
  }, [myUser?.registered, myUser?.nick]);

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

  // Reopening the bar should bring back what you last had open rather than
  // nothing, so remember it while it is up.
  useEffect(() => { if (showApp) lastAppRef.current = showApp; }, [showApp]);

  const openPlugin = plugins.find(p => p.appname === showApp) || null;
  openPluginRef.current = openPlugin;

  // A plugin that asks for wallet access doesn't load until a logged-in viewer
  // has agreed to it (PluginConsentDialog). Guests have no wallet to grant, so
  // it opens for them as is. Until we know who this is and what they've
  // already agreed to, nothing is shown, so nobody is asked twice.
  const needsWallet = wantsWallet(openPlugin);
  const consentUnknown = needsWallet && (!myUser || (myUser.registered && !trustLoaded));
  const needsConsent = needsWallet && !consentUnknown && myUser.registered
    && !trustedPlugins.includes(openPlugin.appname);
  const openMode = openPlugin && !consentUnknown && !needsConsent
    ? resolveMode(openPlugin, modeOverrides) : null;

  // The plugin that asked is gone once the viewer closes or switches away; its
  // answer (if the server still sends one) has nowhere to go, and the next
  // plugin shouldn't be blocked behind it.
  useEffect(() => {
    const pending = pendingPayRef.current;
    if (pending && pending.appname !== showApp) pendingPayRef.current = null;
  }, [showApp]);

  // A viewer moving a plugin overrides its author's default, for them only.
  function setPluginMode(appname, mode) {
    setModeOverrides(prev => {
      const next = { ...prev, [appname]: mode };
      writeOverrides(next);
      return next;
    });
  }

  function togglePluginPanel() {
    setShowApp(open => open ? null : (lastAppRef.current || plugins[0]?.appname || null));
  }

  const pluginProps = openPlugin && {
    pluginName: openPlugin.appname,
    owner: openPlugin.owner,
    copeCloud: COPE_PLUGINS,
    giveRefresh: (refresh) => { window._refreshIframe = refresh; },
    giveIframe: (iframe) => { iframeRef.current = iframe; },
    onClose: () => setShowApp(null),
    trusted: trustedPlugins.includes(openPlugin.appname),
    // Taking wallet access back closes the plugin; opening it again asks again.
    onRevokeTrust: () => {
      setPluginTrusted(openPlugin.appname, false);
      setShowApp(null);
    },
  };

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

      {needsConsent ? (
        <PluginConsentDialog
          appname={openPlugin.appname}
          owner={openPlugin.owner}
          onAllow={() => setPluginTrusted(openPlugin.appname, true)}
          onDecline={() => setShowApp(null)}
        />
      ) : null}

      <div id='main-container'>

        {showPluginBar ? (
          <div className="sideBar">
            <div className="appViewToggle" onClick={togglePluginPanel}>
              <span className="material-symbols-outlined">code</span>
            </div>
            <div className='pluginSelectionContainer'>
              {plugins.map((plugin) => (
                <div
                  key={plugin.appname}
                  title={plugin.appname}
                  className={'pluginSelect' + (plugin.appname === showApp ? ' pluginSelectActive' : '')}
                  onClick={() => setShowApp(plugin.appname)}
                >
                  {plugin.appname.slice(0, 2) + plugin.appname.slice(-2)}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {openMode === 'sidebar' ? (
          <CodeRunWindow
            socket={socket}
            userlist={userlist}
            focusOnCode={false}
            draggingWindow={false}
            onPopOut={() => setPluginMode(openPlugin.appname, 'floating')}
            {...pluginProps}
          />
        ) : null}

        {openMode === 'floating' ? (
          <PluginWindow
            onDock={() => setPluginMode(openPlugin.appname, 'sidebar')}
            {...pluginProps}
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
