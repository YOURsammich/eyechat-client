import * as React from 'react'
import { createRoot } from 'react-dom/client';

import Store from './utils/store';
import socket from './utils/socket'

import ChatWindow from './comps/Chat/ChatWindow';
import Menu from './comps/Menu'
import CodeEditor from './comps/CodeEditor/CodeEditor';
import CodeRunWindow from './comps/CodeRunner/CodeRunWindow';


class App extends React.Component {
  constructor() {
    super();

    this.state = {
      connected: false,
      showApp: false,
      userlist: [],
      activeChannel: 'main',
      chatWidth: 300,
      conversationList: [],
      userID: null
    }

    this.getMyNick = this.getMyNick.bind(this)
    this.findConvo = this.findConvo.bind(this)
  }

  componentDidMount() {
    socket.init({
      getActiveChannel: () => this.state.activeChannel,
    })
      .then(() => {
        this.store = new Store();

        socket.on('userlist', (userlist) => {
          this.setState({ userlist: userlist })
        });

        socket.on('pmConvos', (convos) => {
          console.log('pmConvos start', convos)
          let oldConvos = this.state.conversationList;

          convos.forEach(convo => {
            oldConvos.push(convo);
          });

          this.setState({ conversationList: oldConvos }, () => {
            console.log('pmConvos set', this.state.conversationList);
          })
        })

        socket.on('pmMessage', (messages) => {
          const { conversationList } = this.state;
          const updatedConvoId = messages[0].convoid;

          messages.forEach((message) => {
            const timeString = message.time_sent;
            const newTime = this.parseTimeString(timeString)
            message.time_sent = newTime;
          })

          const updatedConvos = conversationList.map(convo => {
            if (convo.convoid === updatedConvoId) {
              const updatedMessages = convo.messages ? [...convo.messages, ...messages] : messages;
              updatedMessages.sort((a, b) => a.messageid - b.messageid); 
              return {
                ...convo,
                messages: updatedMessages,
              };
            }
            return convo;
          });

          this.setState({ conversationList: updatedConvos }, () => {
          });
        });

        socket.on('setID', (ID) => {
          this.setState({ userID: ID })
        })

        socket.on('userJoin', (user) => {
          const userlist = [...this.state.userlist];
          userlist.push(user);

          this.setState({ userlist })
        });

        socket.on('userLeft', (user) => {
          const userlist = [...this.state.userlist];
          const index = userlist.findIndex(a => a.id == user.id);

          if (index !== -1) {
            userlist.splice(index, 1); base
            this.setState({ userlist })
          }
        });

        socket.on('userStateChange', ({ user, stateChange }) => {
          const userlist = [...this.state.userlist];
          const index = userlist.findIndex(a => a.id == user.id);

          if (index !== -1) {
            userlist[index] = { ...userlist[index], ...stateChange };
            this.setState({ userlist })
          }
        });

        socket.on('channelInfo', (channelInfo) => {
          this.store.handleStates(channelInfo);
          console.log(this.store);
        });

        socket.emit('joinChannel');

        this.resizeBarRef = React.createRef();

        this.setState({ connected: true }, this.scrollListenerInit.bind(this));
      })
  }

  scrollListenerInit() {
    this.draggingWindow = false;

    this.resizeBarRef.current.addEventListener('mousedown', (e) => {
      e.preventDefault();

      this.draggingWindow = true;

      // document.addEventListener('mousemove', this.resizePanel);
      // document.addEventListener('mouseup', this.stopResize);
    });

    document.addEventListener('mousemove', (e) => {
      if (this.draggingWindow) {
        this.setState({ chatWidth: (window.innerWidth - e.clientX) });
      }
    });

    document.addEventListener('mouseup', (e) => {
      this.draggingWindow = false;
    });

  }

  parseTimeString(timeString) {
    const date = new Date(timeString);

    const optionsForDate = { year: 'numeric', month: 'numeric', day: 'numeric' };
    const optionsForTime = { hour: '2-digit', minute: '2-digit', hour12: true };

    const datePart = date.toLocaleDateString(undefined, optionsForDate);
    const timePart = date.toLocaleTimeString(undefined, optionsForTime);

    return {
      date: datePart,
      hhmm: timePart,
    };
  };

  findConvo(convoid) {
    const index = this.state.conversationList.findIndex((convo) => convo.convoid === convoid)
    return this.state.conversationList[index]
  }

  getMyNick() {
    const user = this.state.userlist.find((user) => user.id === this.state.userID);

    return user?.nick;
  }

  render() {
    return this.state.connected ? (

      <div style={{ flexDirection: 'column', display: 'flex', flex: 1, overflow: 'hidden' }}>

        <div id='main-container'>

          <div className="sideBar">
            <div className="appViewToggle" onClick={() => this.setState({ showApp: !this.state.showApp })}>
              <span className="material-symbols-outlined">code</span>
            </div>
          </div>
          {
            this.state.showApp ? <CodeEditor
              socket={socket}
            /> : null
          }

          <div style={{
            display: 'flex', flexDirection: 'row',
            flex: this.state.showApp ? 'unset' : 1,
            width: this.state.showApp ? (this.state.chatWidth + 'px') : 'unset',
            overflowX: 'hidden'
          }}>

            {/* <CodeRunWindow 
              socket={socket}
              userlist={this.state.userlist}
            /> */}

            <div className='resizeBar'>
              <div className='resizeHandle' ref={this.resizeBarRef}></div>
            </div>

            <ChatWindow
              socket={socket}
              userlist={this.state.userlist}
              conversationList={this.state.conversationList}
              channelName={this.state.activeChannel}
              toggleEditor={() => this.setState({ showApp: !this.state.showApp })}
              editorShown={this.state.showApp}
              getMyNick={this.getMyNick}
              findConvo={this.findConvo}
            />
          </div>
        </div>

      </div>
    ) : 'connecting';
  }

}

const root = createRoot(document.getElementById('root'));
root.render(<App />);
