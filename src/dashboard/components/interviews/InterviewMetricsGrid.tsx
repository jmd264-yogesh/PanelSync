import React from "react";
import { InterviewPanel } from "@server/lib/db";

type FilterType = "all" | "L1" | "L2";

interface MetricsData {
  driveCandidatesCount: number;
  driveMapped: number;
  drivePending: number;
  drivePanelistsRequested: number;
  drivePanelistsReplied: number;
  drivePanelistsPending: number;
  drivePanelistsRejected: number;
  drivePassed: number;
  driveRejected: number;
  drivePanels: Array<InterviewPanel & { interview?: any }>;
}

interface InterviewMetricsGridProps {
  metrics: MetricsData;
  typeFilter: FilterType;
  onShowRepliedModal: () => void;
  onShowFeedbackModal: () => void;
}

export const InterviewMetricsGrid: React.FC<InterviewMetricsGridProps> = ({
  metrics,
  typeFilter,
  onShowRepliedModal,
  onShowFeedbackModal,
}) => {
  return (
    <section className="metric-grid">
      {/* Card 1: Candidates Mapped */}
      <article className="metric-card">
        <div>
          <div className="metric-card-header">
            <div className="metric-label">Candidates Mapped</div>
            <div className="metric-icon success">👥</div>
          </div>
          <div className="metric-value">
            {metrics.driveMapped} / {metrics.driveCandidatesCount}
          </div>
          <div className="metric-subtext">
            {metrics.drivePending === 0
              ? "All candidates assigned"
              : `${metrics.drivePending} pending`}
          </div>
        </div>
        <div className="progress">
          <div
            className="progress-fill success"
            style={{
              width:
                metrics.driveCandidatesCount > 0
                  ? `${(metrics.driveMapped / metrics.driveCandidatesCount) * 100}%`
                  : "0%",
            }}
          />
        </div>
      </article>

      {/* Card 2: Panel Requests */}
      <article
        className="metric-card"
        style={{ cursor: "pointer" }}
        onClick={onShowRepliedModal}
      >
        <div>
          <div className="metric-card-header">
            <div className="metric-label">Panel Requests</div>
            <div className="metric-icon info">✉</div>
          </div>
          <div className="metric-value">
            {metrics.drivePanelistsRequested}
          </div>
          <div className="metric-subtext">
            {metrics.drivePanelistsReplied} accepted &bull;{" "}
            {metrics.drivePanelistsPending} pending &bull;{" "}
            {metrics.drivePanelistsRejected} declined
          </div>
        </div>
        <div className="progress">
          <div
            className="progress-fill info"
            style={{
              width:
                metrics.drivePanelistsRequested > 0
                  ? `${(metrics.drivePanelistsReplied / metrics.drivePanelistsRequested) * 100}%`
                  : "0%",
            }}
          />
        </div>
      </article>

      {/* Card 3: Interview Results */}
      <article
        className="metric-card active"
        style={{ cursor: "pointer" }}
        onClick={onShowFeedbackModal}
      >
        <div>
          <div className="metric-card-header">
            <div className="metric-label">
              {typeFilter === "all"
                ? "Interview Results"
                : `${typeFilter} Results`}
            </div>
            <div className="metric-icon success">✓</div>
          </div>
          <div className="metric-value">{metrics.drivePassed} Passed</div>
          <div className="metric-subtext">
            {metrics.driveRejected} rejected &bull;{" "}
            {
              metrics.drivePanels.filter(
                (p) => p.status === "SUBMITTED" && !p.decision,
              ).length
            }{" "}
            pending
          </div>
        </div>
        {/* Segmented progress bar */}
        {(() => {
          const resultsPending = metrics.drivePanels.filter(
            (p) => p.status === "SUBMITTED" && !p.decision,
          ).length;
          const total =
            metrics.drivePassed + metrics.driveRejected + resultsPending;
          const passedPct =
            total > 0 ? (metrics.drivePassed / total) * 100 : 0;
          const rejectedPct =
            total > 0 ? (metrics.driveRejected / total) * 100 : 0;
          const pendingPct = total > 0 ? (resultsPending / total) * 100 : 0;

          return (
            <div className="segmented-progress">
              <span
                className="segment success"
                style={{ width: `${passedPct}%` }}
              />
              <span
                className="segment danger"
                style={{ width: `${rejectedPct}%` }}
              />
              <span
                className="segment warning"
                style={{ width: `${pendingPct}%` }}
              />
            </div>
          );
        })()}
      </article>
    </section>
  );
};
