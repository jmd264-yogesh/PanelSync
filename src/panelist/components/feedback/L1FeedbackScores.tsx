"use client";

import React from "react";
import { FeedbackScoreSection } from "./FeedbackScoreSection";

type L1FeedbackScoresProps = {
  scores: {
    coding?: number;
    communication?: number;
    fundamentals?: number;
  };
  notes: {
    codingNotes?: string;
    communicationNotes?: string;
    fundamentalsNotes?: string;
  };
};

export const L1FeedbackScores: React.FC<L1FeedbackScoresProps> = ({
  scores,
  notes,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.4rem",
        fontSize: "0.75rem",
      }}
    >
      <FeedbackScoreSection
        label="Coding & Problem Solving:"
        rating={scores.coding || 0}
        notes={notes.codingNotes}
        isFirst={true}
      />
      <FeedbackScoreSection
        label="Technical Communication:"
        rating={scores.communication || 0}
        notes={notes.communicationNotes}
      />
      <FeedbackScoreSection
        label="CS Fundamentals:"
        rating={scores.fundamentals || 0}
        notes={notes.fundamentalsNotes}
      />
    </div>
  );
};
