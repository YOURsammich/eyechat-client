// One game as a card: a band of art across the top, the name and blurb, the
// live facts as chips, and the word on its button. The whole card is the
// button. A game with something going on gets a green ring and a pulsing dot,
// which is the thing that recruits a second player.
//
// Used by the chat's Play picker (GamePicker) and the games hub (games.jsx);
// its styles are public/gamecards.css, which both pages load.
//
// `wide` is a strip, for tools rather than games. `open` marks a game whose
// panel is already up (the hub can have several). `href` makes the card a link
// instead of a button, for a page of its own like the whiteboard gallery.
// `role` is passed through, so the picker can make cards menu items.

function GameCard({ activity, state, onLaunch, wide = false, open = false, href, role }) {
  const live = !!activity.live?.(state);
  const chips = activity.chips?.(state) ?? [];
  const action = open ? 'Open' : (activity.action?.(state) ?? 'Open');
  const { from = '#333', to = '#555', glyph = activity.icon } = activity.art ?? {};

  const className = 'gameCard'
    + (wide ? ' gameCardWide' : '')
    + (live ? ' gameCardLive' : '')
    + (open ? ' gameCardOpen' : '');

  const face = (
    <>
      <span className='gameCardArt' style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }} aria-hidden='true'>
        <span className='material-symbols-outlined gameCardGlyph'>{glyph}</span>
        {live ? <span className='gameCardLiveDot' /> : null}
      </span>
      <span className='gameCardBody'>
        <span className='gameCardName'>{activity.label}</span>
        <span className='gameCardBlurb'>{activity.blurb}</span>
        {chips.length ? (
          <span className='gameCardChips'>
            {chips.map(chip => <span className='gameCardChip' key={chip}>{chip}</span>)}
          </span>
        ) : null}
      </span>
      <span className='gameCardAction' aria-hidden='true'>{action}</span>
    </>
  );

  if (href) {
    return (
      <a className={className} href={href} role={role} aria-label={`${activity.label}: ${action}`}>
        {face}
      </a>
    );
  }

  return (
    <button
      type='button'
      role={role}
      className={className}
      onClick={() => onLaunch(activity.id)}
      aria-label={`${activity.label}: ${action}`}
    >
      {face}
    </button>
  );
}

export default GameCard;
