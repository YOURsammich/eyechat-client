import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';

// Reusable freehand painting surface — the smooth-brush sibling of PixelCanvas,
// with the same imperative ref API (exportPNGBlob / exportDataURL / loadImage /
// clear) so consumers can swap between them. Anti-aliased round-brush strokes at
// the export resolution match the app's smooth line-art avatar parts (a low-res
// pixel grid clashed with them).
//
// The canvas bitmap stays transparent (only strokes are painted), so exports are
// transparent PNGs. A visibility backing (underlay, or a light checkerboard) is
// rendered *behind* the canvas element and never becomes part of the bitmap.

const DEFAULT_PALETTE = [
  '#000000', '#ffffff', '#7f7f7f', '#c3c3c3',
  '#ed1c24', '#ff7f27', '#fff200', '#22b14c',
  '#00a2e8', '#3f48cc', '#a349a4', '#b97a57',
  '#ffaec9', '#b5e61d', '#99d9ea', '#7092be',
];

// Unique id per locally-drawn stroke, so a collaborative consumer can ignore the
// server's echo of a stroke it authored (see WhiteboardPanel).
function genStrokeId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

const DrawCanvas = forwardRef(function DrawCanvas(
  { width = 128, height = 128, scale = 3.5, palette = DEFAULT_PALETTE, underlay = null, maxViewport = 520,
    readOnly = false, onStroke = null, background = null, responsive = false, onClear = null },
  ref,
) {
  const canvasRef = useRef(null);
  const cursorRef = useRef(null);     // the brush-size circle that follows the pointer
  const viewportRef = useRef(null);   // the scroll/fit container (measured in responsive mode)
  const drawingRef = useRef(false);
  const activeIdRef = useRef(null); // pointerId of the stroke in progress (ignore other fingers)
  const lastRef = useRef(null); // last stroke point in bitmap coords
  const pointsRef = useRef([]); // points of the in-progress stroke, in bitmap coords
  const [tool, setTool] = useState('brush'); // 'brush' | 'eraser'
  const [color, setColor] = useState(palette[0] || '#000000');
  const [brush, setBrush] = useState(4);
  const [hovering, setHovering] = useState(false); // pointer is over the canvas
  const [fitScale, setFitScale] = useState(null);  // display scale computed to fill the container

  // In responsive mode the display scale is derived from the container so the
  // fixed-resolution board fills whatever space it's given (a small floating
  // panel or a fullscreen overlay). Otherwise the fixed `scale` prop is used.
  const effScale = responsive ? (fitScale ?? scale) : scale;
  const dispW = Math.round(width * effScale);
  const dispH = Math.round(height * effScale);

  // Reset the drawing when the bitmap dimensions change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, width, height);
  }, [width, height]);

  // Fit the board to its container (contain), recomputing on any resize.
  useEffect(() => {
    if (!responsive) return;
    const el = viewportRef.current;
    if (!el) return;
    const compute = () => {
      const cw = el.clientWidth, ch = el.clientHeight;
      if (cw > 0 && ch > 0) setFitScale(Math.min(cw / width, ch / height));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [responsive, width, height]);

  function pointFromEvent(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    // Map the on-screen position back to the (smaller) bitmap resolution.
    return {
      x: (e.clientX - rect.left) / rect.width * width,
      y: (e.clientY - rect.top) / rect.height * height,
    };
  }

  // Paint one segment from → to (plus a round dot at `to`) with an explicit style,
  // so both live drawing and remote-stroke replay share the exact same math.
  function strokeSegment(ctx, from, to, { tool, color, size }) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size;
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    // A dot so single clicks and stroke ends are round, not clipped.
    ctx.beginPath();
    ctx.fillStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color;
    ctx.arc(to.x, to.y, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function strokeTo(p) {
    const ctx = canvasRef.current.getContext('2d');
    const from = lastRef.current || p;
    strokeSegment(ctx, from, p, { tool, color, size: brush });
    lastRef.current = p;
    pointsRef.current.push(p);
  }

  // Replay a finished remote stroke onto the bitmap using its own style.
  function applyStroke(s) {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !s || !Array.isArray(s.points) || s.points.length === 0) return;
    const style = { tool: s.tool, color: s.color, size: s.size };
    let prev = s.points[0];
    strokeSegment(ctx, prev, prev, style); // dot for a single-point stroke
    for (let i = 1; i < s.points.length; i++) {
      strokeSegment(ctx, prev, s.points[i], style);
      prev = s.points[i];
    }
  }

  // Keep the brush-size circle centered on the pointer. Written straight to the
  // DOM (not state) so it tracks the cursor without a re-render per mousemove.
  function moveCursor(e) {
    const el = cursorRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    el.style.left = (e.clientX - rect.left) + 'px';
    el.style.top = (e.clientY - rect.top) + 'px';
  }

  // Pointer events (not mouse events) so touch and stylus draw exactly like a
  // mouse — a tablet never fires a mousemove drag stream, and `touch-action: none`
  // below suppresses the synthesized-mouse fallback entirely.
  function onPointerDown(e) {
    if (readOnly) return;
    if (!e.isPrimary) return;   // ignore extra fingers mid-stroke
    // Contact only: a mouse's left button or a pen's tip. Skips right/middle click
    // and a pen's barrel/eraser button, which report a non-zero `button`.
    if (e.button !== 0) return;
    e.preventDefault();
    // Capture so the stroke keeps receiving moves (and a guaranteed pointerup)
    // even when the pointer wanders outside the canvas.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    activeIdRef.current = e.pointerId;
    drawingRef.current = true;
    lastRef.current = null;
    pointsRef.current = [];
    setHovering(true); // touch has no hover, so show the brush circle from contact
    moveCursor(e);
    strokeTo(pointFromEvent(e));
  }
  function onPointerMove(e) {
    if (drawingRef.current && e.pointerId !== activeIdRef.current) return;
    moveCursor(e);
    if (!drawingRef.current) return;
    strokeTo(pointFromEvent(e));
  }
  // A mouse and a pen both hover (a pen while held above the tablet); touch does
  // not. So hover drives the brush circle for the first two, and contact drives it
  // for touch. Leaving mid-stroke never ends the stroke — capture owns it until up.
  function onPointerEnter(e) {
    if (e.pointerType === 'touch') return;
    setHovering(true);
    moveCursor(e);
  }
  function onPointerLeave(e) {
    if (e.pointerType === 'touch' || drawingRef.current) return;
    setHovering(false);
  }
  function onPointerUp(e) {
    if (e && e.pointerId !== activeIdRef.current) return;
    // A lifted pen usually still hovers, so keep its circle; pointerleave hides it
    // when the pen actually leaves range. A lifted finger is simply gone.
    if (e && e.pointerType === 'touch') setHovering(false);
    activeIdRef.current = null;
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastRef.current = null;
    // Hand the completed stroke to a collaborative consumer, if any.
    if (onStroke && pointsRef.current.length) {
      onStroke({
        strokeId: genStrokeId(),
        tool,
        color,
        size: brush,
        points: pointsRef.current.map(p => ({ x: p.x, y: p.y })),
      });
    }
    pointsRef.current = [];
  }

  function clear() {
    canvasRef.current.getContext('2d').clearRect(0, 0, width, height);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const ctx = canvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, width, height);
        // Contain-fit & center so a non-square (trimmed) part isn't stretched.
        const s = Math.min(width / img.width, height / img.height);
        const w = img.width * s, h = img.height * s;
        ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
        resolve();
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  useImperativeHandle(ref, () => ({
    exportDataURL: () => canvasRef.current.toDataURL('image/png'),
    exportPNGBlob: () => new Promise(res => canvasRef.current.toBlob(res, 'image/png')),
    loadImage,
    clear,
    applyStroke,
  }), [width, height]);

  const toolBtnStyle = (active) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, cursor: 'pointer', fontFamily: 'inherit',
    background: active ? '#2a2a2a' : 'transparent', color: active ? '#eee' : '#888',
    border: active ? '1px solid #39f' : '1px solid #333', borderRadius: 4,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
      ...(responsive ? { flex: 1, minHeight: 0, width: '100%' } : null) }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
        <button title='Brush' onClick={() => setTool('brush')} style={toolBtnStyle(tool === 'brush')}>
          <span className='material-symbols-outlined' style={{ fontSize: 18 }}>brush</span>
        </button>
        <button title='Eraser' onClick={() => setTool('eraser')} style={toolBtnStyle(tool === 'eraser')}>
          <span className='material-symbols-outlined' style={{ fontSize: 18 }}>ink_eraser</span>
        </button>
        <button title='Clear' onClick={() => (onClear ? onClear() : clear())} style={toolBtnStyle(false)}>
          <span className='material-symbols-outlined' style={{ fontSize: 18 }}>delete</span>
        </button>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#999' }}>
          Size
          <input type='range' min={1} max={16} value={brush} onChange={e => setBrush(Number(e.target.value))} style={{ width: 90 }} />
          <span style={{ width: 16, textAlign: 'right' }}>{brush}</span>
        </label>
      </div>

      <div
        ref={viewportRef}
        style={responsive
          ? { flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid #333', borderRadius: 4 }
          : { maxWidth: '100%', maxHeight: maxViewport, overflow: 'auto', border: '1px solid #333', borderRadius: 4 }}
      >
        <div style={{ position: 'relative', width: dispW, height: dispH, flexShrink: 0 }}>
          {/* Backing behind the transparent canvas bitmap (never exported). A solid
              `background` (e.g. the whiteboard's white) shows a flat fill; otherwise
              a light checkerboard keeps strokes visible over transparency. */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundColor: background || '#fff',
            ...(background ? null : {
              backgroundImage: 'linear-gradient(45deg,#e6e6e6 25%,transparent 25%,transparent 75%,#e6e6e6 75%),linear-gradient(45deg,#e6e6e6 25%,transparent 25%,transparent 75%,#e6e6e6 75%)',
              backgroundSize: '16px 16px', backgroundPosition: '0 0,8px 8px',
            }),
          }} />
          {/* The current avatar as a dimmed tracing reference, on top of the backing. */}
          {underlay && (
            <div style={{ position: 'absolute', inset: 0, opacity: 0.4, pointerEvents: 'none' }}>
              {underlay}
            </div>
          )}
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            style={{ display: 'block', position: 'relative', width: dispW, height: dispH, cursor: readOnly ? 'not-allowed' : 'none',
              touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', WebkitTapHighlightColor: 'transparent' }}
          />
          {/* Brush-size circle cursor — reflects the current pen/eraser diameter
              (screen px = brush × scale). Dashed + red for the eraser. */}
          <div
            ref={cursorRef}
            style={{
              position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 2,
              width: Math.max(brush * effScale, 4), height: Math.max(brush * effScale, 4),
              transform: 'translate(-50%, -50%)', borderRadius: '50%',
              border: tool === 'eraser' ? '1.5px dashed #e33' : '1.5px solid #333',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.8)',
              display: hovering && !readOnly ? 'block' : 'none',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
        {palette.map(c => (
          <div
            key={c}
            onClick={() => { setColor(c); setTool('brush'); }}
            title={c}
            style={{
              width: 20, height: 20, background: c, cursor: 'pointer', borderRadius: 3,
              border: color.toLowerCase() === c.toLowerCase() ? '2px solid #39f' : '2px solid #444',
              boxSizing: 'border-box',
            }}
          />
        ))}
        <input
          type='color'
          value={color}
          onChange={e => { setColor(e.target.value); setTool('brush'); }}
          title='Custom color'
          style={{ width: 24, height: 24, padding: 0, border: '1px solid #444', borderRadius: 3, background: 'transparent', cursor: 'pointer' }}
        />
      </div>
    </div>
  );
});

export default DrawCanvas;
