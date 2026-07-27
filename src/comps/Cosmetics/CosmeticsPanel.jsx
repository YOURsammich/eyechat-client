import { useState } from 'react';
import PropTypes from 'prop-types';
import FlairBuilder from '../Chat/FlairBuilder';
import AvatarBuilder from './AvatarBuilder';
import HatPicker from './HatPicker';
import TextStyleEditor from './TextStyleEditor';
import LeaveMessageEditor from './LeaveMessageEditor';
import ProfileHeader from './ProfileHeader';

// The cosmetic aspects a user can adjust, in the order they appear in the nav.
// `name` is a menu section, which is not always one column: 'textstyle' covers
// four (color, glow, font, style). See ASPECT_COLUMNS in profiles.js for the map.
export const COSMETIC_ASPECTS = [
  { name: 'flair',     label: 'Nick flair',    icon: 'title',        description: 'Color, glow and style each character of your nick' },
  { name: 'avatar',    label: 'Avatar',        icon: 'face',         description: 'Compose one from parts, draw it, or use an emoji' },
  { name: 'hat',       label: 'Hat',           icon: 'redeem',       description: 'Sits above your nick on every message' },
  { name: 'textstyle', label: 'Message text',  icon: 'format_paint', description: 'A style applied to everything you say' },
  { name: 'part',      label: 'Leave message', icon: 'waving_hand',  description: 'What the room sees when you disconnect' },
];

// Cosmetics live behind one side-menu section: the style profile you have
// selected on top, then a nav into each aspect. Aspect editors write straight to
// your live look; profiles are saved snapshots you apply on top of it, so the
// header reports "modified" rather than silently following your edits.
function CosmeticsPanel({ user, emojis, hats, handleInput }) {
  const [aspect, setAspect] = useState(null); // null = the nav root

  const selected = COSMETIC_ASPECTS.find(a => a.name === aspect);

  return (
    <div className='cosPanel'>
      <ProfileHeader user={user} emojis={emojis} />

      {selected ? (
        <div className='cosAspect'>
          <div className='cosAspectHead'>
            <span className='material-symbols-outlined cosBack' onClick={() => setAspect(null)} title='Back to cosmetics'>
              arrow_back
            </span>
            <span className='cosAspectTitle'>{selected.label}</span>
          </div>

          <div className='cosAspectBody'>
            {aspect === 'flair' && (
              <FlairBuilder
                user={user}
                emojis={emojis}
                onApply={(flair) => handleInput('/flair ' + flair)}
              />
            )}
            {aspect === 'avatar' && <AvatarBuilder user={user} emojis={emojis} />}
            {aspect === 'hat' && <HatPicker user={user} hats={hats} />}
            {aspect === 'textstyle' && <TextStyleEditor user={user} emojis={emojis} />}
            {aspect === 'part' && <LeaveMessageEditor user={user} emojis={emojis} />}
          </div>
        </div>
      ) : (
        <div className='cosNav'>
          {COSMETIC_ASPECTS.map(a => (
            <div className='cosNavItem' key={a.name} onClick={() => setAspect(a.name)}>
              <span className='material-symbols-outlined'>{a.icon}</span>
              <div className='cosNavText'>
                <div className='cosNavLabel'>{a.label}</div>
                <p>{a.description}</p>
              </div>
              <span className='material-symbols-outlined cosNavChevron'>chevron_right</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

CosmeticsPanel.propTypes = {
  user:        PropTypes.object,
  emojis:      PropTypes.array,
  hats:        PropTypes.array,
  handleInput: PropTypes.func.isRequired,
};

export default CosmeticsPanel;
