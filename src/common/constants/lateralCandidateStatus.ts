/**
 * Lateral candidate status options and badge styling
 */

import { LateralCandidate } from "@server/lib/db";

export const LATERAL_STATUS_OPTIONS: LateralCandidate["status"][] = [
  "NEW",
  "SCREENING",
  "WAITING_FOR_INTERVIEW",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "OFFERED",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
];

export const LATERAL_STATUS_BADGE_STYLE: Record<
  LateralCandidate["status"],
  { bg: string; border: string; color: string }
> = {
  NEW: {
    bg: "rgba(148,163,184,0.1)",
    border: "1px solid rgba(148,163,184,0.25)",
    color: "#94a3b8",
  },
  SCREENING: {
    bg: "rgba(59,130,246,0.1)",
    border: "1px solid rgba(59,130,246,0.25)",
    color: "#3b82f6",
  },
  WAITING_FOR_INTERVIEW: {
    bg: "rgba(245,158,11,0.1)",
    border: "1px solid rgba(245,158,11,0.25)",
    color: "#f59e0b",
  },
  INTERVIEW_SCHEDULED: {
    bg: "rgba(99,102,241,0.1)",
    border: "1px solid rgba(99,102,241,0.25)",
    color: "#6366f1",
  },
  INTERVIEW_COMPLETED: {
    bg: "rgba(14,165,233,0.1)",
    border: "1px solid rgba(14,165,233,0.25)",
    color: "#0ea5e9",
  },
  OFFERED: {
    bg: "rgba(139,92,246,0.1)",
    border: "1px solid rgba(139,92,246,0.25)",
    color: "#8b5cf6",
  },
  HIRED: {
    bg: "rgba(16,185,129,0.1)",
    border: "1px solid rgba(16,185,129,0.25)",
    color: "#10b981",
  },
  REJECTED: {
    bg: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.25)",
    color: "#ef4444",
  },
  WITHDRAWN: {
    bg: "rgba(107,114,128,0.1)",
    border: "1px solid rgba(107,114,128,0.25)",
    color: "#6b7280",
  },
};
