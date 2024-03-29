import Messages from './Messages';
import InputBar from './InputBar';
import Menu, { Overlay } from './../Menu';
import Store from '../../utils/store';
const storeTtest = new Store();

class ChatWindow extends React.Component {

  constructor() {
    super();
    this.state = {
      messages: [],
      showUsers: true,
      showOverlay: false
    }

    this.toggleOverlay = this.toggleOverlay.bind(this)
  }

  componentDidMount() {
    console.log('ass')

    this.props.socket.onDisconnect((reason) => {
      console.log('disconnected', reason);
      const oldMessages = [...this.state.messages];
      oldMessages.push({
        message: 'You have been disconnected from the server.',
        type: 'error',
      })

      this.setState({ messages: oldMessages });
    });

    this.props.socket.on('message', (data) => {
      const oldMessages = [...this.state.messages];
      oldMessages.push(data)

      this.setState({ messages: oldMessages });
    })

    this.props.socket.on('channelInfo', (channelInfo) => {
      console.log(channelInfo);
      const oldMessages = [...this.state.messages];

      const messageLog = channelInfo.message_log.reverse().map(a => {
        return {
          message: a.message,
          type: a.type,
          count: a.count,
          nick: a.nick,
          flair: a.flair,
          hat: a.hat,
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

      const parsedChannelData = storeTtest.handleStates(channelInfo);
      parsedChannelData.messages = oldMessages

      this.state.messages = oldMessages;
      this.setState(parsedChannelData);
    })

    this.props.socket.on('userJoin', (user) => {
      const oldMessages = [...this.state.messages];
      oldMessages.push({
        message: user.nick + ' has joined',
        type: 'general',
        count: Math.random()
      })

      this.setState({ messages: oldMessages });
    });

    this.props.socket.on('setState', (data) => {
      const key = data[0];
      const value = data[1];

      if (this.state.hasOwnProperty(key)) {
        this.setState({ [key]: value });
      }
    })
  }

  addMessage(message) {
    const oldMessages = [...this.state.messages];
    oldMessages.push(message);
    this.setState({ messages: oldMessages });
  }

  getUserFlair(nick) {
    const user = this.props.userlist.find(a => a.nick == nick);
    return user ? user.flairColor : '';
  }

  toggleOverlay(id) {
    const toggle = (id === this.state.showOverlay)

    if (toggle) {
      this.setState({ showOverlay: false })
    } else {
      this.setState({ showOverlay: id })
    }
  }

  render() {
    if (!this.props.focusOnChat) return;

    return (
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        <div className='chatContainer'>

          <div className="chatHeader">
            <div className='topic'>{this.state.topic}</div>
            <div className='channelNameHeader'>
              {'/' + this.props.channelName}
            </div>

            <div className='topBarBtns'>

              <span className="material-symbols-outlined" onClick={this.toggleOverlay.bind(this, 'settings')}>settings</span>

              <span className="material-symbols-outlined">person</span>

              <span className={`material-symbols-outlined toggleUsers`} onClick={() => this.setState({ showUsers: !this.state.showUsers })}>
                {this.state.showUsers ? 'group' : 'group'}
              </span>

            </div>

          </div>

          <Messages
            emojis={this.state.emojis}
            socket={this.props.socket}
            getUserFlair={this.getUserFlair.bind(this)}
            messages={this.state.messages}
            background={this.state.background}
          />
          <InputBar
            emoji={this.state.emojis}
            socket={this.props.socket}
            channelName={this.props.channelName}
            addMessage={this.addMessage.bind(this)}
            getMyNick={this.props.getMyNick}
          />

          {
            this.state.showOverlay ?
              <Overlay
                type={this.state.showOverlay}
              /> : null
          }

        </div>

        {
          this.state.showUsers ?
            <Menu
              userlist={this.props.userlist}
              toggleOverlay={this.toggleOverlay}
            /> : null
        }

      </div>
    )

  }

}

export default ChatWindow;