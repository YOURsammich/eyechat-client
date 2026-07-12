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

function WhiteboardPanel({ socket, user, onClose }) {
  const panelRef = useRef(null);
  const canvasRef = useRef(null);
  const authoredRef = useRef(new Set()); // strokeIds we drew — ignore their echo
  const [marker, setMarker] = useState({ holder: null, queue: [], timerExpiry: null });
  const [, setNowTick] = useState(0); // drives the live countdown re-render
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenRef = useRef(false);
  fullscreenRef.current = fullscreen; // read inside the (stable) drag handler

  const myNick = user?.nick || (typeof window !== 'undefined' && window.store ? window.store.get('nick') : undefined);
  const iHold = marker.holder != null && marker.holder === myNick;
  const inQueue = marker.queue.indexOf(myNick);

  // ── drag the panel by its title bar (mirrors UnoPanel); disabled fullscreen ──
  useEffect(() => {
    const panel = panelRef.current;
    let dragging = false, startX, startY, initX, initY;

    function onMouseDown(e) {
      if (fullscreenRef.current) return; // fixed to the viewport — nothing to drag
      if (!e.target.classList || !e.target.classList.contains('wbDragHandle')) return;
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      initX = rect.left; initY = rect.top;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }
    function onMove(e) {
      if (!dragging) return;
      panel.style.left = (initX + e.clientX - startX) + 'px';
      panel.style.top = (initY + e.clientY - startY) + 'px';
    }
    function onUp() {
      dragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    panel.addEventListener('mousedown', onMouseDown);
    return () => panel.removeEventListener('mousedown', onMouseDown);
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

    const offReconnect = socket.onReconnect ? socket.onReconnect(requestSync) : null;

    requestSync(); // load current board + marker state
    return () => {
      offSnapshot(); offStroke(); offClear(); offMarker();
      if (offReconnect) offReconnect();
    };
  }, [socket]);

  // ── live countdown tick (only while a handoff timer is running) ─────────────
  useEffect(() => {
    if (!marker.timerExpiry) return;
    const id = setInterval(() => setNowTick(t => t + 1), 500);
    return () => clearInterval(id);
  }, [marker.timerExpiry]);

  // ── Esc leaves fullscreen ────────────────────────────────────────────────────
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  function onStroke(stroke) {
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

  const remaining = marker.timerExpiry ? marker.timerExpiry - Date.now() : 0;

  let status;
  if (iHold) status = 'You have the marker — draw away.';
  else if (marker.holder) status = `${marker.holder} is drawing…`;
  else status = 'The marker is free — grab it!';

  const panelStyle = fullscreen
    ? {
        position: 'fixed', inset: 0, zIndex: 10000, borderRadius: 0,
        display: 'flex', flexDirection: 'column', background: '#1b1b1b', color: '#fff',
      }
    : {
        position: 'fixed', top: '70px', left: '90px', zIndex: 9999,
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
      }}>
        <span className='wbDragHandle' style={{ fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className='material-symbols-outlined wbDragHandle' style={{ fontSize: 18 }}>draw</span>
          Whiteboard
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
        <span style={{ fontSize: 13 }}>{status}</span>

        {marker.timerExpiry && (
          <span style={{ fontSize: 12, color: '#ffb74d' }}>
            · switches in {fmtCountdown(remaining)}
          </span>
        )}

        <span style={{ flex: 1 }} />

        {iHold ? (
          <button className='stdBtn smallBtn' onClick={() => socket.emit('wb:release', { boardId: BOARD_ID })}>
            Drop marker
          </button>
        ) : inQueue !== -1 ? (
          <button className='stdBtn smallBtn' disabled style={{ opacity: 0.6 }}>
            Waiting · #{inQueue + 1}
          </button>
        ) : (
          <button className='stdBtn smallBtn' onClick={() => socket.emit('wb:request', { boardId: BOARD_ID })}>
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
          background='#ffffff'
        />
      </div>
    </div>
  );
}

export default WhiteboardPanel;
