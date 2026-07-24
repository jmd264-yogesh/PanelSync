/**
 * useCandidateFilters Hook
 *
 * Manages filtering state and logic for the candidate queue.
 */

import { useState, useEffect, useMemo } from 'react';
import type { UploadedCandidate, Drive } from '@server/lib/db';
import type { CandidateFilters } from '@/common/types/candidate';

interface UseCandidateFiltersReturn {
  filters: CandidateFilters;
  filteredCandidates: UploadedCandidate[];
  setCandidateSearchQuery: (query: string) => void;
  setCandidateStatusFilter: (status: 'all' | 'WAITING' | 'MAPPED') => void;
  setCandidateCollegeFilter: (college: string) => void;
  setCandidateDateFilter: (date: string) => void;
  setScopeToActiveDrive: (scope: boolean) => void;
  resetFilters: () => void;
}

export function useCandidateFilters(
  candidates: UploadedCandidate[],
  activeDrive: Drive | null
): UseCandidateFiltersReturn {
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<
    'all' | 'WAITING' | 'MAPPED'
  >('all');
  const [candidateCollegeFilter, setCandidateCollegeFilter] = useState<string>('all');
  const [candidateDateFilter, setCandidateDateFilter] = useState<string>('all');
  const [scopeToActiveDrive, setScopeToActiveDrive] = useState<boolean>(!!activeDrive);

  // Auto-scope to active drive when it changes
  useEffect(() => {
    if (activeDrive) {
      setScopeToActiveDrive(true);
    } else {
      setScopeToActiveDrive(false);
    }
  }, [activeDrive]);

  // Compute filtered candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const matchesQuery =
        c.name.toLowerCase().includes(candidateSearchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(candidateSearchQuery.toLowerCase());

      const matchesStatus =
        candidateStatusFilter === 'all' || c.status === candidateStatusFilter;

      const matchesCollege =
        candidateCollegeFilter === 'all' ||
        (c.collegeDrive &&
          c.collegeDrive.toLowerCase() === candidateCollegeFilter.toLowerCase()) ||
        (c.college && c.college.toLowerCase() === candidateCollegeFilter.toLowerCase());

      const matchesDate =
        candidateDateFilter === 'all' || c.preferredDate === candidateDateFilter;

      const matchesActiveDrive =
        !scopeToActiveDrive ||
        !activeDrive ||
        (((c.collegeDrive &&
          c.collegeDrive.toLowerCase() === activeDrive.collegeName.toLowerCase()) ||
          (c.college &&
            c.college.toLowerCase() === activeDrive.collegeName.toLowerCase())) &&
          c.preferredDate >= activeDrive.startDate &&
          c.preferredDate <= activeDrive.endDate);

      return (
        matchesQuery &&
        matchesStatus &&
        matchesCollege &&
        matchesDate &&
        matchesActiveDrive
      );
    });
  }, [
    candidates,
    candidateSearchQuery,
    candidateStatusFilter,
    candidateCollegeFilter,
    candidateDateFilter,
    scopeToActiveDrive,
    activeDrive,
  ]);

  const resetFilters = () => {
    setCandidateSearchQuery('');
    setCandidateStatusFilter('all');
    setCandidateCollegeFilter('all');
    setCandidateDateFilter('all');
    setScopeToActiveDrive(!!activeDrive);
  };

  return {
    filters: {
      searchQuery: candidateSearchQuery,
      statusFilter: candidateStatusFilter,
      collegeFilter: candidateCollegeFilter,
      dateFilter: candidateDateFilter,
      scopeToActiveDrive,
    },
    filteredCandidates,
    setCandidateSearchQuery,
    setCandidateStatusFilter,
    setCandidateCollegeFilter,
    setCandidateDateFilter,
    setScopeToActiveDrive,
    resetFilters,
  };
}
