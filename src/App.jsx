import { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

import Store from './utils/store';
import socket from './utils/socket';

import ChatWindow from './comps/Chat/ChatWindow';
import CodeRunWindow from './comps/CodeRunner/CodeRunWindow';

const COPE_CLOUD = 'http://localhost:8080/';

function App() {
  const [connected, setConnected] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const [showPluginBar, setShowPluginBar] = useState(false);
  const [userlist, setUserlist] = useState([]);
  const [userID, setUserID] = useState(null);
  const [plugins, setPlugins] = useState([]);
  const [bridgeNicks, setBridgeNicks] = useState([]);

  const storeRef = useRef(null);
  const iframeRef = useRef(null);

  const myUser = userlist.find(u => u.id === userID);

  useEffect(() => {
    socket.init({ getActiveChannel: () => 'main' }).then(() => {
      storeRef.current = window.store = new Store();

      socket.on('pong', () => socket.emit('ping'));

      socket.on('userlist', (list) => setUserlist(list));

      socket.on('bridgeNicks', (nicks) => setBridgeNicks(nicks));

      socket.on('setID', (id) => setUserID(id));

      socket.on('userJoin', (user) => {
        setUserlist(prev => [...prev, user]);
        fetch('/set-nick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nick: user.nick })
        });
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

      socket.emit('joinChannel');
      setConnected(true);

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

  if (!connected) return 'connecting';

  return (
    <div style={{ flexDirection: 'column', display: 'flex', flex: 1, overflow: 'hidden' }}>
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
            bridgeNicks={bridgeNicks}
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
