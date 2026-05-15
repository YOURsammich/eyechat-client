import { useState, useRef, useEffect } from 'react';
import handleInput from '../../utils/handleInput';
import { PM } from './PM_Client.jsx';
import EmojiMini from './Emojis';

function StylePanel() {
  return (
    <div className='stylePanel'>
      <div className="stylePreview"></div>
      <ul>
        <li>Hats</li>
        <li>Flair</li>
        <li>Text Style (Font, color, etc)</li>
      </ul>
    </div>
  );
}

function InputBar({ socket, store, channelName, addMessage, user, userlist, emoji, themeColor }) {
  const [inputAuto, setInputAuto] = useState(null);
  const [emojis, setEmojis] = useState(null);
  const [selectionStart, setSelectionStart] = useState(0);
  const [inputIndex, setInputIndex] = useState(0);
  const [showConvos] = useState(false);
  const [showStyle, setShowStyle] = useState(false);

  const inputBarRef = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);

  useEffect(() => {
    inputBarRef.current.focus();
    const refocus = () => { if (!document.hidden) inputBarRef.current.focus(); };
    document.addEventListener('visibilitychange', refocus);
    return () => document.removeEventListener('visibilitychange', refocus);
  }, []);

  function handleInputFn(text) {
    return handleInput.handle(text, socket, store, channelName, addMessage, user);
  }

  function replaceSelectedWord(word, sel) {
    const target = document.querySelector('.input-container textarea');
    const input = target.value;
    const lastSpace = input.lastIndexOf(' ', sel - 1);
    const wordStart = lastSpace !== -1 ? lastSpace + 1 : 0;
    let wordEnd = input.indexOf(' ', sel);
    if (wordEnd === -1) wordEnd = input.length;
    target.value = input.slice(0, wordStart) + word + input.slice(wordEnd);
    target.focus();
    target.selectionStart = wordStart + word.length + 1;
    target.selectionEnd = wordStart + word.length + 1;
  }

  function getEmojis(input = '', sel) {
    let wordStart = input.lastIndexOf(':', sel);
    if (wordStart === -1) return null;
    let wordEnd = input.indexOf(' ', wordStart + 1);
    if (wordEnd === -1) wordEnd = input.length;
    if (sel < wordStart || sel > wordEnd) return null;
    if (input.substring(wordStart + 2, sel).indexOf(':') !== -1) return null;
    const word = input.substring(wordStart, wordEnd).toLowerCase();
    if ((input[wordStart - 1] !== ' ' && input[wordStart - 1] !== ':') && wordStart !== 0) return null;
    if (word.startsWith(':') && (!word.endsWith(':') || word.length === 1)) {
      return emoji?.filter(a => a.id.toLowerCase().includes(word.slice(1)))
        .map(a => ({ id: a.id, replaceWith: ':' + a.id + ':', imageName: a.imageName })) ?? null;
    }
    return null;
  }

  function getCommands(input = '', sel) {
    if (input[0] !== '/') return null;
    const commandName = input.split(' ')[0].slice(1);
    if (sel > commandName.length + 1) return null;
    return handleInput.getCommands().filter(b => b.startsWith(commandName))
      .map(a => ({ id: a, replaceWith: '/' + a }));
  }

  function getNicks(input = '', sel) {
    let wordStart = input.lastIndexOf(' ', sel);
    if (wordStart === -1) wordStart = 0;
    if (input.indexOf(' ', wordStart + 1) !== -1) return null;
    const word = input.substring(wordStart).toLowerCase();
    return userlist.filter(a => a.nick.toLowerCase().match(word.slice(1)))
      .map(a => ({ id: a.nick, replaceWith: a.nick }));
  }

  function updateAutoComplete(value, sel) {
    const emojiMatches = getEmojis(value, sel);
    const commands = getCommands(value, sel);
    if (commands?.length) {
      setInputAuto(commands); setEmojis(null); setSelectionStart(sel); setInputIndex(0);
    } else if (emojiMatches?.length) {
      setInputAuto(emojiMatches); setEmojis(emojiMatches); setSelectionStart(sel); setInputIndex(0);
    } else {
      setInputAuto(null); setEmojis(null);
    }
  }

  function handleKeyDown(event) {
    const target = event.target;

    if (event.which === 13) {
      if (!event.shiftKey) {
        event.preventDefault();
        if (!target.value) return;

        if (inputAuto?.length) {
          replaceSelectedWord(inputAuto[inputIndex].replaceWith + ' ', target.selectionStart);
          setInputAuto(null); setEmojis(null);
        } else {
          historyIndexRef.current = -1;
          historyRef.current.unshift(target.value);
          try {
            handleInputFn(target.value);
          } catch (e) {
            console.error(e);
            addMessage({ message: e.message, type: 'error', count: 'error' + Math.random() });
          }
          target.value = '';
        }
      }
    } else if (event.which === 9) {
      event.preventDefault();
      if (inputAuto) {
        setInputIndex(prev => {
          if (event.shiftKey) return prev <= 0 ? inputAuto.length - 1 : prev - 1;
          return prev >= inputAuto.length - 1 ? 0 : prev + 1;
        });
      } else {
        const nicks = getNicks(target.value, target.selectionStart || selectionStart);
        if (nicks?.length) {
          setInputAuto(nicks); setSelectionStart(target.selectionStart); setInputIndex(0);
        }
      }
    } else if (event.shiftKey) {
      if (event.which === 40 && historyIndexRef.current > 0) {
        target.value = historyRef.current[--historyIndexRef.current];
      } else if (event.which === 38 && historyIndexRef.current < historyRef.current.length - 1) {
        target.value = historyRef.current[++historyIndexRef.current];
      }
    } else {
      updateAutoComplete(target.value, target.selectionStart);
    }
  }

  function handleKeyUp(event) {
    const target = event.target;
    target.rows = target.value.split('\n').length;
    if (!inputAuto) updateAutoComplete(target.value, target.selectionStart);
  }

  function handleEmojiClick() {
    if (emojis) {
      setEmojis(null); setInputAuto(null);
    } else {
      const matches = getEmojis(':', 1);
      setEmojis(matches); setInputAuto(matches); setInputIndex(0);
    }
  }

  return (
    <div className="input-container" style={{ background: themeColor }}>

      {emojis ? <EmojiMini
        addMessage={addMessage}
        emojis={emojis}
        inputIndex={inputIndex}
        close={() => { setEmojis(null); setInputAuto(null); }}
        selectEmoji={(id) => replaceSelectedWord(':' + id + ':', selectionStart)}
      /> : null}

      {inputAuto?.length ? (
        <div className='acBar'>
          {inputAuto.slice(inputIndex).map((a, i) => (
            <div key={a.id} style={{ color: i === 0 ? 'white' : '' }}>{a.id}</div>
          ))}
        </div>
      ) : null}

      {showConvos ? <PM socket={socket} user={user} /> : null}
      {showStyle ? <StylePanel /> : null}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '5px' }}>
        <div className='pretendInput'>
          <textarea
            onClick={handleKeyUp}
            onChange={(e) => updateAutoComplete(e.target.value, e.target.selectionStart)}
            onKeyUp={handleKeyUp}
            onKeyDown={handleKeyDown}
            rows="1" placeholder="Type anything then press enter."
            ref={inputBarRef}
          />
          <div className='insideInputBarBtns'>
            <div className='inputBarBtn' onClick={handleEmojiClick}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>mood</span>
            </div>
          </div>
        </div>

        <div className='inputBarBtns'>
          <div className='inputBarBtn' onClick={() => setShowStyle(s => !s)}>
            <span style={{ fontSize: '20px' }} className="material-symbols-outlined">palette</span>
          </div>
          <div className='noSelect inputBarBtn' onClick={() => { /* setShowConvos(s => !s) */ }}>
            <span style={{ fontSize: '20px' }} className="material-symbols-outlined">forum</span>
          </div>
        </div>
      </div>

    </div>
  );
}

export default InputBar;
