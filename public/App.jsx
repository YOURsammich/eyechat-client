import * as React from 'react'
import { createRoot } from 'react-dom/client';

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
    this.socket = new WebSocket('wss://' + location.host);

    this.socket.addEventListener('message', (event) => {
      console.log(event);
    });
  }
  handleInput(event) {
    const target = event.target;

    if (event.which == 13) {
      console.log('enter key');

      const messages = [...this.state.messages];
      const newMessage = {
        nick: 'sammich',
        message: target.value
      }

      this.socket.send(target.value);

    }
    console.log(event);
  }

  render() {
    return (
      <>
        <div id="message-container">{
          this.state.messages.map(message => {
            return <div className="message">
              <div className="nick">{message.nick}: </div>
              <div className="messageContent">{' ' + message.message}</div>
            </div>
          })
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
