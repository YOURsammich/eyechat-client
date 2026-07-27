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
//     (the server still enforces permission on delete regardless). It may also
//     return `subtitle` (a line above the table, for context the client can't
//     know — e.g. the IP /deepfind resolved) and `error` (a refusal to show
//     instead of an empty table).
//   - omit deleteUrl for a read-only view; the server just returns canDelete
//     false.
//   - deleteUrl POST receives { id } and returns { success } or { error }.
//   - columns: [{ label, render(item, helpers) }] describes each data column.
//     `helpers` is what lets a column be interactive rather than just text:
//     `data` is the raw load response (for flags only the server knows, e.g.
//     whether this user may edit), `patch(id, fields)` merges a saved change
//     back into a row, and `setError` surfaces a failure in the panel's own
//     error slot instead of each column inventing its own.
//   - confirmText(item) optionally returns a string to confirm before removing.
//   - header is optional JSX pinned above the table (e.g. a search box). A
//     caller that changes loadUrl from it gets a refetch for free.
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
  header = null,
}) {
  const [items, setItems] = useState(null); // null = still loading
  const [canDelete, setCanDelete] = useState(false);
  const [subtitle, setSubtitle] = useState('');
  const [error, setError] = useState('');
  const [response, setResponse] = useState({}); // the raw load body, for columns

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch(loadUrl);
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setCanDelete(!!data.canDelete);
      setSubtitle(typeof data.subtitle === 'string' ? data.subtitle : '');
      setResponse(data && typeof data === 'object' ? data : {});
      if (data.error) setError(data.error);
    } catch {
      setError('Could not load.');
      setItems([]);
    }
  }, [loadUrl]);

  useEffect(() => { load(); }, [load]);

  // Merge a saved change into one row, so an editable column can reflect what
  // the server stored without reloading the whole list.
  const patch = useCallback((id, fields) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...fields } : i)));
  }, []);

  const helpers = { data: response, patch, setError };

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
      {header ? <div style={{ marginBottom: 8 }}>{header}</div> : null}

      {error ? <div style={{ color: '#f66', marginBottom: 8, fontSize: 13 }}>{error}</div> : null}

      {subtitle ? (
        <div style={{ color: '#aaa', marginBottom: 8, fontSize: 12, wordBreak: 'break-word' }}>{subtitle}</div>
      ) : null}

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
                    {c.render(item, helpers)}
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
