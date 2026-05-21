import { useState, useRef, useEffect } from 'react';
import handleInput from '../../utils/handleInput';
import { PM } from './PM_Client.jsx';
import EmojiMini from './Emojis';
import FlairBuilder from './FlairBuilder';
import GifPicker from './GifPicker';

function getParamGhost(input) {
  if (!input || input[0] !== '/') return '';
  const parts = input.split(' ');
  if (parts.length < 2) return '';
  const commandName = parts[0].slice(1);
  const params = handleInput.getCommandParams(commandName);
  if (!params.length) return '';
  const startedCount = parts.slice(1).filter(Boolean).length;
  const remaining = params.slice(startedCount);
  if (!remaining.length) return '';
  return input.trimEnd() + ' ' + remaining.map(p => '<' + p + '>').join(' ');
}

function computeGhostText(value, sel, replaceWith) {
  const lastSpace = value.lastIndexOf(' ', sel - 1);
  const wordStart = lastSpace !== -1 ? lastSpace + 1 : 0;
  let wordEnd = value.indexOf(' ', sel);
  if (wordEnd === -1) wordEnd = value.length;
  return value.slice(0, wordStart) + replaceWith + value.slice(wordEnd);
}

function InputBar({ socket, store, channelName, addMessage, user, userlist, emoji, themeColor }) {
  const [inputAuto, setInputAuto] = useState(null);
  const [emojis, setEmojis] = useState(null);
  const [ghostText, setGhostText] = useState('');
  const [selectionStart, setSelectionStart] = useState(0);
  const [inputIndex, setInputIndex] = useState(0);
  const [showConvos] = useState(false);
  const [showStyle, setShowStyle] = useState(false);
  const [showGif, setShowGif] = useState(false);

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
    const target = inputBarRef.current;
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
      setGhostText(computeGhostText(value, sel, commands[0].replaceWith));
      setInputAuto(commands); setEmojis(null); setSelectionStart(sel); setInputIndex(0);
    } else if (emojiMatches?.length) {
      setGhostText(computeGhostText(value, sel, emojiMatches[0].replaceWith));
      setInputAuto(emojiMatches); setEmojis(emojiMatches); setSelectionStart(sel); setInputIndex(0);
    } else {
      setInputAuto(null); setEmojis(null); setGhostText(getParamGhost(value));
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
          setGhostText(getParamGhost(inputBarRef.current.value));
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
          setGhostText('');
        }
      }
    } else if (event.which === 9) {
      event.preventDefault();
      if (inputAuto) {
        const next = event.shiftKey
          ? (inputIndex <= 0 ? inputAuto.length - 1 : inputIndex - 1)
          : (inputIndex >= inputAuto.length - 1 ? 0 : inputIndex + 1);
        setInputIndex(next);
        setGhostText(computeGhostText(target.value, selectionStart, inputAuto[next].replaceWith));
      } else {
        const nicks = getNicks(target.value, target.selectionStart || selectionStart);
        if (nicks?.length) {
          setGhostText(computeGhostText(target.value, target.selectionStart, nicks[0].replaceWith));
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
      setEmojis(null); setInputAuto(null); setGhostText('');
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
        close={() => { setEmojis(null); setInputAuto(null); setGhostText(''); }}
        selectEmoji={(id) => replaceSelectedWord(':' + id + ':', selectionStart)}
      /> : null}

      {inputAuto?.length && !emojis ? (
        <div className='acBar'>
          {inputAuto.slice(inputIndex).map((a, i) => (
            <div key={a.id} style={{ color: i === 0 ? 'white' : '' }}>{a.id}</div>
          ))}
        </div>
      ) : null}

      {showConvos ? <PM socket={socket} user={user} /> : null}
      {showGif ? <GifPicker
        onSelect={(url) => {
          const target = inputBarRef.current;
          const sep = target.value ? ' ' : '';
          target.value = target.value + sep + url;
          target.focus();
        }}
        onClose={() => setShowGif(false)}
      /> : null}
      <FlairBuilder
        open={showStyle}
        onClose={() => setShowStyle(false)}
        onApply={(flair) => handleInputFn('/flair ' + flair)}
        emojis={emoji}
        user={user}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '5px' }}>
        <div className='pretendInput'>
          <div style={{ position: 'relative', flex: 1, display: 'flex', overflow: 'hidden' }}>
            {ghostText ? (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  padding: '6px 0 6px 5px',
                  fontSize: '14px',
                  lineHeight: '1.3',
                  fontFamily: 'inherit',
                  color: 'rgba(255,255,255,0.28)',
                  pointerEvents: 'none',
                  zIndex: 0,
                  overflow: 'hidden',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {ghostText}
              </div>
            ) : null}
            <textarea
              onClick={handleKeyUp}
              onChange={(e) => updateAutoComplete(e.target.value, e.target.selectionStart)}
              onKeyUp={handleKeyUp}
              onKeyDown={handleKeyDown}
              rows="1"
              placeholder="Type anything then press enter."
              ref={inputBarRef}
              style={{ position: 'relative', zIndex: 1, fontFamily: 'inherit' }}
            />
          </div>
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
          <div className='inputBarBtn' onClick={() => setShowGif(s => !s)}>
            <span style={{ fontSize: '20px' }} className="material-symbols-outlined">gif</span>
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
