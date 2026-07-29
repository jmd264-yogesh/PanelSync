"use client";

import React from "react";
import { Panelist } from "@server/lib/db";
import { GraphUser } from "@server/lib/graph";

interface PanelistDirectoryPickerProps {
  panelists: Panelist[];
  selectedPanels: GraphUser[];
  onTogglePanelist: (panelist: Panelist, isSelected: boolean) => void;
}

export const PanelistDirectoryPicker: React.FC<PanelistDirectoryPickerProps> = ({
  panelists,
  selectedPanels,
  onTogglePanelist,
}) => {
  if (panelists.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="text-xs text-muted" style={{ marginBottom: "0.3rem" }}>
        Or pick from the registered panelist directory:
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
        {panelists.map((p) => {
          const isChosen = selectedPanels.some((sp) => sp.id === p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onTogglePanelist(p, isChosen)}
              className="badge"
              style={{
                cursor: "pointer",
                background: isChosen ? "var(--primary-glow)" : undefined,
                border: isChosen ? "1px solid var(--primary)" : undefined,
                color: isChosen ? "var(--primary)" : undefined,
              }}
            >
              {p.displayName}
            </button>
          );
        })}
      </div>
    </div>
  );
};
