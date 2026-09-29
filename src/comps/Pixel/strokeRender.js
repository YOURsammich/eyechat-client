// How a freehand stroke is painted — shared by DrawCanvas (live drawing and
// remote strokes) and the whiteboard gallery's replay, so a replayed drawing
// comes out pixel-for-pixel like the board it was saved from.

// Paint one segment from → to (plus a round dot at `to`) with an explicit style.
// The eraser cuts to transparency; a white board shows through as white.
export function strokeSegment(ctx, from, to, { tool, color, size }) {
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

// Paint a whole finished stroke using its own style.
export function applyStroke(ctx, s) {
  if (!ctx || !s || !Array.isArray(s.points) || s.points.length === 0) return;
  const style = { tool: s.tool, color: s.color, size: s.size };
  let prev = s.points[0];
  strokeSegment(ctx, prev, prev, style); // dot for a single-point stroke
  for (let i = 1; i < s.points.length; i++) {
    strokeSegment(ctx, prev, s.points[i], style);
    prev = s.points[i];
  }
}
