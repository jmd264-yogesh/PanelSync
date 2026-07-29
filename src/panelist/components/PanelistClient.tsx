"use client";

import React, { useState } from "react";
import { PanelistInterview, Interview, InterviewPanel, Drive } from "@server/lib/db";
import { AvailabilityClient } from "@/availability/components/AvailabilityClient";
import { AiCopilotPanel } from "./AiCopilotPanel";
import { RecalibratePanel } from "./RecalibratePanel";
import { PanelistTabs } from "./tabs/PanelistTabs";
import { PendingRequestsList } from "./tabs/PendingRequestsList";
import { ScheduledInterviewsList } from "./tabs/ScheduledInterviewsList";
import { L1FeedbackForm } from "./feedback/L1FeedbackForm";
import { L2FeedbackForm } from "./feedback/L2FeedbackForm";
import { GeneralFeedbackForm } from "./feedback/GeneralFeedbackForm";
import { LateralFeedbackForm } from "./feedback/LateralFeedbackForm";
import { SubmittedFeedbackDisplay } from "./feedback/SubmittedFeedbackDisplay";
import {
  Video,
  CheckCircle,
  XCircle,
  Clock,
  User,
  MessageSquare,
  Loader2,
  CalendarCheck,
  Calendar,
  AlertCircle,
  SlidersHorizontal,
  X,
  FileText,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/common/components/ui/alert-dialog";
import {
  STATUS_LABEL,
  STATUS_BADGE,
  STATUS_COLOR,
} from "../constants/feedback-constants";
import { parseFeedbackSafely } from "@common/util/feedback-parser";
import { usePanelistInterviews } from "../hooks/usePanelistInterviews";
import { usePanelistFilters } from "../hooks/usePanelistFilters";
import { useInterviewSorting } from "../hooks/useInterviewSorting";
import { useFeedbackState } from "../hooks/useFeedbackState";
import { useL1Feedback } from "../hooks/useL1Feedback";
import { useFeedbackSubmission } from "../hooks/useFeedbackSubmission";

type TPanelistClientProps = {
  initialInterviews: PanelistInterview[];
  initialRequests: { interview: Interview; panel: InterviewPanel }[];
  panelistRoles: string[];
  panelistName: string;
  activeDrive: Drive | null;
};

export const PanelistClient = ({
  initialInterviews,
  initialRequests,
  panelistRoles,
  panelistName,
  activeDrive,
}: TPanelistClientProps) => {
  const {
    interviews,
    setInterviews,
    pendingRequests,
    setPendingRequests,
    refreshInterviews,
  } = usePanelistInterviews(initialInterviews, initialRequests);

  const [selectedRequest, setSelectedRequest] = useState<{
    interview: Interview;
    panel: InterviewPanel;
  } | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, string>>(
    {},
  );
  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>(
    {},
  );

  const {
    filterActiveDrive,
    setFilterActiveDrive,
    filterDate,
    setFilterDate,
    activePrimaryTab,
    setActivePrimaryTab,
    activeHiringTab,
    setActiveHiringTab,
    activeRoundTab,
    setActiveRoundTab,
  } = usePanelistFilters(activeDrive);

  const { filteredSortedInterviews, filteredSortedRequests, tabCounts } =
    useInterviewSorting(
      interviews,
      pendingRequests,
      activeDrive,
      activeHiringTab,
      filterActiveDrive,
      filterDate,
      activeRoundTab
    );

  const {
    l1Ratings,
    setL1Ratings,
    l2Ratings,
    setL2Ratings,
    genRatings,
    setGenRatings,
    lateralRatings,
    setLateralRatings,
    isEditing,
    setIsEditing,
  } = useFeedbackState();

  const {
    expandedFeedbacks,
    l1FeedbacksForCandidate,
    loadingL1Feedbacks,
    toggleFeedbackExpansion,
  } = useL1Feedback();

  const [pendingL1PassConfirm, setPendingL1PassConfirm] =
    useState<PanelistInterview | null>(null);

  const {
    submittingFeedback,
    feedbackError,
    performFeedbackSubmit,
    handleFeedbackSubmit,
  } = useFeedbackSubmission(
    l1Ratings,
    l2Ratings,
    genRatings,
    lateralRatings,
    setIsEditing,
    refreshInterviews,
    setPendingL1PassConfirm
  );

  // Accordion state for feedback cards

  const isL1 = panelistRoles.includes("L1");
  const isL2 = panelistRoles.includes("L2");

  // Helper functions for display purposes
  const getCollegeNameFromRole = (role: string): string => {
    const parts = role.split(" - ");
    return parts.length > 1 ? parts[1].trim() : "";
  };

  const isFromActiveDrive = (role: string): boolean => {
    if (!activeDrive || !activeDrive.collegeName) return false;
    const college = getCollegeNameFromRole(role);
    return college.toLowerCase() === activeDrive.collegeName.toLowerCase();
  };

  const getRoleBadgeStyle = (role: string) => {
    const isL1Role = role.toLowerCase().includes("l1");
    const isL2Role = role.toLowerCase().includes("l2");
    const isLateralRole = role.toLowerCase().includes("lateral");

    if (isL1Role) {
      return {
        background: "var(--badge-l1-bg)",
        border: "1px solid var(--badge-l1-border)",
        color: "var(--badge-l1-text)",
        label: "L1 Round",
      };
    } else if (isL2Role) {
      return {
        background: "var(--badge-l2-bg)",
        border: "1px solid var(--badge-l2-border)",
        color: "var(--badge-l2-text)",
        label: "L2 Round",
      };
    } else if (isLateralRole) {
      return {
        background: "rgba(245, 158, 11, 0.08)",
        border: "1px solid rgba(245, 158, 11, 0.25)",
        color: "#f59e0b",
        label: "Lateral Hiring",
      };
    }
    return {
      background: "rgba(99, 102, 241, 0.08)",
      border: "1px solid rgba(99, 102, 241, 0.2)",
      color: "var(--primary)",
      label: "General Round",
    };
  };

  const startEditing = (interview: PanelistInterview) => {
    let parsed: any = null;
    try {
      if (interview.panelFeedback && interview.panelFeedback.startsWith("{")) {
        parsed = JSON.parse(interview.panelFeedback);
      }
    } catch (e) {}

    const roleLower = interview.role.toLowerCase();
    const isL1Role = roleLower.includes("l1");
    const isL2Role = roleLower.includes("l2");
    const isLateralRole = interview.hiringType === "LATERAL";

    if (isL1Role && parsed && parsed.scores) {
      setL1Ratings((prev) => ({
        ...prev,
        [interview.panelId]: {
          coding: parsed.scores.coding || 0,
          communication: parsed.scores.communication || 0,
          fundamentals: parsed.scores.fundamentals || 0,
          codingNotes: parsed.notes?.codingNotes || "",
          commNotes: parsed.notes?.communicationNotes || "",
          fundNotes: parsed.notes?.fundamentalsNotes || "",
          comments: parsed.comments || "",
        },
      }));
    } else if (isL2Role && parsed && parsed.scores) {
      setL2Ratings((prev) => ({
        ...prev,
        [interview.panelId]: {
          design: parsed.scores.systemDesign || 0,
          depth: parsed.scores.technicalDepth || 0,
          leadership: parsed.scores.leadership || 0,
          fit: parsed.scores.culturalFit || 0,
          designNotes: parsed.notes?.systemDesignNotes || "",
          depthNotes: parsed.notes?.technicalDepthNotes || "",
          leadNotes: parsed.notes?.leadershipNotes || "",
          fitNotes: parsed.notes?.culturalFitNotes || "",
          comments: parsed.comments || "",
        },
      }));
    } else if (isLateralRole && parsed && parsed.scores) {
      setLateralRatings((prev) => ({
        ...prev,
        [interview.panelId]: {
          technical: parsed.scores.technical || 0,
          communication: parsed.scores.communication || 0,
          collaboration: parsed.scores.collaboration || 0,
          techNotes: parsed.notes?.technicalNotes || "",
          commNotes: parsed.notes?.communicationNotes || "",
          collabNotes: parsed.notes?.collaborationNotes || "",
          comments: parsed.comments || "",
        },
      }));
    } else if (parsed && parsed.scores) {
      setGenRatings((prev) => ({
        ...prev,
        [interview.panelId]: {
          technical: parsed.scores.technical || 0,
          communication: parsed.scores.communication || 0,
          collaboration: parsed.scores.collaboration || 0,
          techNotes: parsed.notes?.technicalNotes || "",
          commNotes: parsed.notes?.communicationNotes || "",
          collabNotes: parsed.notes?.collaborationNotes || "",
          comments: parsed.comments || "",
        },
      }));
    }

    setIsEditing((prev) => ({ ...prev, [interview.panelId]: true }));
  };

  const handleStatusChange = async (
    interview: PanelistInterview,
    newStatus: string,
  ) => {
    if (!interview.candidateId) return;
    setUpdatingStatus((prev) => ({ ...prev, [interview.panelId]: true }));
    try {
      const res = await fetch(
        `/api/panelist/candidate-status/${interview.candidateId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outcomeStatus: newStatus }),
        },
      );
      if (!res.ok) throw new Error("Failed to update status");
      setInterviews((prev) =>
        prev.map((i) =>
          i.panelId === interview.panelId
            ? { ...i, outcomeStatus: newStatus }
            : i,
        ),
      );
    } catch (err) {
      console.error("Status update failed", err);
    } finally {
      setUpdatingStatus((prev) => ({ ...prev, [interview.panelId]: false }));
    }
  };

  const renderStarRating = (
    currentRating: number,
    onChange: (rating: number) => void,
    disabled = false,
  ) => {
    return (
      <div
        role="radiogroup"
        aria-label="Rating out of 5"
        style={{ display: "flex", gap: "6px" }}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const active = star <= currentRating;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={star === currentRating}
              aria-label={`${star} of 5 stars`}
              disabled={disabled}
              onClick={() => onChange(star)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: disabled ? "default" : "pointer",
                color: active ? "#fbbf24" : "var(--star-empty)",
                fontSize: "1.4rem",
                lineHeight: 1,
                transition: "transform 0.1s",
                userSelect: "none",
              }}
              onMouseEnter={(e) => {
                if (!disabled) e.currentTarget.style.transform = "scale(1.25)";
              }}
              onMouseLeave={(e) => {
                if (!disabled) e.currentTarget.style.transform = "scale(1)";
              }}
            >
              ★
            </button>
          );
        })}
      </div>
    );
  };

  const renderStarsStatic = (rating: number) => {
    return (
      <div style={{ display: "flex", gap: "3px" }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            style={{
              color: star <= rating ? "#fbbf24" : "var(--star-empty)",
              fontSize: "1.1rem",
              lineHeight: 1,
            }}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDriveDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1
          style={{
            fontSize: "1.35rem",
            fontWeight: 700,
            marginBottom: "0.3rem",
          }}
        >
          My Interviews
        </h1>
        <p className="text-muted text-sm">
          {interviews.length === 0
            ? "No scheduled interviews assigned to you yet."
            : `${interviews.length} scheduled interview${interviews.length !== 1 ? "s" : ""} assigned to you`}
          {panelistRoles.length > 0 && (
            <span style={{ marginLeft: "0.75rem" }}>
              {panelistRoles.map((r) => (
                <span
                  key={r}
                  className="badge badge-info"
                  style={{ fontSize: "0.6rem", marginLeft: "0.3rem" }}
                >
                  {r}
                </span>
              ))}
            </span>
          )}
        </p>
      </div>


      {/* Filter Bar */}
      <div
        style={{
          padding: "0.65rem 1.25rem",
          marginBottom: "2.5rem",
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          flexWrap: "wrap",
          borderRadius: "12px",
          background: "var(--bg-card)",
          border: "1px solid var(--border-glass)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.8rem",
            fontWeight: 650,
            color: "var(--text-muted)",
          }}
        >
          <SlidersHorizontal size={13} />
          <span>Filters:</span>
        </div>

        <div
          style={{
            display: "flex",
            gap: "0.6rem",
            alignItems: "center",
            flexWrap: "wrap",
            flex: 1,
          }}
        >
          {/* Active Drive Scope */}
          {/* {activeHiringTab === "CAMPUS" && activeDrive && ( */}
          {activeHiringTab !== "LATERAL" && activeDrive && (
            <button
              onClick={() => setFilterActiveDrive(!filterActiveDrive)}
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: "50px",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "var(--transition-fast)",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                border: filterActiveDrive
                  ? "1px solid var(--primary)"
                  : "1px solid var(--border-glass)",
                background: filterActiveDrive
                  ? "var(--primary-glow)"
                  : "transparent",
                color: filterActiveDrive
                  ? "var(--primary)"
                  : "var(--text-muted)",
                outline: "none",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: filterActiveDrive
                    ? "var(--primary)"
                    : "var(--text-muted)",
                  display: "inline-block",
                  transition: "background-color 0.2s",
                }}
              />
              <span>Active Drive Only ({activeDrive.collegeName})</span>
            </button>
          )}

          {/* Calendar Date Filter */}
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}
          >
            <span
              style={{
                fontSize: "0.76rem",
                color: "var(--text-muted)",
                fontWeight: 550,
              }}
            >
              Date:
            </span>
            <input
              type="date"
              className="form-input"
              value={filterDate || ""}
              onChange={(e) => setFilterDate(e.target.value || null)}
              style={{
                padding: "0.35rem 2.2rem 0.35rem 0.75rem",
                fontSize: "0.78rem",
                borderRadius: "50px",
                height: "32px",
                width: "145px",
                minHeight: "auto",
                border: filterDate
                  ? "1px solid var(--primary)"
                  : "1px solid var(--border-glass)",
                backgroundColor: filterDate
                  ? "var(--primary-glow)"
                  : "transparent",
                color: filterDate ? "var(--primary)" : "var(--text-muted)",
                outline: "none",
                cursor: "pointer",
              }}
            />
          </div>
        </div>

        {/* Reset Filters Link */}
        {(filterDate ||
          (activeHiringTab === "CAMPUS" && filterActiveDrive)) && (
          <button
            onClick={() => {
              setFilterActiveDrive(false);
              setFilterDate(null);
            }}
            style={{
              background: "rgba(239, 68, 68, 0.05)",
              border: "1px solid rgba(239, 68, 68, 0.15)",
              color: "#ef4444",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              padding: "0.35rem 0.8rem",
              borderRadius: "50px",
              transition: "var(--transition-fast)",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              outline: "none",
            }}
          >
            <X size={11} />
            <span>Clear Filters</span>
          </button>
        )}
      </div>
      {/* Tab Navigation */}
      <PanelistTabs
        activePrimaryTab={activePrimaryTab}
        activeHiringTab={activeHiringTab}
        activeRoundTab={activeRoundTab}
        tabCounts={tabCounts}
        onChangePrimaryTab={setActivePrimaryTab}
        onChangeHiringTab={setActiveHiringTab}
        onChangeRoundTab={setActiveRoundTab}
        showRecalibrate={activeHiringTab === "LATERAL"}
      />

      {activePrimaryTab === "RECALIBRATE" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <h2
              style={{
                fontSize: "1.15rem",
                fontWeight: 700,
                marginBottom: "0.25rem",
              }}
            >
              Recalibrate — Lateral Hiring
            </h2>
            <p className="text-muted text-sm" style={{ margin: 0 }}>
              Generate spec-driven interview questions, score live, and export a
              report for each lateral candidate assigned to you.
            </p>
          </div>
          {interviews.filter((i) => i.hiringType === "LATERAL").length ===
          0 ? (
            <div
              className="glass-card"
              style={{ padding: "2rem", textAlign: "center" }}
            >
              <span className="text-muted text-sm">
                No lateral hiring interviews assigned to you yet.
              </span>
            </div>
          ) : (
            interviews
              .filter((i) => i.hiringType === "LATERAL")
              .map((interview) => (
                <RecalibratePanel
                  key={interview.interviewId}
                  interviewId={interview.interviewId}
                  candidateName={interview.candidateName}
                  positionTitle={interview.role.replace(/^LATERAL - /i, "")}
                  panelistName={panelistName}
                />
              ))
          )}
        </div>
      )}

      {activePrimaryTab === "PANELS" && (
        <div>

          {/* Pending Action / Slot Requests Section */}
          <PendingRequestsList
            requests={filteredSortedRequests}
            totalRequests={pendingRequests.length}
            activeDrive={activeDrive}
            onSelectRequest={setSelectedRequest}
          />
        </div>
      )}

      {activePrimaryTab === "FEEDBACK" && (
        <div>
          {/* Scheduled Interviews */}
          <ScheduledInterviewsList
            filteredCount={filteredSortedInterviews.length}
            totalCount={interviews.length}
          >
              {filteredSortedInterviews.map((interview) => {
                const outcomeStatus = interview.outcomeStatus || "PENDING";
                const statusColor = STATUS_COLOR[outcomeStatus] || "#94a3b8";
                const initials = interview.candidateName
                  .split(" ")
                  .map((w) => w[0] || "")
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();
                const feedbackAlreadySubmitted =
                  !!interview.panelFeedback || !!interview.panelDecision;
                const isL1Role = interview.role.toLowerCase().includes("l1");
                const isL2Role = interview.role.toLowerCase().includes("l2");
                const accentColor = isL1Role
                  ? "#0ea5e9"
                  : isL2Role
                    ? "#7c3aed"
                    : "var(--primary)";
                const isSubmitting = submittingFeedback[interview.panelId];

                return (
                  <div
                    key={interview.panelId}
                    className="glass-card"
                    style={{
                      padding: "1.25rem 1.5rem",
                      borderTop: "1px solid var(--border-glass)",
                      borderRight: "1px solid var(--border-glass)",
                      borderBottom: "1px solid var(--border-glass)",
                      borderLeft: `3px solid ${accentColor}`,
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    }}
                  >
                    {/* Top row: candidate info + status */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "1rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                        }}
                      >
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: "50%",
                            background: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
                            border: `1px solid color-mix(in srgb, ${accentColor} 20%, transparent)`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            color: accentColor,
                            flexShrink: 0,
                          }}
                        >
                          {initials || <User size={16} />}
                        </div>
                        <div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.5rem",
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 700,
                                fontSize: "0.95rem",
                                fontFamily: "var(--font-heading)",
                              }}
                            >
                              {interview.candidateName}
                            </span>
                            <span
                              style={{
                                fontSize: "0.68rem",
                                background: getRoleBadgeStyle(interview.role)
                                  .background,
                                border: getRoleBadgeStyle(interview.role)
                                  .border,
                                borderRadius: "4px",
                                padding: "0.08rem 0.35rem",
                                color: getRoleBadgeStyle(interview.role).color,
                                fontWeight: 600,
                              }}
                            >
                              {interview.role}
                            </span>
                          </div>
                          <div
                            className="text-muted text-xs"
                            style={{ marginTop: "0.1rem" }}
                          >
                            {interview.candidateEmail}
                          </div>
                        </div>
                      </div>

                      {/* Minimal status indicator */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          color: "var(--text-muted)",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: statusColor,
                          }}
                        ></span>
                        <span>
                          {STATUS_LABEL[outcomeStatus] || outcomeStatus}
                        </span>
                      </div>
                    </div>

                    {/* Scheduled time + Teams link */}
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
                        <Calendar
                          size={13}
                          style={{ color: "var(--text-muted)" }}
                        />
                        <span
                          style={{ fontWeight: 550, color: "var(--text-main)" }}
                        >
                          {formatDateTime(interview.scheduledSlotStart)}
                        </span>
                        <span>•</span>
                        <Clock
                          size={12}
                          style={{ color: "var(--text-muted)" }}
                        />
                        <span>{interview.duration} min</span>
                      </div>
                      {interview.teamsMeetingUrl && (
                        <a
                          href={interview.teamsMeetingUrl}
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
                            (e.currentTarget.style.color =
                              "var(--primary-hover)")
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

                    {interview.candidateId && (
                      <AiCopilotPanel
                        interviewId={interview.interviewId}
                        defaultRoleTitle={interview.role}
                      />
                    )}

                    {interview.hiringType === "LATERAL" && (
                      <div style={{ margin: "0.5rem 0" }}>
                        <a
                          href={`/api/interviews/${interview.interviewId}/resume`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            color: "#f59e0b",
                            textDecoration: "none",
                          }}
                        >
                          <FileText size={13} />
                          <span>View Resume</span>
                        </a>
                      </div>
                    )}

                    {/* Feedback section */}
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-start",
                          margin: "0.25rem 0",
                        }}
                      >
                        <button
                          onClick={() =>
                            toggleFeedbackExpansion(
                              interview.panelId,
                              interview.role.toLowerCase().includes("l2"),
                              interview.candidateEmail,
                            )
                          }
                          style={{
                            background: "none",
                            border: "none",
                            padding: "0.25rem 0",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            color: "var(--primary)",
                            cursor: "pointer",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            transition: "color 0.2s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.color =
                              "var(--primary-hover)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.color = "var(--primary)")
                          }
                        >
                          <MessageSquare size={13} />
                          <span>
                            {feedbackAlreadySubmitted
                              ? "View Submitted Feedback"
                              : "Submit Candidate Feedback"}
                          </span>
                          <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>
                            {expandedFeedbacks[interview.panelId] ? "▲" : "▼"}
                          </span>
                        </button>
                      </div>

                      {expandedFeedbacks[interview.panelId] && (
                        <div
                          style={{
                            paddingLeft: "1rem",
                            borderLeft: "2px solid var(--border-glass)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.75rem",
                            marginTop: "0.75rem",
                            paddingTop: "0.25rem",
                            paddingBottom: "0.25rem",
                          }}
                        >
                          {/* L1 Feedback for L2 Panelists */}
                          {interview.role.toLowerCase().includes("l2") && (
                            <div
                              style={{
                                marginBottom: "1rem",
                                paddingBottom: "1rem",
                                borderBottom: "1px dashed var(--border-glass)",
                              }}
                            >
                              <h4
                                style={{
                                  fontSize: "0.8rem",
                                  fontWeight: 700,
                                  margin: "0 0 0.5rem 0",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.4rem",
                                  color: "var(--text-main)",
                                }}
                              >
                                <MessageSquare
                                  size={13}
                                  className="text-primary"
                                />
                                L1 Round Feedback Reference
                              </h4>

                              {loadingL1Feedbacks[interview.panelId] ? (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                    fontSize: "0.75rem",
                                    color: "var(--text-muted)",
                                  }}
                                >
                                  <Loader2
                                    size={13}
                                    className="animate-spin text-primary"
                                  />
                                  <span>Loading L1 feedback...</span>
                                </div>
                              ) : !l1FeedbacksForCandidate[interview.panelId] ||
                                l1FeedbacksForCandidate[interview.panelId]
                                  .length === 0 ? (
                                <div
                                  style={{
                                    fontSize: "0.75rem",
                                    color: "var(--text-muted)",
                                    fontStyle: "italic",
                                  }}
                                >
                                  No submitted L1 feedback found for this
                                  candidate.
                                </div>
                              ) : (
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "0.75rem",
                                  }}
                                >
                                  {l1FeedbacksForCandidate[
                                    interview.panelId
                                  ].map((l1, idx) => {
                                    const parsedL1 = parseFeedbackSafely(
                                      l1.feedback,
                                    );
                                    const isPassedL1 = l1.decision === "PASSED";
                                    const badgeColor = isPassedL1
                                      ? "var(--success)"
                                      : "var(--danger)";
                                    const badgeBg = isPassedL1
                                      ? "var(--success-glow)"
                                      : "var(--danger-glow)";
                                    const badgeBorder = isPassedL1
                                      ? "rgba(16, 185, 129, 0.2)"
                                      : "rgba(239, 68, 68, 0.2)";

                                    return (
                                      <div
                                        key={l1.panelId || idx}
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "0.35rem",
                                        }}
                                      >
                                        <div
                                          style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            flexWrap: "wrap",
                                            gap: "0.5rem",
                                          }}
                                        >
                                          <div
                                            style={{
                                              fontSize: "0.75rem",
                                              color: "var(--text-muted)",
                                            }}
                                          >
                                            Evaluator:{" "}
                                            <strong
                                              style={{
                                                color: "var(--text-main)",
                                              }}
                                            >
                                              {l1.panelistName}
                                            </strong>
                                          </div>
                                          <span
                                            className="badge"
                                            style={{
                                              fontSize: "0.58rem",
                                              background: badgeBg,
                                              border: `1px solid ${badgeBorder}`,
                                              color: badgeColor,
                                              padding: "0.08rem 0.35rem",
                                            }}
                                          >
                                            {l1.decision}
                                          </span>
                                        </div>

                                        {parsedL1 && parsedL1.scores && (
                                          <div
                                            style={{
                                              display: "flex",
                                              flexDirection: "column",
                                              gap: "0.2rem",
                                              margin: "0.15rem 0",
                                            }}
                                          >
                                            {Object.entries(
                                              parsedL1.scores,
                                            ).map(([metric, score]) => {
                                              const displayNames: Record<
                                                string,
                                                string
                                              > = {
                                                coding: "Coding",
                                                communication: "Communication",
                                                fundamentals: "Fundamentals",
                                              };
                                              return (
                                                <div
                                                  key={metric}
                                                  style={{
                                                    display: "flex",
                                                    justifyContent:
                                                      "space-between",
                                                    alignItems: "center",
                                                  }}
                                                >
                                                  <span
                                                    style={{
                                                      fontSize: "0.68rem",
                                                      color:
                                                        "var(--text-muted)",
                                                    }}
                                                  >
                                                    {displayNames[metric] ||
                                                      metric}
                                                    :
                                                  </span>
                                                  {renderStarsStatic(
                                                    score as number,
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}

                                        <div style={{ fontSize: "0.75rem" }}>
                                          <span
                                            style={{
                                              fontSize: "0.62rem",
                                              color: "var(--text-muted)",
                                              textTransform: "uppercase",
                                              fontWeight: 700,
                                              display: "block",
                                              marginBottom: "1px",
                                            }}
                                          >
                                            Comments
                                          </span>
                                          <p
                                            style={{
                                              margin: 0,
                                              color: "var(--text-main)",
                                              fontSize: "0.75rem",
                                              lineHeight: 1.4,
                                              whiteSpace: "pre-wrap",
                                            }}
                                          >
                                            {parsedL1
                                              ? parsedL1.comments
                                              : l1.feedback || "No comments."}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                          {feedbackAlreadySubmitted &&
                          !isEditing[interview.panelId]
                            ? (() => {
                                let parsed: any = null;
                                let isJson = false;
                                try {
                                  if (
                                    interview.panelFeedback &&
                                    interview.panelFeedback.startsWith("{")
                                  ) {
                                    parsed = JSON.parse(
                                      interview.panelFeedback,
                                    );
                                    isJson = true;
                                  }
                                } catch (e) {}

                                let editTimeRemaining = "";
                                let canEdit = false;
                                let isL1PassLocked = false;

                                if (interview.panelSubmittedAt) {
                                  const submittedDate = new Date(
                                    interview.panelSubmittedAt,
                                  );
                                  const elapsedMs =
                                    Date.now() - submittedDate.getTime();
                                  const twoHoursMs = 2 * 60 * 60 * 1000;
                                  const remainingMs = twoHoursMs - elapsedMs;

                                  if (remainingMs > 0) {
                                    canEdit = true;
                                    const remainingMins = Math.ceil(
                                      remainingMs / (60 * 1000),
                                    );
                                    editTimeRemaining = `${remainingMins} min remaining`;
                                  }
                                }

                                // L1 Pass locking check
                                if (
                                  interview.role.toLowerCase().includes("l1") &&
                                  interview.panelDecision === "PASSED"
                                ) {
                                  canEdit = false;
                                  isL1PassLocked = true;
                                }

                                const renderFeedbackHeader = () => (
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      borderBottom:
                                        "1px solid var(--border-glass)",
                                      paddingBottom: "0.5rem",
                                      marginBottom: "0.5rem",
                                      flexWrap: "wrap",
                                      gap: "0.5rem",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.4rem",
                                      }}
                                    >
                                      <CheckCircle
                                        size={13}
                                        style={{
                                          color:
                                            interview.panelDecision === "PASSED"
                                              ? "var(--success)"
                                              : "var(--danger)",
                                        }}
                                      />
                                      <span
                                        style={{
                                          fontSize: "0.8rem",
                                          color:
                                            interview.panelDecision === "PASSED"
                                              ? "var(--success)"
                                              : "var(--danger)",
                                          fontWeight: 700,
                                        }}
                                      >
                                        {isJson && parsed?.type
                                          ? parsed.type
                                          : "Interview"}{" "}
                                        Feedback —{" "}
                                        {interview.panelDecision === "PASSED"
                                          ? "Passed"
                                          : "Rejected"}
                                      </span>
                                    </div>

                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.5rem",
                                      }}
                                    >
                                      {isL1PassLocked && (
                                        <span
                                          style={{
                                            fontSize: "0.72rem",
                                            color: "var(--text-muted)",
                                            fontStyle: "italic",
                                          }}
                                        >
                                          L1 Pass Final (Locked)
                                        </span>
                                      )}
                                      {!isL1PassLocked && canEdit && (
                                        <>
                                          <span
                                            style={{
                                              fontSize: "0.72rem",
                                              color: "#fbbf24",
                                              fontWeight: 600,
                                            }}
                                          >
                                            ⏱️ {editTimeRemaining}
                                          </span>
                                          <button
                                            onClick={() =>
                                              startEditing(interview)
                                            }
                                            className="btn btn-secondary btn-xs"
                                            style={{
                                              padding: "0.2rem 0.5rem",
                                              fontSize: "0.7rem",
                                            }}
                                          >
                                            Edit Feedback
                                          </button>
                                        </>
                                      )}
                                      {!isL1PassLocked && !canEdit && (
                                        <span
                                          style={{
                                            fontSize: "0.72rem",
                                            color: "var(--text-muted)",
                                            fontStyle: "italic",
                                          }}
                                        >
                                          Editing Window Expired
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );

                                if (isJson && parsed) {
                                  return (
                                    <div
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "0.6rem",
                                      }}
                                    >
                                      {renderFeedbackHeader()}

                                      {/* Scores & individual notes */}
                                      {parsed.type === "L1" && (
                                        <div
                                          style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "0.4rem",
                                            fontSize: "0.75rem",
                                          }}
                                        >
                                          <div>
                                            <div
                                              style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                              }}
                                            >
                                              <span style={{ fontWeight: 600 }}>
                                                Coding &amp; Problem Solving:
                                              </span>
                                              {renderStarsStatic(
                                                parsed.scores?.coding || 0,
                                              )}
                                            </div>
                                            {parsed.notes?.codingNotes && (
                                              <p
                                                style={{
                                                  color: "var(--text-muted)",
                                                  margin: "2px 0 0 0",
                                                  fontSize: "0.72rem",
                                                  lineHeight: 1.35,
                                                }}
                                              >
                                                {parsed.notes.codingNotes}
                                              </p>
                                            )}
                                          </div>
                                          <div
                                            style={{
                                              borderTop:
                                                "1px solid var(--border-glass)",
                                              paddingTop: "0.25rem",
                                            }}
                                          >
                                            <div
                                              style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                              }}
                                            >
                                              <span style={{ fontWeight: 600 }}>
                                                Technical Communication:
                                              </span>
                                              {renderStarsStatic(
                                                parsed.scores?.communication ||
                                                  0,
                                              )}
                                            </div>
                                            {parsed.notes
                                              ?.communicationNotes && (
                                              <p
                                                style={{
                                                  color: "var(--text-muted)",
                                                  margin: "2px 0 0 0",
                                                  fontSize: "0.72rem",
                                                  lineHeight: 1.35,
                                                }}
                                              >
                                                {
                                                  parsed.notes
                                                    .communicationNotes
                                                }
                                              </p>
                                            )}
                                          </div>
                                          <div
                                            style={{
                                              borderTop:
                                                "1px solid var(--border-glass)",
                                              paddingTop: "0.25rem",
                                            }}
                                          >
                                            <div
                                              style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                              }}
                                            >
                                              <span style={{ fontWeight: 600 }}>
                                                CS Fundamentals:
                                              </span>
                                              {renderStarsStatic(
                                                parsed.scores?.fundamentals ||
                                                  0,
                                              )}
                                            </div>
                                            {parsed.notes
                                              ?.fundamentalsNotes && (
                                              <p
                                                style={{
                                                  color: "var(--text-muted)",
                                                  margin: "2px 0 0 0",
                                                  fontSize: "0.72rem",
                                                  lineHeight: 1.35,
                                                }}
                                              >
                                                {parsed.notes.fundamentalsNotes}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {parsed.type === "L2" && (
                                        <div
                                          style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "0.4rem",
                                            fontSize: "0.75rem",
                                          }}
                                        >
                                          <div>
                                            <div
                                              style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                              }}
                                            >
                                              <span style={{ fontWeight: 600 }}>
                                                System Design &amp; Scalability:
                                              </span>
                                              {renderStarsStatic(
                                                parsed.scores?.systemDesign ||
                                                  0,
                                              )}
                                            </div>
                                            {parsed.notes
                                              ?.systemDesignNotes && (
                                              <p
                                                style={{
                                                  color: "var(--text-muted)",
                                                  margin: "2px 0 0 0",
                                                  fontSize: "0.72rem",
                                                  lineHeight: 1.35,
                                                }}
                                              >
                                                {parsed.notes.systemDesignNotes}
                                              </p>
                                            )}
                                          </div>
                                          <div
                                            style={{
                                              borderTop:
                                                "1px solid var(--border-glass)",
                                              paddingTop: "0.25rem",
                                            }}
                                          >
                                            <div
                                              style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                              }}
                                            >
                                              <span style={{ fontWeight: 600 }}>
                                                Technical Depth &amp;
                                                Experience:
                                              </span>
                                              {renderStarsStatic(
                                                parsed.scores?.technicalDepth ||
                                                  0,
                                              )}
                                            </div>
                                            {parsed.notes
                                              ?.technicalDepthNotes && (
                                              <p
                                                style={{
                                                  color: "var(--text-muted)",
                                                  margin: "2px 0 0 0",
                                                  fontSize: "0.72rem",
                                                  lineHeight: 1.35,
                                                }}
                                              >
                                                {
                                                  parsed.notes
                                                    .technicalDepthNotes
                                                }
                                              </p>
                                            )}
                                          </div>
                                          <div
                                            style={{
                                              borderTop:
                                                "1px solid var(--border-glass)",
                                              paddingTop: "0.25rem",
                                            }}
                                          >
                                            <div
                                              style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                              }}
                                            >
                                              <span style={{ fontWeight: 600 }}>
                                                Leadership &amp; Ownership:
                                              </span>
                                              {renderStarsStatic(
                                                parsed.scores?.leadership || 0,
                                              )}
                                            </div>
                                            {parsed.notes?.leadershipNotes && (
                                              <p
                                                style={{
                                                  color: "var(--text-muted)",
                                                  margin: "2px 0 0 0",
                                                  fontSize: "0.72rem",
                                                  lineHeight: 1.35,
                                                }}
                                              >
                                                {parsed.notes.leadershipNotes}
                                              </p>
                                            )}
                                          </div>
                                          <div
                                            style={{
                                              borderTop:
                                                "1px solid var(--border-glass)",
                                              paddingTop: "0.25rem",
                                            }}
                                          >
                                            <div
                                              style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                              }}
                                            >
                                              <span style={{ fontWeight: 600 }}>
                                                Cultural Fit &amp; MS Values:
                                              </span>
                                              {renderStarsStatic(
                                                parsed.scores?.culturalFit || 0,
                                              )}
                                            </div>
                                            {parsed.notes?.culturalFitNotes && (
                                              <p
                                                style={{
                                                  color: "var(--text-muted)",
                                                  margin: "2px 0 0 0",
                                                  fontSize: "0.72rem",
                                                  lineHeight: 1.35,
                                                }}
                                              >
                                                {parsed.notes.culturalFitNotes}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {parsed.type === "General" && (
                                        <div
                                          style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "0.4rem",
                                            fontSize: "0.75rem",
                                          }}
                                        >
                                          <div>
                                            <div
                                              style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                              }}
                                            >
                                              <span style={{ fontWeight: 600 }}>
                                                Technical Depth:
                                              </span>
                                              {renderStarsStatic(
                                                parsed.scores?.technical || 0,
                                              )}
                                            </div>
                                            {parsed.notes?.technicalNotes && (
                                              <p
                                                style={{
                                                  color: "var(--text-muted)",
                                                  margin: "2px 0 0 0",
                                                  fontSize: "0.72rem",
                                                  lineHeight: 1.35,
                                                }}
                                              >
                                                {parsed.notes.technicalNotes}
                                              </p>
                                            )}
                                          </div>
                                          <div
                                            style={{
                                              borderTop:
                                                "1px solid var(--border-glass)",
                                              paddingTop: "0.25rem",
                                            }}
                                          >
                                            <div
                                              style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                              }}
                                            >
                                              <span style={{ fontWeight: 600 }}>
                                                Communication:
                                              </span>
                                              {renderStarsStatic(
                                                parsed.scores?.communication ||
                                                  0,
                                              )}
                                            </div>
                                            {parsed.notes
                                              ?.communicationNotes && (
                                              <p
                                                style={{
                                                  color: "var(--text-muted)",
                                                  margin: "2px 0 0 0",
                                                  fontSize: "0.72rem",
                                                  lineHeight: 1.35,
                                                }}
                                              >
                                                {
                                                  parsed.notes
                                                    .communicationNotes
                                                }
                                              </p>
                                            )}
                                          </div>
                                          <div
                                            style={{
                                              borderTop:
                                                "1px solid var(--border-glass)",
                                              paddingTop: "0.25rem",
                                            }}
                                          >
                                            <div
                                              style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                              }}
                                            >
                                              <span style={{ fontWeight: 600 }}>
                                                Collaboration &amp; Teamwork:
                                              </span>
                                              {renderStarsStatic(
                                                parsed.scores?.collaboration ||
                                                  0,
                                              )}
                                            </div>
                                            {parsed.notes
                                              ?.collaborationNotes && (
                                              <p
                                                style={{
                                                  color: "var(--text-muted)",
                                                  margin: "2px 0 0 0",
                                                  fontSize: "0.72rem",
                                                  lineHeight: 1.35,
                                                }}
                                              >
                                                {
                                                  parsed.notes
                                                    .collaborationNotes
                                                }
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {parsed.type === "LATERAL" && (
                                        <div
                                          style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "0.4rem",
                                            fontSize: "0.75rem",
                                          }}
                                        >
                                          <div>
                                            <div
                                              style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                              }}
                                            >
                                              <span style={{ fontWeight: 600 }}>
                                                Technical Depth:
                                              </span>
                                              {renderStarsStatic(
                                                parsed.scores?.technical || 0,
                                              )}
                                            </div>
                                            {parsed.notes?.technicalNotes && (
                                              <p
                                                style={{
                                                  color: "var(--text-muted)",
                                                  margin: "2px 0 0 0",
                                                  fontSize: "0.72rem",
                                                  lineHeight: 1.35,
                                                }}
                                              >
                                                {parsed.notes.technicalNotes}
                                              </p>
                                            )}
                                          </div>
                                          <div
                                            style={{
                                              borderTop:
                                                "1px solid var(--border-glass)",
                                              paddingTop: "0.25rem",
                                            }}
                                          >
                                            <div
                                              style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                              }}
                                            >
                                              <span style={{ fontWeight: 600 }}>
                                                Communication:
                                              </span>
                                              {renderStarsStatic(
                                                parsed.scores?.communication ||
                                                  0,
                                              )}
                                            </div>
                                            {parsed.notes
                                              ?.communicationNotes && (
                                              <p
                                                style={{
                                                  color: "var(--text-muted)",
                                                  margin: "2px 0 0 0",
                                                  fontSize: "0.72rem",
                                                  lineHeight: 1.35,
                                                }}
                                              >
                                                {
                                                  parsed.notes
                                                    .communicationNotes
                                                }
                                              </p>
                                            )}
                                          </div>
                                          <div
                                            style={{
                                              borderTop:
                                                "1px solid var(--border-glass)",
                                              paddingTop: "0.25rem",
                                            }}
                                          >
                                            <div
                                              style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                              }}
                                            >
                                              <span style={{ fontWeight: 600 }}>
                                                Collaboration &amp; Fit:
                                              </span>
                                              {renderStarsStatic(
                                                parsed.scores?.collaboration ||
                                                  0,
                                              )}
                                            </div>
                                            {parsed.notes
                                              ?.collaborationNotes && (
                                              <p
                                                style={{
                                                  color: "var(--text-muted)",
                                                  margin: "2px 0 0 0",
                                                  fontSize: "0.72rem",
                                                  lineHeight: 1.35,
                                                }}
                                              >
                                                {
                                                  parsed.notes
                                                    .collaborationNotes
                                                }
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* Overall summary notes */}
                                      {parsed.comments && (
                                        <div
                                          style={{
                                            borderTop:
                                              "1px solid var(--border-glass)",
                                            paddingTop: "0.5rem",
                                            marginTop: "0.25rem",
                                          }}
                                        >
                                          <div
                                            style={{
                                              fontSize: "0.68rem",
                                              fontWeight: 700,
                                              color: "var(--text-muted)",
                                              textTransform: "uppercase",
                                              marginBottom: "2px",
                                            }}
                                          >
                                            Overall Summary Notes
                                          </div>
                                          <p
                                            style={{
                                              fontSize: "0.78rem",
                                              color: "var(--text-muted)",
                                              margin: 0,
                                              lineHeight: 1.45,
                                            }}
                                          >
                                            {parsed.comments}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  );
                                }

                                // Fallback to legacy string feedback
                                return (
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "0.55rem",
                                    }}
                                  >
                                    {renderFeedbackHeader()}
                                    {interview.panelFeedback && (
                                      <p
                                        style={{
                                          fontSize: "0.78rem",
                                          color: "var(--text-muted)",
                                          margin: 0,
                                          lineHeight: 1.45,
                                        }}
                                      >
                                        {interview.panelFeedback}
                                      </p>
                                    )}
                                  </div>
                                );
                              })()
                            : (() => {
                                const roleLower = interview.role.toLowerCase();
                                const isL1Role = roleLower.includes("l1");
                                const isL2Role = roleLower.includes("l2");
                                const isLateralRole =
                                  interview.hiringType === "LATERAL";

                                if (isLateralRole) {
                                  const current = lateralRatings[
                                    interview.panelId
                                  ] || {
                                    technical: 0,
                                    communication: 0,
                                    collaboration: 0,
                                    techNotes: "",
                                    commNotes: "",
                                    collabNotes: "",
                                    comments: "",
                                  };

                                  const updateLateral = (
                                    field: keyof typeof current,
                                    val: any,
                                  ) => {
                                    setLateralRatings((prev) => ({
                                      ...prev,
                                      [interview.panelId]: {
                                        ...(prev[interview.panelId] || current),
                                        [field]: val,
                                      },
                                    }));
                                  };

                                  return (
                                    <LateralFeedbackForm
                                      panelId={interview.panelId}
                                      current={current}
                                      updateLateral={updateLateral}
                                      isSubmitting={isSubmitting}
                                      feedbackError={feedbackError[interview.panelId] || undefined}
                                      isEditing={!!isEditing[interview.panelId]}
                                      onSubmit={(decision) => handleFeedbackSubmit(interview, decision)}
                                      onCancelEdit={() =>
                                        setIsEditing((prev) => ({
                                          ...prev,
                                          [interview.panelId]: false,
                                        }))
                                      }
                                    />
                                  );
                                }

                                if (isL1Role) {
                                  const current = l1Ratings[
                                    interview.panelId
                                  ] || {
                                    coding: 0,
                                    communication: 0,
                                    fundamentals: 0,
                                    codingNotes: "",
                                    commNotes: "",
                                    fundNotes: "",
                                    comments: "",
                                  };

                                  const updateL1 = (
                                    field: keyof typeof current,
                                    val: any,
                                  ) => {
                                    setL1Ratings((prev) => ({
                                      ...prev,
                                      [interview.panelId]: {
                                        ...(prev[interview.panelId] || current),
                                        [field]: val,
                                      },
                                    }));
                                  };

                                  return (
                                    <L1FeedbackForm
                                      panelId={interview.panelId}
                                      current={current}
                                      updateL1={updateL1}
                                      isSubmitting={isSubmitting}
                                      feedbackError={feedbackError[interview.panelId] || undefined}
                                      isEditing={!!isEditing[interview.panelId]}
                                      onSubmit={(decision) => handleFeedbackSubmit(interview, decision)}
                                      onCancelEdit={() =>
                                        setIsEditing((prev) => ({
                                          ...prev,
                                          [interview.panelId]: false,
                                        }))
                                      }
                                    />
                                  );
                                }

                                if (isL2Role) {
                                  const current = l2Ratings[
                                    interview.panelId
                                  ] || {
                                    design: 0,
                                    depth: 0,
                                    leadership: 0,
                                    fit: 0,
                                    designNotes: "",
                                    depthNotes: "",
                                    leadNotes: "",
                                    fitNotes: "",
                                    comments: "",
                                  };

                                  const updateL2 = (
                                    field: keyof typeof current,
                                    val: any,
                                  ) => {
                                    setL2Ratings((prev) => ({
                                      ...prev,
                                      [interview.panelId]: {
                                        ...(prev[interview.panelId] || current),
                                        [field]: val,
                                      },
                                    }));
                                  };

                                  return (
                                    <L2FeedbackForm
                                      panelId={interview.panelId}
                                      current={current}
                                      updateL2={updateL2}
                                      isSubmitting={isSubmitting}
                                      feedbackError={feedbackError[interview.panelId] || undefined}
                                      isEditing={!!isEditing[interview.panelId]}
                                      onSubmit={(decision) => handleFeedbackSubmit(interview, decision)}
                                      onCancelEdit={() =>
                                        setIsEditing((prev) => ({
                                          ...prev,
                                          [interview.panelId]: false,
                                        }))
                                      }
                                    />
                                  );
                                }

                                // General round layout
                                const current = genRatings[
                                  interview.panelId
                                ] || {
                                  technical: 0,
                                  communication: 0,
                                  collaboration: 0,
                                  techNotes: "",
                                  commNotes: "",
                                  collabNotes: "",
                                  comments: "",
                                };

                                const updateGen = (
                                  field: keyof typeof current,
                                  val: any,
                                ) => {
                                  setGenRatings((prev) => ({
                                    ...prev,
                                    [interview.panelId]: {
                                      ...(prev[interview.panelId] || current),
                                      [field]: val,
                                    },
                                  }));
                                };

                                return (
                                  <GeneralFeedbackForm
                                    panelId={interview.panelId}
                                    current={current}
                                    updateGen={updateGen}
                                    isSubmitting={isSubmitting}
                                    feedbackError={feedbackError[interview.panelId] || undefined}
                                    isEditing={!!isEditing[interview.panelId]}
                                    onSubmit={(decision) => handleFeedbackSubmit(interview, decision)}
                                    onCancelEdit={() =>
                                      setIsEditing((prev) => ({
                                        ...prev,
                                        [interview.panelId]: false,
                                      }))
                                    }
                                  />
                                );
                              })()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </ScheduledInterviewsList>
        </div>
      )}

      <AlertDialog
        open={!!pendingL1PassConfirm}
        onOpenChange={(open: boolean) => {
          if (!open) setPendingL1PassConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm final L1 decision</AlertDialogTitle>
            <AlertDialogDescription>
              Once you submit a &quot;Passed&quot; decision for L1, it is final
              and cannot be edited or changed, even within the 2-hour window.
              Are you sure you want to pass this candidate?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingL1PassConfirm) {
                  performFeedbackSubmit(pendingL1PassConfirm, "PASSED");
                }
                setPendingL1PassConfirm(null);
              }}
            >
              Yes, Pass L1
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedRequest && (
        <div
          onClick={() => {
            setSelectedRequest(null);
            refreshInterviews();
          }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(4px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
        >
          <div
            className="glass-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative",
              padding: "2rem",
              boxShadow:
                "0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)",
            }}
          >
            <AvailabilityClient
              interview={selectedRequest.interview}
              panel={selectedRequest.panel}
            />
          </div>
        </div>
      )}
    </div>
  );
};
