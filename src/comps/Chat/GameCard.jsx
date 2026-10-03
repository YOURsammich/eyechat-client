// One game in the Play picker: a band of art across the top, the name and
// blurb, the live facts as chips, and the word on its button. The whole card is
// the button. A game with something going on gets a green ring and a pulsing
// dot, which is the thing that recruits a second player.
//
// `wide` is the Whiteboard's strip: the same parts laid out in a row under the
// game cards, since it's a tool rather than a game.

function GameCard({ activity, state, onLaunch, wide = false }) {
  const live = !!activity.live?.(state);
  const chips = activity.chips?.(state) ?? [];
  const action = activity.action?.(state) ?? 'Open';
  const { from = '#333', to = '#555', glyph = activity.icon } = activity.art ?? {};

  return (
    <button
      type='button'
      role='menuitem'
      className={'gameCard' + (wide ? ' gameCardWide' : '') + (live ? ' gameCardLive' : '')}
      onClick={() => onLaunch(activity.id)}
      aria-label={`${activity.label}: ${action}`}
    >
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
    </button>
  );
}

export default GameCard;
