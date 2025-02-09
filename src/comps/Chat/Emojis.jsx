import * as React from 'react';

class EmojiMini extends React.Component {

    constructor() {
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
  
      if (e.dataTransfer.items) {
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
  
    setFile(file, imageSrc) {
  
      this.file = file;
      this.imageSrc = imageSrc;
  
      this.setState({ emojiUpload: true }, () => {
        this.inputRef.current.focus();
        this.inputRef.current.value = file.name.split('.')[0];
      });
  
    }
  
    renderEmojiUploadForm() {
      return <div style={{ display: 'flex', justifyContent: 'center' }}>
  
        <form className='emojiUploadForm' onSubmit={(e) => {
          e.preventDefault();
  
          const formData = new FormData();
          formData.append('emoji', this.file);
          formData.append('id', this.inputRef.current.value);
  
          fetch('/channel/uploadEmoji', {
            method: 'POST',
            body: formData
          })
          .then(res=>res.json())
          .then((res) => {
            if (res.message) {
              this.props.addMessage({
                message: res.message,
                type: 'error',
                count: Math.random()
              });
            }

            this.file = null;
            this.imageSrc = null;
            this.setState({ emojiUpload: false });
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
  
          <label style={{ display: 'flex', flexDirection: 'column', paddingTop: '10px' }}>
            <div className='emojiIdField'>
              : <input type="text" placeholder='Emoji ID' ref={this.inputRef} disabled={this.state.emojiUpload ? '' : 'disabled'} autoFocus /> :
            </div>
          </label>
  
          <button type="submit" className='stdBtn uploadEmojiBtn' disabled={this.state.emojiUpload ? '' : 'disabled'}>Upload</button>
  
        </form>
  
      </div>
    }
  
    renderEmojiList() {
      const startIndex = Math.floor(this.props.inputIndex / 12) * 12;

      return <div className='emojiList'>
        {this.props.emojis ? this.props.emojis.slice(startIndex, startIndex + 12).map((a, i) => {
          return <li
            key={a.id} title={a.id}
            style={{ backgroundColor: (this.props.inputIndex - startIndex) == i ? '#39f' : '' }}
            onClick={() => {
              this.props.selectEmoji(a.id);
            }}
          >
            <img style={{ maxWidth: '35px', maxHeight: '35px' }} src={'/images/emojis/' + a.imageName} />
          </li>
        }) : null}
      </div>
    }
  
    render() {
      return <div className='emojiMiniContainer'>
  
        <div className="emojiMiniHeader">
          <div className='emojiMiniHeaderTitle'>
            Emojis <span className="emojiMiniHeaderUploadTgl" onClick={() => {
              this.setState({ view: this.state.view == 'list' ? 'upload' : 'list' });
            }}>
              {this.state.view == 'list' ? 'Upload Emoji' : 'List'}
            </span>
          </div>
          <div
            style={{ display: 'flex', cursor: 'pointer' }}
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

  export default EmojiMini;