import React from "react";
import { Calendar, Clock, Video } from "lucide-react";

type InterviewCardScheduleInfoProps = {
  scheduledSlotStart: string;
  duration: number;
  teamsMeetingUrl: string | null;
  formatDateTime: (dateStr: string) => string;
};

export const InterviewCardScheduleInfo = ({
  scheduledSlotStart,
  duration,
  teamsMeetingUrl,
  formatDateTime,
}: InterviewCardScheduleInfoProps) => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1rem",
        padding: "0.5rem 0",
        borderBottom: "1px solid var(--border-glass)",
        borderTop: "1px solid var(--border-glass)",
        marginTop: "0.25rem",
        marginBottom: "0.25rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.8rem",
          color: "var(--text-muted)",
        }}
      >
        <Calendar size={13} style={{ color: "var(--text-muted)" }} />
        <span style={{ fontWeight: 550, color: "var(--text-main)" }}>
          {formatDateTime(scheduledSlotStart)}
        </span>
        <span>•</span>
        <Clock size={12} style={{ color: "var(--text-muted)" }} />
        <span>{duration} min</span>
      </div>
      {teamsMeetingUrl && (
        <a
          href={teamsMeetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: "0.78rem",
            fontWeight: 600,
            color: "var(--primary)",
            textDecoration: "none",
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--primary-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--primary)")
          }
        >
          <Video size={13} />
          <span>Join Teams Call</span>
        </a>
      )}
    </div>
  );
};
