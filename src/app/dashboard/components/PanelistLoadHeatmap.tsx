"use client";

import React, { useMemo, useState } from "react";
import { Flame, ArrowDownUp, Info } from "lucide-react";
import type { Interview, Panelist } from "@/lib/db";
import {
  BAND_STYLE,
  byFairnessThenName,
  computePanelistLoads,
} from "@/lib/panelist-load";

interface PanelistLoadHeatmapProps {
  panelists: Panelist[];
  interviews: Interview[];
  /** Scope to panelists holding this designation (matches the round being scheduled). */
  round?: "L1" | "L2" | null;
  hiringType?: "CAMPUS" | "LATERAL";
  weeks?: number;
  /** Tighter layout + fewer weeks, for embedding inside a scheduling modal. */
  compact?: boolean;
  /** Clicking a row selects that panelist in the parent picker. */
  onSelectPanelist?: (panelistId: string) => void;
  selectedPanelistIds?: string[];
}

// Sequential single-hue ramp: for "how much", magnitude should read as one colour
// getting stronger. Red-vs-green is reserved for the total badge, where the
// over/under-used judgement actually belongs.
function cellStyle(count: number, maxWeekly: number): React.CSSProperties {
  if (count === 0) {
    return { background: "var(--border-glass)", color: "transparent" };
  }
  const t = maxWeekly > 0 ? count / maxWeekly : 0;
  // Floor at 0.18 so a single interview is still clearly visible against the empty cell.
  const alpha = 0.18 + t * 0.72;
  return {
    background: `color-mix(in srgb, var(--primary) ${Math.round(alpha * 100)}%, transparent)`,
    color: t > 0.55 ? "#fff" : "var(--text-main)",
    fontWeight: 700,
  };
}

