"use client";

import React from "react";
import { Search, X } from "lucide-react";
import { GraphUser } from "@server/lib/graph";

interface PanelistSearchInputProps {
  searchQuery: string;
  isSearching: boolean;
  searchResults: GraphUser[];
  selectedPanels: GraphUser[];
  onSearchChange: (query: string) => void;
  onSelectUser: (user: GraphUser) => void;
  onRemoveUser: (userId: string) => void;
}

export const PanelistSearchInput: React.FC<PanelistSearchInputProps> = ({
  searchQuery,
  isSearching,
  searchResults,
  selectedPanels,
  onSearchChange,
  onSelectUser,
  onRemoveUser,
}) => {
  return (
    <div>
      {/* Search Input */}
      <div style={{ position: "relative" }}>
        <div style={{ position: "relative" }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: "0.6rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }}
          />
          <input
            className="form-input"
            style={{ paddingLeft: "2rem" }}
            placeholder="Search panelists by name or email..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        {isSearching && (
          <div className="text-xs text-muted" style={{ marginTop: "0.3rem" }}>
            Searching...
          </div>
        )}
        {searchResults.length > 0 && (
          <div
            className="glass-card"
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 10,
              marginTop: "0.25rem",
              maxHeight: "160px",
              overflowY: "auto",
            }}
          >
            {searchResults.map((u) => (
              <div
                key={u.id}
                onClick={() => onSelectUser(u)}
                style={{
                  padding: "0.5rem 0.75rem",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background =
                    "var(--bg-hover, rgba(255,255,255,0.05))")
                }
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ fontWeight: 600 }}>{u.displayName}</div>
                <div className="text-muted text-xs">{u.mail || u.userPrincipalName}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Panels */}
      {selectedPanels.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.75rem" }}>
          {selectedPanels.map((p) => (
            <span
              key={p.id}
              className="badge badge-info"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
            >
              {p.displayName}
              <button
                type="button"
                onClick={() => onRemoveUser(p.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "inherit",
                  padding: 0,
                  display: "flex",
                }}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
