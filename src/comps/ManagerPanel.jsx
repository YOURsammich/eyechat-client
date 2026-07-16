import { useState, useEffect, useCallback } from 'react';
import DraggableWindow from './DraggableWindow';

// A generic, reusable management panel: fetches a list of rows from `loadUrl`
// and renders them in a table, with an optional per-row remove action that
// POSTs to `deleteUrl`. Built for any "view data, remove entries" admin view
// (ban list, cope answers, and future lists) so they all share one draggable
// shell and interaction model.
//
// Contract:
//   - loadUrl GET returns { items: [...], canDelete: boolean }; each item needs
//     a unique `id`. `canDelete` decides whether the remove column is shown
//     (the server still enforces permission on delete regardless).
//   - deleteUrl POST receives { id } and returns { success } or { error }.
//   - columns: [{ label, render(item) }] describes each data column.
//   - confirmText(item) optionally returns a string to confirm before removing.
export default function ManagerPanel({
  title,
  onClose,
  loadUrl,
  deleteUrl,
  columns,
  deleteLabel = 'Delete',
  confirmText,
  emptyText = 'Nothing here.',
  width = 460,
}) {
  const [items, setItems] = useState(null); // null = still loading
  const [canDelete, setCanDelete] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch(loadUrl);
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setCanDelete(!!data.canDelete);
    } catch {
      setError('Could not load.');
      setItems([]);
    }
  }, [loadUrl]);

  useEffect(() => { load(); }, [load]);

  async function remove(item) {
    if (confirmText && !window.confirm(confirmText(item))) return;
    setError('');
    try {
      const res = await fetch(deleteUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await res.json();
      if (data.success) {
        setItems(prev => prev.filter(i => i.id !== item.id));
      } else {
        setError(data.error || 'Could not remove.');
      }
    } catch {
      setError('Could not remove.');
    }
  }

  return (
    <DraggableWindow title={title} onClose={onClose} width={width}>
      {error ? <div style={{ color: '#f66', marginBottom: 8, fontSize: 13 }}>{error}</div> : null}

      {items === null ? (
        <div style={{ color: '#888', padding: '12px 0' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ color: '#888', padding: '12px 0' }}>{emptyText}</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {columns.map(c => (
                <th
                  key={c.label}
                  style={{ textAlign: 'left', borderBottom: '1px solid #333', padding: '4px 8px', color: '#aaa', fontWeight: 600 }}
                >
                  {c.label}
                </th>
              ))}
              {canDelete ? <th style={{ borderBottom: '1px solid #333' }}></th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                {columns.map(c => (
                  <td
                    key={c.label}
                    style={{ padding: '5px 8px', borderBottom: '1px solid #232323', wordBreak: 'break-word' }}
                  >
                    {c.render(item)}
                  </td>
                ))}
                {canDelete ? (
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid #232323', textAlign: 'right' }}>
                    <button
                      onClick={() => remove(item)}
                      style={{
                        background: 'none', border: '1px solid #5a2a2a', color: '#c55',
                        borderRadius: 6, padding: '2px 10px', fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      {deleteLabel}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DraggableWindow>
  );
}
