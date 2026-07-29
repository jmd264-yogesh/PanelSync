import React from "react";

type FeedbackCommentsProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export const FeedbackComments = ({
  value,
  onChange,
  disabled = false,
  placeholder = "Summary comments of performance...",
}: FeedbackCommentsProps) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.4rem",
      }}
    >
      <label
        style={{
          fontSize: "0.8rem",
          fontWeight: 600,
        }}
      >
        Overall Comments / Summary Recommendation
      </label>
      <textarea
        className="form-input"
        rows={2}
        placeholder={placeholder}
        style={{
          fontSize: "0.8rem",
          resize: "vertical",
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
};
