import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Messages, {
  ParsedContent, mentionsNick,
  clampStyleLimit, setStyleLimit,
  clampMessageHeight, effectiveMessageHeight, setMessageMaxHeight,
} from './Messages';
import InputBar from './InputBar';
import Menu, { Overlay, SUB_MENUS } from './../Menu';
import FluidBackground from './FluidBackground';
import SearchBar from './SearchBar';
import UnoPanel from './../Uno/UnoPanel';
import WhiteboardPanel from './../Whiteboard/WhiteboardPanel';
import ManagerPanel from './../ManagerPanel';
import CommandsPanel from './../CommandsPanel';
import UsersPanel from './../UsersPanel';
import BlockBox from './../BlockBox';
import JumpScare from './JumpScare';

const CHAT_STATE_KEYS = new Set(['background', 'topic', 'centermsg', 'themecolors', 'emojis', 'hats', 'filteredWords']);

// How many messages stay in the DOM. Every one of them is a live React element
// holding parsed markup, images and embeds, so an untrimmed log is a session-long
// memory leak in a busy channel. Past the cap the oldest fall off the top; they
// come back from the server when the user scrolls up (see setViewLog).
export const MAX_RENDERED_MESSAGES = 100;

// Trimming is only safe while the view is pinned to the live end of the log:
// dropping messages off the top moves everything above the viewport, which would
// yank the page out from under someone reading history — and would immediately
// throw away the batch setViewLog just fetched for them. `atBottom` comes from
// the Messages scroll handler.
export function capMessages(list, atBottom) {
  if (!atBottom || list.length <= MAX_RENDERED_MESSAGES) return list;
  return list.slice(list.length - MAX_RENDERED_MESSAGES);
}

// Join/leave display preference (see store 'joinleave'). Decide whether a given
// user's join/leave notice should be shown for the current mode.
function showJoinLeave(mode, user) {
  if (mode === 'none') return false;
  if (mode === 'registered') return !!user.registered;
  return true; // 'all'
}

