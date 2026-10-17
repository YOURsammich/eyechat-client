import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { EmojiUploadForm } from './Emojis';
import { useEmojiFavourites, setPinned, emojiSections, MAX_PINS } from './emojiFavourites';

// The emoji side panel (feedback #102, with #96's "browse them all" and #76's
// pins): docked on the right of the chat, full height, opened by the smiley in
// the input. A search box, then Pinned, Most used and every emoji in the room A
// to Z. A click puts the emoji in the message and leaves the panel open, so
// several can go in; the star on each pins it (accounts only). Typing ":" still
// opens the small popup (Emojis.jsx), not this.

function EmojiCell({ emoji, pinned, canPin, full, onPick }) {
  const star = canPin ? (
    <button
      type='button'
      className={'emojiStar' + (pinned ? ' on' : '')}
      title={pinned ? 'Unpin' : full ? MAX_PINS + ' pins max' : 'Pin'}
      aria-label={pinned ? 'Unpin ' + emoji.id : 'Pin ' + emoji.id}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => { e.stopPropagation(); if (pinned || !full) setPinned(emoji.id, !pinned); }}
    >{pinned ? '★' : '☆'}</button>
  ) : null;
  return (
    <div
      className='emojiCell'
      title={':' + emoji.id + ':'}
      // Keeps the caret where it was in the message box.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(emoji)}
    >
      <img src={'/images/emojis/' + emoji.imageName} alt={':' + emoji.id + ':'} loading='lazy' />
      {star}
    </div>
  );
}

EmojiCell.propTypes = {
  emoji: PropTypes.object.isRequired,
  pinned: PropTypes.bool,
  canPin: PropTypes.bool,
  full: PropTypes.bool,
  onPick: PropTypes.func.isRequired,
};

export default function EmojiPanel({ emojis, addMessage, onPick, onClose }) {
  const favs = useEmojiFavourites();
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState(false);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => (q ? (emojis ?? []).filter(e => e.id.toLowerCase().includes(q)) : (emojis ?? [])),
    [emojis, q]
  );
  const { pinned, used, all } = useMemo(() => emojiSections(shown, favs), [shown, favs]);
  const pinSet = new Set(favs.pins);
  const full = favs.pins.length >= MAX_PINS;

  const section = (title, list, cls) => (list.length ? (
    <div className={'emojiSection ' + cls}>
      <div className='emojiSectionTitle'>{title}</div>
      <div className='emojiGrid'>
        {list.map(e => (
          <EmojiCell key={e.id} emoji={e} pinned={pinSet.has(e.id)} canPin={favs.account} full={full} onPick={onPick} />
        ))}
      </div>
    </div>
  ) : null);

  return (
    <div className='emojiPanel'>
      <div className='emojiPanelHead'>
        <span className='emojiPanelTitle'>Emoji</span>
        <button type='button' className='emojiPanelUpload' onClick={() => setUploading(u => !u)}>
          {uploading ? 'Back to emoji' : 'Upload emoji'}
        </button>
        <button type='button' className='emojiPanelClose material-symbols-outlined' title='Close' onClick={onClose}>close</button>
      </div>
      {uploading ? (
        <div className='emojiPanelBody'>
          <EmojiUploadForm addMessage={addMessage} onDone={() => setUploading(false)} />
        </div>
      ) : (
        <>
          <input
            className='emojiPanelSearch'
            type='text'
            placeholder='Search emoji'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className='emojiPanelBody'>
            {section('Pinned', pinned, 'pinned')}
            {section('Most used', used, 'used')}
            {section(q ? 'All matching' : 'All emoji', all, 'all')}
            {!all.length ? <div className='emojiPanelNone'>No emoji match “{query.trim()}”.</div> : null}
          </div>
        </>
      )}
    </div>
  );
}

EmojiPanel.propTypes = {
  emojis: PropTypes.array,
  addMessage: PropTypes.func,
  onPick: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
