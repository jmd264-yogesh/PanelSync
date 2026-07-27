/**
 * BookedSlotsList Component
 *
 * Displays confirmed/booked interview slots with Teams meeting information
 */

"use client";

import React from "react";
import { Calendar, Clock, Video, ExternalLink, CheckCircle } from "lucide-react";
import { BookedSlot } from "@/common/types/availability";

interface BookedSlotsListProps {
  meetings: BookedSlot[];
  panelName: string;
  interviewRole: string;
}

export const BookedSlotsList = ({
  meetings,
  panelName,
  interviewRole,
}: BookedSlotsListProps) => {
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
        Interview Scheduled
      </h2>
      <p
        className="text-muted"
        style={{ fontSize: "0.95rem", marginBottom: "2rem" }}
      >
        Thank you, <strong>{panelName}</strong>. The{" "}
        <strong>{interviewRole}</strong> interview slot bookings are confirmed.
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          maxHeight: "350px",
          overflowY: "auto",
          marginBottom: "2rem",
          paddingRight: "4px",
        }}
      >
        {meetings.map((meeting, idx) => {
          const start = new Date(meeting.startTime);
          const end = new Date(meeting.endTime);

          return (
            <div
              key={idx}
              style={{
                background: "rgba(255,255,255,0.02)",
                padding: "1.25rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-glass)",
                textAlign: "left",
              }}
            >
              <div
                className="badge badge-info"
                style={{ marginBottom: "0.75rem", fontSize: "0.7rem" }}
              >
                {meeting.candidateName || "Pending Assignment"}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  marginBottom: "0.75rem",
                }}
              >
                <Calendar size={16} className="text-primary" />
                <div>
                  <span className="text-xs text-muted block">Date</span>
                  <span className="font-semibold text-xs">
                    {start.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  marginBottom: "0.75rem",
                }}
              >
                <Clock size={16} className="text-primary" />
                <div>
                  <span className="text-xs text-muted block">Time (IST)</span>
                  <span className="font-semibold text-xs">
                    {start.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    -{" "}
                    {end.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              {meeting.joinUrl && (
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <Video size={16} className="text-primary" />
                  <div>
                    <span className="text-xs text-muted block">
                      Teams Meeting Link
                    </span>
                    <a
                      href={meeting.joinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-primary flex-gap-1 hover-underline"
                    >
                      Join Teams Meeting <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-muted text-xs">
        A calendar invitation has been sent to your Outlook account. You can
        safely close this page now.
      </p>
    </div>
  );
};
