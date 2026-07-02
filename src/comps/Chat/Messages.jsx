import * as React from 'react';
import { useEffect } from 'react';
import AvatarDisplay from './AvatarDisplay.jsx';


const msgStyles = {
  '*': 'bold',
  '%': 'italic',
  '^': 'bigger',
  '~': 'smaller',
  ')': 'flip',
  '(': 'flop',
  '@': 'blur',
  '-': 'linethrough',
  ',': 'space-out',
  '.': 'censor stamp',
  '!': 'rainbow',
  '$': 'shake',
  '+': 'spin',
  '_': 'underline',
  '#': 'spolier',
  '&': 'wavy',
  '?': 'cursed'

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

    const nextColon = str.indexOf(':', index+1);
    if (nextColon == -1) return null;

    if (nextColon - 1 != index) return {index, strdata: str.slice(index, nextColon+1), type: 'emoji'};

    //if (str[nextColon] == ':' && ((nextColon - 1) != index)) return {index: index, strdata: str.slice(index, nextColon + 1), type: 'emoji'};

    return null;
  },
  getNextEmojiMergeComp (str) {
    const index = str.indexOf(':');
    if (index == -1) return null;

    const nextColon = str.indexOf(':', index+1);
    if (nextColon == -1) return null;

    if (str[nextColon + 1] != '$') return null;

    const nextIndex = str.indexOf(':', nextColon + 2);
    if (nextIndex == -1) return null;

    const nextEmojiColon = str.indexOf(':', nextIndex + 1);
    if (nextEmojiColon == -1) return null;

    if (nextColon - 1 != index) return {index, strdata: str.slice(index, nextEmojiColon+1), type: 'emojiMerge'};

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
    const nextEmojiMergeComp = this.getNextEmojiMergeComp(str);
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
      nextEmojiMergeComp,
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

    if (![''].includes(dataTree.data.type)) return dataTree;

    if (dataTree.parent) {
      return this.getStyleParent(dataTree.parent);
    } else {
      return null;
    }


  },
  parse (str, msgStyles = msgStyles, tracker = {data: '',parent: null,children: []}, depth = 0) {

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

        this.parse(str.slice(nextComp.index+1), msgStyles, styleLayer, depth - 1);
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
    const el = document.querySelector('.chatInput');
    if (!el) return;
    const img = document.createElement('img');
    img.src = '/images/emojis/' + emoji.imageName;
    img.dataset.emojiId = ':' + emoji.id + ':';
    img.className = 'inputEmojiChip';
    img.alt = ':' + emoji.id + ':';
    const sel = window.getSelection();
    const selectionInInput = sel?.rangeCount && el.contains(sel.getRangeAt(0).commonAncestorContainer);
    if (selectionInInput) {
      const range = sel.getRangeAt(0);
      range.collapse(false);
      range.insertNode(img);
      range.setStartAfter(img);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      el.appendChild(img);
      const range = document.createRange();
      range.setStartAfter(img);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    el.focus();
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

function EmojiMerge(props) {
  const parts = props.message.data.strdata.split('$');
  const ids = parts.map(p => p.replace(/:/g, ''));
  const e1 = props.emojis?.find(e => e.id === ids[0]);
  const e2 = props.emojis?.find(e => e.id === ids[1]);

  if (!e1 || !e2) return props.message.data.strdata;

  return (
    <div
      className='emoji'
      style={{
        display: 'inline-block',
        width: 64,
        height: 64,
        backgroundImage: `url(/images/emojis/${e1.imageName}), url(/images/emojis/${e2.imageName})`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundBlendMode: 'multiply',
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    />
  );
}

function QuoteMsg (props) {

  const [quote, setQuote] = React.useState(null);
  const [quoteVisible, setQuoteVisible] = React.useState(false);
  const containerRef = React.useRef(null);
  const cursorRef = React.useRef({ x: 0, y: 0 });

  // Place the preview to the right of the cursor and above it, flipping to stay
  // on screen rather than overflowing.
  const positionBox = (clientX, clientY) => {
    const box = containerRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const margin = 8;
    const gap = 14;
    let left = clientX + gap;                // right of the cursor
    let top = clientY - rect.height - gap;   // above the cursor
    if (left + rect.width > window.innerWidth - margin) left = clientX - rect.width - gap; // flip left
    if (left < margin) left = margin;
    if (top < margin) top = clientY + gap;   // flip below if no room above
    if (top + rect.height > window.innerHeight - margin) top = window.innerHeight - rect.height - margin;
    box.style.left = left + 'px';
    box.style.top = top + 'px';
  };

  React.useLayoutEffect(() => {
    if (quoteVisible) positionBox(cursorRef.current.x, cursorRef.current.y);
  }, [quoteVisible]);

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
      onMouseEnter={(e) => { cursorRef.current = { x: e.clientX, y: e.clientY }; if (quote) setQuoteVisible(true); }}
      onMouseMove={(e) => { cursorRef.current = { x: e.clientX, y: e.clientY }; if (quoteVisible) positionBox(e.clientX, e.clientY); }}
      onMouseLeave={() => setQuoteVisible(false)}
    >
      {props.message.data.strdata}

    </button>
    {
        quoteVisible ? <div ref={containerRef} className='quote-container' style={{position: 'fixed', top: '-9999px', left: '-9999px'}}>

          {props.renderMessage(quote)}

        </div> : null
      }
  </>

}

function LinkMsg (props) {
  const message = props.message;
  const href = message.data.strdata;

  //check if href is an image
  const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  const imageType = imageTypes.find(type => href.endsWith(type));

  const isMP4 = href.endsWith('mp4');
  const isYouTube = href.includes('youtube.com/watch') || href.includes('youtu.be/');

  return (<>
  <a href={href} target='_blank' rel="noopener noreferrer">{
    imageType ? <div style={{
      display: 'inline-flex',alignItems: 'flex-end',height: 'auto',
    }}>
      <img src={href} loading='lazy' onLoad={(e) => {
        props._imageLoaded(e.target)
      }} />
    </div> : href
  }</a>
  {' '}
  
  {(isMP4 || isYouTube) ? <a target='_blank' rel="noopener noreferrer" onClick={(e) => {
    props.setOverlay({
      href: href,
      type: isYouTube ? 'youtube' : 'video'
    });
  }}>[embed]</a> : null}


</>);

}

function getCompRender (message, props, spanish) {
  switch (true) {
    case typeof message.data == 'string':
      return spanish ? message.data.split('').map((a,i)=><span style={{display:'inline-block'}} key={message.count+a+i}>{a}</span>) : message.data;
    case message.data.type == 'slideshow':
      return <SlideShow message={message.data.strdata} />;
    case message.data.type == 'link':
      return <LinkMsg 
        message={message} 
        _imageLoaded={image => props._imageLoaded(image)} 
        setOverlay={props.setOverlay} 
      />;
    case message.data.type == 'emojiMerge':
      return <EmojiMerge message={message} renderMessage={props.renderMessage} emojis={props.emojis} />;
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

    const msgcss = getMsgCss(message.data?.type, message.data.strdata);
    const className = msgcss.className || '';

    msgcss.className = undefined;

    return <span key={i} style={msgcss} className={className}>

      { getCompRender(message, props, props.spanish) }
      
      {message.children.length > 0 ? <NestMessage 
        spanish={props.spanish || msgcss.spanish}
        message={message} 
        emojis={props.emojis}
        _imageLoaded={(image) => props._imageLoaded(image)}
        renderMessage={props.renderMessage}
        setOverlay={(id) => props.setOverlay(id)}
      /> : null}
    </span>

  });

}

const fonts = {};

function getMsgCss (compName, value) {
  const styles = {
    '/*': { fontWeight: 'bold' },
    '/%': { fontStyle: 'italic' },
    '/^': { fontSize: '1.2em' },
    '/~': { fontSize: '0.8em' },
    '/)': { transform: 'scaleX(-1)', display: 'inline-block' },
    '/(': { transform: 'scaleY(-1)', display: 'inline-block' },
    '/@': { filter: 'blur(5px)', display: 'inline-block' },
    '/-': { textDecoration: 'line-through', display: 'inline-block' },
    '/.': { backgroundColor: 'black', color: 'white', transform: 'rotate(19deg)', display: 'inline-block' },
    '/,': { letterSpacing: '0.2em' },
    '/!': { className: 'rainbow' },
    '/$': { className: 'shake', display: 'inline-block' },
    '/+': { className: 'spin', display: 'inline-block' },
    '/_': { textDecoration: 'underline' },
    '/#': { backgroundColor: 'black', color: 'black', className: 'spolier' },
    '/&': { className: 'wavy', display: 'inline-block', spanish: true },
    '/?': { filter: 'contrast(10000000000%) saturate(1000000000%)' },
  }
  
  if (compName == 'color') {
    const color = value;
    return { color };
  } else if (compName == 'glow') {
    const color = value.slice(2);
    return { textShadow: `0px 0px 20px ${color}, 0px 0px 20px ${color}, 0px 0px 20px ${color}, 0px 0px 20px ${color}` };
  } else if (compName == 'font') {
    const fontFamily = value.slice(1, -1);
    if (!fonts[fontFamily]) {
      fonts[fontFamily] = true;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=' + fontFamily.replaceAll(' ', '+') + '&display=swap';
      document.head.appendChild(link);
    }
    
    return { fontFamily };
  }
  return styles[value] || {};
}

function Draggable ({ children }) {

  const ref = React.useRef();

  useEffect(() => {

    let isDragging = false;
    let startX, startY, initialX, initialY;
    const element = ref.current;
    const firstChild = element.children[0];

    element.style.position = 'fixed';
    element.style.cursor = 'move';

    function onMouseDown(e) {
      if (e.target.nodeName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = element.getBoundingClientRect();
      initialX = rect.left;
      initialY = rect.top;

      firstChild.style.pointerEvents = 'none';

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }

    function onMouseMove(e) {
      if (isDragging) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        element.style.left = initialX + dx + 'px';
        element.style.top = initialY + dy + 'px';
      }
    }

    function onMouseUp() {
      isDragging = false;
      firstChild.style.pointerEvents = 'auto';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    element.addEventListener('mousedown', onMouseDown);
    return () => {
      element.removeEventListener('mousedown', onMouseDown);
    };

  });

  return <div ref={ref}>
    {children}
  </div>;
}

function EmbedOverlay (props) {
  return <Draggable>
      <div id='embed-overlay'>
        <header>
          <button onClick={() => props.setOverlay(null)}>[close]</button>
        </header>

        {props.src.type == 'youtube' ? <iframe
          width="100%"
          height="100%"
          src={'https://www.youtube.com/embed/' + (props.src.href.includes('youtu.be/') ? props.src.href.split('youtu.be/')[1].split('?')[0] : new URL(props.src.href).searchParams.get('v'))}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        ></iframe> : null}

        {props.src.type == 'video' ? <video width="100%" height="100%" src={props.src.href} controls></video> : null}
    </div>
  </Draggable>;
}

class Messages extends React.Component {
  constructor () {
    super();

    this.state = {
      block: [],
      showOverlay: false,
    }

    this.cacheMessage = {};

    this.messageCon = React.createRef();
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

  getSnapshotBeforeUpdate(prevProps) {
    const el = this.messageCon.current;
    if (
      prevProps.messages.length > 0 &&
      this.props.messages[0]?.count !== prevProps.messages[0]?.count &&
      this.props.messages[0]?.count < prevProps.messages[0]?.count
    ) {
      return el.scrollHeight - el.scrollTop;
    }
    return null;
  }

  componentDidUpdate (prevProps, prevState, snapshot) {
    if (snapshot !== null) {
      const el = this.messageCon.current;
      el.scrollTop = el.scrollHeight - snapshot;
      return;
    }

    if (prevProps.layout !== this.props.layout || prevProps.showAvatars !== this.props.showAvatars) {
      this.cacheMessage = {};
    }

    //check if the messages have changed by comparing message from this.state and prevState
    const oldMessage = this.props.messages[this.props.messages.length - 1];
    const newMessage = prevProps.messages[prevProps.messages.length - 1];

    const messageCon = this.messageCon.current;
    if (oldMessage && newMessage) {
      //console.log('scroll', messageCon.scrollHeight, this.props.messages[this.props.messages.length-1]);
      const newMessageHeight = messageCon.children[messageCon.children.length - 1].offsetHeight;

      //don't scroll if the user has scrolled 50 pixels up
      if (messageCon.scrollTop + messageCon.clientHeight > messageCon.scrollHeight - newMessageHeight - 150) {
        console.log('scrolling');
        messageCon.scrollTo({
          top: messageCon.scrollHeight + 200,
          behavior: document.hasFocus() ? 'instant' : 'instant'
        });
      } else {
        console.log('no scroll');
      }
    } else if (prevProps.messages.length == 0) {
      console.log('scrolling to bottom');
      messageCon.scrollTo({
        top: messageCon.scrollHeight,
        behavior: 'instant'
      });
    } else {
      console.log('no scroll');
    }
  }

  _imageLoaded (image) {
    // console.log('image loaded', image.height);
    const messageCon = this.messageCon.current;
    const scrollBottom = messageCon.scrollTop + messageCon.clientHeight;
    if ((messageCon.scrollHeight - scrollBottom) - this.scrollAccum - 150 < image.height) {
      // console.log('scrolling to bottom');
      messageCon.scrollTo({
        top: messageCon.scrollHeight,
        behavior: 'smooth'
      });

    } else {
      console.log('no scroll');
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

    const avatar = msgData.avatar ? (typeof msgData.avatar === 'string' ? JSON.parse(msgData.avatar) : msgData.avatar) : null;

    const nickEl = <div className='nick'>
      {avatar && this.props.showAvatars ? <AvatarDisplay avatar={avatar} /> : null}
      {msgData.hat ? <div className='hat' style={{
        backgroundImage: `url('/images/hats/${msgData.hat}')`,
      }}></div> : null}
      { textContent != msgData.nick ? msgData.nick : <NestMessage message={flair} /> }{': '}
    </div>

    return nickEl;
  }

  renderMessageContent (msgData) {
    if (msgData.type === 'weather') {
      return <div className='messageContent'><pre className='weatherBlock' dangerouslySetInnerHTML={{ __html: msgData.message }} /></div>;
    }

    const message = messageParser.parse(msgData.message,
      msgData.type == 'general' ? noStyle : msgStyles
    ); //parse the message for links and other things

    return <div className='messageContent'>
      <NestMessage
        message={message} 
        emojis={this.props.emojis}
        _imageLoaded={(image) => this._imageLoaded(image)}
        renderMessage={this.renderMessage.bind(this)}
        setOverlay={(id) => this.setState({showOverlay: id})}
      />
    </div>
  }

  renderMessage (message) {
    return <div className={'message' + (message.type ? ' ' + message.type : '')} key={'message-' + message.count}>
      { this.renderTimeStamp(message) }
      { message.type == 'chat' ? this.renderNick(message) : null }
      { this.renderMessageContent(message) }
    </div>
  }

  handleClick (e) {
    const target = e.target;

    if (target.className.includes('time')) {
      const input = document.querySelector('.input-container .chatInput');
      if (!input) return;
      // Input is a contentEditable div (not a textarea): focus, move the caret
      // to the end, then insert so the send handler (getInputText) picks it up.
      input.focus();
      const range = document.createRange();
      range.selectNodeContents(input);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertText', false, '>>' + target.title + ' ');
    }

  }

  render() {
    return (

      <div id="message-container" className={this.props.layout ? `layout-${this.props.layout}` : ''} ref={this.messageCon} onClick={this.handleClick.bind(this)}>

        {/* render Messages react children */}

        {/* {overlay here} */}
        {
          this.state.showOverlay ? <EmbedOverlay 
            src={this.state.showOverlay}
            setOverlay={(id) => {
              console.log('set overlay', id);
              this.setState({showOverlay: id})
            }
            }
          /> : null
        }

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
export { NestMessage, messageParser, msgStyles };
