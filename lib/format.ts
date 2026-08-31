/**
 * Date formatting.
 *
 * The Neon driver hands back `timestamptz` as a JavaScript Date, not a string,
 * so calling .slice() on one throws at render time. Every date that reaches a
 * component goes through here, and the input type says so.
 */

export type Timestamp = string | Date | null | undefined;

function toDate(value: Timestamp): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** 2026-08-31 */
export function ymd(value: Timestamp): string {
  const d = toDate(value);
  return d ? d.toISOString().slice(0, 10) : "—";
}

/** 08-31, for dense list rails. */
export function mmdd(value: Timestamp): string {
  const d = toDate(value);
  return d ? d.toISOString().slice(5, 10) : "—";
}

/** 3h ago */
export function ago(value: Timestamp): string {
  const d = toDate(value);
  if (!d) return "—";
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return ymd(d);
}
