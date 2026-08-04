import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

// Equip / remove / upload a custom pointer. The catalog is shared and public —
// everyone can pick from and add to it (see db.getCursors on the server) — so,
// unlike hats, this panel also offers an upload form. Persisting the pick goes
// through /a/cursor, mirroring /a/hat (accepts null to unequip).
function CursorPicker({ user, cursors = [] }) {
  const [status, setStatus] = useState(null); // null | 'saving' | 'error'
  const [uploadState, setUploadState] = useState(null); // null | 'uploading' | 'error'
  // True once the worn cursor's image 404s — covers an equipped filename whose
  // file no longer exists (e.g. from before this catalog existed).
  const [wornMissing, setWornMissing] = useState(false);
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

  return (
    <div className='cosCursor'>
      <div className='cosCursorPreview'>
        {worn ? (
          <>
            {!wornMissing && (
              <img className='cosCursorWorn' src={'/images/cursors/' + worn} alt={worn} onError={() => setWornMissing(true)} />
            )}
            <span className='cosCursorWornName'>
              {worn.split('.')[0]}{wornMissing ? ' (image missing)' : ''}
            </span>
          </>
        ) : (
          <span className='cosHint'>No cursor equipped</span>
        )}
      </div>

      {cursors.length === 0 ? (
        <div className='cosHint'>No cursors uploaded yet — be the first.</div>
      ) : (
        <div className='cosCursorGrid'>
          {cursors.map(c => (
            <div
              key={c.cursorName}
              className={'cosCursorTile' + (c.cursor === worn ? ' selected' : '')}
              title={c.cursorName}
              // Clicking the equipped cursor takes it off, matching HatPicker.
              onClick={() => equip(c.cursor === worn ? null : c.cursor)}
            >
              <img src={'/images/cursors/' + c.cursor} alt={c.cursorName} loading='lazy' />
              <span>{c.cursorName}</span>
            </div>
          ))}
        </div>
      )}

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
  user: PropTypes.object,
  cursors: PropTypes.array,
};

export default CursorPicker;
