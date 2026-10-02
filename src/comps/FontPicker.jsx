import { useState, useEffect, useRef, useMemo } from 'react';
import { availableFonts } from '../utils/fonts';
import { loadFont } from './Chat/Messages';

// How many rows to render at a time; more appear as the list scrolls.
const PAGE = 60;

// A searchable list of every Google Font (feedback #48), each name shown in its
// own font. Fonts load only as their row scrolls into view, so opening the list
// doesn't fetch 1,700 stylesheets. Blacklisted fonts aren't offered. Built to be
// reused wherever a font is picked (the text style editor now; /channelfont and
// nick flair fonts later).
//
// value: the current font name, or '' for none. onChange(name or '').
export default function FontPicker({ value = '', onChange, placeholder = 'Search fonts…' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [fontsVersion, setFontsVersion] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);

  // The blacklist can change while the list is open.
  useEffect(() => {
    const onBlocked = () => setFontsVersion(v => v + 1);
    window.addEventListener('fonts:blocked', onBlocked);
    return () => window.removeEventListener('fonts:blocked', onBlocked);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = availableFonts();
    return q ? all.filter(n => n.toLowerCase().includes(q)) : all;
  }, [query, fontsVersion]);

  useEffect(() => { setShown(PAGE); }, [query]);

  // Close on a click outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Load each font when its row comes into view.
  useEffect(() => {
    if (!open || !listRef.current || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { loadFont(e.target.dataset.font); io.unobserve(e.target); }
      }
    }, { root: listRef.current });
    listRef.current.querySelectorAll('[data-font]').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [open, matches, shown]);

  useEffect(() => { if (value) loadFont(value); }, [value]);

  function pick(name) {
    onChange?.(name);
    setOpen(false);
    setQuery('');
  }

  function onScroll(e) {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 200 && shown < matches.length) {
      setShown(n => n + PAGE);
    }
  }

  return (
    <div className='fontPicker' ref={rootRef}>
      <button
        type='button'
        className='stdInput fontPickerCurrent'
        style={value ? { fontFamily: `'${value}', sans-serif` } : undefined}
        onClick={() => setOpen(o => !o)}
      >
        {value || 'None'}
        <span className='material-symbols-outlined'>{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open ? (
        <div className='fontPickerPanel'>
          <input
            className='stdInput'
            autoFocus
            placeholder={placeholder}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') setOpen(false);
              if (e.key === 'Enter' && matches.length) pick(matches[0]);
            }}
          />
          <div className='fontPickerList' ref={listRef} onScroll={onScroll} role='listbox'>
            {!query ? (
              <div className={'fontPickerRow' + (!value ? ' selected' : '')} onClick={() => pick('')}>None</div>
            ) : null}
            {matches.slice(0, shown).map(name => (
              <div
                key={name}
                data-font={name}
                role='option'
                aria-selected={name === value}
                className={'fontPickerRow' + (name === value ? ' selected' : '')}
                style={{ fontFamily: `'${name}', sans-serif` }}
                onClick={() => pick(name)}
              >{name}</div>
            ))}
            {!matches.length ? <div className='fontPickerEmpty'>No font called that.</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
