import { useState, useRef, useEffect } from 'react';
import Messages, { ParsedContent } from './Messages';
import InputBar from './InputBar';
import Menu, { Overlay } from './../Menu';
import FluidBackground from './FluidBackground';
import SearchBar from './SearchBar';
import UnoPanel from './../Uno/UnoPanel';

const CHAT_STATE_KEYS = new Set(['background', 'topic', 'centermsg', 'themecolors', 'emojis', 'hats']);

// Sound played when your nick is mentioned in a new chat message.
const mentionAudio = typeof Audio !== 'undefined' ? new Audio('/audio/Bwoop.wav') : null;

function ChatWindow({ socket, userlist, channelName, user, focusOnChat, store }) {
  const [messages, setMessages] = useState([]);
  const [showUsers] = useState(true);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showFluid, setShowFluid] = useState(false);
  const [fluidPalette, setFluidPalette] = useState(0);
  const [showUno, setShowUno] = useState(false);
  const [mobileUsers, setMobileUsers] = useState(false);
  const [selectedList] = useState('users');
  const [toggles, setToggles] = useState(() => ({
    background:    store.get('toggle-background'),
    avatars:       store.get('toggle-avatars') !== false,
    bubbles:       store.get('toggle-bubbles'),
    centermsg:     store.get('toggle-centermsg'),
    mentionSound:  store.get('toggle-mention-sound') !== false,
  }));
  const [layout, setLayout] = useState(() => store.get('layout') || 'classic');
  const [channelState, setChannelState] = useState({
    background: '',
    topic: '',
    centermsg: '',
    themecolors: {},
    emojis: [],
    hats: [],
  });

  const blurredRef = useRef(false);
  const unreadRef = useRef(0);
  const pendingFetchRef = useRef(false);

  // The message handler is registered once, so read the latest nick / toggle
  // through refs instead of the stale values captured at mount.
  const userNickRef = useRef(user?.nick);
  const mentionSoundRef = useRef(toggles.mentionSound);
  useEffect(() => { userNickRef.current = user?.nick; }, [user?.nick]);
  useEffect(() => { mentionSoundRef.current = toggles.mentionSound; }, [toggles.mentionSound]);

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
      setMessages(prev => [...prev, { message: 'Connection lost. Reconnecting…', type: 'error', count: Math.random() }]);
    });

    const offReconnect = socket.onReconnect(() => {
      setMessages(prev => [...prev, { message: 'Reconnected.', type: 'general', count: Math.random() }]);
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
        data.messageType === 'chat' && data.nick !== nick &&
        typeof data.message === 'string' && data.message.includes(nick)
      ) {
        try { mentionAudio.currentTime = 0; mentionAudio.play().catch(() => {}); } catch { /* autoplay blocked */ }
      }

      setMessages(prev => [...prev, msg]);
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
        return [...prev, ...incoming];
      });

      // Extract plain string fields before handleStates JSON.parses and possibly
      // converts them to booleans/null (e.g. topic="true" → true, which React won't render)
      const topic = channelInfo.topic ?? '';
      const background = channelInfo.background ?? '';
      const centermsg = channelInfo.centermsg ?? '';

      const parsed = store.handleStates(channelInfo);
      setChannelState(prev => ({ ...prev, ...parsed, topic, background, centermsg }));
    });

    const offUserJoin = socket.on('userJoin', (user) => {
      setMessages(prev => [...prev, { message: user.nick + ' has joined', type: 'general', count: Math.random() }]);
    });

    const offSetState = socket.on('setState', (data) => {
      console.log(data);
      const key = data[0];
      const value = data[1];
      if (!CHAT_STATE_KEYS.has(key)) return;

      if (key === 'topic') {
        setMessages(prev => [...prev, { message: 'Topic: ' + value, type: 'general', count: Math.random() }]);
      }

      setChannelState(prev => ({
        ...prev,
        [key]: typeof value === 'object' ? { ...(prev[key] || {}), ...value } : value
      }));
    });

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      offMessage();
      offChannelInfo();
      offUserJoin();
      offSetState();
      offDisconnect();
      offReconnect();
    };
  }, []);

  useEffect(() => {
    const onFluid = (e) => {
      const secs = e.detail?.duration ?? 30;
      setFluidPalette(e.detail?.palette ?? 0);
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

  function addMessage(message) {
    if (!Array.isArray(message)) message = [message];
    setMessages(prev => [...prev, ...message]);
  }

  function setViewLog() {
    if (pendingFetchRef.current) return;
    pendingFetchRef.current = true;

    setMessages(prev => {
      const oldest = prev[0];
      if (!oldest || oldest.count <= 1) { pendingFetchRef.current = false; return prev; }

      const range = (oldest.count - 100) + '-' + (oldest.count - 1);
      fetch('/channel/messages/' + range + '?channel=' + encodeURIComponent(channelName))
        .then(res => res.json())
        .then(data => {
          for (const m of data) m.type = m.messageType;
          setMessages(current => [...data, ...current]);
          pendingFetchRef.current = false;
        });

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

  function getUserFlair(nick) {
    const u = userlist.find(a => a.nick === nick);
    return u ? u.flairColor : '';
  }

  if (!focusOnChat) return null;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div className={'chatContainer' + (toggles.bubbles ? ' bubbleMessage' : '')} style={{ '--bubble-bg': channelState.themecolors.bubblebg || '' }}>

        <div className="chatHeader" style={{ backgroundColor: channelState.themecolors.topbarpri || '' }}>
          <div className='topic'>{channelState.topic}</div>
          <div className='topBarBtns'>
            <SearchBar channelName={channelName} />
            <span
              className="material-symbols-outlined mobileUsersBtn"
              onClick={() => setMobileUsers(v => !v)}
              title='User list'
            >group</span>
          </div>
        </div>

        <div className='chatBox'>
          <div className='messageBackground' style={{ background: showFluid ? '#000' : (toggles.background ? channelState.background : '#000') }}>
            {showFluid ? <FluidBackground palette={fluidPalette} /> : null}
            {toggles.centermsg ? <div id="center-text"><ParsedContent text={channelState.centermsg} emojis={channelState.emojis} /></div> : null}
          </div>

          <Messages
            emojis={channelState.emojis}
            socket={socket}
            getUserFlair={getUserFlair}
            messages={messages}
            background={toggles.background ? channelState.background : '#000'}
            user={user}
            setViewLog={setViewLog}
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
          themeColor={channelState.themecolors.menupri}
          sidebarColor={channelState.themecolors.sidebar}
          mobileOpen={mobileUsers}
          setMobileOpen={setMobileUsers}
          themecolors={channelState.themecolors}
          channelName={channelName}
          hats={channelState.hats}
          emojis={channelState.emojis}
          user={user}
        />
      ) : null}

      {showUno ? (
        <UnoPanel
          socket={socket}
          user={user}
          onClose={() => setShowUno(false)}
        />
      ) : null}
    </div>
  );
}

export default ChatWindow;
