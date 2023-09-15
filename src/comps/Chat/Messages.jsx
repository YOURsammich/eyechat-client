import * as React from 'react';

const msgStyles = {
  '*': 'bold',
  '%': 'italic',
  '^': 'bigger',
}

const messageParser = {

  getTextContent (dataTree, txt = '') {
    dataTree.children.reduce((prev, curr) => {
      if (typeof curr.data == 'string') {
        txt += curr.data;
      };
      return txt;
    }, '');

    
    if (dataTree.children.length > 0) {
      for (let child of dataTree.children) {
        txt = this.getTextContent(child, txt);
      }
    }

    return txt;
  },

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
  getNextEmojiComp (str) {
    const index = str.indexOf(':');
    if (index == -1) return null;

    const nextSpace = str.indexOf(' ', index);
    if (nextSpace == -1 && str[str.length - 1] == ':' && str.length -1 != index) return {index, strdata: str.slice(index), type: 'emoji'};

    if (str[nextSpace - 1] == ':' && ((nextSpace - 1) != index)) return {index: index, strdata: str.slice(index, nextSpace), type: 'emoji'};

    return null;
  },
  getNextQuoteComp (str) {
    const index = str.indexOf('>>');
    if (index == -1) return null;

    const nextSpace = str.indexOf(' ', index);
    if (nextSpace == -1) return {index, strdata: str.slice(index), type: 'quote'};

    return {index: index, strdata: str.slice(index, nextSpace), type: 'quote'};
  },
  getColorComp (str) {

    const colorTypes = [{
      type: 'glow',
      start: '###',
    }, {
      type: 'color',
      start: '#',
    }]

    const colorIndex = colorTypes.reduce((prev, curr) => {
      const index = str.indexOf(curr.start);
      if (index == -1) return prev;

      if (index < prev?.index || prev?.index == -1) return {index, type: curr.type};

      return prev;
    }, {index:-1});

    if (colorIndex.index == -1) return null;

    const hex = str.slice(colorIndex.index).match(/^###([0-9a-f]){6}|^###([0-9a-f]){3}|^#([0-9a-f]){6}|^#([0-9a-f]){3}/i);
    if (!hex) return null;

    const stopPoint = hex[0].length;

    return {index: colorIndex.index, strdata: str.slice(colorIndex.index, stopPoint), type: colorIndex.type};
  },
  getFontComp (str) {
    const index = str.indexOf('$');
    if (index == -1) return null;

    const pipeBreak = str.indexOf('|', index);
    if (pipeBreak == -1) return null;

    return {index: index, strdata: str.slice(index, pipeBreak + 1), type: 'font'};
  },
  getStyleBreaker (str) {
    const index = str.indexOf('|');
    if (index == -1) return null;

    return {index, strdata: '|', type: 'styleBreaker'};
  },

  getNextComp (str, msgStyles) {
    const nextStyleBreaker = this.getStyleBreaker(str);
    const nextStyleComp = this.getNextStyleComp(str, msgStyles);
    const nextLinkComp = this.getNextLinkComp(str, msgStyles);
    const nextEmojiComp = this.getNextEmojiComp(str);
    const nextColorComp = this.getColorComp(str, msgStyles);
    const nextFontComp = this.getFontComp(str, msgStyles);
    const nextQuoteComp = this.getNextQuoteComp(str, msgStyles);

    const comps = [
      nextStyleBreaker, 
      nextQuoteComp, 
      nextFontComp, 
      nextStyleComp, 
      nextLinkComp, 
      nextEmojiComp, 
      nextColorComp
    ].filter(comp => comp != null);
    if (comps.length == 0) return null;

    const nextComp = comps.reduce((prev, curr) => {
      if (curr.index < prev.index) return curr;
      return prev;
    }, {index: Infinity});

    return {index: nextComp.index, strdata: nextComp.strdata, type: nextComp.type};
  },
  getCurrComp (str, msgStyles) {
    const nextComp = this.getNextComp(str, msgStyles);

    if (!nextComp) return null;

    if (nextComp.index == 0) return nextComp;

    return null;
  },
  getStyleParent (dataTree) {

    if (!dataTree.parent) return dataTree;

    if (!['color', 'glow'].includes(dataTree.data.type)) return dataTree;

    if (dataTree.parent) {
      return this.getStyleParent(dataTree.parent);
    } else {
      return null;
    }


  },
  parse (str, msgStyles, tracker = {data: '',parent: null,children: []}) {

    if (!tracker) {
      tracker = {data: '',parent: null,children: []};
      console.log('tracker is null');
    }

    const currComp = this.getCurrComp(str, msgStyles);

    if (currComp) {
      tracker.children.push({
        data: currComp,
        parent: tracker,
        children: []
      });

      if (currComp.type == 'styleBreaker') {
        let styleParent = this.getStyleParent(tracker);
        const styleLayer = (styleParent?.parent) || tracker;
        this.parse(str.slice(currComp.strdata.length), msgStyles, styleLayer);
      } else {
        this.parse(str.slice(currComp.strdata.length), msgStyles, tracker.children[tracker.children.length - 1]);
      }


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

      if (tracker.type != 'styleBreaker') {
        tracker.children.push({
          data: str.slice(0, nextComp.index),
          parent: tracker,
          children: []
        });
      }
      
      if (nextComp.type == 'styleBreaker') {
        let styleParent = this.getStyleParent(tracker);
        const styleLayer = (styleParent?.parent) || tracker;

        this.parse(str.slice(nextComp.index), msgStyles, styleLayer);
      } else {
        this.parse(str.slice(nextComp.index), msgStyles, tracker.children[tracker.children.length - 1]);
      }

    }

    return tracker;
  }

}

function Emoji (props) {
  const [loaded, setLoaded] = React.useState(false);
  const emoji = props.emojis.find(emoji => emoji.id == props.emojiId.replaceAll(':', ''));

  return emoji ? (<div className='emoji' onClick={() => {
    const target = document.querySelector('.input-container textarea');
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const value = target.value;
    const newValue = value.slice(0, start) + ':' + emoji.id + ':' + value.slice(end);
    target.value = newValue;

    target.focus();
    target.selectionStart = start + emoji.id.length + 2;
    target.selectionEnd = start + emoji.id.length + 2;

  }}>
    {loaded ? null : <div style={{height: '64px', width: '64px', display: 'inline-block'}}></div>}
    <img
    className='emoji'
    onLoad={(e) => {
      if (!loaded) {
        setLoaded(true);
      }
    }}
    src={'/images/emojis/' + emoji.imageName}
  />
  </div>) : props.emojiId
}

function QuoteMsg (props) {

  const [quote, setQuote] = React.useState(null);
  const [noQuote, setNoQuote] = React.useState(null);

  React.useEffect(() => {
    fetch('/getMessage/' + props.message.data.strdata.slice(2))
    .then(res => res.json())
    .then(res => {
      if (res.error || !res) {
        setNoQuote(true);
      } else {
        //setQuote(res);
        setNoQuote(false);
      }
    });

  }, []);

  const color = noQuote === null ? '#c7c4bf' : noQuote === false ? '' : '#ad0000'
  return <a className='quote' style={{color:color, position: 'relative'}} onMouseOver={() => {
    console.log(quote);
  }}>
    {props.message.data.strdata}

    {
      quote ? <div className='quote-container' style={{position: 'absolute'}}>
        <div className='quote-nick'>{quote.nick}</div>
        <div className='quote-message'>{quote.message}</div>
      </div> : null
    }

  </a>

}

function LinkMsg (props) {
  const message = props.message;
  const href = message.data.strdata;

  //check if href is an image
  const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const imageType = imageTypes.find(type => href.endsWith(type));

  return <a href={href} target='_blank'>{
    imageType ? <div style={{
      display: 'inline-flex',
      alignItems: 'flex-end',
    }}>
      <img src={href} loading='lazy' onLoad={(e) => props._imageLoaded(e.target)} />
    </div> : href
  }</a>;

}

function getCompRender (message, props) {

  switch (true) {
    case typeof message.data == 'string':
      return message.data;
    case message.data.type == 'link':
      return <LinkMsg message={message} _imageLoaded={image => props._imageLoaded(image)} />;
    case message.data.type == 'emoji':
      return <Emoji emojiId={message.data.strdata} emojis={props.emojis} _imageLoaded={(image) => props._imageLoaded(image)} />;
    case message.data.type == 'quote':
      return <QuoteMsg message={message} />;
    default:
      return null;
  }

}

function NestMessage (props) {
  if (!props.message) return null;

  const messages = props.message.children;
  return messages.map((message, i) => {
    if (message.data?.type == 'styleBreaker') return null;

    return <span key={i} style={props.getMsgCss(message.data?.type, message.data.strdata)}>

      { getCompRender(message, props) }
      
      {message.children.length > 0 ? <NestMessage 
        getMsgCss={props.getMsgCss}
        message={message} 
        emojis={props.emojis}
        _imageLoaded={(image) => props._imageLoaded(image)}
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

    this.fonts = {};
  }

  componentDidUpdate (prevProps, prevState) {
    //check if the messages have changed by comparing message from this.state and prevState
    const oldMessage = this.props.messages[this.props.messages.length - 1];
    const newMessage = prevProps.messages[prevProps.messages.length - 1];

    const messageCon = this.messageCon.current;
    if (oldMessage && newMessage) {

      const newMessageHeight = messageCon.children[messageCon.children.length - 1].offsetHeight;
      // console.log(newMessageHeight, newMessage);

      //don't scroll if the user has scrolled 50 pixels up
      if (messageCon.scrollTop + messageCon.clientHeight > messageCon.scrollHeight - newMessageHeight - 50) {
        messageCon.scrollTo({
          top: messageCon.scrollHeight,
          behavior: document.hasFocus() ? 'smooth' : 'instant'
        });
      }
    } else if (prevProps.messages.length == 0) {
      console.log('inital scroll', messageCon.scrollHeight, this.props.messages[this.props.messages.length-1]);
      messageCon.scrollTo({
        top: messageCon.scrollHeight,
        behavior: 'instant'
      });
    } else {
      console.log('no scroll');
    }
  }

  _imageLoaded (image) {
    const messageCon = this.messageCon.current;
    if (messageCon.scrollTop + messageCon.clientHeight > messageCon.scrollHeight - image.height - 50) {

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
    const textContent = messageParser.getTextContent(flair);
    
    if (textContent != msgData.nick) {
      return <div className='nick'>
        <span>{msgData.nick}{': '}</span>
      </div>
    }

    const nickEl = <div className='nick'>
      { <NestMessage message={flair} getMsgCss={this.getMsgCss.bind(this)} /> }{': '}
    </div>

    return nickEl;
  }

  getMsgCss (compName, value) {
    const styles = {
      '/*': { fontWeight: 'bold' },
      '/%': { fontStyle: 'italic' },
      '/^': { fontSize: '1.2em' }
    }
    
    if (compName == 'color') {
      const color = value;
      return { color };
    } else if (compName == 'glow') {
      const color = value.slice(2);
      return { textShadow: `0px 0px 20px ${color}, 0px 0px 20px ${color}, 0px 0px 20px ${color}, 0px 0px 20px ${color}` };
    } else if (compName == 'font') {
      const fontFamily = value.slice(1, -1);
      if (!this.fonts[fontFamily]) {
        this.fonts[fontFamily] = true;

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=' + fontFamily.replaceAll(' ', '+') + '&display=swap';
        document.head.appendChild(link);
      }

      return { fontFamily };
    }


    return styles[value] || {};
  }

  renderMessageContent (msgData) {
    const message = messageParser.parse(msgData.message, msgStyles); //parse the message for links and other things

    return <div className='messageContent'>
      <NestMessage
        message={message} 
        emojis={this.props.emojis}
        getMsgCss={this.getMsgCss.bind(this)} 
        _imageLoaded={(image) => this._imageLoaded(image)} 
      />
    </div>
  }

  renderMessage (message) {
    return <div className={'message' + (message.type ? ' ' + message.type : '')} key={message.count}>
      { this.renderTimeStamp(message) }
      { !message.type ? this.renderNick(message) : null }
      { this.renderMessageContent(message) }
    </div>
  }

  handleClick (e) {
    const target = e.target;

    if (target.className.includes('time')) {
      const input = document.querySelector('.input-container textarea');
      input.value += '>>' + target.title + ' ';
      input.focus();
    }

  }

  render() {
    return (
      <div id="message-container" ref={this.messageCon} style={{ background: `${this.props.background}` }} onClick={this.handleClick.bind(this)}>

        {this.props.messages.map(message => {
          if (this.cacheMessage[message.count]) return this.cacheMessage[message.count];
          const msg = this.renderMessage(message);
          this.cacheMessage[message.count] = msg;
          return msg;
        })}

      </div>
    )
  }
}

export default Messages;