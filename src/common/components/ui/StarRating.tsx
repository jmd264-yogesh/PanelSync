import React from "react";

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: string;
  activeColor?: string;
  inactiveColor?: string;
}

/**
 * StarRating - A reusable star rating display component
 *
 * @param rating - The rating value (e.g., 3.5 out of 5)
 * @param maxStars - Maximum number of stars (default: 5)
 * @param size - Font size for stars (default: "1rem")
 * @param activeColor - Color for filled stars (default: "#fbbf24")
 * @param inactiveColor - Color for empty stars (default: "rgba(255,255,255,0.12)")
 */
export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxStars = 5,
  size = "1rem",
  activeColor = "#fbbf24",
  inactiveColor = "rgba(255,255,255,0.12)",
}) => {
  return (
    <div style={{ display: "flex", gap: "2px" }}>
      {Array.from({ length: maxStars }, (_, i) => i + 1).map((star) => (
        <span
          key={star}
          style={{
            color: star <= rating ? activeColor : inactiveColor,
            fontSize: size,
            lineHeight: 1,
          }}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
        >
          ★
        </span>
      ))}
    </div>
  );
};
