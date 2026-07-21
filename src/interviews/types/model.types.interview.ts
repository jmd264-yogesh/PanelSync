export type THiringType = "CAMPUS" | "LATERAL";

export type TInterviewStatus = 'PENDING' | 'COLLECTED' | 'SCHEDULED' | 'CANCELLED';

export type TPanelStatus = 'PENDING' | 'SUBMITTED' | 'REJECTED';

export type TPanelAvailability = {
  id: string;
  panelId: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
}

export type TInterviewPanel = {
  id: string;
  interviewId: string;
  userId: string;       // MS Graph user ID
  name: string;
  email: string;
  token: string;        // Secure unique token for URL access
  status: TPanelStatus;
  submittedAt?: string; // ISO string
  feedback?: string | null;
  decision?: string | null;
  availabilities: TPanelAvailability[];
}

export type TInterview = {
  id: string;
  candidateName: string;
  candidateEmail: string;
  role: string;
  duration: number;        // minutes
  startDate: string;       // ISO string
  endDate: string;         // ISO string
  status: TInterviewStatus;
  hiringType: THiringType;
  teamsMeetingUrl?: string;
  calendarEventId?: string;
  scheduledSlotStart?: string; // ISO string
  scheduledSlotEnd?: string;   // ISO string
  createdAt: string;       // ISO string
  updatedAt: string;       // ISO string
  panels: TInterviewPanel[];
}

export type TPanelistInterview = {
  interviewId: string;
  role: string;
  hiringType: THiringType;
  duration: number;
  scheduledSlotStart: string;
  scheduledSlotEnd: string;
  teamsMeetingUrl: string | null;
  candidateName: string;
  candidateEmail: string;
  candidateId: string | null;
  outcomeStatus: string | null;
  panelId: string;
  panelDecision: string | null;
  panelFeedback: string | null;
  panelistRoles: string[];
  panelSubmittedAt: string | null;
}

export type TAiRun = {
  id: string;
  interviewId: string;
  candidateId: string | null;
  triggeredByEmail: string;
  status: 'QUEUED' | 'PARSING' | 'EXTRACTING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  criteria: Record<string, any> | null;
  spec: Record<string, any> | null;
  resumeDigest: Record<string, any> | null;
  questions: Record<string, any> | null;
  model: string | null;
  promptVersion: string | null;
  tokenUsage: Record<string, any> | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}
