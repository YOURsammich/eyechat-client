import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

// How often we send our own position while moving. Native mousemove fires far
// more often than this; everything in between just updates pendingRef. ~25/sec,
// comfortably inside the "20-30/sec" target — the server throttles independently
// too (see CURSOR_EMIT_MIN_INTERVAL_MS in handleConnection.js).
const EMIT_INTERVAL_MS = 40;
// No movement for this long -> tell the room we've stopped, so a cursor left
// sitting still doesn't broadcast forever.
const IDLE_TIMEOUT_MS = 8000;
// Drop a peer's cursor if nothing has arrived for this long, in case a 'stop'
// or 'userLeft' was missed (e.g. the tab that owned it crashed mid-move).
const STALE_TIMEOUT_MS = 15000;
const SWEEP_INTERVAL_MS = 5000;

// The hotspot — the pixel in the image that actually points at things. Top-left
// (0 0), matching how a normal arrow pointer works and how the live layer below
// anchors peers' cursors, so what you click is what the tip is over.
const CURSOR_HOTSPOT_X = 0;
const CURSOR_HOTSPOT_Y = 0;

// Renders everyone else's live mouse position (as their equipped cursor image)
// over the chat area, and broadcasts this user's own position while the pointer
// is inside that area. Also applies the equipped cursor as this user's actual
// pointer while hovering it. `containerRef` is the chat area to scope tracking
// and rendering to (see the `.chatBox` ref in ChatWindow) — `myIdRef` is a ref
// (not a value) so the filter always reads the current id even though it's
// often still null at mount (setID arrives after connect).
function LiveCursors({ socket, containerRef, user, myIdRef, blockedNicks }) {
  const [peers, setPeers] = useState({}); // id -> { nick, cursor, x, y, ts }
  // Filenames that 404'd, so a stale `users.cursor` value (equipped before the
  // file behind it went away) falls back to the default icon instead of a
  // broken-image glyph.
  const [brokenCursors, setBrokenCursors] = useState(() => new Set());
  const markBroken = (file) => setBrokenCursors(prev => (prev.has(file) ? prev : new Set(prev).add(file)));

  const lastSentRef = useRef(0);
  const idleTimerRef = useRef(null);
  const activeRef = useRef(false); // are we currently telling the server we're moving

  // Receive everyone else's positions, and clean up on departure.
  useEffect(() => {
    const offMove = socket.on('cursorMove', (data) => {
      if (!data || data.id === myIdRef.current) return;
      setPeers(prev => {
        if (data.stop) {
          if (!(data.id in prev)) return prev;
          const next = { ...prev };
          delete next[data.id];
          return next;
        }
        return {
          ...prev,
          [data.id]: { nick: data.nick, cursor: data.cursor, x: data.x, y: data.y, ts: Date.now() },
        };
      });
    });

    const offLeft = socket.on('userLeft', (u) => {
      setPeers(prev => {
        if (!(u.id in prev)) return prev;
        const next = { ...prev };
        delete next[u.id];
        return next;
      });
    });

    return () => { offMove(); offLeft(); };
  }, [socket, myIdRef]);

  // Sweep anything stale in case a 'stop' or userLeft never arrived.
  useEffect(() => {
    const timer = setInterval(() => {
      setPeers(prev => {
        const now = Date.now();
        let changed = false;
        const next = { ...prev };
        for (const [id, p] of Object.entries(prev)) {
          if (now - p.ts > STALE_TIMEOUT_MS) { delete next[id]; changed = true; }
        }
        return changed ? next : prev;
      });
    }, SWEEP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  // Track & broadcast our own position while it's inside the chat area.
  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;

    function sendStop() {
      if (!activeRef.current) return;
      activeRef.current = false;
      socket.emit('cursorMove', { stop: true });
    }

    function armIdle() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(sendStop, IDLE_TIMEOUT_MS);
    }

    function onMove(e) {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      activeRef.current = true;
      armIdle();

      const now = Date.now();
      if (now - lastSentRef.current < EMIT_INTERVAL_MS) return;
      lastSentRef.current = now;
      socket.emit('cursorMove', { x, y });
    }

    function onLeave() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      sendStop();
    }

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      sendStop();
    };
  }, [socket, containerRef]);

  // Apply the equipped cursor as this user's actual pointer while over the
  // chat area — the same file the live layer below renders for everyone else.
  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;
    el.style.cursor = user?.cursor ? `url('/images/cursors/${user.cursor}') ${CURSOR_HOTSPOT_X} ${CURSOR_HOTSPOT_Y}, auto` : '';
    return () => { el.style.cursor = ''; };
  }, [containerRef, user?.cursor]);

  const entries = Object.entries(peers).filter(
    ([, p]) => !blockedNicks?.has(String(p.nick).toLowerCase())
  );
  if (!entries.length) return null;

  return (
    <div className='liveCursorLayer'>
      {entries.map(([id, p]) => (
        <div key={id} className='liveCursor' style={{ left: (p.x * 100) + '%', top: (p.y * 100) + '%' }}>
          {p.cursor && !brokenCursors.has(p.cursor)
            ? <img src={'/images/cursors/' + p.cursor} alt='' onError={() => markBroken(p.cursor)} />
            : <span className='material-symbols-outlined liveCursorDefault'>arrow_selector_tool</span>}
          <span className='liveCursorNick'>{p.nick}</span>
        </div>
      ))}
    </div>
  );
}

LiveCursors.propTypes = {
  socket: PropTypes.object.isRequired,
  containerRef: PropTypes.object.isRequired,
  user: PropTypes.object,
  myIdRef: PropTypes.object.isRequired,
  blockedNicks: PropTypes.instanceOf(Set),
};

export default LiveCursors;
