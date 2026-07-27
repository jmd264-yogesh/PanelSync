import { useState, useMemo } from 'react';
import { Panelist } from '@server/lib/db';

export function usePanelistSelection(panelists: Panelist[]) {
  const [bulkSelectedL1Ids, setBulkSelectedL1Ids] = useState<string[]>([]);
  const [bulkSelectedL2Ids, setBulkSelectedL2Ids] = useState<string[]>([]);

  // Compute L1 and L2 panelist lists
  const l1Panelists = useMemo(
    () => panelists.filter((p) => p.roles.includes('L1')),
    [panelists]
  );

  const l2Panelists = useMemo(
    () => panelists.filter((p) => p.roles.includes('L2')),
    [panelists]
  );

  // Compute selected panelists
  const selectedL1Panelists = useMemo(
    () => panelists.filter((p) => bulkSelectedL1Ids.includes(p.id)),
    [panelists, bulkSelectedL1Ids]
  );

  const selectedL2Panelists = useMemo(
    () => panelists.filter((p) => bulkSelectedL2Ids.includes(p.id)),
    [panelists, bulkSelectedL2Ids]
  );

  // Toggle individual L1 panelist
  const toggleL1 = (id: string) => {
    if (bulkSelectedL1Ids.includes(id)) {
      setBulkSelectedL1Ids(bulkSelectedL1Ids.filter((selectedId) => selectedId !== id));
    } else {
      setBulkSelectedL1Ids([...bulkSelectedL1Ids, id]);
    }
  };

  // Toggle individual L2 panelist
  const toggleL2 = (id: string) => {
    if (bulkSelectedL2Ids.includes(id)) {
      setBulkSelectedL2Ids(bulkSelectedL2Ids.filter((selectedId) => selectedId !== id));
    } else {
      setBulkSelectedL2Ids([...bulkSelectedL2Ids, id]);
    }
  };

  // Toggle all L1 panelists
  const toggleAllL1 = (panelists: Panelist[]) => {
    const allSelected = panelists.every((p) => bulkSelectedL1Ids.includes(p.id));
    if (allSelected) {
      setBulkSelectedL1Ids(bulkSelectedL1Ids.filter((id) => !panelists.some((p) => p.id === id)));
    } else {
      const newIds = [...bulkSelectedL1Ids];
      panelists.forEach((p) => {
        if (!newIds.includes(p.id)) newIds.push(p.id);
      });
      setBulkSelectedL1Ids(newIds);
    }
  };

  // Toggle all L2 panelists
  const toggleAllL2 = (panelists: Panelist[]) => {
    const allSelected = panelists.every((p) => bulkSelectedL2Ids.includes(p.id));
    if (allSelected) {
      setBulkSelectedL2Ids(bulkSelectedL2Ids.filter((id) => !panelists.some((p) => p.id === id)));
    } else {
      const newIds = [...bulkSelectedL2Ids];
      panelists.forEach((p) => {
        if (!newIds.includes(p.id)) newIds.push(p.id);
      });
      setBulkSelectedL2Ids(newIds);
    }
  };

  // Clear all selections
  const clearSelection = () => {
    setBulkSelectedL1Ids([]);
    setBulkSelectedL2Ids([]);
  };

  return {
    // State
    bulkSelectedL1Ids,
    bulkSelectedL2Ids,
    // Computed
    l1Panelists,
    l2Panelists,
    selectedL1Panelists,
    selectedL2Panelists,
    // Actions
    toggleL1,
    toggleL2,
    toggleAllL1,
    toggleAllL2,
    clearSelection,
    setBulkSelectedL1Ids,
    setBulkSelectedL2Ids,
  };
}
