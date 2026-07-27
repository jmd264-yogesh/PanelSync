/**
 * RejectionForm Component
 *
 * Allows panelists to decline interview nominations with a reason
 */

"use client";

import { X, Loader2, AlertCircle } from "lucide-react";

interface RejectionFormProps {
  isRejected: boolean;
  rejectReason: string;
  onReasonChange: (reason: string) => void;
  onReject: () => Promise<void>;
  onCancel: () => void;
  isRejecting: boolean;
  panelName: string;
  interviewRole: string;
}

export const RejectionForm = ({
  isRejected,
  rejectReason,
  onReasonChange,
  onReject,
  onCancel,
  isRejecting,
  panelName,
  interviewRole,
}: RejectionFormProps) => {
  // If already rejected, show confirmation screen
  if (isRejected) {
    return (
      <div
        className="glass-card text-center animate-pulse-once"
        style={{ padding: "3rem 2rem" }}
      >
        <AlertCircle
          size={56}
          style={{ color: "#ef4444", margin: "0 auto 1.5rem" }}
        />
        <h2 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
          Nomination Declined
        </h2>
        <p
          className="text-muted"
          style={{ fontSize: "0.95rem", marginBottom: "2rem" }}
        >
          Thank you, <strong>{panelName}</strong>. You have declined the
          nomination for the <strong>{interviewRole}</strong> interview.
        </p>
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            padding: "1rem 1.5rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-glass)",
            textAlign: "left",
            marginBottom: "2rem",
          }}
        >
          <span
            className="text-xs text-muted block"
            style={{ marginBottom: "0.25rem" }}
          >
            Decline Reason
          </span>
          <span className="text-sm font-semibold">{rejectReason}</span>
        </div>
        <p className="text-muted text-xs">
          The coordinator has been notified of your response. You can safely
          close this page now.
        </p>
      </div>
    );
  }

  // Show rejection form
  return (
    <div
      style={{
        background: "var(--danger-glow)",
        border: "1px solid rgba(239, 68, 68, 0.2)",
        padding: "1.5rem",
        borderRadius: "var(--radius-md)",
        marginTop: "1.5rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <span className="font-semibold" style={{ color: "var(--danger)" }}>
          Decline Nomination
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-sm btn-ghost"
          style={{ padding: "0.25rem" }}
        >
          <X size={16} />
        </button>
      </div>

      <textarea
        placeholder="Please provide a reason for declining..."
        value={rejectReason}
        onChange={(e) => onReasonChange(e.target.value)}
        style={{
          width: "100%",
          minHeight: "80px",
          padding: "0.75rem",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border-glass)",
          background: "rgba(0,0,0,0.2)",
          color: "var(--text)",
          fontSize: "0.875rem",
          resize: "vertical",
          marginBottom: "1rem",
        }}
      />

      <button
        onClick={onReject}
        disabled={isRejecting || !rejectReason.trim()}
        className="btn btn-danger"
        style={{ width: "100%" }}
      >
        {isRejecting ? (
          <>
            <Loader2 size={16} className="spin" />
            <span>Declining...</span>
          </>
        ) : (
          "Confirm Decline"
        )}
      </button>
    </div>
  );
};
