"use client";

import React from "react";

type StarRatingProps = {
  rating: number;
  onChange?: (rating: number) => void;
  disabled?: boolean;
  interactive?: boolean;
};

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  onChange,
  disabled = false,
  interactive = true,
}) => {
  // Static (read-only) variant
  if (!interactive || !onChange) {
    return (
      <div style={{ display: "flex", gap: "3px" }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            style={{
              color: star <= rating ? "#fbbf24" : "var(--star-empty)",
              fontSize: "1.1rem",
              lineHeight: 1,
            }}
          >
            ★
          </span>
        ))}
      </div>
    );
  }

  // Interactive variant
  return (
    <div
      role="radiogroup"
      aria-label="Rating out of 5"
      style={{ display: "flex", gap: "6px" }}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= rating;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === rating}
            aria-label={`${star} of 5 stars`}
            disabled={disabled}
            onClick={() => onChange(star)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: disabled ? "default" : "pointer",
              color: active ? "#fbbf24" : "var(--star-empty)",
              fontSize: "1.4rem",
              lineHeight: 1,
              transition: "transform 0.1s",
              userSelect: "none",
            }}
            onMouseEnter={(e) => {
              if (!disabled) e.currentTarget.style.transform = "scale(1.25)";
            }}
            onMouseLeave={(e) => {
              if (!disabled) e.currentTarget.style.transform = "scale(1)";
            }}
          >
            ★
          </button>
        );
      })}
    </div>
  );
};
