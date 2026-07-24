/**
 * ExportButton Component
 *
 * Button to export filtered candidate list to Excel.
 */

'use client';

import React from 'react';
import { useExcelExport } from '@/dashboard/hooks/candidates/useExcelExport';
import type { UploadedCandidate, Interview, Drive } from '@server/lib/db';

interface ExportButtonProps {
  filteredCandidates: UploadedCandidate[];
  interviews: Interview[];
  activeDrive: Drive | null;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  filteredCandidates,
  interviews,
  activeDrive,
}) => {
  const { exportCandidates } = useExcelExport();

  return (
    <button
      onClick={() => exportCandidates(filteredCandidates, interviews, activeDrive)}
      className="btn btn-secondary"
      style={{
        fontSize: '0.75rem',
        height: '32px',
        padding: '0 0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        borderRadius: 'var(--radius-sm)',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid var(--border-glass)',
        color: 'var(--text-main)',
        cursor: 'pointer',
      }}
    >
      <span>Export to Excel</span>
    </button>
  );
};
