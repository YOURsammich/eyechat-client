import * as React from 'react';

const msgStyles = {
  '*': 'bold',
  '%': 'italic',
  '^': 'bigger',
  '~': 'smaller',
  ')': 'flip',
  '(': 'flop',
  '@': 'blur',
};

const noStyle = {
  noColor: true
};

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
  getColorComp (str, msgStyles) {
    if (msgStyles.noColor) return null;

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

  getSlideShowComp (str) {

    const index = str.indexOf('$$');
    if (index == -1) return null;

    const nextIndex = str.indexOf('$$', index + 2);
    if (nextIndex == -1) return null;

    return {index, strdata: str.slice(index, nextIndex + 2), type: 'slideshow'};

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
    const nextSlideShowComp = this.getSlideShowComp(str, msgStyles);

    const comps = [
      nextSlideShowComp,
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
  parse (str, msgStyles, tracker = {data: '',parent: null,children: []}, depth = 0) {

    if (!tracker) {
      tracker = {data: '',parent: null,children: []};
      console.log('tracker is null');
    }


    if (depth > 5) {
      tracker.children.push({
        data: str,
        parent: tracker,
        children: []
      });
      return tracker;
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
        this.parse(str.slice(currComp.strdata.length), msgStyles, styleLayer, depth - 1);
      } else {

        if (currComp.type == 'style') {
          depth++;
        } 

        this.parse(str.slice(currComp.strdata.length), msgStyles, tracker.children[tracker.children.length - 1], depth);
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

        this.parse(str.slice(nextComp.index), msgStyles, styleLayer, depth - 1);
      } else {
        this.parse(str.slice(nextComp.index), msgStyles, tracker.children[tracker.children.length - 1], depth);
      }

    }

    return tracker;
  }

}

function SlideShow (props) {
  const trimString = props.message.substring(2, props.message.length - 2);
  const slideSegments = trimString.split('$');
  const [slideIndex, setSlideIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setSlideIndex(slideIndex => {
        if (slideIndex == slideSegments.length - 1) return 0;
        return slideIndex + 1;
      });
    }, 2000);
  }, []);

  return <div>{slideSegments[slideIndex]}</div>
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
    <img
    className='emoji'
    onLoad={(e) => {
      if (!loaded) {
        setLoaded(true);
        props._imageLoaded(e.target);
      }
    }}
    onError={(e) => {
      setLoaded(true);
    }}
    src={'/images/emojis/' + emoji.imageName}
  />
  </div>) : props.emojiId
}

function QuoteMsg (props) {

  const [quote, setQuote] = React.useState(null);
  const [quoteVisible, setQuoteVisible] = React.useState(false);

  React.useEffect(() => {
    fetch('/channel/getMessage/' + props.message.data.strdata.slice(2))
    .then(res => res.json())
    .then(res => {
      if (res.error || !res) {
        setQuote(false);

      } else {
        setQuote({
          nick: res.nick,
          message: res.message,
          type: res.messageType,
          messageParsed: messageParser.parse(res.message, msgStyles),
          time: res.time,
        });
      }
    });

  }, []);

  const color = quote ? '' : '#ad0000'
  return <>
    <button className='quote' style={{color:color, position: 'relative'}} onFocus={() => 0} 
      onMouseMove={(e) => {
        //set position of quote
        const quoteContainer = document.querySelector('.quote-container');
        if (quoteContainer) {
          quoteContainer.style.top = (e.clientY - quoteContainer.offsetHeight) + 'px';
          quoteContainer.style.left = e.clientX + 'px';
        }
      }}
      onMouseEnter={() => quote && setQuoteVisible(true)}
      onMouseLeave={() => setQuoteVisible(false)}
    
    >
      {props.message.data.strdata}

    </button>
    {
        quoteVisible ? <div className='quote-container' style={{position: 'absolute'}}>
          
          {props.renderMessage(quote)}

        </div> : null
      }
  </>

}

function LinkMsg (props) {
  const [isLoaded, setLoad] = React.useState(false);

  const message = props.message;
  const href = message.data.strdata;

  //check if href is an image
  const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const imageType = imageTypes.find(type => href.endsWith(type));

  return <a href={href} target='_blank'>{
    imageType ? <div style={{
      display: 'inline-flex',
      alignItems: 'flex-end',
      height: isLoaded ? 'auto' : '200px',
    }}>
      <img src={href} loading='lazy' onLoad={(e) => {
        setLoad(true);
        props._imageLoaded(e.target)
      }} />
    </div> : href
  }</a>;

}

function getCompRender (message, props) {

  switch (true) {
    case typeof message.data == 'string':
      return message.data;
    case message.data.type == 'slideshow':
      return <SlideShow message={message.data.strdata} />;
    case message.data.type == 'link':
      return <LinkMsg message={message} _imageLoaded={image => props._imageLoaded(image)} />;
    case message.data.type == 'emoji':
      return <Emoji emojiId={message.data.strdata} emojis={props.emojis} _imageLoaded={(image) => props._imageLoaded(image)} />;
    case message.data.type == 'quote':
      return <QuoteMsg message={message} renderMessage={props.renderMessage} />;
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
        renderMessage={props.renderMessage}
      /> : null}
    </span>

  });

}

class Messages extends React.Component {
  constructor () {
    super();

    this.state = {
      block: []
    }

    this.cacheMessage = {};

    this.messageCon = React.createRef();

    this.fonts = {};
  }

