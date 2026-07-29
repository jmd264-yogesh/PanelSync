"use client";

import React from "react";
import { X } from "lucide-react";

interface InterviewDetailsHeaderProps {
  candidateName: string;
  onClose: () => void;
}

export const InterviewDetailsHeader: React.FC<InterviewDetailsHeaderProps> = ({
  candidateName,
  onClose,
}) => {
  return (
    <div
      style={{
        padding: "20px 24px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <h2
        style={{
          fontSize: "18px",
          fontWeight: 700,
          margin: 0,
          color: "var(--fg)",
        }}
      >
        {candidateName}
      </h2>
      <button
        type="button"
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          color: "var(--fg-secondary)",
          cursor: "pointer",
        }}
      >
        <X size={24} />
      </button>
    </div>
  );
};
