/**
 * ErrorMessage Component
 *
 * Reusable error message display
 */

"use client";

import React from "react";
import { AlertCircle } from "lucide-react";

interface ErrorMessageProps {
  message: string;
}

export const ErrorMessage = ({ message }: ErrorMessageProps) => {
  if (!message) return null;

  return (
    <div
      style={{
        color: "var(--danger)",
        fontSize: "0.85rem",
        display: "flex",
        gap: "0.5rem",
        alignItems: "center",
        marginBottom: "1.5rem",
        background: "var(--danger-glow)",
        border: "1px solid rgba(239, 68, 68, 0.2)",
        padding: "0.75rem",
        borderRadius: "var(--radius-sm)",
      }}
    >
      <AlertCircle size={16} style={{ flexShrink: 0 }} />
      <span>{message}</span>
    </div>
  );
};
