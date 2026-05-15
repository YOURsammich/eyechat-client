import { useState, useRef, useEffect } from 'react';

function EmojiMini({ emojis, inputIndex, addMessage, close, selectEmoji }) {
  const [view, setView] = useState('list');
  const [emojiUpload, setEmojiUpload] = useState(false);
  const fileRef = useRef(null);
  const imageSrcRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (emojiUpload && inputRef.current && fileRef.current) {
      inputRef.current.focus();
      inputRef.current.value = fileRef.current.name.split('.')[0];
    }
  }, [emojiUpload]);

  function onDragOver(e) { e.preventDefault(); }

  function onDrop(e) {
    e.preventDefault();
    if (!e.dataTransfer.items) return;
    const file = e.dataTransfer.items[0].getAsFile();
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 128;
        ctx.drawImage(img, 0, 0, 128, 128);
        fileRef.current = file;
        imageSrcRef.current = canvas.toDataURL('image/png');
        setEmojiUpload(true);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function renderEmojiUploadForm() {
    return (
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <form className='emojiUploadForm' onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData();
          formData.append('emoji', fileRef.current);
          formData.append('id', inputRef.current.value);
          fetch('/channel/uploadEmoji', { method: 'POST', body: formData })
            .then(res => res.json())
            .then((res) => {
              if (res.message) {
                addMessage({ message: res.message, type: 'error', count: Math.random() });
              }
              fileRef.current = null;
              imageSrcRef.current = null;
              setEmojiUpload(false);
            });
        }}>
          <div className='emojiFileContainer' onDragOver={onDragOver} onDrop={onDrop}>
            {emojiUpload
              ? <img src={imageSrcRef.current} />
              : <><span className="material-symbols-outlined">upload_file</span>Drag or Drop to upload</>
            }
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', paddingTop: '10px' }}>
            <div className='emojiIdField'>
              : <input type="text" placeholder='Emoji ID' ref={inputRef} disabled={emojiUpload ? '' : 'disabled'} autoFocus /> :
            </div>
          </label>
          <button type="submit" className='stdBtn uploadEmojiBtn' disabled={emojiUpload ? '' : 'disabled'}>Upload</button>
        </form>
      </div>
    );
  }

  function renderEmojiList() {
    const startIndex = Math.floor(inputIndex / 12) * 12;
    return (
      <div className='emojiList'>
        {emojis?.slice(startIndex, startIndex + 12).map((a, i) => (
          <li key={a.id} title={a.id}
            style={{ backgroundColor: (inputIndex - startIndex) === i ? '#39f' : '' }}
            onClick={() => selectEmoji(a.id)}
          >
            <img style={{ maxWidth: '35px', maxHeight: '35px' }} src={'/images/emojis/' + a.imageName} />
          </li>
        ))}
      </div>
    );
  }

  return (
    <div className='emojiMiniContainer'>
      <div className="emojiMiniHeader">
        <div className='emojiMiniHeaderTitle'>
          Emojis <span className="emojiMiniHeaderUploadTgl" onClick={() => setView(v => v === 'list' ? 'upload' : 'list')}>
            {view === 'list' ? 'Upload Emoji' : 'List'}
          </span>
        </div>
        <div style={{ display: 'flex', cursor: 'pointer' }} onClick={close}>
          <span className="material-symbols-outlined">close</span>
        </div>
      </div>
      {view === 'list' ? renderEmojiList() : renderEmojiUploadForm()}
    </div>
  );
}

export default EmojiMini;
