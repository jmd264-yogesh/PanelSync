"use client";

import React from "react";

interface DateEditFormProps {
  isEditing: boolean;
  editStartDate: string;
  editEndDate: string;
  todayStr: string;
  isUpdating: boolean;
  onToggleEdit: () => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const DateEditForm: React.FC<DateEditFormProps> = ({
  isEditing,
  editStartDate,
  editEndDate,
  todayStr,
  isUpdating,
  onToggleEdit,
  onStartDateChange,
  onEndDateChange,
  onSubmit,
}) => {
  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={onToggleEdit}
        className="btn btn-secondary"
        style={{ flex: 1, height: "42px" }}
      >
        Edit Dates
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
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
      <p style={{ fontSize: "12px", color: "var(--fg-secondary)", margin: 0 }}>
        Changing the date range resets all proposed availability slots — panels will
        need to resubmit.
      </p>
      <div style={{ display: "flex", gap: "10px" }}>
        <input
          className="filter-date"
          type="date"
          value={editStartDate}
          min={todayStr}
          onChange={(e) => onStartDateChange(e.target.value)}
          style={{ flex: 1, height: "40px", borderRadius: "10px" }}
        />
        <input
          className="filter-date"
          type="date"
          value={editEndDate}
          min={editStartDate || todayStr}
          onChange={(e) => onEndDateChange(e.target.value)}
          style={{ flex: 1, height: "40px", borderRadius: "10px" }}
        />
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isUpdating}
          style={{ flex: 1, height: "40px" }}
        >
          {isUpdating ? "Updating..." : "Update Dates & Reset Availability"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onToggleEdit}
          style={{ flex: 1, height: "40px" }}
        >
          Close
        </button>
      </div>
    </form>
  );
};
