import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ParsedContent, preloadFontsFromText } from '../Chat/Messages';
import { composeTextStyle } from '../../utils/textstyle';

// The styles a text style can carry, in the same token language message bodies
// and flair use. A subset of the flair builder's set: tokens that only make sense
// on a short nick (spin, shake) are punishing to read across a whole message.
const STYLE_TOKENS = [
  { token: '/*', label: 'B',   title: 'Bold' },
  { token: '/%', label: 'I',   title: 'Italic' },
  { token: '/_', label: 'U̲',   title: 'Underline' },
  { token: '/!', label: '🌈',  title: 'Rainbow' },
  { token: '/&', label: '〜',  title: 'Wavy' },
  { token: '/^', label: 'A+',  title: 'Bigger' },
  { token: '/~', label: 'a-',  title: 'Smaller' },
];

const PREVIEW_TEXT = 'the quick brown fox';

// Read the four stored properties into editor state. No parsing involved — each
// arrives in its own field, which is the point of storing them as columns.
function toEditorState(user) {
  return {
    color: user?.color || '',
    glow:  user?.glow || '',
    font:  user?.font || '',
    styles: Array.isArray(user?.style) ? user.style : [],
  };
}

// A persistent style applied to every message you send, held as four independent
// properties (color, glow, font, style) on your user row. The server composes them
// into a markup prefix when a message is sent and snapshots it onto that message,
// so old lines keep the look they were sent with. Because the prefix goes on
// outside the message body, inline markup you type still wins.
function TextStyleEditor({ user, emojis }) {
  const [state, setState] = useState(() => toEditorState(user));
  const [status, setStatus] = useState(null); // null | 'saving' | 'saved' | 'error'

  // Follow the stored properties when they change underneath us — notably when
  // activating a style profile rewrites them.
  useEffect(() => {
    setState(toEditorState(user));
    setStatus(null);
  }, [user?.color, user?.glow, user?.font, user?.style]);

  // The editor keeps the four properties apart; this is only for the live preview
  // and the raw readout. `styles` is the editor's name for the `style` column.
  const styleStr = composeTextStyle({ ...state, style: state.styles }) ?? '';

  useEffect(() => {
    preloadFontsFromText(styleStr);
  }, [styleStr]);

  function patch(next) {
    setState(prev => ({ ...prev, ...next }));
    setStatus(null);
  }

  function toggleStyle(token) {
    setState(prev => ({
      ...prev,
      styles: prev.styles.includes(token)
        ? prev.styles.filter(s => s !== token)
        : [...prev.styles, token],
    }));
    setStatus(null);
  }

  // Sends the four properties, not the composed string — the server validates and
  // stores each one, and drops any it can't accept without touching the others.
  function save({ color, glow, font, styles }) {
    setStatus('saving');
    fetch('/a/textstyle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color: color || null, glow: glow || null, font: font || null, style: styles }),
    })
      .then(r => r.json())
      .then(d => setStatus(d.error ? 'error' : 'saved'))
      .catch(() => setStatus('error'));
  }

  const empty = { color: '', glow: '', font: '', styles: [] };
  const hasStored = !!(user?.color || user?.glow || user?.font || user?.style?.length);

  return (
    <div className='cosText'>
      <div className='cosTextPreview'>
        {/* Parsed exactly as a real message is: the prefix in front of the body. */}
        <ParsedContent text={styleStr + PREVIEW_TEXT} emojis={emojis} />
      </div>

      <div className='cosField'>
        <span className='cosFieldLabel'>Styles</span>
        <div className='cosTokenRow'>
          {STYLE_TOKENS.map(({ token, label, title }) => (
            <button
              key={token}
              title={title}
              className={'cosTokenBtn' + (state.styles.includes(token) ? ' on' : '')}
              onClick={() => toggleStyle(token)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className='cosField'>
        <span className='cosFieldLabel'>Color</span>
        <div className='cosColorRow'>
          <input
            type='color'
            className='cosColorPick'
            value={state.color ? '#' + state.color : '#ffffff'}
            onChange={e => patch({ color: e.target.value.slice(1) })}
          />
          <input
            className='stdInput cosHex'
            placeholder='hex'
            maxLength={6}
            value={state.color}
            onChange={e => patch({ color: e.target.value.replace(/[^0-9a-fA-F]/g, '') })}
          />
          {state.color && <span className='cosClear' onClick={() => patch({ color: '' })} title='Clear color'>✕</span>}
        </div>
      </div>

      <div className='cosField'>
        <span className='cosFieldLabel'>Glow</span>
        <div className='cosColorRow'>
          <input
            type='color'
            className='cosColorPick'
            value={state.glow ? '#' + state.glow : '#ffffff'}
            onChange={e => patch({ glow: e.target.value.slice(1) })}
          />
          <input
            className='stdInput cosHex'
            placeholder='hex'
            maxLength={6}
            value={state.glow}
            onChange={e => patch({ glow: e.target.value.replace(/[^0-9a-fA-F]/g, '') })}
          />
          {state.glow && <span className='cosClear' onClick={() => patch({ glow: '' })} title='Clear glow'>✕</span>}
        </div>
      </div>

      <label className='cosField'>
        <span className='cosFieldLabel'>Font</span>
        {/* Any Google Fonts family name; it is fetched on demand by loadFont. */}
        <input
          className='stdInput'
          placeholder='e.g. Comic Neue'
          maxLength={40}
          value={state.font}
          onChange={e => patch({ font: e.target.value.replace(/[|$]/g, '') })}
        />
        <span className='cosHint'>Any Google Fonts family name.</span>
      </label>

      {styleStr && <div className='cosRaw'>{styleStr}</div>}

      <div className='cosActions'>
        <button
          className='stdBtn ghost'
          disabled={status === 'saving' || !hasStored}
          onClick={() => { setState(empty); save(empty); }}
        >
          Clear
        </button>
        <button className='stdBtn' disabled={status === 'saving'} onClick={() => save(state)}>
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved!' : status === 'error' ? 'Error — try again' : 'Apply text style'}
        </button>
      </div>
    </div>
  );
}

TextStyleEditor.propTypes = {
  user:   PropTypes.object,
  emojis: PropTypes.array,
};

export default TextStyleEditor;
