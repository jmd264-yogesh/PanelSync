import React from "react";
import { TrendingUp } from "lucide-react";
import { Interview } from "@server/lib/db";

interface AnalyticsData {
  l1Filtered: Interview[];
  l2Filtered: Interview[];
}

interface AnalyticsCardProps {
  analytics: AnalyticsData;
}

export const AnalyticsCard: React.FC<AnalyticsCardProps> = ({ analytics }) => {
  // Calculate L1 cohort metrics
  const l1Passed = analytics.l1Filtered.filter((i) =>
    i.panels.some((p) => p.decision === "PASSED"),
  ).length;
  const l1Rejected = analytics.l1Filtered.filter((i) =>
    i.panels.some((p) => p.decision === "REJECTED"),
  ).length;
  const l1FeedbackPending = analytics.l1Filtered.filter((i) =>
    i.panels.some((p) => p.status === "SUBMITTED" && !p.decision),
  ).length;
  const l1SchedulingPending = analytics.l1Filtered.filter(
    (i) => i.status !== "SCHEDULED",
  ).length;
  const l1PendingTotal = l1FeedbackPending + l1SchedulingPending;
  const l1TotalResults = l1Passed + l1Rejected + l1PendingTotal;

  const l1PassedPct =
    l1TotalResults > 0 ? Math.round((l1Passed / l1TotalResults) * 100) : 0;
  const l1RejectedPct =
    l1TotalResults > 0 ? Math.round((l1Rejected / l1TotalResults) * 100) : 0;
  const l1PendingPct =
    l1TotalResults > 0 ? Math.round((l1PendingTotal / l1TotalResults) * 100) : 0;

  // Calculate L2 cohort metrics
  const l2Passed = analytics.l2Filtered.filter((i) =>
    i.panels.some((p) => p.decision === "PASSED"),
  ).length;
  const l2Rejected = analytics.l2Filtered.filter((i) =>
    i.panels.some((p) => p.decision === "REJECTED"),
  ).length;
  const l2FeedbackPending = analytics.l2Filtered.filter((i) =>
    i.panels.some((p) => p.status === "SUBMITTED" && !p.decision),
  ).length;
  const l2SchedulingPending = analytics.l2Filtered.filter(
    (i) => i.status !== "SCHEDULED",
  ).length;
  const l2PendingTotal = l2FeedbackPending + l2SchedulingPending;
  const l2TotalResults = l2Passed + l2Rejected + l2PendingTotal;

  const l2PassedPct =
    l2TotalResults > 0 ? Math.round((l2Passed / l2TotalResults) * 100) : 0;
  const l2RejectedPct =
    l2TotalResults > 0 ? Math.round((l2Rejected / l2TotalResults) * 100) : 0;
  const l2PendingPct =
    l2TotalResults > 0 ? Math.round((l2PendingTotal / l2TotalResults) * 100) : 0;

  return (
    <aside className="analytics-card">
      <div className="analytics-header">
        <div className="analytics-title">
          <TrendingUp size={18} /> Analytics Overview
        </div>
        <button type="button" className="analytics-period">
          Last 7 days
        </button>
      </div>

      {/* L1 Cohort */}
      <div className="cohort-group">
        <div className="cohort-title" style={{ color: "var(--info)" }}>
          L1 Cohort
        </div>

        <div className="analytics-row">
          <div className="analytics-row-header">
            <span className="analytics-row-label">Passed</span>
            <span className="analytics-row-value">
              {l1PassedPct}% &bull; {l1Passed}
            </span>
          </div>
          <div className="analytics-bar">
            <div
              className="analytics-bar-fill success"
              style={{ width: `${l1PassedPct}%` }}
            />
          </div>
        </div>

        <div className="analytics-row">
          <div className="analytics-row-header">
            <span className="analytics-row-label">Rejected</span>
            <span className="analytics-row-value">
              {l1RejectedPct}% &bull; {l1Rejected}
            </span>
          </div>
          <div className="analytics-bar">
            <div
              className="analytics-bar-fill danger"
              style={{ width: `${l1RejectedPct}%` }}
            />
          </div>
        </div>

        <div className="analytics-row">
          <div className="analytics-row-header">
            <span className="analytics-row-label">Pending</span>
            <span className="analytics-row-value">
              {l1PendingPct}% &bull; {l1PendingTotal}
            </span>
          </div>
          <div className="analytics-bar">
            <div
              className="analytics-bar-fill warning"
              style={{ width: `${l1PendingPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* L2 Cohort */}
      <div className="cohort-group">
        <div className="cohort-title" style={{ color: "var(--accent)" }}>
          L2 Cohort
        </div>

        <div className="analytics-row">
          <div className="analytics-row-header">
            <span className="analytics-row-label">Passed</span>
            <span className="analytics-row-value">
              {l2PassedPct}% &bull; {l2Passed}
            </span>
          </div>
          <div className="analytics-bar">
            <div
              className="analytics-bar-fill success"
              style={{ width: `${l2PassedPct}%` }}
            />
          </div>
        </div>

        <div className="analytics-row">
          <div className="analytics-row-header">
            <span className="analytics-row-label">Rejected</span>
            <span className="analytics-row-value">
              {l2RejectedPct}% &bull; {l2Rejected}
            </span>
          </div>
          <div className="analytics-bar">
            <div
              className="analytics-bar-fill danger"
              style={{ width: `${l2RejectedPct}%` }}
            />
          </div>
        </div>

        <div className="analytics-row">
          <div className="analytics-row-header">
            <span className="analytics-row-label">Pending</span>
            <span className="analytics-row-value">
              {l2PendingPct}% &bull; {l2PendingTotal}
            </span>
          </div>
          <div className="analytics-bar">
            <div
              className="analytics-bar-fill warning"
              style={{ width: `${l2PendingPct}%` }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
};
