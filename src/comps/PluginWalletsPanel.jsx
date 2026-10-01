import { useState, useEffect } from 'react';
import ManagerPanel from './ManagerPanel';

const field = {
  background: '#222', color: '#eee', border: '1px solid #3a3a3a',
  borderRadius: 4, padding: '2px 6px', fontSize: 12,
};

// A wallet's balance, and a box to change it: "500" sets it, "+500" / "-500"
// adds or takes away. The server logs who changed it and by how much.
function CoinsCell({ wallet, helpers }) {
  const [change, setChange] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    if (!change.trim()) return;
    setSaving(true);
    helpers.setError('');
    try {
      const res = await fetch('/channel/plugin-wallets/coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appname: wallet.appname, change }),
      });
      const data = await res.json();
      if (data.error) helpers.setError(data.error);
      else if (data.wallet) {
        helpers.patch(wallet.id, { coins: data.wallet.coins, unused: false });
        setChange('');
      }
    } catch {
      helpers.setError('Could not save.');
    }
    setSaving(false);
  }

  return (
    <form onSubmit={save} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ minWidth: 70 }}>₵{wallet.coins.toLocaleString()}</span>
      <input
        value={change}
        onChange={(e) => setChange(e.target.value)}
        placeholder='500, +500, -500'
        aria-label={`Change ${wallet.appname}'s balance`}
        disabled={saving}
        style={{ ...field, width: 110 }}
      />
      <button type='submit' disabled={saving || !change.trim()} style={{ ...field, cursor: 'pointer' }}>
        Save
      </button>
    </form>
  );
}

// `accept` (players may pay the plugin) or `payout` (its server may pay them).
function PermissionCell({ wallet, permission, helpers }) {
  const [saving, setSaving] = useState(false);

  async function toggle(allowed) {
    setSaving(true);
    helpers.setError('');
    try {
      const res = await fetch('/channel/plugin-wallets/permission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appname: wallet.appname, permission, allowed }),
      });
      const data = await res.json();
      if (data.error) helpers.setError(data.error);
      else if (data.wallet) helpers.patch(wallet.id, { [permission]: data.wallet[permission] });
    } catch {
      helpers.setError('Could not save.');
    }
    setSaving(false);
  }

  return (
    <input
      type='checkbox'
      checked={!!wallet[permission]}
      disabled={saving}
      aria-label={`${wallet.appname} ${permission}`}
      onChange={(e) => toggle(e.target.checked)}
    />
  );
}

// Every copecloud plugin's copecoin wallet, for funding plugins and fixing
// balances (/pluginwallets, admins only). A plugin that has never touched coins
// has no wallet yet; searching for its exact name offers an empty one to fund.
export default function PluginWalletsPanel({ onClose }) {
  const [typed, setTyped] = useState('');
  const [query, setQuery] = useState('');

  // Debounced: `query` builds loadUrl, and every change to that refetches.
  useEffect(() => {
    const id = setTimeout(() => setQuery(typed.trim()), 250);
    return () => clearTimeout(id);
  }, [typed]);

  const search = (
    <input
      value={typed}
      onChange={(e) => setTyped(e.target.value)}
      placeholder='Search plugins, or type a plugin name to fund it…'
      aria-label='Search plugins'
      style={{ ...field, width: '100%', boxSizing: 'border-box', padding: '4px 8px', fontSize: 13 }}
    />
  );

  return (
    <ManagerPanel
      title='Plugin Wallets'
      onClose={onClose}
      loadUrl={'/channel/plugin-wallets?q=' + encodeURIComponent(query)}
      emptyText='No plugin wallets yet. Type a plugin name to fund it.'
      width={560}
      header={search}
      columns={[
        {
          label: 'Plugin',
          render: (w) => (
            <span>
              {w.appname}
              {w.unused ? <span style={{ color: '#777' }}> (no wallet yet)</span> : null}
            </span>
          ),
        },
        { label: 'Coins', render: (w, helpers) => <CoinsCell wallet={w} helpers={helpers} /> },
        { label: 'Accept', render: (w, helpers) => <PermissionCell wallet={w} permission='accept' helpers={helpers} /> },
        { label: 'Payout', render: (w, helpers) => <PermissionCell wallet={w} permission='payout' helpers={helpers} /> },
      ]}
    />
  );
}
