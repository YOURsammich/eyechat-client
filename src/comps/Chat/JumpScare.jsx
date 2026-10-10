import { useState, useRef, useEffect } from 'react';

// Armed by the server's `scare` event (see /scare in commands.js). Nothing shows
// at arm time — it waits for the target to leave the tab and come back, then
// jumps at them: it grows from tiny to most of the screen in GROW_MS and shakes
// until it's gone, SCARE_MS later (feedback #108).
//
// The image is preloaded at arm time, and a scare that fires before it has
// loaded waits for it, so the jump never plays on a blank box.
const SCARE_MS = 2000;
const GROW_MS = 100;
const SCARE_IMAGE = '/images/scare.png';

const KEYFRAMES = `
@keyframes jumpscare-grow {
  from { transform: translate(-50%, -50%) scale(0.1); }
  to   { transform: translate(-50%, -50%) scale(1); }
}
@keyframes jumpscare-shake {
  0%   { transform: translate(0, 0) rotate(0deg); }
  25%  { transform: translate(-6px, 4px) rotate(-2deg); }
  50%  { transform: translate(5px, -5px) rotate(1.5deg); }
  75%  { transform: translate(-4px, -3px) rotate(2deg); }
  100% { transform: translate(6px, 5px) rotate(-1.5deg); }
}`;

function JumpScare({ socket }) {
  const [visible, setVisible] = useState(false);
  const armedRef = useRef(false);
  const imageRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const offScare = socket.on('scare', () => {
      armedRef.current = true;
      if (!imageRef.current) {
        const img = new Image();
        img.src = SCARE_IMAGE;
        imageRef.current = img;
      }
    });

    const show = () => {
      setVisible(true);
      timerRef.current = setTimeout(() => setVisible(false), SCARE_MS);
    };

    const onVisibility = () => {
      if (document.hidden || !armedRef.current) return;
      // Single-shot: disarm before firing so a second tab-out doesn't repeat it.
      armedRef.current = false;
      const img = imageRef.current;
      if (!img || img.complete) show();
      else {
        img.addEventListener('load', show, { once: true });
        // A broken image still fires, as the old version did, rather than never.
        img.addEventListener('error', show, { once: true });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      offScare();
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(timerRef.current);
    };
  }, [socket]);

  if (!visible) return null;

  // Two layers so the two animations don't fight over `transform`: the outer
  // one centres and grows, the inner one shakes.
  return (
    <div
      data-testid="jumpscare"
      style={{
        position: 'fixed',
        left: '50%',
        top: '50%',
        zIndex: 99998,
        pointerEvents: 'none',
        userSelect: 'none',
        animation: `jumpscare-grow ${GROW_MS}ms ease-out both`
      }}
    >
      <style>{KEYFRAMES}</style>
      <img
        src={SCARE_IMAGE}
        alt=""
        style={{
          display: 'block',
          width: '80vmin',
          height: 'auto',
          animation: 'jumpscare-shake 60ms linear infinite alternate'
        }}
      />
    </div>
  );
}

export default JumpScare;
