import { useRef, useState, useEffect } from 'react';

// Freeform avatar builder. Imported parts become movable / resizable / rotatable /
// flippable layers on a square stage, with an optional freehand brush layer on top.
// Layers live in logical STAGE units; on save everything is flattened to one PNG
// (at EXPORT resolution) for display, and the layer layout is kept as a project so
// the avatar can be reopened and re-arranged.

const STAGE = 300;   // logical stage units == display px
const EXPORT = 256;  // flattened output resolution
const PALETTE = ['#000000', '#ffffff', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#a349a4', '#b97a57', '#ffaec9'];

let LAYER_SEQ = 1;
const newId = () => `L${LAYER_SEQ++}`;

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const SLOT_ORDER = ['heads', 'eyes', 'noses', 'mouths', 'hair'];

export default function AvatarComposer({ parts = {}, projectUrl = null, onSaved }) {
  const stageRef = useRef(null);
  const drawRef = useRef(null);      // freehand layer canvas (backing = EXPORT)
  const dragRef = useRef(null);      // active layer drag/resize/rotate gesture
  const drawingRef = useRef(false);  // brush stroke in progress
  const strokeRef = useRef(null);    // last brush point
  const drewRef = useRef(false);     // whether the brush layer has any content

  const [layers, setLayers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [tool, setTool] = useState('select'); // 'select' | 'brush' | 'eraser'
  const [importType, setImportType] = useState('heads'); // which part type to import
  const [color, setColor] = useState('#000000');
  const [brush, setBrush] = useState(6);
  const [status, setStatus] = useState(null); // null | 'saving' | 'saved' | 'error'

  // Load an existing project to re-edit.
  useEffect(() => {
    if (!projectUrl) return;
    let cancelled = false;
    fetch(projectUrl)
      .then(r => r.json())
      .then(async (p) => {
        if (cancelled || !p || !Array.isArray(p.layers)) return;
        const s = STAGE / (p.stage || STAGE); // normalize if saved at a different stage size
        setLayers(p.layers.map(l => ({
          id: newId(), src: l.src, cx: l.cx * s, cy: l.cy * s, w: l.w * s, h: l.h * s, rot: l.rot || 0, flip: !!l.flip,
        })));
        if (p.draw) {
          try {
            const img = await loadImg(`${projectUrl.replace(/[^/]+$/, '')}${p.draw}`);
            const ctx = drawRef.current.getContext('2d');
            ctx.drawImage(img, 0, 0, EXPORT, EXPORT);
            drewRef.current = true;
          } catch {}
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [projectUrl]);

  // ---- coordinate helpers (map a pointer event into logical stage units) ----
  function stagePoint(e) {
    const rect = stageRef.current.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (STAGE / rect.width), y: (e.clientY - rect.top) * (STAGE / rect.height) };
  }

  // ---- layer gestures ----
  function beginDrag(e, mode, layer) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(layer.id);
    const p = stagePoint(e);
    dragRef.current = {
      mode, id: layer.id, p, start: { ...layer },
      initDist: Math.hypot(p.x - layer.cx, p.y - layer.cy) || 1,
      initAng: Math.atan2(p.y - layer.cy, p.x - layer.cx),
    };
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', endDrag);
  }
  function onDragMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const p = stagePoint(e);
    setLayers(prev => prev.map(l => {
      if (l.id !== d.id) return l;
      if (d.mode === 'move') return { ...l, cx: d.start.cx + (p.x - d.p.x), cy: d.start.cy + (p.y - d.p.y) };
      if (d.mode === 'resize') {
        const scale = Math.max(0.05, Math.hypot(p.x - d.start.cx, p.y - d.start.cy) / d.initDist);
        return { ...l, w: Math.max(8, d.start.w * scale), h: Math.max(8, d.start.h * scale) };
      }
      if (d.mode === 'rotate') {
        return { ...l, rot: d.start.rot + (Math.atan2(p.y - d.start.cy, p.x - d.start.cx) - d.initAng) };
      }
      return l;
    }));
  }
  function endDrag() {
    dragRef.current = null;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', endDrag);
  }

  async function addLayer(src) {
    // Size the layer by the image's real aspect ratio so its box tightly matches
    // the (content-tight) art instead of being forced square.
    let w = 120, h = 120;
    try {
      const img = await loadImg(src);
      const nat = Math.max(img.naturalWidth, img.naturalHeight) || 1;
      const target = 130; // desired max on-stage dimension for a freshly added part
      w = (img.naturalWidth / nat) * target;
      h = (img.naturalHeight / nat) * target;
    } catch {}
    setLayers(prev => [...prev, { id: newId(), src, cx: STAGE / 2, cy: STAGE / 2, w, h, rot: 0, flip: false }]);
    setStatus(null);
  }
  const updateSelected = (patch) => setLayers(prev => prev.map(l => (l.id === selectedId ? { ...l, ...patch } : l)));
  const selectedLayer = layers.find(l => l.id === selectedId) || null;
  function deleteSelected() { setLayers(prev => prev.filter(l => l.id !== selectedId)); setSelectedId(null); }
  function reorder(dir) {
    setLayers(prev => {
      const i = prev.findIndex(l => l.id === selectedId);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  // ---- freehand brush layer ----
  function drawPoint(e) {
    const canvas = drawRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * EXPORT;
    const y = (e.clientY - rect.top) / rect.height * EXPORT;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brush;
    if (tool === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = 'rgba(0,0,0,1)'; ctx.fillStyle = 'rgba(0,0,0,1)'; }
    else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = color; ctx.fillStyle = color; }
    const from = strokeRef.current || { x, y };
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(x, y); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, brush / 2, 0, Math.PI * 2); ctx.fill();
    strokeRef.current = { x, y };
    drewRef.current = true;
  }
  function onDrawDown(e) { e.preventDefault(); drawingRef.current = true; strokeRef.current = null; drawPoint(e); }
  function onDrawMove(e) { if (drawingRef.current) drawPoint(e); }
  function onDrawUp() { drawingRef.current = false; strokeRef.current = null; }
  function clearDrawing() {
    drawRef.current.getContext('2d').clearRect(0, 0, EXPORT, EXPORT);
    drewRef.current = false;
    setStatus(null);
  }

  // ---- flatten & save ----
  async function flatten() {
    const off = document.createElement('canvas');
    off.width = EXPORT; off.height = EXPORT;
    const ctx = off.getContext('2d');
    const s = EXPORT / STAGE;
    for (const l of layers) {
      let img;
      try { img = await loadImg(l.src); } catch { continue; }
      ctx.save();
      ctx.translate(l.cx * s, l.cy * s);
      ctx.rotate(l.rot);
      ctx.scale(l.flip ? -1 : 1, 1);
      ctx.drawImage(img, -l.w * s / 2, -l.h * s / 2, l.w * s, l.h * s);
      ctx.restore();
    }
    ctx.drawImage(drawRef.current, 0, 0, EXPORT, EXPORT);
    return off;
  }
  const toBlob = (canvas) => new Promise(res => canvas.toBlob(res, 'image/png'));

  async function save() {
    if (!layers.length && !drewRef.current) { setStatus('empty'); return; }
    setStatus('saving');
    try {
      const flat = await toBlob(await flatten());
      const fd = new FormData();
      fd.append('flat', flat, 'a.png');
      if (drewRef.current) fd.append('draw', await toBlob(drawRef.current), 'd.png');
      fd.append('project', JSON.stringify({
        v: 1, stage: STAGE, export: EXPORT,
        layers: layers.map(({ src, cx, cy, w, h, rot, flip }) => ({ src, cx, cy, w, h, rot, flip })),
      }));
      const res = await fetch('/a/upload/avatar', { method: 'POST', body: fd }).then(r => r.json());
      if (res.error || !res.ref) { setStatus('error'); return; }
      onSaved?.({ whole: res.ref });
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  // ---- import thumbnails (all parts of the chosen type — built-in and user-made alike) ----
  const importItems = (parts[importType] || []).map(f => `/images/avatars/${importType}/${f}`);

  const toolBtn = (active, extra = {}) => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30,
    cursor: 'pointer', fontFamily: 'inherit', borderRadius: 4,
    background: active ? '#2a2a2a' : 'transparent', color: active ? '#eee' : '#888',
    border: active ? '1px solid #39f' : '1px solid #333', ...extra,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Tools */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <button title='Select / move' onClick={() => setTool('select')} style={toolBtn(tool === 'select')}>
          <span className='material-symbols-outlined' style={{ fontSize: 18 }}>arrow_selector_tool</span>
        </button>
        <button title='Brush' onClick={() => setTool('brush')} style={toolBtn(tool === 'brush')}>
          <span className='material-symbols-outlined' style={{ fontSize: 18 }}>brush</span>
        </button>
        <button title='Eraser' onClick={() => setTool('eraser')} style={toolBtn(tool === 'eraser')}>
          <span className='material-symbols-outlined' style={{ fontSize: 18 }}>ink_eraser</span>
        </button>
        {(tool === 'brush' || tool === 'eraser') && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#999' }}>
            <input type='range' min={1} max={40} value={brush} onChange={e => setBrush(Number(e.target.value))} style={{ width: 70 }} />
            {brush}
          </label>
        )}
        {tool === 'brush' && (
          <input type='color' value={color} onChange={e => setColor(e.target.value)} title='Brush color'
            style={{ width: 24, height: 24, padding: 0, border: '1px solid #444', borderRadius: 3, background: 'transparent', cursor: 'pointer' }} />
        )}
        <button title='Clear drawing' onClick={clearDrawing} style={toolBtn(false)}>
          <span className='material-symbols-outlined' style={{ fontSize: 18 }}>delete_sweep</span>
        </button>
      </div>

      {tool === 'brush' && (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {PALETTE.map(c => (
            <div key={c} onClick={() => setColor(c)} title={c} style={{
              width: 18, height: 18, background: c, cursor: 'pointer', borderRadius: 3,
              border: color.toLowerCase() === c.toLowerCase() ? '2px solid #39f' : '2px solid #444', boxSizing: 'border-box',
            }} />
          ))}
        </div>
      )}

      {/* Stage */}
      <div
        ref={stageRef}
        onMouseDown={() => { if (tool === 'select') setSelectedId(null); }}
        style={{
          position: 'relative', width: STAGE, height: STAGE, alignSelf: 'center', maxWidth: '100%',
          borderRadius: 6, border: '1px solid #333', overflow: 'hidden',
          backgroundColor: '#fff',
          backgroundImage: 'linear-gradient(45deg,#e6e6e6 25%,transparent 25%,transparent 75%,#e6e6e6 75%),linear-gradient(45deg,#e6e6e6 25%,transparent 25%,transparent 75%,#e6e6e6 75%)',
          backgroundSize: '20px 20px', backgroundPosition: '0 0,10px 10px',
        }}
      >
        {layers.map(l => (
          <div key={l.id} style={{
            position: 'absolute', left: l.cx - l.w / 2, top: l.cy - l.h / 2, width: l.w, height: l.h,
            transform: `rotate(${l.rot}rad) scaleX(${l.flip ? -1 : 1})`, transformOrigin: 'center center',
          }}>
            <img src={l.src} draggable={false}
              onMouseDown={e => tool === 'select' && beginDrag(e, 'move', l)}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', cursor: tool === 'select' ? 'move' : 'default', pointerEvents: tool === 'select' ? 'auto' : 'none' }} />
          </div>
        ))}

        {/* Selection overlay (un-flipped so handles stay intuitive) */}
        {selectedLayer && tool === 'select' && (
          <div style={{
            position: 'absolute', left: selectedLayer.cx - selectedLayer.w / 2, top: selectedLayer.cy - selectedLayer.h / 2,
            width: selectedLayer.w, height: selectedLayer.h, transform: `rotate(${selectedLayer.rot}rad)`, transformOrigin: 'center center',
            border: '1px dashed #39f', pointerEvents: 'none',
          }}>
            {/* resize handle (bottom-right) */}
            <div onMouseDown={e => beginDrag(e, 'resize', selectedLayer)} style={{
              position: 'absolute', right: -7, bottom: -7, width: 12, height: 12, background: '#39f', borderRadius: 2,
              cursor: 'nwse-resize', pointerEvents: 'auto',
            }} />
            {/* rotate handle (top-center) */}
            <div onMouseDown={e => beginDrag(e, 'rotate', selectedLayer)} style={{
              position: 'absolute', left: '50%', top: -22, width: 12, height: 12, marginLeft: -6, background: '#39f',
              borderRadius: '50%', cursor: 'grab', pointerEvents: 'auto',
            }} />
          </div>
        )}

        {/* Freehand layer on top */}
        <canvas
          ref={drawRef}
          width={EXPORT}
          height={EXPORT}
          onMouseDown={onDrawDown}
          onMouseMove={onDrawMove}
          onMouseUp={onDrawUp}
          onMouseLeave={onDrawUp}
          style={{
            position: 'absolute', inset: 0, width: STAGE, height: STAGE,
            pointerEvents: tool === 'select' ? 'none' : 'auto', cursor: 'crosshair', touchAction: 'none',
          }}
        />
      </div>

      {/* Selected-layer actions */}
      {selectedLayer && (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
          <button title='Flip' onClick={() => updateSelected({ flip: !selectedLayer.flip })} style={toolBtn(false)}>
            <span className='material-symbols-outlined' style={{ fontSize: 18 }}>flip</span>
          </button>
          <button title='Bring forward' onClick={() => reorder(1)} style={toolBtn(false)}>
            <span className='material-symbols-outlined' style={{ fontSize: 18 }}>flip_to_front</span>
          </button>
          <button title='Send back' onClick={() => reorder(-1)} style={toolBtn(false)}>
            <span className='material-symbols-outlined' style={{ fontSize: 18 }}>flip_to_back</span>
          </button>
          <button title='Delete layer' onClick={deleteSelected} style={toolBtn(false, { borderColor: '#a33' })}>
            <span className='material-symbols-outlined' style={{ fontSize: 18, color: '#e66' }}>delete</span>
          </button>
        </div>
      )}

      {/* Import panel — pick a part type, then add any part of that type */}
      <div>
        <div style={{ fontSize: 11, color: '#777', marginBottom: 4 }}>Add a part</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {SLOT_ORDER.map(type => (
            <button key={type} onClick={() => setImportType(type)} style={{
              padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize',
              borderRadius: 4, boxSizing: 'border-box',
              background: importType === type ? '#2a2a2a' : 'transparent', color: importType === type ? '#eee' : '#888',
              border: importType === type ? '1px solid #39f' : '1px solid #333',
            }}>{type}</button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxHeight: 120, overflowY: 'auto' }}>
          {importItems.length === 0
            ? <div style={{ fontSize: 11, color: '#666' }}>No {importType} yet — draw & publish some in Draw Part mode.</div>
            : importItems.map(src => (
              <img key={src} src={src} title='Add to canvas' loading='lazy' onClick={() => addLayer(src)} style={{
                width: 38, height: 38, cursor: 'pointer', borderRadius: 4, border: '2px solid #3a3a3a',
                background: 'white', objectFit: 'contain', boxSizing: 'border-box',
              }} />
            ))}
        </div>
      </div>

      <button className='stdBtn' onClick={save} disabled={status === 'saving'} style={{ width: '100%', padding: '7px 0' }}>
        {status === 'saving' ? 'Saving…'
          : status === 'saved' ? 'Saved!'
            : status === 'empty' ? 'Add a part or draw something first'
              : status === 'error' ? 'Error — try again'
                : 'Save as my avatar'}
      </button>
    </div>
  );
}
