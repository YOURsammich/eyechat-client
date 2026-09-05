import { getActivity, openEvent } from '../activities';

// The line dropped into the chat log when someone starts a game: "sammich
// started a game of UNO" with a button that opens it. This is the part that
// actually recruits people — a launcher in the header is a door nobody knows to
// open, while a game starting in front of you is an invitation.
//
// Never logged. The server sends it as its own `activityInvite` room event
// rather than through showMessage, so it exists only for the sessions that were
// present — the same treatment join/leave notices get. That is deliberate: a
// persisted invite would still be sitting in the scroll-back weeks later,
// offering to join a game that ended in minutes.
//
// Like WhatsNew, it opens through a window event rather than a prop callback:
// Messages caches rendered rows as React elements, so nothing handed to this row
// reaches it again after the first render. That also settles staleness — the
// button always just opens the activity, and the panel is the one thing that
// knows whether the session is still joinable.

function ActivityInvite({ invite }) {
  const activity = getActivity(invite?.id);
  // An invite for an activity this client does not have (an older tab after a
  // deploy that added a game) renders as nothing rather than as a broken row.
  if (!activity) return null;

  const host = invite.host;
  const detail = invite.detail;

  return (
    <button
      className='activityInvite'
      onClick={() => window.dispatchEvent(new CustomEvent(openEvent(activity.id)))}
    >
      <span className='material-symbols-outlined activityInviteIcon'>{activity.icon}</span>
      <span className='activityInviteText'>
        {host ? <b>{host}</b> : null}
        {host ? ' started ' : 'Someone started '}
        <span className='activityInviteName'>{activity.label}</span>
        {detail ? <span className='activityInviteDetail'>{detail}</span> : null}
      </span>
      <span className='activityInviteAction'>join</span>
    </button>
  );
}

export default ActivityInvite;
