import { useState } from 'react';
import DraggableWindow from './DraggableWindow';

// The What's New popup, opened from the notice dropped into the chat log (see
// Chat/WhatsNew.jsx) via the 'whatsnew:open' event. Same draggable shell as the
// commands, roles and ban list panels.
//
// Not a ManagerPanel: that one is a table of rows with a delete column, and this
// is a form over two sections of prose with nothing to administer. It shares the
// shell, not the table.
//
// `data` is the /whatsnew payload ChatWindow already fetched on join, passed in
// rather than refetched — the notice only exists because the fetch succeeded.

function timeAgo(ms) {
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

// Posts to the same endpoint the board's own form does, so submissions land in
// one queue however they were sent. Text only — attaching screenshots stays on
// /feedback, which is linked at the foot of the panel.
//
// Sits below the two lists rather than above them: the notice in the chat log
// advertises what shipped, so opening the panel onto a form buried the thing
// the reader clicked for. Reading first, then the invitation to add to it.
//
// `canSubmit` is the server's read of whether this viewer would get past the
// gate on /feedback/submit. It only decides what to draw; a refusal still comes
// back from the POST and is shown like any other error.
function SubmitForm({ canSubmit }) {
  const [type, setType] = useState('idea');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null); // { text, ok }

  if (!canSubmit) {
    return (
      <div className='wnPanel'>
        <div className='wnPanelHead'>Leave feedback</div>
        <div className='wnNote'>
          Feedback is for logged-in members. Log in from the chat and reopen this panel.
        </div>
      </div>
    );
  }

  async function submit() {
    const text = body.trim();
    if (!text) return setStatus({ text: 'Describe your idea or bug.', ok: false });

    setSending(true);
    setStatus(null);
    try {
      const res = await fetch('/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, body: text }),
      });
      const data = await res.json();
      if (data.error) setStatus({ text: data.error, ok: false });
      else {
        setBody('');
        setStatus({ text: 'Thanks — your feedback was submitted.', ok: true });
      }
    } catch {
      setStatus({ text: 'Could not submit.', ok: false });
    }
    setSending(false);
  }

  return (
    <div className='wnPanel'>
      <div className='wnPanelHead'>Leave feedback</div>
      <div className='wnForm'>
        <select className='wnSelect' value={type} onChange={e => setType(e.target.value)}>
          <option value='idea'>Idea</option>
          <option value='bug'>Bug Report</option>
        </select>
        <textarea
          className='wnTextarea'
          placeholder='Describe your idea or bug...'
          maxLength={1000}
          value={body}
          onChange={e => setBody(e.target.value)}
        />
        <button className='wnSubmit' onClick={submit} disabled={sending}>
          {sending ? 'Sending…' : 'Submit'}
        </button>
        {status ? (
          <div className={'wnStatus' + (status.ok ? ' ok' : ' err')}>{status.text}</div>
        ) : null}
      </div>
    </div>
  );
}

// Exported because ChatWindow has to know the width to park the panel against
// the right edge of the chat area before it exists to be measured.
export const WHATSNEW_WIDTH = 380;

export default function WhatsNewPanel({ data, onClose, initialLeft, initialTop }) {
  const feedback = data?.feedback || [];
  const updates = data?.updates || [];

  return (
    <DraggableWindow
      title="What's New"
      onClose={onClose}
      width={WHATSNEW_WIDTH}
      initialLeft={initialLeft}
      initialTop={initialTop}
    >
      {/* The news first. The notice in the log promised "N requests shipped", and
          opening it onto a submit form buries the thing that was clicked for. */}
      {feedback.length ? (
        <div className='wnPanel'>
          <div className='wnPanelHead wnHeadAsked'>You asked for it</div>
          {/* Says the one thing the old panel never did: these are live now. */}
          <div className='wnNote wnLede'>Requests from the room that are now live.</div>
          {feedback.map(item => (
            <div className='wnItem wnItem-asked' key={'wn-f-' + item.id}>
              <div className='wnItemHead'>
                <span className='wnDone' aria-hidden='true'>✓</span>
                <span className={'wnBadge wnBadge-' + item.type}>{item.type}</span>
                <span className='wnShipped'>shipped {timeAgo(item.time)}</span>
              </div>
              {/* Clamped: this is the request as it was written, and one long one
                  would otherwise own the whole panel for everyone who joins. The
                  full text is on /feedback, linked at the foot. */}
              <div className='wnText wnClamp'>{item.body}</div>
              <div className='wnMeta'>asked by {item.nick}</div>
            </div>
          ))}
        </div>
      ) : null}

      {updates.length ? (
        <div className='wnPanel'>
          <div className='wnPanelHead wnHeadAlso'>Also new</div>
          <div className='wnNote wnLede'>Changes that didn&apos;t come from the board.</div>
          {updates.map(item => (
            <div className='wnItem wnItem-also' key={'wn-u-' + item.id}>
              <div className='wnItemHead'>
                <span className='wnItemTitle'>{item.title}</span>
                <span className='wnShipped wnShipped-also'>{timeAgo(item.time)}</span>
              </div>
              <div className='wnText wnClamp'>{item.body}</div>
            </div>
          ))}
        </div>
      ) : null}

      <SubmitForm canSubmit={!!data?.canSubmit} />

      <a className='wnLink' href='/feedback' target='_blank' rel='noreferrer'>
        Open the feedback board →
      </a>
    </DraggableWindow>
  );
}
