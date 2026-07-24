"use client";

import React from "react";
import { Interview, InterviewPanel } from "@server/lib/db";
import { getInterviewInfo } from "@common/util/interview-role";
import { formatDateShort, formatTimeShort } from "@common/util/date";
import { getInitials } from "@common/util/string";
import { getStatusClass } from "@common/util/status";

interface InterviewCardProps {
  interview: Interview;
  panel: InterviewPanel | null;
  isSelected: boolean;
  onClick: () => void;
}

export const InterviewCard: React.FC<InterviewCardProps> = ({
  interview,
  panel,
  isSelected,
  onClick,
}) => {
  const { isL1, isL2 } = getInterviewInfo(interview.role);
  const initials = getInitials(interview.candidateName);
  const statusClass = getStatusClass(interview.status);

  // Determine time and date display
  let timeStr = "TBD";
  let dateStr = "No range set";
  if (interview.scheduledSlotStart) {
    timeStr = formatTimeShort(interview.scheduledSlotStart);
    dateStr = formatDateShort(interview.scheduledSlotStart);
  } else {
    dateStr = `${formatDateShort(interview.startDate)} – ${formatDateShort(interview.endDate)}`;
  }

  // Render panel information
  const renderPanelInfo = () => {
    // Case 1: Mapped candidate (not "Pending Assignment")
    if (interview.candidateName !== "Pending Assignment") {
      const activePanels =
        interview.status === "SCHEDULED" || interview.status === "COLLECTED"
          ? interview.panels.filter((p) => p.status === "SUBMITTED")
          : interview.panels;
      const panelsToRender =
        activePanels.length > 0 ? activePanels : interview.panels;

      if (panelsToRender.length === 0) {
        return <span>Awaiting assignment</span>;
      }

      return panelsToRender.map((p) => {
        const feedbackText = p.decision
          ? `Feedback: ${p.decision}`
          : "Feedback: Pending";
        const badgeStyle =
          p.decision === "PASSED"
            ? {
                background: "var(--accent-light)",
                color: "var(--accent)",
              }
            : p.decision === "REJECTED"
              ? {
                  background: "var(--danger-light)",
                  color: "var(--danger)",
                }
              : {
                  background: "var(--warning-light)",
                  color: "var(--warning)",
                };

        return (
          <div
            key={p.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontWeight: 500 }}>{p.name}</span>
            {interview.status === "SCHEDULED" && (
              <span
                className="round-badge"
                style={{
                  ...badgeStyle,
                  fontSize: "10px",
                  padding: "1px 6px",
                  lineHeight: 1,
                }}
              >
                {feedbackText}
              </span>
            )}
          </div>
        );
      });
    }

    // Case 2: Pending Assignment with a specific panel (for split view)
    if (panel) {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: 500 }}>{panel.name}</span>
          {interview.status === "SCHEDULED" && (
            <span
              className="round-badge"
              style={{
                background:
                  panel.decision === "PASSED"
                    ? "var(--accent-light)"
                    : panel.decision === "REJECTED"
                      ? "var(--danger-light)"
                      : "var(--warning-light)",
                color:
                  panel.decision === "PASSED"
                    ? "var(--accent)"
                    : panel.decision === "REJECTED"
                      ? "var(--danger)"
                      : "var(--warning)",
                fontSize: "10px",
                padding: "1px 6px",
                lineHeight: 1,
              }}
            >
              {panel.decision ? `Feedback: ${panel.decision}` : "Feedback: Pending"}
            </span>
          )}
        </div>
      );
    }

    // Case 3: Pending Assignment without panels
    return <span>Awaiting assignment</span>;
  };

  return (
    <article
      className={`interview-card ${isSelected ? "active" : ""}`}
      onClick={onClick}
      style={
        isSelected
          ? {
              borderColor: "var(--accent)",
              boxShadow: "var(--shadow-sm)",
            }
          : {}
      }
    >
      <div className="candidate-avatar">{initials}</div>

      <div>
        <div className="candidate-name">{interview.candidateName}</div>
        <div className="candidate-meta">
          {interview.role.split("-").pop()?.trim()}
          <span className="round-badge">
            {isL2 ? "L2 Round" : "L1 Round"}
          </span>
        </div>

        <div
          className="panelist-line"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            marginTop: "4px",
          }}
        >
          {renderPanelInfo()}
        </div>
      </div>

      <div className="interview-time">
        <span className={`status-dot ${statusClass}`} />
        {timeStr}
        <br />
        <span>{dateStr}</span>
      </div>
    </article>
  );
};
