import * as React from 'react';
import handleInput from '../../utils/handleInput'

class EmojiMini extends React.Component {

  constructor () {
    super();

    this.state = {
      view: 'list',
      emojiUpload: false
    }

    this.inputRef = React.createRef();

  }

  _onDragOver(e) {
    e.preventDefault();
  }

  _onDrop(e) {
    e.preventDefault();

    if(e.dataTransfer.items) {
      const file = e.dataTransfer.items[0].getAsFile();

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 128;
          canvas.height = 128;
          ctx.drawImage(img, 0, 0, 128, 128);
          const data = canvas.toDataURL('image/png');
          
          this.setFile(file, data);
        }
        img.src = e.target.result;
      }

      reader.readAsDataURL(file);
    }
  }

  setFile (file, imageSrc) {

    this.file = file;
    this.imageSrc = imageSrc;

    this.setState({emojiUpload: true}, () => {
      this.inputRef.current.focus();
      this.inputRef.current.value = file.name.split('.')[0];
    });

  }

  renderEmojiUploadForm() {
    return <div style={{display:'flex', justifyContent: 'center'}}>

      <form className='emojiUploadForm' onSubmit={(e) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('emoji', this.file);
        formData.append('id', this.inputRef.current.value);

        fetch('/uploadEmoji', {
          method: 'POST',
          body: formData
        }).then((res) => {
          this.file = null;
          this.imageSrc = null;
          this.setState({emojiUpload: false});
        });
      }}>

        <div className='emojiFileContainer' 
          onDragOver={(e) => this._onDragOver(e)}
          onDrop={(e) => this._onDrop(e)}
        >
          {
            this.state.emojiUpload ? <img src={this.imageSrc} /> : <>            
              <span className="material-symbols-outlined">upload_file</span>
              Drag or Drop to upload
            </>
          }
        </div>

        <label style={{display: 'flex', flexDirection: 'column', paddingTop: '10px'}}>
          <div className='emojiIdField'>
          : <input type="text" placeholder='Emoji ID' ref={this.inputRef} disabled={this.state.emojiUpload ? '' : 'disabled'} autoFocus/> :
          </div>
        </label>

        <button type="submit" className='stdBtn uploadEmojiBtn' disabled={this.state.emojiUpload ? '' : 'disabled'}>Upload</button>

      </form>

    </div>
  }

  renderEmojiList() {
    const startIndex = Math.floor(this.props.inputIndex/12) * 12;
    return <div className='emojiList'>
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
  }

  render() {
    return <div className='emojiMiniContainer'>
        
    <div className="emojiMiniHeader">
      <div className='emojiMiniHeaderTitle'>
        Emojis <span className="emojiMiniHeaderUploadTgl" onClick={() => {
          this.setState({view: this.state.view == 'list' ? 'upload' : 'list'});
        }}>
          {this.state.view == 'list' ? 'Upload Emoji' : 'List'}
        </span>
      </div>
      <div 
        style={{display: 'flex', cursor: 'pointer'}} 
        onClick={() => this.props.close()}
      >
          <span className="material-symbols-outlined">close</span>
        </div>
    </div>

    {this.state.view == 'list' ? 
      this.renderEmojiList() : this.renderEmojiUploadForm()
    }
  </div>
  }
}

class InputBar extends React.Component {
  constructor() {
    super();

    this.state = {
      value: '',
      inputIndex: -1
    }

  }

  replaceSelectedWord (word, selectionStart) {
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
      return this.props.emoji.filter(a=>a.id.toLowerCase().match(word.slice(1)));
    } else {
      return null;
    }
  }

  handleKeyUp(event) {
    const target = event.target;
    
    const selectionStart = target.selectionStart || this.state.selectionStart;
    const emojis = this.getEmojis(target.value, selectionStart);

    if (!this.state.inputAuto && emojis) {
      this.setState({inputIndex: 0});
    } 
    
    if (emojis && (!this.state.inputAuto || this.state.inputAuto.length != emojis.length)) {
      this.setState({inputAuto: emojis, emojis, selectionStart, inputIndex: 0});
    } else if (this.state.inputAuto && !emojis) {
      this.setState({emojis, inputAuto: emojis, inputIndex: 0});
    }
    
    if (event.which == 13) {
      if (this.state.inputAuto) {
        this.setState({inputAuto: false, emojis: false});
      } else if (!event.shiftKey) {
        target.value = '';
      }
    }
  }

  render() {
    return <div className="input-container" >

      {this.state.emojis ? <EmojiMini
          emojis={this.state.emojis}
          inputIndex={this.state.inputIndex}
          close={() => this.setState({emojis: false})}
          selectEmoji={(emoji) => this.replaceSelectedWord(':' + emoji + ':', this.state.selectionStart)}
        /> : null}

{
         (this.state.inputAuto?.length) ? <div className='acBar'>{
           this.state.inputAuto.slice(this.state.inputIndex).map((a, i) => {
             return <div key={a.id} style={{color: i == 0 ? 'white' : ''}}>{a.id}</div>
           })
         }</div> : null
       }
        


        <div style={{flex:1, display: 'flex', overflow: 'hidden', padding: '5px'}}>
          <textarea 
            onClick={this.handleKeyUp.bind(this)} 
            onKeyDown={this.handleInput.bind(this)} 
            onKeyUp={this.handleKeyUp.bind(this)} rows="1" placeholder="Type anything then press enter."
          ></textarea>

          <div className='inputBarBtns'>
            <div className='inputBarBtn' onClick={() => {
              const emojis = this.getEmojis(':', 1);
              console.log(emojis);
              this.setState({emojis, inputAuto: emojis, inputIndex: 0});
            }}>
              <span className="material-symbols-outlined">mood</span>
            </div>
          </div>
        </div>


    </div>
  }
}

export default InputBar;