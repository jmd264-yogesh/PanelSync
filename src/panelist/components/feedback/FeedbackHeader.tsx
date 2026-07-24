"use client";

import React from "react";
import { CheckCircle } from "lucide-react";

type FeedbackHeaderProps = {
  type: string;
  decision: "PASSED" | "REJECTED";
  isL1PassLocked: boolean;
  canEdit: boolean;
  editTimeRemaining: string;
  onEditClick: () => void;
};

export const FeedbackHeader: React.FC<FeedbackHeaderProps> = ({
  type,
  decision,
  isL1PassLocked,
  canEdit,
  editTimeRemaining,
  onEditClick,
}) => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid var(--border-glass)",
        paddingBottom: "0.5rem",
        marginBottom: "0.5rem",
        flexWrap: "wrap",
        gap: "0.5rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        <CheckCircle
          size={13}
          style={{
            color:
              decision === "PASSED" ? "var(--success)" : "var(--danger)",
          }}
        />
        <span
          style={{
            fontSize: "0.8rem",
            color:
              decision === "PASSED" ? "var(--success)" : "var(--danger)",
            fontWeight: 700,
          }}
        >
          {type} Feedback — {decision === "PASSED" ? "Passed" : "Rejected"}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        {isL1PassLocked && (
          <span
            style={{
              fontSize: "0.72rem",
              color: "var(--text-muted)",
              fontStyle: "italic",
            }}
          >
            L1 Pass Final (Locked)
          </span>
        )}
        {!isL1PassLocked && canEdit && (
          <>
            <span
              style={{
                fontSize: "0.72rem",
                color: "#fbbf24",
                fontWeight: 600,
              }}
            >
              ⏱️ {editTimeRemaining}
            </span>
            <button
              onClick={onEditClick}
              className="btn btn-secondary btn-xs"
              style={{
                padding: "0.2rem 0.5rem",
                fontSize: "0.7rem",
              }}
            >
              Edit Feedback
            </button>
          </>
        )}
        {!isL1PassLocked && !canEdit && (
          <span
            style={{
              fontSize: "0.72rem",
              color: "var(--text-muted)",
              fontStyle: "italic",
            }}
          >
            Editing Window Expired
          </span>
        )}
      </div>
    </div>
  );
};
