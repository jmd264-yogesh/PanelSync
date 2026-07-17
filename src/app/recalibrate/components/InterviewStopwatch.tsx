// recalibrate/components/InterviewStopwatch.tsx

"use client";

import { Play, Pause, RotateCcw } from "lucide-react";

interface InterviewStopwatchProps {
  elapsedLabel: string;
  isRunning: boolean;
  hasStarted: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}

export default function InterviewStopwatch({
  elapsedLabel,
  isRunning,
  hasStarted,
  onStart,
  onPause,
  onReset,
}: InterviewStopwatchProps) {
  return (
    <div
      className="glass-card"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1rem",
        padding: "1.75rem 1.5rem",
        borderRadius: "20px",
      }}
    >
      {/* Label */}
      <div
        style={{
          fontSize: "0.72rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-muted)",
          fontWeight: 600,
        }}
      >
        Interview Timer
      </div>

      {/* Time */}
      <div
        style={{
          fontFamily: "monospace",
          fontSize: "2rem",
          fontWeight: 500,
          textAlign: "center",
          lineHeight: 1,
        }}
      >
        {elapsedLabel}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        {/* Status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.82rem",
            color: "var(--text-muted)",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isRunning
                ? "#22c55e"
                : hasStarted
                  ? "#f59e0b"
                  : "#6b7280",
            }}
          />

          {isRunning ? "Running" : hasStarted ? "Paused" : "Ready"}
        </div>

        {/* Controls */}
        <div
          style={{
            display: "flex",
          }}
        >
          {isRunning ? (
            <button
              className="btn"
              onClick={onPause}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Pause size={16} />
              Pause
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={onStart}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Play size={16} />
              {hasStarted ? "Resume" : "Start"}
            </button>
          )}

          {hasStarted && (
            <button
              className="btn"
              onClick={onReset}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <RotateCcw size={16} />
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
