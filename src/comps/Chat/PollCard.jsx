import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import DraggableWindow from '../DraggableWindow.jsx';
import { usePoll, vote } from './polls';

// A /qpoll card (feedback #106): the question, one button per answer, and once
// you've voted (or it's closed) a bar and a count on each. Who voted for what
// is in its own window, opened from the "N votes" at the bottom, so the card
// stays small. The poll comes from the polls store, not from the chat line,
// which only carries its id. Styles are scoped under .message.poll
// (chat-messages.css), since `.message div { display: inline }` would flatten
// an unscoped card.

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

// Who voted for what: each answer with its count and its voters, in the order
// they voted. Live, like the card: it reads the same poll.
export function PollVoters({ poll, onClose }) {
  return (
    <DraggableWindow title={'Votes · ' + poll.question} onClose={onClose} width='min(340px, 92vw)' centered>
      <div className='pollVotersPanel'>
        {poll.answers.map((answer, i) => (
          <div key={i} className={'pollVotersAnswer' + (poll.mine === i ? ' mine' : '')}>
            <div className='pollVotersHead'>
              <span className='pollVotersName'>{answer}</span>
              <span className='pollVotersCount'>{poll.counts[i]}</span>
            </div>
            <div className='pollVotersList'>
              {poll.voters[i].length ? poll.voters[i].join(', ') : <span className='none'>nobody</span>}
            </div>
          </div>
        ))}
      </div>
    </DraggableWindow>
  );
}

PollVoters.propTypes = {
  poll: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default function PollCard({ id, maker, onGrow }) {
  const poll = usePoll(id);
  const open = poll && !poll.closed;
  const now = useNow(!!(open && poll.closesAt));
  const [showVoters, setShowVoters] = useState(false);
  const cardRef = useRef(null);
  const loaded = !!poll;

  // The card mounts as a one-line placeholder and grows when its poll arrives,
  // after the log has already scrolled for the placeholder. Say so, the way an
  // image does when it loads, so a reader at the bottom stays at the bottom.
  useLayoutEffect(() => {
    if (loaded && cardRef.current) onGrow?.({ height: cardRef.current.offsetHeight });
  }, [loaded]);

  if (!poll) {
    return <div className='pollCard pollLoading'>Poll by <b>{maker || 'someone'}</b>…</div>;
  }

  const shown = !!poll.counts;
  const total = poll.total;
  const status = poll.closed
    ? 'closed'
    : poll.closesAt ? `closes in ${left(poll.closesAt - now)}` : 'open';
  const votes = `${total} vote${total === 1 ? '' : 's'}`;
  const hint = open && poll.mine == null ? (poll.canVote ? ' · click to vote' : ' · log in to vote') : '';

  return (
    <div className={'pollCard' + (poll.closed ? ' closed' : '')} ref={cardRef}>
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
          <button
            key={i}
            type='button'
            className={'pollAns' + (mine ? ' mine' : '') + (won ? ' won' : '')}
            disabled={!poll.canVote}
            onClick={() => { if (poll.canVote && !mine) vote(poll.id, i); }}
          >
            {shown ? <span className='bar' style={{ width: pct + '%' }} /> : null}
            <span className='pollAnsText'>{mine ? '✓ ' : ''}{answer}</span>
            {shown ? <span className='pct'>{count} · {pct}%</span> : null}
          </button>
        );
      })}
      <div className='pollFoot'>
        {shown && total
          ? <button type='button' className='pollVotesBtn' title='See who voted for what' onClick={() => setShowVoters(true)}>{votes}</button>
          : votes}
        {hint}
      </div>
      {showVoters && shown ? <PollVoters poll={poll} onClose={() => setShowVoters(false)} /> : null}
    </div>
  );
}

PollCard.propTypes = {
  id: PropTypes.number.isRequired,
  maker: PropTypes.string,
  onGrow: PropTypes.func,
};
