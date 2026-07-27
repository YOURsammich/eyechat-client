import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import ProfilePreview, { preloadProfileFonts } from './ProfilePreview';
import { driftedAspects } from './profiles';

// The quick switcher behind the input bar's palette button. Deliberately does not
// edit anything: it lists your saved style profiles so switching your whole look
// mid-conversation is one click, and hands off to the Cosmetics side menu for
// actual adjustments. (This used to open the flair builder inline, which meant
// the input bar was the only way to reach one aspect of a much larger surface.)
function ProfileSwitcher({ user, emojis, onClose, onOpenCosmetics }) {
  const [profiles, setProfiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef(null);

  const registered = !!user?.registered;
  const activeId = user?.activeProfileId ?? null;
  // Ids are bigints, which arrive as numbers from the DB but can reach us as
  // strings; compare loosely so the active row is still recognised.
  const active = profiles.find(p => String(p.id) === String(activeId)) ?? null;
  const modified = driftedAspects(user, active).length > 0;

  useEffect(() => {
    if (!registered) return;
    fetch('/a/profiles')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        preloadProfileFonts(data);
        setProfiles(data);
      })
      .catch(() => {});
  }, [registered]);

  // Click-away closes, like the other input-bar popouts.
  useEffect(() => {
    function onDocClick(e) {
      if (!rootRef.current || rootRef.current.contains(e.target)) return;
      // The palette button toggles us itself; ignore it so a click there doesn't
      // close and immediately reopen.
      if (e.target.closest?.('.inputBarBtn')) return;
      onClose();
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [onClose]);

  function activate(id) {
    setBusy(true);
    fetch(`/a/profiles/${encodeURIComponent(id)}/activate`, { method: 'POST' })
      .then(r => r.json())
      .catch(() => {})
      .finally(() => { setBusy(false); onClose(); });
  }

  return (
    <div className='profileSwitcher' ref={rootRef}>
      <div className='psHeader'>
        <span className='psTitle'>Style profiles</span>
        <span className='material-symbols-outlined psClose' onClick={onClose} title='Close'>close</span>
      </div>

      {!registered ? (
        <div className='psEmpty'>Log in to save and switch style profiles.</div>
      ) : profiles.length === 0 ? (
        <div className='psEmpty'>No profiles yet — build a look and save it from the Cosmetics menu.</div>
      ) : (
        <div className='psList'>
          {profiles.map(p => (
            <div
              key={p.id}
              className={'psItem' + (String(p.id) === String(activeId) ? ' active' : '')}
              onClick={() => !busy && activate(p.id)}
              title={String(p.id) === String(activeId) ? 'Re-apply this profile' : 'Switch to this profile'}
            >
              {/* A profile has no name — it's identified by how it looks. The
                  aspect list the side menu shows is deliberately left out: at this
                  size it crowds out the thing you're actually picking by. */}
              <ProfilePreview profile={p} user={user} emojis={emojis} />
              {String(p.id) === String(activeId) && (
                <span className='psItemState'>{modified ? 'modified' : 'active'}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <button className='psMore' onClick={() => { onOpenCosmetics(); onClose(); }}>
        <span className='material-symbols-outlined'>tune</span>
        More styling options
        <span className='material-symbols-outlined psMoreChevron'>chevron_right</span>
      </button>
    </div>
  );
}

ProfileSwitcher.propTypes = {
  user:             PropTypes.object,
  emojis:           PropTypes.array,
  onClose:          PropTypes.func.isRequired,
  onOpenCosmetics:  PropTypes.func.isRequired,
};

export default ProfileSwitcher;
