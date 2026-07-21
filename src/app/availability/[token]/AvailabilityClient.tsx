"use client";

import React, { useState } from "react";
import { Interview, InterviewPanel } from "@server/lib/db";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  CheckCircle,
  Loader2,
  AlertCircle,
  Video,
  ExternalLink,
} from "lucide-react";

interface AvailabilityClientProps {
  interview: Interview;
  panel: InterviewPanel;
}

export default function AvailabilityClient({
  interview,
  panel,
}: AvailabilityClientProps) {
  // Common states
  const [errorMsg, setErrorMsg] = useState("");
  const [isRejected, setIsRejected] = useState(panel.status === "REJECTED");
  const [rejectReason, setRejectReason] = useState(panel.feedback || "");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // Flow A: Panelist-First Booking (candidateName is "Pending Assignment")
  const isPendingAssignment = interview.candidateName === "Pending Assignment";

  // State for Flow A
  const [isBooked, setIsBooked] = useState(interview.status === "SCHEDULED");
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [bookedMeetings, setBookedMeetings] = useState<
    {
      startTime: string;
      endTime: string;
      joinUrl: string;
      candidateName: string;
    }[]
  >([]);
  const [isBooking, setIsBooking] = useState(false);
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);

  // State for Flow B (Original Availability submission builder)
  const [isSubmitted, setIsSubmitted] = useState(panel.status === "SUBMITTED");
  const [slots, setSlots] = useState<{ startTime: string; endTime: string }[]>(
    [],
  );
  const [inputDate, setInputDate] = useState("");
  const [inputStart, setInputStart] = useState("09:00");
  const [inputEnd, setInputEnd] = useState("17:00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Date limit strings for Flow B
  const minDate = new Date(interview.startDate).toISOString().split("T")[0];
  const maxDate = new Date(interview.endDate).toISOString().split("T")[0];

  // Flow A actions
  const toggleSlotSelection = (slotId: string) => {
    setSelectedSlots((prev) =>
      prev.includes(slotId)
        ? prev.filter((id) => id !== slotId)
        : [...prev, slotId],
    );
  };

  const handleBookSelectedSlots = async () => {
    if (selectedSlots.length === 0) return;
    setIsBooking(true);
    setErrorMsg("");

    const slotsToBook = panel.availabilities
      .filter((a) => selectedSlots.includes(a.id))
      .map((a) => ({ startTime: a.startTime, endTime: a.endTime }));

    try {
      const res = await fetch("/api/availability/select-slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: panel.token,
          slots: slotsToBook,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to book slots.");
      }

      const data = await res.json();
      setBookedMeetings(data.meetings || []);
      setIsBooked(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(
        err.message || "An error occurred while booking selected slots.",
      );
    } finally {
      setIsBooking(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!rejectReason.trim()) return;
    setIsRejecting(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/availability/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: panel.token,
          reason: rejectReason.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to decline request.");
      }

      setIsRejected(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(
        err.message || "An error occurred while declining the request.",
      );
    } finally {
      setIsRejecting(false);
    }
  };

  // Flow B actions
  const handleAddSlot = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (slots.length > 0) {
      setErrorMsg(
        "You can only add one availability slot. Remove the existing slot to add a new one.",
      );
      return;
    }

    if (!inputDate) {
      setErrorMsg("Please select a date.");
      return;
    }

    const startStr = `${inputDate}T${inputStart}`;
    const endStr = `${inputDate}T${inputEnd}`;
    const startObj = new Date(startStr);
    const endObj = new Date(endStr);

    if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) {
      setErrorMsg("Invalid date or time parameters.");
      return;
    }

    if (startObj.getTime() < Date.now()) {
      setErrorMsg("Cannot add available slots in the past.");
      return;
    }

    if (endObj.getTime() <= startObj.getTime()) {
      setErrorMsg("End time must be after start time.");
      return;
    }

    const durationMin = (endObj.getTime() - startObj.getTime()) / (60 * 1000);
    if (durationMin < interview.duration) {
      setErrorMsg(
        `The selected slot duration (${durationMin} mins) is shorter than the required interview duration (${interview.duration} mins).`,
      );
      return;
    }

    const startOfDay = new Date(interview.startDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(interview.endDate);
    endOfDay.setHours(23, 59, 59, 999);

    if (
      startObj.getTime() < startOfDay.getTime() ||
      endObj.getTime() > endOfDay.getTime()
    ) {
      setErrorMsg(
        `Slots must be within the recruiter's requested date range (${new Date(interview.startDate).toLocaleDateString("en-US")} to ${new Date(interview.endDate).toLocaleDateString("en-US")}).`,
      );
      return;
    }

    setSlots([
      {
        startTime: startObj.toISOString(),
        endTime: endObj.toISOString(),
      },
    ]);
    setInputDate("");
    setInputStart("");
    setInputEnd("");
    setErrorMsg("");
  };

  const handleRemoveSlot = (index: number) => {
    setSlots(slots.filter((_, idx) => idx !== index));
  };

  const handleSubmitSlots = async () => {
    if (slots.length === 0) {
      setErrorMsg("Please add at least one available slot.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/availability/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: panel.token,
          slots,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit availability.");
      }

      setIsSubmitted(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Error occurred while saving availability.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // If the panelist declined the nomination
  if (isRejected) {
    return (
      <div
        className="glass-card text-center animate-pulse-once"
        style={{ padding: "3rem 2rem" }}
      >
        <AlertCircle
          size={56}
          style={{ color: "#ef4444", margin: "0 auto 1.5rem" }}
        />
        <h2 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
          Nomination Declined
        </h2>
        <p
          className="text-muted"
          style={{ fontSize: "0.95rem", marginBottom: "2rem" }}
        >
          Thank you, <strong>{panel.name}</strong>. You have declined the
          nomination for the <strong>{interview.role}</strong> interview.
        </p>
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            padding: "1rem 1.5rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-glass)",
            textAlign: "left",
            marginBottom: "2rem",
          }}
        >
          <span
            className="text-xs text-muted block"
            style={{ marginBottom: "0.25rem" }}
          >
            Decline Reason
          </span>
          <span className="text-sm font-semibold">{rejectReason}</span>
        </div>
        <p className="text-muted text-xs">
          The coordinator has been notified of your response. You can safely
          close this page now.
        </p>
      </div>
    );
  }

  // If the interview is already scheduled, show the scheduled card to any accessing panelist
  if (interview.status === "SCHEDULED") {
    const start = interview.scheduledSlotStart
      ? new Date(interview.scheduledSlotStart)
      : null;
    const end = interview.scheduledSlotEnd
      ? new Date(interview.scheduledSlotEnd)
      : null;

    return (
      <div
        className="glass-card text-center animate-pulse-once"
        style={{ padding: "3rem 2rem" }}
      >
        <CheckCircle
          size={56}
          style={{ color: "var(--success)", margin: "0 auto 1.5rem" }}
        />
        <h2 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
          Interview Scheduled
        </h2>
        <p
          className="text-muted"
          style={{ fontSize: "0.95rem", marginBottom: "2rem" }}
        >
          Thank you, <strong>{panel.name}</strong>. The{" "}
          <strong>{interview.role}</strong> interview is officially scheduled.
        </p>

        {start && end && (
          <div
            style={{
              background: "rgba(255,255,255,0.02)",
              padding: "1.25rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-glass)",
              textAlign: "left",
              marginBottom: "2rem",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                marginBottom: "0.75rem",
              }}
            >
              <Calendar size={18} className="text-primary" />
              <div>
                <span className="text-xs text-muted block">Date</span>
                <span className="font-semibold text-sm">
                  {start.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                marginBottom: "0.75rem",
              }}
            >
              <Clock size={18} className="text-primary" />
              <div>
                <span className="text-xs text-muted block">Time (IST)</span>
                <span className="font-semibold text-sm">
                  {start.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  -{" "}
                  {end.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
            {interview.teamsMeetingUrl && (
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <Video size={18} className="text-primary" />
                <div>
                  <span className="text-xs text-muted block">
                    Teams Meeting Link
                  </span>
                  <a
                    href={interview.teamsMeetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-primary flex-gap-1 hover-underline"
                  >
                    Join Teams Meeting <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-muted text-xs">
          A calendar invitation has been sent to your Outlook account. You can
          safely close this page now.
        </p>
      </div>
    );
  }

  // --- RENDER FLOW A: PANEL DELIVERED CHOICE FLOW ---
  if (isPendingAssignment) {
    if (isBooked) {
      return (
        <div
          className="glass-card text-center animate-pulse-once"
          style={{ padding: "3rem 2rem" }}
        >
          <CheckCircle
            size={56}
            style={{ color: "var(--success)", margin: "0 auto 1.5rem" }}
          />
          <h2 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
            Interview Scheduled
          </h2>
          <p
            className="text-muted"
            style={{ fontSize: "0.95rem", marginBottom: "2rem" }}
          >
            Thank you, <strong>{panel.name}</strong>. The{" "}
            <strong>{interview.role}</strong> interview slot bookings are
            confirmed.
          </p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              maxHeight: "350px",
              overflowY: "auto",
              marginBottom: "2rem",
              paddingRight: "4px",
            }}
          >
            {bookedMeetings.map((meeting, idx) => {
              const start = new Date(meeting.startTime);
              const end = new Date(meeting.endTime);
              return (
                <div
                  key={idx}
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    padding: "1.25rem",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-glass)",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.85rem",
                      fontWeight: "bold",
                      color: "var(--primary)",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Slot Booking #{idx + 1}: {meeting.candidateName}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <Calendar size={16} className="text-primary" />
                    <div>
                      <span className="text-xs text-muted block">Date</span>
                      <span className="font-semibold text-xs">
                        {start.toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.75rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <Clock size={16} className="text-primary" />
                    <div>
                      <span className="text-xs text-muted block">
                        Time (IST)
                      </span>
                      <span className="font-semibold text-xs">
                        {start.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        -{" "}
                        {end.toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                  {meeting.joinUrl && (
                    <div style={{ display: "flex", gap: "0.75rem" }}>
                      <Video size={16} className="text-primary" />
                      <div>
                        <span className="text-xs text-muted block">
                          Teams Meeting Link
                        </span>
                        <a
                          href={meeting.joinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-primary flex-gap-1 hover-underline"
                        >
                          Join Teams Meeting <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-muted text-xs">
            A calendar invitation has been sent to your Outlook account. You can
            safely close this page now.
          </p>
        </div>
      );
    }

    return (
      <div className="glass-card">
        {/* Title block */}
        <div
          style={{
            borderBottom: "1px solid var(--border-glass)",
            paddingBottom: "1.5rem",
            marginBottom: "1.5rem",
          }}
        >
          <div className="badge badge-info" style={{ marginBottom: "0.75rem" }}>
            Interview Slot Selection
          </div>
          <h2 style={{ fontSize: "1.6rem", marginBottom: "0.25rem" }}>
            Select Slots for {interview.role}
          </h2>
          <p className="text-muted text-sm">
            Hi <strong>{panel.name}</strong>, please select **one or more** of
            the proposed slots below. You can book multiple slots if you are
            free to conduct multiple interviews.
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              color: "var(--danger)",
              fontSize: "0.85rem",
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
              marginBottom: "1.5rem",
              background: "var(--danger-glow)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              padding: "0.75rem",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Proposed Slots List */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            marginBottom: "2.5rem",
          }}
        >
          {panel.availabilities.length === 0 ? (
            <div
              style={{
                padding: "2.5rem",
                textAlign: "center",
                border: "1px dashed var(--border-glass)",
                borderRadius: "var(--radius-md)",
                background: "rgba(0,0,0,0.1)",
              }}
            >
              <span className="text-muted text-sm block">
                No proposed slots found.
              </span>
              <span className="text-muted text-xs">
                Please contact the recruiter to propose slots.
              </span>
            </div>
          ) : (
            panel.availabilities.map((slot) => {
              const start = new Date(slot.startTime);
              const end = new Date(slot.endTime);
              const isSelected = selectedSlots.includes(slot.id);
              const isPast = start.getTime() < Date.now();

              // Make sure past slots are never selected
              const handleSelect = () => {
                if (!isPast) {
                  toggleSlotSelection(slot.id);
                }
              };

              return (
                <div
                  key={slot.id}
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-disabled={isPast}
                  aria-label={`${start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}, ${start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} to ${end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}${isPast ? " (expired)" : ""}`}
                  tabIndex={isPast ? -1 : 0}
                  onClick={handleSelect}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !isPast) {
                      e.preventDefault();
                      handleSelect();
                    }
                  }}
                  onMouseEnter={() => !isPast && setHoveredSlotId(slot.id)}
                  onMouseLeave={() => setHoveredSlotId(null)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "1.25rem",
                    background: isPast
                      ? "rgba(255, 255, 255, 0.01)"
                      : isSelected
                        ? "rgba(0, 168, 120, 0.08)"
                        : hoveredSlotId === slot.id
                          ? "rgba(255,255,255,0.04)"
                          : "rgba(255,255,255,0.02)",
                    border: isPast
                      ? "1px dashed rgba(255, 255, 255, 0.1)"
                      : isSelected
                        ? "1px solid var(--primary)"
                        : "1px solid var(--border-glass)",
                    borderRadius: "var(--radius-md)",
                    cursor: isPast ? "not-allowed" : "pointer",
                    transform:
                      !isPast && isSelected ? "translateY(-2px)" : "none",
                    boxShadow:
                      !isPast && isSelected
                        ? "0 4px 20px rgba(0, 168, 120, 0.15)"
                        : "none",
                    transition: "all 0.2s ease",
                    opacity: isPast ? 0.45 : 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "1rem",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "4px",
                        border: isPast
                          ? "2px solid rgba(255, 255, 255, 0.15)"
                          : isSelected
                            ? "2px solid var(--primary)"
                            : "2px solid var(--border-glass)",
                        background:
                          isSelected && !isPast
                            ? "var(--primary)"
                            : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.15s ease",
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && !isPast && (
                        <span
                          style={{
                            color: "#fff",
                            fontSize: "0.75rem",
                            fontWeight: "bold",
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                    <div>
                      <span
                        className="font-semibold block text-sm"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        {start.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {isPast && (
                          <span
                            style={{
                              fontSize: "0.65rem",
                              color: "#ef4444",
                              background: "rgba(239, 68, 68, 0.12)",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              padding: "0.1rem 0.35rem",
                              borderRadius: "4px",
                              fontWeight: 700,
                            }}
                          >
                            Expired
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted">
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
                      </span>
                    </div>
                  </div>
                  <span className="text-muted text-xs">
                    {isPast
                      ? "Expired"
                      : isSelected
                        ? "Selected"
                        : "Click to select"}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Action Button */}
        <button
          className="btn btn-primary"
          style={{ width: "100%", padding: "1rem" }}
          disabled={selectedSlots.length === 0 || isBooking}
          onClick={handleBookSelectedSlots}
        >
          {isBooking ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Booking selected
              slots...
            </>
          ) : (
            `Book Selected Slot${selectedSlots.length > 1 ? "s" : ""} (${selectedSlots.length})`
          )}
        </button>

        <p
          className="text-muted text-xs text-center"
          style={{ marginTop: "1rem" }}
        >
          Note: This booking will immediately reserve Teams meeting rooms and
          coordinate calendar schedules.
        </p>

        {/* Rejection Option */}
        <div
          style={{
            marginTop: "2.5rem",
            borderTop: "1px solid var(--border-glass)",
            paddingTop: "1.5rem",
          }}
        >
          {!showRejectForm ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span className="text-xs text-muted">
                Unable to take this interview?
              </span>
              <button
                onClick={() => {
                  setShowRejectForm(true);
                  setErrorMsg("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  padding: "0.25rem 0.5rem",
                  borderRadius: "4px",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    "rgba(239, 68, 68, 0.08)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "")
                }
              >
                Decline Nomination
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                background: "rgba(239, 68, 68, 0.02)",
                border: "1px solid rgba(239, 68, 68, 0.15)",
                padding: "1.25rem",
                borderRadius: "var(--radius-md)",
              }}
            >
              <h4
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  color: "#ef4444",
                  margin: 0,
                }}
              >
                Decline Interview Nomination
              </h4>
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                  margin: 0,
                }}
              >
                Please let us know why you are declining so we can re-assign the
                candidate.
              </p>
              <textarea
                placeholder="Reason for declining (required)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border-glass)",
                  borderRadius: "var(--radius-sm)",
                  color: "inherit",
                  fontSize: "0.9rem",
                  resize: "none",
                }}
              />
              <div
                style={{
                  display: "flex",
                  gap: "0.75rem",
                  justifyContent: "flex-end",
                  marginTop: "0.25rem",
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectReason("");
                  }}
                  disabled={isRejecting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!rejectReason.trim() || isRejecting}
                  onClick={handleRejectRequest}
                  style={{
                    backgroundColor: "#ef4444",
                    color: "#fff",
                    border: "none",
                    opacity: !rejectReason.trim() || isRejecting ? 0.5 : 1,
                  }}
                >
                  {isRejecting ? "Declining..." : "Confirm Decline"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- RENDER FLOW B: ORIGINAL MULTI-AVAILABILITY SUBMISSION FLOW ---
  if (isSubmitted) {
    return (
      <div
        className="glass-card text-center animate-pulse-once"
        style={{ padding: "3rem 2rem" }}
      >
        <CheckCircle
          size={56}
          style={{ color: "var(--success)", margin: "0 auto 1.5rem" }}
        />
        <h2 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
          Availability Recorded
        </h2>
        <p
          className="text-muted"
          style={{ fontSize: "0.95rem", marginBottom: "2rem" }}
        >
          Thank you, <strong>{panel.name}</strong>. Your availability for the{" "}
          <strong>{interview.role}</strong> interview has been successfully
          saved.
        </p>

        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            padding: "1rem 1.5rem",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-glass)",
            textAlign: "left",
            marginBottom: "2rem",
          }}
        >
          <h4
            style={{
              fontSize: "0.9rem",
              marginBottom: "0.75rem",
              color: "var(--text-muted)",
            }}
          >
            Submitted Slots:
          </h4>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
          >
            {slots.map((s, idx) => {
              const start = new Date(s.startTime);
              const end = new Date(s.endTime);
              return (
                <div
                  key={idx}
                  style={{
                    fontSize: "0.875rem",
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>
                    {start.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="font-semibold">
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
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-muted text-xs">
          The recruiter will review the overlapping slots and book the meeting.
          You will receive a calendar invite automatically. You can close this
          tab now.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card max-w-2xl mx-auto backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-6 shadow-xl text-slate-200">
      {/* Title block */}
      <div className="border-b border-white/10 pb-5 mb-5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Interview Panel Availability Request
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white mb-1">
          Nomination for {interview.role} Interview
        </h2>
        <p className="text-sm text-slate-400">
          Hi{" "}
          <strong className="text-slate-200 font-semibold">{panel.name}</strong>
          , you have been selected to interview a candidate. Please provide your
          available times.
        </p>
      </div>

      {/* Interview metadata */}
      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-0.5">
          <span className="text-slate-500 text-xs font-medium block uppercase tracking-wider">
            Candidate
          </span>
          <span className="font-semibold text-slate-200">
            {interview.candidateName}
          </span>
        </div>
        <div className="space-y-0.5">
          <span className="text-slate-500 text-xs font-medium block uppercase tracking-wider">
            Required Duration
          </span>
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Clock size={14} className="text-slate-400" /> {interview.duration}{" "}
            minutes
          </span>
        </div>
        <div className="space-y-0.5">
          <span className="text-slate-500 text-xs font-medium block uppercase tracking-wider">
            Date Limits Requested
          </span>
          <span className="text-sm font-medium text-slate-300">
            {new Date(interview.startDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}{" "}
            to{" "}
            {new Date(interview.endDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
        <div className="space-y-0.5">
          <span className="text-slate-500 text-xs font-medium block uppercase tracking-wider">
            Panel Email
          </span>
          <span className="text-sm text-slate-400 break-all">
            {panel.email}
          </span>
        </div>
      </div>

      {/* Scheduled Time Slots */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">
          Scheduled Time Slots for You
        </h3>

        {panel.availabilities.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-white/10 rounded-lg bg-white/[0.01] text-slate-400 text-sm">
            No scheduled slots available.
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
            {panel.availabilities.map((slot) => {
              const start = new Date(slot.startTime);
              const end = new Date(slot.endTime);

              const isSelected = slots.some(
                (s) =>
                  s.startTime === slot.startTime && s.endTime === slot.endTime,
              );

              return (
                <div
                  key={slot.id}
                  onClick={() => {
                    if (isSelected) {
                      setSlots([]);
                    } else {
                      setSlots([
                        { startTime: slot.startTime, endTime: slot.endTime },
                      ]);
                    }
                  }}
                  className={`group cursor-pointer p-3.5 rounded-lg border transition-all duration-200 flex items-center justify-between dynamic-slot
                ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-sm shadow-emerald-500/5"
                    : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20 text-slate-300"
                }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all
                  ${isSelected ? "border-emerald-400 bg-emerald-400" : "border-slate-500 group-hover:border-slate-400"}`}
                    >
                      {isSelected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                      <span className="font-medium text-sm">
                        {start.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <span className="hidden sm:inline text-slate-500 text-xs">
                        •
                      </span>
                      <span
                        className={`text-xs ${isSelected ? "text-emerald-400/80" : "text-slate-400"}`}
                      >
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
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Visual Separator */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-slate-500 text-xs font-bold tracking-wider uppercase">
          OR
        </span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Date builder form */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">
          Add Your Free Slots
        </h3>

        <form
          onSubmit={handleAddSlot}
          className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_1fr_auto] gap-3 items-end"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400 block">
              Date
            </label>
            <input
              type="date"
              className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all [color-scheme:dark]"
              min={minDate}
              max={maxDate}
              value={inputDate}
              onChange={(e) => setInputDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400 block">
              Start Time
            </label>
            <input
              type="time"
              className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all [color-scheme:dark]"
              value={inputStart}
              onChange={(e) => setInputStart(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-400 block">
              End Time
            </label>
            <input
              type="time"
              className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all [color-scheme:dark]"
              value={inputEnd}
              onChange={(e) => setInputEnd(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white rounded-lg p-2 h-[38px] transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <Plus size={18} />
          </button>
        </form>
      </div>

      {/* Error displays */}
      {errorMsg && (
        <div className="flex gap-2.5 items-start mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-lg animate-fade-in">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Configured Slots Display */}
      <div className="mb-6">
        <h4 className="text-xs font-medium text-slate-400 tracking-wide mb-2">
          Your Added Slots ({slots.length})
        </h4>

        {slots.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-white/10 rounded-lg bg-black/20 flex flex-col gap-0.5">
            <span className="text-slate-400 text-sm font-medium">
              No slots added yet.
            </span>
            <span className="text-slate-500 text-xs">
              Add one or more slots above matching when you are free.
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
            {slots.map((slot, index) => {
              const startObj = new Date(slot.startTime);
              const endObj = new Date(slot.endTime);

              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-2.5 px-4 bg-white/[0.01] border border-white/5 hover:border-white/10 rounded-lg transition-all"
                >
                  <div className="flex items-center gap-3 text-xs sm:text-sm">
                    <span className="font-semibold text-slate-300">
                      {startObj.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span className="text-slate-500 hidden sm:inline">—</span>
                    <span className="text-slate-400 font-mono">
                      {startObj.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      -{" "}
                      {endObj.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      (IST)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveSlot(index)}
                    className="p-1 text-slate-500 hover:text-rose-400 rounded-md hover:bg-rose-500/10 transition-all duration-150"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Submission */}
      <button
        type="button"
        className={`w-full inline-flex items-center justify-center gap-2 font-medium rounded-lg p-3 text-sm transition-all shadow-md
      ${
        slots.length === 0 || isSubmitting
          ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5"
          : "bg-emerald-600 hover:bg-emerald-500 text-white focus:ring-2 focus:ring-emerald-500/50"
      }`}
        disabled={slots.length === 0 || isSubmitting}
        onClick={handleSubmitSlots}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Saving your
            availability...
          </>
        ) : (
          "Submit Availability"
        )}
      </button>

      {/* Rejection Option */}
      <div className="mt-6 border-t border-white/10 pt-4">
        {!showRejectForm ? (
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">
              Unable to take this interview?
            </span>
            <button
              type="button"
              onClick={() => {
                setShowRejectForm(true);
                setErrorMsg("");
              }}
              className="text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 rounded hover:bg-rose-500/10 transition-colors"
            >
              Decline Nomination
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 bg-rose-950/10 border border-rose-500/10 p-4 rounded-lg animate-slide-down">
            <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400">
              Decline Interview Nomination
            </h4>
            <p className="text-xs text-slate-400">
              Please let us know why you are declining so we can re-assign the
              candidate.
            </p>
            <textarea
              placeholder="Reason for declining (required)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="w-full p-2.5 bg-slate-900/40 border border-white/10 rounded-md text-slate-200 text-sm focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all placeholder:text-slate-600 resize-none"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-white/5 hover:bg-white/10 rounded border border-white/5 transition-colors"
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectReason("");
                }}
                disabled={isRejecting}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim() || isRejecting}
                onClick={handleRejectRequest}
                className="px-3 py-1.5 text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white rounded shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isRejecting ? "Declining..." : "Confirm Decline"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
