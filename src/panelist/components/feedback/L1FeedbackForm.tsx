"use client";

import React from "react";
import { RatingField } from "./components/RatingField";
import { FeedbackComments } from "./components/FeedbackComments";
import { FeedbackActions } from "./components/FeedbackActions";
import { L1WarningBanner } from "./components/L1WarningBanner";

export type L1RatingState = {
  coding: number;
  communication: number;
  fundamentals: number;
  codingNotes: string;
  commNotes: string;
  fundNotes: string;
  comments: string;
};

type L1FeedbackFormProps = {
  panelId: string;
  current: L1RatingState;
  updateL1: (field: keyof L1RatingState, val: any) => void;
  isSubmitting: boolean;
  feedbackError?: string;
  isEditing: boolean;
  onSubmit: (decision: "PASSED" | "REJECTED") => void;
  onCancelEdit: () => void;
};

export const L1FeedbackForm: React.FC<L1FeedbackFormProps> = ({
  panelId: _panelId,
  current,
  updateL1,
  isSubmitting,
  feedbackError,
  isEditing,
  onSubmit,
  onCancelEdit,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <div
        style={{
          fontSize: "0.8rem",
          color: "var(--text-muted)",
          fontStyle: "italic",
          marginBottom: "0.25rem",
        }}
      >
        Evaluating L1 Screening Round Metrics:
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <RatingField
          label="Coding & Problem Solving"
          rating={current.coding}
          notes={current.codingNotes}
          placeholder="Specific coding questions, algorithmic depth, edge cases..."
          onRatingChange={(r) => updateL1("coding", r)}
          onNotesChange={(v) => updateL1("codingNotes", v)}
          disabled={isSubmitting}
        />

        <RatingField
          label="Technical Communication"
          rating={current.communication}
          notes={current.commNotes}
          placeholder="Explanation clarity, technical dialogue, structure..."
          onRatingChange={(r) => updateL1("communication", r)}
          onNotesChange={(v) => updateL1("commNotes", v)}
          disabled={isSubmitting}
        />

        <RatingField
          label="CS Fundamentals"
          rating={current.fundamentals}
          notes={current.fundNotes}
          placeholder="Basic DSA, runtime complexity, OS/memory/networks..."
          onRatingChange={(r) => updateL1("fundamentals", r)}
          onNotesChange={(v) => updateL1("fundNotes", v)}
          disabled={isSubmitting}
        />
      </div>

      <FeedbackComments
        value={current.comments}
        onChange={(v) => updateL1("comments", v)}
        disabled={isSubmitting}
        placeholder="Summary comments of L1 performance..."
      />

      {/* Error Display */}
      {feedbackError && (
        <p
          style={{
            color: "#ef4444",
            fontSize: "0.78rem",
          }}
        >
          {feedbackError}
        </p>
      )}

      <L1WarningBanner />

      <FeedbackActions
        onPass={() => onSubmit("PASSED")}
        onReject={() => onSubmit("REJECTED")}
        onCancelEdit={onCancelEdit}
        isSubmitting={isSubmitting}
        isEditing={isEditing}
        passLabel="Submit & Pass L1"
      />
    </div>
  );
};
