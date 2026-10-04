// ─────────────────────────────────────────────────────────────────────────────
// BLACKJACK — client floating panel.
//
// Tables against the house or against each other (feedback #50). The server
// (src/games/blackjack.js) owns the tables, the deck, the turns and the coins;
// this panel is a view over its `bj:state` event with two screens:
//
//   not seated  →  the open tables (Join, or click one to watch) and the
//                  "new table" form
//   seated      →  your table: the dealer (house mode), every seat's cards,
//                  whose turn it is with its clock, Hit / Stand on yours, the
//                  host's Deal, Leave, and the last hand's result
//
// Every card on the table is face up and public except the dealer's hole card,
// which the server sends as null until the hand is settled.
//
// Self-contained: to remove, delete this directory and the two registry lines
// (comps/activities.js, comps/activityPanels.js).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import DraggableWindow from '../DraggableWindow';

const MODES = [
  { id: 'house',   label: 'vs the house',  hint: 'Everyone plays the dealer. Win 1:1, blackjack 3:2.' },
  { id: 'players', label: 'vs each other', hint: 'Everyone antes into a pot; the best hand takes it.' },
];

const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RED = { H: true, D: true };

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

const OUTCOME = {
  win: { text: 'wins', color: '#7fe08a' },
  blackjack: { text: 'blackjack!', color: '#7fe08a' },
  push: { text: 'push', color: '#ccc' },
  lose: { text: 'loses', color: '#ff6b6b' },
  bust: { text: 'bust', color: '#ff6b6b' },
};

function Card({ card }) {
  const box = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 34, height: 48, borderRadius: 4, marginRight: 4, fontSize: 15, fontWeight: 'bold',
    border: '1px solid #555', userSelect: 'none',
  };
  if (!card) {
    return <span style={{ ...box, background: 'repeating-linear-gradient(45deg,#1a3a5c,#1a3a5c 4px,#244a70 4px,#244a70 8px)' }} aria-label='face-down card' />;
  }
  return (
    <span style={{ ...box, background: '#f4f4f4', color: RED[card.s] ? '#c0262d' : '#111' }} aria-label={`${card.r} of ${card.s}`}>
      {card.r}{SUIT[card.s]}
    </span>
  );
}

