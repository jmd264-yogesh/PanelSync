/**
 * AvailabilityClient Component (Refactored)
 *
 * Main orchestrator for availability submission flows
 * Routes to appropriate flow based on interview state
 */

"use client";

import React, { useState } from "react";
import { Interview, InterviewPanel } from "@server/lib/db";
import { SlotNominationFlow } from "./SlotNominationFlow";
import { AvailabilityBuilderFlow } from "./AvailabilityBuilderFlow";
import { ScheduledConfirmation } from "./ScheduledConfirmation";

type TAvailabilityClientProps = {
  interview: Interview;
  panel: InterviewPanel;
};

export const AvailabilityClient = ({
  interview,
  panel,
}: TAvailabilityClientProps) => {
  // Capture current timestamp at component mount to avoid impure Date.now() calls in render
  const [currentTime] = useState(() => Date.now());

  // Determine flow type
  const isPendingAssignment = interview.candidateName === "Pending Assignment";

  // If the interview is already scheduled, show scheduled confirmation
  if (interview.status === "SCHEDULED") {
    return <ScheduledConfirmation interview={interview} panel={panel} />;
  }

  // Route to appropriate flow
  if (isPendingAssignment) {
    // Flow A: Panelist-first booking (slot nomination)
    return (
      <SlotNominationFlow
        interview={interview}
        panel={panel}
        currentTime={currentTime}
      />
    );
  }

  // Flow B: Traditional availability builder
  return (
    <AvailabilityBuilderFlow
      interview={interview}
      panel={panel}
      currentTime={currentTime}
    />
  );
};
