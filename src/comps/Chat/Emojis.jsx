import { useState, useRef, useEffect } from 'react';

function EmojiMini({ emojis, inputIndex, addMessage, close, selectEmoji }) {
  const [view, setView] = useState('list');
  const [emojiUpload, setEmojiUpload] = useState(false);
  const fileRef = useRef(null);
  const imageSrcRef = useRef(null);
  const inputRef = useRef(null);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (emojiUpload && inputRef.current && fileRef.current) {
      inputRef.current.focus();
      inputRef.current.value = fileRef.current.name.split('.')[0];
    }
  }, [emojiUpload]);

  function onDragOver(e) { e.preventDefault(); }

  // A dropped or picked file: read it for the preview, and the effect above
  // fills the name box from its file name.
  function takeFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      fileRef.current = file;
      imageSrcRef.current = ev.target.result;
      setEmojiUpload(true);
    };
    reader.readAsDataURL(file);
  }

  function onDrop(e) {
    e.preventDefault();
    takeFile(e.dataTransfer.files?.[0] || e.dataTransfer.items?.[0]?.getAsFile());
  }

  // The "Choose file" button, for anyone who can't drag (feedback #104).
  function onPick(e) {
    takeFile(e.target.files?.[0]);
    // Cleared so picking the same file again still fires a change.
    e.target.value = '';
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
              : <>
                <span className="material-symbols-outlined">upload_file</span>Drag or Drop to upload
                <span className='orText'>or</span>
                <button type='button' className='stdBtn chooseFileBtn' onClick={() => pickerRef.current?.click()}>Choose file</button>
              </>
            }
            <input
              type='file'
              ref={pickerRef}
              accept='image/png,image/jpeg,image/gif,image/webp'
              onChange={onPick}
              style={{ display: 'none' }}
              data-testid='emoji-file-picker'
            />
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
