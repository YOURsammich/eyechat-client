import { useState, useRef, useEffect } from 'react';
import TrustBadge from './TrustBadge';

// The docked half of plugin presentation: a resizable column beside the chat.
// With `fullscreen` (a phone, where there's no room beside the chat) it covers
// the whole screen instead, with no resize bar and no pop-out.
function CodeRunWindow({ giveRefresh, giveIframe, draggingWindow, pluginName, owner, copeCloud, onClose, onPopOut, trusted, onRevokeTrust, fullscreen = false }) {
  const [chatWidth, setChatWidth] = useState(600);
  const src = copeCloud + 'v/' + (owner || 'sammich') + '/' + pluginName;
  const resizeBarRef = useRef(null);
  const iframeRef = useRef(null);
  const isDraggingRef = useRef(false);
  const diffRef = useRef(0);
  // Held in a ref so the reload closure, registered once, always reloads
  // whichever plugin is currently open.
  const srcRef = useRef(src);
  srcRef.current = src;

  useEffect(() => {
    giveRefresh(() => { if (iframeRef.current) iframeRef.current.src = srcRef.current; });
    giveIframe(iframeRef.current);

    // none in full screen; rerun when a turned phone brings it back
    const resizeBar = resizeBarRef.current;
    if (!resizeBar) return undefined;

    function handleMouseDown(e) {
      e.preventDefault();
      const container = resizeBar.parentElement.parentElement;
      diffRef.current = container.offsetWidth - e.clientX;
      isDraggingRef.current = true;
    }

    function handleMouseMove(e) {
      if (isDraggingRef.current) setChatWidth(e.clientX + diffRef.current);
    }

    function handleMouseUp() {
      isDraggingRef.current = false;
    }

    resizeBar.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      resizeBar.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [fullscreen]);

  return (
    <div
      className={fullscreen ? 'codeRunFull' : undefined}
      style={fullscreen ? undefined : { display: 'flex', width: chatWidth + 'px' }}
    >
      <div className='codeRunnerPanel' style={{ pointerEvents: draggingWindow ? 'none' : '' }}>
        <div className='codeRunnerHeader'>
          <span className='codeRunnerTitle'>{pluginName}</span>
          <span className='codeRunnerActions'>
            {trusted ? <TrustBadge pluginName={pluginName} onRevoke={onRevokeTrust} /> : null}
            {fullscreen ? null : (
              <button type='button' className='codeRunnerBtn' onClick={onPopOut} title='Pop out' aria-label='Pop out'>
                <span className='material-symbols-outlined'>open_in_new</span>
              </button>
            )}
            <button type='button' className='codeRunnerBtn' onClick={onClose} title='Close' aria-label={'Close ' + pluginName}>
              <span className='material-symbols-outlined'>close</span>
            </button>
          </span>
        </div>
        <iframe ref={iframeRef} title={pluginName} src={src}
          style={{ flex: 1, border: 'none', pointerEvents: isDraggingRef.current ? 'none' : '' }}
        />
      </div>
      {fullscreen ? null : (
        <div className='resizeBar'>
          <div className='resizeHandle' ref={resizeBarRef}>
            <span className="material-symbols-outlined">width</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default CodeRunWindow;
