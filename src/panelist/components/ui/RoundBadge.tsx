"use client";

import React from "react";

type RoundBadgeProps = {
  role: string;
};

type BadgeStyle = {
  background: string;
  border: string;
  color: string;
  label: string;
};

const getRoleBadgeStyle = (role: string): BadgeStyle => {
  const isL1Role = role.toLowerCase().includes("l1");
  const isL2Role = role.toLowerCase().includes("l2");
  const isLateralRole = role.toLowerCase().includes("lateral");

  if (isL1Role) {
    return {
      background: "var(--badge-l1-bg)",
      border: "1px solid var(--badge-l1-border)",
      color: "var(--badge-l1-text)",
      label: "L1 Round",
    };
  } else if (isL2Role) {
    return {
      background: "var(--badge-l2-bg)",
      border: "1px solid var(--badge-l2-border)",
      color: "var(--badge-l2-text)",
      label: "L2 Round",
    };
  } else if (isLateralRole) {
    return {
      background: "rgba(245, 158, 11, 0.08)",
      border: "1px solid rgba(245, 158, 11, 0.25)",
      color: "#f59e0b",
      label: "Lateral Hiring",
    };
  }
  return {
    background: "rgba(99, 102, 241, 0.08)",
    border: "1px solid rgba(99, 102, 241, 0.2)",
    color: "var(--primary)",
    label: "General Round",
  };
};

export const RoundBadge: React.FC<RoundBadgeProps> = ({ role }) => {
  const badgeStyle = getRoleBadgeStyle(role);

  return (
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
  );
};
