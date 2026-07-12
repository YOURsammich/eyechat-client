import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';

// Reusable pixel-art painting surface. Feature-agnostic: it knows nothing about
// avatars/emojis/whiteboards — a consumer feeds it a grid size and drives it via
// the imperative ref API (exportPNGBlob / exportDataURL / loadImage / clear).
//
// Source of truth is a flat RGBA Uint8ClampedArray (width*height*4). The visible
// <canvas> is that buffer scaled up with smoothing off, so every logical pixel is
// a big, clickable cell. Painting reuses the mousedown → enter/drag → up pattern
// from FlairBuilder.jsx.

const DEFAULT_PALETTE = [
  '#000000', '#ffffff', '#7f7f7f', '#c3c3c3',
  '#ed1c24', '#ff7f27', '#fff200', '#22b14c',
  '#00a2e8', '#3f48cc', '#a349a4', '#b97a57',
  '#ffaec9', '#b5e61d', '#99d9ea', '#7092be',
];

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const TOOLS = [
  { id: 'pencil',    icon: 'edit',            title: 'Pencil' },
  { id: 'eraser',    icon: 'ink_eraser',      title: 'Eraser' },
  { id: 'eyedropper', icon: 'colorize',       title: 'Eyedropper' },
  { id: 'fill',      icon: 'format_color_fill', title: 'Fill' },
];

