"use client";

import React, { ReactNode } from "react";
import { CalendarCheck } from "lucide-react";

type ScheduledInterviewsListProps = {
  filteredCount: number;
  totalCount: number;
  children: ReactNode;
};

export const ScheduledInterviewsList = ({
  filteredCount,
  totalCount,
  children,
}: ScheduledInterviewsListProps) => {
  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <h2
          style={{
            fontSize: "1.15rem",
            fontWeight: 700,
            marginBottom: "1rem",
          }}
        >
          Scheduled Assignments
          {filteredCount !== totalCount && (
            <span
              className="text-muted text-xs"
              style={{ marginLeft: "8px", fontWeight: 400 }}
            >
              ({filteredCount} of {totalCount} shown)
            </span>
          )}
        </h2>
      </div>

      {filteredCount === 0 ? (
        <div
          className="glass-card text-center"
          style={{ padding: "4rem 2rem" }}
        >
          <CalendarCheck
            size={44}
            style={{
              color: "var(--text-muted)",
              margin: "0 auto 1rem",
              opacity: 0.3,
              display: "block",
            }}
          />
          <p style={{ fontWeight: 600, marginBottom: "0.4rem" }}>
            {totalCount === 0
              ? "No Interviews Yet"
              : "No Matching Interviews"}
          </p>
          <p className="text-muted text-sm">
            {totalCount === 0
              ? "Once a recruiter schedules an interview and assigns you as a panelist, it will appear here."
              : "Try adjusting your filters above to see other scheduled assignments."}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};
