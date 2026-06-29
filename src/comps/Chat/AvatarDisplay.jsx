import * as React from 'react';

const PART_ORDER = ['heads', 'eyes', 'noses', 'mouths', 'hair'];

export default function AvatarDisplay({ avatar, size = 40 }) {
  if (!avatar) return null;

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
