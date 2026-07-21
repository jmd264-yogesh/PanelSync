export type TCandidateStatus = 'WAITING' | 'MAPPED';

export type TUploadedCandidate = {
  id: string;
  name: string;
  email: string;
  status: TCandidateStatus;
  mappedInterviewId?: string;
  preferredDate: string;  // Required field
  outcomeStatus?: string;
  college: string;        // Required field
  collegeDrive: string;   // Required field
  resumeFileKey?: string;
  resumeSha256?: string;
  resumeUploadedAt?: string;
  createdAt: string;
}
