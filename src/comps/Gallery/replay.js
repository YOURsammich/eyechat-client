import { strokeSegment } from '../Pixel/strokeRender';

// Stroke-by-stroke replay of a saved whiteboard drawing.
//
// Timing: each stroke carries `t`, when the server received it (i.e. when it was
// finished). The pause before a stroke is the real gap between its `t` and the
// previous one, capped at MAX_GAP_MS so a drawing made over an afternoon doesn't
// sit still for hours. Nothing records how fast a stroke itself was drawn, so
// every stroke animates along its points at the same PX_PER_MS. Strokes without
// a `t` (from before it was recorded) get no pause at all.

export const MAX_GAP_MS = 1000;
export const PX_PER_MS = 1.5;

// When each point of each stroke is drawn, in ms from the start of the replay.
// Returns { strokes: [{ stroke, times }], duration }.
export function schedule(strokes) {
  const out = [];
  let clock = 0;
  let prevT = null;
  for (const stroke of strokes) {
    const pts = Array.isArray(stroke.points) ? stroke.points : [];
    if (pts.length === 0) continue;
    if (prevT != null && Number.isFinite(stroke.t)) {
      clock += Math.min(Math.max(stroke.t - prevT, 0), MAX_GAP_MS);
    }
    if (Number.isFinite(stroke.t)) prevT = stroke.t;

    const times = [clock];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
      clock += Math.hypot(dx, dy) / PX_PER_MS;
      times.push(clock);
    }
    out.push({ stroke, times });
  }
  return { strokes: out, duration: clock };
}

// Plays a schedule onto a 2D context. Drive it with advance(ms) — the player
// keeps its own clock and a cursor into the schedule, so pausing is simply not
// calling advance, and speed is a multiplier on the ms passed in.
export class Player {
  constructor(ctx, width, height, strokes) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.plan = schedule(strokes);
    this.reset();
  }

  reset() {
    this.clock = 0;
    this.si = 0;   // stroke index
    this.pi = 0;   // next point to draw in that stroke
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  get done() {
    return this.si >= this.plan.strokes.length;
  }

  // Move the clock forward and paint every segment that is now due.
  advance(ms) {
    this.clock += ms;
    const list = this.plan.strokes;
    while (this.si < list.length) {
      const { stroke, times } = list[this.si];
      if (times[this.pi] > this.clock) break;
      const style = { tool: stroke.tool, color: stroke.color, size: stroke.size };
      const to = stroke.points[this.pi];
      const from = this.pi === 0 ? to : stroke.points[this.pi - 1];
      strokeSegment(this.ctx, from, to, style);
      this.pi++;
      if (this.pi >= stroke.points.length) {
        this.si++;
        this.pi = 0;
      }
    }
    return this.done;
  }
}
