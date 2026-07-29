"use client";

import React from "react";

type RoundTabSwitcherProps = {
  activeRoundTab: "ALL" | "L1" | "L2" | "LATERAL";
  activePrimaryTab: "PANELS" | "FEEDBACK" | "RECALIBRATE";
  tabCounts: {
    requests: { total: number; l1: number; l2: number };
    feedback: { total: number; l1: number; l2: number };
  };
  onChangeRoundTab: (tab: "ALL" | "L1" | "L2" | "LATERAL") => void;
};

export const RoundTabSwitcher = ({
  activeRoundTab,
  activePrimaryTab,
  tabCounts,
  onChangeRoundTab,
}: RoundTabSwitcherProps) => {
  const isInPanelsTab = activePrimaryTab === "PANELS";

  return (
    <div
      style={{
        display: "flex",
        gap: "0.35rem",
        marginBottom: "2rem",
        padding: "0.25rem",
        background: "var(--bg-card)",
        border: "1px solid var(--border-glass)",
        borderRadius: "8px",
        width: "fit-content",
      }}
    >
      <button
        onClick={() => onChangeRoundTab("ALL")}
        style={{
          padding: "0.45rem 1rem",
          borderRadius: "6px",
          border: "none",
          background:
            activeRoundTab === "ALL" ? "var(--primary-glow)" : "transparent",
          color:
            activeRoundTab === "ALL" ? "var(--primary)" : "var(--text-muted)",
          fontSize: "0.8rem",
          fontWeight: 600,
          cursor: "pointer",
          transition: "var(--transition-fast)",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        <span>{isInPanelsTab ? "All Panels" : "All Rounds"}</span>
        <span
          style={{
            fontSize: "0.72rem",
            background:
              activeRoundTab === "ALL" ? "var(--primary)" : "var(--border-glass)",
            color: activeRoundTab === "ALL" ? "#ffffff" : "var(--text-muted)",
            padding: "1px 6px",
            borderRadius: "4px",
            fontWeight: 700,
          }}
        >
          {isInPanelsTab ? tabCounts.requests.total : tabCounts.feedback.total}
        </span>
      </button>

      <button
        onClick={() => onChangeRoundTab("L1")}
        style={{
          padding: "0.45rem 1rem",
          borderRadius: "6px",
          border: "none",
          background:
            activeRoundTab === "L1" ? "rgba(14, 165, 233, 0.1)" : "transparent",
          color: activeRoundTab === "L1" ? "#0ea5e9" : "var(--text-muted)",
          fontSize: "0.8rem",
          fontWeight: 600,
          cursor: "pointer",
          transition: "var(--transition-fast)",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        <span>L1 Round</span>
        <span
          style={{
            fontSize: "0.72rem",
            background:
              activeRoundTab === "L1" ? "#0ea5e9" : "var(--border-glass)",
            color: activeRoundTab === "L1" ? "#ffffff" : "var(--text-muted)",
            padding: "1px 6px",
            borderRadius: "4px",
            fontWeight: 700,
          }}
        >
          {isInPanelsTab ? tabCounts.requests.l1 : tabCounts.feedback.l1}
        </span>
      </button>

      <button
        onClick={() => onChangeRoundTab("L2")}
        style={{
          padding: "0.45rem 1rem",
          borderRadius: "6px",
          border: "none",
          background:
            activeRoundTab === "L2" ? "rgba(124, 58, 237, 0.1)" : "transparent",
          color: activeRoundTab === "L2" ? "#7c3aed" : "var(--text-muted)",
          fontSize: "0.8rem",
          fontWeight: 600,
          cursor: "pointer",
          transition: "var(--transition-fast)",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        <span>L2 Round</span>
        <span
          style={{
            fontSize: "0.72rem",
            background:
              activeRoundTab === "L2" ? "#7c3aed" : "var(--border-glass)",
            color: activeRoundTab === "L2" ? "#ffffff" : "var(--text-muted)",
            padding: "1px 6px",
            borderRadius: "4px",
            fontWeight: 700,
          }}
        >
          {isInPanelsTab ? tabCounts.requests.l2 : tabCounts.feedback.l2}
        </span>
      </button>
    </div>
  );
};
