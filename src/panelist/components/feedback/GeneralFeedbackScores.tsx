"use client";

import React from "react";
import { FeedbackScoreSection } from "./FeedbackScoreSection";

type GeneralFeedbackScoresProps = {
  scores: {
    technical?: number;
    communication?: number;
    collaboration?: number;
  };
  notes: {
    technicalNotes?: string;
    communicationNotes?: string;
    collaborationNotes?: string;
  };
};

export const GeneralFeedbackScores: React.FC<GeneralFeedbackScoresProps> = ({
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
        label="Technical Depth:"
        rating={scores.technical || 0}
        notes={notes.technicalNotes}
        isFirst={true}
      />
      <FeedbackScoreSection
        label="Communication:"
        rating={scores.communication || 0}
        notes={notes.communicationNotes}
      />
      <FeedbackScoreSection
        label="Collaboration & Teamwork:"
        rating={scores.collaboration || 0}
        notes={notes.collaborationNotes}
      />
    </div>
  );
};
