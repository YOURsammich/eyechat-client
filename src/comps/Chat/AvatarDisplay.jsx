import * as React from 'react';

const PART_ORDER = ['heads', 'eyes', 'noses', 'mouths', 'hair'];

// `fill` makes the avatar stretch to 100% of its parent with no inline margin,
// so it can be used as an exactly-aligned underlay (e.g. behind the pixel editor)
// rather than an inline chip next to a nick.
export default function AvatarDisplay({ avatar, size = 25, fill = false }) {
  if (!avatar) return null;

  const boxSize = fill ? { width: '100%', height: '100%' } : { width: size, height: size, marginRight: 6, verticalAlign: 'middle' };

  // A composited (built) avatar is one flattened image from the avatar builder.
  if (avatar.whole) {
    return (
      <div
        className='avatar-display avatar-whole'
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, ...boxSize,
        }}
      >
        <img
          src={`/images/avatars/whole/${avatar.whole}`}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    );
  }

  // An emoji avatar replaces the layered parts entirely — render the chat's
  // custom emoji image (avatar.emoji holds its imageName) filling the same box.
  if (avatar.emoji) {
    return (
      <div
        className='avatar-display avatar-emoji'
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, ...boxSize,
        }}
      >
        <img
          src={`/images/emojis/${avatar.emoji}`}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    );
  }

  return (
    <div className='avatar-display' style={{ position: 'relative', display: 'inline-block', flexShrink: 0, ...boxSize }}>
      {PART_ORDER.map(part => {
        const val = avatar[part];
        if (!val) return null;
        // A `custom:<file>` value is a user-painted part living in the shared
        // custom dir; anything else is a built-in part filename.
        const src = val.startsWith('custom:')
          ? `/images/avatars/custom/${val.slice('custom:'.length)}`
          : `/images/avatars/${part}/${val}`;
        return (
          <img
            key={part}
            src={src}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
          />
        );
      })}
    </div>
  );
}
