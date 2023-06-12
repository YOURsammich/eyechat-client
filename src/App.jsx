import * as React from 'react'
import { createRoot } from 'react-dom/client';

import socket from './utils/socket'
socket.init();

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
      activeChannel: '/main'
    }
  }

  componentDidMount() {
    
    socket.init({
      getActiveChannel: () => this.state.activeChannel,
    })
      .then(() => {
        socket.on('userlist', (userlist) => {
          this.setState({userlist: userlist})
        });

        socket.on('userJoin', (user) => {
          const userlist = [...this.state.userlist];
          userlist.push(user);
    
          this.setState({userlist})
        });

        socket.on('userLeft', (user) => {
          const userlist = [...this.state.userlist];
          const index = userlist.findIndex(a=> a.id == user.id);
    
          if (index !== -1) { 
            userlist.splice(index, 1);
            this.setState({userlist})
          }
        });

        socket.on('userStateChange', ({user, stateChange}) => {
          const userlist = [...this.state.userlist];
          const index = userlist.findIndex(a=> a.id == user.id);

          if (index !== -1) {
            userlist[index] = {...userlist[index], ...stateChange};
            this.setState({userlist})
          }
        });

        socket.emit('joinChannel');

        this.setState({connected: true})
      })

  }

  render() {
    return this.state.connected ? (
      
      <div style={{flexDirection: 'column', display: 'flex', flex: 1, overflow:'hidden'}}>
        <div className="chatHeader">
          <span className="material-symbols-outlined appViewToggle" onClick={()=> this.setState({showApp: !this.state.showApp})}>code</span>
        </div>

        <div id='main-container'>

          {
            this.state.showApp ? <CodeEditor 
              socket={socket}
            /> : null
          }
          
          <div style={{display: 'flex',flexDirection: 'column', flex:1}}>

            {/* <CodeRunWindow 
              socket={socket}
              userlist={this.state.userlist}
            /> */}

            <ChatWindow 
              socket={socket}
              userlist={this.state.userlist}
              toggleEditor={() => this.setState({showApp: !this.state.showApp})}
              editorShown={this.state.showApp}
            />
          </div>
          <Menu 
            userlist={this.state.userlist}
          />

        </div>
      
      </div>
    ) : 'connecting';
  }

}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
