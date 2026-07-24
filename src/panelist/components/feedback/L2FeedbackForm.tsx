"use client";

import React from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { StarRating } from "../ui/StarRating";

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
        {/* System Design & Scalability */}
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
              System Design &amp; Scalability *
            </span>
            <StarRating
              rating={current.design}
              onChange={(r) => updateL2("design", r)}
              disabled={isSubmitting}
            />
          </div>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Architecture, API design, trade-offs, database choices..."
            style={{
              fontSize: "0.78rem",
              resize: "vertical",
            }}
            value={current.designNotes}
            onChange={(e) => updateL2("designNotes", e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {/* Technical Depth & Experience */}
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
              Technical Depth &amp; Experience *
            </span>
            <StarRating
              rating={current.depth}
              onChange={(r) => updateL2("depth", r)}
              disabled={isSubmitting}
            />
          </div>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Past project complexity, deep tech troubleshooting, domain knowledge..."
            style={{
              fontSize: "0.78rem",
              resize: "vertical",
            }}
            value={current.depthNotes}
            onChange={(e) => updateL2("depthNotes", e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {/* Leadership & Ownership */}
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
              Leadership &amp; Ownership *
            </span>
            <StarRating
              rating={current.leadership}
              onChange={(r) => updateL2("leadership", r)}
              disabled={isSubmitting}
            />
          </div>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Ownership mindset, problem driving, initiative, peer support..."
            style={{
              fontSize: "0.78rem",
              resize: "vertical",
            }}
            value={current.leadNotes}
            onChange={(e) => updateL2("leadNotes", e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {/* Cultural Fit & MS Values */}
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
              Cultural Fit &amp; MS Values *
            </span>
            <StarRating
              rating={current.fit}
              onChange={(r) => updateL2("fit", r)}
              disabled={isSubmitting}
            />
          </div>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Growth mindset, customer obsession, inclusion, alignment..."
            style={{
              fontSize: "0.78rem",
              resize: "vertical",
            }}
            value={current.fitNotes}
            onChange={(e) => updateL2("fitNotes", e.target.value)}
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
          placeholder="Summary comments of L2 performance..."
          style={{
            fontSize: "0.8rem",
            resize: "vertical",
          }}
          value={current.comments}
          onChange={(e) => updateL2("comments", e.target.value)}
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
            background: "rgba(124,58,237,0.15)",
            border: "1px solid rgba(124,58,237,0.3)",
            color: "#c084fc",
          }}
        >
          {isSubmitting ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <CheckCircle size={12} />
          )}
          Submit &amp; Pass L2
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
