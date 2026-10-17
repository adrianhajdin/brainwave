/** Time and duration formatting shared by the cat and edit screens. */

export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export const fmtDuration = (s: number) =>
  s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`;

/** Parses "HH:MM" into minutes after midnight, or null when it is not a valid time. */
export function parseHHMM(text: string | null): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text?.trim() ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Amsterdam';
  } catch {
    return 'Europe/Amsterdam';
  }
}

export const minuteOfDate = (d: Date) => d.getHours() * 60 + d.getMinutes();

export function dateAtMinute(min: number): Date {
  const d = new Date();
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return d;
}
