"use client";

import React from "react";
import { Interview } from "@server/lib/db";

interface InterviewInfoGridProps {
  interview: Interview;
}

export const InterviewInfoGrid: React.FC<InterviewInfoGridProps> = ({ interview }) => {
  const passedCount = interview.panels.filter((p) => p.decision === "PASSED").length;
  const rejectedCount = interview.panels.filter((p) => p.decision === "REJECTED").length;
  const pendingCount = interview.panels.filter((p) => !p.decision).length;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "20px",
      }}
    >
      {/* Role */}
      <div>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "var(--fg-secondary)",
            textTransform: "uppercase",
            margin: "0 0 4px 0",
          }}
        >
          Role
        </p>
        <p
          style={{
            fontSize: "15px",
            fontWeight: 600,
            margin: 0,
            color: "var(--fg)",
          }}
        >
          {interview.role}
        </p>
      </div>

      {/* Status */}
      <div>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "var(--fg-secondary)",
            textTransform: "uppercase",
            margin: "0 0 4px 0",
          }}
        >
          Status
        </p>
        <div>
          {interview.status === "PENDING" && (
            <span className="badge" style={{ background: "var(--warning-light)", border: "1px solid var(--warning)", color: "var(--warning)" }}>
              Awaiting Panels
            </span>
          )}
          {interview.status === "COLLECTED" && (
            <span className="badge" style={{ background: "var(--info-light)", border: "1px solid var(--info)", color: "var(--info)" }}>
              Ready to Book
            </span>
          )}
          {interview.status === "SCHEDULED" && (
            <span className="badge" style={{ background: "var(--accent-light)", border: "1px solid var(--accent)", color: "var(--accent)" }}>
              Scheduled
            </span>
          )}
        </div>
      </div>

      {/* Feedback Outcome */}
      <div>
        <p
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "var(--fg-secondary)",
            textTransform: "uppercase",
            margin: "0 0 4px 0",
          }}
        >
          Feedback Outcome
        </p>
        <div>
          {interview.status !== "SCHEDULED" ? (
            <span style={{ color: "var(--fg-secondary)", fontSize: "13px" }}>
              Not scheduled
            </span>
          ) : pendingCount === 0 ? (
            <span
              className="badge"
              style={{
                background: rejectedCount > 0 ? "var(--danger-light)" : "var(--accent-light)",
                border: rejectedCount > 0 ? "1px solid var(--danger)" : "1px solid var(--accent)",
                color: rejectedCount > 0 ? "var(--danger)" : "var(--accent)",
              }}
            >
              {rejectedCount > 0 ? "REJECTED" : "PASSED"} ({passedCount} P, {rejectedCount} R)
            </span>
          ) : (
            <span className="badge" style={{ background: "var(--warning-light)", border: "1px solid var(--warning)", color: "var(--warning)" }}>
              PENDING ({passedCount} P, {rejectedCount} R, {pendingCount} Pending)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
