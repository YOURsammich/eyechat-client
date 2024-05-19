import * as React from 'react'
import { createRoot } from 'react-dom/client';

import Store from './utils/store';
import socket from './utils/socket'

import ChatWindow from './comps/Chat/ChatWindow';
import Menu from './comps/Menu'
import CodeEditor from './comps/CodeEditor/CodeEditor';
import CodeRunWindow from './comps/CodeRunner/CodeRunWindow';


class App extends React.Component {
  constructor() {
    super();

    this.state = {
      connected: false,
      showApp: false,
      userlist: [],
      activeChannel: 'main',
      chatWidth: 800,
      userID: null,
      focusOn: 'chat',

      //chat states
      messages: [],
    }

    this.getMyNick = this.getMyNick.bind(this)
  }

  _initChatEvents (socket) {

    

  }

  componentDidMount() {
    socket.init({
      getActiveChannel: () => this.state.activeChannel,
    })
      .then(() => {
        this.store = new Store();

        socket.on('userlist', (userlist) => {
          this.setState({ userlist: userlist })
        });

        socket.on('setID', (ID) => {
          this.setState({ userID: ID })
        })

        socket.on('userJoin', (user) => {
          const userlist = [...this.state.userlist];
          userlist.push(user);

          this.setState({ userlist })
        });

        socket.on('userLeft', (user) => {
          const userlist = [...this.state.userlist];
          const index = userlist.findIndex(a => a.id == user.id);
     
          if (index !== -1) {
            userlist.splice(index, 1);
            this.setState({ userlist })
          }
        });

        socket.on('userStateChange', ({ user, stateChange }) => {
          const userlist = [...this.state.userlist];
          const index = userlist.findIndex(a => a.id == user.id);

          if (index !== -1) {
            userlist[index] = { ...userlist[index], ...stateChange };
            this.setState({ userlist })
          }
        });

        socket.on('channelInfo', (channelInfo) => {
          this.store.handleStates(channelInfo);
          console.log(this.store);
        });

        socket.emit('joinChannel');

        this._initChatEvents(socket);

        this.resizeBarRef = React.createRef();

        this.setState({ connected: true }, this.scrollListenerInit.bind(this));
      })
  }

  scrollListenerInit() {
    this.resizeBarRef.current.addEventListener('mousedown', (e) => {
      e.preventDefault();

      this.setState({draggingWindow: true});
    });

    document.addEventListener('mousemove', (e) => {
      if (this.state.draggingWindow) {
        this.setState({ chatWidth: (window.innerWidth - e.clientX) });
      }
    });

    document.addEventListener('mouseup', (e) => {

      this.setState({draggingWindow: false});
    });

  }

  getMyNick() {
    const user = this.state.userlist.find((user) => user.id === this.state.userID);

    return user?.nick;
  }

  render() {
    return this.state.connected ? (

      <div style={{ flexDirection: 'column', display: 'flex', flex: 1, overflow: 'hidden' }}>

        <div id='main-container'>

          <div className="sideBar" style={{display:'none'}}>
            <div className="appViewToggle" onClick={() => this.setState({ showApp: !this.state.showApp })}>
              <span className="material-symbols-outlined">code</span>
            </div>
          </div>
          {
            this.state.showApp ? <CodeEditor
              socket={socket}
              refreshIframe={this.refreshIframe}
              setPlugin={(pluginName) => this.setState({pluginName})}
            /> : null
          }

          <div style={{
            display: 'flex', flexDirection: 'column',
            flex: this.state.showApp ? 'unset' : 1,
            width: this.state.showApp ? (this.state.chatWidth + 'px') : 'unset',
            overflowX: 'hidden'
          }}>

            {
              this.state.showApp ? <div className='chatAppNav'>
                <button onClick={() => this.setState({focusOn:'code'})}>Code runner</button>
                <button onClick={() => this.setState({focusOn:'chat'})}>chat</button>
              </div> : null
            }

            <div className='resizeBar'>
              <div className='resizeHandle' ref={this.resizeBarRef}></div>
            </div>

            
              <ChatWindow
                socket={socket}
                userlist={this.state.userlist}
                conversationList={this.state.conversationList}
                channelName={this.state.activeChannel}
                toggleEditor={() => this.setState({ showApp: !this.state.showApp })}
                editorShown={this.state.showApp}
                getMyNick={this.getMyNick}
                focusOnChat={this.state.focusOn == 'chat'}
              /> 
              
              <CodeRunWindow 
                socket={socket}
                userlist={this.state.userlist}
                giveRefresh={(refresh) => this.refreshIframe = refresh}
                focusOnCode={this.state.focusOn == 'code'}
                draggingWindow={this.state.draggingWindow}
                pluginName={this.state.pluginName}
              />
            
          </div>
        </div>

      </div>
    ) : 'connecting';
  }

}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
