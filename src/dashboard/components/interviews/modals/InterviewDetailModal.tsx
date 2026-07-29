"use client";

import React from "react";
import { Interview } from "@server/lib/db";
import { getOverlappingSlots } from "@common/util/interviews/slot-calculation";
import { ModalContainer } from "@/common/components/ModalContainer";
import { ModalContent } from "@/common/components/ModalContent";
import { InterviewDetailsHeader } from "./components/InterviewDetailsHeader";
import { InterviewInfoGrid } from "./components/InterviewInfoGrid";
import { PanelStatusList } from "./components/PanelStatusList";
import { SlotOverlapMatrix } from "./components/SlotOverlapMatrix";
import { InterviewActions } from "./components/InterviewActions";

interface InterviewDetailModalProps {
  interview: Interview;
  detailTab: "overview" | "panels" | "booking" | "feedback";
  setDetailTab: (tab: "overview" | "panels" | "booking" | "feedback") => void;
  todayStr: string;
  selectedSlot: { start: string; end: string } | null;
  setSelectedSlot: (slot: { start: string; end: string } | null) => void;
  bookingDescription: string;
  setBookingDescription: (desc: string) => void;
  isBooking: boolean;
  bookSlot: () => void;
  cancelBooking: () => void;
  sendFeedbackReminder: (interviewId: string, e: React.MouseEvent) => void;
  sendingFeedbackReminderId: string | null;
  resendInvite: (interviewId: string, panelId: string) => void;
  resendingPanelId: string | null;
  isEditingDates: boolean;
  setIsEditingDates: (editing: boolean) => void;
  editStartDate: string;
  setEditStartDate: (date: string) => void;
  editEndDate: string;
  setEditEndDate: (date: string) => void;
  isUpdatingDates: boolean;
  updateDates: (e: React.FormEvent) => void;
  deleteInterview: (id: string) => void;
  onClose: () => void;
}

export const InterviewDetailModal: React.FC<InterviewDetailModalProps> = ({
  interview,
  detailTab,
  setDetailTab,
  todayStr,
  selectedSlot,
  setSelectedSlot,
  bookingDescription,
  setBookingDescription,
  isBooking,
  bookSlot,
  cancelBooking,
  sendFeedbackReminder,
  sendingFeedbackReminderId,
  resendInvite,
  resendingPanelId,
  isEditingDates,
  setIsEditingDates,
  editStartDate,
  setEditStartDate,
  editEndDate,
  setEditEndDate,
  isUpdatingDates,
  updateDates,
  deleteInterview,
  onClose,
}) => {
  const overlaps = getOverlappingSlots(interview);

  const handleToggleEditDates = () => {
    if (!isEditingDates) {
      setEditStartDate(interview.startDate.split("T")[0]);
      setEditEndDate(interview.endDate.split("T")[0]);
    }
    setIsEditingDates(!isEditingDates);
  };

  return (
    <ModalContainer onBackdropClick={onClose}>
      <InterviewDetailsHeader candidateName={interview.candidateName} onClose={onClose} />

      <ModalContent>
        <InterviewInfoGrid interview={interview} />

        <PanelStatusList
          interview={interview}
          resendingPanelId={resendingPanelId}
          sendingFeedbackReminderId={sendingFeedbackReminderId}
          onResend={resendInvite}
          onSendReminder={sendFeedbackReminder}
        />

        {interview.status === "COLLECTED" && detailTab !== "booking" && (
          <button
            type="button"
            onClick={() => {
              setSelectedSlot(null);
              setBookingDescription("");
              setDetailTab("booking");
            }}
            className="btn btn-primary"
            style={{ width: "100%", height: "42px" }}
          >
            Book Meeting
          </button>
        )}

        {interview.status === "COLLECTED" && detailTab === "booking" && (
          <SlotOverlapMatrix
            overlaps={overlaps}
            selectedSlot={selectedSlot}
            bookingDescription={bookingDescription}
            isBooking={isBooking}
            onSelectSlot={setSelectedSlot}
            onDescriptionChange={setBookingDescription}
            onBook={bookSlot}
            onCancel={() => {
              setDetailTab("overview");
              setSelectedSlot(null);
            }}
          />
        )}

        <InterviewActions
          interview={interview}
          todayStr={todayStr}
          isEditingDates={isEditingDates}
          editStartDate={editStartDate}
          editEndDate={editEndDate}
          isUpdatingDates={isUpdatingDates}
          onToggleEditDates={handleToggleEditDates}
          onStartDateChange={setEditStartDate}
          onEndDateChange={setEditEndDate}
          onUpdateDates={updateDates}
          onCancelBooking={cancelBooking}
          onDelete={() => {
            deleteInterview(interview.id);
            onClose();
          }}
        />
      </ModalContent>
    </ModalContainer>
  );
};
