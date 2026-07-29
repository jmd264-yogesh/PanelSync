"use client";

import React from "react";
import { InterviewPanel } from "@server/lib/db";

interface PanelMemberCardProps {
  panel: InterviewPanel;
  interviewStatus: string;
  interviewId: string;
  resendingPanelId: string | null;
  sendingFeedbackReminderId: string | null;
  onResend: (interviewId: string, panelId: string) => void;
  onSendReminder: (interviewId: string, e: React.MouseEvent) => void;
}

export const PanelMemberCard: React.FC<PanelMemberCardProps> = ({
  panel,
  interviewStatus,
  interviewId,
  resendingPanelId,
  sendingFeedbackReminderId,
  onResend,
  onSendReminder,
}) => {
  const parseFeedback = (feedbackStr: string | null | undefined) => {
    if (!feedbackStr) return null;
    try {
      return JSON.parse(feedbackStr);
    } catch (e) {
      return { raw: feedbackStr };
    }
  };

  const feedback = parseFeedback(panel.feedback);

  return (
    <div
      style={{
        padding: "12px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div>
          <p style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 2px 0", color: "var(--fg)" }}>
            {panel.name}
          </p>
          <p style={{ fontSize: "12px", color: "var(--fg-secondary)", margin: 0 }}>
            Status: {panel.status === "SUBMITTED" ? "✓ Responded" : "Pending"}
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {interviewStatus === "SCHEDULED" && panel.status === "SUBMITTED" && !panel.decision && (
            <button
              type="button"
              onClick={(e) => onSendReminder(interviewId, e)}
              disabled={sendingFeedbackReminderId === interviewId}
              className="btn btn-secondary"
              style={{ height: "32px", fontSize: "12px", padding: "0 12px" }}
            >
              {sendingFeedbackReminderId === interviewId ? "Sending..." : "Send Reminder"}
            </button>
          )}

          {panel.status === "PENDING" && (
            <button
              type="button"
              onClick={() => onResend(interviewId, panel.id)}
              disabled={resendingPanelId === panel.id}
              className="btn btn-secondary"
              style={{ height: "32px", fontSize: "12px", padding: "0 12px" }}
            >
              {resendingPanelId === panel.id ? "Resending..." : "Resend"}
            </button>
          )}
        </div>
      </div>

      {interviewStatus === "SCHEDULED" && (
        <div
          style={{
            marginTop: "4px",
            paddingTop: "8px",
            borderTop: "1px solid var(--border)",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: panel.decision ? "8px" : "0" }}>
            <span style={{ fontSize: "12px", color: "var(--fg-secondary)", fontWeight: 600 }}>
              Decision:
            </span>
            <span
              className="badge"
              style={{
                background:
                  panel.decision === "PASSED"
                    ? "var(--accent-light)"
                    : panel.decision === "REJECTED"
                      ? "var(--danger-light)"
                      : "var(--warning-light)",
                border:
                  panel.decision === "PASSED"
                    ? "1px solid var(--accent)"
                    : panel.decision === "REJECTED"
                      ? "1px solid var(--danger)"
                      : "1px solid var(--warning)",
                color:
                  panel.decision === "PASSED"
                    ? "var(--accent)"
                    : panel.decision === "REJECTED"
                      ? "var(--danger)"
                      : "var(--warning)",
              }}
            >
              {panel.decision || "PENDING"}
            </span>
          </div>

          {feedback && !feedback.raw && (
            <div style={{ fontSize: "13px", color: "var(--fg)", display: "flex", flexDirection: "column", gap: "8px" }}>
              {feedback.scores && Object.keys(feedback.scores).length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                    gap: "8px",
                    background: "var(--surface-muted)",
                    padding: "8px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                  }}
                >
                  {Object.entries(feedback.scores).map(([metric, score]) => (
                    <div key={metric} style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "11px", color: "var(--fg-secondary)", textTransform: "capitalize" }}>
                        {metric}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--info)" }}>
                        {String(score)} / 5
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {feedback.notes && Object.keys(feedback.notes).length > 0 && (
                <div
                  style={{
                    background: "var(--surface-muted)",
                    padding: "10px",
                    borderRadius: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {Object.entries(feedback.notes).map(([key, val]) => {
                    if (!val) return null;
                    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase());
                    return (
                      <div key={key} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontSize: "11px", color: "var(--fg-secondary)", fontWeight: 600 }}>
                          {label}:
                        </span>
                        <span style={{ fontSize: "13px", whiteSpace: "pre-wrap" }}>{String(val)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {feedback?.raw && (
            <p
              style={{
                fontSize: "13px",
                color: "var(--fg)",
                margin: 0,
                whiteSpace: "pre-wrap",
                background: "var(--surface-muted)",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
              }}
            >
              {feedback.raw}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
