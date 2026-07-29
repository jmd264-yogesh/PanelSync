"use client";

import React from "react";
import { RatingField } from "./components/RatingField";
import { FeedbackComments } from "./components/FeedbackComments";
import { FeedbackActions } from "./components/FeedbackActions";

export type L2RatingState = {
  design: number;
  depth: number;
  leadership: number;
  fit: number;
  designNotes: string;
  depthNotes: string;
  leadNotes: string;
  fitNotes: string;
  comments: string;
};

type L2FeedbackFormProps = {
  panelId: string;
  current: L2RatingState;
  updateL2: (field: keyof L2RatingState, val: any) => void;
  isSubmitting: boolean;
  feedbackError?: string;
  isEditing: boolean;
  onSubmit: (decision: "PASSED" | "REJECTED") => void;
  onCancelEdit: () => void;
};

export const L2FeedbackForm: React.FC<L2FeedbackFormProps> = ({
  panelId: _panelId,
  current,
  updateL2,
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
        Evaluating L2 System Design &amp; Fit Metrics:
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <RatingField
          label="System Design & Scalability"
          rating={current.design}
          notes={current.designNotes}
          placeholder="Architecture, API design, trade-offs, database choices..."
          onRatingChange={(r) => updateL2("design", r)}
          onNotesChange={(v) => updateL2("designNotes", v)}
          disabled={isSubmitting}
        />

        <RatingField
          label="Technical Depth & Experience"
          rating={current.depth}
          notes={current.depthNotes}
          placeholder="Past project complexity, deep tech troubleshooting, domain knowledge..."
          onRatingChange={(r) => updateL2("depth", r)}
          onNotesChange={(v) => updateL2("depthNotes", v)}
          disabled={isSubmitting}
        />

        <RatingField
          label="Leadership & Ownership"
          rating={current.leadership}
          notes={current.leadNotes}
          placeholder="Ownership mindset, problem driving, initiative, peer support..."
          onRatingChange={(r) => updateL2("leadership", r)}
          onNotesChange={(v) => updateL2("leadNotes", v)}
          disabled={isSubmitting}
        />

        <RatingField
          label="Cultural Fit & MS Values"
          rating={current.fit}
          notes={current.fitNotes}
          placeholder="Growth mindset, customer obsession, inclusion, alignment..."
          onRatingChange={(r) => updateL2("fit", r)}
          onNotesChange={(v) => updateL2("fitNotes", v)}
          disabled={isSubmitting}
        />
      </div>

      <FeedbackComments
        value={current.comments}
        onChange={(v) => updateL2("comments", v)}
        disabled={isSubmitting}
        placeholder="Summary comments of L2 performance..."
      />

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

      <FeedbackActions
        onPass={() => onSubmit("PASSED")}
        onReject={() => onSubmit("REJECTED")}
        onCancelEdit={onCancelEdit}
        isSubmitting={isSubmitting}
        isEditing={isEditing}
        passLabel="Submit & Pass L2"
        passColor="#c084fc"
        passBg="rgba(124,58,237,0.15)"
        passBorder="1px solid rgba(124,58,237,0.3)"
      />
    </div>
  );
};
