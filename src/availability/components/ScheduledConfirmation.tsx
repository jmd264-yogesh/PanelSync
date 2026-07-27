/**
 * ScheduledConfirmation Component
 *
 * Confirmation screen shown when interview is already scheduled
 */

"use client";

import React from "react";
import { Calendar, Clock, Video, ExternalLink, CheckCircle } from "lucide-react";
import { Interview, InterviewPanel } from "@server/lib/db";

interface ScheduledConfirmationProps {
  interview: Interview;
  panel: InterviewPanel;
}

export const ScheduledConfirmation = ({
  interview,
  panel,
}: ScheduledConfirmationProps) => {
  const start = interview.scheduledSlotStart
    ? new Date(interview.scheduledSlotStart)
    : null;
  const end = interview.scheduledSlotEnd
    ? new Date(interview.scheduledSlotEnd)
    : null;

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
        Thank you, <strong>{panel.name}</strong>. The{" "}
        <strong>{interview.role}</strong> interview is officially scheduled.
      </p>

      {start && end && (
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            padding: "1.25rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-glass)",
            textAlign: "left",
            marginBottom: "2rem",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              marginBottom: "0.75rem",
            }}
          >
            <Calendar size={18} className="text-primary" />
            <div>
              <span className="text-xs text-muted block">Date</span>
              <span className="font-semibold text-sm">
                {start.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
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
            <Clock size={18} className="text-primary" />
            <div>
              <span className="text-xs text-muted block">Time (IST)</span>
              <span className="font-semibold text-sm">
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
          {interview.teamsMeetingUrl && (
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <Video size={18} className="text-primary" />
              <div>
                <span className="text-xs text-muted block">
                  Teams Meeting Link
                </span>
                <a
                  href={interview.teamsMeetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-primary flex-gap-1 hover-underline"
                >
                  Join Teams Meeting <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-muted text-xs">
        A calendar invitation has been sent to your Outlook account. You can
        safely close this page now.
      </p>
    </div>
  );
};