  componentDidMount () {
    const messageCon = this.messageCon.current;
    messageCon.scrollTo({
      top: messageCon.scrollHeight,
      behavior: 'instant'
    });


    messageCon.addEventListener('scroll', (e) => {
      const target = e.target;
      const scrollBottom = messageCon.scrollTop + messageCon.clientHeight;

      if (target.scrollTop < 50) {
        
        this.props.setViewLog();

        // const oldestMessage = this.props.messages[0];
        // if (oldestMessage && oldestMessage.count > 1) {

        //   const range = (oldestMessage.count - 100) + '-' + (oldestMessage.count - 1);

        //   fetch('/channel/messages/' + range)
        //   .then(res => res.json())
        //   .then(res => {

        //     this.props.setViewLog(res);

        //     // if (res.error || !res) {
        //     //   this.setState({block: [...this.state.block, oldestMessage.count]});
        //     // } else {
        //     //   this.props.addMessage(res);
        //     // }
        //   });
        // }

      }

    });

    this.scrollAccum = 0;

  }

  componentDidUpdate (prevProps, prevState) {
    //check if the messages have changed by comparing message from this.state and prevState
    const oldMessage = this.props.messages[this.props.messages.length - 1];
    const newMessage = prevProps.messages[prevProps.messages.length - 1];

    const messageCon = this.messageCon.current;
    if (oldMessage && newMessage) {
      //console.log('scroll', messageCon.scrollHeight, this.props.messages[this.props.messages.length-1]);
      const newMessageHeight = messageCon.children[messageCon.children.length - 1].offsetHeight;

      //don't scroll if the user has scrolled 50 pixels up
      if (messageCon.scrollTop + messageCon.clientHeight > messageCon.scrollHeight - newMessageHeight - 150) {
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
    } else {
      console.log('no scroll');
    }
  }

  _imageLoaded (image) {
    const messageCon = this.messageCon.current;
    const scrollBottom = messageCon.scrollTop + messageCon.clientHeight;
    if ((messageCon.scrollHeight - scrollBottom) - this.scrollAccum - 150 < image.height) {

      messageCon.scrollTo({
        top: messageCon.scrollHeight,
        behavior: 'instant'
      });
    } else {
      this.scrollAccum += image.height;

      if (this.scrollAccumReset) clearTimeout(this.scrollAccumReset);

      this.scrollAccumReset = setTimeout(() => {
        this.scrollAccum = 0;
      }, 1000);
    }
  }

  renderTimeStamp (msgData) {
    const now = Date.now();
    const msgTime = new Date(msgData.time);
    //check if same day
    const sameDay = now - msgTime < 86400000;

    const shortTime = new Intl.DateTimeFormat("en", {
      dateStyle: (sameDay||!msgData.time) ? undefined : "short",
      timeStyle: "short"
    });

    const nameMentioned = this.props.user?.nick ? 
      (msgData.type == 'chat' && msgData.message.includes(this.props.user.nick))
    : false;

    return <div className='time' title={msgData.count} style={{
      color: nameMentioned ? 'yellow' : ''
    }}>
      {shortTime.format(msgData.time || Date.now()) + ' '}
    </div>
  }

  renderNick (msgData) {
    const flair = messageParser.parse(msgData.flair || msgData.nick, msgStyles);
    const textContent = messageParser.getTextContent(flair);

    const nickEl = <div className='nick'>
      {msgData.hat ? <div className='hat' style={{
        backgroundImage: `url('/images/hats/${msgData.hat}')`,
      }}></div> : null}
      { textContent != msgData.nick ? msgData.nick : <NestMessage message={flair} getMsgCss={this.getMsgCss.bind(this)} /> }{': '}
    </div>

    return nickEl;
  }

  getMsgCss (compName, value) {
    const styles = {
      '/*': { fontWeight: 'bold' },
      '/%': { fontStyle: 'italic' },
      '/^': { fontSize: '1.2em' },
      '/~': { fontSize: '0.8em' },
      '/)': { transform: 'scaleX(-1)', display: 'inline-block' },
      '/(': { transform: 'scaleY(-1)', display: 'inline-block' },
      '/@': { filter: 'blur(5px)', display: 'inline-block' },
      '/-': { textDecoration: 'line-through', display: 'inline-block' },
      '/c-': { backgroundColor: 'black', color: 'white', transform: 'rotate(19deg)', display: 'inline-block' },
      '>':   { color: '#228B22' },
      '/--': { letterSpacing: '0.2em' }

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
    const message = messageParser.parse(msgData.message, 
      msgData.type == 'general' ? noStyle : msgStyles
    ); //parse the message for links and other things

    return <div className='messageContent'>
      <NestMessage
        message={message} 
        emojis={this.props.emojis}
        getMsgCss={this.getMsgCss.bind(this)} 
        _imageLoaded={(image) => this._imageLoaded(image)}
        renderMessage={this.renderMessage.bind(this)}
      />
    </div>
  }

  renderMessage (message) {
    return <div className={'message' + (message.type ? ' ' + message.type : '')} key={message.count}>
      { this.renderTimeStamp(message) }
      { message.type == 'chat' ? this.renderNick(message) : null }
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

        {/* render Messages react children */}

        {this.props.children}
        

        {this.props.messages.map(message => {
          if (!message || !message.message) return null;
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
