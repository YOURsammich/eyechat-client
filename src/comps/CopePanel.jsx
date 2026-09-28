import { useState, useEffect } from 'react';
import ManagerPanel from './ManagerPanel';

// Same limit the server holds an answer to (COPE_ANSWER_MAX in commands.js).
const ANSWER_MAX = 120;

const inputStyle = {
  background: '#222', color: '#eee', border: '1px solid #3a3a3a',
  borderRadius: 4, padding: '4px 8px', fontSize: 13, boxSizing: 'border-box',
};

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

// The Magic Cope Ball's answer pool (/seecope): how many there are, a filter
// for finding one, and — for whoever may run /addcope — an add box, so the pool
// can be managed from one place instead of a command plus a panel. The pool is
// small enough to load whole, so the filter works client-side.
export default function CopePanel({ onClose }) {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState(null); // { ok, text } after an add
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [canAdd, setCanAdd] = useState(false);

  // The result of an add is news for a moment, not a standing label: left up,
  // "Added …" would sit above a list that later deletes have already changed.
  useEffect(() => {
    if (!status) return;
    const id = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(id);
  }, [status]);

  async function add(e) {
    e.preventDefault();
    const answer = draft.trim();
    if (!answer || busy) return;
    setBusy(true);
    try {
      const res = await fetch('/channel/cope/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      });
      const data = await res.json();
      if (data.error) {
        setStatus({ ok: false, text: data.error });
      } else {
        // The count is already in the summary line under the filter.
        setStatus({ ok: true, text: `Added "${answer}".` });
        setDraft('');
        setReloadKey(k => k + 1);
      }
    } catch {
      setStatus({ ok: false, text: 'Could not reach the server.' });
    }
    setBusy(false);
  }

  const needle = query.trim().toLowerCase();

  const header = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {canAdd ? (
        <form onSubmit={add} style={{ display: 'flex', gap: 6 }}>
          <input
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setStatus(null); }}
            placeholder='Add an answer…'
            aria-label='New answer'
            maxLength={ANSWER_MAX}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            type='submit'
            disabled={busy || !draft.trim()}
            style={{
              background: '#4c2f7a', color: '#eee', border: '1px solid #6d46a8',
              borderRadius: 4, padding: '4px 12px', fontSize: 13,
              cursor: busy || !draft.trim() ? 'default' : 'pointer',
              opacity: busy || !draft.trim() ? 0.6 : 1,
            }}
          >
            Add
          </button>
        </form>
      ) : null}
      {status ? (
        <div style={{ fontSize: 12, color: status.ok ? '#8d8' : '#f66' }}>{status.text}</div>
      ) : null}
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setStatus(null); }}
        placeholder='Filter answers or nicks…'
        aria-label='Filter answers'
        style={{ ...inputStyle, width: '100%' }}
      />
    </div>
  );

  return (
    <ManagerPanel
      title='🔮 Magic Cope Ball — Answers'
      onClose={onClose}
      loadUrl='/channel/cope'
      deleteUrl='/channel/cope/delete'
      reloadKey={reloadKey}
      width={520}
      header={header}
      emptyText='No answers yet.'
      filteredText='No answers match that filter.'
      confirmText={(a) => `Delete "${a.answer}"?`}
      filter={needle
        ? (a) => a.answer.toLowerCase().includes(needle) || (a.nick || '').toLowerCase().includes(needle)
        : null}
      summary={(items) => `${items.length} answer${items.length === 1 ? '' : 's'} in the pool`}
      columns={[
        { label: 'Answer', render: (a) => a.answer },
        { label: 'By', width: 110, render: (a) => a.nick || '—' },
        {
          label: 'Added',
          width: 100,
          render: (a) => <span style={{ color: '#888', whiteSpace: 'nowrap' }}>{a.time ? dateFormat.format(a.time) : '—'}</span>,
        },
      ]}
      onLoad={(data) => setCanAdd(!!data.canAdd)}
    />
  );
}
