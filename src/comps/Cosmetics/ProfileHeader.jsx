import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import ProfilePreview, { preloadProfileFonts } from './ProfilePreview';
import { liveBundle, driftedAspects, definedAspects, MAX_PROFILES } from './profiles';

// Sits at the top of the cosmetics menu: which style profile you have selected,
// and the controls to switch, save into, revert, or start a new one.
//
// Profiles are snapshots, not a live binding. Editing an aspect changes your look
// and leaves the saved profile alone, so this reports the difference ("modified")
// and offers Save (overwrite the profile from your look) and Revert (re-apply the
// profile over your look). Profiles are per-account, so guests get a prompt to
// log in instead.
function ProfileHeader({ user, emojis }) {
  const [profiles, setProfiles] = useState([]);
  const [listOpen, setListOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const registered = !!user?.registered;
  const activeId = user?.activeProfileId ?? null;
  // Ids are bigints, which arrive as numbers from the DB but can reach us as
  // strings; compare loosely so the active row is still recognised.
  const active = profiles.find(p => String(p.id) === String(activeId)) ?? null;
  const drift = driftedAspects(user, active);
  const modified = drift.length > 0;
  // Only creating a profile is capped; overwriting the selected one never is.
  const atCap = profiles.length >= MAX_PROFILES;

  useEffect(() => {
    if (!registered) {
      setProfiles([]);
      return;
    }
    fetch('/a/profiles')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        preloadProfileFonts(data);
        setProfiles(data);
      })
      .catch(() => {});
  }, [registered]);

  // Every mutation returns the caller to a settled state: the server owns the
  // active-profile pointer and pushes the applied cosmetics back as live state
  // changes, so there is nothing to optimistically mirror except the list itself.
  function run(promise) {
    setBusy(true);
    setError('');
    return promise
      .then(data => {
        if (data?.error) setError(data.error);
        return data;
      })
      .catch(() => setError('Could not reach the server.'))
      .finally(() => setBusy(false));
  }

  // Save the current look: into `id` when overwriting the selected profile, or as
  // a new one when there's no id. The server assigns the id and echoes the stored
  // row back, so the list takes what it returns rather than guessing.
  function save(id) {
    const bundle = liveBundle(user);
    const req = id
      ? { url: `/a/profiles/${encodeURIComponent(id)}`, method: 'PUT' }
      : { url: '/a/profiles', method: 'POST' };

    return run(
      fetch(req.url, {
        method: req.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bundle),
      }).then(r => r.json())
    ).then(data => {
      if (data?.error || !data?.profile) return;
      preloadProfileFonts([data.profile]);
      setProfiles(prev => {
        const others = prev.filter(p => String(p.id) !== String(data.profile.id));
        return [...others, data.profile].sort((a, b) => Number(a.id) - Number(b.id));
      });
      setListOpen(false);
    });
  }

  function activate(id) {
    return run(
      fetch(`/a/profiles/${encodeURIComponent(id)}/activate`, { method: 'POST' })
        .then(r => r.json())
    ).then(data => {
      if (!data?.error) setListOpen(false);
    });
  }

  function remove(id) {
    return run(
      fetch(`/a/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(r => r.json())
    ).then(data => {
      if (!data?.error) setProfiles(prev => prev.filter(p => String(p.id) !== String(id)));
    });
  }

  if (!registered) {
    return (
      <div className='cosProfile'>
        <div className='cosProfileTop'>
          <span className='cosProfileEyebrow'>Style profile</span>
        </div>
        <div className='cosProfileGuest'>
          Log in from the Account menu to save style profiles. You can still change
          every cosmetic below — it just won&apos;t persist past this session.
        </div>
      </div>
    );
  }

  return (
    <div className='cosProfile'>
      <div className='cosProfileTop'>
        <span className='cosProfileEyebrow'>Style profile</span>
        {modified && (
          <span className='cosProfileDirty' title={`Differs from the saved profile: ${drift.join(', ')}`}>
            modified
          </span>
        )}
      </div>

      <div className='cosProfileRow'>
        <button
          className='cosProfileCurrent'
          onClick={() => setListOpen(o => !o)}
          title='Switch profile'
        >
          <span className='cosProfileName'>
            <ProfilePreview profile={active} user={user} emojis={emojis} />
          </span>
          <span className='material-symbols-outlined'>{listOpen ? 'expand_less' : 'expand_more'}</span>
        </button>
      </div>

      {listOpen && (
        <div className='cosProfileList'>
          {profiles.length === 0 && <div className='cosHint'>No profiles saved yet.</div>}
          {profiles.map(p => (
            <div className={'cosProfileItem' + (String(p.id) === String(activeId) ? ' active' : '')} key={p.id}>
              <div className='cosProfileItemBody' onClick={() => activate(p.id)} title='Switch to this profile'>
                <ProfilePreview profile={p} user={user} emojis={emojis} />
                <span className='cosProfileAspects'>{describeAspects(p)}</span>
              </div>
              <span
                className='material-symbols-outlined cosProfileDelete'
                onClick={() => remove(p.id)}
                title='Delete profile'
              >close</span>
            </div>
          ))}
        </div>
      )}

      <div className='cosProfileActions'>
        {/* Save targets the selected profile's id and overwrites it. With nothing
            selected there's nothing to overwrite, so it creates the first profile
            instead — either way, one button means "store how I look right now".
            Not gated on `modified`: a profile that simply doesn't set an aspect
            never reads as modified, so this is also how you fold a newly-added hat
            or text style into it. */}
        <button
          className='stdBtn ghost'
          // Disabled at the cap only when it would be creating: with a profile
          // selected this overwrites, which is always allowed.
          disabled={busy || (!active && atCap)}
          onClick={() => save(active?.id ?? null)}
          title={active ? 'Overwrite the selected profile with your current look' : 'Save your current look as a profile'}
        >
          Save
        </button>

        {/* Only meaningful once something is selected — without this, Save would
            overwrite forever and you could never get a second profile. */}
        {active && (
          <>
            <button
              className='stdBtn ghost'
              disabled={busy || atCap}
              onClick={() => save(null)}
              title={atCap
                ? `You already have ${MAX_PROFILES} profiles — delete one to make room`
                : 'Keep the selected profile and save this look as a new one'}
            >
              Save as new
            </button>
            <button className='stdBtn ghost' disabled={busy || !modified} onClick={() => activate(active.id)} title='Discard changes and re-apply the selected profile'>
              Revert
            </button>
          </>
        )}
      </div>

      {atCap && (
        <div className='cosHint'>
          {MAX_PROFILES} of {MAX_PROFILES} profiles used — delete one to save another.
          You can still overwrite the selected profile.
        </div>
      )}

      {error && <div className='cosError'>{error}</div>}
    </div>
  );
}

function describeAspects(profile) {
  const set = definedAspects(profile);
  return set.length ? set.join(' · ') : 'empty';
}

ProfileHeader.propTypes = {
  user:   PropTypes.object,
  emojis: PropTypes.array,
};

export default ProfileHeader;
