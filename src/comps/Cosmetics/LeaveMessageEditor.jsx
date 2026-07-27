import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ParsedContent } from '../Chat/Messages';

// Your leave message: the tail appended to the notice the room sees when your
// last connection drops. It carries its author's markup (emoji, color, font),
// which is why it renders through the parser here too — see the `userText`
// handling in renderMessageContent for how the notice keeps the two halves apart.
function LeaveMessageEditor({ user, emojis }) {
  const [message, setMessage] = useState(user?.part || '');
  const [status, setStatus] = useState(null); // null | 'saving' | 'saved' | 'error'

  // Follow the stored message when it changes underneath us — notably when
  // activating a style profile rewrites it.
  useEffect(() => {
    setMessage(user?.part || '');
    setStatus(null);
  }, [user?.part]);

  function save(value) {
    setStatus('saving');
    fetch('/a/part', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ part: value }),
    })
      .then(r => r.json())
      .then(d => setStatus(d.error ? 'error' : 'saved'))
      .catch(() => setStatus('error'));
  }

  const trimmed = message.trim();

  return (
    <div className='cosPart'>
      <label className='cosField'>
        <span className='cosFieldLabel'>Leave message</span>
        <input
          className='stdInput'
          placeholder='e.g. #f0fhas ascended'
          maxLength={200}
          value={message}
          onChange={e => { setMessage(e.target.value); setStatus(null); }}
        />
      </label>

      <div className='cosField'>
        <span className='cosFieldLabel'>Preview</span>
        <div className='cosPreviewBox'>
          <span className='cosPartNotice'>{(user?.nick || 'you') + ' left '}</span>
          {trimmed
            ? <ParsedContent text={trimmed} emojis={emojis} compact />
            : <span className='cosHint'>no message</span>}
        </div>
      </div>

      <p className='cosHint'>
        Takes the same markup as a message — colors like <code>#f0f</code>, fonts
        like <code>$Comic Neue|</code>, and <code>:emoji:</code>.
      </p>

      <div className='cosActions'>
        <button
          className='stdBtn ghost'
          disabled={status === 'saving' || !user?.part}
          onClick={() => { setMessage(''); save(null); }}
        >
          Clear
        </button>
        <button className='stdBtn' disabled={status === 'saving'} onClick={() => save(trimmed || null)}>
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved!' : status === 'error' ? 'Error — try again' : 'Save leave message'}
        </button>
      </div>
    </div>
  );
}

LeaveMessageEditor.propTypes = {
  user:   PropTypes.object,
  emojis: PropTypes.array,
};

export default LeaveMessageEditor;
