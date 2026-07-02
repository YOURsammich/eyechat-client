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

function InputBar({ socket, store, channelName, addMessage, user, userlist, emoji, themeColor, channelState }) {
  const [inputAuto, setInputAuto] = useState(null);
  const [emojis, setEmojis] = useState(null);
  const [ghostText, setGhostText] = useState('');
  const [selectionStart, setSelectionStart] = useState(0);
  const [inputIndex, setInputIndex] = useState(0);
  const [showConvos] = useState(false);
  const [showStyle, setShowStyle] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [gifInitialQuery, setGifInitialQuery] = useState(null);

  const inputBarRef = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);

  useEffect(() => {
    inputBarRef.current.focus();
    const refocus = () => { if (!document.hidden) inputBarRef.current.focus(); };
    document.addEventListener('visibilitychange', refocus);
    return () => document.removeEventListener('visibilitychange', refocus);
  }, []);

  // --- contenteditable helpers ---

  function getInputText() {
    const el = inputBarRef.current;
    let text = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
      else if (node.nodeName === 'IMG') text += node.dataset.gifUrl ?? node.dataset.emojiId ?? '';
      else if (node.nodeName === 'BR') text += '\n';
      else text += node.textContent;
    }
    return text;
  }

  function getCaretOffset() {
    const sel = window.getSelection();
    if (!sel?.rangeCount) return 0;
    const range = sel.getRangeAt(0).cloneRange();
    range.setStart(inputBarRef.current, 0);
    return range.toString().length;
  }

  function clearInput() {
    inputBarRef.current.innerHTML = '';
  }

  function getPlainText() {
    const el = inputBarRef.current;
    let text = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
      else if (node.nodeName === 'BR') text += '\n';
    }
    return text;
  }

  function getTextNodeAtOffset(el, targetOffset) {
    let remaining = targetOffset;
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const len = node.textContent.length;
        if (len === 0) continue;
        if (remaining <= len) return { node, offset: remaining };
        remaining -= len;
      }
    }
    return null;
  }

  function insertEmojiChip(id, imageName, partialStart, partialEnd) {
    const el = inputBarRef.current;
    const img = document.createElement('img');
    img.src = '/images/emojis/' + imageName;
    img.dataset.emojiId = ':' + id + ':';
    img.className = 'inputEmojiChip';
    img.alt = ':' + id + ':';
    const startPos = getTextNodeAtOffset(el, partialStart);
    const endPos = getTextNodeAtOffset(el, partialEnd);
    if (startPos && endPos) {
      const range = document.createRange();
      range.setStart(startPos.node, startPos.offset);
      range.setEnd(endPos.node, endPos.offset);
      range.deleteContents();
      range.insertNode(img);
      range.setStartAfter(img);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      el.appendChild(img);
    }
    el.focus();
  }

  function convertEmojiSyntaxToChips() {
    const el = inputBarRef.current;
    const emojiPattern = /:[a-zA-Z0-9_]+:/g;
    const textNodes = Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
    let lastImg = null;
    for (const textNode of textNodes) {
      const text = textNode.textContent;
      const matches = [...text.matchAll(emojiPattern)].filter(m => emoji?.find(e => e.id === m[0].slice(1, -1)));
      if (!matches.length) continue;
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      for (const match of matches) {
        const emojiObj = emoji?.find(e => e.id === match[0].slice(1, -1));
        if (match.index > lastIndex) fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        const img = document.createElement('img');
        img.src = '/images/emojis/' + emojiObj.imageName;
        img.dataset.emojiId = match[0];
        img.className = 'inputEmojiChip';
        img.alt = match[0];
        fragment.appendChild(img);
        lastImg = img;
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      textNode.parentNode.replaceChild(fragment, textNode);
    }
    return lastImg;
  }

  function insertGifAtCursor(url, previewUrl) {
    const img = document.createElement('img');
    img.src = previewUrl;
    img.dataset.gifUrl = url;
    img.className = 'inputGifChip';
    const el = inputBarRef.current;
    const sel = window.getSelection();
    const selectionInInput = sel?.rangeCount && el.contains(sel.getRangeAt(0).commonAncestorContainer);
    if (selectionInInput) {
      const range = sel.getRangeAt(0);
      range.collapse(false);
      range.insertNode(img);
      range.setStartAfter(img);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      el.appendChild(img);
      const range = document.createRange();
      range.setStartAfter(img);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    el.focus();
  }

  // --- end helpers ---

  function handleInputFn(text) {
    return handleInput.handle(text, socket, store, channelName, addMessage, user, channelState);
  }

  function replaceSelectedWord(word, sel) {
    const el = inputBarRef.current;
    if (el.querySelector('img')) { el.focus(); return; }
    const text = el.innerText;
    const lastSpace = text.lastIndexOf(' ', sel - 1);
    const wordStart = lastSpace !== -1 ? lastSpace + 1 : 0;
    let wordEnd = text.indexOf(' ', sel);
    if (wordEnd === -1) wordEnd = text.length;
    el.innerText = text.slice(0, wordStart) + word + text.slice(wordEnd);
    // Reposition cursor after the inserted word
    const newPos = wordStart + word.length;
    const textNode = el.firstChild;
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      const range = document.createRange();
      range.setStart(textNode, Math.min(newPos, textNode.length));
      range.collapse(true);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(range);
    }
    el.focus();
  }

  function getEmojis(input = '', sel) {
    let wordStart = input.lastIndexOf(':', sel);
    if (wordStart === -1) return null;
    let wordEnd = input.indexOf(' ', wordStart + 1);
    if (wordEnd === -1) wordEnd = input.length;
    if (sel < wordStart || sel > wordEnd) return null;
    if (input.substring(wordStart + 2, sel).indexOf(':') !== -1) return null;
    const word = input.substring(wordStart, wordEnd).toLowerCase();
    if ((input[wordStart - 1] !== ' ' && input[wordStart - 1] !== ':' && input[wordStart - 1] !== '$') && wordStart !== 0) return null;
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
    if (event.ctrlKey && event.key === 'g') {
      event.preventDefault();
      setShowGif(s => !s);
      if (!showGif) setGifInitialQuery(null);
      return;
    }

    if (event.which === 13) {
      if (!event.shiftKey) {
        event.preventDefault();
        const inputText = getInputText();
        if (!inputText) return;

        // /gif [query] — open picker instead of sending
        const gifMatch = /^\/gif\s*([\s\S]*)/.exec(inputText.trim());
        if (gifMatch) {
          const q = gifMatch[1].trim() || null;
          setGifInitialQuery(q);
          setShowGif(true);
          clearInput();
          setGhostText('');
          setInputAuto(null); setEmojis(null);
          return;
        }

        if (inputAuto?.length) {
          const selected = inputAuto[inputIndex];
          if (selected.imageName) {
            const text = getPlainText();
            const wordStart = text.lastIndexOf(':', selectionStart);
            let wordEnd = text.indexOf(' ', wordStart + 1);
            if (wordEnd === -1) wordEnd = text.length;
            insertEmojiChip(selected.id, selected.imageName, wordStart, wordEnd);
          } else {
            replaceSelectedWord(selected.replaceWith + ' ', selectionStart);
          }
          setInputAuto(null); setEmojis(null);
          setGhostText(getParamGhost(getPlainText()));
        } else {
          historyIndexRef.current = -1;
          historyRef.current.unshift(inputText);
          try {
            handleInputFn(inputText);
          } catch (e) {
            console.error(e);
            addMessage({ message: e.message, type: 'error', count: 'error' + Math.random() });
          }
          clearInput();
          setGhostText('');
        }
      }
    } else if (event.which === 9) {
      event.preventDefault();
      const inputText = getInputText();
      const caretOffset = getCaretOffset();
      if (inputAuto) {
        const next = event.shiftKey
          ? (inputIndex <= 0 ? inputAuto.length - 1 : inputIndex - 1)
          : (inputIndex >= inputAuto.length - 1 ? 0 : inputIndex + 1);
        setInputIndex(next);
        setGhostText(computeGhostText(inputText, selectionStart, inputAuto[next].replaceWith));
      } else {
        const nicks = getNicks(inputText, caretOffset || selectionStart);
        if (nicks?.length) {
          setGhostText(computeGhostText(inputText, caretOffset, nicks[0].replaceWith));
          setInputAuto(nicks); setSelectionStart(caretOffset); setInputIndex(0);
        }
      }
    } else if (event.shiftKey) {
      const el = inputBarRef.current;
      let navigated = false;
      if (event.which === 40 && historyIndexRef.current > 0) {
        el.innerText = historyRef.current[--historyIndexRef.current];
        navigated = true;
      } else if (event.which === 38 && historyIndexRef.current < historyRef.current.length - 1) {
        el.innerText = historyRef.current[++historyIndexRef.current];
        navigated = true;
      }
      if (navigated) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      updateAutoComplete(getPlainText(), getCaretOffset());
    }
  }

  function handleKeyUp() {
    if (!inputAuto) updateAutoComplete(getPlainText(), getCaretOffset());
  }

  function handlePaste(e) {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;
      const ext = file.type.split('/')[1] || 'png';
      const formData = new FormData();
      formData.append('image', file, `paste.${ext}`);
      fetch('/a/upload/image', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
          if (data.url) socket.emit('message', { message: window.location.origin + data.url });
        });
      return;
    }
    // Paste as plain text to avoid injecting HTML formatting into contenteditable
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (text) {
      document.execCommand('insertText', false, text);
      const lastImg = convertEmojiSyntaxToChips();
      if (lastImg) {
        const range = document.createRange();
        range.setStartAfter(lastImg);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const text = e.dataTransfer?.getData('text/plain') ?? '';
    if (!text) return;
    inputBarRef.current?.focus();
    document.execCommand('insertText', false, text);
    convertEmojiSyntaxToChips();
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
        selectEmoji={(id) => {
          const emojiObj = emoji?.find(e => e.id === id);
          if (!emojiObj) return;
          const text = getPlainText();
          const wordStart = text.lastIndexOf(':', selectionStart);
          let wordEnd = text.indexOf(' ', wordStart + 1);
          if (wordEnd === -1) wordEnd = text.length;
          insertEmojiChip(id, emojiObj.imageName, wordStart, wordEnd);
          setInputAuto(null); setEmojis(null); setGhostText('');
        }}
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
        initialQuery={gifInitialQuery}
        onSelect={(url, previewUrl) => {
          insertGifAtCursor(url, previewUrl);
        }}
        onClose={() => { setShowGif(false); setGifInitialQuery(null); }}
      /> : null}
      <FlairBuilder
        open={showStyle}
        onClose={() => setShowStyle(false)}
        onApply={(flair) => handleInputFn('/flair ' + flair)}
        emojis={emoji}
        user={user}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '6px 5px' }}>
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
            <div
              contentEditable="true"
              ref={inputBarRef}
              data-placeholder="Type anything then press enter."
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              onInput={() => updateAutoComplete(getPlainText(), getCaretOffset())}
              onClick={handleKeyUp}
              onPaste={handlePaste}
              onDrop={handleDrop}
              className="chatInput"
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
          <div
            className={'inputBarBtn' + (showGif ? ' inputBarBtn--active' : '')}
            title="Send a GIF"
            onClick={() => setShowGif(s => !s)}
          >
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
