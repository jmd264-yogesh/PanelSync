import { useMemo } from "react";
import { PanelistInterview, Interview, InterviewPanel, Drive } from "@server/lib/db";

// Helper: Extract college name from role string (e.g., "L1 Interview - IIT Bombay" -> "IIT Bombay")
function getCollegeNameFromRole(role: string): string {
  const parts = role.split(" - ");
  return parts.length > 1 ? parts[1].trim() : "";
}

// Helper: Check if interview/request is from a specific drive
function isFromActiveDrive(role: string, activeDrive: Drive | null): boolean {
  if (!activeDrive || !activeDrive.collegeName) return false;
  const college = getCollegeNameFromRole(role);
  return college.toLowerCase() === activeDrive.collegeName.toLowerCase();
}

/**
 * Hook for filtering, sorting, and counting panelist interviews and requests
 *
 * Applies complex multi-stage filtering (hiring type, active drive, date, round)
 * and sorting logic to interviews and pending requests. Also calculates tab counts
 * for UI badges.
 *
 * Filtering stages:
 * 1. Hiring type filter (CAMPUS vs LATERAL)
 * 2. Active drive filter (if enabled)
 * 3. Date filter (if set)
 * 4. Round filter (L1/L2/ALL)
 *
 * Sorting priorities:
 * - Interviews: pending feedback first, active drive first, chronological
 * - Requests: active drive first, latest first, newest creation first
 */
