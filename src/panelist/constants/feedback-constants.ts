/**
 * Feedback status constants for panelist interviews
 */

export const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  PASSED_L1: "Passed L1",
  PASSED_L2: "Passed L2",
  SELECTED: "Selected",
  REJECTED: "Rejected",
};

export const STATUS_BADGE: Record<string, string> = {
  PENDING: "badge-pending",
  PASSED_L1: "badge-info",
  PASSED_L2: "badge-info",
  SELECTED: "badge-success",
  REJECTED: "badge-danger",
};

export const STATUS_COLOR: Record<string, string> = {
  PENDING: "#f59e0b",
  PASSED_L1: "#0ea5e9",
  PASSED_L2: "#7c3aed",
  SELECTED: "#10b981",
  REJECTED: "#ef4444",
};
