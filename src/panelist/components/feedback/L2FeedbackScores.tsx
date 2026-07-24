"use client";

import React from "react";
import { FeedbackScoreSection } from "./FeedbackScoreSection";

type L2FeedbackScoresProps = {
  scores: {
    systemDesign?: number;
    technicalDepth?: number;
    leadership?: number;
    culturalFit?: number;
  };
  notes: {
    systemDesignNotes?: string;
    technicalDepthNotes?: string;
    leadershipNotes?: string;
    culturalFitNotes?: string;
  };
};

export const L2FeedbackScores: React.FC<L2FeedbackScoresProps> = ({
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
        label="System Design & Scalability:"
        rating={scores.systemDesign || 0}
        notes={notes.systemDesignNotes}
        isFirst={true}
      />
      <FeedbackScoreSection
        label="Technical Depth & Experience:"
        rating={scores.technicalDepth || 0}
        notes={notes.technicalDepthNotes}
      />
      <FeedbackScoreSection
        label="Leadership & Ownership:"
        rating={scores.leadership || 0}
        notes={notes.leadershipNotes}
      />
      <FeedbackScoreSection
        label="Cultural Fit & MS Values:"
        rating={scores.culturalFit || 0}
        notes={notes.culturalFitNotes}
      />
    </div>
  );
};
