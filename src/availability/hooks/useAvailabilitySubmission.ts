/**
 * useAvailabilitySubmission Hook
 *
 * Manages state and actions for Flow B (Availability Builder / Traditional Flow)
 * Handles slot building, validation, and availability submission
 */

import { useState } from "react";
import { TimeSlot } from "@/common/types/availability";
import { Interview, InterviewPanel } from "@server/lib/db";
import { validateSlot } from "@/common/util/interviews/slotValidation";

interface UseAvailabilitySubmissionProps {
  panel: InterviewPanel;
  interview: Interview;
  currentTime: number; // Pass from parent to avoid Date.now() in render
}

interface UseAvailabilitySubmissionReturn {
  // State
  slots: TimeSlot[];
  inputDate: string;
  inputStart: string;
  inputEnd: string;
  isSubmitted: boolean;
  isSubmitting: boolean;
  errorMsg: string;
  minDate: string;
  maxDate: string;

  // Actions
  setInputDate: (date: string) => void;
  setInputStart: (time: string) => void;
  setInputEnd: (time: string) => void;
  handleAddSlot: (e: React.FormEvent) => void;
  handleRemoveSlot: (index: number) => void;
  handleSubmitSlots: () => Promise<void>;
  setErrorMsg: (msg: string) => void;
}

export function useAvailabilitySubmission({
  panel,
  interview,
  currentTime,
}: UseAvailabilitySubmissionProps): UseAvailabilitySubmissionReturn {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [inputDate, setInputDate] = useState("");
  const [inputStart, setInputStart] = useState("09:00");
  const [inputEnd, setInputEnd] = useState("17:00");
  const [isSubmitted, setIsSubmitted] = useState(panel.status === "SUBMITTED");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const minDate = new Date(interview.startDate).toISOString().split("T")[0];
  const maxDate = new Date(interview.endDate).toISOString().split("T")[0];

  const handleAddSlot = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // Check if a slot already exists (limit to one slot per original logic)
    if (slots.length > 0) {
      setErrorMsg(
        "You can only add one availability slot. Remove the existing slot to add a new one."
      );
      return;
    }

    // Validate date is selected
    if (!inputDate) {
      setErrorMsg("Please select a date.");
      return;
    }

    // Build time slot object
    const startStr = `${inputDate}T${inputStart}`;
    const endStr = `${inputDate}T${inputEnd}`;
    const slot: TimeSlot = {
      startTime: new Date(startStr).toISOString(),
      endTime: new Date(endStr).toISOString(),
    };

    // Comprehensive validation
    const validation = validateSlot(
      slot,
      interview.startDate,
      interview.endDate,
      interview.duration,
      currentTime
    );

    if (!validation.valid) {
      setErrorMsg(validation.reason || "Invalid slot.");
      return;
    }

    // Add slot and reset inputs
    setSlots([slot]);
    setInputDate("");
    setInputStart("");
    setInputEnd("");
    setErrorMsg("");
  };

  const handleRemoveSlot = (index: number) => {
    setSlots(slots.filter((_, idx) => idx !== index));
  };

  const handleSubmitSlots = async () => {
    if (slots.length === 0) {
      setErrorMsg("Please add at least one available slot.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/availability/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: panel.token,
          slots,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit availability.");
      }

      setIsSubmitted(true);
    } catch (err) {
      console.error(err);
      setErrorMsg(
        (err as Error).message || "Error occurred while saving availability."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    slots,
    inputDate,
    inputStart,
    inputEnd,
    isSubmitted,
    isSubmitting,
    errorMsg,
    minDate,
    maxDate,
    setInputDate,
    setInputStart,
    setInputEnd,
    handleAddSlot,
    handleRemoveSlot,
    handleSubmitSlots,
    setErrorMsg,
  };
}
