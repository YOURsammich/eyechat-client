import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import AvatarDisplay from '../Chat/AvatarDisplay';
import PixelCanvas from '../Pixel/PixelCanvas';
import DrawCanvas from '../Pixel/DrawCanvas';
import DraggableWindow from '../DraggableWindow';
import AvatarComposer from '../Avatar/AvatarComposer';

const AVATAR_PART_ORDER = ['heads', 'eyes', 'noses', 'mouths', 'hair'];

// Cap how many emoji tiles we render at once — the room can have thousands, so
// rendering them all would be slow. Users narrow down with the search box.
const EMOJI_RENDER_CAP = 60;

// The avatar aspect of the cosmetics menu. Was a top-level side-menu section of
// its own before style profiles gathered every cosmetic under one menu.
function AvatarBuilder({ user, emojis = [] }) {
  const [parts, setParts] = useState({}); // the single part library, grouped by type
  const [selected, setSelected] = useState({});
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const [builderOpen, setBuilderOpen] = useState(false); // pop-out avatar builder visible
  const [builderMode, setBuilderMode] = useState('build'); // 'build' (compose) | 'part' (draw a part)
  const [drawSlot, setDrawSlot] = useState('hair'); // which slot a drawn part is published under
  const [drawMode, setDrawMode] = useState('brush'); // 'brush' (freehand) | 'pixel'
  const [partStatus, setPartStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const pixelRef = useRef(null);

  function refreshParts() {
    return fetch('/channel/getAvatarParts')
      .then(r => r.json())
      .then(data => setParts(data || {}))
      .catch(() => {});
  }

  useEffect(() => {
    refreshParts();
  }, []);

  // Track the avatar we're editing, including when activating a style profile
  // rewrites it underneath us (it arrives as a live userStateChange).
  useEffect(() => {
    if (!user?.avatar) {
      setSelected({});
      return;
    }
    try {
      const parsed = typeof user.avatar === 'string' ? JSON.parse(user.avatar) : user.avatar;
      setSelected(parsed || {});
    } catch { /* keep whatever we had */ }
  }, [user?.avatar]);

  function pickEmoji(imageName) {
    // Choosing a chat emoji replaces the whole avatar; clicking the selected
    // one again clears it.
    setSelected(prev => (prev.emoji === imageName ? {} : { emoji: imageName }));
    setStatus(null);
  }

  function persist(avatar) {
    setStatus('saving');
    return fetch('/a/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar }),
    })
      .then(r => r.json())
      .then(d => { setStatus(d.error ? 'error' : 'saved'); return d; })
      .catch(() => setStatus('error'));
  }

  function save() {
    // Persists the current selection — used by the emoji quick-pick and to
    // re-save a built avatar. Legacy layered selections are dropped now that
    // parts are composed in the builder.
    const avatar = selected.emoji ? { emoji: selected.emoji } : selected.whole ? { whole: selected.whole } : {};
    persist(avatar);
  }

  // The composer already uploaded the flattened image + project; store its ref
  // as our avatar so it renders and propagates live.
  function onBuiltAvatarSaved(avatar) {
    setSelected(avatar);
    persist(avatar);
  }

  // Publish a painted part into its type folder so anyone can import it in the
  // builder. Does not change your avatar (you compose in Build mode).
  async function publishPart() {
    if (!pixelRef.current) return;
    setPartStatus('saving');
    try {
      const blob = await pixelRef.current.exportPNGBlob();
      const formData = new FormData();
      formData.append('image', blob, 'part.png');
      formData.append('slot', drawSlot);
      const res = await fetch('/a/upload/avatarPart', { method: 'POST', body: formData }).then(r => r.json());
      if (res.error || !res.ref) { setPartStatus('error'); return; }
      await refreshParts();
      setPartStatus('saved');
    } catch {
      setPartStatus('error');
    }
  }

  const q = search.trim().toLowerCase();
  const matchedEmojis = q ? emojis.filter(e => e.id.toLowerCase().includes(q)) : emojis;
  const shownEmojis = matchedEmojis.slice(0, EMOJI_RENDER_CAP);

  // If the current avatar is a built one, its re-edit project sits beside the PNG.
  const projectUrl = selected.whole ? `/images/avatars/whole/${selected.whole.replace(/\.png$/, '.json')}` : null;

  return (
    <div className='cosAvatar'>
      <div className='cosAvatarPreview'>
        <AvatarDisplay avatar={selected} size={80} />
      </div>

      <div className='cosAvatarBody'>
        <button className='stdBtn cosAvatarOpenBtn' onClick={() => setBuilderOpen(true)}>
          <span className='material-symbols-outlined'>draw</span>
          {builderOpen ? 'Avatar builder open' : 'Open Avatar Builder'}
        </button>

        <div>
          <div className='cosHint'>Or quick-pick an emoji as your avatar</div>
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
                    className={'cosEmojiTile' + (selected.emoji === e.imageName ? ' selected' : '')}
                    src={`/images/emojis/${e.imageName}`}
                    title={e.id}
                    loading='lazy'
                    onClick={() => pickEmoji(e.imageName)}
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

        <button className='stdBtn cosFullBtn' onClick={save} disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved!' : status === 'error' ? 'Error — try again' : 'Save Avatar'}
        </button>
      </div>

      {builderOpen && (
        <DraggableWindow title='Avatar Builder' width={520} onClose={() => { setBuilderOpen(false); setPartStatus(null); }}>
          <div className='cosBuilderWin'>
            <div className='cosSegRow'>
              {[['build', 'Build Avatar'], ['part', 'Draw Part']].map(([id, label]) => (
                <button
                  key={id}
                  className={'cosSegBtn' + (builderMode === id ? ' active' : '')}
                  onClick={() => setBuilderMode(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {builderMode === 'build' ? (
              <AvatarComposer
                key={selected.whole || 'new'}
                parts={parts}
                projectUrl={projectUrl}
                onSaved={onBuiltAvatarSaved}
              />
            ) : (
              <>
                <div className='cosDrawOpts'>
                  <div>
                    <div className='cosHint'>Publish under slot</div>
                    <div className='cosSegRow wrap'>
                      {AVATAR_PART_ORDER.map(slot => (
                        <button
                          key={slot}
                          className={'cosSegBtn small capitalize' + (drawSlot === slot ? ' active' : '')}
                          onClick={() => { setDrawSlot(slot); setPartStatus(null); }}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className='cosHint'>Style</div>
                    <div className='cosSegRow'>
                      {[['brush', 'Brush'], ['pixel', 'Pixel']].map(([id, label]) => (
                        <button
                          key={id}
                          className={'cosSegBtn small' + (drawMode === id ? ' active' : '')}
                          onClick={() => setDrawMode(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {drawMode === 'pixel' ? (
                  <PixelCanvas key='pixel' ref={pixelRef} width={32} height={32} scale={14} maxViewport={520} />
                ) : (
                  <DrawCanvas key='brush' ref={pixelRef} width={128} height={128} scale={3.5} maxViewport={520} />
                )}

                <button className='stdBtn cosFullBtn' onClick={publishPart} disabled={partStatus === 'saving'}>
                  {partStatus === 'saving'
                    ? 'Publishing…'
                    : partStatus === 'saved'
                      ? `Published to ${drawSlot} — import it in Build`
                      : partStatus === 'error'
                        ? 'Error — try again'
                        : `Publish to ${drawSlot} library`}
                </button>

                {(parts[drawSlot] || []).length > 0 && (
                  <div>
                    <div className='cosHint'>Load a {drawSlot} to edit or trace</div>
                    <div className='cosPartGrid'>
                      {(parts[drawSlot] || []).map(file => (
                        <img
                          key={file}
                          className='cosPartTile'
                          src={`/images/avatars/${drawSlot}/${file}`}
                          title='Load into canvas to edit'
                          onClick={() => { pixelRef.current?.loadImage(`/images/avatars/${drawSlot}/${file}`); setPartStatus(null); }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DraggableWindow>
      )}
    </div>
  );
}

AvatarBuilder.propTypes = {
  user:   PropTypes.object,
  emojis: PropTypes.array,
};

export default AvatarBuilder;
