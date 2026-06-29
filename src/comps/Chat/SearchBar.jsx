import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function SearchBar({ channelName }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const containerRef = useRef(null);
  const resultsRef = useRef(null);

  useEffect(() => {
    if (!anchorRect) return;
    function onKey(e) {
      if (e.key === 'Escape') close();
    }
    function onPointerDown(e) {
      if (
        containerRef.current && !containerRef.current.contains(e.target) &&
        resultsRef.current && !resultsRef.current.contains(e.target)
      ) {
        close();
      }
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [anchorRect]);

  function close() {
    setResults([]);
    setAnchorRect(null);
  }

  function submit(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    const rect = containerRef.current?.getBoundingClientRect();
    setAnchorRect(rect ?? null);
    fetch(`/channel/search?q=${encodeURIComponent(q)}&channel=${encodeURIComponent(channelName)}`)
      .then(r => r.json())
      .then(data => { setResults(data); setLoading(false); })
      .catch(() => setLoading(false));
  }

  function formatTime(t) {
    if (!t) return '';
    return new Intl.DateTimeFormat('en', { dateStyle: 'short', timeStyle: 'short' }).format(Number(t));
  }

  const showPanel = (results.length > 0 || loading) && anchorRect;

  return (
    <div ref={containerRef} style={{ display: 'flex', alignItems: 'center' }}>
      <form onSubmit={submit} style={{ display: 'flex', alignItems: 'center' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder='Search messages…'
          style={{
            padding: '6px 8px', borderRadius: 4, marginRight: '8px', border: '1px solid black',
            background: '#fff6', color: 'black', fontSize: 13, width: 180, boxShadow: 'inset 0 0 3px black'
          }}
          className='search-input'
        />
      </form>

      {showPanel && createPortal(
        <div ref={resultsRef} style={{
          position: 'fixed',
          top: anchorRect.bottom + 4,
          right: window.innerWidth - anchorRect.right,
          background: '#1e1e1e', border: '1px solid #444', borderRadius: 6,
          width: 360, maxHeight: 420, overflowY: 'auto', zIndex: 9999,
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
        }}>
          {loading && <div style={{ padding: '10px 14px', color: '#888', fontSize: 13 }}>Searching…</div>}
          {results.map(r => (
            <div key={r.count} style={{ padding: '8px 14px', borderBottom: '1px solid #333', cursor: 'default' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#ccc' }}>{r.nick}</span>
                <span style={{ fontSize: 11, color: '#666' }}>{formatTime(r.time)}</span>
              </div>
              <div style={{ fontSize: 13, color: '#aaa', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {r.message?.slice(0, 200)}{r.message?.length > 200 ? '…' : ''}
              </div>
            </div>
          ))}
          {!loading && results.length === 0 && (
            <div style={{ padding: '10px 14px', color: '#888', fontSize: 13 }}>No results</div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
