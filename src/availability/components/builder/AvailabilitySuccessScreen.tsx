/**
 * AvailabilitySuccessScreen Component
 *
 * Success confirmation screen shown after availability submission
 */

"use client";

import React from "react";
import { CheckCircle } from "lucide-react";
import { TimeSlot } from "@/common/types/availability";

interface AvailabilitySuccessScreenProps {
  panelName: string;
  interviewRole: string;
  submittedSlots: TimeSlot[];
}

export const AvailabilitySuccessScreen = ({
  panelName,
  interviewRole,
  submittedSlots,
}: AvailabilitySuccessScreenProps) => {
  return (
    <div
      className="glass-card text-center animate-pulse-once"
      style={{ padding: "3rem 2rem" }}
    >
      <CheckCircle
        size={56}
        style={{ color: "var(--success)", margin: "0 auto 1.5rem" }}
      />
      <h2 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
        Availability Recorded
      </h2>
      <p
        className="text-muted"
        style={{ fontSize: "0.95rem", marginBottom: "2rem" }}
      >
        Thank you, <strong>{panelName}</strong>. Your availability for the{" "}
        <strong>{interviewRole}</strong> interview has been successfully saved.
      </p>

      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          padding: "1rem 1.5rem",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-glass)",
          textAlign: "left",
          marginBottom: "2rem",
        }}
      >
        <h4
          style={{
            fontSize: "0.9rem",
            marginBottom: "0.75rem",
            color: "var(--text-muted)",
          }}
        >
          Submitted Slots:
        </h4>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          {submittedSlots.map((slot, idx) => {
            const start = new Date(slot.startTime);
            const end = new Date(slot.endTime);
            return (
              <div
                key={idx}
                style={{
                  fontSize: "0.875rem",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>
                  {start.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="font-semibold">
                  {start.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  -{" "}
                  {end.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  (IST)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-muted text-xs">
        The recruiter will review the overlapping slots and book the meeting.
        You will receive a calendar invite automatically. You can close this tab
        now.
      </p>
    </div>
  );
};
