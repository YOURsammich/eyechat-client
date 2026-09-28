import { useState, useEffect, useCallback, useRef } from 'react';
import DraggableWindow from './DraggableWindow';

const rowBtn = {
  background: 'none', border: '1px solid', borderRadius: 6,
  padding: '2px 10px', fontSize: 12, cursor: 'pointer',
};

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
//   - columns: [{ label, render(item, helpers), width? }] describes each data
//     column. Giving any column a width fixes the table's layout (see below).
//     `helpers` is what lets a column be interactive rather than just text:
//     `data` is the raw load response (for flags only the server knows, e.g.
//     whether this user may edit), `patch(id, fields)` merges a saved change
//     back into a row, and `setError` surfaces a failure in the panel's own
//     error slot instead of each column inventing its own.
//   - confirmText(item) optionally returns a question to confirm before
//     removing. It is asked inline, in the row itself, rather than through a
//     browser dialog.
//   - header is optional JSX pinned above the table (e.g. a search box). A
//     caller that changes loadUrl from it gets a refetch for free; one that
//     changes reloadKey (e.g. after adding a row) gets a refetch of the same url.
//   - filter(item) optionally hides rows client-side, for a list small enough
//     to load whole; filteredText replaces emptyText when it hides every row.
//   - onLoad(data) is handed each load response, for a caller whose header
//     depends on a flag in it (e.g. whether this user may add rows).
//   - summary(items) optionally returns a line shown above the table, computed
//     from the rows as they stand (so it follows deletes), in place of the
//     server's subtitle.
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
  reloadKey = 0,
  filter = null,
  filteredText = 'Nothing matches.',
  summary = null,
  onLoad = null,
}) {
  const [items, setItems] = useState(null); // null = still loading
  const [canDelete, setCanDelete] = useState(false);
  const [subtitle, setSubtitle] = useState('');
  const [error, setError] = useState('');
  const [response, setResponse] = useState({}); // the raw load body, for columns
  const [confirming, setConfirming] = useState(null); // id of the row asking "sure?"

  // Held in a ref so an inline onLoad doesn't make every render refetch.
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch(loadUrl);
      const data = await res.json();
      onLoadRef.current?.(data);
      setItems(Array.isArray(data.items) ? data.items : []);
      setCanDelete(!!data.canDelete);
      setSubtitle(typeof data.subtitle === 'string' ? data.subtitle : '');
      setResponse(data && typeof data === 'object' ? data : {});
      if (data.error) setError(data.error);
    } catch {
      setError('Could not load.');
      setItems([]);
    }
  }, [loadUrl, reloadKey]);

  useEffect(() => { load(); }, [load]);

  // Merge a saved change into one row, so an editable column can reflect what
  // the server stored without reloading the whole list.
  const patch = useCallback((id, fields) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...fields } : i)));
  }, []);

  const helpers = { data: response, patch, setError };
  const fixedLayout = columns.some(c => c.width != null);

  async function remove(item) {
    setConfirming(null);
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

      {(summary && items ? summary(items) : subtitle) ? (
        <div style={{ color: '#aaa', marginBottom: 8, fontSize: 12, wordBreak: 'break-word' }}>
          {summary && items ? summary(items) : subtitle}
        </div>
      ) : null}

      {items === null ? (
        <div style={{ color: '#888', padding: '12px 0' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ color: '#888', padding: '12px 0' }}>{emptyText}</div>
      ) : filter && !items.some(filter) ? (
        <div style={{ color: '#888', padding: '12px 0' }}>{filteredText}</div>
      ) : (
        // A column may give a `width`; when any does, the table lays out from
        // the header alone (table-layout: fixed), so no row's content can move
        // the columns — not even a row swapped for its delete confirmation.
        <table style={{
          width: '100%', borderCollapse: 'collapse', fontSize: 13,
          tableLayout: fixedLayout ? 'fixed' : 'auto',
        }}>
          <thead>
            <tr>
              {columns.map(c => (
                <th
                  key={c.label}
                  style={{ textAlign: 'left', borderBottom: '1px solid #333', padding: '4px 8px', color: '#aaa', fontWeight: 600, width: c.width }}
                >
                  {c.label}
                </th>
              ))}
              {canDelete ? <th style={{ borderBottom: '1px solid #333', width: fixedLayout ? 76 : undefined }}></th> : null}
            </tr>
          </thead>
          <tbody>
            {(filter ? items.filter(filter) : items).map(item => (
              confirming === item.id ? (
                // The confirmation takes the whole row, rather than growing the
                // delete cell: the question names the row, so nothing is lost,
                // and the other rows keep their columns where they were.
                <tr key={item.id} style={{ background: 'rgba(120, 30, 30, 0.18)' }}>
                  <td
                    colSpan={columns.length + 1}
                    style={{ padding: '5px 8px', borderBottom: '1px solid #232323', color: '#ddd' }}
                  >
                    {/* Question reads from the left like the row it replaced;
                        the buttons stay put on the right however long it is. */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>{confirmText(item)}</span>
                      <span style={{ flex: 'none', display: 'flex', gap: 6 }}>
                        <button onClick={() => remove(item)} style={{ ...rowBtn, borderColor: '#5a2a2a', color: '#f77' }}>Yes</button>
                        <button onClick={() => setConfirming(null)} style={{ ...rowBtn, borderColor: '#3a3a3a', color: '#aaa' }}>No</button>
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
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
                  <td style={{ padding: '5px 8px', borderBottom: '1px solid #232323', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => (confirmText ? setConfirming(item.id) : remove(item))}
                      style={{ ...rowBtn, borderColor: '#5a2a2a', color: '#c55' }}
                    >
                      {deleteLabel}
                    </button>
                  </td>
                ) : null}
              </tr>
              )
            ))}
          </tbody>
        </table>
      )}
    </DraggableWindow>
  );
}
