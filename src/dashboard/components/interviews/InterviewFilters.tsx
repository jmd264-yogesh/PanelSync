import React from "react";
import { Search } from "lucide-react";
import { College } from "@server/lib/db";

type FilterStatus = "all" | "PENDING" | "COLLECTED" | "SCHEDULED" | "CANCELLED";
type FilterType = "all" | "L1" | "L2";

interface InterviewFiltersProps {
  typeFilter: FilterType;
  onTypeFilterChange: (type: FilterType) => void;
  statusFilter: FilterStatus;
  onStatusFilterChange: (status: FilterStatus) => void;
  filterThisWeek: boolean;
  onFilterThisWeekChange: (value: boolean) => void;
  collegeFilter: string;
  onCollegeFilterChange: (college: string) => void;
  dateFilter: string;
  onDateFilterChange: (date: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  collegesList: College[];
  activeHiringTab: "CAMPUS" | "LATERAL";
}

export const InterviewFilters: React.FC<InterviewFiltersProps> = ({
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  filterThisWeek,
  onFilterThisWeekChange,
  collegeFilter,
  onCollegeFilterChange,
  dateFilter,
  onDateFilterChange,
  searchQuery,
  onSearchQueryChange,
  collegesList,
  activeHiringTab,
}) => {
  return (
    <section className="filter-toolbar">
      {/* Filter Chips */}
      <div className="filter-chip-group">
        <button
          type="button"
          className={`filter-chip ${typeFilter === "all" && statusFilter === "all" && !filterThisWeek ? "active" : ""}`}
          onClick={() => {
            onTypeFilterChange("all");
            onStatusFilterChange("all");
            onFilterThisWeekChange(false);
          }}
        >
          All
        </button>
        <button
          type="button"
          className={`filter-chip ${typeFilter === "L1" ? "active" : ""}`}
          onClick={() => onTypeFilterChange(typeFilter === "L1" ? "all" : "L1")}
        >
          L1 Round
        </button>
        <button
          type="button"
          className={`filter-chip ${typeFilter === "L2" ? "active" : ""}`}
          onClick={() => onTypeFilterChange(typeFilter === "L2" ? "all" : "L2")}
        >
          L2 Round
        </button>
        <button
          type="button"
          className={`filter-chip ${statusFilter === "PENDING" ? "active" : ""}`}
          onClick={() =>
            onStatusFilterChange(statusFilter === "PENDING" ? "all" : "PENDING")
          }
        >
          Pending
        </button>
        <button
          type="button"
          className={`filter-chip ${statusFilter === "SCHEDULED" ? "active" : ""}`}
          onClick={() =>
            onStatusFilterChange(
              statusFilter === "SCHEDULED" ? "all" : "SCHEDULED",
            )
          }
        >
          Completed
        </button>
        <button
          type="button"
          className={`filter-chip ${filterThisWeek ? "active" : ""}`}
          onClick={() => onFilterThisWeekChange(!filterThisWeek)}
        >
          This Week
        </button>
      </div>

      {/* Filter Controls */}
      <div className="filter-control-group">
        {activeHiringTab === "CAMPUS" && (
          <select
            className="filter-select"
            value={collegeFilter}
            onChange={(e) => onCollegeFilterChange(e.target.value || "all")}
          >
            <option value="all">All Colleges</option>
            {collegesList.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        <input
          className="filter-date"
          type="date"
          value={dateFilter === "all" ? "" : dateFilter}
          onChange={(e) => onDateFilterChange(e.target.value || "all")}
          style={{ colorScheme: "dark" }}
        />

        <div style={{ position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--fg-muted)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Search size={14} />
          </span>
          <input
            className="search-input"
            type="search"
            placeholder="Search candidates..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            style={{ paddingLeft: "32px" }}
          />
        </div>
      </div>
    </section>
  );
};
