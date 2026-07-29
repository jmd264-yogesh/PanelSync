"use client";

import React from "react";
import { Briefcase, Plus } from "lucide-react";

interface LateralHiringHeaderProps {
  onAddClick: () => void;
}

export const LateralHiringHeader: React.FC<LateralHiringHeaderProps> = ({
  onAddClick,
}) => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "1.5rem",
        flexWrap: "wrap",
        gap: "1rem",
      }}
    >
      <div>
        <h1
          style={{
            fontSize: "1.35rem",
            fontWeight: 700,
            marginBottom: "0.3rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Briefcase size={20} className="text-primary" />
          Lateral Hiring
        </h1>
        <p className="text-muted text-sm">
          Experienced candidates hired directly against open positions — separate
          from campus drives.
        </p>
      </div>
      <button className="btn btn-primary" onClick={onAddClick}>
        <Plus size={15} style={{ marginRight: "0.35rem" }} />
        Add Candidate
      </button>
    </div>
  );
};
