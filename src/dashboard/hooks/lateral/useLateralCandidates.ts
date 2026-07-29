/**
 * Hook for managing lateral candidate state and actions
 */

import { useState } from "react";
import { toast } from "sonner";
import { LateralCandidate } from "@server/lib/db";

export interface UseLateralCandidatesReturn {
  candidates: LateralCandidate[];
  isLoading: boolean;
  addCandidate: (candidateData: Partial<LateralCandidate>) => Promise<void>;
  updateCandidateStatus: (
    id: string,
    status: LateralCandidate["status"]
  ) => Promise<void>;
  deleteCandidate: (id: string) => Promise<void>;
  refreshCandidates: () => Promise<void>;
  updatingStatusId: string | null;
}

export function useLateralCandidates(
  initialCandidates: LateralCandidate[],
  setCandidates: React.Dispatch<React.SetStateAction<LateralCandidate[]>>
): UseLateralCandidatesReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const addCandidate = async (candidateData: Partial<LateralCandidate>) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/lateral-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(candidateData),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to add candidate.");
      }
      setCandidates(result.candidates);
      toast.success("Lateral candidate added.");
    } catch (err: any) {
      toast.error(err.message || "Failed to add candidate.");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateCandidateStatus = async (
    id: string,
    status: LateralCandidate["status"]
  ) => {
    setUpdatingStatusId(id);
    try {
      const res = await fetch(`/api/lateral-candidates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to update status.");
      }
      setCandidates(result.candidates);
      toast.success("Status updated.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update status.");
      throw err;
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const deleteCandidate = async (id: string) => {
    try {
      const res = await fetch(`/api/lateral-candidates/${id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to remove candidate.");
      }
      setCandidates(result.candidates);
      toast.success("Candidate removed.");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove candidate.");
      throw err;
    }
  };

  const refreshCandidates = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/lateral-candidates");
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to fetch candidates.");
      }
      setCandidates(result.candidates);
    } catch (err: any) {
      toast.error(err.message || "Failed to refresh candidates.");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    candidates: initialCandidates,
    isLoading,
    addCandidate,
    updateCandidateStatus,
    deleteCandidate,
    refreshCandidates,
    updatingStatusId,
  };
}
