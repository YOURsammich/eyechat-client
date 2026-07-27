import { useState, useEffect } from 'react';
import ManagerPanel from './ManagerPanel';
import { TRUST_LEVELS, trustLabel } from './trustLevels';

// The account's current level. An admin gets a picker; a moderator sees the same
// value as text — they can survey who holds what without being able to change it.
function TrustCell({ user, helpers }) {
  const [saving, setSaving] = useState(false);

  if (!helpers.data.canEdit) {
    return <span>{trustLabel(user.trust)}</span>;
  }

  // /trust accepts any integer, so an account can sit outside the standard
  // range (a level above 5 puts them below every guest). Keep that value in the
  // list rather than silently rewriting it the moment someone opens the picker.
  const levels = TRUST_LEVELS.includes(user.trust) ? TRUST_LEVELS : [user.trust, ...TRUST_LEVELS];

  async function save(value) {
    setSaving(true);
    helpers.setError('');
    try {
      const res = await fetch('/channel/users/trust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nick: user.nick, level: value }),
      });
      const data = await res.json();
      if (data.error) helpers.setError(data.error);
      else if (data.user) helpers.patch(user.nick, { trust: data.user.trust });
    } catch {
      helpers.setError('Could not save.');
    }
    setSaving(false);
  }

  return (
    <select
      value={String(user.trust)}
      disabled={saving}
      onChange={(e) => save(e.target.value)}
      style={{
        background: '#222', color: '#eee', border: '1px solid #3a3a3a',
        borderRadius: 4, padding: '2px 4px', fontSize: 12,
      }}
    >
      {levels.map(level => (
        <option key={level} value={level}>{trustLabel(level)}</option>
      ))}
    </select>
  );
}

// Every registered account and the trust level it holds, in the same draggable
// shell as the ban list. The list is capped server-side, so the search box is
// how you reach an account that isn't in the most-privileged first page.
export default function UsersPanel({ onClose }) {
  const [typed, setTyped] = useState('');
  const [query, setQuery] = useState('');

  // Debounced: `query` is what builds loadUrl, and every change to that refetches.
  useEffect(() => {
    const id = setTimeout(() => setQuery(typed.trim()), 250);
    return () => clearTimeout(id);
  }, [typed]);

  const search = (
    <input
      value={typed}
      onChange={(e) => setTyped(e.target.value)}
      placeholder='Search nicks…'
      aria-label='Search nicks'
      style={{
        width: '100%', boxSizing: 'border-box', background: '#222', color: '#eee',
        border: '1px solid #3a3a3a', borderRadius: 4, padding: '4px 8px', fontSize: 13,
      }}
    />
  );

  return (
    <ManagerPanel
      title='Users — Trust Levels'
      onClose={onClose}
      loadUrl={'/channel/users?q=' + encodeURIComponent(query)}
      emptyText='No accounts match that search.'
      width={520}
      header={search}
      columns={[
        { label: 'Nick', render: (u) => u.nick },
        { label: 'Trust', render: (u, helpers) => <TrustCell user={u} helpers={helpers} /> },
        {
          label: 'Online',
          render: (u) => <span style={{ color: u.online ? '#5fa' : '#777' }}>{u.online ? 'yes' : '—'}</span>,
        },
      ]}
    />
  );
}
