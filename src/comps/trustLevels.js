// Trust levels, lowest number = most privileged (see the /trust command). 3 has
// no name of its own — it sits between regular and moderator. Shared by the
// command-lock panel and the user-role panel so both name a level the same way.
export const TRUST_LABELS = { 0: 'owner', 1: 'admin', 2: 'moderator', 4: 'regular', 5: 'guest' };
export const TRUST_LEVELS = [0, 1, 2, 3, 4, 5];

export function trustLabel(level) {
  if (level == null) return 'anyone';
  return TRUST_LABELS[level] ? `${level} — ${TRUST_LABELS[level]}` : String(level);
}