const PixelCanvas = forwardRef(function PixelCanvas(
  { width, height, scale = 12, palette = DEFAULT_PALETTE, background = 'transparent', underlay = null, maxViewport = 360 },
  ref,
) {
  const canvasRef = useRef(null);
  const bufRef = useRef(new Uint8ClampedArray(width * height * 4));
  const drawingRef = useRef(false);
  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState(palette[0] || '#000000');
  const [zoom, setZoom] = useState(scale);
  // Bump to force a repaint after a mutation to the (mutable) buffer.
  const [, setTick] = useState(0);
  const repaint = () => setTick(t => t + 1);

  const isSolidBg = background && background !== 'transparent';

  // Reset the buffer whenever the grid dimensions change.
  useEffect(() => {
    bufRef.current = new Uint8ClampedArray(width * height * 4);
    if (isSolidBg) {
      const [r, g, b] = hexToRgb(background);
      const buf = bufRef.current;
      for (let i = 0; i < width * height; i++) {
        buf[i * 4] = r; buf[i * 4 + 1] = g; buf[i * 4 + 2] = b; buf[i * 4 + 3] = 255;
      }
    }
    repaint();
  }, [width, height, background]);

  // Render the buffer scaled up, then overlay a faint grid.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Draw the buffer onto a native-resolution offscreen canvas first, then blit
    // it scaled with smoothing disabled so pixels stay crisp.
    const off = document.createElement('canvas');
    off.width = width; off.height = height;
    off.getContext('2d').putImageData(new ImageData(bufRef.current.slice(), width, height), 0, 0);

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Checkerboard so transparency is visible on non-solid backgrounds — but skip
    // it when an underlay is present, so transparent cells reveal the underlay.
    if (!isSolidBg && !underlay) {
      ctx.fillStyle = '#bbb';
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if ((x + y) % 2) {
            ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
          }
        }
      }
      ctx.fillStyle = '#eee';
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if ((x + y) % 2 === 0) {
            ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
          }
        }
      }
    }
    ctx.drawImage(off, 0, 0, width, height, 0, 0, width * zoom, height * zoom);

    // Grid lines (only when cells are big enough to be worth it).
    if (zoom >= 6) {
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= width; x++) { ctx.moveTo(x * zoom + 0.5, 0); ctx.lineTo(x * zoom + 0.5, height * zoom); }
      for (let y = 0; y <= height; y++) { ctx.moveTo(0, y * zoom + 0.5); ctx.lineTo(width * zoom, y * zoom + 0.5); }
      ctx.stroke();
    }
  });

  function setPixel(x, y, rgba) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    const buf = bufRef.current;
    buf[i] = rgba[0]; buf[i + 1] = rgba[1]; buf[i + 2] = rgba[2]; buf[i + 3] = rgba[3];
  }

  function getPixel(x, y) {
    const i = (y * width + x) * 4;
    const buf = bufRef.current;
    return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]];
  }

  // Flood fill (4-connected) from (x,y) with the current color.
  function fill(x, y, rgba) {
    const target = getPixel(x, y);
    if (target[0] === rgba[0] && target[1] === rgba[1] && target[2] === rgba[2] && target[3] === rgba[3]) return;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
      const p = getPixel(cx, cy);
      if (p[0] !== target[0] || p[1] !== target[1] || p[2] !== target[2] || p[3] !== target[3]) continue;
      setPixel(cx, cy, rgba);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  }

  function cellFromEvent(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - rect.left) / zoom),
      y: Math.floor((e.clientY - rect.top) / zoom),
    };
  }

  // Applies the active tool at a cell. Returns true if the buffer changed.
  function applyAt(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    if (tool === 'eyedropper') {
      const [r, g, b, a] = getPixel(x, y);
      if (a > 0) setColor(`#${[r, g, b].map(n => n.toString(16).padStart(2, '0')).join('')}`);
      return false;
    }
    if (tool === 'eraser') {
      // On a solid background, "erase" paints the background color; otherwise clears to transparent.
      setPixel(x, y, isSolidBg ? [...hexToRgb(background), 255] : [0, 0, 0, 0]);
      return true;
    }
    const rgba = [...hexToRgb(color), 255];
    if (tool === 'fill') { fill(x, y, rgba); return true; }
    setPixel(x, y, rgba); // pencil
    return true;
  }

  function onMouseDown(e) {
    e.preventDefault();
    const { x, y } = cellFromEvent(e);
    // Fill/eyedropper are one-shot; pencil/eraser drag.
    drawingRef.current = tool === 'pencil' || tool === 'eraser';
    if (applyAt(x, y)) repaint();
  }

  function onMouseMove(e) {
    if (!drawingRef.current) return;
    const { x, y } = cellFromEvent(e);
    if (applyAt(x, y)) repaint();
  }

  function onMouseUp() { drawingRef.current = false; }

  function clear() {
    const buf = bufRef.current;
    if (isSolidBg) {
      const [r, g, b] = hexToRgb(background);
      for (let i = 0; i < width * height; i++) {
        buf[i * 4] = r; buf[i * 4 + 1] = g; buf[i * 4 + 2] = b; buf[i * 4 + 3] = 255;
      }
    } else {
      buf.fill(0);
    }
    repaint();
  }

  // Render the buffer to a native-size PNG (no upscaling), for upload/persist.
  function toExportCanvas() {
    const off = document.createElement('canvas');
    off.width = width; off.height = height;
    off.getContext('2d').putImageData(new ImageData(bufRef.current.slice(), width, height), 0, 0);
    return off;
  }

  // Rasterize an arbitrary image down onto the grid (backs the stretch-goal import).
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const off = document.createElement('canvas');
        off.width = width; off.height = height;
        const octx = off.getContext('2d');
        octx.imageSmoothingEnabled = false;
        if (isSolidBg) { octx.fillStyle = background; octx.fillRect(0, 0, width, height); }
        // Contain-fit & center so a non-square (trimmed) part isn't stretched.
        const s = Math.min(width / img.width, height / img.height);
        const dw = img.width * s, dh = img.height * s;
        octx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
        bufRef.current = new Uint8ClampedArray(octx.getImageData(0, 0, width, height).data);
        repaint();
        resolve();
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  useImperativeHandle(ref, () => ({
    exportDataURL: () => toExportCanvas().toDataURL('image/png'),
    exportPNGBlob: () => new Promise(res => toExportCanvas().toBlob(res, 'image/png')),
    loadImage,
    clear,
  }), [width, height, background]);

  const toolBtnStyle = (active) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, cursor: 'pointer', fontFamily: 'inherit',
    background: active ? '#2a2a2a' : 'transparent', color: active ? '#eee' : '#888',
    border: active ? '1px solid #39f' : '1px solid #333', borderRadius: 4,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
        {TOOLS.map(t => (
          <button key={t.id} title={t.title} onClick={() => setTool(t.id)} style={toolBtnStyle(tool === t.id)}>
            <span className='material-symbols-outlined' style={{ fontSize: 18 }}>{t.icon}</span>
          </button>
        ))}
        <button title='Clear' onClick={clear} style={toolBtnStyle(false)}>
          <span className='material-symbols-outlined' style={{ fontSize: 18 }}>delete</span>
        </button>
        <button title='Zoom out' onClick={() => setZoom(z => Math.max(2, z - 2))} style={toolBtnStyle(false)}>
          <span className='material-symbols-outlined' style={{ fontSize: 18 }}>zoom_out</span>
        </button>
        <button title='Zoom in' onClick={() => setZoom(z => Math.min(40, z + 2))} style={toolBtnStyle(false)}>
          <span className='material-symbols-outlined' style={{ fontSize: 18 }}>zoom_in</span>
        </button>
      </div>

      <div style={{ maxWidth: '100%', maxHeight: maxViewport, overflow: 'auto', border: '1px solid #333', borderRadius: 4 }}>
        <div style={{ position: 'relative', width: width * zoom, height: height * zoom }}>
          {underlay && (
            <>
              {/* Light backing so painted (esp. dark) cells stay visible; the
                  underlay avatar sits on top of it, dimmed. Neither is exported. */}
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                backgroundColor: '#fff',
                backgroundImage: 'linear-gradient(45deg,#e6e6e6 25%,transparent 25%,transparent 75%,#e6e6e6 75%),linear-gradient(45deg,#e6e6e6 25%,transparent 25%,transparent 75%,#e6e6e6 75%)',
                backgroundSize: '16px 16px', backgroundPosition: '0 0,8px 8px',
              }} />
              <div style={{ position: 'absolute', inset: 0, opacity: 0.4, pointerEvents: 'none' }}>
                {underlay}
              </div>
            </>
          )}
          <canvas
            ref={canvasRef}
            width={width * zoom}
            height={height * zoom}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            style={{ display: 'block', position: 'relative', cursor: 'crosshair', touchAction: 'none' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
        {palette.map(c => (
          <div
            key={c}
            onClick={() => setColor(c)}
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
          onChange={e => setColor(e.target.value)}
          title='Custom color'
          style={{ width: 24, height: 24, padding: 0, border: '1px solid #444', borderRadius: 3, background: 'transparent', cursor: 'pointer' }}
        />
      </div>
    </div>
  );
});

export default PixelCanvas;
