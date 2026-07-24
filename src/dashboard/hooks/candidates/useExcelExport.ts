/**
 * useExcelExport Hook
 *
 * Handles exporting candidate data to Excel format with auto-fitted columns.
 */

import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { getCandidateRoundResults } from '@/common/util/candidates/roundResultCalculation';
import type { UploadedCandidate, Interview, Drive } from '@server/lib/db';
import type { CandidateExportRow } from '@/common/types/candidate';

export function useExcelExport() {
  const exportCandidates = (
    filteredCandidates: UploadedCandidate[],
    interviews: Interview[],
    activeDrive: Drive | null
  ) => {
    if (filteredCandidates.length === 0) {
      toast.error('No candidates to export.');
      return;
    }

    try {
      const dataToExport: CandidateExportRow[] = filteredCandidates.map((candidate) => {
        let mappedIntv = candidate.mappedInterviewId
          ? interviews.find((i) => i.id === candidate.mappedInterviewId)
          : null;

        // Fallback by email only applies to candidates the DB already considers
        // MAPPED (a legacy safety net for rows missing mappedInterviewId) — never
        // for WAITING candidates, since email addresses get reused across
        // unrelated drives/uploads and would otherwise falsely match someone else's interview.
        if (!mappedIntv && candidate.email && candidate.status === 'MAPPED') {
          mappedIntv =
            interviews.find(
              (i) =>
                i.candidateEmail.toLowerCase() === candidate.email.toLowerCase() &&
                i.candidateName !== 'Pending Assignment' &&
                i.candidateEmail !== 'pending@assign.com'
            ) || null;
        }

        const { l1Result, l2Result } = getCandidateRoundResults(candidate, interviews);

        const mappedInterviewStr = mappedIntv
          ? `${mappedIntv.role} (${
              mappedIntv.scheduledSlotStart
                ? new Date(mappedIntv.scheduledSlotStart).toLocaleString()
                : 'Pending Slot'
            })`
          : '—';

        return {
          'Candidate Name': candidate.name,
          'Candidate Email': candidate.email,
          'Candidate College': candidate.college || '—',
          'College of Drive': candidate.collegeDrive || '—',
          'Drive Date': candidate.preferredDate
            ? new Date(candidate.preferredDate).toLocaleDateString('en-US')
            : '—',
          'Uploaded At': new Date(candidate.createdAt).toLocaleDateString('en-US'),
          'Queue Status': candidate.status === 'MAPPED' || !!mappedIntv ? 'Mapped' : 'Waiting',
          'L1 Result': l1Result,
          'L2 Result': l2Result,
          'Mapped Interview': mappedInterviewStr,
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);

      // Auto-fit column widths
      const colWidths = Object.keys(dataToExport[0]).map((key) => {
        const maxLength = Math.max(
          key.length,
          ...dataToExport.map((row: any) => String(row[key] || '').length)
        );
        return { wch: maxLength + 2 };
      });
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates');

      const fileName = activeDrive
        ? `Candidates_Drive_${activeDrive.collegeName.replace(/[^a-zA-Z0-9]/g, '_')}_${
            new Date().toISOString().split('T')[0]
          }.xlsx`
        : `Candidate_Queue_${new Date().toISOString().split('T')[0]}.xlsx`;

      XLSX.writeFile(workbook, fileName);
      toast.success('Candidate list exported successfully!');
    } catch (err: any) {
      console.error('Failed to export candidates:', err);
      toast.error('Failed to export candidate list.');
    }
  };

  return { exportCandidates };
}
