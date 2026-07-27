import { useState } from 'react';
import { Panelist, Interview } from '@server/lib/db';
import { GraphUser } from '@server/lib/graph';
import { SlotRequest } from '@/common/types/panelist';
import { toast } from 'sonner';

interface UsePanelistActionsParams {
  panelists: Panelist[];
  setPanelists: React.Dispatch<React.SetStateAction<Panelist[]>>;
  setInterviews: React.Dispatch<React.SetStateAction<Interview[]>>;
  interviews: Interview[];
}

export function usePanelistActions({
  panelists,
  setPanelists,
  setInterviews,
  interviews,
}: UsePanelistActionsParams) {
  const [isAdminSaving, setIsAdminSaving] = useState(false);
  const [isRequestingSlot, setIsRequestingSlot] = useState(false);

  const addPanelist = async (user: GraphUser, roles: ('L1' | 'L2')[]): Promise<boolean> => {
    if (roles.length === 0) {
      toast.error('Please select at least one role capability (L1 or L2).');
      return false;
    }

    setIsAdminSaving(true);
    try {
      const res = await fetch('/api/panelists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: {
            id: user.id,
            displayName: user.displayName,
            email: user.mail || user.userPrincipalName,
          },
          roles,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save panelist.');
      }

      const newPanelist = await res.json();
      const existsIdx = panelists.findIndex((p) => p.id === newPanelist.id);

      if (existsIdx !== -1) {
        const updated = [...panelists];
        updated[existsIdx] = newPanelist;
        setPanelists(updated);
      } else {
        setPanelists([...panelists, newPanelist]);
      }

      toast.success('Panelist saved successfully.');
      return true;
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error saving panelist');
      return false;
    } finally {
      setIsAdminSaving(false);
    }
  };

  const deletePanelist = async (id: string) => {
    try {
      const res = await fetch(`/api/panelists/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPanelists(panelists.filter((p) => p.id !== id));
        toast.success('Panelist removed from the pool.');
      } else {
        toast.error('Failed to remove panelist.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error removing panelist');
    }
  };

  const sendSlotRequest = async (
    selectedPanelists: Panelist[],
    request: SlotRequest & { hiringType: string; candidateName: string; candidateEmail: string }
  ) => {
    if (selectedPanelists.length === 0) {
      toast.error('No panelists selected.');
      return;
    }

    if (!request.collegeName || !request.collegeName.trim()) {
      toast.error('College / Institution name is required.');
      return;
    }

    if (!request.startDate || !request.endDate) {
      toast.error('No drive window available. Set an active drive in the Drives tab.');
      return;
    }

    if (request.endDate < request.startDate) {
      toast.error('End date cannot be before the start date.');
      return;
    }

    if (request.slots.length === 0) {
      toast.error('Please select or enable at least one proposed slot option.');
      return;
    }

    setIsRequestingSlot(true);
    try {
      const res = await fetch('/api/interviews/request-panelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panelists: selectedPanelists,
          duration: request.duration,
          startDate: request.startDate,
          endDate: request.endDate,
          interviewType: request.interviewType,
          slots: request.slots,
          collegeName: request.collegeName,
          candidateName: request.candidateName,
          candidateEmail: request.candidateEmail,
          hiringType: request.hiringType,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to dispatch slot request.');
      }

      const result = await res.json();

      // Update local state with bulk-created interviews
      if (result.interviews) {
        setInterviews([...result.interviews, ...interviews]);
      } else if (result.interview) {
        setInterviews([result.interview, ...interviews]);
      }

      toast.success(
        `Teams notification sent successfully to ${selectedPanelists
          .map((p) => p.displayName)
          .join(', ')}!`
      );
      return true;
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error occurred while sending slot request.');
      return false;
    } finally {
      setIsRequestingSlot(false);
    }
  };

  return {
    addPanelist,
    deletePanelist,
    sendSlotRequest,
    isAdminSaving,
    isRequestingSlot,
  };
}
