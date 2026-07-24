/**
 * useCandidateUpload Hook
 *
 * Handles Excel/CSV file upload, parsing, and API submission for bulk candidate uploads.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { parseExcelFile } from '@/common/util/candidates/excelParser';
import type { UploadedCandidate, Interview } from '@server/lib/db';

interface UseCandidateUploadReturn {
  isUploading: boolean;
  uploadError: string | null;
  uploadSuccessMessage: string | null;
  handleExcelUpload: (
    file: File,
    defaultCollege: string,
    defaultDate: string,
    onSuccess: (candidates: UploadedCandidate[], interviews: Interview[], mappedCount: number, resumeLinkFailures?: any[]) => void
  ) => Promise<void>;
  clearMessages: () => void;
}

export function useCandidateUpload(): UseCandidateUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);

  const handleExcelUpload = async (
    file: File,
    defaultCollege: string,
    defaultDate: string,
    onSuccess: (candidates: UploadedCandidate[], interviews: Interview[], mappedCount: number, resumeLinkFailures?: any[]) => void
  ) => {
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccessMessage(null);

    if (
      !defaultCollege ||
      defaultCollege === '_none_placeholder' ||
      defaultCollege.trim() === ''
    ) {
      setUploadError(
        'Please select a default College Name of Drive from the dropdown above before uploading.'
      );
      setIsUploading(false);
      return;
    }

    try {
      const parsedCandidates = await parseExcelFile(file, defaultCollege, defaultDate);

      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidates: parsedCandidates }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to upload candidates');
      }

      const result = await res.json();
      setUploadSuccessMessage(
        `Successfully uploaded ${parsedCandidates.length} candidate(s). ${result.mappedCount} candidate(s) were automatically mapped to L1 panels.`
      );

      if (result.resumeLinkFailures?.length) {
        toast.error(
          `${result.resumeLinkFailures.length} resume link(s) could not be attached: ${result.resumeLinkFailures
            .map((f: { name: string; error: string }) => `${f.name} (${f.error})`)
            .join('; ')}`
        );
      }

      onSuccess(result.candidates, result.interviews, result.mappedCount, result.resumeLinkFailures);
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || 'An error occurred during file parsing or upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const clearMessages = () => {
    setUploadError(null);
    setUploadSuccessMessage(null);
  };

  return {
    isUploading,
    uploadError,
    uploadSuccessMessage,
    handleExcelUpload,
    clearMessages,
  };
}
