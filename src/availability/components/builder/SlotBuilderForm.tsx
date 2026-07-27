/**
 * SlotBuilderForm Component
 *
 * Form for building custom availability slots
 */

"use client";

import React from "react";
import { Plus } from "lucide-react";

interface SlotBuilderFormProps {
  inputDate: string;
  inputStart: string;
  inputEnd: string;
  minDate: string;
  maxDate: string;
  onDateChange: (date: string) => void;
  onStartChange: (time: string) => void;
  onEndChange: (time: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const SlotBuilderForm = ({
  inputDate,
  inputStart,
  inputEnd,
  minDate,
  maxDate,
  onDateChange,
  onStartChange,
  onEndChange,
  onSubmit,
}: SlotBuilderFormProps) => {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-slate-300 mb-3">
        Add Your Available Time Slot
      </h3>

      <form
        onSubmit={onSubmit}
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
            onChange={(e) => onDateChange(e.target.value)}
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
            onChange={(e) => onStartChange(e.target.value)}
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
            onChange={(e) => onEndChange(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          style={{ height: "38px" }}
        >
          <Plus size={16} />
          <span>Add</span>
        </button>
      </form>
    </div>
  );
};
