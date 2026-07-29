import React from "react";
import { renderStarRating } from "@/panelist/util/interviewHelpers";

type RatingFieldProps = {
  label: string;
  rating: number;
  notes: string;
  placeholder: string;
  onRatingChange: (rating: number) => void;
  onNotesChange: (notes: string) => void;
  disabled?: boolean;
};

export const RatingField = ({
  label,
  rating,
  notes,
  placeholder,
  onRatingChange,
  onNotesChange,
  disabled = false,
}: RatingFieldProps) => {
  return (
    <div
      style={{
        background: "var(--bg-main)",
        border: "1px solid var(--border-glass)",
        padding: "0.75rem",
        borderRadius: "var(--radius-sm)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.5rem",
        }}
      >
        <span
          style={{
            fontSize: "0.82rem",
            fontWeight: 600,
          }}
        >
          {label} *
        </span>
        {renderStarRating(rating, onRatingChange, disabled)}
      </div>
      <textarea
        className="form-input"
        rows={2}
        placeholder={placeholder}
        style={{
          fontSize: "0.78rem",
          resize: "vertical",
        }}
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
};
