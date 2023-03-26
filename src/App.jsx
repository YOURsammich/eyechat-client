import * as React from 'react'
import { createRoot } from 'react-dom/client';

import socket from './utils/socket'
socket.init();

import ChatWindow from './comps/Chat/ChatWindow';
import Menu from './comps/Menu'
import CodeEditor from './comps/CodeEditor/CodeEditor';


class App extends React.Component {
  constructor() {
    super();

    this.state = {
      connected: false,
      userlist: []
    }
  }

  componentDidMount() {
    
    socket.init()
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
      <div id='main-container'>

        <CodeEditor 
          socket={socket}
        />
        {false && <ChatWindow 
          socket={socket}
          userlist={this.state.userlist}
        />}
        <Menu 
          userlist={this.state.userlist}
        />

      </div>
    ) : 'connecting';
  }

}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
