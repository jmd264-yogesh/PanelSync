export type TRecalibrateSession = {
  id: string;
  interviewId: string;
  aiRunId: string | null;
  questionScores: Record<string, number>;
  rubricScores: Record<string, number>;
  notes: string | null;
  timerStartedAt: string | null;
  timerEndedAt: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  createdAt: string;
  updatedAt: string;
}
