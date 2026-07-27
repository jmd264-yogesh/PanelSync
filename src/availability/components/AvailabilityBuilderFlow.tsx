/**
 * AvailabilityBuilderFlow Component (Flow B) - Refactored
 *
 * Traditional availability submission flow for regular candidate interviews
 * Now using extracted smaller components
 */

"use client";

import React from "react";
import { Interview, InterviewPanel } from "@server/lib/db";
import { Loader2 } from "lucide-react";
import { useAvailabilitySubmission } from "@/availability/hooks/useAvailabilitySubmission";
import { AvailabilitySuccessScreen } from "./builder/AvailabilitySuccessScreen";
import { InterviewMetadataCard } from "./builder/InterviewMetadataCard";
import { SlotBuilderForm } from "./builder/SlotBuilderForm";
import { AddedSlotsList } from "./builder/AddedSlotsList";
import { ErrorMessage } from "./ErrorMessage";

interface AvailabilityBuilderFlowProps {
  interview: Interview;
  panel: InterviewPanel;
  currentTime: number;
}

export const AvailabilityBuilderFlow = ({
  interview,
  panel,
  currentTime,
}: AvailabilityBuilderFlowProps) => {
  const {
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
  } = useAvailabilitySubmission({ panel, interview, currentTime });

  // If submission is complete, show success screen
  if (isSubmitted) {
    return (
      <AvailabilitySuccessScreen
        panelName={panel.name}
        interviewRole={interview.role}
        submittedSlots={slots}
      />
    );
  }

  // Main availability builder interface
  return (
    <div className="glass-card max-w-2xl mx-auto backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-6 shadow-xl text-slate-200">
      {/* Title block */}
      <div className="border-b border-white/10 pb-5 mb-5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Interview Panel Availability Request
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white mb-1">
          Nomination for {interview.role} Interview
        </h2>
        <p className="text-sm text-slate-400">
          Hi{" "}
          <strong className="text-slate-200 font-semibold">{panel.name}</strong>
          , you have been selected to interview a candidate. Please provide your
          available times.
        </p>
      </div>

      {/* Interview metadata */}
      <InterviewMetadataCard interview={interview} panel={panel} />

      {/* Error message */}
      <ErrorMessage message={errorMsg} />

      {/* Slot builder form */}
      <SlotBuilderForm
        inputDate={inputDate}
        inputStart={inputStart}
        inputEnd={inputEnd}
        minDate={minDate}
        maxDate={maxDate}
        onDateChange={setInputDate}
        onStartChange={setInputStart}
        onEndChange={setInputEnd}
        onSubmit={handleAddSlot}
      />

      {/* Added slots list */}
      <AddedSlotsList slots={slots} onRemoveSlot={handleRemoveSlot} />

      {/* Submit button */}
      <div className="border-t border-white/10 pt-4">
        <button
          onClick={handleSubmitSlots}
          disabled={isSubmitting || slots.length === 0}
          className="btn btn-primary"
          style={{ width: "100%" }}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="spin" />
              <span>Submitting...</span>
            </>
          ) : (
            `Submit Availability (${slots.length} Slot${slots.length !== 1 ? "s" : ""})`
          )}
        </button>
      </div>
    </div>
  );
};
