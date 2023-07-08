import Messages from './Messages';
import InputBar from './InputBar';

class ChatWindow extends React.Component {
  
  constructor () {
    super();

    this.state = {
      messages: []
    }
  }

  componentDidMount () {

    this.props.socket.on('message', (data) => {
      const oldMessages = [...this.state.messages];
      console.log(data)
      oldMessages.push(data)

      this.setState({messages:oldMessages});
    })

    this.props.socket.on('channelInfo', (channelInfo) => {
      console.log(channelInfo);
      const oldMessages = [...this.state.messages];

      const messageLog = channelInfo.messages.reverse().map(a=>{
        return {
          message: a.message,
          type: a.type,
          count: a.count,
          nick: a.nick,
        }
      });

      oldMessages.push(...messageLog);

      oldMessages.push({
        message: channelInfo.info.note,
        type: 'general',
        count: 'note'
      });

      oldMessages.push({
        message: 'Topic: ' + channelInfo.info.topic,
        type: 'general',
        count: 'topic'
      });

      this.setState({messages:oldMessages});
    })

  }

  getUserFlair (nick) {
    const user = this.props.userlist.find(a=> a.nick == nick);
    return user ? user.flairColor : '';
  }

  render () {

    return <div className='chatContainer'>

      {/* <div className="chatHeader">
        <span className="material-symbols-outlined" onClick={()=> this.props.toggleEditor()}>code</span>
      </div> */}

      <Messages 
        socket={this.props.socket}
        getUserFlair={this.getUserFlair.bind(this)}
        messages={this.state.messages}
      />
      <InputBar 
        socket={this.props.socket}
      />

    </div>

  }

}

export default ChatWindow;