export default function PanelistLoadHeatmap({
  panelists,
  interviews,
  round = null,
  hiringType,
  weeks,
  compact = false,
  onSelectPanelist,
  selectedPanelistIds = [],
}: PanelistLoadHeatmapProps) {
  const [busiestFirst, setBusiestFirst] = useState(false);
  const windowWeeks = weeks ?? (compact ? 6 : 8);

  const loads = useMemo(
    () => computePanelistLoads(panelists, interviews, { weeks: windowWeeks, hiringType, round }),
    [panelists, interviews, windowWeeks, hiringType, round],
  );

  const sorted = useMemo(() => {
    const copy = [...loads];
    // Default order is deliberately "least-loaded first": the fair choice should be the
    // one a recruiter reaches for without having to hunt for it.
    copy.sort(busiestFirst ? (a, b) => -byFairnessThenName(a, b) : byFairnessThenName);
    return copy;
  }, [loads, busiestFirst]);

  const maxWeekly = useMemo(
    () => Math.max(0, ...loads.flatMap((l) => l.weeks.map((w) => w.assigned))),
    [loads],
  );

  const weekLabels = loads[0]?.weeks ?? [];

  const summary = useMemo(() => {
    const total = loads.reduce((sum, l) => sum + l.totalAssigned, 0);
    const idle = loads.filter((l) => l.totalAssigned === 0).length;
    const heavy = loads.filter((l) => l.band === "heavy").length;
    return { total, idle, heavy };
  }, [loads]);

  if (loads.length === 0) {
    return (
      <div className="glass-card" style={{ padding: "1rem", textAlign: "center" }}>
        <span className="text-muted text-xs">
          {round
            ? `No panelists are registered with an ${round} designation yet.`
            : "No panelists registered yet."}
        </span>
      </div>
    );
  }

  const nameColWidth = compact ? "128px" : "180px";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Flame size={13} style={{ color: "var(--primary)" }} />
          <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>
            Panelist load · last {windowWeeks} weeks
            {round ? ` · ${round} panel` : ""}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setBusiestFirst((v) => !v)}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.3rem",
            background: "transparent", border: "1px solid var(--border-glass)",
            borderRadius: "8px", padding: "0.2rem 0.5rem", cursor: "pointer",
            fontSize: "0.7rem", fontWeight: 600, color: "var(--text-muted)",
          }}
        >
          <ArrowDownUp size={11} />
          {busiestFirst ? "Busiest first" : "Least used first"}
        </button>
      </div>

      <div className="text-xs text-muted" style={{ display: "flex", alignItems: "flex-start", gap: "0.35rem", lineHeight: 1.5 }}>
        <Info size={12} style={{ marginTop: "2px", flexShrink: 0 }} />
        <span>
          {summary.total} assignment{summary.total === 1 ? "" : "s"} across {loads.length} panelist{loads.length === 1 ? "" : "s"}.
          {summary.heavy > 0 && ` ${summary.heavy} carrying well above average.`}
          {summary.idle > 0 && ` ${summary.idle} not called at all in this window.`}
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: compact ? "420px" : "560px" }}>
          {/* Header row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `${nameColWidth} repeat(${weekLabels.length}, minmax(0, 1fr)) 62px`,
              gap: "3px",
              alignItems: "end",
              marginBottom: "3px",
            }}
          >
            <span />
            {weekLabels.map((w, i) => (
              <span
                key={w.weekStart}
                className="text-muted"
                style={{
                  fontSize: "0.58rem",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  fontWeight: i === weekLabels.length - 1 ? 700 : 400,
                }}
                title={`Week starting ${w.label}`}
              >
                {w.label}
              </span>
            ))}
            <span className="text-muted" style={{ fontSize: "0.58rem", textAlign: "center", fontWeight: 700 }}>
              TOTAL
            </span>
          </div>

          {/* One row per panelist */}
          {sorted.map((load) => {
            const band = BAND_STYLE[load.band];
            const selected = selectedPanelistIds.includes(load.panelistId);
            const clickable = Boolean(onSelectPanelist);
            return (
              <div
                key={load.panelistId}
                onClick={clickable ? () => onSelectPanelist?.(load.panelistId) : undefined}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onKeyDown={clickable ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectPanelist?.(load.panelistId);
                  }
                } : undefined}
                style={{
                  display: "grid",
                  gridTemplateColumns: `${nameColWidth} repeat(${weekLabels.length}, minmax(0, 1fr)) 62px`,
                  gap: "3px",
                  alignItems: "center",
                  marginBottom: "3px",
                  cursor: clickable ? "pointer" : "default",
                  borderRadius: "6px",
                  outline: selected ? "1px solid var(--primary)" : "none",
                  background: selected ? "var(--primary-glow)" : "transparent",
                }}
              >
                <div style={{ minWidth: 0, paddingLeft: selected ? "0.25rem" : 0 }}>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={`${load.displayName} — ${load.email}`}
                  >
                    {load.displayName}
                  </div>
                  <div className="text-muted" style={{ fontSize: "0.6rem" }}>
                    {load.roles.join("/") || "—"}
                    {load.daysSinceLast === null
                      ? " · never"
                      : load.daysSinceLast === 0
                        ? " · today"
                        : ` · ${load.daysSinceLast}d ago`}
                  </div>
                </div>

                {load.weeks.map((w) => (
                  <div
                    key={w.weekStart}
                    title={`${load.displayName} — week of ${w.label}: ${w.assigned} assigned, ${w.conducted} conducted`}
                    style={{
                      height: compact ? "22px" : "26px",
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.62rem",
                      ...cellStyle(w.assigned, maxWeekly),
                    }}
                  >
                    {w.assigned > 0 ? w.assigned : ""}
                  </div>
                ))}

                <div
                  title={`${load.totalAssigned} assigned, ${load.totalConducted} conducted — ${band.label}`}
                  style={{
                    height: compact ? "22px" : "26px",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.2rem",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    fontFamily: "monospace",
                    background: band.bg,
                    color: band.color,
                    border: `1px solid color-mix(in srgb, ${band.color} 30%, transparent)`,
                  }}
                >
                  {load.totalAssigned}
                  {load.band === "heavy" && <Flame size={10} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" }}>
        {(["none", "light", "moderate", "heavy"] as const).map((b) => (
          <span
            key={b}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.62rem", color: "var(--text-muted)" }}
          >
            <span
              style={{
                width: "9px", height: "9px", borderRadius: "2px",
                background: b === "none" ? "var(--border-glass)" : BAND_STYLE[b].color,
                display: "inline-block",
              }}
            />
            {BAND_STYLE[b].label}
          </span>
        ))}
        <span className="text-muted" style={{ fontSize: "0.62rem" }}>
          · relative to this group&apos;s average
        </span>
      </div>
    </div>
  );
}
