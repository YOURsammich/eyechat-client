import * as React from 'react'
import { createRoot } from 'react-dom/client';

import socket from './../utils/socket'
socket.init();

import Messages from './comps/Messages'
import Menu from './comps/Menu'
import InputBar from './comps/InputBar'

class App extends React.Component {
  constructor() {
    super();

    this.state = {
      connected: false
    }
  }

  componentDidMount() {
    
    socket.init()
      .then(() => {
        socket.emit('joinChannel');
        this.setState({connected: true})
      })

  }

  render() {
    return this.state.connected ? (
      <>
        <div id='main-container'>
          <Messages 
            socket={socket}
          />

          <InputBar
            socket={socket}
          />
        </div>

        <Menu 
          socket={socket}
        />
      </>
    ) : 'connecting';
  }

}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
