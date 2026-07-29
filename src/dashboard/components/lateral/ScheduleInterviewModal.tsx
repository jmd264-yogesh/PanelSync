"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { LateralCandidate, Panelist } from "@server/lib/db";
import { GraphUser } from "@server/lib/graph";
import { PanelistSearchInput } from "./PanelistSearchInput";
import { PanelistDirectoryPicker } from "./PanelistDirectoryPicker";

interface ScheduleInterviewModalProps {
  candidate: LateralCandidate;
  panelists: Panelist[];
  todayStr: string;
  onSchedule: (params: {
    roundLabel: string;
    duration: string;
    startDate: string;
    startTime: string;
    endTime: string;
    selectedPanels: GraphUser[];
  }) => Promise<void>;
  onClose: () => void;
}

export const ScheduleInterviewModal: React.FC<ScheduleInterviewModalProps> = ({
  candidate,
  panelists,
  todayStr,
  onSchedule,
  onClose,
}) => {
  const [roundLabel, setRoundLabel] = useState("Round 1");
  const [duration, setDuration] = useState("45");
  const [startDate, setStartDate] = useState(todayStr);
  const [startTime, setStartTime] = useState("09:30");
  const [endTime, setEndTime] = useState("18:30");
  const [selectedPanels, setSelectedPanels] = useState<GraphUser[]>([]);
  const [panelSearchQuery, setPanelSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GraphUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Search effect
  useEffect(() => {
    if (panelSearchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(panelSearchQuery)}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(
            data.filter((u: GraphUser) => !selectedPanels.some((sp) => sp.id === u.id))
          );
        }
      } catch (err) {
        console.error("Error searching panels:", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [panelSearchQuery, selectedPanels]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleError(null);

    if (!roundLabel.trim()) {
      setScheduleError('Please name this round (e.g. "Technical Round 1").');
      return;
    }
    if (!startDate) {
      setScheduleError("Please select a proposed range start date.");
      return;
    }
    if (startDate < todayStr) {
      setScheduleError("Start date cannot be in the past.");
      return;
    }
    if (selectedPanels.length === 0) {
      setScheduleError("Please select at least one panel member.");
      return;
    }

    setIsScheduling(true);
    try {
      await onSchedule({
        roundLabel,
        duration,
        startDate,
        startTime,
        endTime,
        selectedPanels,
      });
      onClose();
    } catch (err) {
      // Error already handled in parent
    } finally {
      setIsScheduling(false);
    }
  };

  const handleSelectUser = (user: GraphUser) => {
    setSelectedPanels((prev) => [...prev, user]);
    setPanelSearchQuery("");
    setSearchResults([]);
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedPanels((prev) => prev.filter((sp) => sp.id !== userId));
  };

  const handleTogglePanelist = (panelist: Panelist, isSelected: boolean) => {
    if (isSelected) {
      handleRemoveUser(panelist.id);
    } else {
      setSelectedPanels((prev) => [
        ...prev,
        {
          id: panelist.id,
          displayName: panelist.displayName,
          mail: panelist.email,
          userPrincipalName: panelist.email,
        },
      ]);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        className="glass-card"
        style={{
          padding: "1.5rem",
          width: "480px",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
            Schedule Interview — {candidate.name}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <input
            className="form-input"
            placeholder="Round name (e.g. Technical Round 1)"
            value={roundLabel}
            onChange={(e) => setRoundLabel(e.target.value)}
          />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.9rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: "0.75rem", fontWeight: 600 }}>
                Interview Duration
              </label>
              <select className="form-input" value={duration} onChange={(e) => setDuration(e.target.value)}>
                <option value="30">30 Minutes</option>
                <option value="45">45 Minutes</option>
                <option value="60">60 Minutes</option>
                <option value="90">90 Minutes</option>
              </select>
            </div>
            <div />
            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: "0.75rem", fontWeight: 600 }}>
                Start Date
              </label>
              <input
                className="form-input"
                type="date"
                min={todayStr}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: "0.75rem", fontWeight: 600 }}>
                Window Start Time
              </label>
              <input
                className="form-input"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: "0.75rem", fontWeight: 600 }}>
                Window End Time
              </label>
              <input
                className="form-input"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <PanelistSearchInput
            searchQuery={panelSearchQuery}
            isSearching={isSearching}
            searchResults={searchResults}
            selectedPanels={selectedPanels}
            onSearchChange={setPanelSearchQuery}
            onSelectUser={handleSelectUser}
            onRemoveUser={handleRemoveUser}
          />

          <PanelistDirectoryPicker
            panelists={panelists}
            selectedPanels={selectedPanels}
            onTogglePanelist={handleTogglePanelist}
          />

          {scheduleError && (
            <div style={{ color: "#ef4444", fontSize: "0.8rem" }}>{scheduleError}</div>
          )}

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button type="submit" className="btn btn-primary" disabled={isScheduling}>
              {isScheduling ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                "Send Panel Request"
              )}
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
