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
      const oldMessages = [...this.state.messages];

      data.time = this.renderTimeStamp(data)
      oldMessages.push(data)

      this.setState({messages:oldMessages})
    })
  }

  renderTimeStamp (msgData) {
    const shortTime = new Intl.DateTimeFormat("en", {
      timeStyle: "short",
    });

    return <div className='time' title={msgData.msgCount}>{shortTime.format(Date.now())} </div>
  }

  renderMessage (message) {
    return <div className="message" key={message.msgCount}>
      { message.time }
      <div className="nick" style={{color: 'orange'}}>
        {message.nick + ': '}
      </div>
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