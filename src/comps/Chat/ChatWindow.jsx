import Messages from './Messages';
import InputBar from './InputBar';
import Menu, { Overlay } from './../Menu';

class ChatWindow extends React.Component {

  constructor() {
    super();
    this.state = {
      messages: [],
      showUsers: true,
      showOverlay: false,
      previewMessage: '',
      selectedList: 'users',
      themecolors: {},
      //toggles
      toggles: {
        background: true
      }
    }

    this.toggleOverlay = this.toggleOverlay.bind(this);

    this.blurred = false;
    this.unreadMessages = 0;
  }

  componentDidMount() {

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.blurred = true;
      } else {
        this.blurred = false;
        this.unreadMessages = 0;
        document.title = 'Cope.chat - The chat that always copes';
      }
    });

    this.props.socket.onDisconnect((reason) => {
      console.log('disconnected', reason);
      const oldMessages = [...this.state.messages];
      oldMessages.push({
        message: 'You have been disconnected from the server.',
        type: 'error',
      })

      this.setState({ messages: oldMessages });
    });

    this.props.socket.on('userStyle', (data) => {
      console.log(data);
    });

    this.props.socket.on('message', (data) => {
      const oldMessages = [...this.state.messages];
      data.type = data.messageType;

      console.log(data);

      oldMessages.push(data)

      if (this.blurred) {
        this.unreadMessages++;
        document.title = (this.unreadMessages ? `(${this.unreadMessages}) ` : '') + 'Cope.chat - The chat that always copes';
      }

      this.setState({ messages: oldMessages });
    })

    this.props.socket.on('channelInfo', (channelInfo) => {
      console.log(channelInfo);
      const oldMessages = [...this.state.messages];

      const messageLog = channelInfo.message_log.reverse().map(a => {
        return {
          message: a.message,
          type: a.messageType,
          count: a.count,
          nick: a.nick,
          flair: a.flair,
          hat: a.hat,
          time: a.time?Number(a.time) : undefined
        }
      });

      oldMessages.push(...messageLog);

      if (channelInfo.note) {
        oldMessages.push({
          message: channelInfo.note,
          type: 'note',
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

      const parsedChannelData = store.handleStates(channelInfo);
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

        if (key == 'topic') {
          this.addMessage({
            message: 'Topic: ' + value,
            type: 'general',
            count: Math.random()
          });
        }

        if (typeof value == 'object') {
          this.setState({ [key]: { ...this.state[key], ...value } });
        } else {
          this.setState({ [key]: value });
        }

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

  toggleStateChange (attr, state) {
    console.log(this)
    const toggles = {...this.state.toggles};
    toggles[attr] = state;

    this.setState({ toggles });
  }

  render() {
    if (!this.props.focusOnChat) return;

    return (
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        <div className='chatContainer'>

          <div className="chatHeader" style={{
            backgroundColor: this.state.themecolors.topbarpri ? this.state.themecolors.topbarpri : '',
          }}>
            
            <div className='channelNameHeader'>
              {'/' + this.props.channelName}
            </div>

            <div className='topic'>{this.state.topic}</div>

            <div className='topBarBtns'>

              <span className="material-symbols-outlined" onClick={() => this.setState({ selectedList: 'settings' })}>settings</span>

              <span className={`material-symbols-outlined toggleUsers`} onClick={() => this.setState({ selectedList: 'users' })}>
                {this.state.showUsers ? 'group' : 'group'}
              </span>

            </div>

          </div>

          <Messages
            emojis={this.state.emojis}
            socket={this.props.socket}
            getUserFlair={this.getUserFlair.bind(this)}
            messages={this.state.messages}
            background={this.state.toggles.background ? this.state.background : '#000'}
            user={this.props.user}
          >
            {
              this.state.showOverlay ?
                <Overlay
                  type={this.state.showOverlay}
                /> : null
            }
          </Messages>


          <InputBar
            emoji={this.state.emojis}
            socket={this.props.socket}
            channelName={this.props.channelName}
            addMessage={this.addMessage.bind(this)}
            user={this.props.user}
            userlist={this.props.userlist}
            store={this.props.store}
            themeColor={this.state.themecolors.inputbar}
          />

        </div>

        {
          this.state.showUsers ?
            <Menu
              socket={this.props.socket}
              userlist={this.props.userlist}
              toggleOverlay={this.toggleOverlay}
              activeList={this.state.selectedList}
              toggleStateChange={this.toggleStateChange.bind(this)}
              toggles={this.state.toggles}
              themeColor={this.state.themecolors.menupri}
            /> : null
        }

      </div>
    )

  }

}

export default ChatWindow;