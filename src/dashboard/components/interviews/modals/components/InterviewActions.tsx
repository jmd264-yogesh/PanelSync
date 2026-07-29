"use client";

import React from "react";
import { Video, Trash2 } from "lucide-react";
import { Interview } from "@server/lib/db";
import { ConfirmDialog } from "@/common/components/ConfirmDialog";
import { DateEditForm } from "./DateEditForm";

interface InterviewActionsProps {
  interview: Interview;
  todayStr: string;
  isEditingDates: boolean;
  editStartDate: string;
  editEndDate: string;
  isUpdatingDates: boolean;
  onToggleEditDates: () => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onUpdateDates: (e: React.FormEvent) => void;
  onCancelBooking: () => void;
  onDelete: () => void;
}

export const InterviewActions: React.FC<InterviewActionsProps> = ({
  interview,
  todayStr,
  isEditingDates,
  editStartDate,
  editEndDate,
  isUpdatingDates,
  onToggleEditDates,
  onStartDateChange,
  onEndDateChange,
  onUpdateDates,
  onCancelBooking,
  onDelete,
}) => {
  if (interview.status !== "SCHEDULED") {
    return null;
  }

  return (
    <>
      {/* Scheduled Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", gap: "10px" }}>
          {interview.teamsMeetingUrl && (
            <a
              href={interview.teamsMeetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{
                flex: 1,
                textDecoration: "none",
                height: "42px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <Video size={16} /> Join Meeting
            </a>
          )}
          <DateEditForm
            isEditing={isEditingDates}
            editStartDate={editStartDate}
            editEndDate={editEndDate}
            todayStr={todayStr}
            isUpdating={isUpdatingDates}
            onToggleEdit={onToggleEditDates}
            onStartDateChange={onStartDateChange}
            onEndDateChange={onEndDateChange}
            onSubmit={onUpdateDates}
          />
        </div>

        {!isEditingDates && (
          <ConfirmDialog
            trigger={
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  width: "100%",
                  height: "42px",
                  color: "var(--danger)",
                  borderColor: "rgba(196, 69, 60, 0.2)",
                }}
              >
                Cancel Booking
              </button>
            }
            title="Cancel this booking?"
            description="This removes the scheduled Teams meeting and calendar event, and reverts the interview back to Collected so it can be rebooked."
            confirmLabel="Yes, Cancel Booking"
            onConfirm={onCancelBooking}
          />
        )}
      </div>

      {/* Delete Section */}
      <div
        style={{
          marginTop: "8px",
          borderTop: "1px solid var(--border)",
          paddingTop: "16px",
        }}
      >
        <ConfirmDialog
          trigger={
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                width: "100%",
                color: "var(--danger)",
                borderColor: "rgba(196, 69, 60, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <Trash2 size={16} /> Delete Interview
            </button>
          }
          title="Delete this interview?"
          description="This will soft-delete the interview record and release any mapped candidates. If a Teams meeting was scheduled, the calendar event will also be removed."
          confirmLabel="Yes, Delete"
          onConfirm={onDelete}
        />
      </div>
    </>
  );
};
