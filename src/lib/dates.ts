export const JAPAN_TIME_ZONE = "Asia/Tokyo";
export const DAY_MS = 86_400_000;
export const DATE_RANGE_INPUT_HINT = "Use YYYY-MM-DD and make sure the end date is on or after the start date.";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function jstParts(date: Date): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAPAN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: byType.year,
    month: byType.month,
    day: byType.day,
  };
}

export function todayJstIsoDate(now = new Date()): string {
  const parts = jstParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function jstDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00+09:00`);
}

export function isoDateInJst(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string" && DATE_ONLY_RE.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = jstParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatIsoDateJst(value: string | Date | null | undefined): string {
  return isoDateInJst(value) ?? (typeof value === "string" ? value : "N/A");
}

export function formatMonthDayJst(value: string | Date | null | undefined): string {
  const dateOnly = isoDateInJst(value);
  if (!dateOnly) return typeof value === "string" ? value : "N/A";
  return `${Number(dateOnly.slice(5, 7))}/${Number(dateOnly.slice(8, 10))}`;
}

export function parseDateInputJst(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = DATE_ONLY_RE.test(value) ? jstDate(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseDateRangeInputJst(
  start: string | null | undefined,
  end: string | null | undefined,
): { startDate: Date; endDate: Date } | null {
  const startDate = parseDateInputJst(start);
  const endDate = parseDateInputJst(end);
  if (!startDate || !endDate || endDate < startDate) return null;
  return { startDate, endDate };
}

export function daysFromTodayJst(value: string | Date | null | undefined, now = new Date()): number | null {
  const dateOnly = isoDateInJst(value);
  if (!dateOnly) return null;
  return Math.round((jstDate(dateOnly).getTime() - jstDate(todayJstIsoDate(now)).getTime()) / DAY_MS);
}

export function monthFromDateInputJst(value: string | null | undefined): number | null {
  const date = parseDateInputJst(value);
  if (!date) return null;
  return Number(new Intl.DateTimeFormat("en", { timeZone: JAPAN_TIME_ZONE, month: "numeric" }).format(date));
}

export function currentJstMonth(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en", { timeZone: JAPAN_TIME_ZONE, month: "numeric" }).format(now));
}

export function currentJstYear(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en", { timeZone: JAPAN_TIME_ZONE, year: "numeric" }).format(now));
}

export function isoYearInJst(value: string | Date | null | undefined): number | null {
  const dateOnly = isoDateInJst(value);
  return dateOnly ? Number(dateOnly.slice(0, 4)) : null;
}
