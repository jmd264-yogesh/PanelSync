"use client";

import React from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { StarRating } from "../ui/StarRating";

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
        {/* Coding & Problem Solving */}
        <div
          style={{
            background: "var(--bg-main)",
            border: "1px solid var(--border-glass)",
            padding: "0.75rem",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.5rem",
            }}
          >
            <span
              style={{
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              Coding &amp; Problem Solving *
            </span>
            <StarRating
              rating={current.coding}
              onChange={(r) => updateL1("coding", r)}
              disabled={isSubmitting}
            />
          </div>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Specific coding questions, algorithmic depth, edge cases..."
            style={{
              fontSize: "0.78rem",
              resize: "vertical",
            }}
            value={current.codingNotes}
            onChange={(e) => updateL1("codingNotes", e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {/* Technical Communication */}
        <div
          style={{
            background: "var(--bg-main)",
            border: "1px solid var(--border-glass)",
            padding: "0.75rem",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.5rem",
            }}
          >
            <span
              style={{
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              Technical Communication *
            </span>
            <StarRating
              rating={current.communication}
              onChange={(r) => updateL1("communication", r)}
              disabled={isSubmitting}
            />
          </div>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Explanation clarity, technical dialogue, structure..."
            style={{
              fontSize: "0.78rem",
              resize: "vertical",
            }}
            value={current.commNotes}
            onChange={(e) => updateL1("commNotes", e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {/* CS Fundamentals */}
        <div
          style={{
            background: "var(--bg-main)",
            border: "1px solid var(--border-glass)",
            padding: "0.75rem",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.5rem",
            }}
          >
            <span
              style={{
                fontSize: "0.82rem",
                fontWeight: 600,
              }}
            >
              CS Fundamentals *
            </span>
            <StarRating
              rating={current.fundamentals}
              onChange={(r) => updateL1("fundamentals", r)}
              disabled={isSubmitting}
            />
          </div>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Basic DSA, runtime complexity, OS/memory/networks..."
            style={{
              fontSize: "0.78rem",
              resize: "vertical",
            }}
            value={current.fundNotes}
            onChange={(e) => updateL1("fundNotes", e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Overall Comments */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.4rem",
        }}
      >
        <label
          style={{
            fontSize: "0.8rem",
            fontWeight: 600,
          }}
        >
          Overall Comments / Summary Recommendation
        </label>
        <textarea
          className="form-input"
          rows={2}
          placeholder="Summary comments of L1 performance..."
          style={{
            fontSize: "0.8rem",
            resize: "vertical",
          }}
          value={current.comments}
          onChange={(e) => updateL1("comments", e.target.value)}
          disabled={isSubmitting}
        />
      </div>

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

      {/* Warning Banner for L1 PASSED locking */}
      <div
        style={{
          marginTop: "0.5rem",
          marginBottom: "0.75rem",
          padding: "0.75rem",
          background: "rgba(245,158,11,0.06)",
          border: "1px solid rgba(245,158,11,0.2)",
          borderRadius: "var(--radius-sm)",
          color: "#fbbf24",
          fontSize: "0.75rem",
          lineHeight: 1.4,
        }}
      >
        <strong>⚠️ L1 Decision Warning:</strong> Submitting a{" "}
        <strong>Pass L1</strong> decision is final. The candidate will
        immediately progress to the L2 queue, and you will not be able to edit
        or revert this feedback.
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginTop: "0.25rem",
        }}
      >
        <button
          onClick={() => onSubmit("PASSED")}
          disabled={isSubmitting}
          className="btn btn-sm"
          style={{
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.3)",
            color: "var(--success)",
          }}
        >
          {isSubmitting ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <CheckCircle size={12} />
          )}
          Submit &amp; Pass L1
        </button>
        <button
          onClick={() => onSubmit("REJECTED")}
          disabled={isSubmitting}
          className="btn btn-sm"
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            color: "#ef4444",
          }}
        >
          {isSubmitting ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <XCircle size={12} />
          )}
          Submit &amp; Reject
        </button>
        {isEditing && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="btn btn-secondary btn-sm"
          >
            Cancel Edit
          </button>
        )}
      </div>
    </div>
  );
};
