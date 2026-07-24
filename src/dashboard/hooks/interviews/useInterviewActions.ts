import { useState } from "react";
import { Interview, UploadedCandidate } from "@server/lib/db";
import { toast } from "sonner";
import { getInterviewInfo } from "@common/util/interview-role";
import { generateInterviewsCSV, downloadCSV } from "@common/util/export";

interface UseInterviewActionsProps {
  interviews: Interview[];
  setInterviews: React.Dispatch<React.SetStateAction<Interview[]>>;
  candidates: UploadedCandidate[];
  setCandidates: React.Dispatch<React.SetStateAction<UploadedCandidate[]>>;
  selectedInterview: Interview | null;
  setSelectedInterview: React.Dispatch<React.SetStateAction<Interview | null>>;
  selectedInterviewForConfig: Interview | null;
  setSelectedInterviewForConfig: React.Dispatch<React.SetStateAction<Interview | null>>;
  todayStr: string;
  // Form hook return (for createInterview)
  form: {
    candidateName: string;
    candidateEmail: string;
    role: string;
    duration: string;
    startDate: string;
    endDate: string;
    interviewType: "L1" | "L2" | "General";
    selectedPanels: any[];
    resetForm: () => void;
    validateForm: () => string | null;
  };
  // Modal control for create flow
  setShowCreateForm: React.Dispatch<React.SetStateAction<boolean>>;
  setShowInterviewModal: React.Dispatch<React.SetStateAction<boolean>>;
  setDetailTab: React.Dispatch<React.SetStateAction<"overview" | "panels" | "booking" | "feedback">>;
}

interface UseInterviewActionsReturn {
  // Create interview state
  isLoading: boolean;
  createError: string | null;
  setCreateError: React.Dispatch<React.SetStateAction<string | null>>;

  // Resend invite state
  resendingPanelId: string | null;

  // Feedback reminder state
  sendingFeedbackReminderId: string | null;

  // Date update state
  isUpdatingDates: boolean;
  editStartDate: string;
  setEditStartDate: React.Dispatch<React.SetStateAction<string>>;
  editEndDate: string;
  setEditEndDate: React.Dispatch<React.SetStateAction<string>>;
  isEditingDates: boolean;
  setIsEditingDates: React.Dispatch<React.SetStateAction<boolean>>;

  // Actions
  createInterview: (e: React.FormEvent) => Promise<void>;
  deleteInterview: (id: string) => Promise<void>;
  updateDates: (e: React.FormEvent, targetInterviewOverride?: Interview) => Promise<void>;
  resendInvite: (interviewId: string, panelId: string) => Promise<void>;
  sendFeedbackReminder: (interviewId: string, e: React.MouseEvent) => Promise<void>;
  exportCSV: () => void;
}

