import { useState, useCallback } from "react";
import { PanelistInterview, Interview, InterviewPanel } from "@server/lib/db";

/**
 * Hook for managing panelist interviews and pending slot requests
 *
 * Fetches both interviews and requests together since they're related data
 * and fetched in parallel in the same API calls.
 */
export function usePanelistInterviews(
  initialInterviews: PanelistInterview[],
  initialRequests: { interview: Interview; panel: InterviewPanel }[]
) {
  const [interviews, setInterviews] =
    useState<PanelistInterview[]>(initialInterviews);
  const [pendingRequests, setPendingRequests] = useState<
    { interview: Interview; panel: InterviewPanel }[]
  >(initialRequests);

  const refreshInterviews = useCallback(async () => {
    try {
      const [interviewsRes, requestsRes] = await Promise.all([
        fetch("/api/panelist/interviews"),
        fetch("/api/panelist/requests"),
      ]);
      if (interviewsRes.ok)
        setInterviews(
          (await interviewsRes.ok) ? await interviewsRes.json() : [],
        );
      if (requestsRes.ok)
        setPendingRequests(
          (await requestsRes.ok) ? await requestsRes.json() : [],
        );
    } catch (err) {
      console.error("Failed to refresh interviews or requests", err);
    }
  }, []);

  return {
    interviews,
    setInterviews,
    pendingRequests,
    setPendingRequests,
    refreshInterviews,
  };
}
