import { useState, useEffect, useRef } from 'react';

function GifPicker({ onSelect, onClose }) {
  const [categories, setCategories] = useState([]);
  const [gifs, setGifs] = useState([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('categories');
  const searchTimer = useRef(null);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    const res = await fetch('/api/gif/categories').then(r => r.json());
    setCategories(res?.data?.categories ?? []);
    setLoading(false);
  }

  async function loadGifs(q, pg) {
    setLoading(true);
    const res = await fetch(`/api/gif/search?q=${encodeURIComponent(q)}&page=${pg}`).then(r => r.json());
    const items = res?.data?.data ?? [];
    setGifs(pg === 1 ? items : prev => [...prev, ...items]);
    setHasNext(!!res?.data?.has_next);
    setPage(pg);
    setLoading(false);
  }

  function handleSearch(e) {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(searchTimer.current);
    if (!q) {
      setView('categories');
      setGifs([]);
      return;
    }
    setView('gifs');
    searchTimer.current = setTimeout(() => loadGifs(q, 1), 350);
  }

  function selectCategory(cat) {
    setQuery(cat.query);
    setView('gifs');
    loadGifs(cat.query, 1);
  }

  function loadMore() {
    loadGifs(query, page + 1);
  }

  return (
    <div className='gifPicker'>
      <div className='gifPicker-header'>
        <input
          className='gifPicker-search'
          placeholder='Search GIFs...'
          value={query}
          onChange={handleSearch}
          autoFocus
        />
        <span className='gifPicker-close' onClick={onClose}>✕</span>
      </div>
      <div className='gifPicker-grid'>
        {view === 'categories'
          ? categories.map((cat) => (
              <div key={cat.category} className='gifPicker-category' onClick={() => selectCategory(cat)}>
                <img className='gifPicker-item' src={cat.preview_url} loading='lazy' />
                <div className='gifPicker-category-label'>{cat.category}</div>
              </div>
            ))
          : gifs.map((gif, i) => (
              <img
                key={i}
                className='gifPicker-item'
                src={gif.file?.sm?.webp?.url}
                loading='lazy'
                onClick={() => { onSelect(gif.file?.hd?.gif?.url); onClose(); }}
              />
            ))
        }
        {!loading && (view === 'categories' ? categories : gifs).length === 0 && (
          <div className='gifPicker-empty'>{view === 'categories' ? 'No categories' : 'No results'}</div>
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
