"use client";

import React from "react";
import { Panelist } from "@server/lib/db";
import { GraphUser } from "@server/lib/graph";

interface RecommendedPanelistsProps {
  recommendedPanelists: Panelist[];
  selectedPanels: GraphUser[];
  onToggle: (panelist: Panelist) => void;
}

export const RecommendedPanelists: React.FC<RecommendedPanelistsProps> = ({
  recommendedPanelists,
  selectedPanels,
  onToggle,
}) => {
  if (recommendedPanelists.length === 0) {
    return null;
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {recommendedPanelists.map((p) => {
        const isChosen = selectedPanels.some((sp) => sp.id === p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p)}
            aria-pressed={isChosen}
            style={{
              fontSize: "11px",
              padding: "4px 10px",
              borderRadius: "999px",
              border: isChosen
                ? "1px solid var(--accent)"
                : "1px solid var(--border)",
              background: isChosen
                ? "var(--accent-light)"
                : "var(--surface-muted)",
              color: isChosen ? "var(--accent)" : "var(--fg-secondary)",
              cursor: "pointer",
            }}
          >
            {p.displayName}
          </button>
        );
      })}
    </div>
  );
};
