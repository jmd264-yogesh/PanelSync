"use client";

import React from "react";
import { Calendar } from "lucide-react";
import { Interview, InterviewPanel, Drive } from "@server/lib/db";
import { PendingRequestCard } from "./PendingRequestCard";

type PendingRequestsListProps = {
  requests: { interview: Interview; panel: InterviewPanel }[];
  totalRequests: number;
  activeDrive: Drive | null;
  onSelectRequest: (request: {
    interview: Interview;
    panel: InterviewPanel;
  }) => void;
};

export const PendingRequestsList = ({
  requests,
  totalRequests,
  activeDrive,
  onSelectRequest,
}: PendingRequestsListProps) => {
  return (
    <div style={{ marginBottom: "2.5rem" }}>
      <h2
        style={{
          fontSize: "1.15rem",
          fontWeight: 700,
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <Calendar size={18} className="text-primary" />
        Pending Action / Slot Requests
        {totalRequests > 0 && (
          <span
            className="badge badge-pending"
            style={{ fontSize: "0.65rem", marginLeft: "8px" }}
          >
            {requests.length !== totalRequests
              ? `${requests.length} of ${totalRequests} filtered`
              : `${totalRequests} action required`}
          </span>
        )}
      </h2>

      {requests.length === 0 ? (
        <div
          className="glass-card"
          style={{
            padding: "2rem",
            textAlign: "center",
            border: "1px dashed var(--border-glass)",
          }}
        >
          <span className="text-muted text-sm">
            {totalRequests === 0
              ? "No pending slot requests at the moment."
              : "No pending slot requests match the active filters."}
          </span>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          {requests.map((req) => (
            <PendingRequestCard
              key={req.panel.id}
              interview={req.interview}
              panel={req.panel}
              activeDrive={activeDrive}
              onSelect={() => onSelectRequest(req)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
