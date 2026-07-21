import { useState, useCallback } from "react";
import { PanelistInterview } from "@server/lib/db";
import {
  L1Rating,
  L2Rating,
  GeneralRating,
  LateralRating,
} from "./useFeedbackState";

/**
 * Hook for managing feedback submission
 *
 * Handles validation, API submission, loading states, and error handling
 * for all feedback types (L1, L2, General, Lateral).
 *
 * Submission Flow:
 * 1. Validate ratings (all must be non-zero)
 * 2. Build feedback JSON payload (type-specific structure)
 * 3. POST to /api/panelist/feedback/{panelId}
 * 4. Handle success/error
 * 5. Refresh interviews on success
 * 6. Exit editing mode on success
 *
 * Special Case - L1 PASSED:
 * Caller should check if submission is L1 with PASSED decision and show
 * confirmation dialog before calling performFeedbackSubmit.
 */
export function useFeedbackSubmission(
  l1Ratings: Record<string, L1Rating>,
  l2Ratings: Record<string, L2Rating>,
  genRatings: Record<string, GeneralRating>,
  lateralRatings: Record<string, LateralRating>,
  setIsEditing: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  refreshInterviews: () => Promise<void>,
  setPendingL1PassConfirm: React.Dispatch<
    React.SetStateAction<PanelistInterview | null>
  >,
) {
  // Submission loading state keyed by panelId
  const [submittingFeedback, setSubmittingFeedback] = useState<
    Record<string, boolean>
  >({});

  // Submission error messages keyed by panelId
  const [feedbackError, setFeedbackError] = useState<
    Record<string, string | null>
  >({});

  /**
   * Submit feedback with validation and API call
   *
   * Validates ratings, builds type-specific JSON payload, submits to API,
   * and handles success/error cases.
   *
   * @param interview - Interview to submit feedback for
   * @param decision - PASSED or REJECTED
   */
  const performFeedbackSubmit = useCallback(
    async (interview: PanelistInterview, decision: "PASSED" | "REJECTED") => {
      const roleLower = interview.role.toLowerCase();
      const isL1Role = roleLower.includes("l1");
      const isL2Role = roleLower.includes("l2");
      const isLateralRole = interview.hiringType === "LATERAL";

      setSubmittingFeedback((prev) => ({
        ...prev,
        [interview.panelId]: true,
      }));
      setFeedbackError((prev) => ({ ...prev, [interview.panelId]: null }));

      let feedbackString = "";

      try {
        // Build feedback payload based on interview type
        if (isL1Role) {
          const current = l1Ratings[interview.panelId] || {
            coding: 0,
            communication: 0,
            fundamentals: 0,
            codingNotes: "",
            commNotes: "",
            fundNotes: "",
            comments: "",
          };

          // Validation: all ratings must be non-zero
          if (
            current.coding === 0 ||
            current.communication === 0 ||
            current.fundamentals === 0
          ) {
            throw new Error(
              "Please provide ratings for all evaluation metrics.",
            );
          }

          feedbackString = JSON.stringify({
            type: "L1",
            scores: {
              coding: current.coding,
              communication: current.communication,
              fundamentals: current.fundamentals,
            },
            notes: {
              codingNotes: current.codingNotes,
              communicationNotes: current.commNotes,
              fundamentalsNotes: current.fundNotes,
            },
            comments: current.comments,
          });
        } else if (isL2Role) {
          const current = l2Ratings[interview.panelId] || {
            design: 0,
            depth: 0,
            leadership: 0,
            fit: 0,
            designNotes: "",
            depthNotes: "",
            leadNotes: "",
            fitNotes: "",
            comments: "",
          };

          // Validation: all ratings must be non-zero
          if (
            current.design === 0 ||
            current.depth === 0 ||
            current.leadership === 0 ||
            current.fit === 0
          ) {
            throw new Error(
              "Please provide ratings for all evaluation metrics.",
            );
          }

          feedbackString = JSON.stringify({
            type: "L2",
            scores: {
              systemDesign: current.design,
              technicalDepth: current.depth,
              leadership: current.leadership,
              culturalFit: current.fit,
            },
            notes: {
              systemDesignNotes: current.designNotes,
              technicalDepthNotes: current.depthNotes,
              leadershipNotes: current.leadNotes,
              culturalFitNotes: current.fitNotes,
            },
            comments: current.comments,
          });
        } else if (isLateralRole) {
          const current = lateralRatings[interview.panelId] || {
            technical: 0,
            communication: 0,
            collaboration: 0,
            techNotes: "",
            commNotes: "",
            collabNotes: "",
            comments: "",
          };

          // Validation: all ratings must be non-zero
          if (
            current.technical === 0 ||
            current.communication === 0 ||
            current.collaboration === 0
          ) {
            throw new Error(
              "Please provide ratings for all evaluation metrics.",
            );
          }

          feedbackString = JSON.stringify({
            type: "LATERAL",
            scores: {
              technical: current.technical,
              communication: current.communication,
              collaboration: current.collaboration,
            },
            notes: {
              technicalNotes: current.techNotes,
              communicationNotes: current.commNotes,
              collaborationNotes: current.collabNotes,
            },
            comments: current.comments,
          });
        } else {
          // General interview
          const current = genRatings[interview.panelId] || {
            technical: 0,
            communication: 0,
            collaboration: 0,
            techNotes: "",
            commNotes: "",
            collabNotes: "",
            comments: "",
          };

          // Validation: all ratings must be non-zero
          if (
            current.technical === 0 ||
            current.communication === 0 ||
            current.collaboration === 0
          ) {
            throw new Error(
              "Please provide ratings for all evaluation metrics.",
            );
          }

          feedbackString = JSON.stringify({
            type: "General",
            scores: {
              technical: current.technical,
              communication: current.communication,
              collaboration: current.collaboration,
            },
            notes: {
              technicalNotes: current.techNotes,
              communicationNotes: current.commNotes,
              collaborationNotes: current.collabNotes,
            },
            comments: current.comments,
          });
        }

        // Submit to API
        const res = await fetch(
          `/api/panelist/feedback/${interview.panelId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ feedback: feedbackString, decision }),
          },
        );

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to submit feedback");
        }

        // Success: exit editing mode and refresh data
        setIsEditing((prev) => ({ ...prev, [interview.panelId]: false }));
        await refreshInterviews();
      } catch (err) {
        // Error: store error message
        const errorMessage =
          err instanceof Error ? err.message : "Failed to submit";
        setFeedbackError((prev) => ({
          ...prev,
          [interview.panelId]: errorMessage,
        }));
      } finally {
        // Always clear loading state
        setSubmittingFeedback((prev) => ({
          ...prev,
          [interview.panelId]: false,
        }));
      }
    },
    [
      l1Ratings,
      l2Ratings,
      genRatings,
      lateralRatings,
      setIsEditing,
      refreshInterviews,
    ],
  );

  /**
   * Handle feedback submission with L1 pass confirmation check
   *
   * For L1 PASSED submissions, sets pendingL1PassConfirm to show dialog.
   * For all other cases, calls performFeedbackSubmit directly.
   *
   * @param interview - Interview to submit feedback for
   * @param decision - PASSED or REJECTED
   */
  const handleFeedbackSubmit = useCallback(
    (interview: PanelistInterview, decision: "PASSED" | "REJECTED") => {
      const roleLower = interview.role.toLowerCase();
      const isL1Role = roleLower.includes("l1");

      // L1 PASSED requires confirmation
      if (isL1Role && decision === "PASSED") {
        setPendingL1PassConfirm(interview);
        return;
      }

      // All other cases: submit directly
      performFeedbackSubmit(interview, decision);
    },
    [performFeedbackSubmit, setPendingL1PassConfirm],
  );

  return {
    submittingFeedback,
    feedbackError,
    performFeedbackSubmit,
    handleFeedbackSubmit,
  };
}
