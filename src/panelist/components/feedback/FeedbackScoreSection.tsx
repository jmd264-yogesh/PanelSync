"use client";

import React from "react";
import { StarRating } from "../ui/StarRating";

type FeedbackScoreSectionProps = {
  label: string;
  rating: number;
  notes?: string;
  isFirst?: boolean;
};

export const FeedbackScoreSection: React.FC<FeedbackScoreSectionProps> = ({
  label,
  rating,
  notes,
  isFirst = false,
}) => {
  return (
    <div
      style={{
        borderTop: isFirst ? "none" : "1px solid var(--border-glass)",
        paddingTop: isFirst ? "0" : "0.25rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontWeight: 600 }}>{label}</span>
        <StarRating rating={rating} interactive={false} />
      </div>
      {notes && (
        <p
          style={{
            color: "var(--text-muted)",
            margin: "2px 0 0 0",
            fontSize: "0.72rem",
            lineHeight: 1.35,
          }}
        >
          {notes}
        </p>
      )}
    </div>
  );
};
