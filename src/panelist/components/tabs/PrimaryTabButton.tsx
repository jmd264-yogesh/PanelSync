"use client";

import React, { ReactNode } from "react";

type PrimaryTabButtonProps = {
  isActive: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  count: number;
};

export const PrimaryTabButton = ({
  isActive,
  onClick,
  icon,
  label,
  count,
}: PrimaryTabButtonProps) => {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "0.75rem 0.25rem",
        border: "none",
        background: "none",
        borderBottom: isActive
          ? "2.5px solid var(--primary)"
          : "2.5px solid transparent",
        color: isActive ? "var(--primary)" : "var(--text-muted)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        transition: "var(--transition-fast)",
        outline: "none",
      }}
    >
      {icon}
      <span>{label}</span>
      <span
        style={{
          fontSize: "0.75rem",
          background: isActive ? "var(--primary)" : "var(--border-glass)",
          color: isActive ? "#ffffff" : "var(--text-muted)",
          padding: "2px 8px",
          borderRadius: "12px",
          fontWeight: 700,
        }}
      >
        {count}
      </span>
    </button>
  );
};
