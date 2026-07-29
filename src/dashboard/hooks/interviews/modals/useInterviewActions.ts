/**
 * Hook for managing interview modal actions (book, cancel, resend, delete, update dates)
 */

import { useState } from "react";
import { toast } from "sonner";
import { Interview } from "@server/lib/db";
import { TimeSlot } from "@common/util/interviews/slotOverlapCalculation";

export interface UseInterviewActionsReturn {
  isBooking: boolean;
  isCancelling: boolean;
  isUpdatingDates: boolean;
  isDeleting: boolean;
  resendingPanelId: string | null;
  sendingFeedbackReminderId: string | null;
  bookSlot: (
    interviewId: string,
    slot: TimeSlot,
    description?: string
  ) => Promise<void>;
  cancelBooking: (interviewId: string) => Promise<void>;
  resendInvite: (interviewId: string, panelId: string) => Promise<void>;
  sendFeedbackReminder: (interviewId: string) => Promise<void>;
  updateDates: (
    interviewId: string,
    startDate: string,
    endDate: string
  ) => Promise<void>;
  deleteInterview: (interviewId: string) => Promise<void>;
}

export function useInterviewActions(
  onSuccess?: (interview?: Interview) => void
): UseInterviewActionsReturn {
  const [isBooking, setIsBooking] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isUpdatingDates, setIsUpdatingDates] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resendingPanelId, setResendingPanelId] = useState<string | null>(null);
  const [sendingFeedbackReminderId, setSendingFeedbackReminderId] =
    useState<string | null>(null);

  const bookSlot = async (
    interviewId: string,
    slot: TimeSlot,
    description?: string
  ) => {
    setIsBooking(true);
    try {
      const res = await fetch("/api/interviews/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId,
          slotStart: slot.start,
          slotEnd: slot.end,
          description,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to book slot.");
      }
      toast.success("Interview booked and Teams meeting created!");
      onSuccess?.(result.interview);
    } catch (err: any) {
      toast.error(err.message || "Failed to book slot.");
      throw err;
    } finally {
      setIsBooking(false);
    }
  };

  const cancelBooking = async (interviewId: string) => {
    setIsCancelling(true);
    try {
      const res = await fetch("/api/interviews/cancel-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to cancel booking.");
      }
      toast.success("Booking cancelled.");
      onSuccess?.(result.interview);
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel booking.");
      throw err;
    } finally {
      setIsCancelling(false);
    }
  };

  const resendInvite = async (interviewId: string, panelId: string) => {
    setResendingPanelId(panelId);
    try {
      const res = await fetch("/api/interviews/resend-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId, panelId }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to resend invite.");
      }
      toast.success("Invite resent.");
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to resend invite.");
      throw err;
    } finally {
      setResendingPanelId(null);
    }
  };

  const sendFeedbackReminder = async (interviewId: string) => {
    setSendingFeedbackReminderId(interviewId);
    try {
      const res = await fetch("/api/interviews/send-feedback-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to send reminder.");
      }
      toast.success("Reminder sent to panelists.");
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to send reminder.");
      throw err;
    } finally {
      setSendingFeedbackReminderId(null);
    }
  };

  const updateDates = async (
    interviewId: string,
    startDate: string,
    endDate: string
  ) => {
    setIsUpdatingDates(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to update dates.");
      }
      toast.success("Dates updated. Availability reset.");
      onSuccess?.(result.interview);
    } catch (err: any) {
      toast.error(err.message || "Failed to update dates.");
      throw err;
    } finally {
      setIsUpdatingDates(false);
    }
  };

  const deleteInterview = async (interviewId: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to delete interview.");
      }
      toast.success("Interview deleted.");
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete interview.");
      throw err;
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    isBooking,
    isCancelling,
    isUpdatingDates,
    isDeleting,
    resendingPanelId,
    sendingFeedbackReminderId,
    bookSlot,
    cancelBooking,
    resendInvite,
    sendFeedbackReminder,
    updateDates,
    deleteInterview,
  };
}
