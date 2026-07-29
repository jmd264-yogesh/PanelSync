"use client";

import React from "react";

export const LateralCandidateEmptyState: React.FC = () => {
  return (
    <div className="glass-card" style={{ padding: "3rem", textAlign: "center" }}>
      <span className="text-muted text-sm">
        No lateral candidates yet. Click "Add Candidate" to start tracking one.
      </span>
    </div>
  );
};
