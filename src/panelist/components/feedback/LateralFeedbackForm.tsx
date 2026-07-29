"use client";

import React from "react";
import { RatingField } from "./components/RatingField";
import { FeedbackComments } from "./components/FeedbackComments";
import { FeedbackActions } from "./components/FeedbackActions";

export type LateralRatingState = {
  technical: number;
  communication: number;
  collaboration: number;
  techNotes: string;
  commNotes: string;
  collabNotes: string;
  comments: string;
};

type LateralFeedbackFormProps = {
  panelId: string;
  current: LateralRatingState;
  updateLateral: (field: keyof LateralRatingState, val: any) => void;
  isSubmitting: boolean;
  feedbackError?: string;
  isEditing: boolean;
  onSubmit: (decision: "PASSED" | "REJECTED") => void;
  onCancelEdit: () => void;
};

export const LateralFeedbackForm: React.FC<LateralFeedbackFormProps> = ({
  panelId: _panelId,
  current,
  updateLateral,
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
        Evaluating Lateral Hiring Interview Metrics:
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <RatingField
          label="Technical Depth"
          rating={current.technical}
          notes={current.techNotes}
          placeholder="Technical skill assessment, technical expertise, depth for the role..."
          onRatingChange={(r) => updateLateral("technical", r)}
          onNotesChange={(v) => updateLateral("techNotes", v)}
          disabled={isSubmitting}
        />

        <RatingField
          label="Communication"
          rating={current.communication}
          notes={current.commNotes}
          placeholder="Communication skills, explanations structure, discussion..."
          onRatingChange={(r) => updateLateral("communication", r)}
          onNotesChange={(v) => updateLateral("commNotes", v)}
          disabled={isSubmitting}
        />

        <RatingField
          label="Collaboration & Fit"
          rating={current.collaboration}
          notes={current.collabNotes}
          placeholder="Team fit, ownership, stakeholder collaboration..."
          onRatingChange={(r) => updateLateral("collaboration", r)}
          onNotesChange={(v) => updateLateral("collabNotes", v)}
          disabled={isSubmitting}
        />
      </div>

      <FeedbackComments
        value={current.comments}
        onChange={(v) => updateLateral("comments", v)}
        disabled={isSubmitting}
        placeholder="Summary comments of performance..."
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
        passLabel="Submit & Pass"
        passColor="#f59e0b"
        passBg="rgba(245,158,11,0.12)"
        passBorder="1px solid rgba(245,158,11,0.3)"
      />
    </div>
  );
};
