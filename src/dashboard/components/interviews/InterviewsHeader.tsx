import React from "react";
import { Plus } from "lucide-react";

interface InterviewsHeaderProps {
  activeHiringTab: "CAMPUS" | "LATERAL";
  onHiringTabChange: (tab: "CAMPUS" | "LATERAL") => void;
  onExport: () => void;
  onScheduleInterview: () => void;
}

export const InterviewsHeader: React.FC<InterviewsHeaderProps> = ({
  activeHiringTab,
  onHiringTabChange,
  onExport,
  onScheduleInterview,
}) => {
  return (
    <header
      className="dashboard-header"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        {/* Hiring Tab Toggle */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <button
            type="button"
            className={`btn ${activeHiringTab === "CAMPUS" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => onHiringTabChange("CAMPUS")}
          >
            Campus Hiring
          </button>
          <button
            type="button"
            className={`btn ${activeHiringTab === "LATERAL" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => onHiringTabChange("LATERAL")}
          >
            Lateral Hiring
          </button>
        </div>

        {/* Title & Subtitle */}
        <h1 className="page-title">Interview Dashboard</h1>
        <p className="page-subtitle">
          Overview of L1 and L2 interviews, panelist responses, and scheduling
          status.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="header-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onExport}
        >
          Export
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onScheduleInterview}
        >
          <Plus size={16} /> Schedule Interview
        </button>
      </div>
    </header>
  );
};
