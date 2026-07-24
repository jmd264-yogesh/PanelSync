/**
 * Candidate Type Definitions
 *
 * Type definitions for candidate-related components, hooks, and utilities.
 */

import type { RoundResult } from '@/common/constants/candidateStatus';

/**
 * Candidate filters state
 */
export interface CandidateFilters {
  searchQuery: string;
  statusFilter: 'all' | 'WAITING' | 'MAPPED';
  collegeFilter: string;
  dateFilter: string;
  scopeToActiveDrive: boolean;
}

/**
 * Candidate upload options
 */
export interface CandidateUploadOptions {
  defaultCollege: string;
  defaultDate: string;
}

/**
 * Parsed candidate data from Excel/CSV
 */
export interface ParsedCandidate {
  name: string;
  email: string;
  preferredDate?: string;
  college?: string;
  collegeDrive?: string;
  resumeLink?: string;
}

/**
 * Single candidate form data
 */
export interface SingleCandidateFormData {
  name: string;
  email: string;
  date: string;
  college: string;
  collegeDrive: string;
}

/**
 * Candidate round results
 */
export interface CandidateRoundResults {
  l1Result: RoundResult;
  l2Result: RoundResult;
}

/**
 * Excel export data row
 */
export interface CandidateExportRow {
  'Candidate Name': string;
  'Candidate Email': string;
  'Candidate College': string;
  'College of Drive': string;
  'Drive Date': string;
  'Uploaded At': string;
  'Queue Status': string;
  'L1 Result': string;
  'L2 Result': string;
  'Mapped Interview': string;
}
