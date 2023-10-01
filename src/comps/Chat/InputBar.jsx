import * as React from 'react';
import handleInput from '../../utils/handleInput';
import { PM } from './PM_Client.jsx';
import EmojiMini from './Emojis';

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

    console.log(word);

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

  handleInput(event) {
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

  handleKeyUp(event) {
    const target = event.target;

    const selectionStart = target.selectionStart || this.state.selectionStart;
    const emojis = this.getEmojis(target.value, selectionStart);

    if (!this.state.inputAuto && emojis) {
      this.setState({ inputIndex: 0 });
    }

    if (emojis && (!this.state.inputAuto || this.state.inputAuto.length != emojis.length)) {
      this.setState({ inputAuto: emojis, emojis, selectionStart, inputIndex: 0 });
    } else if (this.state.inputAuto && !emojis) {
      this.setState({ emojis, inputAuto: emojis, inputIndex: 0 });
    }

    if (event.which == 13) {
      if (this.state.inputAuto) {
        this.setState({ inputAuto: false, emojis: false });
      } else if (!event.shiftKey) {
        target.value = '';
      }
    }
  }

 toggleDisplay(prop) {
  this.setState( prevState => ({ [prop]: !prevState[prop] }))
  }

  render() {
    return <div className="input-container" >

      {this.state.showEmojis ? <EmojiMini
        emojis={this.state.emojis}
        inputIndex={this.state.inputIndex}
        close={() => this.setState({ emojis: false })}
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


      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '5px' }}>
        <textarea
          onClick={this.handleKeyUp.bind(this)}
          onKeyDown={this.handleInput.bind(this)}
          onKeyUp={this.handleKeyUp.bind(this)} rows="1" placeholder="Type anything then press enter."
        ></textarea>

        <div className='noSelect inputBarBtns'>

          <div className='inputBarBtn' onClick={() => {
            const emojis = this.getEmojis(':', 1);
            this.toggleDisplay('showEmojis')
            this.setState({ emojis, inputAuto: emojis, inputIndex: 0 });
            console.log(emojis);
          }}>
            <span className="material-symbols-outlined">mood</span>
          </div>

          <div className='noSelect inputBarBtn' onClick={() => {
            this.toggleDisplay('showConvos');
          }}>
            <span className="material-symbols-outlined">forum</span>
          </div>

        </div>
      </div>


    </div>
  }
}

export default InputBar;