// Epoch-ms timestamp for the /deepfind panel; blank for a nick that never
// posted from the IP (an account only matched by its registration address).
function formatSeen(ms) {
  if (!ms) return '—';
  return new Date(Number(ms)).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

// Sound played when your nick is mentioned in a new chat message.
const mentionAudio = typeof Audio !== 'undefined' ? new Audio('/audio/Bwoop.wav') : null;

function ChatWindow({ socket, userlist, channelName, user, focusOnChat, store }) {
  const [messages, setMessages] = useState([]);
  const [showUsers] = useState(true);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showFluid, setShowFluid] = useState(false);
  const [fluidPalette, setFluidPalette] = useState(0);
  const [fluidColors, setFluidColors] = useState(null);
  const [showUno, setShowUno] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showBanList, setShowBanList] = useState(false);
  // { target } while the /deepfind panel is open, else null. The target is
  // resolved to an IP server-side (clients are never sent IPs).
  const [deepFind, setDeepFind] = useState(null);
  const [showCope, setShowCope] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  // Who this viewer has blocked: [{ nick, expires }], owned by the server and
  // pushed on join and on every change.
  const [blocks, setBlocks] = useState([]);
  // { nick, offered } while the block box is up, else null. `offered` marks the
  // box a moderator's /separate raised, as opposed to one the user asked for.
  const [blockOffer, setBlockOffer] = useState(null);
  const [mobileUsers, setMobileUsers] = useState(false);
  // Which menu section the mobile overlay should show, and whether the "more"
  // dropdown of extra sections is open. Desktop uses the quickNav bar instead.
  const [mobileSection, setMobileSection] = useState('users');
  // A request from outside the side menu to show one of its sections. See
  // openMenuSection / Menu's requestSection prop.
  const [menuRequest, setMenuRequest] = useState({ section: null, nonce: 0 });
  const [mobileMore, setMobileMore] = useState(false);
  const moreRef = useRef(null); // the ⋮ button (anchor)
  const moreMenuRef = useRef(null); // the portaled dropdown (rendered in body)
  const [morePos, setMorePos] = useState({ top: 51, right: 8 });
  const [selectedList] = useState('users');
  const [toggles, setToggles] = useState(() => ({
    background:    store.get('toggle-background'),
    avatars:       store.get('toggle-avatars') !== false,
    bubbles:       store.get('toggle-bubbles'),
    centermsg:     store.get('toggle-centermsg'),
    mentionSound:  store.get('toggle-mention-sound') !== false,
  }));
  const [layout, setLayout] = useState(() => store.get('layout') || 'classic');
  const [joinLeave, setJoinLeave] = useState(() => store.get('joinleave') || 'registered');
  // This viewer's own style-nesting cap. The channel sets one too (below); the
  // parser gets whichever is lower, so a user can only tighten what the channel
  // allows, never loosen it.
  const [styleLimit, setStyleLimitPref] = useState(() => clampStyleLimit(store.get('stylelimit')));
  // Same arrangement for how tall a message may render before it's clipped
  // behind a "Show more" toggle (0 = never clip).
  const [msgHeight, setMsgHeightPref] = useState(() => clampMessageHeight(store.get('msgheight')));
  const [channelState, setChannelState] = useState({
    background: '',
    topic: '',
    centermsg: '',
    themecolors: {},
    emojis: [],
    hats: [],
    filteredWords: {},
  });

  const blurredRef = useRef(false);
  const unreadRef = useRef(0);
  const pendingFetchRef = useRef(false);
  // Is the log scrolled to the bottom? Kept up to date by Messages' scroll
  // handler; read by capMessages to decide whether old messages may be dropped.
  const atBottomRef = useRef(true);

  // Why scroll-back stopped, when the server refuses it — reading the archive is
  // vetted-members-only (see requireVetted in src/routes/chat.js). Latched in a
  // ref as well as state: the answer cannot change while the page is open, so
  // one refusal must stop every later scroll to the top from asking again.
  const [scrollbackNotice, setScrollbackNotice] = useState('');
  const scrollbackBlockedRef = useRef(false);

  // The message handler is registered once, so read the latest nick / toggle
  // through refs instead of the stale values captured at mount.
  const userNickRef = useRef(user?.nick);
  const mentionSoundRef = useRef(toggles.mentionSound);
  const joinLeaveRef = useRef(joinLeave);
  // Our own connection id (from setID), used to recognize our own join event so
  // we can still confirm we connected when the join/leave filter would hide it.
  const myIdRef = useRef(null);
  useEffect(() => { userNickRef.current = user?.nick; }, [user?.nick]);
  useEffect(() => { mentionSoundRef.current = toggles.mentionSound; }, [toggles.mentionSound]);
  useEffect(() => { joinLeaveRef.current = joinLeave; }, [joinLeave]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        blurredRef.current = true;
      } else {
        blurredRef.current = false;
        unreadRef.current = 0;
        document.title = 'Cope.chat - The chat that always copes';
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const offDisconnect = socket.onDisconnect((reason) => {
      console.log('disconnected', reason);
      pushMessages({ message: 'Connection lost. Reconnecting…', type: 'error', count: Math.random() });
    });

    const offReconnect = socket.onReconnect(() => {
      pushMessages({ message: 'Reconnected.', type: 'general', count: Math.random() });
    });

    const offMessage = socket.on('message', (data) => {
      const msg = { ...data, type: data.messageType };
      if (blurredRef.current) {
        unreadRef.current++;
        document.title = `(${unreadRef.current}) Cope.chat - The chat that always copes`;
      }

      // Play the mention sound for a new chat message that names us (but not our
      // own messages), unless the user toggled it off.
      const nick = userNickRef.current;
      if (
        mentionAudio && mentionSoundRef.current !== false && nick &&
        data.messageType === 'chat' && data.nick?.toLowerCase() !== nick.toLowerCase() &&
        mentionsNick(data.message, nick)
      ) {
        try { mentionAudio.currentTime = 0; mentionAudio.play().catch(() => {}); } catch { /* autoplay blocked */ }
      }

      pushMessages(msg);
    });

    const offChannelInfo = socket.on('channelInfo', (channelInfo) => {
      const messageLog = channelInfo.message_log.reverse().map(a => ({
        message: a.message,
        type: a.messageType,
        count: a.count,
        nick: a.nick,
        flair: a.flair,
        hat: a.hat,
        avatar: a.avatar ?? null,
        textstyle: a.textstyle ?? null,
        time: a.time ? Number(a.time) : undefined
      }));

      const extra = [];
      if (channelInfo.note) extra.push({ message: channelInfo.note, type: 'note', count: 'note' });
      if (channelInfo.topic) extra.push({ message: 'Topic: ' + channelInfo.topic, type: 'general', count: 'topic' });

      // A reconnect re-fetches recent history via joinChannel; drop anything we
      // already have (by count) so we don't duplicate messages — while still
      // filling any gap that arrived while we were offline.
      setMessages(prev => {
        const seen = new Set();
        for (const m of prev) if (m.count != null) seen.add(m.count);
        const incoming = [...messageLog, ...extra].filter(m => m.count == null || !seen.has(m.count));
        return capMessages([...prev, ...incoming], atBottomRef.current);
      });

      // Extract plain string fields before handleStates JSON.parses and possibly
      // converts them to booleans/null (e.g. topic="true" → true, which React won't render)
      const topic = channelInfo.topic ?? '';
      const background = channelInfo.background ?? '';
      const centermsg = channelInfo.centermsg ?? '';

      if (Array.isArray(channelInfo.blocks)) setBlocks(channelInfo.blocks);

      const parsed = store.handleStates(channelInfo);
      setChannelState(prev => ({ ...prev, ...parsed, topic, background, centermsg }));
    });

    // The server sends the whole list on every change (including from another
    // tab of this account), so it replaces rather than merges.
    const offBlocks = socket.on('blocks', (list) => {
      setBlocks(Array.isArray(list) ? list : []);
    });

    // A moderator ran /separate on this user and someone they're arguing with.
    const offSeparate = socket.on('separateOffer', (data) => {
      if (data?.other) setBlockOffer({ nick: data.other, offered: true });
    });

    const offSetID = socket.on('setID', (id) => { myIdRef.current = id; });

    const offUserJoin = socket.on('userJoin', (user) => {
      if (showJoinLeave(joinLeaveRef.current, user)) {
        pushMessages({ message: user.nick + ' has joined', type: 'general', count: Math.random() });
      } else if (user.id === myIdRef.current) {
        // Our own join was hidden by the filter — still confirm we connected so
        // there's feedback that we're in the channel.
        pushMessages({ message: 'You have joined as ' + user.nick, type: 'general', count: Math.random() });
      }
    });

    const offUserLeft = socket.on('userLeft', (user) => {
      if (!showJoinLeave(joinLeaveRef.current, user)) return;
      pushMessages({ message: user.nick + ' has left: ', userText: user.part || 'bye.', type: 'general', count: Math.random() });
    });

    const offSetState = socket.on('setState', (data) => {
      console.log(data);
      const key = data[0];
      const value = data[1];
      if (!CHAT_STATE_KEYS.has(key)) return;

      if (key === 'topic') {
        pushMessages({ message: 'Topic: ' + value, type: 'general', count: Math.random() });
      }

      setChannelState(prev => {
        // Word filters live-merge: a null value means the filter was removed, so
        // strip it from the map (a plain object-merge can't delete keys).
        if (key === 'filteredWords') {
          const next = { ...(prev.filteredWords || {}) };
          for (const [word, withThis] of Object.entries(value || {})) {
            if (withThis === null) delete next[word];
            else next[word] = withThis;
          }
          return { ...prev, filteredWords: next };
        }
        return {
          ...prev,
          [key]: typeof value === 'object' ? { ...(prev[key] || {}), ...value } : value
        };
      });
    });

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      offMessage();
      offChannelInfo();
      offBlocks();
      offSeparate();
      offSetID();
      offUserJoin();
      offUserLeft();
      offSetState();
      offDisconnect();
      offReconnect();
    };
  }, []);

  useEffect(() => {
    const onFluid = (e) => {
      const secs = e.detail?.duration ?? 30;
      setFluidPalette(e.detail?.palette ?? 0);
      setFluidColors(e.detail?.customColors ?? null);
      setShowFluid(true);
      setTimeout(() => setShowFluid(false), secs * 1000);
    };
    window.addEventListener('fluid', onFluid);
    return () => window.removeEventListener('fluid', onFluid);
  }, []);

  useEffect(() => {
    const onOpen = () => setShowUno(true);
    const onClose = () => setShowUno(false);
    window.addEventListener('uno:open', onOpen);
    window.addEventListener('uno:close', onClose);
    return () => {
      window.removeEventListener('uno:open', onOpen);
      window.removeEventListener('uno:close', onClose);
    };
  }, []);

  useEffect(() => {
    const onOpen = () => setShowWhiteboard(true);
    const onClose = () => setShowWhiteboard(false);
    window.addEventListener('whiteboard:open', onOpen);
    window.addEventListener('whiteboard:close', onClose);
    return () => {
      window.removeEventListener('whiteboard:open', onOpen);
      window.removeEventListener('whiteboard:close', onClose);
    };
  }, []);

  useEffect(() => {
    const onBanList = () => setShowBanList(true);
    const onCope = () => setShowCope(true);
    const onDeepFind = (e) => setDeepFind({ target: e.detail?.target ?? '' });
    const onCommands = () => setShowCommands(true);
    const onRoles = () => setShowRoles(true);
    // /block and the userlist's block button both land here, opening the same
    // box a /separate offer does — minus the "a moderator noticed" framing.
    const onBlock = (e) => {
      const nick = e.detail?.nick;
      if (nick) setBlockOffer({ nick, offered: false });
    };
    window.addEventListener('banlist:open', onBanList);
    window.addEventListener('seecope:open', onCope);
    window.addEventListener('deepfind:open', onDeepFind);
    window.addEventListener('commands:open', onCommands);
    window.addEventListener('roles:open', onRoles);
    window.addEventListener('block:open', onBlock);
    return () => {
      window.removeEventListener('banlist:open', onBanList);
      window.removeEventListener('seecope:open', onCope);
      window.removeEventListener('deepfind:open', onDeepFind);
      window.removeEventListener('commands:open', onCommands);
      window.removeEventListener('roles:open', onRoles);
      window.removeEventListener('block:open', onBlock);
    };
  }, []);

  const blockedNicks = useMemo(
    () => new Set(blocks.map(b => String(b.nick).toLowerCase())),
    [blocks]
  );

  // The server already withholds a blocked user's messages, so this is about the
  // ones we were sent before the block: what's on screen right now, and the older
  // history the scroll-back fetches over REST. Blocking someone mid-argument
  // should take their side of it away, not just stop the next line.
  const visibleMessages = useMemo(() => {
    if (!blockedNicks.size) return messages;
    return messages.filter(m => !m.nick || !blockedNicks.has(String(m.nick).toLowerCase()));
  }, [messages, blockedNicks]);

  // The channel's render caps, as stored (themecolors rows, so they arrive as
  // strings and are absent until a mod sets one), and what we actually render
  // at — the lower of the channel's cap and this viewer's own.
  const channelStyleLimit = clampStyleLimit(channelState.themecolors.stylelimit);
  const channelMsgHeight = clampMessageHeight(channelState.themecolors.msgheight);
  const effectiveMsgHeight = effectiveMessageHeight(msgHeight, channelMsgHeight);

  // Pushed from an effect rather than during render: collapsible messages
  // subscribe to this value (they are cached elements, out of reach of props),
  // and notifying them mid-render would be updating other components while
  // this one renders. The style limit below is read during render instead, so
  // it has to be set the other way round.
  useEffect(() => { setMessageMaxHeight(effectiveMsgHeight); }, [effectiveMsgHeight]);

  // The one way messages get appended: every caller goes through here so the cap
  // is applied in a single place. Hoisted, so the socket handlers registered on
  // mount can call it — it only closes over refs and setMessages, both stable.
  function pushMessages(...items) {
    setMessages(prev => capMessages([...prev, ...items], atBottomRef.current));
  }

  function addMessage(message) {
    if (!Array.isArray(message)) message = [message];
    pushMessages(...message);
  }

  function setViewLog() {
    if (pendingFetchRef.current || scrollbackBlockedRef.current) return;
    pendingFetchRef.current = true;

    setMessages(prev => {
      // The oldest message carrying a real log number, which is not always the
      // first one: join/leave notices count themselves with Math.random() and
      // the note/topic lines use string counts, and once the list is trimmed one
      // of those can end up at the top.
      const oldestCount = prev.map(m => Number(m.count)).find(c => Number.isInteger(c) && c > 0);
      if (!oldestCount || oldestCount <= 1) { pendingFetchRef.current = false; return prev; }

      const range = (oldestCount - 100) + '-' + (oldestCount - 1);
      fetch('/channel/messages/' + range + '?channel=' + encodeURIComponent(channelName))
        .then(res => res.json())
        .then(data => {
          // A batch comes back as an array; a refusal or a bad range comes back
          // as an object. Say why instead of looking like the log simply ends
          // here, and stop asking — a refusal will not change on the next scroll.
          if (!Array.isArray(data)) {
            scrollbackBlockedRef.current = true;
            setScrollbackNotice(data?.message || 'Older messages could not be loaded.');
            return;
          }
          for (const m of data) m.type = m.messageType;
          setMessages(current => [...data, ...current]);
        })
        // Without this a dropped request would leave the pending flag set and
        // scroll-back dead for the rest of the session.
        .catch(() => {})
        .finally(() => { pendingFetchRef.current = false; });

      return prev;
    });
  }

  function toggleOverlay(id) {
    setShowOverlay(prev => prev === id ? false : id);
  }

  function changeLayout(name) {
    setLayout(name);
    store.setState('layout', name);
  }

  function changeJoinLeave(mode) {
    setJoinLeave(mode);
    store.setState('joinleave', mode);
  }

  function changeStyleLimit(value) {
    const limit = clampStyleLimit(value);
    setStyleLimitPref(limit);
    store.setState('stylelimit', limit);
  }

  function changeMsgHeight(value) {
    const height = clampMessageHeight(value);
    setMsgHeightPref(height);
    store.setState('msgheight', height);
  }

  function toggleStateChange(attr, state) {
    setToggles(prev => {
      const next = { ...prev, [attr]: state };
      store.setState('toggle-background', next.background);
      store.setState('toggle-avatars', next.avatars);
      store.setState('toggle-bubbles', next.bubbles);
      store.setState('toggle-centermsg', next.centermsg);
      store.setState('toggle-mention-sound', next.mentionSound);
      return next;
    });
  }

  // Open the mobile menu overlay to a specific section (from a header button or
  // the "more" dropdown), closing the dropdown.
  function openMobileSection(section) {
    setMobileSection(section);
    setMobileUsers(true);
    setMobileMore(false);
  }

  // Switch the side menu to a section from outside it (the input bar's profile
  // switcher hands off to Cosmetics this way). The nonce makes a repeat request
  // for the section already showing still register, which is what re-opens the
  // panel after it was closed.
  function openMenuSection(section) {
    setMenuRequest(prev => ({ section, nonce: prev.nonce + 1 }));
  }

  // Toggle the "more" dropdown, anchoring it just below the ⋮ button. The menu
  // is portaled to <body>, so its position is measured from the button's rect
  // (fixed, viewport-relative) rather than inherited from the header.
  function toggleMore() {
    if (!mobileMore && moreRef.current) {
      const r = moreRef.current.getBoundingClientRect();
      setMorePos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    }
    setMobileMore(v => !v);
  }

  // Close the "more" dropdown when clicking outside both the button and the
  // (portaled) menu.
  useEffect(() => {
    if (!mobileMore) return;
    function onDoc(e) {
      if (moreRef.current?.contains(e.target)) return;
      if (moreMenuRef.current?.contains(e.target)) return;
      setMobileMore(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [mobileMore]);

  function getUserFlair(nick) {
    const u = userlist.find(a => a.nick === nick);
    return u ? u.flairColor : '';
  }

  if (!focusOnChat) return null;

  // Pushed during render, not from an effect: the parser reads this singleton
  // while the children below render, which happens before an effect would run —
  // so a change would otherwise show one frame at the previous cap.
  setStyleLimit(Math.min(styleLimit, channelStyleLimit));

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <JumpScare socket={socket} />
      <div className={'chatContainer' + (toggles.bubbles ? ' bubbleMessage' : '')} style={{ '--bubble-bg': channelState.themecolors.bubblebg || '' }}>

        <div className="chatHeader" style={{ backgroundColor: channelState.themecolors.topbarpri || '' }}>
          <div className='topic'>{channelState.topic}</div>
          <div className='topBarBtns'>
            <SearchBar channelName={channelName} />
            <span
              className="material-symbols-outlined mobileNavBtn"
              onClick={() => openMobileSection('users')}
              title='User list'
            >group</span>
            <span
              className="material-symbols-outlined mobileNavBtn"
              onClick={() => openMobileSection('settings')}
              title='Settings'
            >settings</span>
            <span
              className="material-symbols-outlined mobileNavBtn"
              ref={moreRef}
              onClick={toggleMore}
              title='More menus'
            >more_vert</span>
            {mobileMore && createPortal(
              <div
                className='mobileMoreMenu'
                ref={moreMenuRef}
                style={{ top: morePos.top, right: morePos.right }}
              >
                {SUB_MENUS.filter(m => m.name !== 'users' && m.name !== 'settings').map(m => (
                  <div className='mobileMoreItem' key={m.name} onClick={() => openMobileSection(m.name)}>
                    <span className="material-symbols-outlined">{m.icon}</span>
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>,
              document.body
            )}
          </div>
        </div>

        <div className='chatBox'>
          <div className='messageBackground' style={{ background: showFluid ? '#000' : (toggles.background ? channelState.background : '#000') }}>
            {showFluid ? <FluidBackground palette={fluidPalette} customColors={fluidColors} /> : null}
            {toggles.centermsg ? <div id="center-text"><ParsedContent text={channelState.centermsg} emojis={channelState.emojis} /></div> : null}
          </div>

          {scrollbackNotice ? <div className='scrollbackNotice'>{scrollbackNotice}</div> : null}

          <Messages
            emojis={channelState.emojis}
            filters={channelState.filteredWords}
            socket={socket}
            getUserFlair={getUserFlair}
            messages={visibleMessages}
            background={toggles.background ? channelState.background : '#000'}
            user={user}
            setViewLog={setViewLog}
            onAtBottomChange={(atBottom) => { atBottomRef.current = atBottom; }}
            centermsg={channelState.centermsg}
            layout={layout}
            showAvatars={toggles.avatars}
          >
            {showOverlay ? <Overlay type={showOverlay} /> : null}
          </Messages>
        </div>

        <InputBar
          emoji={channelState.emojis}
          socket={socket}
          channelName={channelName}
          addMessage={addMessage}
          user={user}
          userlist={userlist}
          store={store}
          channelState={channelState}
          themeColor={channelState.themecolors.inputbar}
          openMenuSection={openMenuSection}
        />
      </div>

      {showUsers ? (
        <Menu
          socket={socket}
          userlist={userlist}
          toggleOverlay={toggleOverlay}
          activeList={selectedList}
          toggleStateChange={toggleStateChange}
          toggles={toggles}
          layout={layout}
          changeLayout={changeLayout}
          joinLeave={joinLeave}
          changeJoinLeave={changeJoinLeave}
          styleLimit={styleLimit}
          changeStyleLimit={changeStyleLimit}
          channelStyleLimit={channelStyleLimit}
          msgHeight={msgHeight}
          changeMsgHeight={changeMsgHeight}
          channelMsgHeight={channelMsgHeight}
          themeColor={channelState.themecolors.menupri}
          sidebarColor={channelState.themecolors.sidebar}
          mobileOpen={mobileUsers}
          setMobileOpen={setMobileUsers}
          mobileSection={mobileSection}
          requestSection={menuRequest}
          themecolors={channelState.themecolors}
          channelName={channelName}
          hats={channelState.hats}
          emojis={channelState.emojis}
          user={user}
          blocks={blocks}
        />
      ) : null}

      {showUno ? (
        <UnoPanel
          socket={socket}
          user={user}
          onClose={() => setShowUno(false)}
        />
      ) : null}

      {showWhiteboard ? (
        <WhiteboardPanel
          socket={socket}
          user={user}
          channelName={channelName}
          onClose={() => setShowWhiteboard(false)}
        />
      ) : null}

      {showBanList ? (
        <ManagerPanel
          title='Ban List'
          onClose={() => setShowBanList(false)}
          loadUrl='/channel/bans'
          deleteUrl='/channel/unban'
          deleteLabel='Unban'
          emptyText='No active bans.'
          confirmText={(b) => `Lift the ban on ${b.account || b.nick || b.remote_addr || 'this user'}?`}
          columns={[
            { label: 'Nick', render: (b) => b.nick || '—' },
            // An account ban survives an IP change; a row with no account doesn't.
            { label: 'Account', render: (b) => b.account || '—' },
            { label: 'IP', render: (b) => b.remote_addr || 'hidden' },
            { label: 'Banned by', render: (b) => b.bannedBy || '—' },
          ]}
        />
      ) : null}

      {deepFind ? (
        <ManagerPanel
          title={`Deep Find — ${deepFind.target}`}
          onClose={() => setDeepFind(null)}
          loadUrl={'/channel/deepfind?target=' + encodeURIComponent(deepFind.target)}
          emptyText='Nothing in the log from this IP.'
          width={560}
          columns={[
            { label: 'Nick', render: (r) => r.nick },
            { label: 'Account', render: (r) => (r.registered ? 'registered' : 'guest') },
            { label: 'Msgs', render: (r) => r.messages },
            { label: 'First seen', render: (r) => formatSeen(r.firstSeen) },
            { label: 'Last seen', render: (r) => formatSeen(r.lastSeen) },
          ]}
        />
      ) : null}

      {showCope ? (
        <ManagerPanel
          title='Magic Cope Ball — Answers'
          onClose={() => setShowCope(false)}
          loadUrl='/channel/cope'
          deleteUrl='/channel/cope/delete'
          deleteLabel='Delete'
          emptyText='No answers submitted yet.'
          confirmText={() => 'Delete this answer?'}
          columns={[
            { label: 'Answer', render: (a) => a.answer },
            { label: 'By', render: (a) => a.nick || '—' },
          ]}
        />
      ) : null}

      {blockOffer ? (
        <BlockBox
          socket={socket}
          nick={blockOffer.nick}
          offered={blockOffer.offered}
          onClose={() => setBlockOffer(null)}
        />
      ) : null}

      {showCommands ? <CommandsPanel onClose={() => setShowCommands(false)} /> : null}

      {showRoles ? <UsersPanel onClose={() => setShowRoles(false)} /> : null}
    </div>
  );
}

export default ChatWindow;
