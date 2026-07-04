import * as React from 'react';

const PART_ORDER = ['heads', 'eyes', 'noses', 'mouths', 'hair'];

export default function AvatarDisplay({ avatar, size = 25 }) {
  if (!avatar) return null;

  // An emoji avatar replaces the layered parts entirely — render the chat's
  // custom emoji image (avatar.emoji holds its imageName) filling the same box.
  if (avatar.emoji) {
    return (
      <div
        className='avatar-display avatar-emoji'
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: size, height: size, flexShrink: 0, verticalAlign: 'middle', marginRight: 6,
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
    <div className='avatar-display' style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0, verticalAlign: 'middle', marginRight: 6 }}>
      {PART_ORDER.map(part =>
        avatar[part] ? (
          <img
            key={part}
            src={`/images/avatars/${part}/${avatar[part]}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : null
      )}
    </div>
  );
}
