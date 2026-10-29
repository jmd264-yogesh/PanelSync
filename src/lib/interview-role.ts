export type HiringType = "CAMPUS" | "LATERAL";
export type InterviewRound = "L1" | "L2" | "GENERAL";

/**
 * The round is only stored as the leading token of the free-text `interviews.role`
 * ("L1 Interview - <college>", "L2 - <job title>", "L1 - Round 1 - <position>"), so it
 * is read from that prefix — never by searching the whole string. A substring test also
 * matches a position title like "L2 Support Engineer" or a college name, and used to give
 * different answers in different files. Roles without a prefix (older data) fall back to a
 * whole-word match so "L1" / "L2" still resolve.
 */
export function parseRound(role: string): InterviewRound {
  const stripped = role.replace(/^\s*lateral\s*-\s*/i, "");
  const prefix = stripped.match(/^\s*(L1|L2)\b/i);
  if (prefix) return prefix[1].toUpperCase() as InterviewRound;
  if (/\bL1\b/i.test(stripped)) return "L1";
  if (/\bL2\b/i.test(stripped)) return "L2";
  return "GENERAL";
}

/**
 * `hiringType` is the interview's stored CAMPUS/LATERAL value and should always be passed
 * when the interview is at hand. The role-prefix guess is only a fallback for callers that
 * have just the string — no code writes a "LATERAL - " prefix, so it would otherwise
 * classify every lateral interview as campus.
 */
export function getInterviewInfo(role: string, hiringType?: HiringType | null) {
  const resolvedHiringType: HiringType =
    hiringType ?? (role.toUpperCase().startsWith("LATERAL - ") ? "LATERAL" : "CAMPUS");

  const round = parseRound(role);

  return {
    hiringType: resolvedHiringType,
    round,

    isCampus: resolvedHiringType === "CAMPUS",
    isLateral: resolvedHiringType === "LATERAL",

    isL1: round === "L1",
    isL2: round === "L2",
  };
}

/**
 * Who may see what across rounds. The hiring process is one-directional: the L2 panel
 * builds on the L1 panel's feedback, but an L1 panelist must never learn how L2 went
 * (it would bias a later re-interview and leaks the candidate's outcome). Every route
 * that returns another round's data for a candidate goes through this.
 */
export function canViewPriorRound(viewerRound: InterviewRound, targetRound: InterviewRound): boolean {
  return viewerRound === "L2" && targetRound === "L1";
}

/**
 * The outcome a panelist of `round` is allowed to see for a candidate. The stored
 * candidate outcome spans every round (PASSED_L2 / SELECTED / REJECTED-at-L2 ...), so an
 * L1 panelist is shown only what L1 itself decided, never later-round results.
 */
export function outcomeVisibleToRound(
  round: InterviewRound,
  candidateOutcome: string | null,
  ownPanelDecision: string | null,
): string | null {
  if (round !== "L1") return candidateOutcome;
  if (!candidateOutcome || candidateOutcome === "PENDING") return candidateOutcome;
  if (candidateOutcome === "REJECTED") return ownPanelDecision === "REJECTED" ? "REJECTED" : "PENDING";
  // PASSED_L1, PASSED_L2, SELECTED ... — everything past L1 collapses to "passed L1".
  return "PASSED_L1";
}
