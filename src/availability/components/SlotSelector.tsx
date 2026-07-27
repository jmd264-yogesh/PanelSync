/**
 * SlotSelector Component - Refactored
 *
 * Displays a list of time slots with checkboxes for selection
 * Now using extracted SlotSelectorItem component
 */

"use client";

import React from "react";
import { SlotSelectorItem } from "./SlotSelectorItem";

interface SlotSelectorProps {
  slots: { id: string; startTime: string; endTime: string }[];
  selectedSlotIds: string[];
  onToggle: (slotId: string) => void;
  currentTime: number;
  hoveredSlotId?: string | null;
  onHover?: (slotId: string | null) => void;
}

export const SlotSelector = ({
  slots,
  selectedSlotIds,
  onToggle,
  currentTime,
  hoveredSlotId,
  onHover,
}: SlotSelectorProps) => {
  if (slots.length === 0) {
    return (
      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          padding: "2rem",
          borderRadius: "var(--radius-md)",
          border: "1px dashed var(--border-glass)",
          textAlign: "center",
        }}
      >
        <p className="text-muted text-sm">
          No proposed time slots are currently available.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      {slots.map((slot) => (
        <SlotSelectorItem
          key={slot.id}
          slot={slot}
          isSelected={selectedSlotIds.includes(slot.id)}
          isHovered={hoveredSlotId === slot.id}
          currentTime={currentTime}
          onToggle={onToggle}
          onHover={onHover || (() => {})}
        />
      ))}
    </div>
  );
};
