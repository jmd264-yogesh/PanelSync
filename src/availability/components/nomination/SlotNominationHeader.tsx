/**
 * SlotNominationHeader Component
 *
 * Header section for slot nomination flow
 */

"use client";

import React from "react";

interface SlotNominationHeaderProps {
  interviewRole: string;
  panelName: string;
}

export const SlotNominationHeader = ({
  interviewRole,
  panelName,
}: SlotNominationHeaderProps) => {
  return (
    <div
      style={{
        borderBottom: "1px solid var(--border-glass)",
        paddingBottom: "1.5rem",
        marginBottom: "1.5rem",
      }}
    >
      <div className="badge badge-info" style={{ marginBottom: "0.75rem" }}>
        Interview Slot Selection
      </div>
      <h2 style={{ fontSize: "1.6rem", marginBottom: "0.25rem" }}>
        Select Slots for {interviewRole}
      </h2>
      <p className="text-muted text-sm">
        Hi <strong>{panelName}</strong>, please select **one or more** of the
        proposed slots below. You can book multiple slots if you are free to
        conduct multiple interviews.
      </p>
    </div>
  );
};
