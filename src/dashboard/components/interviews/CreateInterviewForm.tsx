"use client";

import React from "react";
import { X } from "lucide-react";
import { Panelist } from "@server/lib/db";
import { GraphUser } from "@server/lib/graph";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/common/components/ui/select";
import { PanelSelector } from "./forms/PanelSelector";
import { RecommendedPanelists } from "./forms/RecommendedPanelists";

interface CreateInterviewFormProps {
  // Form state
  candidateName: string;
  setCandidateName: (value: string) => void;
  candidateEmail: string;
  setCandidateEmail: (value: string) => void;
  role: string;
  setRole: (value: string) => void;
  interviewType: "L1" | "L2" | "General";
  setInterviewType: (value: "L1" | "L2" | "General") => void;
  duration: string;
  setDuration: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  selectedPanels: GraphUser[];

  // Panel search state
  panelSearchQuery: string;
  setPanelSearchQuery: (query: string) => void;
  searchResults: GraphUser[];
  isSearchingPanels: boolean;
  onAddPanel: (user: GraphUser) => void;
  onRemovePanel: (userId: string) => void;
  onToggleRecommendedPanelist: (panelist: Panelist) => void;

  // Recommended panelists
  recommendedPanelists: Panelist[];

  // Form actions
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
}

export const CreateInterviewForm: React.FC<CreateInterviewFormProps> = ({
  candidateName,
  setCandidateName,
  candidateEmail,
  setCandidateEmail,
  role,
  setRole,
  interviewType,
  setInterviewType,
  duration,
  setDuration,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedPanels,
  panelSearchQuery,
  setPanelSearchQuery,
  searchResults,
  isSearchingPanels,
  onAddPanel,
  onRemovePanel,
  onToggleRecommendedPanelist,
  recommendedPanelists,
  onSubmit,
  onCancel,
  isLoading,
  error,
}) => {
  return (
    <div
      style={{
        padding: "16px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "18px",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h3
          style={{
            fontSize: "16px",
            fontWeight: 700,
            margin: 0,
            color: "var(--fg)",
          }}
        >
          Create New Interview
        </h3>
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: "none",
            border: "none",
            color: "var(--fg-secondary)",
            cursor: "pointer",
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Form */}
      <form
        onSubmit={onSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {/* Candidate Name */}
        <input
          className="filter-select"
          type="text"
          placeholder="Candidate Name"
          value={candidateName}
          onChange={(e) => setCandidateName(e.target.value)}
          style={{
            borderRadius: "10px",
            height: "40px",
            width: "100%",
          }}
        />

        {/* Candidate Email */}
        <input
          className="filter-select"
          type="email"
          placeholder="Email"
          value={candidateEmail}
          onChange={(e) => setCandidateEmail(e.target.value)}
          style={{
            borderRadius: "10px",
            height: "40px",
            width: "100%",
          }}
        />

        {/* Role */}
        <input
          className="filter-select"
          type="text"
          placeholder="Job Title / Focus Area"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          style={{
            borderRadius: "10px",
            height: "40px",
            width: "100%",
          }}
        />

        {/* Interview Type */}
        <Select
          value={interviewType}
          onValueChange={(val) => setInterviewType(val as any)}
        >
          <SelectTrigger
            className="w-full text-left"
            style={{
              background: "var(--input-bg)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              color: "inherit",
              fontSize: "13px",
              height: "40px",
            }}
          >
            <SelectValue placeholder="Select Interview Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="L1">L1 Interview</SelectItem>
            <SelectItem value="L2">L2 Interview</SelectItem>
            <SelectItem value="General">General Interview</SelectItem>
          </SelectContent>
        </Select>

        {/* Duration */}
        <input
          className="filter-select"
          type="number"
          min="15"
          max="180"
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          style={{
            borderRadius: "10px",
            height: "40px",
            width: "100%",
          }}
          placeholder="Duration (mins)"
        />

        {/* Date Range */}
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            className="filter-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              flex: 1,
              height: "40px",
              borderRadius: "10px",
              width: "100%",
            }}
          />
          <input
            className="filter-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              flex: 1,
              height: "40px",
              borderRadius: "10px",
              width: "100%",
            }}
          />
        </div>

        {/* Panel Selector */}
        <PanelSelector
          selectedPanels={selectedPanels}
          panelSearchQuery={panelSearchQuery}
          setPanelSearchQuery={setPanelSearchQuery}
          searchResults={searchResults}
          isSearchingPanels={isSearchingPanels}
          onAddPanel={onAddPanel}
          onRemovePanel={onRemovePanel}
        />

        {/* Recommended Panelists */}
        <RecommendedPanelists
          recommendedPanelists={recommendedPanelists}
          selectedPanels={selectedPanels}
          onToggle={onToggleRecommendedPanelist}
        />

        {/* Error Display */}
        {error && (
          <p
            style={{
              color: "var(--danger)",
              fontSize: "12px",
              margin: 0,
            }}
          >
            {error}
          </p>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary"
          style={{ width: "100%", marginTop: "8px" }}
        >
          {isLoading ? "Creating..." : "Create Interview"}
        </button>
      </form>
    </div>
  );
};
