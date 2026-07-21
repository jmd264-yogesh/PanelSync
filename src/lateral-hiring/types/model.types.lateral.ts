export type TLateralCandidateStatus =
  | 'NEW'
  | 'SCREENING'
  | 'WAITING_FOR_INTERVIEW'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEW_COMPLETED'
  | 'OFFERED'
  | 'HIRED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type TLateralCandidate = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  positionTitle: string;
  experienceYears?: number;
  currentCompany?: string;
  currentCtc?: string;
  expectedCtc?: string;
  noticePeriodDays?: number;
  source?: string;
  status: TLateralCandidateStatus;
  resumeFileKey?: string;
  resumeSha256?: string;
  resumeUploadedAt?: string;
  mappedInterviewId?: string;
  createdAt: string;
  roleGrade?: string;
}
