import { useState, useRef, useEffect } from 'react';

function CodeRunWindow({ giveRefresh, giveIframe, draggingWindow, pluginName, copeCloud }) {
  const [chatWidth, setChatWidth] = useState(600);
  const resizeBarRef = useRef(null);
  const iframeRef = useRef(null);
  const isDraggingRef = useRef(false);
  const diffRef = useRef(0);

  useEffect(() => {
    giveRefresh(() => { iframeRef.current.src = iframeRef.current.src; });
    giveIframe(iframeRef.current);

    const resizeBar = resizeBarRef.current;

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
  }, []);

  return (
    <div style={{ display: 'flex', width: chatWidth + 'px' }}>
      <div className='codeRunnerPanel' style={{ pointerEvents: draggingWindow ? 'none' : '' }}>
        <iframe ref={iframeRef} src={copeCloud + 'v/sammich/' + pluginName}
          style={{ flex: 1, border: 'none', pointerEvents: isDraggingRef.current ? 'none' : '' }}
        />
      </div>
      <div className='resizeBar'>
        <div className='resizeHandle' ref={resizeBarRef}>
          <span className="material-symbols-outlined">width</span>
        </div>
      </div>
    </div>
  );
}

export default CodeRunWindow;
