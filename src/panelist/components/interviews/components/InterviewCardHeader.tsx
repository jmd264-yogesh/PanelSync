import React from "react";
import { User } from "lucide-react";

type InterviewCardHeaderProps = {
  candidateName: string;
  candidateEmail: string;
  role: string;
  outcomeStatus: string;
  accentColor: string;
  getRoleBadgeStyle: (role: string) => {
    background: string;
    border: string;
    color: string;
    label: string;
  };
  STATUS_LABEL: Record<string, string>;
  STATUS_COLOR: Record<string, string>;
};

export const InterviewCardHeader = ({
  candidateName,
  candidateEmail,
  role,
  outcomeStatus,
  accentColor,
  getRoleBadgeStyle,
  STATUS_LABEL,
  STATUS_COLOR,
}: InterviewCardHeaderProps) => {
  const statusColor = STATUS_COLOR[outcomeStatus] || "#94a3b8";
  const initials = candidateName
    .split(" ")
    .map((w) => w[0] || "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const roleBadge = getRoleBadgeStyle(role);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
            border: `1px solid color-mix(in srgb, ${accentColor} 20%, transparent)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.8rem",
            fontWeight: 700,
            color: accentColor,
            flexShrink: 0,
          }}
        >
          {initials || <User size={16} />}
        </div>
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: "0.95rem",
                fontFamily: "var(--font-heading)",
              }}
            >
              {candidateName}
            </span>
            <span
              style={{
                fontSize: "0.68rem",
                background: roleBadge.background,
                border: roleBadge.border,
                borderRadius: "4px",
                padding: "0.08rem 0.35rem",
                color: roleBadge.color,
                fontWeight: 600,
              }}
            >
              {role}
            </span>
          </div>
          <div className="text-muted text-xs" style={{ marginTop: "0.1rem" }}>
            {candidateEmail}
          </div>
        </div>
      </div>

      {/* Status indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.35rem",
          fontSize: "0.78rem",
          fontWeight: 600,
          color: "var(--text-muted)",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: statusColor,
          }}
        ></span>
        <span>{STATUS_LABEL[outcomeStatus] || outcomeStatus}</span>
      </div>
    </div>
  );
};
