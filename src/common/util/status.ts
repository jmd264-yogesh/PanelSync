import { Interview } from "@server/lib/db";

/** Get CSS class for interview status badge. */
export function getStatusClass(status: Interview["status"]): string {
  if (status === "SCHEDULED" || status === "COLLECTED") return "confirmed";
  return "pending";
}
