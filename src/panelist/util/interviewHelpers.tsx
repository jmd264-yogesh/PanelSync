import React from "react";

export const renderStarsStatic = (rating: number) => {
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
};

export const renderStarRating = (
  currentRating: number,
  onChange: (rating: number) => void,
  disabled = false,
) => {
  return (
    <div
      role="radiogroup"
      aria-label="Rating out of 5"
      style={{ display: "flex", gap: "6px" }}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= currentRating;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === currentRating}
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
            }}
            onMouseEnter={(e) => {
              if (!disabled) e.currentTarget.style.transform = "scale(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            ★
          </button>
        );
      })}
    </div>
  );
};

export const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDriveDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
};

export const getRoleBadgeStyle = (role: string) => {
  const isL1Role = role.toLowerCase().includes("l1");
  const isL2Role = role.toLowerCase().includes("l2");
  const isLateralRole = role.toLowerCase().includes("lateral");

  if (isL1Role) {
    return {
      background: "var(--badge-l1-bg)",
      border: "1px solid var(--badge-l1-border)",
      color: "var(--badge-l1-text)",
      label: "L1 Round",
    };
  } else if (isL2Role) {
    return {
      background: "var(--badge-l2-bg)",
      border: "1px solid var(--badge-l2-border)",
      color: "var(--badge-l2-text)",
      label: "L2 Round",
    };
  } else if (isLateralRole) {
    return {
      background: "rgba(245, 158, 11, 0.08)",
      border: "1px solid rgba(245, 158, 11, 0.25)",
      color: "#f59e0b",
      label: "Lateral Hiring",
    };
  }
  return {
    background: "rgba(99, 102, 241, 0.08)",
    border: "1px solid rgba(99, 102, 241, 0.2)",
    color: "var(--primary)",
    label: "General Round",
  };
};

export const getCollegeNameFromRole = (role: string): string => {
  const parts = role.split(" - ");
  return parts.length > 1 ? parts[1].trim() : "";
};
