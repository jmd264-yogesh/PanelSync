"use client";

import React from "react";
import { Interview } from "@server/lib/db";
import { PanelMemberCard } from "./PanelMemberCard";

interface PanelStatusListProps {
  interview: Interview;
  resendingPanelId: string | null;
  sendingFeedbackReminderId: string | null;
  onResend: (interviewId: string, panelId: string) => void;
  onSendReminder: (interviewId: string, e: React.MouseEvent) => void;
}

export const PanelStatusList: React.FC<PanelStatusListProps> = ({
  interview,
  resendingPanelId,
  sendingFeedbackReminderId,
  onResend,
  onSendReminder,
}) => {
  const panelsToDisplay =
    interview.status === "SCHEDULED" || interview.status === "COLLECTED"
      ? interview.panels.filter((p) => p.status === "SUBMITTED")
      : interview.panels;

  const finalPanels = panelsToDisplay.length > 0 ? panelsToDisplay : interview.panels;

  return (
    <div
      style={{
        padding: "16px",
        background: "var(--surface-muted)",
        borderRadius: "12px",
        border: "1px solid var(--border)",
      }}
    >
      <h3
        style={{
          fontSize: "14px",
          fontWeight: 700,
          margin: "0 0 12px 0",
          color: "var(--fg)",
        }}
      >
        {interview.status === "SCHEDULED" ? "Panelist" : "Panel Members"}
      </h3>

      {finalPanels.length === 0 ? (
        <p style={{ fontSize: "13px", color: "var(--fg-secondary)", margin: 0 }}>
          No panels assigned
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {finalPanels.map((panel) => (
            <PanelMemberCard
              key={panel.id}
              panel={panel}
              interviewStatus={interview.status}
              interviewId={interview.id}
              resendingPanelId={resendingPanelId}
              sendingFeedbackReminderId={sendingFeedbackReminderId}
              onResend={onResend}
              onSendReminder={onSendReminder}
            />
          ))}
        </div>
      )}
    </div>
  );
};
