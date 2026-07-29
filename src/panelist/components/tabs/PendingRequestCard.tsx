"use client";

import React from "react";
import { Interview, InterviewPanel, Drive } from "@server/lib/db";
import {
  getCollegeNameFromRole,
  isFromActiveDrive,
  getRoleBadgeStyle,
  formatDriveDate,
} from "./requestCardUtils";

type PendingRequestCardProps = {
  interview: Interview;
  panel: InterviewPanel;
  activeDrive: Drive | null;
  onSelect: () => void;
};

export const PendingRequestCard = ({
  interview,
  panel,
  activeDrive,
  onSelect,
}: PendingRequestCardProps) => {
  const dateRange = `${new Date(interview.startDate).toLocaleDateString("en-US")} - ${new Date(interview.endDate).toLocaleDateString("en-US")}`;
  const badgeStyle = getRoleBadgeStyle(interview.role);
  const collegeName = getCollegeNameFromRole(interview.role);
  const isReqFromActiveDrive = isFromActiveDrive(interview.role, activeDrive);

  return (
    <div
      className="glass-card"
      style={{
        padding: "1.25rem 1.5rem",
        borderTop: "1px solid var(--border-glass)",
        borderRight: "1px solid var(--border-glass)",
        borderBottom: "1px solid var(--border-glass)",
        borderLeft: `4px solid ${badgeStyle.borderCol}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1rem",
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "0.4rem",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: "0.65rem",
              background: badgeStyle.background,
              border: badgeStyle.border,
              borderRadius: "4px",
              padding: "0.15rem 0.45rem",
              color: badgeStyle.color,
              fontWeight: 700,
            }}
          >
            {badgeStyle.label}
          </span>
          <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
            {interview.role}
          </span>
          <span
            className="badge badge-pending"
            style={{ fontSize: "0.6rem" }}
          >
            Availability Requested
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          {collegeName && (
            <div className="text-muted text-xs">
              College: <strong>{collegeName}</strong>
            </div>
          )}

          {isReqFromActiveDrive && activeDrive && (
            <div
              style={{
                fontSize: "0.75rem",
                color: "#0ea5e9",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                margin: "2px 0 4px 0",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "#0ea5e9",
                }}
              ></span>
              Active Drive: {activeDrive.collegeName} (
              {formatDriveDate(activeDrive.startDate)} -{" "}
              {formatDriveDate(activeDrive.endDate)})
            </div>
          )}

          <div className="text-muted text-xs">
            Proposed Date Range: <strong>{dateRange}</strong>
          </div>

          <div className="text-muted text-xs">
            Duration: <strong>{interview.duration} minutes</strong>
          </div>
        </div>
      </div>
      <button className="btn btn-primary btn-sm" onClick={onSelect}>
        Provide Availability / Select Slot
      </button>
    </div>
  );
};
