import * as React from 'react';

class Messages extends React.Component {
  constructor () {
    super();

    this.state = {
      messages: []
    }

    this.messageCon = React.createRef();
  }

  componentDidMount () {
    this.props.socket.on('message', (data) => {
      const oldMessages = [...this.state.messages];

      data.time = this.renderTimeStamp(data)
      data.nick = this.renderNick(data)
      oldMessages.push(data)

      this.setState({messages:oldMessages});
    })
  }

  componentDidUpdate (prevProps, prevState) {
    //check if the messages have changed by comparing message from this.state and prevState
    const oldMessage = this.state.messages[this.state.messages.length - 1];
    const newMessage = prevState.messages[prevState.messages.length - 1];

    if (oldMessage && newMessage && oldMessage.msgCount !== newMessage.msgCount) {
      const messageCon = this.messageCon.current;
      
      //don't scroll if the user has scrolled 50 pixels up
      if (messageCon.scrollTop + messageCon.clientHeight > messageCon.scrollHeight - 50) {
        messageCon.scrollTo({
          top: messageCon.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  }

  renderTimeStamp (msgData) {
    const shortTime = new Intl.DateTimeFormat("en", {
      timeStyle: "short",
    });

    return <div className='time' title={msgData.msgCount}>{shortTime.format(Date.now())} </div>
  }

  renderNick (msgData) {
    return <div className='nick' style={{color: this.props.getUserFlair(msgData.nick)}}>{msgData.nick + ': '}</div>
  }

  renderMessage (message) {
    return <div className="message" key={message.msgCount}>
      { message.time }
      { message.nick }
      <div className="messageContent">{message.message}</div>
    </div>
  }

  render () {
    return <div id="message-container" ref={this.messageCon}>
      { this.state.messages.map(message => this.renderMessage(message)) }
    </div>
  }
}

export default Messages;