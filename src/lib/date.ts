import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

/**
 * Formats a date/timestamp to relative time (e.g. "a few seconds ago", "5 minutes ago", "yesterday")
 */
export function formatRelativeTime(date: string | Date | number): string {
  if (!date) return "";
  return dayjs(date).fromNow();
}

/**
 * Formats a date with short month (e.g. "9 Sep 2026")
 */
export function formatDate(date: string | Date | number): string {
  if (!date) return "";
  return dayjs(date).format("D MMM YYYY");
}

/**
 * Formats a date with time (e.g. "03:45 PM")
 */
export function formatTime(date: string | Date | number): string {
  if (!date) return "";
  return dayjs(date).format("h:mm A");
}

export { dayjs };
export default dayjs;
