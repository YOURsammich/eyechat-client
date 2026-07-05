import { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

import { messageParser, NestMessage, msgStyles, preloadFontsFromText } from './comps/Chat/Messages';
import AvatarDisplay from './comps/Chat/AvatarDisplay';

const PAGE_SIZE = 50;

function timeAgo(ms) {
  const s = (Date.now() - Number(ms)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 2592000) return Math.floor(s / 86400) + 'd ago';
  return new Date(Number(ms)).toLocaleDateString();
}

const fmtTime = (ms) => new Intl.DateTimeFormat('en', { dateStyle: 'short', timeStyle: 'short' }).format(Number(ms) || Date.now());

// No-op callbacks NestMessage expects (image-load autoscroll, quote render,
// embed overlay) — none apply on the static search page.
const noop = () => {};

// A message rendered exactly like the chat: mirrors Messages.jsx renderMessage /
// renderNick / renderMessageContent, but reusing the shared parser + NestMessage
// + AvatarDisplay so styling stays identical and in one place.
function ChatMessage({ m, emojis, highlight, onJump }) {
  const flair = messageParser.parse(m.flair || m.nick || '', msgStyles);
  const textContent = messageParser.getTextContent(flair);
  const body = messageParser.parse(m.message || '', msgStyles);

  let avatar = null;
  try { avatar = m.avatar ? (typeof m.avatar === 'string' ? JSON.parse(m.avatar) : m.avatar) : null; } catch { avatar = null; }

  return (
    <div className={'message chat' + (highlight ? ' hit-chat' : '')} id={'m-' + m.count}>
      <div className='time' title={'#' + m.count + ' — jump'} onClick={() => onJump(m.count)}>{fmtTime(m.time)} </div>
      <div className='nick'>
        {avatar ? <AvatarDisplay avatar={avatar} /> : null}
        {m.hat ? <div className='hat' style={{ backgroundImage: `url('/images/hats/${m.hat}')` }}></div> : null}
        {textContent !== m.nick
          ? m.nick
          : <NestMessage message={flair} emojis={emojis} _imageLoaded={noop} renderMessage={() => null} setOverlay={noop} />}{': '}
      </div>
      <div className='messageContent'>
        <NestMessage message={body} emojis={emojis} _imageLoaded={noop} renderMessage={() => null} setOverlay={noop} />
      </div>
    </div>
  );
}

// The clean "card" rendering (message as plain text, sortable metadata).
function CardMessage({ m, highlight, onJump }) {
  return (
    <div className={'msg' + (highlight ? ' hit' : '')} id={'m-' + m.count}>
      <div className='msg-head'>
        <span className='msg-nick'>{m.nick || 'anon'}</span>
        <span className='msg-time'>{timeAgo(m.time)}</span>
        <button className='msg-num' onClick={() => onJump(m.count)}>#{m.count}</button>
      </div>
      <div className='msg-body'>{m.message}</div>
    </div>
  );
}

function App() {
  const [q, setQ] = useState('');
  const [nick, setNick] = useState('');
  const [num, setNum] = useState('');
  const [timeVal, setTimeVal] = useState('');

  const [emojis, setEmojis] = useState([]);
  const [view, setView] = useState('chat');       // 'chat' | 'cards'
  const [mode, setMode] = useState('idle');        // 'idle' | 'search' | 'context'
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState({ total: 0, pages: 0, page: 0, hasMore: false });
  const [label, setLabel] = useState('');          // counter text for context mode
  const [highlight, setHighlight] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  // The query behind the currently loaded search results, so "Load more" pages
  // the same search even if the user edits the inputs afterward.
  const activeQuery = useRef({ q: '', nick: '' });

  useEffect(() => {
    fetch('/channel/getEmojis')
      .then(r => r.json())
      .then(e => { if (Array.isArray(e)) setEmojis(e); })
      .catch(() => {});
  }, []);

  // Scroll the jumped-to message into view once a context window renders.
  useEffect(() => {
    if (mode === 'context' && highlight != null) {
      const el = document.getElementById('m-' + highlight);
      if (el) el.scrollIntoView({ block: 'center' });
    }
  }, [results, mode, highlight]);

  function flash(msg) {
    setStatus(msg);
    setTimeout(() => setStatus(''), 4000);
  }

  function ingestFonts(items) {
    for (const it of items) preloadFontsFromText(it.flair);
  }

  async function runSearch() {
    const qv = q.trim(), nv = nick.trim();
    if (!qv && !nv) return flash('Enter a search term or a nick.');
    activeQuery.current = { q: qv, nick: nv };
    setBusy(true);
    try {
      const res = await fetch('/search/query?q=' + encodeURIComponent(qv) + '&nick=' + encodeURIComponent(nv));
      const data = await res.json();
      const items = data.results || [];
      ingestFonts(items);
      setMode('search');
      setHighlight(null);
      setResults(items);
      setMeta({ total: data.total ?? 0, pages: data.pages ?? 0, page: items.length ? 1 : 0, hasMore: !!data.hasMore });
    } finally { setBusy(false); }
  }

  async function loadMore() {
    const before = results[results.length - 1]?.count;
    if (before == null) return;
    const { q: qv, nick: nv } = activeQuery.current;
    setBusy(true);
    try {
      const res = await fetch('/search/query?q=' + encodeURIComponent(qv) + '&nick=' + encodeURIComponent(nv) + '&before=' + before);
      const data = await res.json();
      const items = data.results || [];
      ingestFonts(items);
      setResults(prev => [...prev, ...items]);
      setMeta(prev => ({ ...prev, page: prev.page + 1, hasMore: !!data.hasMore }));
    } finally { setBusy(false); }
  }

  async function loadContext(url, hl, lbl) {
    setBusy(true);
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.error) return flash(data.error);
      const items = Array.isArray(data) ? data : [];
      ingestFonts(items);
      setMode('context');
      setLabel(lbl);
      setHighlight(hl);
      setResults(items);
    } finally { setBusy(false); }
  }

  const jumpTo = (count) => loadContext('/search/context?count=' + count, count, 'Around message #' + count);

  function jumpNum() {
    const n = parseInt(num, 10);
    if (isNaN(n)) return flash('Enter a message number.');
    jumpTo(n);
  }

  function jumpTime() {
    if (!timeVal) return flash('Pick a date and time.');
    const ms = new Date(timeVal).getTime();
    if (isNaN(ms)) return flash('Invalid time.');
    loadContext('/search/context?time=' + ms, null, 'Around ' + new Date(ms).toLocaleString());
  }

  const counter = mode === 'search'
    ? (meta.total.toLocaleString() + ' result' + (meta.total !== 1 ? 's' : '') + ' · page ' + meta.page + ' of ' + meta.pages)
    : (mode === 'context' ? label : '');

  const Row = view === 'chat' ? ChatMessage : CardMessage;

  return (
    <div className='wrap'>
      <header>
        <h1>Search the log</h1>
        <p>Search message history, filter by nick, or jump to a message number or time. &nbsp;<a href='/'>Back to chat →</a></p>
      </header>

      <div className='card'>
        <h2>Search messages</h2>
        <div className='row'>
          <input placeholder='Message contains...' style={{ flex: 2, minWidth: 200 }}
            value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && runSearch()} />
          <input placeholder='Filter by nick (optional)' style={{ flex: 1, minWidth: 140 }}
            value={nick} onChange={e => setNick(e.target.value)} onKeyDown={e => e.key === 'Enter' && runSearch()} />
          <button className='btn btn-primary' onClick={runSearch} disabled={busy}>Search</button>
        </div>
      </div>

      <div className='card'>
        <h2>Jump to a point in the log</h2>
        <div className='row'>
          <input type='number' placeholder='Message #' style={{ flex: 1, minWidth: 120 }}
            value={num} onChange={e => setNum(e.target.value)} onKeyDown={e => e.key === 'Enter' && jumpNum()} />
          <button className='btn' onClick={jumpNum}>Go</button>
        </div>
        <div className='row'>
          <input type='datetime-local' style={{ flex: 1, minWidth: 200 }}
            value={timeVal} onChange={e => setTimeVal(e.target.value)} />
          <button className='btn' onClick={jumpTime}>Go</button>
        </div>
        {status ? <div className='status err'>{status}</div> : null}
      </div>

      {mode !== 'idle' ? (
        <div className='viewtoggle'>
          <button className={view === 'chat' ? 'active' : ''} onClick={() => setView('chat')}>Chat view</button>
          <button className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}>Card view</button>
        </div>
      ) : null}

      {counter ? <div className='counter'>{counter}</div> : null}

      <div className={view === 'chat' ? 'chatview' : ''}>
        {mode !== 'idle' && results.length === 0
          ? <div className='empty'>Nothing found.</div>
          : results.map(m => (
              <Row key={m.count} m={m} emojis={emojis} highlight={highlight != null && Number(m.count) === Number(highlight)} onJump={jumpTo} />
            ))}
      </div>

      {mode === 'search' && meta.hasMore
        ? <button className='btn' style={{ width: '100%', marginTop: 8 }} onClick={loadMore} disabled={busy}>Load more</button>
        : null}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
