import { useState, useRef, useEffect } from 'react';
import Messages from './Messages';
import InputBar from './InputBar';
import Menu, { Overlay } from './../Menu';

const CHAT_STATE_KEYS = new Set(['background', 'topic', 'centermsg', 'themecolors', 'emojis', 'hats']);

function ChatWindow({ socket, userlist, bridgeNicks, channelName, user, focusOnChat, store }) {
  const [messages, setMessages] = useState([]);
  const [showUsers] = useState(true);
  const [showOverlay, setShowOverlay] = useState(false);
  const [selectedList] = useState('users');
  const [toggles, setToggles] = useState(() => ({
    background: store.get('toggle-background'),
    bubbles: store.get('toggle-bubbles'),
    centermsg: store.get('toggle-centermsg'),
  }));
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

    socket.onDisconnect((reason) => {
      console.log('disconnected', reason);
      setMessages(prev => [...prev, { message: 'You have been disconnected from the server.', type: 'error' }]);
    });

    const offMessage = socket.on('message', (data) => {
      const msg = { ...data, type: data.messageType };
      if (blurredRef.current) {
        unreadRef.current++;
        document.title = `(${unreadRef.current}) Cope.chat - The chat that always copes`;
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
        time: a.time ? Number(a.time) : undefined
      }));

      const extra = [];
      if (channelInfo.note) extra.push({ message: channelInfo.note, type: 'note', count: 'note' });
      if (channelInfo.topic) extra.push({ message: 'Topic: ' + channelInfo.topic, type: 'general', count: 'topic' });

      setMessages(prev => [...prev, ...messageLog, ...extra]);

      const parsed = store.handleStates(channelInfo);
      setChannelState(prev => ({ ...prev, ...parsed }));
    });

    const offUserJoin = socket.on('userJoin', (user) => {
      setMessages(prev => [...prev, { message: user.nick + ' has joined', type: 'general', count: Math.random() }]);
    });

    const offSetState = socket.on('setState', (data) => {
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
      fetch('/channel/messages/' + range)
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

  function toggleStateChange(attr, state) {
    setToggles(prev => {
      const next = { ...prev, [attr]: state };
      store.setState('toggle-background', next.background);
      store.setState('toggle-bubbles', next.bubbles);
      store.setState('toggle-centermsg', next.centermsg);
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
      <div className={'chatContainer' + (toggles.bubbles ? ' bubbleMessage' : '')}>

        <div className="chatHeader" style={{ backgroundColor: channelState.themecolors.topbarpri || '' }}>
          <div className='topic'>{channelState.topic}</div>
          <div className='topBarBtns'></div>
        </div>

        <div className='chatBox'>
          <div className='messageBackground' style={{ background: toggles.background ? channelState.background : '#000' }}>
            {toggles.centermsg ? <div id="center-text">{channelState.centermsg}</div> : null}
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
          themeColor={channelState.themecolors.inputbar}
        />
      </div>

      {showUsers ? (
        <Menu
          socket={socket}
          userlist={userlist}
          bridgeNicks={bridgeNicks}
          toggleOverlay={toggleOverlay}
          activeList={selectedList}
          toggleStateChange={toggleStateChange}
          toggles={toggles}
          themeColor={channelState.themecolors.menupri}
          hats={channelState.hats}
        />
      ) : null}
    </div>
  );
}

export default ChatWindow;
