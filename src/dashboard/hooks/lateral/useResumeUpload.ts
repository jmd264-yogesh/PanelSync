/**
 * Hook for managing resume upload for lateral candidates
 */

import { useState } from "react";
import { toast } from "sonner";
import { LateralCandidate } from "@server/lib/db";

export interface UseResumeUploadReturn {
  uploadingId: string | null;
  uploadProgress: number;
  uploadError: string | null;
  uploadResume: (candidateId: string, file: File) => Promise<void>;
  replaceResume: (candidateId: string, file: File) => Promise<void>;
}

export function useResumeUpload(
  setCandidates: React.Dispatch<React.SetStateAction<LateralCandidate[]>>
): UseResumeUploadReturn {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadResume = async (candidateId: string, file: File) => {
    setUploadingId(candidateId);
    setUploadProgress(0);
    setUploadError(null);

    try {
      // Validate file type
      const validTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];
      if (!validTypes.includes(file.type)) {
        throw new Error(
          "Invalid file type. Please upload a PDF or Word document."
        );
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error("File size exceeds 10MB limit.");
      }

      setUploadProgress(25);

      const formData = new FormData();
      formData.append("resume", file);

      setUploadProgress(50);

      const res = await fetch(`/api/lateral-candidates/${candidateId}/resume`, {
        method: "POST",
        body: formData,
      });

      setUploadProgress(75);

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to upload resume.");
      }

      setUploadProgress(100);
      setCandidates(result.candidates);
      toast.success("Resume attached.");
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload resume.");
      toast.error(err.message || "Failed to upload resume.");
      throw err;
    } finally {
      setTimeout(() => {
        setUploadingId(null);
        setUploadProgress(0);
        setUploadError(null);
      }, 1000);
    }
  };

  const replaceResume = async (candidateId: string, file: File) => {
    // Same implementation as uploadResume (replacing is the same API call)
    return uploadResume(candidateId, file);
  };

  return {
    uploadingId,
    uploadProgress,
    uploadError,
    uploadResume,
    replaceResume,
  };
}
