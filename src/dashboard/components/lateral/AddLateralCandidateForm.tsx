"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { ROLE_GRADES } from "@server/services/ai/spec-catalog";

interface AddLateralCandidateFormProps {
  form: {
    name: string;
    email: string;
    phone: string;
    positionTitle: string;
    experienceYears: string;
    currentCompany: string;
    currentCtc: string;
    expectedCtc: string;
    noticePeriodDays: string;
    source: string;
    roleGrade: string;
  };
  isAdding: boolean;
  addError: string | null;
  onFormChange: (field: string, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export const AddLateralCandidateForm: React.FC<AddLateralCandidateFormProps> = ({
  form,
  isAdding,
  addError,
  onFormChange,
  onSubmit,
  onCancel,
}) => {
  return (
    <div className="glass-card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "0.6rem",
          }}
        >
          <input
            className="form-input"
            placeholder="Full name *"
            value={form.name}
            onChange={(e) => onFormChange("name", e.target.value)}
          />
          <input
            className="form-input"
            placeholder="Email *"
            type="email"
            value={form.email}
            onChange={(e) => onFormChange("email", e.target.value)}
          />
          <input
            className="form-input"
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => onFormChange("phone", e.target.value)}
          />
          <input
            className="form-input"
            placeholder="Position title *"
            value={form.positionTitle}
            onChange={(e) => onFormChange("positionTitle", e.target.value)}
          />
          <input
            className="form-input"
            placeholder="Experience (years)"
            type="number"
            min="0"
            value={form.experienceYears}
            onChange={(e) => onFormChange("experienceYears", e.target.value)}
          />
          <input
            className="form-input"
            placeholder="Current company"
            value={form.currentCompany}
            onChange={(e) => onFormChange("currentCompany", e.target.value)}
          />
          <input
            className="form-input"
            placeholder="Current CTC"
            value={form.currentCtc}
            onChange={(e) => onFormChange("currentCtc", e.target.value)}
          />
          <input
            className="form-input"
            placeholder="Expected CTC"
            value={form.expectedCtc}
            onChange={(e) => onFormChange("expectedCtc", e.target.value)}
          />
          <input
            className="form-input"
            placeholder="Notice period (days)"
            type="number"
            min="0"
            value={form.noticePeriodDays}
            onChange={(e) => onFormChange("noticePeriodDays", e.target.value)}
          />
          <input
            className="form-input"
            placeholder="Source (Referral, LinkedIn, ...)"
            value={form.source}
            onChange={(e) => onFormChange("source", e.target.value)}
          />
          <select
            className="form-input"
            value={form.roleGrade}
            onChange={(e) => onFormChange("roleGrade", e.target.value)}
          >
            <option value="">Role grade (for Recalibrate)…</option>
            {Object.entries(ROLE_GRADES).map(([key, r]) => (
              <option key={key} value={key}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {addError && (
          <div style={{ color: "#ef4444", fontSize: "0.8rem" }}>{addError}</div>
        )}

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="submit" className="btn btn-primary" disabled={isAdding}>
            {isAdding ? <Loader2 size={14} className="animate-spin" /> : "Add Candidate"}
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
