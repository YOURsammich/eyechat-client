import Messages from './Messages';
import InputBar from './InputBar';
import Menu from './../Menu'

class ChatWindow extends React.Component {
  
  constructor () {
    super();
    this.state = {
      messages: [],
      showUsers: true
    }
  }

  componentDidMount () {
    this.props.socket.on('message', (data) => {
      const oldMessages = [...this.state.messages];
      oldMessages.push(data)

      this.setState({messages:oldMessages});
    })

    this.props.socket.on('channelInfo', (channelInfo) => {
      const oldMessages = [...this.state.messages];

      const messageLog = channelInfo.message_log.reverse().map(a=>{
        return {
          message: a.message,
          type: a.type,
          count: a.count,
          nick: a.nick,
          flair: a.flair
        }
      });

      oldMessages.push(...messageLog);

      if (channelInfo.note) {
        oldMessages.push({
          message: channelInfo.note,
          type: 'general',
          count: 'note'
        });
      }

      if (channelInfo.topic) {

        oldMessages.push({
          message: 'Topic: ' + channelInfo.topic,
          type: 'general',
          count: 'topic'
        });
      }


      this.setState({messages:oldMessages, ...channelInfo});
    })

  }

  getUserFlair (nick) {
    const user = this.props.userlist.find(a=> a.nick == nick);
    return user ? user.flairColor : '';
  }

  render () {
    
    return <div className='' style={{ display: 'flex', flex: 1, overflow: 'hidden'}}>
      <div className='chatContainer'>

        <div className="chatHeader">
          <span className='channelName'>{this.props.channelName}</span>
          <span className={`material-symbols-outlined toggleUsers`} onClick={() => this.setState({showUsers: !this.state.showUsers})}>
            {this.state.showUsers ? 'chevron_right' : 'chevron_left'}
          </span>
        </div> 

        <Messages 
          socket={this.props.socket}
          getUserFlair={this.getUserFlair.bind(this)}
          messages={this.state.messages}
        />
        <InputBar 
          emoji={this.state.emojis}
          socket={this.props.socket}
        />
      </div>

      {
        this.state.showUsers ?
        <Menu 
          userlist={this.props.userlist}
        /> : null
      }



    </div>

  }

}

export default ChatWindow;