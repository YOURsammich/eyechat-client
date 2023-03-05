import * as React from 'react';


class Messages extends React.Component {
  constructor () {
    super();

    this.state = {
      messages: []
    }
  }

  componentDidMount () {
    this.props.socket.on('message', (data) => {
      console.log(data);
      const oldMessages = [...this.state.messages];

      oldMessages.push(data)
      this.setState({messages:oldMessages})
    })
  }

  renderMessage (message) {
    return <div className="message" key={message.msgCount}>
      <div className="nick">{message.nick}: </div>
      <div className="messageContent">{message.message}</div>
    </div>
  }

  render () {

    return <div id="message-container">
      { this.state.messages.map(message => this.renderMessage(message)) }
    </div>

  }
}

export default Messages;