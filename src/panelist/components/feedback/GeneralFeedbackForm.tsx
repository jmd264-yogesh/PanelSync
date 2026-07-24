"use client";

import React from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { StarRating } from "../ui/StarRating";

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
        {/* Technical Depth */}
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
              Technical Depth *
            </span>
            <StarRating
              rating={current.technical}
              onChange={(r) => updateGen("technical", r)}
              disabled={isSubmitting}
            />
          </div>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Technical skill assessment, technical expertise, coding depth..."
            style={{
              fontSize: "0.78rem",
              resize: "vertical",
            }}
            value={current.techNotes}
            onChange={(e) => updateGen("techNotes", e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {/* Communication */}
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
              Communication *
            </span>
            <StarRating
              rating={current.communication}
              onChange={(r) => updateGen("communication", r)}
              disabled={isSubmitting}
            />
          </div>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Communication skills, explanations structure, discussion..."
            style={{
              fontSize: "0.78rem",
              resize: "vertical",
            }}
            value={current.commNotes}
            onChange={(e) => updateGen("commNotes", e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {/* Collaboration & Teamwork */}
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
              Collaboration &amp; Teamwork *
            </span>
            <StarRating
              rating={current.collaboration}
              onChange={(r) => updateGen("collaboration", r)}
              disabled={isSubmitting}
            />
          </div>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Collaborative problem solving, feedback receipt, ownership..."
            style={{
              fontSize: "0.78rem",
              resize: "vertical",
            }}
            value={current.collabNotes}
            onChange={(e) => updateGen("collabNotes", e.target.value)}
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
          placeholder="Summary comments of performance..."
          style={{
            fontSize: "0.8rem",
            resize: "vertical",
          }}
          value={current.comments}
          onChange={(e) => updateGen("comments", e.target.value)}
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
          Submit &amp; Pass
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
