"use client";

import React from "react";
import { X, Video, Trash2 } from "lucide-react";
import { Interview } from "@server/lib/db";
import { getOverlappingSlots } from "@common/util/interviews/slot-calculation";
import { ConfirmDialog } from "@/common/components/ConfirmDialog";

interface InterviewDetailModalProps {
  interview: Interview;
  detailTab: "overview" | "panels" | "booking" | "feedback";
  setDetailTab: (tab: "overview" | "panels" | "booking" | "feedback") => void;
  todayStr: string;

  // Booking state
  selectedSlot: { start: string; end: string } | null;
  setSelectedSlot: (slot: { start: string; end: string } | null) => void;
  bookingDescription: string;
  setBookingDescription: (desc: string) => void;
  isBooking: boolean;
  bookSlot: () => void;
  cancelBooking: () => void;

  // Actions
  sendFeedbackReminder: (interviewId: string, e: React.MouseEvent) => void;
  sendingFeedbackReminderId: string | null;
  resendInvite: (interviewId: string, panelId: string) => void;
  resendingPanelId: string | null;
  isEditingDates: boolean;
  setIsEditingDates: (editing: boolean) => void;
  editStartDate: string;
  setEditStartDate: (date: string) => void;
  editEndDate: string;
  setEditEndDate: (date: string) => void;
  isUpdatingDates: boolean;
  updateDates: (e: React.FormEvent) => void;
  deleteInterview: (id: string) => void;

  // Modal control
  onClose: () => void;
}

