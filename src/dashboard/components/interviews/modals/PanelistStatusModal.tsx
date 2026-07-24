"use client";

import React from "react";
import { X, Clock, XCircle, CheckCircle } from "lucide-react";
import { formatTimeShort } from "@common/util/date";

interface UniqueDrivePanel {
  id: string;
  name: string;
  email: string;
  candidateNames: string[];
  roles: string[];
  status: "PENDING" | "SUBMITTED" | "REJECTED";
  feedback?: string | null;
  givenSlots?: Array<{ startTime: string; endTime: string }>;
}

interface PanelistStatusModalProps {
  uniqueDrivePanels: UniqueDrivePanel[];
  onClose: () => void;
}

export const PanelistStatusModal: React.FC<PanelistStatusModalProps> = ({
  uniqueDrivePanels,
  onClose,
}) => {
  const pendingPanels = uniqueDrivePanels.filter((p) => p.status === "PENDING");
  const rejectedPanels = uniqueDrivePanels.filter((p) => p.status === "REJECTED");
  const acceptedPanels = uniqueDrivePanels.filter((p) => p.status === "SUBMITTED");

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
          maxWidth: "550px",
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
              Panelist Availability Status
            </h3>
            <p
              style={{
                color: "var(--fg-secondary)",
                fontSize: "12px",
                margin: "4px 0 0 0",
              }}
            >
              Detailed response status for the filtered interviews cohort
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
          {/* 1st Priority: Yet to Respond Section */}
          <div>
            <h4
              style={{
                fontSize: "13px",
                fontWeight: 800,
                color: "var(--warning)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                margin: "0 0 12px 0",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <Clock size={14} /> Yet to Respond ({pendingPanels.length})
            </h4>
            {pendingPanels.length === 0 ? (
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--fg-secondary)",
                  margin: 0,
                  paddingLeft: "20px",
                }}
              >
                All panel members have responded.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {pendingPanels.map((panel, idx) => (
                  <div
                    key={`${panel.id}-${idx}`}
                    style={{
                      padding: "10px 14px",
                      background: "var(--warning-light)",
                      border: "1px solid rgba(230, 169, 59, 0.2)",
                      borderRadius: "10px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--fg)",
                        }}
                      >
                        {panel.name}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--fg-secondary)",
                        }}
                      >
                        {panel.email}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--fg-secondary)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                      }}
                    >
                      <div>Candidate: {panel.candidateNames.join(", ")}</div>
                      <div>Role: {panel.roles.join(", ")}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2nd Priority: Rejected Section */}
          <div>
            <h4
              style={{
                fontSize: "13px",
                fontWeight: 800,
                color: "var(--danger)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                margin: "0 0 12px 0",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <XCircle size={14} /> Rejected ({rejectedPanels.length})
            </h4>
            {rejectedPanels.length === 0 ? (
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--fg-secondary)",
                  margin: 0,
                  paddingLeft: "20px",
                }}
              >
                No rejected nominations.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {rejectedPanels.map((panel, idx) => (
                  <div
                    key={`${panel.id}-${idx}`}
                    style={{
                      padding: "10px 14px",
                      background: "var(--danger-light)",
                      border: "1px solid rgba(239, 106, 97, 0.2)",
                      borderRadius: "10px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--fg)",
                        }}
                      >
                        {panel.name}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--fg-secondary)",
                        }}
                      >
                        {panel.email}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--fg-secondary)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                      }}
                    >
                      <div>Candidate: {panel.candidateNames.join(", ")}</div>
                      <div>Role: {panel.roles.join(", ")}</div>
                    </div>
                    {panel.feedback && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--danger)",
                          marginTop: "4px",
                          padding: "6px 10px",
                          background: "var(--danger-light)",
                          borderRadius: "4px",
                          borderLeft: "2px solid var(--danger)",
                        }}
                      >
                        <strong>Reason:</strong> {panel.feedback}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3rd Priority: Accepted Section */}
          <div>
            <h4
              style={{
                fontSize: "13px",
                fontWeight: 800,
                color: "var(--accent)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                margin: "0 0 12px 0",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <CheckCircle size={14} /> Accepted ({acceptedPanels.length})
            </h4>
            {acceptedPanels.length === 0 ? (
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--fg-secondary)",
                  margin: 0,
                  paddingLeft: "20px",
                }}
              >
                No responses yet.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {acceptedPanels.map((panel, idx) => (
                  <div
                    key={`${panel.id}-${idx}`}
                    style={{
                      padding: "10px 14px",
                      background: "var(--accent-light)",
                      border: "1px solid rgba(32, 185, 151, 0.2)",
                      borderRadius: "10px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--fg)",
                        }}
                      >
                        {panel.name}
                      </span>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--fg-secondary)",
                        }}
                      >
                        {panel.email}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--fg-secondary)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                      }}
                    >
                      <div>Candidate: {panel.candidateNames.join(", ")}</div>
                      <div>Role: {panel.roles.join(", ")}</div>
                    </div>
                    {panel.givenSlots && panel.givenSlots.length > 0 && (
                      <div
                        style={{
                          marginTop: "6px",
                          paddingTop: "6px",
                          borderTop: "1px dashed var(--border)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "var(--accent)",
                            marginBottom: "4px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <Clock size={11} />
                          Slots Provided ({panel.givenSlots.length}):
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                            paddingLeft: "12px",
                          }}
                        >
                          {panel.givenSlots.map((slot, sIdx) => {
                            const start = new Date(slot.startTime);
                            const end = new Date(slot.endTime);
                            return (
                              <div
                                key={sIdx}
                                style={{
                                  fontSize: "12px",
                                  color: "var(--fg-secondary)",
                                }}
                              >
                                {start.toLocaleDateString("en-US", {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}{" "}
                                &bull;{" "}
                                <span
                                  style={{
                                    fontWeight: 600,
                                    color: "var(--fg)",
                                  }}
                                >
                                  {formatTimeShort(start)} - {formatTimeShort(end)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
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
