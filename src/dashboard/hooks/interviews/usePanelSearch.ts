import { useState, useEffect } from "react";
import { GraphUser } from "@server/lib/graph";
import { Panelist } from "@server/lib/db";

interface UsePanelSearchProps {
  selectedPanels: GraphUser[];
  setSelectedPanels: React.Dispatch<React.SetStateAction<GraphUser[]>>;
}

interface UsePanelSearchReturn {
  // Search state
  panelSearchQuery: string;
  setPanelSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  searchResults: GraphUser[];
  isSearchingPanels: boolean;

  // Actions
  addPanel: (user: GraphUser) => void;
  removePanel: (userId: string) => void;
  toggleRecommendedPanelist: (panelist: Panelist) => void;
}

export function usePanelSearch(
  props: UsePanelSearchProps
): UsePanelSearchReturn {
  const { selectedPanels, setSelectedPanels } = props;

  // ── Search State ───────────────────────────────────────────────────────────
  const [panelSearchQuery, setPanelSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GraphUser[]>([]);
  const [isSearchingPanels, setIsSearchingPanels] = useState(false);

  // ── Effect: Debounced Panel Search ────────────────────────────────────────
  useEffect(() => {
    if (panelSearchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingPanels(true);
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(panelSearchQuery)}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(
            data.filter(
              (u: GraphUser) => !selectedPanels.some((sp) => sp.id === u.id)
            )
          );
        }
      } catch (err) {
        console.error("Error searching panels:", err);
      } finally {
        setIsSearchingPanels(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [panelSearchQuery, selectedPanels]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const addPanel = (user: GraphUser) => {
    if (!selectedPanels.some((p) => p.id === user.id)) {
      setSelectedPanels([...selectedPanels, user]);
    }
    setPanelSearchQuery("");
    setSearchResults([]);
  };

  const toggleRecommendedPanelist = (p: Panelist) => {
    const isChosen = selectedPanels.some((sp) => sp.id === p.id);
    if (isChosen) {
      setSelectedPanels(selectedPanels.filter((sp) => sp.id !== p.id));
    } else {
      setSelectedPanels([
        ...selectedPanels,
        {
          id: p.id,
          displayName: p.displayName,
          mail: p.email,
          userPrincipalName: p.email,
        },
      ]);
    }
  };

  const removePanel = (userId: string) => {
    setSelectedPanels(selectedPanels.filter((p) => p.id !== userId));
  };

  return {
    panelSearchQuery,
    setPanelSearchQuery,
    searchResults,
    isSearchingPanels,
    addPanel,
    removePanel,
    toggleRecommendedPanelist,
  };
}
