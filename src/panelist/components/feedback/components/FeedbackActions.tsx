import React from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

type FeedbackActionsProps = {
  onPass: () => void;
  onReject: () => void;
  onCancelEdit?: () => void;
  isSubmitting: boolean;
  isEditing: boolean;
  passLabel?: string;
  passColor?: string;
  passBg?: string;
  passBorder?: string;
};

export const FeedbackActions = ({
  onPass,
  onReject,
  onCancelEdit,
  isSubmitting,
  isEditing,
  passLabel = "Submit & Pass",
  passColor = "var(--success)",
  passBg = "rgba(16,185,129,0.1)",
  passBorder = "1px solid rgba(16,185,129,0.3)",
}: FeedbackActionsProps) => {
  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        marginTop: "0.25rem",
      }}
    >
      <button
        onClick={onPass}
        disabled={isSubmitting}
        className="btn btn-sm"
        style={{
          background: passBg,
          border: passBorder,
          color: passColor,
        }}
      >
        {isSubmitting ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <CheckCircle size={12} />
        )}
        {passLabel}
      </button>
      <button
        onClick={onReject}
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
      {isEditing && onCancelEdit && (
        <button
          type="button"
          onClick={onCancelEdit}
          className="btn btn-secondary btn-sm"
        >
          Cancel Edit
        </button>
      )}
    </div>
  );
};
