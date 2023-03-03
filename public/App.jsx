import * as React from 'react'
import { createRoot } from 'react-dom/client';

import socket from './../utils/socket'
socket.init();

import Messages from './comps/Messages'
import Menu from './comps/Menu'

class App extends React.Component {
  constructor() {
    super();

    this.state = {}
  }

  componentDidMount() {
    

  }

  handleInput(event) {
    const target = event.target;

    if (event.which == 13) {

      socket.emit('message', target.value);
      target.value = '';
    }
  }

  render() {
    return (
      <>
        <div id='main-container'>
          <Messages 
            socket={socket}
          />

          <div className="input-container" onKeyDown={this.handleInput.bind(this)}>
            <input placeholder="Type anything then press enter." />
          </div>
        </div>

        <Menu />


      </>
    );
  }

}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
