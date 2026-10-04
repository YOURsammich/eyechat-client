import { useEffect, useState } from 'react';

// The Cope Court status bar (feedback #58), shown under the header in the court
// room only: the case, who speaks for each side, whose turn it is and how long
// is left. The server sends the trial's public state on join (channelInfo.court)
// and on every change (court:status); null means no trial in session. Votes
// arrive only as a count — how anyone voted stays on the server until the
// verdict.

const TURNS = 3;

function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function party(state, side) {
  const lawyer = state.lawyers?.[side];
  return lawyer ? `${state[side]} (lawyer: ${lawyer})` : state[side];
}

export function stageLine(state) {
  if (state.stage === 'lawyers') return 'Picking lawyers: /lawyer <nick>, then /accept';
  if (state.stage === 'voting') return `🗳️ The jury is voting (${state.votes} in): /guilty or /innocent`;
  if (state.podium) {
    const turn = TURNS - (state.turnsLeft?.[state.podium] ?? 0) + 1;
    return `🎤 ${party(state, state.podium)} has the podium, turn ${turn} of ${TURNS}`;
  }
  return 'Arguments';
}

export default function CourtBar({ socket }) {
  // remaining is counted down from when the state arrived, so the client's
  // clock never has to agree with the server's.
  const [court, setCourt] = useState({ state: null, at: 0 });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const offInfo = socket.on('channelInfo', (info) => {
      if ('court' in (info ?? {})) setCourt({ state: info.court ?? null, at: Date.now() });
    });
    const offStatus = socket.on('court:status', (state) => setCourt({ state: state ?? null, at: Date.now() }));
    return () => { offInfo(); offStatus(); };
  }, [socket]);

  const state = court.state;
  useEffect(() => {
    if (!state) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state]);

  if (!state) {
    return <div className='courtBar idle'>⚖️ No trial in session. Open a case with /sue &lt;nick&gt; &lt;allegation&gt;; /court shows the last verdicts.</div>;
  }

  // `now` can predate the state's arrival until the first tick.
  const left = state.remaining - Math.max(0, now - court.at);
  return (
    <div className={'courtBar ' + state.stage}>
      <div className='courtCase'>
        ⚖️ <b>{party(state, 'accuser')}</b> v. <b>{party(state, 'accused')}</b>
        <span className='courtAllegation'> “{state.allegation}”</span>
      </div>
      <div className='courtStage'>
        <span>{stageLine(state)}</span>
        {state.exhibits ? <span className='courtExhibits'> · {state.exhibits} exhibit{state.exhibits === 1 ? '' : 's'}</span> : null}
        <span className='courtClock' title='Time left'>{clock(left)}</span>
      </div>
    </div>
  );
}
