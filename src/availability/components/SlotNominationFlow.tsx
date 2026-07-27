/**
 * SlotNominationFlow Component (Flow A) - Refactored
 *
 * Panelist-first booking flow where panelists select from nominated slots
 * Now using extracted smaller components and hooks
 */

"use client";

import React from "react";
import { Interview, InterviewPanel } from "@server/lib/db";
import { Loader2, X } from "lucide-react";
import { useSlotBooking } from "@/availability/hooks/useSlotBooking";
import { useRejection } from "@/availability/hooks/useRejection";
import { SlotSelector } from "./SlotSelector";
import { BookedSlotsList } from "./BookedSlotsList";
import { RejectionForm } from "./RejectionForm";
import { SlotNominationHeader } from "./nomination/SlotNominationHeader";
import { ErrorMessage } from "./ErrorMessage";

interface SlotNominationFlowProps {
  interview: Interview;
  panel: InterviewPanel;
  currentTime: number;
}

export const SlotNominationFlow = ({
  interview,
  panel,
  currentTime,
}: SlotNominationFlowProps) => {
  const {
    selectedSlots,
    bookedMeetings,
    isBooked,
    isBooking,
    hoveredSlotId,
    errorMsg,
    toggleSlotSelection,
    setHoveredSlotId,
    handleBookSelectedSlots,
    setErrorMsg,
  } = useSlotBooking({ panel, interview });

  const {
    isRejected,
    rejectReason,
    showRejectForm,
    isRejecting,
    setRejectReason,
    setShowRejectForm,
    handleRejectRequest,
  } = useRejection({ panel, onError: setErrorMsg });

  // If booking is complete, show booked meetings
  if (isBooked) {
    return (
      <BookedSlotsList
        meetings={bookedMeetings}
        panelName={panel.name}
        interviewRole={interview.role}
      />
    );
  }

  // Show rejection form/confirmation
  if (isRejected || showRejectForm) {
    return (
      <RejectionForm
        isRejected={isRejected}
        rejectReason={rejectReason}
        onReasonChange={setRejectReason}
        onReject={handleRejectRequest}
        onCancel={() => setShowRejectForm(false)}
        isRejecting={isRejecting}
        panelName={panel.name}
        interviewRole={interview.role}
      />
    );
  }

  // Main slot selection interface
  return (
    <div className="glass-card">
      <SlotNominationHeader
        interviewRole={interview.role}
        panelName={panel.name}
      />

      <ErrorMessage message={errorMsg} />

      {/* Proposed Slots List */}
      <div style={{ marginBottom: "2.5rem" }}>
        <h3
          className="text-muted text-xs"
          style={{
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "1rem",
          }}
        >
          Proposed Time Slots
        </h3>
        <SlotSelector
          slots={panel.availabilities}
          selectedSlotIds={selectedSlots}
          onToggle={toggleSlotSelection}
          currentTime={currentTime}
          hoveredSlotId={hoveredSlotId}
          onHover={setHoveredSlotId}
        />
      </div>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          paddingTop: "1.5rem",
          borderTop: "1px solid var(--border-glass)",
        }}
      >
        <button
          onClick={handleBookSelectedSlots}
          disabled={isBooking || selectedSlots.length === 0}
          className="btn btn-primary"
          style={{ flex: 1 }}
        >
          {isBooking ? (
            <>
              <Loader2 size={16} className="spin" />
              <span>Booking Slots...</span>
            </>
          ) : (
            `Confirm ${selectedSlots.length} Slot${selectedSlots.length !== 1 ? "s" : ""}`
          )}
        </button>

        <button
          onClick={() => setShowRejectForm(true)}
          className="btn btn-outline"
        >
          <X size={16} />
          <span>Decline</span>
        </button>
      </div>
    </div>
  );
};
