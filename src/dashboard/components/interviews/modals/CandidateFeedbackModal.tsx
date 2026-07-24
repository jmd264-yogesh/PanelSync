"use client";

import React from "react";
import { X, MessageSquare } from "lucide-react";
import { parseFeedbackSafely } from "@common/util/feedback-parser";
import { StarRating } from "@/common/components/ui/StarRating";

interface DrivePanel {
  id: string;
  candidateName: string;
  role: string;
  name: string;
  email: string;
  decision?: "PASSED" | "REJECTED" | null | string;
  feedback?: string | null;
}

interface CandidateFeedbackModalProps {
  drivePanels: DrivePanel[];
  onClose: () => void;
}

export const CandidateFeedbackModal: React.FC<CandidateFeedbackModalProps> = ({
  drivePanels,
  onClose,
}) => {
  const feedbackPanels = drivePanels.filter(
    (p) => p.decision === "PASSED" || p.decision === "REJECTED",
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "18px",
          width: "90%",
          maxWidth: "650px",
          maxHeight: "80vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-md)",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 700,
                margin: 0,
                color: "var(--fg)",
              }}
            >
              Candidate Evaluation Feedback
            </h3>
            <p
              style={{
                color: "var(--fg-secondary)",
                fontSize: "12px",
                margin: "4px 0 0 0",
              }}
            >
              Detailed feedback and outcomes from panelists for this cohort
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--fg-secondary)",
              cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {feedbackPanels.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 16px",
                color: "var(--fg-secondary)",
              }}
            >
              <MessageSquare size={36} style={{ opacity: 0.3, margin: "0 auto 12px" }} />
              <p style={{ fontSize: "13px", margin: 0 }}>
                No panelist evaluation feedback has been submitted for this cohort yet.
              </p>
            </div>
          ) : (
            feedbackPanels.map((panel, idx) => {
              const parsed = parseFeedbackSafely(panel.feedback);
              const isPassed = panel.decision === "PASSED";
              const outcomeColor = isPassed ? "var(--accent)" : "var(--danger)";
              const outcomeBg = isPassed ? "var(--accent-light)" : "var(--danger-light)";
              const outcomeBorder = isPassed
                ? "1px solid var(--accent)"
                : "1px solid var(--danger)";

              return (
                <div
                  key={`${panel.id}-${idx}`}
                  style={{
                    padding: "16px",
                    background: outcomeBg,
                    border: outcomeBorder,
                    borderRadius: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    <div>
                      <h4
                        style={{
                          fontSize: "15px",
                          fontWeight: 700,
                          margin: 0,
                          color: "var(--fg)",
                        }}
                      >
                        {panel.candidateName}
                      </h4>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--fg-secondary)",
                        }}
                      >
                        {panel.role}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 800,
                        padding: "2px 6px",
                        background: `${outcomeColor}15`,
                        border: `1px solid ${outcomeColor}30`,
                        borderRadius: "4px",
                        color: outcomeColor,
                      }}
                    >
                      {isPassed ? "PASSED" : "REJECTED"}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: "13px",
                      borderTop: "1px solid var(--border)",
                      paddingTop: "10px",
                      marginTop: "4px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        color: "var(--fg-secondary)",
                        marginBottom: "8px",
                        fontSize: "12px",
                      }}
                    >
                      <span>
                        Evaluated by: <strong>{panel.name}</strong> ({panel.email})
                      </span>
                    </div>

                    {parsed && parsed.scores && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                          margin: "8px 0",
                          background: "var(--surface-muted)",
                          padding: "8px",
                          borderRadius: "6px",
                        }}
                      >
                        {Object.entries(parsed.scores).map(([metric, score]) => {
                          const displayNames: Record<string, string> = {
                            coding: "Coding & Problem Solving",
                            communication: "Technical Communication",
                            fundamentals: "CS Fundamentals",
                            systemDesign: "System Design & Scalability",
                            technicalDepth: "Technical Depth & Experience",
                            leadership: "Leadership & Ownership",
                            culturalFit: "Cultural Fit & MS Values",
                            technical: "Technical Depth",
                            collaboration: "Collaboration & Teamwork",
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
                                  fontSize: "12px",
                                  color: "var(--fg-secondary)",
                                }}
                              >
                                {displayNames[metric] || metric}:
                              </span>
                              <StarRating rating={score as number} />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div style={{ marginTop: "8px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--fg-secondary)",
                          textTransform: "uppercase",
                          fontWeight: 700,
                          display: "block",
                          marginBottom: "4px",
                        }}
                      >
                        Evaluation Comments
                      </span>
                      <p
                        style={{
                          margin: 0,
                          color: "var(--fg)",
                          fontSize: "13px",
                          lineHeight: 1.45,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {parsed ? parsed.comments : panel.feedback || "No comments provided."}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            background: "var(--surface-muted)",
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
