import { useState } from 'react';
import PropTypes from 'prop-types';

// Equip / remove the hat that renders above your nick on every message. The hat
// list is the channel's (it arrives with channelInfo); `user.hat` is the equipped
// filename. Persisting goes through /a/hat rather than the /hat command because
// the command's `hat` param is required, so it can't express "take it off".
function HatPicker({ user, hats = [] }) {
  const [status, setStatus] = useState(null); // null | 'saving' | 'error'

  const worn = user?.hat || null;

  function equip(hat) {
    setStatus('saving');
    fetch('/a/hat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hat }),
    })
      .then(r => r.json())
      // The server pushes the new hat back as a live state change, so there is
      // nothing to set here — `worn` follows the user prop.
      .then(d => setStatus(d.error ? 'error' : null))
      .catch(() => setStatus('error'));
  }

  return (
    <div className='cosHat'>
      <div className='cosHatPreview'>
        {worn ? (
          <>
            <div className='cosHatWorn' style={{ backgroundImage: `url('/images/hats/${worn}')` }} />
            <span className='cosHatWornName'>{worn.split('.')[0]}</span>
          </>
        ) : (
          <span className='cosHint'>No hat equipped</span>
        )}
      </div>

      {hats.length === 0 ? (
        <div className='cosHint'>No hats available in this channel yet.</div>
      ) : (
        <div className='cosHatGrid'>
          {hats.map(hat => (
            <div
              key={hat.hatName}
              className={'cosHatTile' + (hat.hat === worn ? ' selected' : '')}
              title={hat.hatName}
              // Clicking the equipped hat takes it off, which matches how the
              // avatar emoji quick-pick toggles.
              onClick={() => equip(hat.hat === worn ? null : hat.hat)}
            >
              <img src={'/images/hats/' + hat.hat} alt={hat.hatName} loading='lazy' />
              <span>{hat.hatName}</span>
            </div>
          ))}
        </div>
      )}

      {worn && (
        <button className='stdBtn cosFullBtn' disabled={status === 'saving'} onClick={() => equip(null)}>
          Remove hat
        </button>
      )}

      {status === 'error' && <div className='cosError'>Could not change your hat — try again.</div>}
    </div>
  );
}

HatPicker.propTypes = {
  user: PropTypes.object,
  hats: PropTypes.array,
};

export default HatPicker;
