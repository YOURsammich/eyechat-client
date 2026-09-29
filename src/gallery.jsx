import { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

import { Player } from './comps/Gallery/replay';

// The whiteboard gallery (feedback #33): drawings saved from the shared board,
// credited to everyone who drew on them. Saving happens in the whiteboard panel
// (wb:save); this page is for looking — a grid sorted by newest or most
// upvoted, and a viewer that can replay a drawing stroke by stroke. The page and
// its API are login-gated server-side (src/routes/gallery.js), so every visitor
// is a logged-in account and can vote; `me.canDelete` marks a moderator.
//
// /gallery is the grid; /gallery/<id> is the same page with that entry open.

const BOARD_WIDTH = 1600;
const BOARD_HEIGHT = 900;
const SPEEDS = [1, 2, 4];
// The board on a page of its own (the games hub opens it on arrival), so the
// way back from here is to the whiteboard rather than only to the chat.
const BOARD_URL = '/games/whiteboard';

async function api(url, method = 'GET') {
  const res = await fetch(url, { method, headers: { accept: 'application/json' } });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.error) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

function entryIdFromPath() {
  const m = location.pathname.match(/^\/gallery\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

// A drawing's label: its title, or failing that who drew it.
function labelOf(entry) {
  return entry.title || 'Untitled';
}

// Who drew it. `unattributed` means some strokes predate authorship being
// recorded, so the named artists aren't the whole story.
function artistsOf(entry) {
  const names = entry.participants?.length ? entry.participants.join(', ') : '';
  if (!names) return 'Artists unknown';
  return entry.unattributed ? `${names} + others` : names;
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function credits(entry) {
  const drew = entry.participants?.length ? `Drawn by ${artistsOf(entry)}` : 'Artists unknown';
  return `${drew} · saved by ${entry.saved_by} · ${fmtDate(entry.created_at)}`;
}

function VoteButton({ entry, onVote }) {
  return (
    <button
      className={'voteBtn' + (entry.voted ? ' voted' : '')}
      title={entry.voted ? 'Remove your upvote' : 'Upvote'}
      onClick={(e) => { e.stopPropagation(); onVote(entry.id); }}
    >
      ▲ {entry.votes}
    </button>
  );
}

// No Delete here: next to ▲ on every card it invited mis-taps. Moderators
// delete from the viewer, one deliberate step in.
function Card({ entry, onOpen, onVote }) {
  return (
    <div className='galleryCard' onClick={() => onOpen(entry.id)}>
      <img src={`/images/gallery/${entry.id}_thumb.png`} alt={labelOf(entry)} loading='lazy' />
      <div className='galleryCardBody'>
        <div className='galleryTitle' title={labelOf(entry)}>{labelOf(entry)}</div>
        {/* Always present — "Artists unknown" when nobody's recorded — so every
            card in a row is the same height. */}
        <div className='galleryMeta' title={artistsOf(entry)}>{artistsOf(entry)}</div>
        <div className='galleryFoot'>
          <span className='galleryMeta'>{fmtDate(entry.created_at)}</span>
          <span className='spacer' />
          <VoteButton entry={entry} onVote={onVote} />
        </div>
      </div>
    </div>
  );
}

// Full-size view of one entry. Shows the rendered PNG until Replay is pressed,
// then a canvas the Player redraws onto. The canvas bitmap stays transparent over
// the white stage, exactly like the live board, so the eraser looks the same.
function Viewer({ id, summary, canDelete, onClose, onVote, onDelete }) {
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('image');   // 'image' | 'playing' | 'paused' | 'done'
  const [speed, setSpeed] = useState(1);
  const canvasRef = useRef(null);
  const playerRef = useRef(null);
  const speedRef = useRef(1);
  speedRef.current = speed;
  // The progress bar's fill, written straight to the DOM each frame rather than
  // through state, so the replay doesn't re-render the viewer 60 times a second.
  const progressRef = useRef(null);
  const showProgress = (player) => {
    const el = progressRef.current;
    if (!el) return;
    const total = player.plan.duration;
    el.style.width = (total > 0 ? Math.min(1, player.clock / total) : 1) * 100 + '%';
  };

  useEffect(() => {
    setEntry(null); setError(null); setMode('image');
    api(`/gallery/entry/${id}`).then(setEntry, (e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The animation loop runs only while playing.
  useEffect(() => {
    if (mode !== 'playing') return;
    let raf;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(now - last, 100); // a backgrounded tab resumes, not skips
      last = now;
      const finished = playerRef.current.advance(dt * speedRef.current);
      showProgress(playerRef.current);
      if (finished) { setMode('done'); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  const startReplay = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !entry) return;
    playerRef.current = new Player(ctx, BOARD_WIDTH, BOARD_HEIGHT, entry.strokes || []);
    showProgress(playerRef.current);
    setMode('playing');
  }, [entry]);

  // Votes live in the page's list; the viewer shows the list's copy when it has
  // one, so voting here and on the card stay the same number. Its own copy is
  // updated too, for an entry opened by link before the list has it.
  const shown = entry ? { ...entry, ...(summary || {}) } : null;
  async function voteHere(voteId) {
    const result = await onVote(voteId);
    if (result) setEntry(en => en && { ...en, ...result });
  }

  return (
    <div className='viewer' onClick={onClose}>
      <div className='viewerBox' onClick={(e) => e.stopPropagation()}>
        <div className='viewerHead'>
          <h2>{shown ? labelOf(shown) : 'Loading…'}</h2>
          <span className='spacer' />
          <button className='viewerClose' onClick={onClose} title='Close'>✕</button>
        </div>

        {error && <div className='status err'>{error}</div>}

        {shown && (
          <>
            <div className='viewerStage'>
              {mode === 'image' && <img src={`/images/gallery/${id}.png`} alt={labelOf(shown)} />}
              <canvas
                ref={canvasRef}
                width={BOARD_WIDTH}
                height={BOARD_HEIGHT}
                style={{ visibility: mode === 'image' ? 'hidden' : 'visible' }}
              />
            </div>

            {/* How far through the replay; hidden until one starts. */}
            <div className='replayBar' style={{ visibility: mode === 'image' ? 'hidden' : 'visible' }}>
              <div ref={progressRef} className='replayFill' />
            </div>

            <div className='viewerControls'>
              {mode === 'playing' ? (
                <button className='btn' onClick={() => setMode('paused')}>Pause</button>
              ) : mode === 'paused' ? (
                <button className='btn btn-primary' onClick={() => setMode('playing')}>Resume</button>
              ) : (
                <button className='btn btn-primary' onClick={startReplay}>▶ Replay</button>
              )}
              {(mode === 'playing' || mode === 'paused') && (
                <button className='btn' onClick={startReplay}>Restart</button>
              )}
              {SPEEDS.map(s => (
                <button key={s} className={'speedBtn' + (speed === s ? ' on' : '')} onClick={() => setSpeed(s)}>{s}×</button>
              ))}
              {/* One group, pushed right, so on a narrow screen Delete and ▲
                  wrap onto the next line together instead of splitting up. */}
              <span className='viewerActions'>
                {canDelete && <button className='deleteBtn' onClick={() => onDelete(id)}>Delete</button>}
                <VoteButton entry={shown} onVote={voteHere} />
              </span>
            </div>

            <div className='viewerCredits'>{credits(shown)}</div>
          </>
        )}
      </div>
    </div>
  );
}

function GalleryPage() {
  const [items, setItems] = useState(null);
  const [me, setMe] = useState(null);
  const [sort, setSort] = useState('new');
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(entryIdFromPath);

  useEffect(() => {
    api(`/gallery/list?sort=${sort}`).then(
      (data) => { setItems(data.items); setMe(data.me); setError(null); },
      (e) => setError(e.message),
    );
  }, [sort]);

  // Whether the open entry was opened from the grid (so it has a history entry
  // of its own), as opposed to arriving on /gallery/<id> by link.
  const pushedRef = useRef(false);

  // Back/forward move between the grid and an open entry.
  useEffect(() => {
    const onPop = () => { pushedRef.current = false; setOpenId(entryIdFromPath()); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const open = useCallback((id) => {
    history.pushState(null, '', `/gallery/${id}`);
    pushedRef.current = true;
    setOpenId(id);
  }, []);

  // Closing undoes the open rather than adding a step: back over the entry we
  // pushed (popstate then closes it), or, for an entry reached by link, swap
  // the URL for the grid's. Either way Back afterwards doesn't reopen it.
  const close = useCallback(() => {
    if (pushedRef.current) {
      history.back();
    } else {
      history.replaceState(null, '', '/gallery');
      setOpenId(null);
    }
  }, []);

  async function vote(id) {
    try {
      const { voted, votes } = await api(`/gallery/vote/${id}`, 'POST');
      setItems(list => list && list.map(it => (it.id === id ? { ...it, voted, votes } : it)));
      return { voted, votes };
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(id) {
    if (!confirm('Delete this drawing from the gallery? This cannot be undone.')) return;
    try {
      await api(`/gallery/delete/${id}`, 'POST');
      setItems(list => list && list.filter(it => it.id !== id));
      if (openId === id) close();
    } catch (e) {
      setError(e.message);
    }
  }

  const canDelete = !!me?.canDelete;
  const summary = items?.find(it => it.id === openId);

  return (
    <div className='wrap gallery'>
      <header>
        <h1>Whiteboard Gallery</h1>
        <p>
          Drawings saved from the shared whiteboard, credited to everyone who drew on them.
          &nbsp;<a href={BOARD_URL}>Open the whiteboard</a> · <a href='/'>Back to the chat</a>
        </p>
      </header>

      <div className='galleryBar'>
        <div className='viewtoggle' style={{ marginBottom: 0 }}>
          <button className={sort === 'new' ? 'active' : ''} onClick={() => setSort('new')}>Newest</button>
          <button className={sort === 'top' ? 'active' : ''} onClick={() => setSort('top')}>Top</button>
        </div>
        <span className='spacer' />
        {items && <span className='galleryMeta'>{items.length} drawing{items.length === 1 ? '' : 's'}</span>}
      </div>

      {error && <div className='status err' style={{ marginBottom: 14 }}>{error}</div>}

      {items && items.length === 0 && (
        <div className='galleryEmpty'>
          Nothing saved yet — <a href={BOARD_URL}>open the whiteboard</a> and press Save to put a drawing here.
        </div>
      )}

      {items && items.length > 0 && (
        <div className='galleryGrid'>
          {items.map(entry => (
            <Card key={entry.id} entry={entry} onOpen={open} onVote={vote} />
          ))}
        </div>
      )}

      {openId != null && (
        <Viewer
          id={openId}
          summary={summary ? { votes: summary.votes, voted: summary.voted } : null}
          canDelete={canDelete}
          onClose={close}
          onVote={vote}
          onDelete={remove}
        />
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<GalleryPage />);
