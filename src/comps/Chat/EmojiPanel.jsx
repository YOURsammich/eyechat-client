import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { EmojiUploadForm } from './Emojis';
import { useEmojiFavourites, setPinned, emojiSections, MAX_PINS } from './emojiFavourites';

// The emoji side panel (feedback #102, with #96's "browse them all" and #76's
// pins): docked on the right of the chat, full height, opened by the smiley in
// the input. A search box, then Pinned, Most used and every emoji in the room A
// to Z. A click puts the emoji in the message and leaves the panel open, so
// several can go in; a right-click pins or unpins it, as does the star on each
// (accounts only). Typing ":" still opens the small popup (Emojis.jsx), not this.

// How "All emoji" is sorted, remembered in this browser.
const SORT_KEY = 'emojiPanelSort';
const SORTS = { used: 'Most used', name: 'A to Z' };

function readSort() {
  try {
    const v = localStorage.getItem(SORT_KEY);
    return v in SORTS ? v : 'used';
  } catch {
    return 'used';
  }
}

function EmojiCell({ emoji, pinned, canPin, full, onPick }) {
  const toggle = () => { if (pinned || !full) setPinned(emoji.id, !pinned); };
  const star = canPin ? (
    <button
      type='button'
      className={'emojiStar' + (pinned ? ' on' : '')}
      title={pinned ? 'Unpin' : full ? MAX_PINS + ' pins max' : 'Pin'}
      aria-label={pinned ? 'Unpin ' + emoji.id : 'Pin ' + emoji.id}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => { e.stopPropagation(); toggle(); }}
    >{pinned ? '★' : '☆'}</button>
  ) : null;
  return (
    <div
      className='emojiCell'
      title={':' + emoji.id + ':'}
      // Keeps the caret where it was in the message box.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(emoji)}
      onContextMenu={canPin ? (e) => { e.preventDefault(); toggle(); } : undefined}
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
  const [sort, setSort] = useState(readSort);

  function changeSort(value) {
    setSort(value);
    try { localStorage.setItem(SORT_KEY, value); } catch { /* not remembered */ }
  }

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => (q ? (emojis ?? []).filter(e => e.id.toLowerCase().includes(q)) : (emojis ?? [])),
    [emojis, q]
  );
  // A guest has no most-used, so theirs is always A to Z.
  const sortBy = favs.account ? sort : 'name';
  const { pinned, used, all } = useMemo(() => emojiSections(shown, favs, 24, sortBy), [shown, favs, sortBy]);
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
          {favs.account ? (
            <div className='emojiPanelHint'>
              {full ? MAX_PINS + ' pins max: right-click a pinned emoji to unpin it' : 'Right-click an emoji to pin it'}
            </div>
          ) : null}
          <input
            className='emojiPanelSearch'
            type='text'
            placeholder='Search emoji'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {favs.account ? (
            <label className='emojiPanelSort'>
              Sort all emoji:
              <select value={sort} onChange={(e) => changeSort(e.target.value)}>
                {Object.entries(SORTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          ) : null}
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
