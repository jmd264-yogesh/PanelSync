"use client";

import React from "react";
import { LateralCandidate, Interview } from "@server/lib/db";
import { LateralCandidateRow } from "./LateralCandidateRow";
import { LATERAL_STATUS_BADGE_STYLE, LATERAL_STATUS_OPTIONS } from "@common/constants/lateralCandidateStatus";

interface LateralCandidateTableProps {
  candidates: LateralCandidate[];
  interviews: Interview[];
  updatingStatusId: string | null;
  uploadingResumeId: string | null;
  onStatusChange: (id: string, status: LateralCandidate["status"]) => void;
  onResumeUpload: (id: string, file: File) => void;
  onScheduleInterview: (candidate: LateralCandidate) => void;
  onViewRecalibrate: (candidate: LateralCandidate) => void;
  onDelete: (id: string) => void;
}

export const LateralCandidateTable: React.FC<LateralCandidateTableProps> = ({
  candidates,
  interviews,
  updatingStatusId,
  uploadingResumeId,
  onStatusChange,
  onResumeUpload,
  onScheduleInterview,
  onViewRecalibrate,
  onDelete,
}) => {
  return (
    <div
      className="glass-card"
      style={{
        overflowX: "auto",
        borderRadius: "12px",
        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.08)",
      }}
    >
      <style>{`
        .enhanced-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        .enhanced-table th { padding: 1rem 1.25rem; font-weight: 600; text-align: left; color: var(--text-muted, #64748b); border-bottom: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 255, 255, 0.02); }
        .enhanced-table td { padding: 1.25rem 1.25rem; vertical-align: middle; border-bottom: 1px solid rgba(148, 163, 184, 0.08); color: var(--text-main, #334155); }
        .enhanced-table tr:last-child td { border-bottom: none; }
        .enhanced-table tr:hover td { background: rgba(255, 255, 255, 0.03); }
        .status-select { appearance: none; cursor: pointer; border-radius: 6px; transition: all 0.2s ease; }
        .status-select:hover:not(:disabled) { filter: brightness(0.95); }
        .row-action-button { border-radius: 6px; padding: 0 0.75rem; font-weight: 500; font-size: 0.75rem; cursor: pointer; transition: all 0.2s ease; }
        .row-action-button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
      `}</style>

      <table className="data-table enhanced-table">
        <thead>
          <tr>
            <th>Candidate</th>
            <th>Position</th>
            <th>Experience</th>
            <th>Current Company</th>
            <th>Notice</th>
            <th>Source</th>
            <th>Status</th>
            <th>Interviews</th>
            <th style={{ textAlign: "right" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => (
            <LateralCandidateRow
              key={candidate.id}
              candidate={candidate}
              interviews={interviews}
              statusStyle={LATERAL_STATUS_BADGE_STYLE[candidate.status]}
              statusOptions={LATERAL_STATUS_OPTIONS}
              updatingStatusId={updatingStatusId}
              uploadingResumeId={uploadingResumeId}
              onStatusChange={onStatusChange}
              onResumeUpload={onResumeUpload}
              onScheduleInterview={onScheduleInterview}
              onViewRecalibrate={onViewRecalibrate}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
