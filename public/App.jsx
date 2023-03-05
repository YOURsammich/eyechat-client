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

    this.state = {}
  }

  componentDidMount() {
    

  }

  render() {
    return (
      <>
        <div id='main-container'>
          <Messages 
            socket={socket}
          />

          <InputBar
            socket={socket}
          />
        </div>

        <Menu />


      </>
    );
  }

}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
