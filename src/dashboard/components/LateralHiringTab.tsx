"use client";

import React, { useState, useEffect } from "react";
import {
  Briefcase,
  Plus,
  Loader2,
  Trash2,
  X,
  CalendarPlus,
  Search,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";
import { LateralCandidate, Interview, Panelist } from "@server/lib/db";
import { GraphUser } from "@server/lib/graph";
import { ConfirmDialog } from "@/common/components/ConfirmDialog";
import { ROLE_GRADES } from '@server/services/ai/spec-catalog';
import { RecalibrateReportModal } from './RecalibrateReportModal';

interface LateralHiringTabProps {
  candidates: LateralCandidate[];
  setCandidates: React.Dispatch<React.SetStateAction<LateralCandidate[]>>;
  interviews: Interview[];
  setInterviews: React.Dispatch<React.SetStateAction<Interview[]>>;
  panelists: Panelist[];
  todayStr: string;
}

const STATUS_OPTIONS: LateralCandidate["status"][] = [
  "NEW",
  "SCREENING",
  "WAITING_FOR_INTERVIEW",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "OFFERED",
  "HIRED",
  "REJECTED",
  "WITHDRAWN",
];

const STATUS_BADGE_STYLE: Record<
  LateralCandidate["status"],
  { bg: string; border: string; color: string }
> = {
  NEW: {
    bg: "rgba(148,163,184,0.1)",
    border: "1px solid rgba(148,163,184,0.25)",
    color: "#94a3b8",
  },
  SCREENING: {
    bg: "rgba(59,130,246,0.1)",
    border: "1px solid rgba(59,130,246,0.25)",
    color: "#3b82f6",
  },
  WAITING_FOR_INTERVIEW: {
    bg: "rgba(245,158,11,0.1)",
    border: "1px solid rgba(245,158,11,0.25)",
    color: "#f59e0b",
  },
  INTERVIEW_SCHEDULED: {
    bg: "rgba(99,102,241,0.1)",
    border: "1px solid rgba(99,102,241,0.25)",
    color: "#6366f1",
  },
  INTERVIEW_COMPLETED: {
    bg: "rgba(14,165,233,0.1)",
    border: "1px solid rgba(14,165,233,0.25)",
    color: "#0ea5e9",
  },
  OFFERED: {
    bg: "rgba(139,92,246,0.1)",
    border: "1px solid rgba(139,92,246,0.25)",
    color: "#8b5cf6",
  },
  HIRED: {
    bg: "rgba(16,185,129,0.1)",
    border: "1px solid rgba(16,185,129,0.25)",
    color: "#10b981",
  },
  REJECTED: {
    bg: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.25)",
    color: "#ef4444",
  },
  WITHDRAWN: {
    bg: "rgba(107,114,128,0.1)",
    border: "1px solid rgba(107,114,128,0.25)",
    color: "#6b7280",
  },
};

