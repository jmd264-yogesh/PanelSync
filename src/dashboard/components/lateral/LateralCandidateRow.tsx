"use client";

import React from "react";
import { Loader2, Trash2, CalendarPlus, ClipboardCheck } from "lucide-react";
import { LateralCandidate, Interview } from "@server/lib/db";
import { ConfirmDialog } from "@/common/components/ConfirmDialog";

interface LateralCandidateRowProps {
  candidate: LateralCandidate;
  interviews: Interview[];
  statusStyle: { bg: string; border: string; color: string };
  statusOptions: readonly LateralCandidate["status"][];
  updatingStatusId: string | null;
  uploadingResumeId: string | null;
  onStatusChange: (id: string, status: LateralCandidate["status"]) => void;
  onResumeUpload: (id: string, file: File) => void;
  onScheduleInterview: (candidate: LateralCandidate) => void;
  onViewRecalibrate: (candidate: LateralCandidate) => void;
  onDelete: (id: string) => void;
}

export const LateralCandidateRow: React.FC<LateralCandidateRowProps> = ({
  candidate,
  interviews,
  statusStyle,
  statusOptions,
  updatingStatusId,
  uploadingResumeId,
  onStatusChange,
  onResumeUpload,
  onScheduleInterview,
  onViewRecalibrate,
  onDelete,
}) => {
  const candidateInterviews = interviews.filter(
    (i) => i.candidateEmail.toLowerCase() === candidate.email.toLowerCase()
  );

  return (
    <tr>
      {/* Candidate Identity */}
      <td>
        <div style={{ fontWeight: 600, color: "inherit", marginBottom: "2px" }}>
          {candidate.name}
        </div>
        <div className="text-muted text-xs" style={{ opacity: 0.8 }}>
          {candidate.email}
        </div>
      </td>

      {/* Position */}
      <td style={{ fontWeight: 500 }}>{candidate.positionTitle}</td>

      {/* Experience */}
      <td>
        {candidate.experienceYears !== undefined
          ? `${candidate.experienceYears} yrs`
          : "—"}
      </td>

      {/* Current Company */}
      <td>{candidate.currentCompany || "—"}</td>

      {/* Notice Period */}
      <td>
        {candidate.noticePeriodDays !== undefined
          ? `${candidate.noticePeriodDays}d`
          : "—"}
      </td>

      {/* Source */}
      <td>{candidate.source || "—"}</td>

      {/* Status Dropdown */}
      <td>
        <select
          className="form-input status-select"
          style={{
            padding: "0.35rem 0.75rem",
            height: "32px",
            fontSize: "0.75rem",
            background: statusStyle.bg,
            border: statusStyle.border,
            color: statusStyle.color,
            fontWeight: 600,
          }}
          value={candidate.status}
          disabled={updatingStatusId === candidate.id}
          onChange={(e) =>
            onStatusChange(candidate.id, e.target.value as LateralCandidate["status"])
          }
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>

      {/* Interview Rounds */}
      <td>
        {candidateInterviews.length === 0 ? (
          <span className="text-muted text-xs">—</span>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {candidateInterviews.map((intv) => (
              <span
                key={intv.id}
                className="text-xs"
                style={{
                  color: "var(--text-muted)",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                {intv.role.replace(/^LATERAL - /, "")}{" "}
                <span
                  className="badge"
                  style={{
                    fontSize: "0.65rem",
                    padding: "1px 4px",
                    borderRadius: "4px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    marginLeft: "6px",
                  }}
                >
                  {intv.status}
                </span>
              </span>
            ))}
          </div>
        )}
      </td>

      {/* Action Buttons */}
      <td style={{ textAlign: "right" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "0.5rem",
          }}
        >
          {/* Resume Upload */}
          <input
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            style={{ display: "none" }}
            id={`lateral-resume-input-${candidate.id}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onResumeUpload(candidate.id, file);
              e.target.value = "";
            }}
          />
          <button
            onClick={() =>
              document.getElementById(`lateral-resume-input-${candidate.id}`)?.click()
            }
            disabled={uploadingResumeId === candidate.id}
            className="row-action-button"
            style={{
              height: "30px",
              background: candidate.resumeFileKey
                ? "rgba(16,185,129,0.08)"
                : "rgba(255,255,255,0.04)",
              border: candidate.resumeFileKey
                ? "1px solid rgba(16,185,129,0.3)"
                : "1px solid rgba(255,255,255,0.1)",
              color: candidate.resumeFileKey ? "var(--success, #10b981)" : "inherit",
            }}
            title={candidate.resumeFileKey ? "Replace attached resume" : "Attach resume"}
          >
            {uploadingResumeId === candidate.id ? (
              <Loader2 size={12} className="animate-spin" />
            ) : candidate.resumeFileKey ? (
              "Resume ✓"
            ) : (
              "Attach Resume"
            )}
          </button>

          {/* Schedule Interview */}
          <button
            onClick={() => onScheduleInterview(candidate)}
            className="row-action-button"
            style={{
              height: "30px",
              background: "rgba(37,99,235,0.08)",
              border: "1px solid rgba(37,99,235,0.3)",
              color: "var(--primary, #3b82f6)",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
            title="Schedule an interview round"
          >
            <CalendarPlus size={13} />
            Schedule
          </button>

          {/* Recalibrate Button */}
          {candidate.mappedInterviewId && (
            <button
              onClick={() => onViewRecalibrate(candidate)}
              className="row-action-button"
              style={{
                height: "30px",
                background: "rgba(168,85,247,0.08)",
                border: "1px solid rgba(168,85,247,0.3)",
                color: "#a855f7",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
              title="View the panelist's Recalibrate assessment"
            >
              <ClipboardCheck size={13} />
              Recalibrate
            </button>
          )}

          {/* Delete Button */}
          <ConfirmDialog
            trigger={
              <button
                style={{
                  border: "none",
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: "6px",
                  cursor: "pointer",
                  color: "var(--text-muted, #94a3b8)",
                  padding: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#ef4444";
                  e.currentTarget.style.background = "rgba(239,68,68,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "";
                  e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                }}
                title="Remove candidate"
              />
            }
            triggerChildren={<Trash2 size={14} />}
            title="Remove this lateral candidate?"
            description="This will remove the candidate from the lateral hiring queue. This action cannot be undone."
            confirmLabel="Yes, Remove"
            onConfirm={() => onDelete(candidate.id)}
          />
        </div>
      </td>
    </tr>
  );
};
