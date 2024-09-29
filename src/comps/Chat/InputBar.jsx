import * as React from 'react';
import handleInput from '../../utils/handleInput';
import { PM } from './PM_Client.jsx';
import EmojiMini from './Emojis';

class StylePanel extends React.Component {
  constructor() {
    super();

    this.state = {};

  }

  componentDidMount() {

    fetch('/a/getHats')
      .then(res => res.json())
      .then(data => {
        console.log(data);

        this.setState({ hats: data.hats });

      })
  }

  render() {
    return <div className='stylePanel'>
      
      <div className='hatHeader'>
        <button style={{backgroundColor:'#39f'}}>My Hats</button>
        <button>All</button>
      </div>

      <div className='hatList'>
        {this.state.hats?.map(a => {
          return <div key={a.id} className='hat'>
            <img style={{maxHeight: '64px'}} src={'/images/hats/' + a.file} />
            <div>{a.name}</div>
          </div>
        })}
      </div>

    </div>
  }
}

class InputBar extends React.Component {
  constructor() {
    super();

    this.state = {
      value: '',
      inputIndex: -1,
      unreadConvo: false,
      showConvos: false
    }

    this.history = [];
    this.historyIndex = -1;

    this.inputBarRef = React.createRef();

  }

  componentDidMount() {

    this.inputBarRef.current.focus();

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.inputBarRef.current.focus();
      }
    });

  }

  replaceSelectedWord(word, selectionStart) {
    const target = document.querySelector('.input-container textarea');
    const input = target.value;
    const lastSpace = input.lastIndexOf(' ', selectionStart-1);
    const wordStart = lastSpace != -1 ? lastSpace+1 : 0;
    let wordEnd = input.indexOf(' ', selectionStart);
    if (wordEnd == -1) {
      wordEnd = input.length;
    }

    console.log(input, selectionStart, lastSpace, word);

    target.value = input.slice(0, wordStart) + word + input.slice(wordEnd);
    target.focus();

    target.selectionStart = wordStart + word.length + 1;
    target.selectionEnd = wordStart + word.length + 1;
  }

  addHistory (message) {
    this.historyIndex = -1;
    this.history.unshift(message);
  }

  _handleTab(event) {
    event.preventDefault();

    if (this.state.inputAuto) {

      let inputIndex = this.state.inputIndex;

      if (event.shiftKey) {
        if (--inputIndex < 0) {
          inputIndex = this.state.inputAuto.length - 1;
        }
      } else {
        if (++inputIndex >= this.state.inputAuto.length) {
          inputIndex = 0;
        }
      }

      this.setState({ inputIndex });

    }
  }

  _handleEnter(event) {
    const target = event.target;
    if (this.state.inputAuto && this.state.inputAuto.length) {
      //replace text
      this.replaceSelectedWord(this.state.inputAuto[this.state.inputIndex].replaceWith, target.selectionStart);
      this.setState({ inputAuto: false, emojis: false });
    } else {
      try {
        this.addHistory(target.value);

        const inputData = handleInput.handle(target.value, this.props.channelName);

        if (inputData.commandName) {
          if (inputData.handler) {
            inputData.handler(inputData.params);
          } else {
            this.props.socket.emit('command', inputData);
          }
        } else {
          this.props.socket.emit('message', inputData);
        }
      } catch (e) {

        this.props.addMessage({
          message: e.message,
          type: 'error',
          count: 'error' + Math.random()
        });
      }

      target.value = '';
    }
  }

  getEmojis(input = '', selectionStart) {
    let wordStart = input.lastIndexOf(':', selectionStart);
    if (wordStart == -1) return null;

    let wordEnd = input.indexOf(' ', wordStart + 1);
    if (wordEnd == -1) {
      wordEnd = input.length;
    }

    const afterColon = input.substring(wordStart + 2, selectionStart).indexOf(':');
    if (afterColon != -1) {
      return null;
    }

    const word = input.substring(wordStart, wordEnd).toLowerCase();
    if ((input[wordStart - 1] != ' ' && input[wordStart - 1] != ':') && wordStart != 0) {
      return null;
    }

    if (word.startsWith(':') && (!word.endsWith(':') || word.length == 1)) {
      const matchedEmojis = this.props.emoji.filter(a => a.id.toLowerCase().match(word.slice(1)));
      return matchedEmojis.map(a => {
        return {
          id: a.id,
          replaceWith: ':' + a.id + ':',
          imageName: a.imageName
        }
      });
    } else {
      return null;
    }
  }

  getCommands (input = '', selectionStart) {

    if (input[0] != '/') return null;

    const commandName = input.split(' ')[0].slice(1);

    if (selectionStart > commandName.length + 1) return null;

    const command = input.split(' ')[0].slice(1);

    return handleInput.getCommands().filter(b=> b.startsWith(command)).map(a => {
      return {
        id: a,
        replaceWith: '/' + a
      }
    });
  }

  getNicks (input = '', selectionStart) {
    const wordStart = input.lastIndexOf('@', selectionStart);
    if (wordStart == -1) return null;
    
    let wordEnd = input.indexOf(' ', wordStart + 1);
    if (wordEnd != -1) {
      return null;
    }

    const word = input.substring(wordStart).toLowerCase();
    console.log(word);
    if ((input[wordStart - 1] != ' ' && input[wordStart - 1] != '@') && wordStart != 0) return null;

    if (word.startsWith('@') && (!word.endsWith('@') || word.length == 1)) {
      const matchedNicks = this.props.userlist.filter(a => a.nick.toLowerCase().match(word.slice(1)));
      return matchedNicks.map(a => {
        return {
          id: a.nick,
          replaceWith: '@' + a.nick
        }
      });
    } else {
      return null;
    }
  }

  handleChange(event) {
    const target = event.target;
    const selectionStart = target.selectionStart || this.state.selectionStart;
    const emojis = this.getEmojis(target.value, selectionStart);
    const commands = this.getCommands(target.value, selectionStart);
    const nicks = this.getNicks(target.value, selectionStart);
    
    if (nicks) {
      this.setState({ inputAuto: nicks, selectionStart, inputIndex: 0 });
    } else if (commands) {
      this.setState({ inputAuto: commands, selectionStart, inputIndex: 0}); 
    } else if (emojis) {
      this.setState({ inputAuto: emojis, emojis, selectionStart, inputIndex: 0 });
    } else if (!emojis) {
      this.setState({ inputAuto: null, emojis: null });
    }
  }

  handleKeyUp(event) {

    const target = event.target;

    const countLines = target.value.split('\n').length;

    target.rows = countLines;


    if (!this.state.inputAuto) {
      this.handleChange(event);
    } 
  }

  handleKeyDown(event) {
    const target = event.target;

    if (event.which == 13) {
      if (!event.shiftKey) {
        event.preventDefault();

        if (target.value) {
          this._handleEnter(event);
        }
      }
    } else if (event.which == 9) {
      this._handleTab(event);
    } else if (event.shiftKey) {
      if (event.which == 40) {
        if (this.historyIndex > 0) {
          target.value = this.history[--this.historyIndex];
        }

      } else if (event.which == 38) {
        if (this.historyIndex < this.history.length - 1) {
          target.value = this.history[++this.historyIndex];
        }      
      }
    }
  }

  toggleDisplay(prop) {
    this.setState( prevState => ({ [prop]: !prevState[prop] }))
  }

  _handleEmojiClick() {

    if (this.state.emojis) {
      this.setState({ emojis: false, inputAuto: false });
    } else {
      const emojis = this.getEmojis(':', 1);
      this.setState({ emojis, inputAuto: emojis, inputIndex: 0 });
    }
  }

  render() {
    return <div className="input-container" >
      
      {this.state.emojis ? <EmojiMini
        addMessage={this.props.addMessage}
        emojis={this.state.emojis}
        inputIndex={this.state.inputIndex}
        close={() => this.setState({ emojis: false, inputAuto: false })}
        selectEmoji={(emoji) => this.replaceSelectedWord(':' + emoji + ':', this.state.selectionStart)}
      /> : null}

      {
        (this.state.inputAuto?.length) ? <div className='acBar'>{
          this.state.inputAuto.slice(this.state.inputIndex).map((a, i) => {
            return <div key={a.id} style={{ color: i == 0 ? 'white' : '' }}>{a.id}</div>
        })
        }</div> : null
      }

      {this.state.showConvos ? <PM
        socket={this.props.socket}
        user={this.props.user}
      /> : null}

      {this.state.showStyle ? <StylePanel /> : null}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '5px' }}>

        <div className='pretendInput'>
          <textarea
            onClick={this.handleKeyUp.bind(this)}
            onChange={this.handleChange.bind(this)}
            onKeyUp={this.handleKeyUp.bind(this)}
            onKeyDown={this.handleKeyDown.bind(this)}
            rows="1" placeholder="Type anything then press enter."
            ref={this.inputBarRef}
          ></textarea>

          <div className='insideInputBarBtns'>
            <div className='inputBarBtn' onClick={this._handleEmojiClick.bind(this)}>
              <span className="material-symbols-outlined" style={{fontSize:'20px'}}>mood</span>
            </div>
          </div>
        </div>


        <div className='inputBarBtns'>

          <div className='inputBarBtn' onClick={() => this.toggleDisplay('showStyle')}>
            <span style={{fontSize: '20px'}} className="material-symbols-outlined">palette</span>
          </div>

          <div className='noSelect inputBarBtn' onClick={() => {
            //this.toggleDisplay('showConvos')
          }}>
            <span style={{fontSize: '20px'}} className="material-symbols-outlined">forum</span>
          </div>

        </div>
      </div>


    </div>
  }
}

export default InputBar;