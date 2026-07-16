import { useState, useRef, useEffect } from 'react';

// Armed by the server's `scare` event (see /scare in commands.js). Nothing shows
// at arm time — it waits for the target to leave the tab and come back, then
// flashes in the bottom-left corner, where the newest message lands and the eye
// is already going. Stays for SCARE_MS, then removes itself.
const SCARE_MS = 2000;
const SCARE_IMAGE = '/images/scare.png';

function JumpScare({ socket }) {
  const [visible, setVisible] = useState(false);
  const armedRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const offScare = socket.on('scare', () => { armedRef.current = true; });

    const onVisibility = () => {
      if (document.hidden || !armedRef.current) return;
      // Single-shot: disarm before firing so a second tab-out doesn't repeat it.
      armedRef.current = false;
      setVisible(true);
      timerRef.current = setTimeout(() => setVisible(false), SCARE_MS);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      offScare();
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(timerRef.current);
    };
  }, [socket]);

  if (!visible) return null;

  return (
    <img
      src={SCARE_IMAGE}
      alt=""
      style={{
        position: 'fixed',
        left: '24px',
        bottom: '96px',
        width: 'min(280px, 40vw)',
        height: 'auto',
        zIndex: 99998,
        pointerEvents: 'none',
        userSelect: 'none'
      }}
    />
  );
}

export default JumpScare;
