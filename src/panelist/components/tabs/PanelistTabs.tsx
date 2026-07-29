"use client";

import React from "react";
import {
  Calendar,
  CalendarCheck,
  SlidersHorizontal,
} from "lucide-react";
import { RoundTabSwitcher } from "./RoundTabSwitcher";
import { PrimaryTabButton } from "./PrimaryTabButton";

type TabCounts = {
  requests: { total: number; l1: number; l2: number };
  feedback: { total: number; l1: number; l2: number; lateral: number };
};

type PanelistTabsProps = {
  activePrimaryTab: "PANELS" | "FEEDBACK" | "RECALIBRATE";
  activeHiringTab: "CAMPUS" | "LATERAL";
  activeRoundTab: "ALL" | "L1" | "L2" | "LATERAL";
  tabCounts: TabCounts;
  onChangePrimaryTab: (tab: "PANELS" | "FEEDBACK" | "RECALIBRATE") => void;
  onChangeHiringTab: (tab: "CAMPUS" | "LATERAL") => void;
  onChangeRoundTab: (tab: "ALL" | "L1" | "L2" | "LATERAL") => void;
  showRecalibrate: boolean;
};

export const PanelistTabs = ({
  activePrimaryTab,
  activeHiringTab,
  activeRoundTab,
  tabCounts,
  onChangePrimaryTab,
  onChangeHiringTab,
  onChangeRoundTab,
  showRecalibrate,
}: PanelistTabsProps) => {
  return (
    <div>
      {/* Hiring Tab Switcher */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button
          type="button"
          className={`btn ${activeHiringTab === "CAMPUS" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => onChangeHiringTab("CAMPUS")}
        >
          Campus Hiring
        </button>
        <button
          type="button"
          className={`btn ${activeHiringTab === "LATERAL" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => onChangeHiringTab("LATERAL")}
        >
          Lateral Hiring
        </button>
      </div>

      {/* Primary Tab Switcher */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border-glass)",
          marginBottom: "2rem",
          gap: "2rem",
          fontSize: "0.95rem",
          fontWeight: 650,
        }}
      >
        <PrimaryTabButton
          isActive={activePrimaryTab === "PANELS"}
          onClick={() => {
            onChangePrimaryTab("PANELS");
            onChangeRoundTab("ALL");
          }}
          icon={<Calendar size={16} />}
          label="Availability Requests (Panels)"
          count={tabCounts.requests.total}
        />

        <PrimaryTabButton
          isActive={activePrimaryTab === "FEEDBACK"}
          onClick={() => {
            onChangePrimaryTab("FEEDBACK");
            onChangeRoundTab("ALL");
          }}
          icon={<CalendarCheck size={16} />}
          label="Interviews & Feedback"
          count={tabCounts.feedback.total}
        />

        {showRecalibrate && (
          <PrimaryTabButton
            isActive={activePrimaryTab === "RECALIBRATE"}
            onClick={() => onChangePrimaryTab("RECALIBRATE")}
            icon={<SlidersHorizontal size={16} />}
            label="Recalibrate"
            count={tabCounts.feedback.lateral}
          />
        )}
      </div>

      {/* Round Tab Switcher - Only show in PANELS and FEEDBACK tabs */}
      {(activePrimaryTab === "PANELS" || activePrimaryTab === "FEEDBACK") && (
        <RoundTabSwitcher
          activeRoundTab={activeRoundTab}
          activePrimaryTab={activePrimaryTab}
          tabCounts={tabCounts}
          onChangeRoundTab={onChangeRoundTab}
        />
      )}
    </div>
  );
};
