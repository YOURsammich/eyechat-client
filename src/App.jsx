import * as React from 'react'
import { createRoot } from 'react-dom/client';

import Store from './utils/store';
import socket from './utils/socket'

import ChatWindow from './comps/Chat/ChatWindow';
import Menu from './comps/Menu'
import CodeRunWindow from './comps/CodeRunner/CodeRunWindow';


class App extends React.Component {
  constructor() {
    super();

    this.state = {
      connected: false,
      showApp: false,
      userlist: [],
      activeChannel: 'main',
      chatWidth: 1000,
      userID: null,
      focusOn: 'chat',
      plugins: [],

      //chat states
      messages: [],
    }

    this.getMyUser = this.getMyUser.bind(this)
  }

  _initChatEvents (socket) {

    

  }

  componentDidMount() {
    socket.init({
      getActiveChannel: () => this.state.activeChannel,
    })
      .then(() => {
        this.store = window.store = new Store();

        socket.on('pong', () => socket.emit('ping'));

        socket.on('userlist', (userlist) => {
          this.setState({ userlist: userlist })
        });

        socket.on('setID', (ID) => {
          console.log('setid',this.state.userlist[ID]);
          this.setState({ userID: ID });
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
            this.setState({ userlist });
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

        socket.on('setState', (data) => {
          const key = data[0];
          const value = data[1];
          console.log(data);
          if (this.state.hasOwnProperty(key)) {
    
            if (key == 'topic') {
              this.addMessage({
                message: 'Topic: ' + value,
                type: 'general',
                count: Math.random()
              });
            }
    
            if (typeof value == 'object') {
              this.setState({ [key]: { ...this.state[key], ...value } });
            } else {
              this.setState({ [key]: value });
            }
    
          }
        });

        socket.on('channelInfo', (channelInfo) => {
          this.store.handleStates(channelInfo);
          console.log(channelInfo);

          if (channelInfo.showPluginBar !== undefined) {
            this.setState({ showPluginBar: channelInfo.showPluginBar });
          }

        });

        socket.emit('joinChannel');

        //this._initChatEvents(socket);

        this.setState({ connected: true });

        this.copeCloud = 'https://mentalmeat.cloud/'

        fetch(this.copeCloud + 'getPublicApps')
          .then(res => res.json())
          .then(res => {
            console.log(res);

            this.setState({ plugins: Object.keys(res) })

          })

      })


    window.addEventListener('message', (e) => {

      
      if (e.data == 'requestnick') {
        const myUser = this.getMyUser();

        this.iframe.contentWindow.postMessage('nick: ' + myUser.nick, '*');
      } else if (e.data == 'requesttrust') {
        const myUser = this.getMyUser();

        this.iframe.contentWindow.postMessage('trust: ' + myUser.trust, '*');
      }


    });

  }

  getMyUser() {
    const user = this.state.userlist.find((user) => user.id === this.state.userID);

    return user;
  }

  render() {
    return this.state.connected ? (

      <div style={{ flexDirection: 'column', display: 'flex', flex: 1, overflow: 'hidden' }}>

        <div id='main-container'>


          {
            this.state.showPluginBar ? <div className="sideBar">
              <div className="appViewToggle" onClick={() => this.setState({ showApp: !this.state.showApp })}>
                <span className="material-symbols-outlined">code</span>
              </div>

              <div className='pluginSelectionContainer'>
                {
                  this.state.plugins.map((plugin) => (
                    <div key={plugin} className="pluginSelect" onClick={() => {
                      this.setState({ showApp: plugin })
                    }}>
                      {plugin.slice(0,2) + plugin.slice(-2)}
                    </div>
                  ))
                }
              </div>

            </div> : null
          }
            

          {
            this.state.showApp ? <CodeRunWindow 
              socket={socket}
              userlist={this.state.userlist}
              giveRefresh={(refresh) => this.refreshIframe = refresh}
              focusOnCode={this.state.focusOn == 'code'}
              draggingWindow={this.state.draggingWindow}
              pluginName={this.state.showApp}
              giveIframe={(iframe) => this.iframe = iframe}
              copeCloud={this.copeCloud}
            /> : null
          }

       

          <div style={{
            display: 'flex', flexDirection: 'column',
            flex: 1,
            overflowX: 'hidden'
          }}>
            
              <ChatWindow
                socket={socket}
                userlist={this.state.userlist}
                conversationList={this.state.conversationList}
                channelName={this.state.activeChannel}
                toggleEditor={() => this.setState({ showApp: !this.state.showApp })}
                editorShown={this.state.showApp}
                user={this.getMyUser()}
                focusOnChat={this.state.focusOn == 'chat'}
                store={this.store}
              /> 
              
          </div>
        </div>

      </div>
    ) : 'connecting';
  }

}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
