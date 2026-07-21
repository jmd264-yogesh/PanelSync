import { useState } from "react";
import { Drive } from "@server/lib/db";

/**
 * Hook for managing panelist dashboard filter states
 *
 * Manages all UI filter and tab selection states including:
 * - Drive and date filters
 * - Primary tab navigation (Panels/Feedback/Recalibrate)
 * - Hiring type selection (Campus/Lateral)
 * - Round filtering (All/L1/L2)
 */
export function usePanelistFilters(activeDrive: Drive | null) {
  // Filter states
  const [filterActiveDrive, setFilterActiveDrive] = useState(!!activeDrive);
  const [filterDate, setFilterDate] = useState<string | null>(null);

  // Primary tab state (Panels vs Interviews & Feedback)
  const [activePrimaryTab, setActivePrimaryTab] = useState<
    "PANELS" | "FEEDBACK" | "RECALIBRATE"
  >("PANELS");

  // Hiring type tab
  const [activeHiringTab, setActiveHiringTab] = useState<"CAMPUS" | "LATERAL">(
    "CAMPUS"
  );

  // Round Tab state for filtering L1 vs L2 vs Lateral candidates
  const [activeRoundTab, setActiveRoundTab] = useState<"ALL" | "L1" | "L2">(
    "ALL"
  );

  return {
    filterActiveDrive,
    setFilterActiveDrive,
    filterDate,
    setFilterDate,
    activePrimaryTab,
    setActivePrimaryTab,
    activeHiringTab,
    setActiveHiringTab,
    activeRoundTab,
    setActiveRoundTab,
  };
}