export function useInterviewSorting(
  interviews: PanelistInterview[],
  pendingRequests: { interview: Interview; panel: InterviewPanel }[],
  activeDrive: Drive | null,
  activeHiringTab: "CAMPUS" | "LATERAL",
  filterActiveDrive: boolean,
  filterDate: string | null,
  activeRoundTab: "ALL" | "L1" | "L2"
) {

  // Stage 1: Filter by hiring type, active drive, and date
  const hiringInterviews = useMemo(() => {
    return interviews.filter((i) => {
      // Hiring type
      if (
        activeHiringTab === "LATERAL"
          ? i.hiringType !== "LATERAL"
          : i.hiringType === "LATERAL"
      ) {
        return false;
      }

      // Campus Active Drive
      if (
        activeHiringTab === "CAMPUS" &&
        filterActiveDrive &&
        activeDrive &&
        !isFromActiveDrive(i.role, activeDrive)
      ) {
        return false;
      }

      // Date
      if (filterDate) {
        if (!i.scheduledSlotStart) return false;

        const d = new Date(i.scheduledSlotStart);
        const localDate = `${d.getFullYear()}-${String(
          d.getMonth() + 1,
        ).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

        if (localDate !== filterDate) {
          return false;
        }
      }

      return true;
    });
  }, [
    interviews,
    activeHiringTab,
    filterActiveDrive,
    activeDrive,
    filterDate,
  ]);

  const hiringRequests = useMemo(() => {
    return pendingRequests.filter((req) => {
      // Hiring type
      if (
        activeHiringTab === "LATERAL"
          ? req.interview.hiringType !== "LATERAL"
          : req.interview.hiringType === "LATERAL"
      ) {
        return false;
      }

      // Campus Active Drive
      if (
        activeHiringTab === "CAMPUS" &&
        filterActiveDrive &&
        activeDrive &&
        !isFromActiveDrive(req.interview.role, activeDrive)
      ) {
        return false;
      }

      // Date
      if (filterDate) {
        const [y, m, d] = filterDate.split("-").map(Number);

        const target = new Date(y, m - 1, d);
        target.setHours(0, 0, 0, 0);

        const start = new Date(req.interview.startDate);
        start.setHours(0, 0, 0, 0);

        const end = new Date(req.interview.endDate);
        end.setHours(23, 59, 59, 999);

        if (!(target >= start && target <= end)) {
          return false;
        }
      }

      return true;
    });
  }, [
    pendingRequests,
    activeHiringTab,
    filterActiveDrive,
    activeDrive,
    filterDate,
  ]);

  // Stage 2: Filter by round (L1/L2/ALL)
  const filteredInterviews = useMemo(() => {
    return hiringInterviews.filter((i) => {
      // Round filter
      if (activeRoundTab === "L1" && !i.role.toLowerCase().includes("l1")) {
        return false;
      }

      if (activeRoundTab === "L2" && !i.role.toLowerCase().includes("l2")) {
        return false;
      }

      return true;
    });
  }, [
    hiringInterviews,
    activeRoundTab,
  ]);

  const filteredRequests = useMemo(() => {
    return hiringRequests.filter((req) => {

      if (
        activeRoundTab === "L1" &&
        !req.interview.role.toLowerCase().includes("l1")
      ) {
        return false;
      }

      if (
        activeRoundTab === "L2" &&
        !req.interview.role.toLowerCase().includes("l2")
      ) {
        return false;
      }

      return true;
    });
  }, [
    hiringRequests,
    activeRoundTab,
  ]);

  // Stage 3: Sort interviews
  // Priority: pending feedback first, active drive first, chronological, alphabetical by college
  const filteredSortedInterviews = useMemo(() => {
    const result = [...filteredInterviews];

    return result.sort((a, b) => {
      // 1. Prioritize pending feedback (where feedback is not yet submitted)
      const aPending = !(a.panelFeedback || a.panelDecision);
      const bPending = !(b.panelFeedback || b.panelDecision);
      if (aPending && !bPending) return -1;
      if (!aPending && bPending) return 1;

      // 2. Active drive first
      const aActive = isFromActiveDrive(a.role, activeDrive);
      const bActive = isFromActiveDrive(b.role, activeDrive);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      // 3. Chronologically by slot timing (earliest scheduledSlotStart first)
      const aTime = new Date(a.scheduledSlotStart).getTime();
      const bTime = new Date(b.scheduledSlotStart).getTime();
      if (aTime !== bTime) {
        return aTime - bTime;
      }

      const aCollege = getCollegeNameFromRole(a.role);
      const bCollege = getCollegeNameFromRole(b.role);
      return aCollege.localeCompare(bCollege);
    });
  }, [filteredInterviews, activeDrive]);

  // Stage 3: Sort pending requests
  // Priority: active drive first, latest startDate first, newest creation first
  const filteredSortedRequests = useMemo(() => {
    const result = [...filteredRequests];

    return result.sort((a, b) => {
      const aActive = isFromActiveDrive(a.interview.role, activeDrive);
      const bActive = isFromActiveDrive(b.interview.role, activeDrive);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      const aStart = new Date(a.interview.startDate).getTime();
      const bStart = new Date(b.interview.startDate).getTime();
      if (aStart !== bStart) {
        return bStart - aStart; // latest first
      }

      const aCreate = a.interview.createdAt
        ? new Date(a.interview.createdAt).getTime()
        : 0;
      const bCreate = b.interview.createdAt
        ? new Date(b.interview.createdAt).getTime()
        : 0;
      return bCreate - aCreate; // latest first
    });
  }, [filteredRequests, activeDrive]);

  // Calculate tab counts for UI badges
  const tabCounts = useMemo(() => {
    // Requests
    const totalRequests = hiringRequests.length;

    const l1Requests = hiringRequests.filter((r) =>
      r.interview.role.toLowerCase().includes("l1"),
    ).length;

    const l2Requests = hiringRequests.filter((r) =>
      r.interview.role.toLowerCase().includes("l2"),
    ).length;

    const lateralRequests = hiringRequests.filter(
      (r) => r.interview.hiringType === "LATERAL",
    ).length;

    const generalRequests =
      totalRequests - l1Requests - l2Requests - lateralRequests;

    // Interviews
    const totalFeedback = hiringInterviews.length;

    const l1Feedback = hiringInterviews.filter((i) =>
      i.role.toLowerCase().includes("l1"),
    ).length;

    const l2Feedback = hiringInterviews.filter((i) =>
      i.role.toLowerCase().includes("l2"),
    ).length;

    const lateralFeedback = hiringInterviews.filter(
      (i) => i.hiringType === "LATERAL",
    ).length;

    const generalFeedback =
      totalFeedback - l1Feedback - l2Feedback - lateralFeedback;

    return {
      requests: {
        total: totalRequests,
        l1: l1Requests,
        l2: l2Requests,
        lateral: lateralRequests,
        general: generalRequests,
      },
      feedback: {
        total: totalFeedback,
        l1: l1Feedback,
        l2: l2Feedback,
        lateral: lateralFeedback,
        general: generalFeedback,
      },
    };
  }, [hiringRequests, hiringInterviews]);

  return {
    filteredSortedInterviews,
    filteredSortedRequests,
    tabCounts,
  };
}
