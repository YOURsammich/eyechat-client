import PropTypes from 'prop-types';
import AvatarDisplay from '../Chat/AvatarDisplay';
import { ParsedContent, loadFont, preloadFontsFromText } from '../Chat/Messages';
import { composeTextStyle } from '../../utils/textstyle';
import { parseAvatar } from './profiles';

// A short sample for the text style, so message styling reads as separate from the
// nick's flair. Kept tiny because these rows sit in a ~250px panel.
const SAMPLE_TEXT = 'abc';

// How a style profile actually looks — avatar, hat, flaired nick, and the message
// text style applied to a sample. This is the only thing that identifies a profile:
// they carry a generated id and no name, because the names users used to be asked
// for were never shown and never meaningful.
function ProfilePreview({ profile, user, emojis, fallback = 'No profile' }) {
  if (!profile) return <span className='cosPrevEmpty'>{fallback}</span>;

  const avatar = parseAvatar(profile.avatar);
  // A flair encodes the nick's own characters, so it renders as the styled name.
  // Without one there's nothing to style, so fall back to the plain nick.
  const nickText = profile.flair || user?.nick || '?';
  const textStyle = composeTextStyle(profile);

  return (
    <span className='cosPrev'>
      {avatar && (
        <span className='cosPrevAvatar'><AvatarDisplay avatar={avatar} size={22} /></span>
      )}

      <span className='cosPrevNick'>
        {profile.hat && (
          <span className='cosPrevHat' style={{ backgroundImage: `url('/images/hats/${profile.hat}')` }} />
        )}
        <ParsedContent text={nickText} emojis={emojis} compact />
      </span>

      {textStyle && (
        <span className='cosPrevText'>
          <ParsedContent text={textStyle + SAMPLE_TEXT} emojis={emojis} compact />
        </span>
      )}
    </span>
  );
}

ProfilePreview.propTypes = {
  profile:  PropTypes.object,
  user:     PropTypes.object,
  emojis:   PropTypes.array,
  fallback: PropTypes.string,
};

// Pull in the fonts a set of profiles references before their previews render,
// otherwise each row repaints as its font arrives. A flair carries its font as a
// "$Family|" token inside the markup; a text style's is a bare family name.
export function preloadProfileFonts(profiles = []) {
  for (const p of profiles) {
    if (p.flair) preloadFontsFromText(p.flair);
    if (p.font) loadFont(p.font);
  }
}

export default ProfilePreview;
