import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { cursorSrc } from '../../utils/cursors';

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
// is inside that area. `containerRef` is the chat area to scope tracking and
// rendering to (see the `.chatBox` ref in ChatWindow) — `myIdRef` is a ref (not
// a value) so the filter always reads the current id even though it's often
// still null at mount (setID arrives after connect).
//
// `cursorMode` is this viewer's setting for the whole feature. The first two
// only change how your own cursor is shown back to you and make no difference
// to what anyone else sees; 'off' opts out of live cursors entirely.
//
//   'pointer' — it replaces your actual mouse pointer over the chat area.
//   'trail'   — your system pointer is left alone and your cursor is drawn into
//               the live layer instead, exactly as the room sees it.
//   'off'     — nothing is tracked, sent or drawn: your position never leaves
//               the tab and other people's cursors aren't rendered.
function LiveCursors({ socket, containerRef, user, myIdRef, blockedNicks, cursorMode = 'pointer' }) {
  const [peers, setPeers] = useState({}); // id -> { nick, cursor, x, y, ts }
  // Our own position in the live layer, in 'trail' mode only: { x, y } or null
  // when the pointer is away. Set from the same throttled tick that broadcasts,
  // so what we draw for ourselves is the same update the room is getting.
  const [self, setSelf] = useState(null);
  // Filenames that 404'd, so a stale `users.cursor` value (equipped before the
  // file behind it went away) falls back to the default icon instead of a
  // broken-image glyph.
  const [brokenCursors, setBrokenCursors] = useState(() => new Set());
  const markBroken = (file) => setBrokenCursors(prev => (prev.has(file) ? prev : new Set(prev).add(file)));

  const lastSentRef = useRef(0);
  const idleTimerRef = useRef(null);
  const activeRef = useRef(false); // are we currently telling the server we're moving
  // Whether the mousemove handler should be keeping `self` up to date. Read
  // through a ref because that handler is registered once — flipping the setting
  // shouldn't tear pointer tracking down (and fire a spurious 'stop') just to
  // pick up the new mode. False with no cursor equipped, so a user who isn't
  // wearing one doesn't re-render 25 times a second for nothing.
  const trailRef = useRef(false);
  useEffect(() => {
    trailRef.current = cursorMode === 'trail' && !!user?.cursor;
  }, [cursorMode, user?.cursor]);

  // The one thing both halves below hinge on. Kept as a boolean rather than
  // comparing the mode in each effect, because it is what their dependency
  // arrays need: switching pointer <-> trail must not re-run them.
  const enabled = cursorMode !== 'off';

  // Receive everyone else's positions, and clean up on departure. Turning the
  // feature off unsubscribes and empties the layer — we stop being told where
  // anyone is, rather than being told and hiding it.
  useEffect(() => {
    if (!enabled) {
      setPeers({});
      return;
    }

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
  }, [socket, myIdRef, enabled]);

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

  // Track & broadcast our own position while it's inside the chat area. With
  // the feature off no listener is attached at all, so nothing about where the
  // pointer is ever leaves the tab — and switching it off mid-session runs this
  // cleanup, whose sendStop() clears us from everyone else's layer.
  useEffect(() => {
    const el = containerRef?.current;
    if (!el || !enabled) return;

    function sendStop() {
      setSelf(null);
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
      // Same tick, same coordinates: in 'trail' mode we draw ourselves from the
      // update we just broadcast, so our cursor moves the way the room sees it
      // rather than being glued to the pointer.
      if (trailRef.current) setSelf({ x, y });
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
  }, [socket, containerRef, enabled]);

  // Apply the equipped cursor as this user's actual pointer while over the chat
  // area — the same image the live layer below renders for everyone else. Only
  // in 'pointer' mode: 'trail' exists precisely to leave the system pointer be.
  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;
    const src = cursorMode === 'pointer' ? cursorSrc(user?.cursor) : null;
    el.style.cursor = src ? `url('${src}') ${CURSOR_HOTSPOT_X} ${CURSOR_HOTSPOT_Y}, auto` : '';
    return () => { el.style.cursor = ''; };
  }, [containerRef, user?.cursor, cursorMode]);

  // Nothing to draw for ourselves unless we're in trail mode, wearing a cursor
  // that loads, and the pointer is actually in the chat area.
  const selfCursor = cursorMode === 'trail' && user?.cursor && !brokenCursors.has(user.cursor)
    ? user.cursor
    : null;

  if (!enabled) return null;

  const entries = Object.entries(peers).filter(
    ([, p]) => !blockedNicks?.has(String(p.nick).toLowerCase())
  );
  if (!entries.length && !(self && selfCursor)) return null;

  return (
    <div className='liveCursorLayer'>
      {self && selfCursor && (
        // No nick tag on our own: we know who we are, and a label stuck to the
        // pointer covers whatever is under it.
        <div className='liveCursor' style={{ left: (self.x * 100) + '%', top: (self.y * 100) + '%' }}>
          <img src={cursorSrc(selfCursor)} alt='' onError={() => markBroken(selfCursor)} />
        </div>
      )}
      {entries.map(([id, p]) => (
        <div key={id} className='liveCursor' style={{ left: (p.x * 100) + '%', top: (p.y * 100) + '%' }}>
          {p.cursor && !brokenCursors.has(p.cursor)
            ? <img src={cursorSrc(p.cursor)} alt='' onError={() => markBroken(p.cursor)} />
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
  cursorMode: PropTypes.oneOf(['pointer', 'trail', 'off']),
};

export default LiveCursors;
