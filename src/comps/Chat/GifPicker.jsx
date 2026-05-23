import { useState, useEffect, useRef } from 'react';

function GifPicker({ onSelect, onClose, initialQuery }) {
  const [mode, setMode] = useState('gif');
  const [categories, setCategories] = useState([]);
  const [gifs, setGifs] = useState([]);
  const [query, setQuery] = useState(initialQuery ?? '');
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('gifs');
  const [hoveredItem, setHoveredItem] = useState(null);
  const searchTimer = useRef(null);
  const initializedRef = useRef(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (initialQuery) {
      loadMedia(initialQuery, 1, 'gif');
    } else {
      loadCategories('gif');
    }
    initializedRef.current = true;
  }, []);

  useEffect(() => {
    if (!initializedRef.current) return;
    if (initialQuery) {
      setQuery(initialQuery);
      setMode('gif');
      setView('gifs');
      loadMedia(initialQuery, 1, 'gif');
    }
  }, [initialQuery]);

  // Escape key + click-outside to close
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    function onMouseDown(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [onClose]);

  async function loadCategories(currentMode) {
    setLoading(true);
    const endpoint = currentMode === 'sticker' ? '/api/sticker/categories' : '/api/gif/categories';
    const res = await fetch(endpoint).then(r => r.json());
    setCategories(res?.data?.categories ?? []);
    setGifs([]);
    setView('categories');
    setLoading(false);
  }

  async function loadMedia(q, pg, currentMode) {
    setLoading(true);
    const endpoint = currentMode === 'sticker' ? '/api/sticker/search' : '/api/gif/search';
    const res = await fetch(`${endpoint}?q=${encodeURIComponent(q)}&page=${pg}`).then(r => r.json());
    const items = res?.data?.data ?? [];
    setGifs(pg === 1 ? items : prev => [...prev, ...items]);
    setHasNext(!!res?.data?.has_next);
    setPage(pg);
    setView('gifs');
    setLoading(false);
  }

  function handleSearch(e) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(searchTimer.current);
    if (!q) {
      loadCategories(mode);
      return;
    }
    setView('gifs');
    setGifs([]);  // clear immediately so grid doesn't show stale results during debounce
    searchTimer.current = setTimeout(() => loadMedia(q, 1, mode), 350);
  }

  function selectCategory(cat) {
    setQuery(cat.query);
    loadMedia(cat.query, 1, mode);
  }

  function loadMore() {
    loadMedia(query, page + 1, mode);
  }

  function switchMode(newMode) {
    if (newMode === mode && view === 'categories') return;
    setMode(newMode);
    setGifs([]);
    setCategories([]);
    setQuery('');
    clearTimeout(searchTimer.current);
    loadCategories(newMode);
  }

  function getSelectUrl(item) {
    if (mode === 'sticker') {
      return item.file?.hd?.webp?.url ?? item.file?.sm?.webp?.url;
    }
    return item.file?.hd?.gif?.url;
  }

  function getPreviewUrl(item) {
    return item.file?.sm?.webp?.url ?? item.file?.sm?.gif?.url;
  }

  return (
    <div className='gifPicker' ref={pickerRef}>
      <div className='gifPicker-tabs'>
        <button
          className={'gifPicker-tab' + (mode === 'gif' ? ' gifPicker-tab--active' : '')}
          onClick={() => switchMode('gif')}
        >GIF</button>
        <button
          className={'gifPicker-tab' + (mode === 'sticker' ? ' gifPicker-tab--active' : '')}
          onClick={() => switchMode('sticker')}
        >Sticker</button>
        <button className='gifPicker-closeBtn' onClick={onClose}>✕</button>
      </div>
      <div className='gifPicker-header'>
        <input
          className='gifPicker-search'
          placeholder={mode === 'sticker' ? 'Search stickers...' : 'Search GIFs...'}
          value={query}
          onChange={handleSearch}
          autoFocus
        />
      </div>
      <div className='gifPicker-grid'>
        {view === 'categories'
          ? categories.map((cat) => (
              <div key={cat.category} className='gifPicker-category' onClick={() => selectCategory(cat)}>
                <img className='gifPicker-item' src={cat.preview_url} loading='lazy' />
                <div className='gifPicker-category-label'>{cat.category}</div>
              </div>
            ))
          : gifs.map((item, i) => (
              <img
                key={i}
                className='gifPicker-item'
                src={getPreviewUrl(item)}
                loading='lazy'
                onMouseEnter={() => setHoveredItem(item)}
                onMouseLeave={() => setHoveredItem(null)}
                onClick={() => { onSelect(getSelectUrl(item), getPreviewUrl(item)); onClose(); }}
              />
            ))
        }
        {!loading && (view === 'categories' ? categories : gifs).length === 0 && (
          <div className='gifPicker-empty'>{view === 'categories' ? 'No categories' : 'No results'}</div>
        )}
        {hoveredItem && (
          <div className='gifPicker-preview'>
            <img src={getPreviewUrl(hoveredItem)} />
          </div>
        )}
      </div>
      {view === 'gifs' && hasNext && (
        <div className='gifPicker-more' onClick={loadMore}>
          {loading ? 'Loading…' : 'Load more'}
        </div>
      )}
    </div>
  );
}

export default GifPicker;
