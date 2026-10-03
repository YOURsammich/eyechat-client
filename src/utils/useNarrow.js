import { useState, useEffect } from 'react';

// Phone-sized, matching the stylesheet's 768px breakpoint, kept current as the
// window changes. Where a layout differs in kind on a phone rather than just
// in size (a plugin full-screen, Play as a bottom sheet).
export const NARROW = '(max-width: 768px)';

export default function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(NARROW).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(NARROW);
    if (!mq) return undefined;
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return narrow;
}
