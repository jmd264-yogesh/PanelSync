"use client";

import React from "react";
import { PanelistInterview } from "@server/lib/db";
import { FeedbackHeader } from "./FeedbackHeader";
import { L1FeedbackScores } from "./L1FeedbackScores";
import { L2FeedbackScores } from "./L2FeedbackScores";
import { GeneralFeedbackScores } from "./GeneralFeedbackScores";
import { LateralFeedbackScores } from "./LateralFeedbackScores";

type SubmittedFeedbackDisplayProps = {
  interview: PanelistInterview;
  isEditing: boolean;
  startEditing: (interview: PanelistInterview) => void;
};

type ParsedFeedback = {
  type: "L1" | "L2" | "General" | "LATERAL";
  scores?: any;
  notes?: any;
  comments?: string;
};

export const SubmittedFeedbackDisplay: React.FC<
  SubmittedFeedbackDisplayProps
> = ({ interview, isEditing, startEditing }) => {
  // Don't render if editing or no feedback submitted
  if (isEditing || !interview.panelFeedback) {
    return null;
  }

  // Parse JSON feedback
  let parsed: ParsedFeedback | null = null;
  let isJson = false;
  try {
    if (interview.panelFeedback.startsWith("{")) {
      parsed = JSON.parse(interview.panelFeedback);
      isJson = true;
    }
  } catch (e) {
    // Parsing failed, will fall back to legacy string display
  }

  // Calculate edit time remaining
  let editTimeRemaining = "";
  let canEdit = false;
  let isL1PassLocked = false;

  if (interview.panelSubmittedAt) {
    const submittedDate = new Date(interview.panelSubmittedAt);
    // eslint-disable-next-line react-hooks/purity
    const elapsedMs = Date.now() - submittedDate.getTime();
    const twoHoursMs = 2 * 60 * 60 * 1000;
    const remainingMs = twoHoursMs - elapsedMs;

    if (remainingMs > 0) {
      canEdit = true;
      const remainingMins = Math.ceil(remainingMs / (60 * 1000));
      editTimeRemaining = `${remainingMins} min remaining`;
    }
  }

  // L1 Pass locking check
  if (
    interview.role.toLowerCase().includes("l1") &&
    interview.panelDecision === "PASSED"
  ) {
    canEdit = false;
    isL1PassLocked = true;
  }

  // JSON feedback display
  if (isJson && parsed) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem",
        }}
      >
        <FeedbackHeader
          type={parsed.type || "Interview"}
          decision={interview.panelDecision as "PASSED" | "REJECTED"}
          isL1PassLocked={isL1PassLocked}
          canEdit={canEdit}
          editTimeRemaining={editTimeRemaining}
          onEditClick={() => startEditing(interview)}
        />

        {/* Type-specific scores */}
        {parsed.type === "L1" && (
          <L1FeedbackScores
            scores={parsed.scores || {}}
            notes={parsed.notes || {}}
          />
        )}

        {parsed.type === "L2" && (
          <L2FeedbackScores
            scores={parsed.scores || {}}
            notes={parsed.notes || {}}
          />
        )}

        {parsed.type === "General" && (
          <GeneralFeedbackScores
            scores={parsed.scores || {}}
            notes={parsed.notes || {}}
          />
        )}

        {parsed.type === "LATERAL" && (
          <LateralFeedbackScores
            scores={parsed.scores || {}}
            notes={parsed.notes || {}}
          />
        )}

        {/* Overall summary notes */}
        {parsed.comments && (
          <div
            style={{
              borderTop: "1px solid var(--border-glass)",
              paddingTop: "0.5rem",
              marginTop: "0.25rem",
            }}
          >
            <div
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                marginBottom: "2px",
              }}
            >
              Overall Summary Notes
            </div>
            <p
              style={{
                fontSize: "0.78rem",
                color: "var(--text-muted)",
                margin: 0,
                lineHeight: 1.45,
              }}
            >
              {parsed.comments}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Fallback to legacy string feedback
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.55rem",
      }}
    >
      <FeedbackHeader
        type="Interview"
        decision={interview.panelDecision as "PASSED" | "REJECTED"}
        isL1PassLocked={isL1PassLocked}
        canEdit={canEdit}
        editTimeRemaining={editTimeRemaining}
        onEditClick={() => startEditing(interview)}
      />
      {interview.panelFeedback && (
        <p
          style={{
            fontSize: "0.78rem",
            color: "var(--text-muted)",
            margin: 0,
            lineHeight: 1.45,
          }}
        >
          {interview.panelFeedback}
        </p>
      )}
    </div>
  );
};
