// ─────────────────────────────────────────────────────────────────────────────
// MINESWEEPER — client floating panel.
//
// One shared 50×30 grid the whole room plays at once, drop in / drop out. The
// server (src/games/minesweeper.js) owns the map and the scores; this panel is
// a view over its `ms:` events plus a click → event translation:
//
//   left click on a hidden cell   → ms:reveal   (0, or −10 on a bomb)
//   right click / long-press      → ms:flag     (+1 right, −1 wrong — and the
//                                                 cell opens, so no fishing)
//   left click on an open number  → ms:chord    (opens the rest once the flags
//                                                 and craters around it add up)
//
// Nothing is optimistic: a click goes to the server and the delta comes back to
// everyone, us included. On a same-origin socket that round trip is shorter
// than the redraw, and it means every client draws exactly one board.
//
// The grid is a canvas rather than 1500 divs: it repaints per changed cell on
// an update and only in full on a snapshot, which is what keeps a room of fast
// clickers from turning into a room of layout thrash. The cell size is chosen
// to fit the whole map in the panel — a map you have to scroll around is a
// map you can't read at a glance, and reading it at a glance is the game.
//
// Self-contained: to remove, delete this directory and the two registry lines
// (comps/activities.js, comps/activityPanels.js).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import DraggableWindow from '../DraggableWindow';

// Cell states on the wire — keep in sync with src/games/minesweeper.js.
const HIDDEN = -1;
const FLAG = -2;
const EXPLODED = -3;

const MAX_CELL = 24;             // CSS px per cell when there is room
const MIN_CELL = 11;             // below this a number is unreadable; scroll instead
const LONG_PRESS_MS = 350;       // touch: hold to flag
const POP_MS = 900;              // how long a "+1" / "−10" floats over its cell
const BANNER_MS = 7000;          // how long the "map cleared" line stays up

// The classic number colours, on a dark ground.
const NUMBER_COLORS = ['', '#5aa0ff', '#5fcf6b', '#ff6b6b', '#b48cff', '#ff9c5a', '#4dd0e1', '#e0e0e0', '#9e9e9e'];

const MONO = 'ui-monospace, Menlo, Consolas, monospace';

// Two quiet buttons in a row that is mostly numbers: an outline, no fill, and
// a fill only for the state that changes what a click does.
const ghostBtn = {
  background: 'transparent', border: '1px solid #444', color: '#bbb', borderRadius: 4,
  padding: '3px 9px', fontSize: 12, cursor: 'pointer', lineHeight: 1.4,
};
const ghostBtnOn = { ...ghostBtn, background: '#5a1f1f', borderColor: '#c44', color: '#fff' };

function fmtDuration(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}

function fmtPoints(n) {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
}

function pointsColor(n, neutral = '#bbb') {
  return n > 0 ? '#7fe08a' : n < 0 ? '#ff6b6b' : neutral;
}

// ─── drawing ─────────────────────────────────────────────────────────────────
// `cs` is the cell size in CSS px; everything scales from it.

