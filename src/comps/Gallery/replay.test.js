import { describe, it, expect, vi } from 'vitest';
import { schedule, Player, MAX_GAP_MS, PX_PER_MS } from './replay';

const line = (t, extra = {}) => ({
  tool: 'brush', color: '#000', size: 2, t,
  points: [{ x: 0, y: 0 }, { x: 30, y: 0 }], ...extra,
});

describe('schedule', () => {
  it('animates each stroke at a fixed speed along its length', () => {
    const { strokes, duration } = schedule([line(1000)]);
    expect(strokes[0].times).toEqual([0, 30 / PX_PER_MS]);
    expect(duration).toBe(30 / PX_PER_MS);
  });

  it('pauses by the real gap between strokes, capped', () => {
    const strokeMs = 30 / PX_PER_MS;
    const short = schedule([line(1000), line(1300)]);
    expect(short.strokes[1].times[0]).toBe(strokeMs + 300);

    const long = schedule([line(1000), line(1000 + 3_600_000)]);
    expect(long.strokes[1].times[0]).toBe(strokeMs + MAX_GAP_MS);
  });

  it('gives strokes without a time no pause', () => {
    const { strokes } = schedule([line(undefined), line(undefined)]);
    expect(strokes[1].times[0]).toBe(strokes[0].times[1]);
  });

  it('skips strokes with no points', () => {
    expect(schedule([{ points: [] }, line(1)]).strokes).toHaveLength(1);
  });
});

function fakeCtx() {
  return {
    clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    stroke: vi.fn(), arc: vi.fn(), fill: vi.fn(),
  };
}

describe('Player', () => {
  it('paints only what is due, and finishes at the end of the schedule', () => {
    const ctx = fakeCtx();
    const p = new Player(ctx, 1600, 900, [line(1), line(2)]);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 1600, 900);

    p.advance(0);                         // first point of the first stroke
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    expect(p.done).toBe(false);

    expect(p.advance(10_000)).toBe(true);  // everything else
    expect(ctx.stroke).toHaveBeenCalledTimes(4);
  });

  it('starts over on reset', () => {
    const ctx = fakeCtx();
    const p = new Player(ctx, 10, 10, [line(1)]);
    p.advance(10_000);
    p.reset();
    expect(p.done).toBe(false);
    expect(ctx.clearRect).toHaveBeenCalledTimes(2);
  });
});
