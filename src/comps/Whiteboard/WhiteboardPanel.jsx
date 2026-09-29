// ─────────────────────────────────────────────────────────────────────────────
// WHITEBOARD — client floating panel.
//
// A collaborative board where one person draws at a time via a passed "virtual
// marker". Reuses the freehand DrawCanvas surface and wires it to the server's
// `wb:`-prefixed socket events (see src/whiteboard.js). Modeled on UnoPanel: a
// draggable floating shell + a `tools` shim over the socket.
//
// Self-contained: to remove, delete this file + the /whiteboard command in
// handleInput.js + the mount in ChatWindow.jsx.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useEffect, useState } from 'react';
import DrawCanvas from '../Pixel/DrawCanvas';

const BOARD_ID = 'main';
// The board's native resolution is designed for fullscreen (16:9). Every view —
// the fullscreen primary view and the scaled-down floating panel — renders this
// same fixed-resolution bitmap fit to its container, so stroke coordinates are
// shared across clients. Keep in sync with BOARD_WIDTH/BOARD_HEIGHT in
// src/whiteboard.js.
const BOARD_WIDTH = 1600;
const BOARD_HEIGHT = 900;

function fmtCountdown(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// Below this width the panel opens fullscreen, and restores to a position that
// keeps it on screen.
const NARROW_PX = 700;
const isNarrow = () => typeof window !== 'undefined' && window.innerWidth < NARROW_PX;

// How long the "save it?" nudge stays up after your turn ends.
const NUDGE_MS = 15000;
// How long the "you need the marker" hint stays up after a blocked press.
const BLOCKED_MS = 3000;

function WhiteboardPanel({ socket, user, onClose }) {
  const panelRef = useRef(null);
  const canvasRef = useRef(null);
  const authoredRef = useRef(new Set()); // strokeIds we drew — ignore their echo
  const [marker, setMarker] = useState({ holder: null, queue: [], timerExpiry: null });
  const [, setNowTick] = useState(0); // drives the live countdown re-render
  // A phone-width screen leaves the floating panel too small a canvas to draw
  // on (and pushed its close button off-screen), so there it opens fullscreen.
  const [fullscreen, setFullscreen] = useState(isNarrow);
  // Gallery save popover: open/closed, the optional title, and the request in
  // flight or its failure ({ saving } or { error }). Kept apart from those: the
  // last drawing you saved (its "view it" link stays up whatever happens next)
  // and when the server's cooldown lets you save again (the button counts down).
  const [saveOpen, setSaveOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [saveState, setSaveState] = useState(null);
  const [lastSavedId, setLastSavedId] = useState(null);
  const [nextSaveAt, setNextSaveAt] = useState(0);
  const saveWrapRef = useRef(null);
  // "Save it?" nudge, shown when your turn with the marker ends after you drew —
  // the moment someone is most likely to want to keep what they made.
  const [nudge, setNudge] = useState(false);
  const drewThisTurnRef = useRef(0);
  // Pressed on the board without the marker: a short hint saying why nothing
  // happened, and the marker button flashes. Cleared after BLOCKED_MS.
  const [blocked, setBlocked] = useState(0);
  const fullscreenRef = useRef(false);
  fullscreenRef.current = fullscreen; // read inside the (stable) drag handler

  const myNick = user?.nick || (typeof window !== 'undefined' && window.store ? window.store.get('nick') : undefined);
  const iHold = marker.holder != null && marker.holder === myNick;
  // Guests can't save to the gallery. The hub's user has no flag — every hub
  // user is logged in — so only an explicit false counts. The server checks too.
  const canSave = user?.registered !== false;
  const inQueue = marker.queue.indexOf(myNick);

  // ── drag the panel by its title bar (mirrors UnoPanel); disabled fullscreen ──
  useEffect(() => {
    const panel = panelRef.current;
    let dragging = false, startX, startY, initX, initY;

    let dragId = null;

    // Pointer (not mouse) events so the panel can also be dragged by touch.
    function onPointerDown(e) {
      if (fullscreenRef.current) return; // fixed to the viewport — nothing to drag
      if (!e.isPrimary) return;
      if (e.button !== 0) return; // contact only: mouse left button or pen tip
      if (!e.target.classList || !e.target.classList.contains('wbDragHandle')) return;
      dragging = true;
      dragId = e.pointerId;
      startX = e.clientX; startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      initX = rect.left; initY = rect.top;
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    }
    function onMove(e) {
      if (!dragging || e.pointerId !== dragId) return;
      panel.style.left = (initX + e.clientX - startX) + 'px';
      panel.style.top = (initY + e.clientY - startY) + 'px';
    }
    function onUp(e) {
      if (e && dragging && e.pointerId !== dragId) return;
      dragging = false;
      dragId = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    }

    panel.addEventListener('pointerdown', onPointerDown);
    return () => { panel.removeEventListener('pointerdown', onPointerDown); onUp(); };
  }, []);

  // ── socket wiring ───────────────────────────────────────────────────────────
  useEffect(() => {
    const requestSync = () => socket.emit('wb:sync', { boardId: BOARD_ID });

    const offSnapshot = socket.on('wb:snapshot', ({ boardId, strokes, marker }) => {
      if (boardId !== BOARD_ID) return;
      canvasRef.current?.clear();
      for (const s of strokes || []) canvasRef.current?.applyStroke(s);
      if (marker) setMarker(marker);
    });

    const offStroke = socket.on('wb:stroke', ({ boardId, stroke }) => {
      if (boardId !== BOARD_ID || !stroke) return;
      // Skip the echo of a stroke this client drew (already painted optimistically).
      if (authoredRef.current.has(stroke.strokeId)) {
        authoredRef.current.delete(stroke.strokeId);
        return;
      }
      canvasRef.current?.applyStroke(stroke);
    });

    const offClear = socket.on('wb:clear', ({ boardId }) => {
      if (boardId !== BOARD_ID) return;
      canvasRef.current?.clear();
    });

    const offMarker = socket.on('wb:marker', (m) => {
      if (m && m.boardId === BOARD_ID) setMarker(m);
    });

    // Only the saver hears this — the outcome of their own wb:save.
    const offSaved = socket.on('wb:saved', (r) => {
      if (!r || r.boardId !== BOARD_ID) return;
      if (r.nextSaveIn) setNextSaveAt(Date.now() + r.nextSaveIn);
      if (r.ok) {
        setLastSavedId(r.id);
        setTitle('');
        setSaveState(null);
      } else {
        // A cooldown refusal says nothing more than the countdown on the
        // button already does.
        setSaveState(r.nextSaveIn ? null : { error: r.error });
      }
    });

    const offReconnect = socket.onReconnect ? socket.onReconnect(requestSync) : null;

    requestSync(); // load current board + marker state
    return () => {
      offSnapshot(); offStroke(); offClear(); offMarker(); offSaved();
      if (offReconnect) offReconnect();
    };
  }, [socket]);

  // ── live countdown tick (while a handoff timer or the save cooldown runs) ────
  const saveWait = Math.max(0, nextSaveAt - Date.now());
  const ticking = !!marker.timerExpiry || saveWait > 0;
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNowTick(t => t + 1), 500);
    return () => clearInterval(id);
  }, [ticking]);

  // ── Esc leaves fullscreen ────────────────────────────────────────────────────
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  // ── the "save it?" nudge: your turn ended and you drew something ─────────────
  const heldRef = useRef(false);
  useEffect(() => {
    const wasHolding = heldRef.current;
    heldRef.current = iHold;
    if (iHold || !wasHolding) return;
    const drew = drewThisTurnRef.current > 0;
    drewThisTurnRef.current = 0;
    if (drew && canSave && !saveOpen) setNudge(true);
  }, [iHold, canSave, saveOpen]);

  useEffect(() => {
    if (!nudge) return;
    const id = setTimeout(() => setNudge(false), NUDGE_MS);
    return () => clearTimeout(id);
  }, [nudge]);

  // A blocked press restarts the hint's timer (a number, not a flag, so a
  // second press while it's up still resets it). Getting the marker ends it.
  useEffect(() => {
    if (!blocked) return;
    const id = setTimeout(() => setBlocked(0), BLOCKED_MS);
    return () => clearTimeout(id);
  }, [blocked]);
  useEffect(() => { if (iHold) setBlocked(0); }, [iHold]);

  // ── save popover: a click outside closes it ─────────────────────────────────
  useEffect(() => {
    if (!saveOpen) return;
    function onDown(e) {
      if (saveWrapRef.current && !saveWrapRef.current.contains(e.target)) setSaveOpen(false);
    }
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [saveOpen]);

  function toggleSave() {
    setNudge(false);
    setSaveState(null);
    setSaveOpen(o => !o);
  }

  function onStroke(stroke) {
    drewThisTurnRef.current++;
    authoredRef.current.add(stroke.strokeId);
    socket.emit('wb:stroke', { boardId: BOARD_ID, stroke });
  }

  // The canvas trash button on a shared board clears it for everyone (server
  // wipes the DB + broadcasts wb:clear, which repaints every view). Only the
  // marker holder may clear.
  function clearBoard() {
    if (!iHold) return;
    if (confirm('Clear the whole board for everyone?')) socket.emit('wb:clear', { boardId: BOARD_ID });
  }

  function saveToGallery(e) {
    e.preventDefault();
    if (!canSave || saveState?.saving || saveWait > 0) return;
    setSaveState({ saving: true });
    socket.emit('wb:save', { boardId: BOARD_ID, title: title.trim() });
  }

  const remaining = marker.timerExpiry ? marker.timerExpiry - Date.now() : 0;

  let status;
  if (iHold) status = 'You have the marker — draw away.';
  else if (marker.holder) status = `${marker.holder} is drawing…`;
  else status = 'The marker is free — grab it!';

  // Said instead of the status for a moment after a press on the board without
  // the marker, so the press visibly did something.
  let blockedHint = null;
  if (blocked && !iHold) {
    blockedHint = inQueue !== -1
      ? `You need the marker to draw — you're #${inQueue + 1} in line.`
      : 'You need the marker to draw — request it to take a turn.';
  }
  // The request button flashes with the hint, when requesting is what to do.
  const flashRequest = !!blockedHint && inQueue === -1;

  const panelStyle = fullscreen
    ? {
        position: 'fixed', inset: 0, zIndex: 10000, borderRadius: 0,
        display: 'flex', flexDirection: 'column', background: '#1b1b1b', color: '#fff',
      }
    : {
        position: 'fixed', top: '70px', left: isNarrow() ? '4vw' : '90px', zIndex: 9999,
        width: 'min(680px, 92vw)', height: 'min(460px, 70vh)',
        display: 'flex', flexDirection: 'column', background: '#1b1b1b', color: '#fff',
        borderRadius: '6px', boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
      };

  return (
    <div ref={panelRef} style={panelStyle}>
      {/* title bar (drag handle) */}
      <div className='wbDragHandle' style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 10px', cursor: fullscreen ? 'default' : 'move', background: '#1b1b1b', userSelect: 'none',
        borderBottom: '1px solid #333', flexShrink: 0,
        // While draggable, keep touch from scrolling the page instead of moving the panel.
        touchAction: fullscreen ? 'auto' : 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
      }}>
        <span className='wbDragHandle' style={{ fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className='material-symbols-outlined wbDragHandle' style={{ fontSize: 18 }}>draw</span>
          Whiteboard
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <a
            href='/gallery'
            target='_blank'
            rel='noopener'
            style={{ color: '#fff', display: 'inline-flex', textDecoration: 'none' }}
            title='Open the gallery'
          >
            <span className='material-symbols-outlined' style={{ fontSize: 18 }}>photo_library</span>
          </a>
          <button
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'inline-flex' }}
            onClick={() => setFullscreen(f => !f)}
            title={fullscreen ? 'Restore' : 'Fullscreen'}
          >
            <span className='material-symbols-outlined' style={{ fontSize: 18 }}>{fullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
          </button>
          <button
            style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}
            onClick={onClose}
            title='Close'
          >✕</button>
        </span>
      </div>

      {/* marker status + control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-block', width: 9, height: 9, borderRadius: '50%',
          background: iHold ? '#4caf50' : marker.holder ? '#39f' : '#888',
        }} />
        <span style={{ fontSize: 13, color: blockedHint ? '#ffd54f' : undefined }}>{blockedHint || status}</span>

        {marker.timerExpiry && (
          <span style={{ fontSize: 12, color: '#ffb74d' }}>
            · switches in {fmtCountdown(remaining)}
          </span>
        )}

        <span style={{ flex: 1 }} />

        {nudge && (
          <span style={{ fontSize: 12, color: '#ffd54f' }}>Nice — save it to the gallery?</span>
        )}

        {/* Save to gallery — anyone watching, marker or not; the board is
            untouched. Opens a small popover for the optional title rather than
            a row that would take height from the canvas. */}
        <span ref={saveWrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
          <button
            type='button'
            onClick={toggleSave}
            title='Save the board to the gallery'
            aria-expanded={saveOpen}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
              background: saveOpen ? '#2a2a2a' : 'transparent', color: '#ddd', fontSize: 12,
              border: `1px solid ${nudge ? '#ffd54f' : '#555'}`, borderRadius: 4, padding: '3px 8px',
            }}
          >
            <span className='material-symbols-outlined' style={{ fontSize: 16 }}>add_photo_alternate</span>
            Save
          </button>

          {saveOpen && (
            <form
              onSubmit={saveToGallery}
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setSaveOpen(false); } }}
              style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 2,
                width: 'min(300px, 80vw)', display: 'flex', flexDirection: 'column', gap: 8,
                background: '#232323', border: '1px solid #3a3a3a', borderRadius: 6, padding: 10,
                boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
              }}
            >
              <span style={{ fontSize: 12, color: '#aaa' }}>
                Save the board as it is now to the <a href='/gallery' target='_blank' rel='noopener' style={{ color: '#8cf' }}>gallery</a>,
                credited to everyone who drew on it.
              </span>
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder={canSave ? 'Title (optional)' : 'Log in to save drawings'}
                disabled={!canSave}
                style={{
                  background: '#111', color: '#eee', border: '1px solid #333',
                  borderRadius: 4, padding: '5px 8px', fontSize: 13,
                }}
              />
              <button
                type='submit'
                className='stdBtn smallBtn'
                disabled={!canSave || !!saveState?.saving || saveWait > 0}
                title={canSave ? 'Save the board as it is now' : 'Log in to save drawings to the gallery'}
                style={!canSave || saveWait > 0 ? { opacity: 0.6 } : undefined}
              >
                {saveState?.saving ? 'Saving…'
                  : saveWait > 0 ? `Save again in ${Math.ceil(saveWait / 1000)}s`
                  : 'Save to gallery'}
              </button>
              {lastSavedId != null && (
                <span style={{ fontSize: 12, color: '#81c784' }}>
                  Saved — <a href={`/gallery/${lastSavedId}`} target='_blank' rel='noopener' style={{ color: '#8cf' }}>view it</a>
                </span>
              )}
              {saveState?.error && <span style={{ fontSize: 12, color: '#e57373' }}>{saveState.error}</span>}
            </form>
          )}
        </span>

        {iHold ? (
          <button className='stdBtn smallBtn' onClick={() => socket.emit('wb:release', { boardId: BOARD_ID })}>
            Drop marker
          </button>
        ) : inQueue !== -1 ? (
          <button className='stdBtn smallBtn' disabled style={{ opacity: 0.6 }}>
            Waiting · #{inQueue + 1}
          </button>
        ) : (
          <button
            className='stdBtn smallBtn'
            onClick={() => socket.emit('wb:request', { boardId: BOARD_ID })}
            style={flashRequest ? { boxShadow: '0 0 0 2px #ffd54f' } : undefined}
          >
            Request marker
          </button>
        )}
      </div>

      {marker.queue.length > 0 && (
        <div style={{ fontSize: 11, color: '#999', padding: '0 10px 6px' }}>
          Up next: {marker.queue.join(', ')}
        </div>
      )}

      {/* the shared surface — fills the panel; only the marker holder can draw */}
      <div style={{ flex: 1, minHeight: 0, padding: '0 10px 10px', display: 'flex' }}>
        <DrawCanvas
          ref={canvasRef}
          width={BOARD_WIDTH}
          height={BOARD_HEIGHT}
          responsive
          readOnly={!iHold}
          onStroke={onStroke}
          onClear={clearBoard}
          onBlocked={() => setBlocked(n => n + 1)}
          background='#ffffff'
        />
      </div>
    </div>
  );
}

export default WhiteboardPanel;
