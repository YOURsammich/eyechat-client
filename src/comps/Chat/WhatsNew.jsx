// The What's New notice: a single clickable line dropped into the chat log once
// per session, right after the backlog loads (see ChatWindow's whatsNew ref).
// Clicking it opens WhatsNewPanel, the floating window the commands, roles and
// ban list panels also use.
//
// The panel opens through a window event rather than a prop callback because
// Messages caches rendered rows as React elements: nothing the log holds about
// this row reaches it again after the first render, so it can't be handed a
// fresh handler. Same idiom as 'commands:open' / 'roles:open' — the listener is
// in ChatWindow, which owns the panel's open state.
//
// The summary is here rather than only in the panel so the line says whether
// it's worth opening.

function summary(feedback, updates) {
  const parts = [];
  if (feedback.length) parts.push(feedback.length + ' request' + (feedback.length === 1 ? '' : 's') + ' shipped');
  if (updates.length) parts.push(updates.length + ' update' + (updates.length === 1 ? '' : 's'));
  // The server only sends the last 7 days, so the counts are a weekly figure;
  // say so, or "3 requests shipped" reads like an all-time top three.
  return parts.join(' · ') + ' this week';
}

function WhatsNew({ data }) {
  const feedback = data?.feedback || [];
  const updates = data?.updates || [];

  return (
    <button
      className='whatsNew'
      onClick={() => window.dispatchEvent(new CustomEvent('whatsnew:open'))}
    >
      <span className='wnTitle'>What&apos;s new</span>
      <span className='wnSummary'>{summary(feedback, updates)}</span>
      <span className='wnAction'>view</span>
    </button>
  );
}

export default WhatsNew;
