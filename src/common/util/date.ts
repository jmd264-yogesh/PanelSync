/** Format date as "Oct 15" */
export function formatDateShort(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Format date as "Oct 15, 2026" */
export function formatDateLong(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Format time as "02:30 PM" */
export function formatTimeShort(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format date range as "Oct 15 – Oct 20, 2026" */
export function formatDateRange(
  startDate: string | Date,
  endDate: string | Date,
): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (start.toDateString() === end.toDateString()) {
    return formatDateLong(start);
  }

  return `${formatDateShort(start)} – ${formatDateLong(end)}`;
}