export const InterviewDetailModal: React.FC<InterviewDetailModalProps> = ({
  interview,
  detailTab,
  setDetailTab,
  todayStr,
  selectedSlot,
  setSelectedSlot,
  bookingDescription,
  setBookingDescription,
  isBooking,
  bookSlot,
  cancelBooking,
  sendFeedbackReminder,
  sendingFeedbackReminderId,
  resendInvite,
  resendingPanelId,
  isEditingDates,
  setIsEditingDates,
  editStartDate,
  setEditStartDate,
  editEndDate,
  setEditEndDate,
  isUpdatingDates,
  updateDates,
  deleteInterview,
  onClose,
}) => {
  const passedCount = interview.panels.filter((p) => p.decision === "PASSED").length;
  const rejectedCount = interview.panels.filter((p) => p.decision === "REJECTED").length;
  const pendingCount = interview.panels.filter((p) => !p.decision).length;

  const panelsToDisplay =
    interview.status === "SCHEDULED" || interview.status === "COLLECTED"
      ? interview.panels.filter((p) => p.status === "SUBMITTED")
      : interview.panels;
  const finalPanels = panelsToDisplay.length > 0 ? panelsToDisplay : interview.panels;

  const overlaps = getOverlappingSlots(interview);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
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
          maxWidth: "900px",
          maxHeight: "90vh",
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
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 700,
              margin: 0,
              color: "var(--fg)",
            }}
          >
            {interview.candidateName}
          </h2>
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
            <X size={24} />
          </button>
        </div>

        {/* Modal Content */}
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
          {/* Interview Details Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "20px",
            }}
          >
            <div>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--fg-secondary)",
                  textTransform: "uppercase",
                  margin: "0 0 4px 0",
                }}
              >
                Role
              </p>
              <p
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  margin: 0,
                  color: "var(--fg)",
                }}
              >
                {interview.role}
              </p>
            </div>
            <div>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--fg-secondary)",
                  textTransform: "uppercase",
                  margin: "0 0 4px 0",
                }}
              >
                Status
              </p>
              <div>
                {interview.status === "PENDING" && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "4px 8px",
                      background: "var(--warning-light)",
                      border: "1px solid var(--warning)",
                      borderRadius: "4px",
                      color: "var(--warning)",
                    }}
                  >
                    Awaiting Panels
                  </span>
                )}
                {interview.status === "COLLECTED" && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "4px 8px",
                      background: "var(--info-light)",
                      border: "1px solid var(--info)",
                      borderRadius: "4px",
                      color: "var(--info)",
                    }}
                  >
                    Ready to Book
                  </span>
                )}
                {interview.status === "SCHEDULED" && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "4px 8px",
                      background: "var(--accent-light)",
                      border: "1px solid var(--accent)",
                      borderRadius: "4px",
                      color: "var(--accent)",
                    }}
                  >
                    Scheduled
                  </span>
                )}
              </div>
            </div>
            <div>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--fg-secondary)",
                  textTransform: "uppercase",
                  margin: "0 0 4px 0",
                }}
              >
                Feedback Outcome
              </p>
              <div>
                {interview.status !== "SCHEDULED" ? (
                  <span
                    style={{
                      color: "var(--fg-secondary)",
                      fontSize: "13px",
                    }}
                  >
                    Not scheduled
                  </span>
                ) : pendingCount === 0 ? (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "4px 8px",
                      background:
                        rejectedCount > 0 ? "var(--danger-light)" : "var(--accent-light)",
                      border:
                        rejectedCount > 0 ? "1px solid var(--danger)" : "1px solid var(--accent)",
                      borderRadius: "4px",
                      color: rejectedCount > 0 ? "var(--danger)" : "var(--accent)",
                    }}
                  >
                    {rejectedCount > 0 ? "REJECTED" : "PASSED"} ({passedCount} Passed,{" "}
                    {rejectedCount} Rejected)
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "4px 8px",
                      background: "var(--warning-light)",
                      border: "1px solid var(--warning)",
                      borderRadius: "4px",
                      color: "var(--warning)",
                    }}
                  >
                    PENDING ({passedCount} P, {rejectedCount} R, {pendingCount} Pending)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Panels Section */}
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
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--fg-secondary)",
                  margin: 0,
                }}
              >
                No panels assigned
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {finalPanels.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: "12px",
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontSize: "14px",
                            fontWeight: 600,
                            margin: "0 0 2px 0",
                            color: "var(--fg)",
                          }}
                        >
                          {p.name}
                        </p>
                        <p
                          style={{
                            fontSize: "12px",
                            color: "var(--fg-secondary)",
                            margin: 0,
                          }}
                        >
                          Status: {p.status === "SUBMITTED" ? "✓ Responded" : "Pending"}
                        </p>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                        }}
                      >
                        {interview.status === "SCHEDULED" &&
                          p.status === "SUBMITTED" &&
                          !p.decision && (
                            <button
                              type="button"
                              onClick={(e) => sendFeedbackReminder(interview.id, e)}
                              disabled={sendingFeedbackReminderId === interview.id}
                              className="btn btn-secondary"
                              style={{
                                height: "32px",
                                fontSize: "12px",
                                padding: "0 12px",
                              }}
                            >
                              {sendingFeedbackReminderId === interview.id
                                ? "Sending..."
                                : "Send Reminder"}
                            </button>
                          )}

                        {p.status === "PENDING" && (
                          <button
                            type="button"
                            onClick={() => resendInvite(interview.id, p.id)}
                            disabled={resendingPanelId === p.id}
                            className="btn btn-secondary"
                            style={{
                              height: "32px",
                              fontSize: "12px",
                              padding: "0 12px",
                            }}
                          >
                            {resendingPanelId === p.id ? "Resending..." : "Resend"}
                          </button>
                        )}
                      </div>
                    </div>

                    {interview.status === "SCHEDULED" && (
                      <div
                        style={{
                          marginTop: "4px",
                          paddingTop: "8px",
                          borderTop: "1px solid var(--border)",
                          width: "100%",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                            marginBottom: p.decision ? "8px" : "0",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "12px",
                              color: "var(--fg-secondary)",
                              fontWeight: 600,
                            }}
                          >
                            Decision:
                          </span>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "2px 6px",
                              background:
                                p.decision === "PASSED"
                                  ? "var(--accent-light)"
                                  : p.decision === "REJECTED"
                                    ? "var(--danger-light)"
                                    : "var(--warning-light)",
                              border:
                                p.decision === "PASSED"
                                  ? "1px solid var(--accent)"
                                  : p.decision === "REJECTED"
                                    ? "1px solid var(--danger)"
                                    : "1px solid var(--warning)",
                              borderRadius: "4px",
                              color:
                                p.decision === "PASSED"
                                  ? "var(--accent)"
                                  : p.decision === "REJECTED"
                                    ? "var(--danger)"
                                    : "var(--warning)",
                              textTransform: "uppercase",
                            }}
                          >
                            {p.decision || "PENDING"}
                          </span>
                        </div>

                        {p.feedback &&
                          (() => {
                            try {
                              const parsed = JSON.parse(p.feedback);
                              const scores = parsed.scores || {};
                              const notes = parsed.notes || {};

                              return (
                                <div
                                  style={{
                                    fontSize: "13px",
                                    color: "var(--fg)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "8px",
                                  }}
                                >
                                  {Object.keys(scores).length > 0 && (
                                    <div
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                                        gap: "8px",
                                        background: "var(--surface-muted)",
                                        padding: "8px",
                                        borderRadius: "8px",
                                        border: "1px solid var(--border)",
                                      }}
                                    >
                                      {Object.entries(scores).map(([metric, score]) => (
                                        <div
                                          key={metric}
                                          style={{
                                            display: "flex",
                                            flexDirection: "column",
                                          }}
                                        >
                                          <span
                                            style={{
                                              fontSize: "11px",
                                              color: "var(--fg-secondary)",
                                              textTransform: "capitalize",
                                            }}
                                          >
                                            {metric}
                                          </span>
                                          <span
                                            style={{
                                              fontSize: "13px",
                                              fontWeight: 700,
                                              color: "var(--info)",
                                            }}
                                          >
                                            {String(score)} / 5
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "6px",
                                      background: "var(--surface-muted)",
                                      padding: "10px",
                                      borderRadius: "8px",
                                    }}
                                  >
                                    {Object.entries(notes).map(([key, val]) => {
                                      if (!val) return null;
                                      const label = key
                                        .replace(/([A-Z])/g, " $1")
                                        .replace(/^./, (str) => str.toUpperCase());
                                      return (
                                        <div
                                          key={key}
                                          style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "2px",
                                          }}
                                        >
                                          <span
                                            style={{
                                              fontSize: "11px",
                                              color: "var(--fg-secondary)",
                                              fontWeight: 600,
                                            }}
                                          >
                                            {label}:
                                          </span>
                                          <span
                                            style={{
                                              fontSize: "13px",
                                              whiteSpace: "pre-wrap",
                                            }}
                                          >
                                            {String(val)}
                                          </span>
                                        </div>
                                      );
                                    })}

                                    {Object.keys(notes).length === 0 && parsed.comments && (
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "2px",
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: "11px",
                                            color: "var(--fg-secondary)",
                                            fontWeight: 600,
                                          }}
                                        >
                                          Comments:
                                        </span>
                                        <span
                                          style={{
                                            fontSize: "13px",
                                            whiteSpace: "pre-wrap",
                                          }}
                                        >
                                          {String(parsed.comments)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            } catch (e) {
                              return (
                                <p
                                  style={{
                                    fontSize: "13px",
                                    color: "var(--fg)",
                                    margin: 0,
                                    whiteSpace: "pre-wrap",
                                    background: "var(--surface-muted)",
                                    padding: "10px",
                                    borderRadius: "8px",
                                    border: "1px solid var(--border)",
                                  }}
                                >
                                  {p.feedback}
                                </p>
                              );
                            }
                          })()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Booking Section */}
          {interview.status === "COLLECTED" && detailTab !== "booking" && (
            <button
              type="button"
              onClick={() => {
                setSelectedSlot(null);
                setBookingDescription("");
                setDetailTab("booking");
              }}
              className="btn btn-primary"
              style={{ width: "100%", height: "42px" }}
            >
              Book Meeting
            </button>
          )}

          {interview.status === "COLLECTED" && detailTab === "booking" && (
            <div
              style={{
                padding: "16px",
                background: "var(--surface-muted)",
                borderRadius: "12px",
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    margin: 0,
                    color: "var(--fg)",
                  }}
                >
                  Pick a Slot to Book
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setDetailTab("overview");
                    setSelectedSlot(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--fg-secondary)",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  Cancel
                </button>
              </div>

              {overlaps.length === 0 ? (
                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--fg-secondary)",
                    margin: 0,
                  }}
                >
                  No overlapping availability found across the submitted panels for this
                  interview&apos;s date window.
                </p>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    maxHeight: "220px",
                    overflowY: "auto",
                  }}
                >
                  {overlaps.map((slot, idx) => {
                    const isSelected =
                      selectedSlot?.start === slot.start && selectedSlot?.end === slot.end;
                    const start = new Date(slot.start);
                    const end = new Date(slot.end);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        aria-pressed={isSelected}
                        style={{
                          textAlign: "left",
                          padding: "10px 12px",
                          borderRadius: "8px",
                          border: isSelected
                            ? "2px solid var(--accent)"
                            : "1px solid var(--border)",
                          background: isSelected ? "var(--accent-light)" : "var(--bg-elevated)",
                          color: "var(--fg)",
                          cursor: "pointer",
                          fontSize: "13px",
                        }}
                      >
                        {start.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        @{" "}
                        {start.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        -{" "}
                        {end.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        (IST)
                      </button>
                    );
                  })}
                </div>
              )}

              <input
                className="filter-select"
                type="text"
                placeholder="Meeting description (optional)"
                value={bookingDescription}
                onChange={(e) => setBookingDescription(e.target.value)}
                style={{
                  borderRadius: "10px",
                  height: "40px",
                  width: "100%",
                }}
              />

              <button
                type="button"
                onClick={bookSlot}
                disabled={!selectedSlot || isBooking}
                className="btn btn-primary"
                style={{ width: "100%", height: "42px" }}
              >
                {isBooking ? "Booking..." : "Confirm Booking"}
              </button>
            </div>
          )}

          {/* Scheduled Actions */}
          {interview.status === "SCHEDULED" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", gap: "10px" }}>
                {interview.teamsMeetingUrl && (
                  <a
                    href={interview.teamsMeetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{
                      flex: 1,
                      textDecoration: "none",
                      height: "42px",
                    }}
                  >
                    <Video size={16} /> Join Meeting
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setEditStartDate(interview.startDate.split("T")[0]);
                    setEditEndDate(interview.endDate.split("T")[0]);
                    setIsEditingDates(!isEditingDates);
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1, height: "42px" }}
                >
                  {isEditingDates ? "Close Edit" : "Edit Dates"}
                </button>
              </div>

              {isEditingDates && (
                <form
                  onSubmit={updateDates}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    padding: "12px",
                    background: "var(--surface-muted)",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                  }}
                >
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--fg-secondary)",
                      margin: 0,
                    }}
                  >
                    Changing the date range resets all proposed availability slots — panels
                    will need to resubmit.
                  </p>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input
                      className="filter-date"
                      type="date"
                      value={editStartDate}
                      min={todayStr}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      style={{
                        flex: 1,
                        height: "40px",
                        borderRadius: "10px",
                      }}
                    />
                    <input
                      className="filter-date"
                      type="date"
                      value={editEndDate}
                      min={editStartDate || todayStr}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      style={{
                        flex: 1,
                        height: "40px",
                        borderRadius: "10px",
                      }}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isUpdatingDates}
                    style={{ height: "40px" }}
                  >
                    {isUpdatingDates ? "Updating..." : "Update Dates & Reset Availability"}
                  </button>
                </form>
              )}

              <ConfirmDialog
                trigger={
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{
                      width: "100%",
                      height: "42px",
                      color: "var(--danger)",
                      borderColor: "rgba(196, 69, 60, 0.2)",
                    }}
                  >
                    Cancel Booking
                  </button>
                }
                title="Cancel this booking?"
                description="This removes the scheduled Teams meeting and calendar event, and reverts the interview back to Collected so it can be rebooked."
                confirmLabel="Yes, Cancel Booking"
                onConfirm={cancelBooking}
              />
            </div>
          )}

          {/* Delete Section */}
          <div
            style={{
              marginTop: "8px",
              borderTop: "1px solid var(--border)",
              paddingTop: "16px",
            }}
          >
            <ConfirmDialog
              trigger={
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{
                    width: "100%",
                    color: "var(--danger)",
                    borderColor: "rgba(196, 69, 60, 0.2)",
                  }}
                >
                  <Trash2 size={16} /> Delete Interview
                </button>
              }
              title="Delete this interview?"
              description="This will soft-delete the interview record and release any mapped candidates. If a Teams meeting was scheduled, the calendar event will also be removed."
              confirmLabel="Yes, Delete"
              onConfirm={() => {
                deleteInterview(interview.id);
                onClose();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
