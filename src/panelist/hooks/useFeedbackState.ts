import { useState } from "react";

/**
 * Type definitions for feedback ratings
 */
export type L1Rating = {
  coding: number;
  communication: number;
  fundamentals: number;
  codingNotes: string;
  commNotes: string;
  fundNotes: string;
  comments: string;
};

export type L2Rating = {
  design: number;
  depth: number;
  leadership: number;
  fit: number;
  designNotes: string;
  depthNotes: string;
  leadNotes: string;
  fitNotes: string;
  comments: string;
};

export type GeneralRating = {
  technical: number;
  communication: number;
  collaboration: number;
  techNotes: string;
  commNotes: string;
  collabNotes: string;
  comments: string;
};

export type LateralRating = {
  technical: number;
  communication: number;
  collaboration: number;
  techNotes: string;
  commNotes: string;
  collabNotes: string;
  comments: string;
};

/**
 * Hook for managing panelist feedback rating state
 *
 * Manages all structured feedback ratings (L1, L2, General, Lateral) and
 * editing state. Each rating type has its own scoring dimensions and notes.
 *
 * State is keyed by panelId to support multiple interviews.
 *
 * Rating Systems:
 * - L1: coding, communication, fundamentals (+ notes per dimension + comments)
 * - L2: design, depth, leadership, fit (+ notes per dimension + comments)
 * - General: technical, communication, collaboration (+ notes per dimension + comments)
 * - Lateral: technical, communication, collaboration (+ notes per dimension + comments)
 */
export function useFeedbackState() {
  // Structured score states keyed by panelId
  const [l1Ratings, setL1Ratings] = useState<Record<string, L1Rating>>({});
  const [l2Ratings, setL2Ratings] = useState<Record<string, L2Rating>>({});
  const [genRatings, setGenRatings] = useState<Record<string, GeneralRating>>(
    {},
  );
  const [lateralRatings, setLateralRatings] = useState<
    Record<string, LateralRating>
  >({});

  // Editing state for feedback forms
  const [isEditing, setIsEditing] = useState<Record<string, boolean>>({});

  return {
    l1Ratings,
    setL1Ratings,
    l2Ratings,
    setL2Ratings,
    genRatings,
    setGenRatings,
    lateralRatings,
    setLateralRatings,
    isEditing,
    setIsEditing,
  };
}
