// ─────────────────────────────────────────────────────────────────────────────
// SOLVE FOR X — client floating panel.
//
// A head-to-head timed set of ten equations (feedback #83). The server
// (src/games/solvex.js) owns the lobby, the problems, the answers and the
// clock; this panel is a view over its `sx:` events with four screens:
//
//   none / over   →  the "new game" form (with the last result above it)
//   lobby         →  who's in, the buy-in, Join / Leave, the host's Start
//   countdown     →  3-2-1
//   playing       →  the current problem and an answer box, our clock, and a
//                    progress line per opponent
//
// Only `sx:state` (public: progress, no answers) goes to the room; the problem
// text and the right/wrong verdict come to the player alone. The clock is
// ours to draw but the server's to decide: we run it from `startAt` using the
// offset between the server's `serverNow` and our own clock at receive time,
// and the final times on the result screen are whatever the server measured.
//
// Self-contained: to remove, delete this directory and the two registry lines
// (comps/activities.js, comps/activityPanels.js).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import DraggableWindow from '../DraggableWindow';

const DIFFICULTIES = [
  { id: 'easy',   label: 'Easy',   hint: 'x + 7 = 12' },
  { id: 'medium', label: 'Medium', hint: '3x - 7 = 11' },
  { id: 'hard',   label: 'Hard',   hint: '5x - 3 = 2x + 12' },
];

const FEEDBACK_MS = 1400;    // how long the ✓ / ✗ verdict flashes under the box

const MONO = 'ui-monospace, Menlo, Consolas, monospace';

const btn = {
  background: '#2a2a2a', border: '1px solid #444', color: '#ccc', borderRadius: 4,
  padding: '5px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1.4,
};
const btnPrimary = { ...btn, background: '#1a3a5c', borderColor: '#2a5a8c', color: '#8cf' };
const btnDanger = { ...btn, borderColor: '#5a2a2a', color: '#c66' };
const btnDisabled = { ...btn, opacity: 0.45, cursor: 'default' };
const input = {
  background: '#1e1e1e', border: '1px solid #444', color: '#ddd', borderRadius: 4,
  padding: '5px 8px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
};
const muted = { color: '#888', fontSize: 12 };

