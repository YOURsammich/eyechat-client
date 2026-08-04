import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { cursorSrc, cursorLabel, emojiCursor, isEmojiCursor } from '../../utils/cursors';

// Cap how many emoji tiles we render at once — same reasoning as the avatar
// builder's quick-pick, which this mirrors: the room can have thousands.
const EMOJI_RENDER_CAP = 60;

// Equip / remove / upload a custom pointer. Two catalogs feed the one slot:
// the room's chat emojis (shared, the same grid the avatar builder picks from)
// and uploaded cursor files, which — unlike hats — anyone can add to, so this
// panel carries an upload form as well. Persisting the pick goes through
// /a/cursor, mirroring /a/hat (accepts null to unequip).
function CursorPicker({ user, cursors = [], emojis = [] }) {
  const [status, setStatus] = useState(null); // null | 'saving' | 'error'
  const [uploadState, setUploadState] = useState(null); // null | 'uploading' | 'error'
  // True once the worn cursor's image 404s — covers an equipped filename whose
  // file no longer exists (e.g. from before this catalog existed).
  const [wornMissing, setWornMissing] = useState(false);
  const [search, setSearch] = useState('');
  const fileRef = useRef(null);

  const worn = user?.cursor || null;

  useEffect(() => { setWornMissing(false); }, [worn]);

  function equip(cursor) {
    setStatus('saving');
    fetch('/a/cursor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cursor }),
    })
      .then(r => r.json())
      // The server pushes the change back as a live state change, so there is
      // nothing to set here — `worn` follows the user prop.
      .then(d => setStatus(d.error ? 'error' : null))
      .catch(() => setStatus('error'));
  }

  // Clicking the worn one takes it off, matching HatPicker.
  function toggleEquip(value) {
    equip(value === worn ? null : value);
  }

  function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadState('uploading');

    const formData = new FormData();
    formData.append('cursor', file);
    fetch('/a/upload/cursor', { method: 'POST', body: formData })
      .then(r => r.json())
      .then((res) => {
        if (res.error) {
          setUploadState('error');
          return;
        }
        setUploadState(null);
        // Newly uploaded cursors don't reach this catalog list until the next
        // channelInfo (or someone else's setState) — equip it straight away so
        // uploading feels like it did something.
        equip(res.cursor);
      })
      .catch(() => setUploadState('error'))
      .finally(() => { if (fileRef.current) fileRef.current.value = ''; });
  }

  const q = search.trim().toLowerCase();
  const matchedEmojis = q ? emojis.filter(e => e.id.toLowerCase().includes(q)) : emojis;
  const shownEmojis = matchedEmojis.slice(0, EMOJI_RENDER_CAP);

  const wornName = worn && (isEmojiCursor(worn) ? worn.slice('emoji:'.length) : worn);

  return (
    <div className='cosCursor'>
      <div className='cosCursorPreview'>
        {worn ? (
          <>
            {!wornMissing && (
              <img className='cosCursorWorn' src={cursorSrc(worn)} alt={wornName} onError={() => setWornMissing(true)} />
            )}
            <span className='cosCursorWornName'>
              {cursorLabel(wornName)}{wornMissing ? ' (image missing)' : ''}
            </span>
          </>
        ) : (
          <span className='cosHint'>No cursor equipped</span>
        )}
      </div>

      <div className='cosCursorSection'>
        <div className='cosHint'>Use a chat emoji as your cursor</div>
        <input
          type='text'
          className='stdInput cosEmojiSearch'
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder='Search emojis…'
        />
        {emojis.length === 0 ? (
          <div className='cosHint'>No chat emojis uploaded yet.</div>
        ) : matchedEmojis.length === 0 ? (
          <div className='cosHint'>No emojis match “{search.trim()}”.</div>
        ) : (
          <>
            <div className='cosEmojiGrid'>
              {shownEmojis.map(e => (
                <img
                  key={e.id}
                  className={'cosEmojiTile' + (worn === emojiCursor(e.imageName) ? ' selected' : '')}
                  src={`/images/emojis/${e.imageName}`}
                  title={e.id}
                  loading='lazy'
                  onClick={() => toggleEquip(emojiCursor(e.imageName))}
                />
              ))}
            </div>
            {matchedEmojis.length > shownEmojis.length && (
              <div className='cosHint'>
                Showing {shownEmojis.length} of {matchedEmojis.length} — keep typing to narrow it down.
              </div>
            )}
          </>
        )}
      </div>

      <div className='cosCursorSection'>
        <div className='cosHint'>Or an uploaded cursor</div>
        {cursors.length === 0 ? (
          <div className='cosHint'>No cursors uploaded yet — be the first.</div>
        ) : (
          <div className='cosCursorGrid'>
            {cursors.map(c => (
              <div
                key={c.cursorName}
                className={'cosCursorTile' + (c.cursor === worn ? ' selected' : '')}
                title={c.cursorName}
                onClick={() => toggleEquip(c.cursor)}
              >
                <img src={'/images/cursors/' + c.cursor} alt={c.cursorName} loading='lazy' />
                <span>{cursorLabel(c.cursorName)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {worn && (
        <button className='stdBtn cosFullBtn' disabled={status === 'saving'} onClick={() => equip(null)}>
          Remove cursor
        </button>
      )}

      {status === 'error' && <div className='cosError'>Could not change your cursor — try again.</div>}

      <div className='cosCursorUpload'>
        <label className='stdBtn cosFullBtn'>
          {uploadState === 'uploading' ? 'Uploading…' : 'Upload a cursor'}
          <input
            ref={fileRef}
            type='file'
            accept='image/png,image/jpeg,image/gif,image/webp'
            style={{ display: 'none' }}
            disabled={uploadState === 'uploading'}
            onChange={upload}
          />
        </label>
        <div className='cosHint'>Resized to 32x32 and flattened to a static PNG — anyone in the room will be able to equip it too.</div>
        {uploadState === 'error' && <div className='cosError'>Could not upload that file — try a different image.</div>}
      </div>
    </div>
  );
}

CursorPicker.propTypes = {
  user:    PropTypes.object,
  cursors: PropTypes.array,
  emojis:  PropTypes.array,
};

export default CursorPicker;
