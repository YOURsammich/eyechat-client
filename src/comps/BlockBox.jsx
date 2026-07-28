import PropTypes from 'prop-types';
import DraggableWindow from './DraggableWindow';

// The four durations the server accepts (see BLOCK_DURATIONS in commands.js),
// in the order they're offered — shortest first, so the least drastic choice is
// the easiest one to reach for.
const DURATIONS = [
  { token: '10m', label: '10 minutes' },
  { token: '1h', label: '1 hour' },
  { token: '1d', label: '1 day' },
  { token: 'forever', label: 'Until I unblock' },
];

const btnStyle = {
  background: '#252525', color: '#eee', border: '1px solid #3a3a3a',
  borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer',
};

// Offers to block someone, with a duration. Two ways in, one box:
//
//   - a moderator ran /separate on you and whoever you're arguing with, which
//     sends both of you a `separateOffer` (`offered` is true here). Nothing has
//     been done to either of you — this is the suggestion, and taking it is
//     yours to decide.
//   - you asked for it yourself, from /block or the userlist's block button.
//
// Blocking is one-way: it stops you seeing them, and leaves what they see alone.
// The box says so, because "block" reads to most people like it cuts both ways.
export default function BlockBox({ socket, nick, offered, onClose }) {
  function block(duration) {
    socket.emit('command', { commandName: 'block', params: { nick, duration } });
    onClose();
  }

  return (
    <DraggableWindow
      title={offered ? 'Not worth your time' : `Block ${nick}`}
      onClose={onClose}
      width={380}
      initialTop={120}
    >
      <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
        {offered ? (
          <>
            <div style={{ marginBottom: 8 }}>
              A moderator noticed things heating up between you and <b>{nick}</b>.
            </div>
            <div>
              If they&apos;re bothering you, the best thing you can do is ignore them.
              Block them and their messages simply won&apos;t reach you — they aren&apos;t
              told, aren&apos;t silenced for anyone else, and you can lift it whenever
              you like.
            </div>
          </>
        ) : (
          <div>
            You won&apos;t see anything <b>{nick}</b> says, here or in the history you
            load. They can still see you, and they aren&apos;t told.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {DURATIONS.map(d => (
          <button key={d.token} style={btnStyle} onClick={() => block(d.token)}>
            {d.label}
          </button>
        ))}
      </div>

      <button
        onClick={onClose}
        style={{ ...btnStyle, background: 'none', border: 'none', color: '#888', padding: 0 }}
      >
        {offered ? 'No thanks' : 'Cancel'}
      </button>
    </DraggableWindow>
  );
}

BlockBox.propTypes = {
  socket:  PropTypes.object.isRequired,
  nick:    PropTypes.string.isRequired,
  // True when a moderator's /separate prompted this, rather than the user
  // reaching for it themselves.
  offered: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
};
