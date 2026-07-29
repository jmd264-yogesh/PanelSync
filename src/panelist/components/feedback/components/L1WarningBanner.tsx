import React from "react";

export const L1WarningBanner = () => {
  return (
    <div
      style={{
        marginTop: "0.5rem",
        marginBottom: "0.75rem",
        padding: "0.75rem",
        background: "rgba(245,158,11,0.06)",
        border: "1px solid rgba(245,158,11,0.2)",
        borderRadius: "var(--radius-sm)",
        color: "#fbbf24",
        fontSize: "0.75rem",
        lineHeight: 1.4,
      }}
    >
      <strong>⚠️ L1 Decision Warning:</strong> Submitting a{" "}
      <strong>Pass L1</strong> decision is final. The candidate will immediately
      progress to the L2 queue, and you will not be able to edit or revert this
      feedback.
    </div>
  );
};
