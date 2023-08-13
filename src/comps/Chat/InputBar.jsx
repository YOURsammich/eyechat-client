import * as React from 'react';
import handleInput from '../../utils/handleInput'

class EmojiMini extends React.Component {

  constructor () {
    super();


  }

  render() {

    const startIndex = Math.floor(this.props.inputIndex/12) * 12;

    return <div className='emojiMiniContainer'>
        
    <div className="emojiMiniHeader">
      <div>Emojis</div>
      <div onClick={() => this.props.close()}><span className="material-symbols-outlined">close</span></div>
    </div>

    <div className='emojiList'>
      {this.props.emojis ? this.props.emojis.slice(startIndex,startIndex+12).map((a, i) => {           
        return <li 
          key={a.id} title={a.id} 
          style={{backgroundColor: (this.props.inputIndex - startIndex) == i ? '#39f' : ''}}
          onClick={() => { 
            this.props.selectEmoji(a.id);
          }}
        >
          <img style={{maxWidth: '35px', maxHeight:'35px'}} src={'/images/emojis/' + a.imageName}  />
        </li>
      }) : null}
    </div>
  </div>

  }

}

class InputBar extends React.Component {
  constructor() {
    super();

    this.state = {
      showEmojis : false,
      value: '',
      inputIndex: -1
    }

  }

  replaceSelectedWord (word, selectionStart) {
    const target = document.querySelector('.input-container textarea');
    const input = target.value;
    const wordStart = input.lastIndexOf(' ', selectionStart - 1);
    let wordEnd = input.indexOf(' ', selectionStart);
    if (wordEnd == -1) {
      wordEnd = input.length;
    }

    target.value = input.slice(0, wordStart + 1) + word + input.slice(wordEnd);
    target.focus();

    target.selectionStart = wordStart + word.length + 1;
    target.selectionEnd = wordStart + word.length + 1;
  }

  _handleTab (event) {
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

      this.setState({inputIndex});

    }
  }

  _handleEnter (event) {
    event.preventDefault();

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
  
        target.value = '';
      } catch (e) {
        console.log(e);
      }
    }
  }

  handleInput(event) {
    if (event.which == 13) {
      this._handleEnter(event);
    } else if (event.which == 9) {
      this._handleTab(event);
    }
  }

  getEmojis(input = '', selectionStart) {
    const wordStart = input.lastIndexOf(' ', selectionStart - 1);
    let wordEnd = input.indexOf(' ', wordStart + 1);
    if (wordEnd == -1) {
      wordEnd = input.length;
    }

    const word = input.substring(wordStart+1, wordEnd).toLowerCase();
    if (word.startsWith(':')) {
      return this.props.emoji.filter(a=>a.id.toLowerCase().match(word.slice(1)));
    } else {
      return null;
    }
  }

  handleKeyUp(event) {
    const target = event.target;
    const emojis = this.getEmojis(target.value, target.selectionStart);

    if (!this.state.inputAuto && emojis) {
      this.setState({inputIndex: 0});
    } 
    
    if (!this.state.inputAuto || this.state.inputAuto.length != emojis.length) {
      this.setState({inputAuto: emojis, emojis, selectionStart: target.selectionStart, inputIndex: 0});
    }
    
    if (event.which == 13) {
      if (this.state.inputAuto) {
        this.setState({inputAuto: false, emojis: false});
      } else {
        target.value = '';
      }
    }
  }

  render() {
    return <div className="input-container" 
      onClick={this.handleKeyUp.bind(this)} 
      onKeyDown={this.handleInput.bind(this)} 
      onKeyUp={this.handleKeyUp.bind(this)}
    >

      {this.state.emojis ? <EmojiMini
          emojis={this.state.emojis}
          inputIndex={this.state.inputIndex}
          close={() => this.setState({emojis: false})}
          selectEmoji={(emoji) => this.replaceSelectedWord(':' + emoji + ':', this.state.selectionStart)}
        /> : null}

       {
        this.state.inputAuto ? <div className='acBar'>{
          this.state.inputAuto.slice(this.state.inputIndex).map((a, i) => {
            return <div key={a.id} style={{color: i == 0 ? 'white' : ''}}>{a.id}</div>
          })
        }</div> : null
       }

      <textarea rows="1" placeholder="Type anything then press enter."></textarea>
    </div>
  }
}

export default InputBar;