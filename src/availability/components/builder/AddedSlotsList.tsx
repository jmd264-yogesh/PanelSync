/**
 * AddedSlotsList Component
 *
 * Displays list of added availability slots with delete option
 */

"use client";

import React from "react";
import { Calendar, Clock, Trash2 } from "lucide-react";
import { TimeSlot } from "@/common/types/availability";

interface AddedSlotsListProps {
  slots: TimeSlot[];
  onRemoveSlot: (index: number) => void;
}

export const AddedSlotsList = ({
  slots,
  onRemoveSlot,
}: AddedSlotsListProps) => {
  if (slots.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <h4 className="text-sm font-semibold text-slate-300 mb-3">
        Your Added Slots
      </h4>
      <div className="space-y-2">
        {slots.map((slot, idx) => {
          const start = new Date(slot.startTime);
          const end = new Date(slot.endTime);
          return (
            <div
              key={idx}
              className="flex items-center justify-between bg-white/[0.02] border border-white/10 rounded-lg p-3"
            >
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-blue-400" />
                <span className="text-sm font-medium">
                  {start.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <Clock size={16} className="text-blue-400" />
                <span className="text-sm text-slate-300">
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
              <button
                type="button"
                onClick={() => onRemoveSlot(idx)}
                className="btn btn-ghost btn-sm"
                style={{ padding: "0.5rem" }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
