import { useState, useEffect } from "react";
import { Drive } from "@server/lib/db";
import { GraphUser } from "@server/lib/graph";

interface UseInterviewFormProps {
  drives: Drive[];
  selectedDriveId: string;
  todayStr: string;
}

interface UseInterviewFormReturn {
  // Form state
  candidateName: string;
  setCandidateName: React.Dispatch<React.SetStateAction<string>>;
  candidateEmail: string;
  setCandidateEmail: React.Dispatch<React.SetStateAction<string>>;
  role: string;
  setRole: React.Dispatch<React.SetStateAction<string>>;
  duration: string;
  setDuration: React.Dispatch<React.SetStateAction<string>>;
  startDate: string;
  setStartDate: React.Dispatch<React.SetStateAction<string>>;
  endDate: string;
  setEndDate: React.Dispatch<React.SetStateAction<string>>;
  interviewType: "L1" | "L2" | "General";
  setInterviewType: React.Dispatch<React.SetStateAction<"L1" | "L2" | "General">>;
  selectedPanels: GraphUser[];
  setSelectedPanels: React.Dispatch<React.SetStateAction<GraphUser[]>>;

  // Actions
  resetForm: () => void;
  validateForm: () => string | null; // Returns error message or null if valid
}

export function useInterviewForm(
  props: UseInterviewFormProps
): UseInterviewFormReturn {
  const { drives, selectedDriveId, todayStr } = props;

  // ── Form State ─────────────────────────────────────────────────────────────
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [role, setRole] = useState("");
  const [duration, setDuration] = useState("45");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [interviewType, setInterviewType] = useState<"L1" | "L2" | "General">("L1");
  const [selectedPanels, setSelectedPanels] = useState<GraphUser[]>([]);

  // ── Effect: Sync dates with selected drive ────────────────────────────────
  useEffect(() => {
    const drive = drives.find((d) => d.id === selectedDriveId) ?? null;
    if (drive) {
      setStartDate(drive.startDate);
      setEndDate(drive.endDate);
    }
  }, [selectedDriveId, drives]);

  // ── Form Validation ────────────────────────────────────────────────────────
  const validateForm = (): string | null => {
    if (!candidateName.trim()) {
      return "Please select a candidate from the queue.";
    }
    if (!role.trim()) {
      return "Please enter the job title / focus area.";
    }
    if (!startDate) {
      return "Please select a proposed range start date.";
    }
    if (!endDate) {
      return "Please select a proposed range end date.";
    }
    if (startDate < todayStr) {
      return "Start date cannot be in the past.";
    }
    if (endDate < startDate) {
      return "End date cannot be before the start date.";
    }
    if (selectedPanels.length === 0) {
      return "Please select at least one panel member.";
    }
    return null;
  };

  // ── Form Reset ─────────────────────────────────────────────────────────────
  const resetForm = () => {
    setCandidateName("");
    setCandidateEmail("");
    setRole("");
    setDuration("45");
    setStartDate("");
    setEndDate("");
    setSelectedPanels([]);
    setInterviewType("L1");
  };

  return {
    candidateName,
    setCandidateName,
    candidateEmail,
    setCandidateEmail,
    role,
    setRole,
    duration,
    setDuration,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    interviewType,
    setInterviewType,
    selectedPanels,
    setSelectedPanels,
    resetForm,
    validateForm,
  };
}
