/**
 * SlotSelectorItem Component
 *
 * Individual slot item with checkbox, date/time display, and expired state
 */

"use client";

import React from "react";
import { Calendar, Clock } from "lucide-react";
import { isSlotExpired } from "@/common/util/interviews/slotValidation";

interface SlotSelectorItemProps {
  slot: { id: string; startTime: string; endTime: string };
  isSelected: boolean;
  isHovered: boolean;
  currentTime: number;
  onToggle: (slotId: string) => void;
  onHover: (slotId: string | null) => void;
}

export const SlotSelectorItem = ({
  slot,
  isSelected,
  isHovered,
  currentTime,
  onToggle,
  onHover,
}: SlotSelectorItemProps) => {
  const start = new Date(slot.startTime);
  const end = new Date(slot.endTime);
  const expired = isSlotExpired(slot, currentTime);

  return (
    <label
      onMouseEnter={() => onHover(slot.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        display: "flex",
        gap: "1rem",
        padding: "1rem",
        borderRadius: "var(--radius-md)",
        border: `2px solid ${
          expired
            ? "var(--danger)"
            : isSelected
              ? "var(--primary)"
              : "var(--border-glass)"
        }`,
        background: expired
          ? "rgba(239, 68, 68, 0.05)"
          : isSelected
            ? "var(--primary-glow)"
            : isHovered
              ? "rgba(255,255,255,0.03)"
              : "rgba(255,255,255,0.01)",
        cursor: expired ? "not-allowed" : "pointer",
        transition: "all 0.2s ease",
        opacity: expired ? 0.6 : 1,
        position: "relative",
      }}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => !expired && onToggle(slot.id)}
        disabled={expired}
        style={{
          width: "20px",
          height: "20px",
          cursor: expired ? "not-allowed" : "pointer",
          flexShrink: 0,
          marginTop: "2px",
        }}
      />

      <div style={{ flex: 1 }}>
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
            <span className="font-semibold text-sm">
              {start.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Clock size={16} className="text-primary" />
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

        {expired && (
          <div
            className="badge badge-danger"
            style={{
              position: "absolute",
              top: "0.5rem",
              right: "0.5rem",
              fontSize: "0.65rem",
            }}
          >
            Expired
          </div>
        )}
      </div>
    </label>
  );
};
