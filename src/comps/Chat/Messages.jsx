import * as React from 'react';

const msgStyles = {
  '*': 'bold',
  '%': 'italic',
  '^': 'bigger',
}

const messageParser = {

  getNextStyleComp (str, msgStyles) {
    const index = str.indexOf('/');
    if (index == -1) return null;

    const nextCharacter = str[index + 1];
    if (!msgStyles[nextCharacter]) return null;

    return {index, strdata: '/' + nextCharacter, type: 'style'};
  },
  getNextLinkComp (str) { 
    const index = str.indexOf('https://');
    if (index == -1) return null;

    const nextSpace = str.indexOf(' ', index);
    if (nextSpace == -1) return {index, strdata: str.slice(index), type: 'link'};
    return {index: index, strdata: str.slice(index, nextSpace), type: 'link'};
  },
  returnEmoji (str) {
    return;
  },
  getNextEmojiComp (str) {
    const index = str.indexOf(':');
    if (index == -1) return null;

    const nextSpace = str.indexOf(' ', index);
    if (nextSpace == -1 && str[str.length - 1] == ':' && str.length -1 != index) return {index, strdata: str.slice(index), type: 'emoji'};

    if (str[nextSpace - 1] == ':' && ((nextSpace - 1) != index)) return {index: index, strdata: str.slice(index, nextSpace), type: 'emoji'};

    return null;
  },

  getColorComp (str) {
    const index = str.indexOf('#');
    if (index == -1) return null;

    const hex = str.slice(index).match(/^#([0-9a-f]){6}|^#([0-9a-f]){3}/i);
    if (!hex) return null;

    const stopPoint = hex[0].length;
    return {index: index, strdata: str.slice(index, stopPoint), type: 'color'};
  },

  getNextComp (str, msgStyles) {
    const nextStyleComp = this.getNextStyleComp(str, msgStyles);
    const nextLinkComp = this.getNextLinkComp(str, msgStyles);
    const nextEmojiComp = this.getNextEmojiComp(str, msgStyles);
    const nextColorComp = this.getColorComp(str, msgStyles);

    const comps = [nextStyleComp, nextLinkComp, nextEmojiComp, nextColorComp].filter(comp => comp != null);
    if (comps.length == 0) return null;

    const nextComp = comps.reduce((prev, curr) => {
      if (curr.index < prev.index) return curr;
      return prev;
    });

    return {index: nextComp.index, strdata: nextComp.strdata, type: nextComp.type};
  },
  getCurrComp (str, msgStyles) {
    const nextComp = this.getNextComp(str, msgStyles);

    if (!nextComp) return null;

    if (nextComp.index == 0) return nextComp;

    return null;
  },
  parse (str, msgStyles, tracker = {data: '',parent: null,children: []}) {
    const currComp = this.getCurrComp(str, msgStyles);

    if (currComp) {
      tracker.children.push({
        data: currComp,
        parent: tracker,
        children: []
      });

      this.parse(str.slice(currComp.strdata.length), msgStyles, tracker.children[tracker.children.length - 1]);

    } else {//if a component doesn't match, then it's a text component
      const nextComp = this.getNextComp(str, msgStyles);
      if (!nextComp) {
        if (str.length > 0) tracker.children.push({
          data: str,
          parent: tracker,
          children: []
        });
        return tracker
      }

      tracker.children.push({
        data: str.slice(0, nextComp.index),
        parent: tracker,
        children: []
      });
  
      this.parse(str.slice(nextComp.index), msgStyles, tracker.children[tracker.children.length - 1]);
    }

    return tracker;
  }

}

function NestMessage (props) {
  if (!props.message) return null;

  const messages = props.message.children;
  return messages.map((message, i) => {
    return <span key={message.data} style={props.getMsgCss(message.data.strdata)}>
      {/* render text if text comp */}
      {
        typeof message.data == 'string' ? message.data : 
          message.data.type == 'link' ? <a href={message.data.strdata}>{message.data.strdata}</a> : 
            message.data.type == 'emoji' ? <img src={message.data.strdata} /> : null
      }

      
      {message.children.length > 0 ? <NestMessage 
        getMsgCss={props.getMsgCss}
        message={message} 
      /> : null}
    </span>

  });

}

class Messages extends React.Component {
  constructor () {
    super();

    this.state = {}

    this.cacheMessage = {};

    this.messageCon = React.createRef();
  }

  componentDidUpdate (prevProps, prevState) {
    //check if the messages have changed by comparing message from this.state and prevState
    const oldMessage = this.props.messages[this.props.messages.length - 1];
    const newMessage = prevProps.messages[prevProps.messages.length - 1];

    const messageCon = this.messageCon.current;
    if (oldMessage && newMessage && oldMessage.count !== newMessage.count) {
      
      //don't scroll if the user has scrolled 50 pixels up
      if (messageCon.scrollTop + messageCon.clientHeight > messageCon.scrollHeight - 50) {
        console.log('should scroll');
        messageCon.scrollTo({
          top: messageCon.scrollHeight,
          behavior: document.hasFocus() ? 'smooth' : 'instant'
        });
      }
    } else if (prevProps.messages.length == 0) {
      messageCon.scrollTo({
        top: messageCon.scrollHeight,
        behavior: 'instant'
      });
    }
  }

  renderTimeStamp (msgData) {
    const shortTime = new Intl.DateTimeFormat("en", {
      timeStyle: "short",
    });

    return <div className='time' title={msgData.count}>{shortTime.format(Date.now())} </div>
  }

  renderNick (msgData) {
    const flair = messageParser.parse(msgData.flair || msgData.nick, msgStyles);

    return <div className='nick'>
      { <NestMessage message={flair} getMsgCss={this.getMsgCss} /> }{': '}
    </div>
  }

  getMsgCss (compName) {
    const styles = {
      '/*': { fontWeight: 'bold' },
      '/%': { fontStyle: 'italic' },
      '/^': { fontSize: '1.2em' }
    }

    if (compName && compName[0] == '#') {
      const color = compName;
      return { color };
    }

    return styles[compName] || {};
  }

  renderMessageContent (msgData) {
    const message = messageParser.parse(msgData.message, msgStyles); //parse the message for links and other things
    //console.log(message);

    return <div className='messageContent'>
      <NestMessage message={message} getMsgCss={this.getMsgCss} />
    </div>
  }

  renderMessage (message) {
    return <div className={'message' + (message.type ? ' ' + message.type : '')} key={message.count}>
      { this.renderTimeStamp(message) }
      { !message.type ? this.renderNick(message) : null }
      { this.renderMessageContent(message) }
    </div>
  }

  render () {
    return <div id="message-container" ref={this.messageCon}>
      { this.props.messages.map(message => {
        if (this.cacheMessage[message.count]) return this.cacheMessage[message.count];
        const msg = this.renderMessage(message);
        this.cacheMessage[message.count] = msg;
        return msg;
      }) }
    </div>
  }
}

export default Messages;