'use client';

import React from 'react';
import { Panelist } from '@server/lib/db';

interface PanelistStatsGridProps {
  filteredPanelists: Panelist[];
  l1ScheduledTotal: number;
  l2ScheduledTotal: number;
  statFilter: 'all' | 'l1' | 'l1-scheduled' | 'l2' | 'l2-scheduled';
  onStatFilterChange: (filter: 'all' | 'l1' | 'l1-scheduled' | 'l2' | 'l2-scheduled') => void;
}

export const PanelistStatsGrid = ({
  filteredPanelists,
  l1ScheduledTotal,
  l2ScheduledTotal,
  statFilter,
  onStatFilterChange,
}: PanelistStatsGridProps) => {
  return (
    <div
      className="panelist-stats-grid"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}
    >
      <button
        type="button"
        className={`stat-card ${statFilter === 'l1' ? 'active' : ''}`}
        onClick={() => onStatFilterChange(statFilter === 'l1' ? 'all' : 'l1')}
      >
        <div className="stat-value">
          {filteredPanelists.filter((p) => p.roles.includes('L1')).length}
        </div>
        <div
          className="stat-label"
          style={{
            fontSize: '11px',
            color: 'var(--fg-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginTop: '6px',
          }}
        >
          Total L1
        </div>
      </button>

      <button
        type="button"
        className={`stat-card ${statFilter === 'l1-scheduled' ? 'active' : ''}`}
        onClick={() => onStatFilterChange(statFilter === 'l1-scheduled' ? 'all' : 'l1-scheduled')}
      >
        <div className="stat-value">{l1ScheduledTotal}</div>
        <div
          className="stat-label"
          style={{
            fontSize: '11px',
            color: 'var(--fg-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginTop: '6px',
          }}
        >
          Scheduled
        </div>
      </button>

      <button
        type="button"
        className={`stat-card ${statFilter === 'l2' ? 'active' : ''}`}
        onClick={() => onStatFilterChange(statFilter === 'l2' ? 'all' : 'l2')}
      >
        <div className="stat-value">
          {filteredPanelists.filter((p) => p.roles.includes('L2')).length}
        </div>
        <div
          className="stat-label"
          style={{
            fontSize: '11px',
            color: 'var(--fg-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginTop: '6px',
          }}
        >
          Total L2
        </div>
      </button>

      <button
        type="button"
        className={`stat-card ${statFilter === 'l2-scheduled' ? 'active' : ''}`}
        onClick={() => onStatFilterChange(statFilter === 'l2-scheduled' ? 'all' : 'l2-scheduled')}
      >
        <div className="stat-value">{l2ScheduledTotal}</div>
        <div
          className="stat-label"
          style={{
            fontSize: '11px',
            color: 'var(--fg-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginTop: '6px',
          }}
        >
          Scheduled
        </div>
      </button>
    </div>
  );
};
