'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { College } from '@server/lib/db';

interface PanelistToolbarProps {
  searchText: string;
  filterCollege: string;
  filterDate: string;
  collegesList: College[];
  onSearchChange: (value: string) => void;
  onFilterCollegeChange: (value: string) => void;
  onFilterDateChange: (value: string) => void;
  onResetFilters: () => void;
}

export const PanelistToolbar = ({
  searchText,
  filterCollege,
  filterDate,
  collegesList,
  onSearchChange,
  onFilterCollegeChange,
  onFilterDateChange,
  onResetFilters,
}: PanelistToolbarProps) => {
  return (
    <div
      className="directory-toolbar"
      style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}
    >
      <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
        <span
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--fg-muted)',
            display: 'flex',
          }}
        >
          <Search size={15} />
        </span>
        <input
          type="text"
          className="input-control"
          style={{ paddingLeft: '38px', height: '42px', borderRadius: '10px' }}
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search panelists..."
        />
      </div>

      <select
        value={filterCollege}
        onChange={(e) => onFilterCollegeChange(e.target.value)}
        className="select-control"
        style={{ width: '180px', height: '42px', borderRadius: '10px' }}
      >
        <option value="">All Colleges</option>
        {collegesList.map((c) => (
          <option key={c.id} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={filterDate}
        onChange={(e) => onFilterDateChange(e.target.value)}
        className="input-control"
        style={{ width: '150px', height: '42px', borderRadius: '10px', colorScheme: 'dark' }}
      />

      {(filterCollege || filterDate) && (
        <button
          type="button"
          onClick={onResetFilters}
          className="btn btn-secondary"
          style={{ height: '42px', padding: '0 16px', borderRadius: '10px', fontSize: '12px' }}
        >
          Reset
        </button>
      )}
    </div>
  );
};
