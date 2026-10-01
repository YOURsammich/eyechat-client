import { useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

// How much of the title bar always stays on screen, so a window dragged to the
// edge can still be grabbed again.
const KEEP_VISIBLE = 80;

// Where a window may go: the bar stays inside the viewport vertically, and at
// least KEEP_VISIBLE px of it stays inside horizontally.
export function clampPosition(left, top, { width, barHeight, viewWidth, viewHeight }) {
  const minLeft = Math.min(0, KEEP_VISIBLE - width);
  const maxLeft = Math.max(0, viewWidth - KEEP_VISIBLE);
  const maxTop = Math.max(0, viewHeight - barHeight);
  return {
    left: Math.min(Math.max(left, minLeft), maxLeft),
    top: Math.min(Math.max(top, 0), maxTop),
  };
}

// A generic floating, draggable window. Portaled to document.body so it floats
// above everything regardless of where it is used (no ancestor overflow/transform
// can clip it). Dragging is bound to the title bar only, so interactive body
// content (e.g. a paint canvas, a video player) is never hijacked. Pointer
// events, so a finger drags it as well as a mouse.
//
// `centered` opens it in the middle of the viewport instead of at
// initialLeft/initialTop.
export default function DraggableWindow({ title, onClose, children, initialLeft = 140, initialTop = 90, width = 'auto', headerActions = null, bodyStyle = null, centered = false }) {
  const panelRef = useRef(null);
  const headerRef = useRef(null);
  const bodyRef = useRef(null);

  // Before the first paint, so a centred window never flashes at its default spot.
  useLayoutEffect(() => {
    if (!centered) return;
    const panel = panelRef.current;
    const rect = panel.getBoundingClientRect();
    panel.style.left = Math.max(0, (window.innerWidth - rect.width) / 2) + 'px';
    panel.style.top = Math.max(0, (window.innerHeight - rect.height) / 2) + 'px';
  }, [centered]);

  useEffect(() => {
    const panel = panelRef.current;
    const header = headerRef.current;
    let pointerId = null, startX, startY, initX, initY;

    function onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target.nodeName === 'BUTTON' || e.target.closest('button')) return;
      if (e.target.closest('[data-window-action]')) return;
      pointerId = e.pointerId;
      startX = e.clientX; startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      initX = rect.left; initY = rect.top;
      // Keep every move coming to the bar, even over an iframe in the body
      // (a video player would otherwise swallow them).
      header.setPointerCapture?.(e.pointerId);
      bodyRef.current.style.pointerEvents = 'none';
      e.preventDefault();
    }
    function onPointerMove(e) {
      if (pointerId === null || e.pointerId !== pointerId) return;
      const rect = panel.getBoundingClientRect();
      const { left, top } = clampPosition(initX + e.clientX - startX, initY + e.clientY - startY, {
        width: rect.width,
        barHeight: header.getBoundingClientRect().height,
        viewWidth: window.innerWidth,
        viewHeight: window.innerHeight,
      });
      panel.style.left = left + 'px';
      panel.style.top = top + 'px';
    }
    function onPointerUp(e) {
      if (pointerId === null || e.pointerId !== pointerId) return;
      pointerId = null;
      bodyRef.current.style.pointerEvents = '';
      header.releasePointerCapture?.(e.pointerId);
    }

    header.addEventListener('pointerdown', onPointerDown);
    header.addEventListener('pointermove', onPointerMove);
    header.addEventListener('pointerup', onPointerUp);
    header.addEventListener('pointercancel', onPointerUp);
    return () => {
      header.removeEventListener('pointerdown', onPointerDown);
      header.removeEventListener('pointermove', onPointerMove);
      header.removeEventListener('pointerup', onPointerUp);
      header.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: 'fixed', top: initialTop, left: initialLeft, zIndex: 10000, width,
        maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        background: '#1b1b1b', color: '#eee', border: '1px solid #333',
        borderRadius: 6, boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
      }}
    >
      <div
        ref={headerRef}
        data-window-bar
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', cursor: 'move', userSelect: 'none', borderBottom: '1px solid #333',
          // The page mustn't scroll or zoom when a finger drags the bar.
          touchAction: 'none',
        }}
      >
        <span style={{ fontWeight: 'bold', fontSize: 13 }}>{title}</span>
        <span data-window-action style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {headerActions}
          <span
            className='material-symbols-outlined'
            onClick={onClose}
            title='Close'
            style={{ cursor: 'pointer', fontSize: 20, display: 'flex' }}
          >
            close
          </span>
        </span>
      </div>
      <div ref={bodyRef} style={{ padding: 12, overflow: 'auto', flex: 1, minHeight: 0, ...bodyStyle }}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
