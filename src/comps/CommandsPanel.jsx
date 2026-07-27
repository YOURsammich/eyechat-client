import { useState } from 'react';
import ManagerPanel from './ManagerPanel';
import { TRUST_LEVELS, trustLabel } from './trustLevels';

// The level a command currently requires. An admin gets a picker; everyone else
// gets the same value as text — the point of the list for a normal user is
// knowing what to ask to be trusted for, not changing it.
function TrustCell({ command, helpers }) {
  const [saving, setSaving] = useState(false);

  // `lockable` is false for /lock_command itself, which the server refuses to
  // move; rendering a picker that can only fail would be a lie.
  const editable = helpers.data.canEdit && command.lockable;

  if (!editable) {
    return (
      <span style={{ color: command.overridden ? '#d9b45b' : undefined }}>
        {trustLabel(command.trust)}
      </span>
    );
  }

  async function save(value) {
    // Picking the level the command was written with clears the lock rather than
    // storing a no-op override, so the row stops reading as changed. The picker
    // only ever says what a command requires — "default" is not a level anyone
    // has to think about here.
    const level = value !== 'default' && Number(value) === command.defaultTrust ? 'default' : value;

    setSaving(true);
    helpers.setError('');
    try {
      const res = await fetch('/channel/commands/trust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: command.name, level }),
      });
      const data = await res.json();
      if (data.error) helpers.setError(data.error);
      else if (data.command) helpers.patch(command.name, data.command);
    } catch {
      helpers.setError('Could not save.');
    }
    setSaving(false);
  }

  return (
    <select
      // Whatever the command requires right now, default or not. null is a
      // command with no requirement at all, which only the 'anyone' option below
      // can represent.
      value={command.trust == null ? 'default' : String(command.trust)}
      disabled={saving}
      onChange={(e) => save(e.target.value)}
      style={{
        background: '#222', color: command.overridden ? '#d9b45b' : '#eee',
        border: '1px solid #3a3a3a', borderRadius: 4, padding: '2px 4px', fontSize: 12,
      }}
    >
      {command.defaultTrust == null ? <option value='default'>anyone</option> : null}
      {TRUST_LEVELS.map(level => (
        <option key={level} value={level}>{trustLabel(level)}</option>
      ))}
    </select>
  );
}

// Every command and the trust level it requires, in the same draggable shell as
// the ban list. Admins can retune a level in place; the same change is available
// as /lock_command <command> <level>.
export default function CommandsPanel({ onClose }) {
  return (
    <ManagerPanel
      title='Commands — Trust Levels'
      onClose={onClose}
      loadUrl='/channel/commands'
      emptyText='No commands.'
      width={520}
      columns={[
        { label: 'Command', render: (c) => '/' + c.name },
        { label: 'Requires', render: (c, helpers) => <TrustCell command={c} helpers={helpers} /> },
      ]}
    />
  );
}
