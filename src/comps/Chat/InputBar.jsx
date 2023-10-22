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

  }

  replaceSelectedWord(word, selectionStart) {
    const target = document.querySelector('.input-container textarea');
    const input = target.value;
    const wordStart = input.lastIndexOf(':', selectionStart);
    let wordEnd = input.indexOf(' ', selectionStart);
    if (wordEnd == -1) {
      wordEnd = input.length;
    }

    target.value = input.slice(0, wordStart) + word + input.slice(wordEnd);
    target.focus();

    target.selectionStart = wordStart + word.length + 1;
    target.selectionEnd = wordStart + word.length + 1;
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
    if (this.state.inputAuto) {
      //replace text
      this.replaceSelectedWord(':' + this.state.inputAuto[this.state.inputIndex].id + ':', target.selectionStart);
      this.setState({ inputAuto: false, showEmojis: false });
    } else {
      try {
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
    if (!wordStart) wordStart = 0;

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
      return this.props.emoji.filter(a => a.id.toLowerCase().match(word.slice(1)));
    } else {
      return null;
    }
  }

  handleChange(event) {
    const target = event.target;
    const selectionStart = target.selectionStart || this.state.selectionStart;
    const emojis = this.getEmojis(target.value, selectionStart);
    
    if (!this.state.showEmojis) return;

    if (emojis) {
      this.setState({ inputAuto: emojis, emojis, selectionStart, inputIndex: 0 });
    } else if (!emojis) {
      this.setState({ showEmojis: null, inputAuto: null});
    }
  }

  handleKeyUp(event) {
    const target = event.target;

    const selectionStart = target.selectionStart || this.state.selectionStart;
    const emojis = this.getEmojis(target.value, selectionStart);

    if (!this.state.inputAuto && emojis) {
      this.setState({ inputIndex: 0, showEmojis: true, emojis, inputAuto: emojis });
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
    }
  }

  toggleDisplay(prop) {
    this.setState( prevState => ({ [prop]: !prevState[prop] }))
  }

  _handleEmojiClick() {

    if (this.state.showEmojis) {
      this.setState({ showEmojis: false, inputAuto: false });
    } else {
      const emojis = this.getEmojis(':', 1);
      this.setState({ emojis, inputAuto: emojis, inputIndex: 0, showEmojis: true });
    }
  }

  render() {
    return <div className="input-container" >
      
      {this.state.showEmojis ? <EmojiMini
        addMessage={this.props.addMessage}
        emojis={this.state.emojis}
        inputIndex={this.state.inputIndex}
        close={() => this.setState({ emojis: false, inputAuto: false, showEmojis: false })}
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
        getMyNick={this.props.getMyNick}
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

          <div className='noSelect inputBarBtn' onClick={() => this.toggleDisplay('showConvos')}>
            <span style={{fontSize: '20px'}} className="material-symbols-outlined">forum</span>
          </div>

        </div>
      </div>


    </div>
  }
}

export default InputBar;