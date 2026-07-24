"use client";

import React from "react";
import { X } from "lucide-react";
import { GraphUser } from "@server/lib/graph";

interface PanelSelectorProps {
  selectedPanels: GraphUser[];
  panelSearchQuery: string;
  setPanelSearchQuery: (query: string) => void;
  searchResults: GraphUser[];
  isSearchingPanels: boolean;
  onAddPanel: (user: GraphUser) => void;
  onRemovePanel: (userId: string) => void;
}

export const PanelSelector: React.FC<PanelSelectorProps> = ({
  selectedPanels,
  panelSearchQuery,
  setPanelSearchQuery,
  searchResults,
  isSearchingPanels,
  onAddPanel,
  onRemovePanel,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <label
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--fg-secondary)",
        }}
      >
        Panel Members
      </label>

      {/* Selected Panels Display */}
      {selectedPanels.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {selectedPanels.map((p) => (
            <span
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                background: "var(--surface-muted)",
                border: "1px solid var(--border)",
                borderRadius: "999px",
                padding: "4px 10px",
                fontSize: "12px",
                color: "var(--fg)",
              }}
            >
              {p.displayName}
              <button
                type="button"
                onClick={() => onRemovePanel(p.id)}
                aria-label={`Remove ${p.displayName}`}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--fg-secondary)",
                  cursor: "pointer",
                  display: "flex",
                  padding: 0,
                }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search Input with Dropdown */}
      <div style={{ position: "relative" }}>
        <input
          className="filter-select"
          type="text"
          placeholder="Search directory by name or email..."
          value={panelSearchQuery}
          onChange={(e) => setPanelSearchQuery(e.target.value)}
          style={{
            borderRadius: "10px",
            height: "40px",
            width: "100%",
          }}
        />

        {/* Search Results Dropdown */}
        {panelSearchQuery.trim().length >= 2 && (
          <div
            style={{
              position: "absolute",
              top: "44px",
              left: 0,
              right: 0,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              maxHeight: "160px",
              overflowY: "auto",
              zIndex: 10,
              boxShadow: "var(--shadow-sm)",
            }}
          >
            {isSearchingPanels ? (
              <div
                style={{
                  padding: "10px",
                  fontSize: "12px",
                  color: "var(--fg-secondary)",
                }}
              >
                Searching...
              </div>
            ) : searchResults.length === 0 ? (
              <div
                style={{
                  padding: "10px",
                  fontSize: "12px",
                  color: "var(--fg-secondary)",
                }}
              >
                No matches found.
              </div>
            ) : (
              searchResults.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onAddPanel(u)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                    color: "var(--fg)",
                  }}
                >
                  {u.displayName}{" "}
                  <span
                    style={{
                      color: "var(--fg-secondary)",
                      fontSize: "11px",
                    }}
                  >
                    ({u.mail || u.userPrincipalName})
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
