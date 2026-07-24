/**
 * Generate initials from a name. "Pending Assignment" returns "?".
 */
export function getInitials(name: string): string {
  if (name === "Pending Assignment") return "?";

  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