export function useInterviewActions(
  props: UseInterviewActionsProps
): UseInterviewActionsReturn {
  const {
    interviews,
    setInterviews,
    candidates,
    setCandidates,
    selectedInterview,
    setSelectedInterview,
    selectedInterviewForConfig,
    setSelectedInterviewForConfig,
    todayStr,
    form,
    setShowCreateForm,
    setShowInterviewModal,
    setDetailTab,
  } = props;

  // ── Create Interview State ─────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Communication State ────────────────────────────────────────────────────
  const [resendingPanelId, setResendingPanelId] = useState<string | null>(null);
  const [sendingFeedbackReminderId, setSendingFeedbackReminderId] = useState<
    string | null
  >(null);

  // ── Date Edit State ────────────────────────────────────────────────────────
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [isUpdatingDates, setIsUpdatingDates] = useState(false);

  // ── Actions ────────────────────────────────────────────────────────────────

  const createInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    // Validate form using hook
    const validationError = form.validateForm();
    if (validationError) {
      setCreateError(validationError);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/interviews/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName: form.candidateName,
          candidateEmail: form.candidateEmail,
          role: `${form.interviewType} - ${form.role}`,
          duration: parseInt(form.duration, 10),
          startDate: form.startDate,
          endDate: form.endDate,
          panels: form.selectedPanels,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(
          errData.error || "Failed to submit interview invitation.",
        );
      }
      const result = await res.json();
      setInterviews([result.interview, ...interviews]);
      form.resetForm();
      setShowCreateForm(false);
      setCreateError(null);
      setSelectedInterview(result.interview);
      setShowInterviewModal(true);
      setDetailTab("overview");
    } catch (error: any) {
      console.error(error);
      setCreateError(error.message || "An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const deleteInterview = async (id: string) => {
    try {
      const res = await fetch(`/api/interviews/${id}`, { method: "DELETE" });
      if (res.ok) {
        setInterviews(interviews.filter((i) => i.id !== id));
        if (selectedInterview?.id === id) setSelectedInterview(null);
        toast.success("Interview record deleted.");
      } else {
        toast.error("Failed to delete interview");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateDates = async (
    e: React.FormEvent,
    targetInterviewOverride?: Interview,
  ) => {
    if (e) e.preventDefault();
    const target = targetInterviewOverride || selectedInterview;
    if (!target) return;
    if (editStartDate < todayStr) {
      toast.error("Start date cannot be in the past.");
      return;
    }
    if (editEndDate < editStartDate) {
      toast.error("End date cannot be before the start date.");
      return;
    }
    setIsUpdatingDates(true);
    try {
      const info = getInterviewInfo(target.role);

      let type: "L1" | "L2" | "General" = "General";

      if (info.isL1) {
        type = "L1";
      } else if (info.isL2) {
        type = "L2";
      }
      const [startH, startM] = (type === "L2" ? "14:00" : "10:00")
        .split(":")
        .map(Number);
      const [endH, endM] = (type === "L2" ? "17:00" : "13:00")
        .split(":")
        .map(Number);
      const generatedSlots: { startTime: string; endTime: string }[] = [];
      const currentDay = new Date(editStartDate);
      const endDay = new Date(editEndDate);
      while (currentDay <= endDay) {
        const year = currentDay.getFullYear();
        const month = currentDay.getMonth();
        const date = currentDay.getDate();
        const dayStart = new Date(year, month, date, startH, startM, 0);
        const dayEnd = new Date(year, month, date, endH, endM, 0);
        let time = dayStart.getTime();
        while (time + 30 * 60 * 1000 <= dayEnd.getTime()) {
          generatedSlots.push({
            startTime: new Date(time).toISOString(),
            endTime: new Date(time + 30 * 60 * 1000).toISOString(),
          });
          time += 30 * 60 * 1000;
        }
        currentDay.setDate(currentDay.getDate() + 1);
      }
      const res = await fetch(`/api/interviews/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: editStartDate,
          endDate: editEndDate,
          slots: generatedSlots,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update interview dates.");
      }
      const data = await res.json();
      setInterviews(
        interviews.map((i) => (i.id === target.id ? data.interview : i)),
      );
      if (targetInterviewOverride) {
        setSelectedInterviewForConfig(data.interview);
      } else {
        setSelectedInterview(data.interview);
        setIsEditingDates(false);
      }
      toast.success(
        "Successfully updated interview date range and reset proposed availability slots.",
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error updating dates");
    } finally {
      setIsUpdatingDates(false);
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
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to resend invitation");
      }
      toast.success("Successfully resent Teams notification reminder!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error resending invitation");
    } finally {
      setResendingPanelId(null);
    }
  };

  const sendFeedbackReminder = async (
    interviewId: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setSendingFeedbackReminderId(interviewId);
    try {
      const res = await fetch("/api/interviews/send-feedback-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reminder");
      const sentCount = data.sent?.length ?? 0;
      const skippedCount = data.skipped?.length ?? 0;
      toast.success(
        `Feedback reminder sent to ${sentCount} panelist${sentCount !== 1 ? "s" : ""}${skippedCount > 0 ? ` (${skippedCount} skipped — same user)` : ""}.`,
      );
    } catch (err: any) {
      toast.error(`Failed to send reminder: ${err.message}`);
    } finally {
      setSendingFeedbackReminderId(null);
    }
  };

  const exportCSV = () => {
    const csvContent = generateInterviewsCSV(interviews);
    const filename = `interviews_export_${new Date().toISOString().split("T")[0]}.csv`;
    downloadCSV(csvContent, filename);
    toast.success("Interviews exported successfully.");
  };

  return {
    isLoading,
    createError,
    setCreateError,
    resendingPanelId,
    sendingFeedbackReminderId,
    isUpdatingDates,
    editStartDate,
    setEditStartDate,
    editEndDate,
    setEditEndDate,
    isEditingDates,
    setIsEditingDates,
    createInterview,
    deleteInterview,
    updateDates,
    resendInvite,
    sendFeedbackReminder,
    exportCSV,
  };
}
