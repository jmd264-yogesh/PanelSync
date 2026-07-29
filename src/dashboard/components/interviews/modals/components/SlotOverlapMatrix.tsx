"use client";

import React from "react";
import { TimeSlot } from "@common/util/interviews/slotOverlapCalculation";

interface SlotOverlapMatrixProps {
  overlaps: TimeSlot[];
  selectedSlot: { start: string; end: string } | null;
  bookingDescription: string;
  isBooking: boolean;
  onSelectSlot: (slot: { start: string; end: string }) => void;
  onDescriptionChange: (description: string) => void;
  onBook: () => void;
  onCancel: () => void;
}

export const SlotOverlapMatrix: React.FC<SlotOverlapMatrixProps> = ({
  overlaps,
  selectedSlot,
  bookingDescription,
  isBooking,
  onSelectSlot,
  onDescriptionChange,
  onBook,
  onCancel,
}) => {
  return (
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
        <h3 style={{ fontSize: "14px", fontWeight: 700, margin: 0, color: "var(--fg)" }}>
          Pick a Slot to Book
        </h3>
        <button
          type="button"
          onClick={onCancel}
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
        <p style={{ fontSize: "13px", color: "var(--fg-secondary)", margin: 0 }}>
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
                onClick={() => onSelectSlot(slot)}
                aria-pressed={isSelected}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border)",
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
        onChange={(e) => onDescriptionChange(e.target.value)}
        style={{
          borderRadius: "10px",
          height: "40px",
          width: "100%",
        }}
      />

      <button
        type="button"
        onClick={onBook}
        disabled={!selectedSlot || isBooking}
        className="btn btn-primary"
        style={{ width: "100%", height: "42px" }}
      >
        {isBooking ? "Booking..." : "Confirm Booking"}
      </button>
    </div>
  );
};