export const LateralHiringTab = ({
  candidates,
  setCandidates,
  interviews,
  setInterviews,
  panelists,
  todayStr,
}: LateralHiringTabProps) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewingRecalibrateFor, setViewingRecalibrateFor] = useState<LateralCandidate | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', positionTitle: '', experienceYears: '',
    currentCompany: '', currentCtc: '', expectedCtc: '', noticePeriodDays: '', source: '', roleGrade: '',
  });

  const [uploadingResumeId, setUploadingResumeId] = useState<string | null>(
    null,
  );
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // ── Schedule Interview modal state ──────────────────────────────────────
  const [schedulingFor, setSchedulingFor] = useState<LateralCandidate | null>(
    null,
  );
  const [roundLabel, setRoundLabel] = useState("Round 1");
  const [duration, setDuration] = useState("45");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:30");
  const [endTime, setEndTime] = useState("18:30");
  const [selectedPanels, setSelectedPanels] = useState<GraphUser[]>([]);
  const [panelSearchQuery, setPanelSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GraphUser[]>([]);
  const [isSearchingPanels, setIsSearchingPanels] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  useEffect(() => {
    if (panelSearchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingPanels(true);
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(panelSearchQuery)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(
            data.filter(
              (u: GraphUser) => !selectedPanels.some((sp) => sp.id === u.id),
            ),
          );
        }
      } catch (err) {
        console.error("Error searching panels:", err);
      } finally {
        setIsSearchingPanels(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [panelSearchQuery, selectedPanels]);

  const resetAddForm = () => {
    setForm({ name: '', email: '', phone: '', positionTitle: '', experienceYears: '', currentCompany: '', currentCtc: '', expectedCtc: '', noticePeriodDays: '', source: '', roleGrade: '' });
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!form.name.trim()) {
      setAddError("Candidate name is required.");
      return;
    }
    if (!form.email.trim()) {
      setAddError("Candidate email is required.");
      return;
    }
    if (!form.positionTitle.trim()) {
      setAddError("Position title is required.");
      return;
    }

    setIsAdding(true);
    try {
      const res = await fetch("/api/lateral-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to add candidate.");
      setCandidates(result.candidates);
      resetAddForm();
      setShowAddForm(false);
      toast.success("Lateral candidate added.");
    } catch (err: any) {
      setAddError(err.message || "Failed to add candidate.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteCandidate = async (id: string) => {
    try {
      const res = await fetch(`/api/lateral-candidates/${id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!res.ok)
        throw new Error(result.error || "Failed to remove candidate.");
      setCandidates(result.candidates);
      toast.success("Candidate removed.");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove candidate.");
    }
  };

  const handleStatusChange = async (
    id: string,
    status: LateralCandidate["status"],
  ) => {
    setUpdatingStatusId(id);
    try {
      const res = await fetch(`/api/lateral-candidates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to update status.");
      setCandidates(result.candidates);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status.");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleResumeUpload = async (candidateId: string, file: File) => {
    setUploadingResumeId(candidateId);
    try {
      const formData = new FormData();
      formData.append("resume", file);
      const res = await fetch(`/api/lateral-candidates/${candidateId}/resume`, {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to upload resume.");
      setCandidates(result.candidates);
      toast.success("Resume attached.");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload resume.");
    } finally {
      setUploadingResumeId(null);
    }
  };

  const openScheduleModal = (candidate: LateralCandidate) => {
    setSchedulingFor(candidate);
    setRoundLabel("Round 1");
    setDuration("45");
    setStartDate(todayStr);
    setStartTime("09:30");
    setEndTime("18:30");
    setSelectedPanels([]);
    setPanelSearchQuery("");
    setScheduleError(null);
  };

  const handleScheduleInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedulingFor) return;
    setScheduleError(null);
    if (!roundLabel.trim()) {
      setScheduleError('Please name this round (e.g. "Technical Round 1").');
      return;
    }
    if (!startDate) {
      setScheduleError("Please select a proposed range start date.");
      return;
    }
    if (startDate < todayStr) {
      setScheduleError("Start date cannot be in the past.");
      return;
    }
    if (selectedPanels.length === 0) {
      setScheduleError("Please select at least one panel member.");
      return;
    }

    setIsScheduling(true);
    try {
      // const res = await fetch("/api/interviews/create", {
      const res = await fetch("/api/interviews/request-panelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName: schedulingFor.name,
          candidateEmail: schedulingFor.email,
          role: `${roundLabel.trim()} - ${schedulingFor.positionTitle}`,
          duration: parseInt(duration, 10),
          startDate,
          startTime,
          endTime,
          panelists: selectedPanels,
          lateralCandidateId: schedulingFor.id,
          hiringType: "LATERAL"
        }),
      });
      const result = await res.json();
      if (!res.ok)
        throw new Error(result.error || "Failed to request panel.");
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === schedulingFor.id
            ? {
                ...c,
                mappedInterviewId: result.interview.id,
                status: "WAITING_FOR_INTERVIEW",
              }
            : c,
        ),
      );
      toast.success("Interview panel requested.");
      setSchedulingFor(null);
    } catch (err: any) {
      setScheduleError(err.message || "Failed to request panel.");
    } finally {
      setIsScheduling(false);
    }
  };

  const getCandidateInterviews = (email: string) =>
    interviews.filter(
      (i) => i.candidateEmail.toLowerCase() === email.toLowerCase(),
    );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.35rem",
              fontWeight: 700,
              marginBottom: "0.3rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <Briefcase size={20} className="text-primary" />
            Lateral Hiring
          </h1>
          <p className="text-muted text-sm">
            Experienced candidates hired directly against open positions —
            separate from campus drives.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddForm((v) => !v)}
        >
          <Plus size={15} style={{ marginRight: "0.35rem" }} />
          Add Candidate
        </button>
      </div>

      {showAddForm && (
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <form onSubmit={handleAddCandidate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
              <input className="form-input" placeholder="Full name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <input className="form-input" placeholder="Email *" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              <input className="form-input" placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              <input className="form-input" placeholder="Position title *" value={form.positionTitle} onChange={(e) => setForm((f) => ({ ...f, positionTitle: e.target.value }))} />
              <input className="form-input" placeholder="Experience (years)" type="number" min="0" value={form.experienceYears} onChange={(e) => setForm((f) => ({ ...f, experienceYears: e.target.value }))} />
              <input className="form-input" placeholder="Current company" value={form.currentCompany} onChange={(e) => setForm((f) => ({ ...f, currentCompany: e.target.value }))} />
              <input className="form-input" placeholder="Current CTC" value={form.currentCtc} onChange={(e) => setForm((f) => ({ ...f, currentCtc: e.target.value }))} />
              <input className="form-input" placeholder="Expected CTC" value={form.expectedCtc} onChange={(e) => setForm((f) => ({ ...f, expectedCtc: e.target.value }))} />
              <input className="form-input" placeholder="Notice period (days)" type="number" min="0" value={form.noticePeriodDays} onChange={(e) => setForm((f) => ({ ...f, noticePeriodDays: e.target.value }))} />
              <input className="form-input" placeholder="Source (Referral, LinkedIn, ...)" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
              <select className="form-input" value={form.roleGrade} onChange={(e) => setForm((f) => ({ ...f, roleGrade: e.target.value }))}>
                <option value="">Role grade (for Recalibrate)…</option>
                {Object.entries(ROLE_GRADES).map(([key, r]) => (
                  <option key={key} value={key}>{r.label}</option>
                ))}
              </select>
            </div>
            {addError && (
              <div style={{ color: "#ef4444", fontSize: "0.8rem" }}>
                {addError}
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isAdding}
              >
                {isAdding ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  "Add Candidate"
                )}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setShowAddForm(false);
                  setAddError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {candidates.length === 0 ? (
        <div
          className="glass-card"
          style={{ padding: "3rem", textAlign: "center" }}
        >
          <span className="text-muted text-sm">
            No lateral candidates yet. Click "Add Candidate" to start tracking
            one.
          </span>
        </div>
      ) : (
        <div className="glass-card" style={{ overflowX: "auto", borderRadius: "12px", boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.08)" }}>
  {/* Embedded scoped styles to drastically improve the data-table UI */}
  <style>{`
    .enhanced-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    .enhanced-table th {
      padding: 1rem 1.25rem;
      font-weight: 600;
      text-align: left;
      color: var(--text-muted, #64748b);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.02);
    }
    .enhanced-table td {
      padding: 1.25rem 1.25rem; /* Increased vertical padding gives rows breathing room */
      vertical-align: middle;
      border-bottom: 1px solid rgba(148, 163, 184, 0.08);
      color: var(--text-main, #334155);
    }
    .enhanced-table tr:last-child td {
      border-bottom: none; /* Clean finish at the bottom of the card */
    }
    .enhanced-table tr:hover td {
      background: rgba(255, 255, 255, 0.03); /* Subtle row hover feedback */
    }
    .status-select {
      appearance: none;
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s ease;
    }
    .status-select:hover:not(:disabled) {
      filter: brightness(0.95);
    }
    .row-action-button {
      border-radius: 6px;
      padding: 0 0.75rem;
      font-weight: 500;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .row-action-button:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
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
      {candidates.map((candidate) => {
        const candidateInterviews = getCandidateInterviews(candidate.email);
        const statusStyle = STATUS_BADGE_STYLE[candidate.status] ?? {
          bg: "rgba(148,163,184,0.1)",
          border: "1px solid rgba(148,163,184,0.25)",
          color: "#94a3b8",
        };
        return (
          <tr key={candidate.id}>
            {/* Candidate Identity */}
            <td>
              <div style={{ fontWeight: 600, color: "inherit", marginBottom: "2px" }}>{candidate.name}</div>
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
            
            {/* Status Dropdown Badge */}
            <td>
              <select
                className="form-input status-select"
                style={{
                  padding: "0.35rem 0.75rem", /* slightly wider padding */
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
                  handleStatusChange(
                    candidate.id,
                    e.target.value as LateralCandidate["status"],
                  )
                }
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </td>
            
            {/* Interview Rounds Column */}
            <td>
              {candidateInterviews.length === 0 ? (
                <span className="text-muted text-xs">—</span>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px", /* Spaced out stacked interview badges */
                  }}
                >
                  {candidateInterviews.map((intv) => (
                    <span
                      key={intv.id}
                      className="text-xs"
                      style={{ color: "var(--text-muted)", display: "inline-flex", alignItems: "center" }}
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
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  style={{ display: "none" }}
                  id={`lateral-resume-input-${candidate.id}`}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleResumeUpload(candidate.id, file);
                    e.target.value = "";
                  }}
                />
                <button
                  onClick={() =>
                    document
                      .getElementById(`lateral-resume-input-${candidate.id}`)
                      ?.click()
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
                    color: candidate.resumeFileKey
                      ? "var(--success, #10b981)"
                      : "inherit",
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
                
                <button
                  onClick={() => openScheduleModal(candidate)}
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

                {candidate.mappedInterviewId && (
                  <button
                    onClick={() => setViewingRecalibrateFor(candidate)}
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
                        transition: "all 0.2s ease"
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
                  onConfirm={() => handleDeleteCandidate(candidate.id)}
                />
              </div>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>  
      )}

      {schedulingFor && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            className="glass-card"
            style={{
              padding: "1.5rem",
              width: "480px",
              maxHeight: "85vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
                Schedule Interview — {schedulingFor.name}
              </h3>
              <button
                onClick={() => setSchedulingFor(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                }}
              >
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={handleScheduleInterview}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <input
                className="form-input"
                placeholder="Round name (e.g. Technical Round 1)"
                value={roundLabel}
                onChange={(e) => setRoundLabel(e.target.value)}
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "0.9rem",
                }}
              >
                {/* Duration */}
                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    Interview Duration
                  </label>
                  <select
                    className="form-input"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                  >
                    <option value="30">30 Minutes</option>
                    <option value="45">45 Minutes</option>
                    <option value="60">60 Minutes</option>
                    <option value="90">90 Minutes</option>
                  </select>
                </div>

                <div />

                {/* Window Start Date */}

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    Start Date
                  </label>

                  <input
                    className="form-input"
                    type="date"
                    min={todayStr}
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                {/* Window Start Time */}

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    Window Start Time
                  </label>

                  <input
                    className="form-input"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>

                {/* Window End Time */}

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    Window End Time
                  </label>

                  <input
                    className="form-input"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
              <div style={{ position: "relative" }}>
                <div style={{ position: "relative" }}>
                  <Search
                    size={14}
                    style={{
                      position: "absolute",
                      left: "0.6rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                    }}
                  />
                  <input
                    className="form-input"
                    style={{ paddingLeft: "2rem" }}
                    placeholder="Search panelists by name or email..."
                    value={panelSearchQuery}
                    onChange={(e) => setPanelSearchQuery(e.target.value)}
                  />
                </div>
                {isSearchingPanels && (
                  <div
                    className="text-xs text-muted"
                    style={{ marginTop: "0.3rem" }}
                  >
                    Searching...
                  </div>
                )}
                {searchResults.length > 0 && (
                  <div
                    className="glass-card"
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      zIndex: 10,
                      marginTop: "0.25rem",
                      maxHeight: "160px",
                      overflowY: "auto",
                    }}
                  >
                    {searchResults.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => {
                          setSelectedPanels((prev) => [...prev, u]);
                          setPanelSearchQuery("");
                          setSearchResults([]);
                        }}
                        style={{
                          padding: "0.5rem 0.75rem",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "var(--bg-hover, rgba(255,255,255,0.05))")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <div style={{ fontWeight: 600 }}>{u.displayName}</div>
                        <div className="text-muted text-xs">
                          {u.mail || u.userPrincipalName}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedPanels.length > 0 && (
                <div
                  style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}
                >
                  {selectedPanels.map((p) => (
                    <span
                      key={p.id}
                      className="badge badge-info"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                      }}
                    >
                      {p.displayName}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPanels((prev) =>
                            prev.filter((sp) => sp.id !== p.id),
                          )
                        }
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "inherit",
                          padding: 0,
                          display: "flex",
                        }}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {panelists.length > 0 && (
                <div>
                  <div
                    className="text-xs text-muted"
                    style={{ marginBottom: "0.3rem" }}
                  >
                    Or pick from the registered panelist directory:
                  </div>
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}
                  >
                    {panelists.map((p) => {
                      const isChosen = selectedPanels.some(
                        (sp) => sp.id === p.id,
                      );
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            if (isChosen)
                              setSelectedPanels((prev) =>
                                prev.filter((sp) => sp.id !== p.id),
                              );
                            else
                              setSelectedPanels((prev) => [
                                ...prev,
                                {
                                  id: p.id,
                                  displayName: p.displayName,
                                  mail: p.email,
                                  userPrincipalName: p.email,
                                },
                              ]);
                          }}
                          className="badge"
                          style={{
                            cursor: "pointer",
                            background: isChosen
                              ? "var(--primary-glow)"
                              : undefined,
                            border: isChosen
                              ? "1px solid var(--primary)"
                              : undefined,
                            color: isChosen ? "var(--primary)" : undefined,
                          }}
                        >
                          {p.displayName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {scheduleError && (
                <div style={{ color: "#ef4444", fontSize: "0.8rem" }}>
                  {scheduleError}
                </div>
              )}

              <div
                style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}
              >
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isScheduling}
                >
                  {isScheduling ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    "Send Panel Request"
                  )}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setSchedulingFor(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingRecalibrateFor && (
        <RecalibrateReportModal
          candidateId={viewingRecalibrateFor.id}
          onClose={() => setViewingRecalibrateFor(null)}
        />
      )}
    </div>
  );
}
