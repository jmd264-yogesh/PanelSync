"use client";

import React from "react";
import {
  Video,
  Clock,
  User,
  MessageSquare,
  Loader2,
  Calendar,
  FileText,
} from "lucide-react";
import { PanelistInterview } from "@server/lib/db";
import { RoundBadge } from "../ui/RoundBadge";
import { StarRating } from "../ui/StarRating";
import { AiCopilotPanel } from "../AiCopilotPanel";
import { RecalibratePanel } from "../RecalibratePanel";
import { SubmittedFeedbackDisplay } from "../feedback/SubmittedFeedbackDisplay";
import { L1FeedbackForm, L1RatingState } from "../feedback/L1FeedbackForm";
import { L2FeedbackForm, L2RatingState } from "../feedback/L2FeedbackForm";
import {
  LateralFeedbackForm,
  LateralRatingState,
} from "../feedback/LateralFeedbackForm";
import {
  GeneralFeedbackForm,
  GenRatingState,
} from "../feedback/GeneralFeedbackForm";
import { parseFeedbackSafely } from "@common/util/feedback-parser";
import { STATUS_LABEL, STATUS_COLOR } from "../../constants/feedback-constants";

type L1FeedbackData = {
  panelId: string;
  panelistName: string;
  decision: string;
  feedback: string;
};

type InterviewCardProps = {
  interview: PanelistInterview;
  // Feedback state
  expandedFeedbacks: Record<string, boolean>;
  isEditing: Record<string, boolean>;
  submittingFeedback: Record<string, boolean>;
  feedbackError: Record<string, string | null>;
  // L1 feedback for L2
  loadingL1Feedbacks: Record<string, boolean>;
  l1FeedbacksForCandidate: Record<string, L1FeedbackData[]>;
  // Rating states
  l1Ratings: Record<string, L1RatingState>;
  l2Ratings: Record<string, L2RatingState>;
  lateralRatings: Record<string, LateralRatingState>;
  genRatings: Record<string, GenRatingState>;
  // Callbacks
  toggleFeedbackExpansion: (
    panelId: string,
    isL2: boolean,
    candidateEmail: string,
  ) => void;
  startEditing: (interview: PanelistInterview) => void;
  handleFeedbackSubmit: (
    interview: PanelistInterview,
    decision: "PASSED" | "REJECTED",
  ) => void;
  setIsEditing: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setL1Ratings: React.Dispatch<
    React.SetStateAction<Record<string, L1RatingState>>
  >;
  setL2Ratings: React.Dispatch<
    React.SetStateAction<Record<string, L2RatingState>>
  >;
  setLateralRatings: React.Dispatch<
    React.SetStateAction<Record<string, LateralRatingState>>
  >;
  setGenRatings: React.Dispatch<
    React.SetStateAction<Record<string, GenRatingState>>
  >;
  formatDateTime: (iso: string) => string;
};

export const InterviewCard: React.FC<InterviewCardProps> = ({
  interview,
  expandedFeedbacks,
  isEditing,
  submittingFeedback,
  feedbackError,
  loadingL1Feedbacks,
  l1FeedbacksForCandidate,
  l1Ratings,
  l2Ratings,
  lateralRatings,
  genRatings,
  toggleFeedbackExpansion,
  startEditing,
  handleFeedbackSubmit,
  setIsEditing,
  setL1Ratings,
  setL2Ratings,
  setLateralRatings,
  setGenRatings,
  formatDateTime,
}) => {
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
              <RoundBadge role={interview.role} />
            </div>
            <div className="text-muted text-xs" style={{ marginTop: "0.1rem" }}>
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
          <span>{STATUS_LABEL[outcomeStatus] || outcomeStatus}</span>
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
          <Calendar size={13} style={{ color: "var(--text-muted)" }} />
          <span style={{ fontWeight: 550, color: "var(--text-main)" }}>
            {formatDateTime(interview.scheduledSlotStart)}
          </span>
          <span>•</span>
          <Clock size={12} style={{ color: "var(--text-muted)" }} />
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
              (e.currentTarget.style.color = "var(--primary-hover)")
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
                  <MessageSquare size={13} className="text-primary" />
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
                    <Loader2 size={13} className="animate-spin text-primary" />
                    <span>Loading L1 feedback...</span>
                  </div>
                ) : !l1FeedbacksForCandidate[interview.panelId] ||
                  l1FeedbacksForCandidate[interview.panelId].length === 0 ? (
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      fontStyle: "italic",
                    }}
                  >
                    No submitted L1 feedback found for this candidate.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    }}
                  >
                    {l1FeedbacksForCandidate[interview.panelId].map(
                      (l1, idx) => {
                        const parsedL1 = parseFeedbackSafely(l1.feedback);
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
                                {Object.entries(parsedL1.scores).map(
                                  ([metric, score]) => {
                                    const displayNames: Record<string, string> =
                                      {
                                        coding: "Coding",
                                        communication: "Communication",
                                        fundamentals: "Fundamentals",
                                      };
                                    return (
                                      <div
                                        key={metric}
                                        style={{
                                          display: "flex",
                                          justifyContent: "space-between",
                                          alignItems: "center",
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: "0.68rem",
                                            color: "var(--text-muted)",
                                          }}
                                        >
                                          {displayNames[metric] || metric}:
                                        </span>
                                        <StarRating
                                          rating={score as number}
                                          interactive={false}
                                        />
                                      </div>
                                    );
                                  },
                                )}
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
                      },
                    )}
                  </div>
                )}
              </div>
            )}

            {feedbackAlreadySubmitted && !isEditing[interview.panelId] ? (
              <SubmittedFeedbackDisplay
                interview={interview}
                isEditing={isEditing[interview.panelId] || false}
                startEditing={startEditing}
              />
            ) : (() => {
              const roleLower = interview.role.toLowerCase();
              const isL1Role = roleLower.includes("l1");
              const isL2Role = roleLower.includes("l2");
              const isLateralRole = interview.hiringType === "LATERAL";

              if (isLateralRole) {
                const current = lateralRatings[interview.panelId] || {
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
                    isEditing={isEditing[interview.panelId] || false}
                    onSubmit={(decision) =>
                      handleFeedbackSubmit(interview, decision)
                    }
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
                const current = l1Ratings[interview.panelId] || {
                  coding: 0,
                  communication: 0,
                  fundamentals: 0,
                  codingNotes: "",
                  commNotes: "",
                  fundNotes: "",
                  comments: "",
                };

                const updateL1 = (field: keyof typeof current, val: any) => {
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
                    isEditing={isEditing[interview.panelId] || false}
                    onSubmit={(decision) =>
                      handleFeedbackSubmit(interview, decision)
                    }
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
                const current = l2Ratings[interview.panelId] || {
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

                const updateL2 = (field: keyof typeof current, val: any) => {
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
                    isEditing={isEditing[interview.panelId] || false}
                    onSubmit={(decision) =>
                      handleFeedbackSubmit(interview, decision)
                    }
                    onCancelEdit={() =>
                      setIsEditing((prev) => ({
                        ...prev,
                        [interview.panelId]: false,
                      }))
                    }
                  />
                );
              }

              // General
              const current = genRatings[interview.panelId] || {
                technical: 0,
                communication: 0,
                collaboration: 0,
                techNotes: "",
                commNotes: "",
                collabNotes: "",
                comments: "",
              };

              const updateGen = (field: keyof typeof current, val: any) => {
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
                  isEditing={isEditing[interview.panelId] || false}
                  onSubmit={(decision) =>
                    handleFeedbackSubmit(interview, decision)
                  }
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
};
