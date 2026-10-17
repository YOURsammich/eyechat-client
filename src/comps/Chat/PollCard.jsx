import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { usePoll, vote } from './polls';

// A /qpoll card (feedback #106): the question, one button per answer, and once
// you've voted (or it's closed) a bar, a count and the voters under each answer.
// The poll comes from the polls store, not from the chat line, which only
// carries its id. Styles are scoped under .message.poll (chat-messages.css),
// since `.message div { display: inline }` would flatten an unscoped card.

// Voters listed under an answer before the rest fold into "+N more".
export const VOTERS_SHOWN = 8;

function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

// "4m 12s", "1h 03m", "9s".
function left(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
  if (s >= 60) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  return `${s}s`;
}

function Voters({ list }) {
  const [all, setAll] = useState(false);
  if (!list.length) return null;
  const shown = all ? list : list.slice(0, VOTERS_SHOWN);
  const more = list.length - shown.length;
  return (
    <div className='pollVoters'>
      {shown.join(', ')}
      {more > 0
        ? <>{', '}<button type='button' className='pollMore' onClick={() => setAll(true)}>+{more} more</button></>
        : null}
    </div>
  );
}

Voters.propTypes = { list: PropTypes.arrayOf(PropTypes.string).isRequired };

export default function PollCard({ id, maker }) {
  const poll = usePoll(id);
  const open = poll && !poll.closed;
  const now = useNow(!!(open && poll.closesAt));

  if (!poll) {
    return <div className='pollCard pollLoading'>Poll by <b>{maker || 'someone'}</b>…</div>;
  }

  const shown = !!poll.counts;
  const total = poll.total;
  const status = poll.closed
    ? 'closed'
    : poll.closesAt ? `closes in ${left(poll.closesAt - now)}` : 'open';

  let foot = `${total} vote${total === 1 ? '' : 's'}`;
  if (open) {
    if (poll.mine != null) foot += ` · you voted ${poll.answers[poll.mine]}`;
    else if (poll.canVote) foot += ' · click to vote';
    else foot += ' · log in to vote';
  }

  return (
    <div className={'pollCard' + (poll.closed ? ' closed' : '')}>
      <div className='pollHead'>
        <span className='material-symbols-outlined'>ballot</span>
        Poll by <b>{poll.nick}</b> · {status}
        <span className='pollId' title={'Poll id, for /closepoll ' + poll.id}>#{poll.id}</span>
      </div>
      <div className='pollQ'>{poll.question}</div>
      {poll.answers.map((answer, i) => {
        const count = shown ? poll.counts[i] : 0;
        const pct = shown && total ? Math.round((count / total) * 100) : 0;
        const mine = poll.mine === i;
        const won = poll.closed && shown && total > 0 && count === Math.max(...poll.counts);
        return (
          <div key={i} className='pollRow'>
            <button
              type='button'
              className={'pollAns' + (mine ? ' mine' : '') + (won ? ' won' : '')}
              disabled={!poll.canVote}
              onClick={() => { if (poll.canVote && !mine) vote(poll.id, i); }}
            >
              {shown ? <span className='bar' style={{ width: pct + '%' }} /> : null}
              <span className='pollAnsText'>{mine ? '✓ ' : ''}{answer}</span>
              {shown ? <span className='pct'>{count} · {pct}%</span> : null}
            </button>
            {shown ? <Voters list={poll.voters[i]} /> : null}
          </div>
        );
      })}
      <div className='pollFoot'>{foot}</div>
    </div>
  );
}

PollCard.propTypes = {
  id: PropTypes.number.isRequired,
  maker: PropTypes.string,
};
