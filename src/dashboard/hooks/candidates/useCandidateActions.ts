/**
 * useCandidateActions Hook
 *
 * Handles all API interactions for candidate CRUD operations.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import type { UploadedCandidate, Interview } from '@server/lib/db';
import type { SingleCandidateFormData } from '@/common/types/candidate';

interface UseCandidateActionsReturn {
  // Single candidate add
  isAddingSingleCandidate: boolean;
  singleCandidateError: string | null;
  handleAddSingleCandidate: (
    formData: SingleCandidateFormData,
    onSuccess: (candidates: UploadedCandidate[], interviews: Interview[]) => void
  ) => Promise<void>;

  // Inline editing
  handleSaveCandidateEdit: (
    id: string,
    updates: {
      name: string;
      email: string;
      college: string;
      collegeDrive: string;
      preferredDate: string;
    },
    onSuccess: (candidates: UploadedCandidate[]) => void
  ) => Promise<void>;

  // Mapping/unmapping
  mappingCandidateId: string | null;
  setMappingCandidateId: (id: string | null) => void;
  unmappingCandidateId: string | null;
  handleMapCandidateToSlot: (
    candidate: UploadedCandidate,
    interviewId: string,
    interviews: Interview[],
    onSuccess: (interviews: Interview[]) => void,
    refetchCandidates: () => Promise<void>
  ) => Promise<void>;
  handleUnmapCandidate: (
    id: string,
    onSuccess: (candidates: UploadedCandidate[], interviews: Interview[]) => void
  ) => Promise<void>;

  // Mark as selected
  selectingCandidateId: string | null;
  handleMarkAsSelected: (
    id: string,
    onSuccess: (candidates: UploadedCandidate[]) => void
  ) => Promise<void>;

  // Resume upload
  uploadingResumeId: string | null;
  handleResumeUpload: (
    candidateId: string,
    file: File,
    onSuccess: (candidates: UploadedCandidate[]) => void
  ) => Promise<void>;

  // Delete
  handleDeleteCandidate: (
    id: string,
    onSuccess: (candidates: UploadedCandidate[]) => void
  ) => Promise<void>;
}

export function useCandidateActions(): UseCandidateActionsReturn {
  const [isAddingSingleCandidate, setIsAddingSingleCandidate] = useState(false);
  const [singleCandidateError, setSingleCandidateError] = useState<string | null>(null);
  const [mappingCandidateId, setMappingCandidateId] = useState<string | null>(null);
  const [unmappingCandidateId, setUnmappingCandidateId] = useState<string | null>(null);
  const [selectingCandidateId, setSelectingCandidateId] = useState<string | null>(null);
  const [uploadingResumeId, setUploadingResumeId] = useState<string | null>(null);

  const handleAddSingleCandidate = async (
    formData: SingleCandidateFormData,
    onSuccess: (candidates: UploadedCandidate[], interviews: Interview[]) => void
  ) => {
    setSingleCandidateError(null);
    if (!formData.name.trim()) {
      setSingleCandidateError('Please enter candidate name.');
      return;
    }
    if (!formData.email.trim()) {
      setSingleCandidateError('Please enter candidate email.');
      return;
    }
    if (!formData.date.trim()) {
      setSingleCandidateError('Please select a drive date.');
      return;
    }
    if (!formData.college.trim()) {
      setSingleCandidateError('Please enter candidate college.');
      return;
    }
    if (!formData.collegeDrive.trim()) {
      setSingleCandidateError('Please select drive college.');
      return;
    }

    setIsAddingSingleCandidate(true);
    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates: [
            {
              name: formData.name.trim(),
              email: formData.email.trim(),
              preferredDate: formData.date,
              college: formData.college.trim(),
              collegeDrive: formData.collegeDrive.trim(),
            },
          ],
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to add candidate');
      }
      const result = await res.json();
      onSuccess(result.candidates, result.interviews);
      toast.success(`Candidate ${formData.name} successfully added to the queue!`);
    } catch (err: any) {
      console.error(err);
      setSingleCandidateError(err.message || 'An error occurred adding candidate.');
    } finally {
      setIsAddingSingleCandidate(false);
    }
  };

  const handleSaveCandidateEdit = async (
    id: string,
    updates: {
      name: string;
      email: string;
      college: string;
      collegeDrive: string;
      preferredDate: string;
    },
    onSuccess: (candidates: UploadedCandidate[]) => void
  ) => {
    if (!updates.name.trim()) {
      toast.error('Name is required.');
      return;
    }
    if (!updates.email.trim()) {
      toast.error('Email is required.');
      return;
    }
    if (!updates.college.trim()) {
      toast.error('College Name of Candidate is required.');
      return;
    }
    if (!updates.collegeDrive.trim()) {
      toast.error('College Name of Drive is required.');
      return;
    }
    if (!updates.preferredDate.trim()) {
      toast.error('Drive Date is required.');
      return;
    }
    try {
      const res = await fetch(`/api/candidates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updates.name.trim(),
          email: updates.email.trim(),
          college: updates.college.trim(),
          collegeDrive: updates.collegeDrive.trim(),
          preferredDate: updates.preferredDate.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update candidate details');
      }
      const result = await res.json();
      onSuccess(result.candidates);
      toast.success('Candidate details updated successfully.');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error updating candidate details');
    }
  };

  const handleMapCandidateToSlot = async (
    candidate: UploadedCandidate,
    interviewId: string,
    interviews: Interview[],
    onSuccess: (interviews: Interview[]) => void,
    refetchCandidates: () => Promise<void>
  ) => {
    try {
      const res = await fetch('/api/interviews/assign-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId,
          candidateName: candidate.name,
          candidateEmail: candidate.email,
          sendAsTeamsMeeting: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to assign candidate');
      }
      const data = await res.json();
      // Only update if the API returned the updated interview
      if (data.interview) {
        onSuccess(interviews.map((i) => (i.id === interviewId ? data.interview : i)));
      }
      await refetchCandidates();
      toast.success(`Candidate "${candidate.name}" successfully mapped to the interview!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error occurred while mapping candidate');
    }
  };

  const handleUnmapCandidate = async (
    id: string,
    onSuccess: (candidates: UploadedCandidate[], interviews: Interview[]) => void
  ) => {
    setUnmappingCandidateId(id);
    try {
      const res = await fetch(`/api/candidates/${id}/unmap`, { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to unmap candidate.');
      onSuccess(result.candidates, result.interviews);
      toast.success('Candidate unmapped and returned to the waiting queue.');
    } catch (err: any) {
      console.error('Error unmapping candidate:', err);
      toast.error(err.message || 'Failed to unmap candidate.');
    } finally {
      setUnmappingCandidateId(null);
    }
  };

  const handleMarkAsSelected = async (
    id: string,
    onSuccess: (candidates: UploadedCandidate[]) => void
  ) => {
    setSelectingCandidateId(id);
    try {
      const res = await fetch(`/api/candidates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcomeStatus: 'SELECTED' }),
      });
      if (!res.ok) throw new Error('Failed to mark as selected');
      const result = await res.json();
      onSuccess(result.candidates);
      toast.success('Candidate marked as Selected.');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error marking candidate as selected');
    } finally {
      setSelectingCandidateId(null);
    }
  };

  const handleResumeUpload = async (
    candidateId: string,
    file: File,
    onSuccess: (candidates: UploadedCandidate[]) => void
  ) => {
    setUploadingResumeId(candidateId);
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const res = await fetch(`/api/candidates/${candidateId}/resume`, {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to upload resume.');
      onSuccess(result.candidates);
      toast.success("Resume attached. Panelists on this candidate's interview can now use the AI Copilot.");
    } catch (err: any) {
      console.error('Error uploading resume:', err);
      toast.error(err.message || 'Failed to upload resume.');
    } finally {
      setUploadingResumeId(null);
    }
  };

  const handleDeleteCandidate = async (
    id: string,
    onSuccess: (candidates: UploadedCandidate[]) => void
  ) => {
    try {
      const res = await fetch(`/api/candidates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const result = await res.json();
        onSuccess(result.candidates);
        toast.success('Candidate removed from the queue.');
      } else {
        toast.error('Failed to delete candidate.');
      }
    } catch (err) {
      console.error('Error deleting candidate:', err);
    }
  };

  return {
    isAddingSingleCandidate,
    singleCandidateError,
    handleAddSingleCandidate,
    handleSaveCandidateEdit,
    mappingCandidateId,
    setMappingCandidateId,
    unmappingCandidateId,
    handleMapCandidateToSlot,
    handleUnmapCandidate,
    selectingCandidateId,
    handleMarkAsSelected,
    uploadingResumeId,
    handleResumeUpload,
    handleDeleteCandidate,
  };
}
