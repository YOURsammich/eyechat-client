import * as React from 'react'
import { createRoot } from 'react-dom/client';

import socket from './../utils/socket'

class App extends React.Component {
  constructor() {
    super();

    this.state = {
      messages: [{
        nick: 'username',
        message: 'this is a test'
      }]
    }
  }

  componentDidMount() {
    socket.init();

    socket.on('message', (data) => {
      const oldMessages = [...this.state.messages];

      oldMessages.push({
        nick: 'sammich',
        message: data.data
      })
      this.setState({messages:oldMessages})
    })
  }

  handleInput(event) {
    const target = event.target;

    if (event.which == 13) {

      socket.emit('message', target.value);

    }
  }

  renderMessage (message) {
    return <div className="message" key={message.message}>
      <div className="nick">{message.nick}: </div>
      <div className="messageContent">{' ' + message.message}</div>
    </div>
  }

  render() {
    return (
      <>
        <div id="message-container">{
          this.state.messages.map(message =>  this.renderMessage(message))
        }</div>

        <div className="input-container" onKeyUp={this.handleInput.bind(this)}>
          <input placeholder="Type anything then press enter." />
        </div>

      </>
    );
  }

}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
