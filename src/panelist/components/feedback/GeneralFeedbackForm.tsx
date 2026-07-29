"use client";

import React from "react";
import { RatingField } from "./components/RatingField";
import { FeedbackComments } from "./components/FeedbackComments";
import { FeedbackActions } from "./components/FeedbackActions";

export type GenRatingState = {
  technical: number;
  communication: number;
  collaboration: number;
  techNotes: string;
  commNotes: string;
  collabNotes: string;
  comments: string;
};

type GeneralFeedbackFormProps = {
  panelId: string;
  current: GenRatingState;
  updateGen: (field: keyof GenRatingState, val: any) => void;
  isSubmitting: boolean;
  feedbackError?: string;
  isEditing: boolean;
  onSubmit: (decision: "PASSED" | "REJECTED") => void;
  onCancelEdit: () => void;
};

export const GeneralFeedbackForm: React.FC<GeneralFeedbackFormProps> = ({
  panelId: _panelId,
  current,
  updateGen,
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
        Evaluating General Interview Metrics:
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
          placeholder="Technical skill assessment, technical expertise, coding depth..."
          onRatingChange={(r) => updateGen("technical", r)}
          onNotesChange={(v) => updateGen("techNotes", v)}
          disabled={isSubmitting}
        />

        <RatingField
          label="Communication"
          rating={current.communication}
          notes={current.commNotes}
          placeholder="Communication skills, explanations structure, discussion..."
          onRatingChange={(r) => updateGen("communication", r)}
          onNotesChange={(v) => updateGen("commNotes", v)}
          disabled={isSubmitting}
        />

        <RatingField
          label="Collaboration & Teamwork"
          rating={current.collaboration}
          notes={current.collabNotes}
          placeholder="Collaborative problem solving, feedback receipt, ownership..."
          onRatingChange={(r) => updateGen("collaboration", r)}
          onNotesChange={(v) => updateGen("collabNotes", v)}
          disabled={isSubmitting}
        />
      </div>

      <FeedbackComments
        value={current.comments}
        onChange={(v) => updateGen("comments", v)}
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
      />
    </div>
  );
};
