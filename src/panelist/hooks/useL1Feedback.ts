import { useState, useCallback } from "react";

/**
 * Type definition for L1 feedback data returned from API
 */
export type L1FeedbackData = {
  panelId: string;
  panelistName: string;
  panelistEmail: string;
  role: string;
  decision: string;
  feedback: string;
  submittedAt: string | null;
};

/**
 * Hook for managing L1 feedback viewing for L2 panelists
 *
 * Manages the expansion state, fetching, and caching of L1 feedback data.
 * L2 panelists can view L1 feedback for context when providing their own feedback.
 *
 * Features:
 * - Accordion expansion/collapse per interview
 * - Lazy loading: fetches only when expanded
 * - Caching: fetches only once per candidate
 * - Loading state tracking per interview
 * - Error handling with console logging
 */
export function useL1Feedback() {
  // Accordion expansion state keyed by panelId
  const [expandedFeedbacks, setExpandedFeedbacks] = useState<
    Record<string, boolean>
  >({});

  // Fetched L1 feedback data keyed by panelId
  const [l1FeedbacksForCandidate, setL1FeedbacksForCandidate] = useState<
    Record<string, L1FeedbackData[]>
  >({});

  // Loading state keyed by panelId
  const [loadingL1Feedbacks, setLoadingL1Feedbacks] = useState<
    Record<string, boolean>
  >({});

  /**
   * Fetch L1 feedback for a candidate
   *
   * Only fetches if not already cached. Updates loading state during fetch.
   *
   * @param candidateEmail - Email of the candidate
   * @param panelId - Panel ID to key the feedback data
   */
  const fetchL1FeedbackForCandidate = useCallback(
    async (candidateEmail: string, panelId: string) => {
      // Skip if already fetched (caching)
      if (l1FeedbacksForCandidate[panelId]) return;

      setLoadingL1Feedbacks((prev) => ({ ...prev, [panelId]: true }));
      try {
        const res = await fetch(
          `/api/panelist/l1-feedback?email=${encodeURIComponent(candidateEmail)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setL1FeedbacksForCandidate((prev) => ({
            ...prev,
            [panelId]: data.feedbacks,
          }));
        }
      } catch (err) {
        console.error("Failed to load L1 feedbacks:", err);
      } finally {
        setLoadingL1Feedbacks((prev) => ({ ...prev, [panelId]: false }));
      }
    },
    [l1FeedbacksForCandidate],
  );

  /**
   * Toggle feedback expansion and conditionally fetch L1 feedback
   *
   * When expanding (and isL2Role + candidateEmail provided), triggers lazy fetch.
   * When collapsing, just toggles state without fetching.
   *
   * @param panelId - Panel ID to toggle
   * @param isL2Role - Whether the interview is an L2 role
   * @param candidateEmail - Email of the candidate (for fetching)
   */
  const toggleFeedbackExpansion = useCallback(
    (panelId: string, isL2Role: boolean, candidateEmail: string) => {
      setExpandedFeedbacks((prev) => {
        const nextState = !prev[panelId];
        if (nextState && isL2Role && candidateEmail) {
          fetchL1FeedbackForCandidate(candidateEmail, panelId);
        }
        return { ...prev, [panelId]: nextState };
      });
    },
    [fetchL1FeedbackForCandidate],
  );

  return {
    expandedFeedbacks,
    l1FeedbacksForCandidate,
    loadingL1Feedbacks,
    toggleFeedbackExpansion,
  };
}