// "1:02.3" — tenths matter when two people are racing the same ten problems.
function fmtClock(ms) {
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const s = ((t % 60000) / 1000).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

function SolveXPanel({ socket, user, onClose }) {
  const myNick = user?.nick || (typeof window !== 'undefined' && window.store ? window.store.get('nick') : undefined);
  const myCoins = user?.coins ?? 0;

  const [state, setState] = useState(null);         // last sx:state
  const [problem, setProblem] = useState(null);     // { id, index, text } — ours, if racing
  const [verdict, setVerdict] = useState(null);     // last sx:answered, flashed briefly
  const [value, setValue] = useState('');
  const [difficulty, setDifficulty] = useState('easy');
  const [bet, setBet] = useState('0');
  const [, setTick] = useState(0);                 // re-render driver for the clocks

  const offsetRef = useRef(0);                      // serverNow - Date.now(), from the last state
  const inputRef = useRef(null);

  const serverNow = () => Date.now() + offsetRef.current;

  // ── socket wiring ────────────────────────────────────────────────────────────
  useEffect(() => {
    const requestSync = () => socket.emit('sx:sync', {});

    const offState = socket.on('sx:state', (s) => {
      if (!s) return;
      if (typeof s.serverNow === 'number') offsetRef.current = s.serverNow - Date.now();
      setState(s);
      // A problem from a previous game must not linger over a new lobby.
      setProblem(p => (p && s.id !== p.id) ? null : p);
    });
    const offProblem = socket.on('sx:problem', (p) => {
      setProblem(p);
      setValue('');
    });
    const offAnswered = socket.on('sx:answered', (a) => setVerdict({ ...a, at: Date.now() }));
    const offOver = socket.on('sx:over', () => setProblem(null));

    const offReconnect = socket.onReconnect ? socket.onReconnect(requestSync) : null;
    requestSync();
    return () => {
      offState(); offProblem(); offAnswered(); offOver();
      if (offReconnect) offReconnect();
      socket.emit('sx:leave', {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // ── clocks ───────────────────────────────────────────────────────────────────
  // Ten frames a second while anything is timing — the countdown or a race.
  const timing = state && (state.state === 'countdown' || state.state === 'playing');
  useEffect(() => {
    if (!timing) return;
    const id = setInterval(() => setTick(t => t + 1), 100);
    return () => clearInterval(id);
  }, [timing]);

  // The verdict flash clears itself.
  useEffect(() => {
    if (!verdict) return;
    const id = setTimeout(() => setVerdict(null), FEEDBACK_MS);
    return () => clearTimeout(id);
  }, [verdict]);

  // Keep the cursor in the answer box while racing; every problem re-focuses.
  const me = state?.players?.find(p => p.nick === myNick) ?? null;
  const racing = state?.state === 'playing' && me && !me.done && !me.forfeited && problem;
  useEffect(() => {
    if (racing && inputRef.current) inputRef.current.focus();
  }, [racing, problem?.index]);

  // ── actions ──────────────────────────────────────────────────────────────────
  const create = () => socket.emit('sx:create', { difficulty, bet: Math.max(0, Math.floor(Number(bet) || 0)) });
  const join = () => socket.emit('sx:join', {});
  const quit = () => socket.emit('sx:quit', {});
  const start = () => socket.emit('sx:start', {});

  const submit = (e) => {
    e?.preventDefault();
    if (!racing) return;
    const v = value.trim();
    if (!/^-?\d+$/.test(v)) return;       // integers only; anything else is a typo, not an answer
    socket.emit('sx:answer', { index: problem.index, value: Number(v) });
    setValue('');
  };

  // ── screens ──────────────────────────────────────────────────────────────────

  function renderForm() {
    const b = Math.max(0, Math.floor(Number(bet) || 0));
    const short = b > myCoins;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontWeight: 'bold', color: '#eee' }}>New game</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {DIFFICULTIES.map(d => (
            <button
              key={d.id}
              onClick={() => setDifficulty(d.id)}
              title={d.hint}
              aria-pressed={difficulty === d.id}
              style={difficulty === d.id ? { ...btn, background: '#333', borderColor: '#777', color: '#fff' } : btn}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div style={muted}>{DIFFICULTIES.find(d => d.id === difficulty)?.hint} — same ten for everyone.</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          Buy-in ₵
          <input
            type='number' min='0' step='1' value={bet}
            onChange={e => setBet(e.target.value)}
            style={{ ...input, width: 90 }}
          />
          <span style={muted}>you have ₵{myCoins}</span>
        </label>
        <div>
          <button onClick={create} disabled={short} style={short ? btnDisabled : btnPrimary}>
            Open lobby
          </button>
        </div>
      </div>
    );
  }

  function renderLobby() {
    const isHost = state.host === myNick;
    const seated = !!me;
    const short = !seated && state.bet > myCoins;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', color: '#eee' }}>Lobby</span>
          <span style={muted}>{state.difficulty} · {state.bet ? `₵${state.bet} buy-in · pot ₵${state.pot}` : 'no buy-in'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 13 }}>
          {state.players.map(p => (
            <div key={p.nick}>
              <span style={{ color: p.nick === myNick ? '#8cf' : '#ddd' }}>{p.nick}</span>
              {p.nick === state.host && <span style={{ ...muted, marginLeft: 6 }}>host</span>}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {isHost && (
            <button
              onClick={start}
              style={btnPrimary}
              title={state.players.length < 2 ? 'Start alone — a time trial against yourself' : 'Start the countdown'}
            >
              {state.players.length < 2 ? 'Start solo' : 'Start'}
            </button>
          )}
          {seated
            ? <button onClick={quit} style={btnDanger}>Leave{state.bet ? ' (refund)' : ''}</button>
            : <button onClick={join} disabled={short} style={short ? btnDisabled : btnPrimary}>
                Join{state.bet ? ` for ₵${state.bet}` : ''}
              </button>}
          {short && <span style={muted}>you have ₵{myCoins}</span>}
          {isHost && state.players.length < 2 && <span style={muted}>or wait for someone to join</span>}
          {!isHost && seated && <span style={muted}>waiting for {state.host} to start</span>}
        </div>
      </div>
    );
  }

  function renderCountdown() {
    const left = Math.max(0, state.startAt - serverNow());
    const n = Math.ceil(left / 1000);
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{ fontSize: 56, fontWeight: 'bold', color: '#fff', fontFamily: MONO, lineHeight: 1 }}>{n || 'Go'}</div>
        <div style={{ ...muted, marginTop: 10 }}>
          {state.players.length} racing · {state.difficulty}{state.pot ? ` · pot ₵${state.pot}` : ''}
        </div>
      </div>
    );
  }

  function renderProgress() {
    const others = state.players.filter(p => p.nick !== myNick);
    if (!others.length) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: '#aaa', fontFamily: MONO }}>
        {others.map(p => (
          <div key={p.nick}>
            <span style={{ color: '#ddd' }}>{p.nick}</span>
            {' · '}
            {p.forfeited ? 'left' : `${p.index}/${state.total}`}
            {' · '}
            {p.done ? <span style={{ color: '#7fe08a' }}>{fmtClock(p.time)}</span>
              : p.forfeited ? '—'
              : fmtClock(serverNow() - state.startAt + p.penalties * state.penaltyMs)}
            {p.penalties > 0 && <span style={{ color: '#ff6b6b' }}> +{p.penalties}</span>}
          </div>
        ))}
      </div>
    );
  }

  function renderRace() {
    const elapsed = me ? serverNow() - state.startAt + me.penalties * state.penaltyMs : 0;

    let main;
    if (!me) {
      main = <div style={{ ...muted, padding: '8px 0' }}>A race is on — you're watching. The next lobby opens when it ends.</div>;
    } else if (me.forfeited) {
      main = <div style={{ ...muted, padding: '8px 0' }}>You left the race.</div>;
    } else if (me.done) {
      main = (
        <div style={{ padding: '8px 0' }}>
          <div style={{ color: '#7fe08a', fontWeight: 'bold' }}>Done in {fmtClock(me.time)}</div>
          <div style={muted}>{me.penalties ? `${me.penalties} miss${me.penalties === 1 ? '' : 'es'} (+${me.penalties * state.penaltyMs / 1000}s)` : 'no misses'} · waiting for the others</div>
        </div>
      );
    } else {
      main = (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888' }}>
            <span>problem {problem ? problem.index + 1 : '…'} of {state.total}</span>
            <span style={{ fontFamily: MONO, color: '#ddd' }}>
              {fmtClock(elapsed)}
              {me.penalties > 0 && <span style={{ color: '#ff6b6b' }}> +{me.penalties * state.penaltyMs / 1000}s</span>}
            </span>
          </div>
          <div style={{ fontSize: 30, fontFamily: MONO, color: '#fff', textAlign: 'center', padding: '10px 0', letterSpacing: 1 }}>
            {problem ? problem.text : '…'}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: MONO, fontSize: 18, color: '#aaa' }}>x =</span>
            <input
              ref={inputRef}
              value={value}
              onChange={e => setValue(e.target.value)}
              inputMode='numeric'
              autoComplete='off'
              style={{ ...input, width: 110, fontSize: 20, fontFamily: MONO, textAlign: 'center' }}
            />
            <button type='submit' style={btnPrimary}>Enter</button>
          </div>
          <div style={{ minHeight: 18, textAlign: 'center', fontSize: 13 }}>
            {verdict && (verdict.correct
              ? <span style={{ color: '#7fe08a' }}>✓ correct</span>
              : <span style={{ color: '#ff6b6b' }}>✗ +{state.penaltyMs / 1000}s — try again</span>)}
          </div>
        </form>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {main}
        {renderProgress()}
        {me && !me.done && !me.forfeited && (
          <div><button onClick={quit} style={btnDanger} title='Forfeit — your buy-in stays in the pot'>Give up</button></div>
        )}
      </div>
    );
  }

  function renderResult() {
    const r = state.result;
    if (!r) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 10px', borderRadius: 4, background: '#1f1f1f', border: '1px solid #333' }}>
        <div style={{ fontWeight: 'bold', color: '#eee' }}>
          {r.voided ? 'Game voided — everyone left, buy-ins refunded'
            : r.standings.length === 1 ? `Solo run: ${fmtClock(r.standings[0].time)}`
            : r.winners.length > 1 ? `${r.winners.join(' & ')} tied${r.pot ? ` and split ₵${r.pot}` : ''}`
            : `${r.winners[0]} wins${r.pot ? ` ₵${r.pot}` : ''}`}
        </div>
        <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
          <tbody>
            {r.standings.map((p, i) => {
              const won = r.winners.includes(p.nick);
              return (
                <tr key={p.nick} style={{ color: won ? '#7fe08a' : p.forfeited ? '#777' : '#ccc' }}>
                  <td style={{ padding: '2px 10px 2px 0', color: '#777' }}>{p.forfeited ? '—' : i + 1}</td>
                  <td style={{ padding: '2px 14px 2px 0' }}>{p.nick}{p.nick === myNick ? ' (you)' : ''}</td>
                  <td style={{ padding: '2px 14px 2px 0', fontFamily: MONO }}>{p.forfeited ? 'left' : fmtClock(p.time)}</td>
                  <td style={{ padding: '2px 0', ...muted }}>
                    {p.forfeited ? '' : p.penalties ? `${p.penalties} miss${p.penalties === 1 ? '' : 'es'} · +${p.penalties * state.penaltyMs / 1000}s` : 'clean'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  let body;
  if (!state) body = <div style={muted}>Loading…</div>;
  else if (state.state === 'lobby') body = renderLobby();
  else if (state.state === 'countdown') body = renderCountdown();
  else if (state.state === 'playing') body = renderRace();
  else body = <>{state.state === 'over' && renderResult()}{renderForm()}</>;

  return (
    <DraggableWindow title='Solve for X' onClose={onClose} width='min(460px, 95vw)' initialLeft={120} initialTop={80}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, fontSize: 13, color: '#ccc' }}>
        {body}
        <div style={{ ...muted, borderTop: '1px solid #2a2a2a', paddingTop: 6 }}>
          Ten equations, one at a time. Wrong costs 10s and you stay on it until you get it. Lowest time wins the pot.
        </div>
      </div>
    </DraggableWindow>
  );
}

export default SolveXPanel;