function drawCell(ctx, cs, x, y, v, hover) {
  const px = x * cs, py = y * cs;

  if (v >= 0) {
    // Open. A zero is bare floor; a number sits on the same floor.
    ctx.fillStyle = hover ? '#2f2f2f' : '#262626';
    ctx.fillRect(px, py, cs, cs);
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, cs - 1, cs - 1);
    if (v > 0) {
      ctx.fillStyle = NUMBER_COLORS[v];
      ctx.font = `bold ${Math.round(cs * 0.6)}px ${MONO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(v), px + cs / 2, py + cs / 2 + 1);
    }
    return;
  }

  if (v === EXPLODED) {
    ctx.fillStyle = '#7a1f1f';
    ctx.fillRect(px, py, cs, cs);
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, cs - 1, cs - 1);
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(px + cs / 2, py + cs / 2, cs * 0.28, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // Hidden or flagged: a raised tile with a light top-left and dark bottom-right.
  const bevel = cs >= 16 ? 2 : 1;
  ctx.fillStyle = hover ? '#585858' : '#4a4a4a';
  ctx.fillRect(px, py, cs, cs);
  ctx.fillStyle = hover ? '#777' : '#666';
  ctx.fillRect(px, py, cs, bevel);
  ctx.fillRect(px, py, bevel, cs);
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(px, py + cs - bevel, cs, bevel);
  ctx.fillRect(px + cs - bevel, py, bevel, cs);

  if (v === FLAG) {
    // Pole plus a pennant. A flag on this board is always a real mine.
    const cx = px + cs / 2, top = py + cs * 0.22, bottom = py + cs * 0.8;
    const w = cs * 0.34, h = cs * 0.36;
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = Math.max(1, cs * 0.09);
    ctx.beginPath();
    ctx.moveTo(cx - 1, top);
    ctx.lineTo(cx - 1, bottom);
    ctx.stroke();
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.moveTo(cx - 1, top);
    ctx.lineTo(cx - 1 + w, top + h / 2);
    ctx.lineTo(cx - 1, top + h);
    ctx.closePath();
    ctx.fill();
  }
}

function drawAll(ctx, cs, map, hover) {
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      drawCell(ctx, cs, x, y, map.cells[i], hover && hover.x === x && hover.y === y);
    }
  }
}

// ─── the panel ───────────────────────────────────────────────────────────────

function MinesweeperPanel({ socket, user, onClose }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);         // the grid's flex slot; what the cell size is fitted to
  const mapRef = useRef(null);          // the live map; mutated in place on updates
  const csRef = useRef(MAX_CELL);       // current cell size
  const hoverRef = useRef(null);        // {x,y} under the pointer, or null
  const popsRef = useRef([]);           // floating score labels in flight
  const popTimerRef = useRef(null);
  const pressRef = useRef(null);        // in-progress touch long-press
  const lastFlagRef = useRef(null);     // {x, y, t} of the last flag we sent, to fold duplicate triggers

  // What React renders around the canvas. The map's cell array is deliberately
  // NOT state — it changes on every click in the room, and a 1500-cell array
  // through setState per click is the layout thrash the canvas is here to avoid.
  const [meta, setMeta] = useState(null);   // { mapId, mines, flagged, exploded, safeRevealed, safeTotal }
  const [scores, setScores] = useState([]);
  const [banner, setBanner] = useState(null);
  const [flagMode, setFlagMode] = useState(false);
  const [showHelp, setShowHelp] = useState(false);       // the rules overlay, behind the ? button
  const [lastPoints, setLastPoints] = useState(null);   // our most recent scoring click, flashed beside our score

  const myNick = user?.nick || (typeof window !== 'undefined' && window.store ? window.store.get('nick') : undefined);
  const myScore = scores.find(s => s.nick === myNick)?.points ?? 0;

  // ── canvas sizing ────────────────────────────────────────────────────────────
  // The biggest cell that lets the whole map fit the slot's width and the
  // height left under the window's cap, floored at MIN_CELL (then the slot
  // scrolls). Height is budgeted from the viewport rather than measured,
  // because the slot's own height depends on what we put in it.
  function pickCellSize(map) {
    const wrap = wrapRef.current;
    const w = wrap ? wrap.clientWidth : map.width * MAX_CELL;
    const h = window.innerHeight * 0.9 - 130;      // DraggableWindow's 90vh, less its chrome and our header
    const fit = Math.floor(Math.min(w / map.width, h / map.height));
    return Math.max(MIN_CELL, Math.min(MAX_CELL, fit));
  }

  function fitCanvas(map) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const cs = pickCellSize(map);
    csRef.current = cs;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = map.width * cs * dpr;
    canvas.height = map.height * cs * dpr;
    canvas.style.width = map.width * cs + 'px';
    canvas.style.height = map.height * cs + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function ctx2d() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function redrawAll() {
    const map = mapRef.current;
    if (!map) return;
    const ctx = fitCanvas(map);
    if (ctx) drawAll(ctx, csRef.current, map, hoverRef.current);
  }

  function repaintCell(x, y) {
    const map = mapRef.current;
    const ctx = ctx2d();
    if (!map || !ctx) return;
    const h = hoverRef.current;
    drawCell(ctx, csRef.current, x, y, map.cells[y * map.width + x], h && h.x === x && h.y === y);
  }

  // Refit when the panel or the window changes size.
  useEffect(() => {
    const onResize = () => redrawAll();
    window.addEventListener('resize', onResize);
    const ro = typeof ResizeObserver !== 'undefined' && wrapRef.current ? new ResizeObserver(onResize) : null;
    if (ro) ro.observe(wrapRef.current);
    return () => {
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── floating labels: "+1" / "−10" and who did it ───────────────────────────
  // Drawn on top of the cells and cleaned up by repainting the cells beneath
  // them, so they never need a second canvas. Every click in the room gets
  // one with the clicker's nick — that is most of what makes a shared board
  // feel shared. A scoring click puts the points above the nick; a plain
  // reveal is just the nick, and your own plain reveals get nothing (you know).
  //
  // The label floats from just ABOVE the cell, never over it: drawn on the
  // cell it hides the flag that was just planted for the best part of a
  // second, which reads as the click not having registered. Near the top edge
  // it goes below instead.
  function addPop(x, y, points, mine, nick) {
    const dir = y < 2 ? 1 : -1;
    popsRef.current.push({
      x, y, dir, mine, nick: nick.length > 12 ? nick.slice(0, 11) + '…' : nick,
      text: points ? fmtPoints(points) : null,
      born: performance.now(), lastY: y + dir,
    });
    if (!popTimerRef.current) popTimerRef.current = requestAnimationFrame(tickPops);
  }

  function tickPops() {
    const map = mapRef.current;
    const ctx = ctx2d();
    const cs = csRef.current;
    popTimerRef.current = null;
    if (!map || !ctx) { popsRef.current = []; return; }

    const now = performance.now();
    const alive = [];
    for (const p of popsRef.current) {
      // Restore the cells the label was last drawn over: two lines of text
      // straddle the row above and below as it floats up, and a nick is a few
      // cells wide.
      for (let yy = p.lastY - 1; yy <= p.lastY + 1; yy++) {
        for (let xx = p.x - 3; xx <= p.x + 3; xx++) {
          if (yy >= 0 && yy < map.height && xx >= 0 && xx < map.width) repaintCell(xx, yy);
        }
      }
      const t = (now - p.born) / POP_MS;
      if (t >= 1) continue;
      const drift = t * cs * 0.9 * p.dir;
      const cx = p.x * cs + cs / 2;
      // Points line sits a cell away from the clicked one (above, usually) and
      // drifts further; the nick line hangs off it toward the cell, so the
      // whole label stays clear of the cell throughout.
      const cy = p.y * cs + cs / 2 + p.dir * cs * (p.text ? 1.3 : 0.9) + drift;
      p.lastY = Math.floor(cy / cs);
      ctx.save();
      ctx.globalAlpha = 1 - t * t;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000';
      if (p.text) {
        ctx.font = `bold ${Math.round(cs * (p.mine ? 0.64 : 0.55))}px ${MONO}`;
        ctx.strokeText(p.text, cx, cy);
        ctx.fillStyle = p.text.startsWith('+') ? '#7fe08a' : '#ff6b6b';
        ctx.fillText(p.text, cx, cy);
      }
      // The nick sits on the cell side of the points, or where the points would be.
      const ny = p.text ? cy - p.dir * cs * 0.6 : cy;
      ctx.font = `${Math.round(cs * 0.45)}px ${MONO}`;
      ctx.strokeText(p.nick, cx, ny);
      ctx.fillStyle = '#ddd';
      ctx.fillText(p.nick, cx, ny);
      ctx.restore();
      alive.push(p);
    }
    popsRef.current = alive;
    if (alive.length) popTimerRef.current = requestAnimationFrame(tickPops);
  }

  // ── socket wiring ────────────────────────────────────────────────────────────
  useEffect(() => {
    const requestSync = () => socket.emit('ms:sync', {});

    const offSnapshot = socket.on('ms:snapshot', (data) => {
      if (!data?.board) return;
      const map = { ...data.board, mapId: data.mapId, cells: Int8Array.from(data.board.cells) };
      mapRef.current = map;
      popsRef.current = [];
      redrawAll();
      setMeta({
        mapId: data.mapId, mines: map.mines, flagged: map.flagged, exploded: map.exploded,
        safeRevealed: map.safeRevealed, safeTotal: map.safeTotal,
      });
      setScores(data.scores || []);
      if (data.cleared) {
        setBanner(data.cleared);
        setLastPoints(null);
      }
    });

    const offUpdate = socket.on('ms:update', (data) => {
      const map = mapRef.current;
      // A straggling update from the map that just got cleared must not paint
      // over the new one.
      if (!map || !data || data.mapId !== map.mapId) return;
      for (const c of data.changed || []) {
        map.cells[c.y * map.width + c.x] = c.v;
        repaintCell(c.x, c.y);
      }
      map.flagged = data.flagged;
      map.exploded = data.exploded;
      map.safeRevealed = data.safeRevealed;
      setMeta(m => m && { ...m, flagged: data.flagged, exploded: data.exploded, safeRevealed: data.safeRevealed });
      setScores(data.scores || []);

      // The label goes on the cell that was clicked (`at`) — except that a
      // chord which somehow hit a bomb labels the bomb, since that is where
      // the −10 came from.
      const at = data.at || data.changed?.[0];
      if (at && (data.points || data.by !== myNick)) {
        const boom = data.points < 0 && data.changed?.find(c => c.v === EXPLODED);
        const spot = boom || at;
        addPop(spot.x, spot.y, data.points, !!boom, data.by || '');
      }
      if (data.by === myNick && data.points) setLastPoints({ points: data.points, at: Date.now() });
    });

    const offReconnect = socket.onReconnect ? socket.onReconnect(requestSync) : null;
    requestSync();
    return () => {
      offSnapshot(); offUpdate();
      if (offReconnect) offReconnect();
      if (popTimerRef.current) cancelAnimationFrame(popTimerRef.current);
      // The sync above is what told the launcher we're playing; this is what
      // tells it we've stopped.
      socket.emit('ms:leave', {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // ── banner + score flash timers ─────────────────────────────────────────────
  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(() => setBanner(null), BANNER_MS);
    return () => clearTimeout(id);
  }, [banner]);

  useEffect(() => {
    if (!lastPoints) return;
    const id = setTimeout(() => setLastPoints(null), 1200);
    return () => clearTimeout(id);
  }, [lastPoints]);

  // ── pointer → cell ───────────────────────────────────────────────────────────
  function cellAt(e) {
    const canvas = canvasRef.current;
    const map = mapRef.current;
    if (!canvas || !map) return null;
    const rect = canvas.getBoundingClientRect();
    const cs = csRef.current;
    const x = Math.floor((e.clientX - rect.left) / cs);
    const y = Math.floor((e.clientY - rect.top) / cs);
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
    return { x, y };
  }

  // mode: 'reveal' | 'flag'. A reveal on an open number is a chord. Anything
  // else that doesn't apply to the cell's state is a no-op here, and the server
  // would say so too.
  function act(cell, mode) {
    const map = mapRef.current;
    if (!map || !cell) return;
    const v = map.cells[cell.y * map.width + cell.x];
    if (mode === 'flag') { if (v === HIDDEN) socket.emit('ms:flag', cell); return; }
    if (v === HIDDEN) socket.emit('ms:reveal', cell);
    else if (v > 0) socket.emit('ms:chord', cell);
  }

  // A right click reaches us two ways: pointerdown with button 2, and the
  // contextmenu event on release. Both are wired because either can be the only
  // one that fires — Chrome sends no pointerdown for a right press that starts
  // while the left button is still held (a chord, easy to do when clicking
  // fast), and a pen's barrel button or a touch long-press may only surface as
  // contextmenu. The same cell within a beat is one flag, not two.
  function flagAt(cell) {
    if (!cell) return;
    const last = lastFlagRef.current;
    const now = performance.now();
    if (last && last.x === cell.x && last.y === cell.y && now - last.t < 400) return;
    lastFlagRef.current = { x: cell.x, y: cell.y, t: now };
    act(cell, 'flag');
  }

  function onContextMenu(e) {
    e.preventDefault();
    flagAt(cellAt(e));
  }

  function onPointerDown(e) {
    if (!e.isPrimary) return;
    const cell = cellAt(e);
    if (!cell) return;

    if (e.pointerType === 'touch') {
      // Tap reveals, hold flags. Decided on release / timer, not here.
      pressRef.current = { cell, id: e.pointerId, fired: false, timer: setTimeout(() => {
        const p = pressRef.current;
        if (!p || p.id !== e.pointerId) return;
        p.fired = true;
        flagAt(cell);
      }, LONG_PRESS_MS) };
      return;
    }

    // Mouse / pen: right or middle flags, left reveals (or flags in flag mode).
    if (e.button === 2 || e.button === 1) { e.preventDefault(); flagAt(cell); return; }
    if (e.button === 0) act(cell, flagMode ? 'flag' : 'reveal');
  }

  function onPointerUp(e) {
    const p = pressRef.current;
    if (!p || p.id !== e.pointerId) return;
    clearTimeout(p.timer);
    pressRef.current = null;
    if (p.fired) return;                   // the hold already flagged
    const cell = cellAt(e);
    if (cell && cell.x === p.cell.x && cell.y === p.cell.y) act(cell, flagMode ? 'flag' : 'reveal');
  }

  function onPointerCancel(e) {
    const p = pressRef.current;
    if (p && p.id === e.pointerId) { clearTimeout(p.timer); pressRef.current = null; }
  }

  function onPointerMove(e) {
    if (e.pointerType === 'touch') return;
    const cell = cellAt(e);
    const prev = hoverRef.current;
    if (prev && cell && prev.x === cell.x && prev.y === cell.y) return;
    hoverRef.current = cell;
    if (prev) repaintCell(prev.x, prev.y);
    if (cell) repaintCell(cell.x, cell.y);
  }

  function onPointerLeave() {
    const prev = hoverRef.current;
    hoverRef.current = null;
    if (prev) repaintCell(prev.x, prev.y);
  }

  // ── render ───────────────────────────────────────────────────────────────────
  const progress = meta ? Math.floor((meta.safeRevealed / meta.safeTotal) * 100) : 0;
  const top = scores.slice(0, 10);
  const myRank = scores.findIndex(s => s.nick === myNick);

  return (
    <DraggableWindow title='Minesweeper' onClose={onClose} width='min(1180px, 95vw)' initialLeft={60} initialTop={60}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>

        {/* header: the map's facts, and the two controls at the far end */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: 13, color: '#aaa' }}>
          <span style={{ fontWeight: 'bold', color: '#eee' }}>{meta ? `Map #${meta.mapId}` : 'Loading…'}</span>
          {meta && (
            <>
              <span>{progress}% cleared</span>
              <span title='Flags placed / mines on the map'>
                <span style={{ color: '#ff4d4d' }}>⚑</span> {meta.flagged}/{meta.mines} flagged
              </span>
              <span title='Mines set off so far'>{meta.exploded} blown</span>
            </>
          )}
          <span style={{ flex: 1 }} />
          <button
            onClick={() => setFlagMode(f => !f)}
            title='When on, a tap or left click places a flag. Right click and long-press always flag.'
            aria-pressed={flagMode}
            style={flagMode ? ghostBtnOn : ghostBtn}
          >
            ⚑ Flag mode {flagMode ? 'on' : 'off'}
          </button>
          <button
            onClick={() => setShowHelp(h => !h)}
            title='How to play'
            aria-pressed={showHelp}
            style={{ ...(showHelp ? { ...ghostBtn, background: '#333', color: '#fff' } : ghostBtn), width: 28, padding: '3px 0', fontWeight: 'bold' }}
          >
            ?
          </button>
        </div>

        {/* the cleared-map line, up for a few seconds after each map turns over */}
        {banner && (
          <div style={{
            padding: '6px 10px', borderRadius: 4, background: '#243b24', border: '1px solid #3f7a3f', fontSize: 13,
          }}>
            <b>Map #{banner.mapId} cleared</b> in {fmtDuration(banner.duration)}
            {banner.scores?.length ? (
              <> — top: {banner.scores.slice(0, 3).map(s => `${s.nick} ${fmtPoints(s.points)}`).join(', ')}</>
            ) : null}
            . Fresh map below.
          </div>
        )}

        {/* the grid and the scoreboard beside it; the scoreboard drops below on narrow screens */}
        <div style={{ display: 'flex', gap: 12, minWidth: 0, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div ref={wrapRef} style={{ flex: '1 1 600px', minWidth: 0, position: 'relative' }}>
            <div style={{
              overflow: 'auto', background: '#1b1b1b', border: '1px solid #333', borderRadius: 4,
              // Only ever scrolls once the cell size has hit its floor.
              maxHeight: 'calc(90vh - 130px)',
            }}>
              <canvas
                ref={canvasRef}
                style={{ display: 'block', cursor: flagMode ? 'crosshair' : 'pointer', touchAction: 'pan-x pan-y' }}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                onPointerMove={onPointerMove}
                onPointerLeave={onPointerLeave}
                onContextMenu={onContextMenu}
                onAuxClick={(e) => e.preventDefault()}
              />
            </div>

            {/* the rules, over the grid, only while the ? is toggled on. Clicking
                anywhere on it dismisses it — it is a card to read, not a form. */}
            {showHelp && (
              <div
                onClick={() => setShowHelp(false)}
                style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0.6)', borderRadius: 4, cursor: 'pointer', zIndex: 1,
                }}
              >
                <div style={{
                  background: '#222', border: '1px solid #444', borderRadius: 6, padding: '14px 18px',
                  maxWidth: 380, fontSize: 13, lineHeight: 1.6, color: '#ddd', boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: 6, fontSize: 14 }}>How to play</div>
                  <div>Everyone in the room is on this same grid at once. Clear it together and a fresh one spawns.</div>
                  <div style={{ marginTop: 8 }}>
                    Flag a mine <b style={{ color: '#7fe08a' }}>+1</b><br />
                    Flag a safe cell <b style={{ color: '#ff6b6b' }}>−1</b> (and it opens)<br />
                    Click a mine <b style={{ color: '#ff6b6b' }}>−10</b> (the map carries on)
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <b>Left click</b> opens a cell. <b>Right click</b> or <b>hold</b> flags it.
                    Flag mode makes a plain tap flag instead, for touch screens.
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <b>Click an open number</b> to open all its neighbours at once, once the
                    flags and craters around it add up to it.
                  </div>
                  <div style={{ marginTop: 8, color: '#999' }}>Scores reset with each map. Flags can't be removed.</div>
                </div>
              </div>
            )}
          </div>

          {/* your score sits on top of the list it belongs to */}
          <div style={{ flex: '0 1 170px', minWidth: 150, fontSize: 13 }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              padding: '6px 10px', marginBottom: 8, borderRadius: 4, background: '#262626', border: '1px solid #333',
            }}>
              <span style={{ color: '#aaa' }}>You</span>
              <span style={{ fontWeight: 'bold', fontSize: 18, color: pointsColor(myScore, '#eee'), transition: 'color 0.2s' }}>
                {fmtPoints(myScore)}
                {lastPoints && (
                  <span style={{ marginLeft: 6, fontSize: 12, color: pointsColor(lastPoints.points) }}>
                    {fmtPoints(lastPoints.points)}
                  </span>
                )}
              </span>
            </div>

            <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#ccc' }}>This map</div>
            {top.length === 0 ? (
              <div style={{ color: '#888' }}>Nobody has clicked yet.</div>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 22 }}>
                {top.map(s => (
                  <li key={s.nick} style={{ color: s.nick === myNick ? '#fff' : '#bbb', fontWeight: s.nick === myNick ? 'bold' : 'normal' }}>
                    <span style={{ display: 'inline-flex', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nick}</span>
                      <span style={{ color: pointsColor(s.points), marginLeft: 8 }}>{fmtPoints(s.points)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {myRank >= 10 && (
              <div style={{ color: '#888', marginTop: 4 }}>You're #{myRank + 1}</div>
            )}
          </div>
        </div>
      </div>
    </DraggableWindow>
  );
}

export default MinesweeperPanel;