function BlackjackPanel({ socket, user, onClose }) {
  const myNick = user?.nick || (typeof window !== 'undefined' && window.store ? window.store.get('nick') : undefined);
  const myCoins = user?.coins ?? 0;

  const [state, setState] = useState(null);       // last bj:state
  const [watching, setWatching] = useState(null); // table name picked from the list while not seated
  const [name, setName] = useState('');
  const [mode, setMode] = useState('house');
  const [bet, setBet] = useState('0');
  const [, setTick] = useState(0);

  const offsetRef = useRef(0);
  const serverNow = () => Date.now() + offsetRef.current;

  // ── socket wiring ────────────────────────────────────────────────────────────
  useEffect(() => {
    const requestSync = () => socket.emit('bj:sync', {});
    const offState = socket.on('bj:state', (s) => {
      if (!s) return;
      if (typeof s.serverNow === 'number') offsetRef.current = s.serverNow - Date.now();
      setState(s);
    });
    const offReconnect = socket.onReconnect ? socket.onReconnect(requestSync) : null;
    requestSync();
    return () => {
      offState();
      if (offReconnect) offReconnect();
      socket.emit('bj:close', {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const tables = state?.tables ?? [];
  const mine = tables.find(t => t.seats.includes(myNick)) ?? null;
  const shown = mine ?? tables.find(t => t.name === watching) ?? null;

  // The turn clock redraws once a second while a hand is on.
  const ticking = !!shown?.hand;
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  // ── actions ──────────────────────────────────────────────────────────────────
  const betNum = Math.max(0, Math.floor(Number(bet) || 0));
  const create = () => socket.emit('bj:create', { name: name.trim(), mode, bet: betNum });
  const join = (t) => socket.emit('bj:join', { name: t });
  const leave = () => socket.emit('bj:leave', {});
  const deal = () => socket.emit('bj:deal', {});
  const hit = () => socket.emit('bj:hit', {});
  const stand = () => socket.emit('bj:stand', {});

  // ── screens ──────────────────────────────────────────────────────────────────

  function renderList() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontWeight: 'bold', color: '#eee' }}>Tables</div>
        {!tables.length && <div style={muted}>No tables open. Start one below.</div>}
        {tables.map(t => {
          const full = t.seats.length >= state.maxSeats;
          const short = t.bet > myCoins;
          const canJoin = t.state === 'waiting' && !full && !short;
          return (
            <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
              <button onClick={() => setWatching(t.name)} style={{ ...btn, padding: '3px 8px' }} title='Watch this table'>
                {t.name}
              </button>
              <span style={muted}>
                {t.mode === 'house' ? 'vs the house' : 'vs each other'} · {t.bet ? `₵${t.bet} a hand` : 'free'} · {t.seats.length}/{state.maxSeats}
                {t.state === 'playing' ? ' · hand on' : ''}
              </span>
              <button onClick={() => join(t.name)} disabled={!canJoin} style={canJoin ? btnPrimary : btnDisabled}>Sit down</button>
            </div>
          );
        })}
      </div>
    );
  }

  function renderForm() {
    const short = betNum > myCoins;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontWeight: 'bold', color: '#eee' }}>New table</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              style={mode === m.id ? { ...btn, background: '#333', borderColor: '#777', color: '#fff' } : btn}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div style={muted}>{MODES.find(m => m.id === mode)?.hint}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 13 }}>
          <input placeholder={`${myNick ?? 'my'}'s table`} value={name} maxLength={24} onChange={e => setName(e.target.value)} style={{ ...input, width: 150 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Bet ₵
            <input type='number' min='0' step='1' value={bet} onChange={e => setBet(e.target.value)} style={{ ...input, width: 80 }} />
          </label>
          <span style={muted}>you have ₵{myCoins}</span>
        </div>
        <div>
          <button onClick={create} disabled={short} style={short ? btnDisabled : btnPrimary}>Open table</button>
        </div>
      </div>
    );
  }

  function renderResult(t) {
    const r = t.result;
    if (!r) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 10px', borderRadius: 4, background: '#1f1f1f', border: '1px solid #333' }}>
        <div style={{ fontWeight: 'bold', color: '#eee' }}>
          Last hand{r.mode === 'house' ? ` · dealer ${r.dealerTotal > 21 ? 'bust' : r.dealerTotal}` : ''}
          {r.refunded ? ' · everyone bust, antes back' : r.mode === 'players' && r.winners.length ? ` · ${r.winners.join(' & ')} ${r.winners.length > 1 ? 'split' : 'take'} ₵${r.pot}` : ''}
        </div>
        {r.dealer && <div>{r.dealer.map((cd, i) => <Card key={i} card={cd} />)}</div>}
        {r.players.map(p => (
          <div key={p.nick} style={{ fontSize: 13 }}>
            <span style={{ color: p.nick === myNick ? '#8cf' : '#ddd' }}>{p.nick}</span>
            {' '}{p.total}{' · '}
            <span style={{ color: OUTCOME[p.outcome]?.color }}>{OUTCOME[p.outcome]?.text}</span>
            {r.mode === 'house' && t.bet > 0 && p.payout > 0 && <span style={muted}> · ₵{p.payout} back</span>}
          </div>
        ))}
      </div>
    );
  }

  function renderTable(t) {
    const h = t.hand;
    const seated = t.seats.includes(myNick);
    const isHost = t.host === myNick;
    const myTurn = h && h.turn === myNick;
    const left = h?.turnEndsAt ? Math.max(0, Math.ceil((h.turnEndsAt - serverNow()) / 1000)) : null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', color: '#eee' }}>{t.name}</span>
          <span style={muted}>
            {t.mode === 'house' ? 'vs the house' : 'vs each other'} · {t.bet ? `₵${t.bet} a hand` : 'free'}
            {h && h.pot ? ` · pot ₵${h.pot}` : ''} · host {t.host}
          </span>
          {!seated && <button onClick={() => setWatching(null)} style={{ ...btn, padding: '2px 8px' }}>Back</button>}
        </div>

        {h ? (
          <>
            {h.dealer && (
              <div>
                <div style={muted}>Dealer · showing {h.dealerUp}</div>
                {h.dealer.map((cd, i) => <Card key={i} card={cd} />)}
              </div>
            )}
            {h.players.map(p => (
              <div key={p.nick} style={{ padding: '4px 6px', borderRadius: 4, border: `1px solid ${h.turn === p.nick ? '#2a5a8c' : 'transparent'}` }}>
                <div style={{ fontSize: 12, color: '#aaa' }}>
                  <span style={{ color: p.nick === myNick ? '#8cf' : '#ddd' }}>{p.nick}</span>
                  {' · '}{p.total > 21 ? <span style={{ color: '#ff6b6b' }}>bust ({p.total})</span> : p.total}
                  {p.left && ' · left'}
                  {h.turn === p.nick && left !== null && <span> · {left}s</span>}
                  {p.done && p.total <= 21 && !p.left && ' · stands'}
                </div>
                <div>{p.cards.map((cd, i) => <Card key={i} card={cd} />)}</div>
              </div>
            ))}
            {seated && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={hit} disabled={!myTurn} style={myTurn ? btnPrimary : btnDisabled}>Hit</button>
                <button onClick={stand} disabled={!myTurn} style={myTurn ? btn : btnDisabled}>Stand</button>
                {!myTurn && h.turn && <span style={muted}>{h.turn}'s turn</span>}
              </div>
            )}
          </>
        ) : (
          <>
            {renderResult(t)}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13 }}>
              {t.seats.map(n => (
                <div key={n}>
                  <span style={{ color: n === myNick ? '#8cf' : '#ddd' }}>{n}</span>
                  {n === t.host && <span style={{ ...muted, marginLeft: 6 }}>host</span>}
                </div>
              ))}
            </div>
            {seated && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {isHost && <button onClick={deal} style={btnPrimary}>Deal</button>}
                {!isHost && <span style={muted}>waiting for {t.host} to deal</span>}
              </div>
            )}
          </>
        )}

        {seated && (
          <div>
            <button onClick={leave} style={btnDanger} title={h ? 'Your hand stands and your bet stays in play' : 'Leave the table'}>
              Leave{h ? ' (hand stands)' : ''}
            </button>
          </div>
        )}
      </div>
    );
  }

  let body;
  if (!state) body = <div style={muted}>Loading…</div>;
  else if (shown) body = renderTable(shown);
  else body = <>{renderList()}<div style={{ borderTop: '1px solid #2a2a2a' }} />{renderForm()}</>;

  return (
    <DraggableWindow title='Blackjack' onClose={onClose} width='min(480px, 95vw)' initialLeft={140} initialTop={90}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, fontSize: 13, color: '#ccc' }}>
        {body}
        <div style={{ ...muted, borderTop: '1px solid #2a2a2a', paddingTop: 6 }}>
          Hit or stand, 30 seconds a turn. Dealer stands on 17. No doubling or splitting.
        </div>
      </div>
    </DraggableWindow>
  );
}

export default BlackjackPanel;
