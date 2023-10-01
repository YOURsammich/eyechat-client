import * as React from 'react';

class PM_Window extends React.Component {
  constructor() {
    super();

    this.state = {
      selectedConvo: null,
      conversationList: []
    };

    this.selectConvo = this.selectConvo.bind(this);
    this.getConvoProp = this.getConvoProp.bind(this);
    this.getMessages = this.getMessages.bind(this);
  }

  componentDidMount() {
    const socket = this.props.socket;
    socket.emit('pmRequest', { initialize: true }); // init convos on mount

    socket.on('pmConvos', (convos) => {
      let oldConvos = [...this.state.conversationList];

      const newConvos = convos.map(convo => {
        const me = this.props.getMyNick();
        const convoWith = convo.participant1 === me ? convo.participant2 : convo.participant1;

        return { ...convo, with: convoWith }
      });

      this.setState({ conversationList: [...oldConvos, ...newConvos] });
    })

    socket.on('pmMessage', (messages) => {
      if (!messages) { return }

      const newMessages = messages.map((message) => {
        const timeString = message.time_sent;
        const parsedTimeString = this.parseTimeString(timeString)
        
        return {
          ...message,
          time_sent: parsedTimeString
        }
      })

      this.updateConvo(newMessages)
    });
  }

  updateConvo(messages) {
    const { conversationList } = this.state;
    const idToUpdate = messages[0].convoid;

    const updatedConvos = conversationList.map(convo => {

      if (convo.convoid === idToUpdate) {
        const updatedMessages = convo.messages ? [...convo.messages, ...messages] : messages;
        updatedMessages.sort((a, b) => a.messageid - b.messageid);
        return {
          ...convo,
          messages: updatedMessages,
        };
      }

      return convo
    });

    this.setState({ conversationList: updatedConvos })
  }

  selectConvo(convo) {
    const offset = convo.messages?.length ?? 0;
    if (offset <= 0) {
      this.getMessages(convo.convoid, offset);
    }

    this.setState({ selectedConvo: convo.convoid });
  }

  getMessages(convoid, offset) {
    this.props.socket.emit('pmRequest', { convoid: convoid, offset: offset, initialize: false })
  }

  getConvoProp(prop) {
    const index = this.state.conversationList.findIndex((convo) => convo.convoid === this.state.selectedConvo);
    const convo = this.state.conversationList[index];

    if (prop === 'all') { return convo ?? null }

    return convo[prop] ?? null
  }

  parseTimeString(timeString) {
    const date = new Date(timeString);

    return {
      date: date.toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' }),
      time: date.toLocaleDateString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })
    };
  };

  render() {
    return (
      <div className='convosContainer'>

        <div className='convoHeader'>
          {this.state.selectedConvo ? (
            <>
              <button className='hoverMask convoHeaderButtons material-symbols-outlined' style={{ left: '5px' }} onClick={() => this.setState({ selectedConvo: null })}>chevron_left</button>
              <h3>{`Convo with ${this.getConvoProp('with')}`}</h3>
            </>
          ) : (
            <>
              <h3>Your Conversations</h3>
              <button style={{ right: '5px' }} className='convoHeaderButtons hoverMask material-symbols-outlined' onClick={() => console.log('/pm user message for now')}>chat_add_on</button>
            </>
          )}
        </div>

        {!this.state.selectedConvo ? (
          <PM_List
            conversationList={this.state.conversationList}
            selectConvo={this.selectConvo}
          />
        ) : (
          <PM_Convo
            getConvoProp={this.getConvoProp}
            getMessages={this.getMessages}
            socket={this.props.socket}
          />
        )}

      </div>
    )
  }
}

class PM_List extends React.Component {
  constructor() {
    super();
  }

  render() {
    return (
      <div className='convoContainer'>

        {this.props.conversationList.map((convo, index) => (
          <div key={convo.convoid} className='convoBanner'>

            <div
              className='hoverMask convoBanner'
              onClick={() => this.props.selectConvo(convo)}
            >
              <span>{convo.with}</span>
              <span className='messagePreview'> {convo.last_message} </span>
            </div>

          </div>
        ))}

      </div>
    )
  }
}

class PM_Convo extends React.Component {
  constructor() {
    super();

    this.state = {
      scrollPos: 0
    }

    this.convoRef = React.createRef();
  }

  componentDidMount() {
    const current = this.convoRef.current;

    if (current) {
      this.setState({ scrollPos: current.scrollHeight }, () => {
        current.scrollTop = this.state.scrollPos;
      })
    }
  }

  handleScroll(convo) {
    const current = this.convoRef.current

    if (current.scrollTop === 0) {
      const offset = convo.messages.length ?? 0;
      this.props.getMessages(convo.convoid, offset)
      current.scrollTop += 1
    }
  };

  render() {
    return (
      <div className='pmBody'>

        <div className='convoDetails' ref={this.convoRef} onScroll={() => { this.handleScroll(this.props.getConvoProp('all')) }}>
          {this.props.getConvoProp('messages')?.map((message, index) => (
            <div
              key={message.messageid}
              className={`convoMessage ${message.sender === this.props.getConvoProp('with') ? 'sender' : 'receiever'}`}
            >
              {message.time_sent.time} / {message.receiver}: {message.msg}
            </div>
          ))}
        </div>

        <PM_Input
          socket={this.props.socket}
          convoWith={this.props.getConvoProp('with')}
        />

      </div>
    )
  }
}

class PM_New extends React.Component {
  constructor() {
    super();
  }

  render() {
    return (
      <div>

      </div>
    )
  }
}

class PM_Input extends React.Component {
  constructor() {
    super();

    this.state = {
      convoWith: null
    }

    this.submitValue = this.submitValue.bind(this)
  }

  componentDidMount() {
    this.setState({ convoWith: this.props.convoWith })
  }

  submitValue(event) {
    const comm = { to: this.state.convoWith, message: event.target.value }

    if (event.code === 'Enter') {
      this.props.socket.emit('pmSend', comm)
      event.target.value = null;
    }
  }

  render() {
    return (
      <div className='pmInputBanner'>

        <input
          type='text'
          className='pmInputBar'
          onKeyDown={this.submitValue}
          placeholder='Enter message here...' >
        </input>

      </div>
    )
  }
}



export { PM_Window as PM };
