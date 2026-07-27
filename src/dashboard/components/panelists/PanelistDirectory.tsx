'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Settings } from 'lucide-react';
import { Panelist, Interview, College } from '@server/lib/db';
import { PanelistStatsGrid } from './PanelistStatsGrid';
import { PanelistToolbar } from './PanelistToolbar';
import { PanelistRow } from './PanelistRow';

interface PanelistDirectoryProps {
  panelists: Panelist[];
  interviews: Interview[];
  collegesList: College[];
  filterCollege: string;
  filterDate: string;
  bulkSelectedL1Ids: string[];
  bulkSelectedL2Ids: string[];
  onFilterCollegeChange: (value: string) => void;
  onFilterDateChange: (value: string) => void;
  onResetFilters: () => void;
  onToggleL1: (id: string) => void;
  onToggleL2: (id: string) => void;
  onToggleAllL1: (panelists: Panelist[]) => void;
  onToggleAllL2: (panelists: Panelist[]) => void;
  onDeletePanelist: (id: string) => void;
  onRequestSlot: (panelist: Panelist, type: 'L1' | 'L2') => void;
}

export const PanelistDirectory = ({
  panelists,
  interviews,
  collegesList,
  filterCollege,
  filterDate,
  bulkSelectedL1Ids,
  bulkSelectedL2Ids,
  onFilterCollegeChange,
  onFilterDateChange,
  onResetFilters,
  onToggleL1,
  onToggleL2,
  onToggleAllL1,
  onToggleAllL2,
  onDeletePanelist,
  onRequestSlot,
}: PanelistDirectoryProps) => {
  const [panelistFilterText, setPanelistFilterText] = useState('');
  const [statFilter, setStatFilter] = useState<'all' | 'l1' | 'l1-scheduled' | 'l2' | 'l2-scheduled'>('all');
  const [activeRoleTab, setActiveRoleTab] = useState<'L1' | 'L2'>('L1');

  // Helper to determine if a panelist matches active drive / selected filters
  const isPanelistMatched = useCallback(
    (panelistId: string) => {
      if (!filterCollege && !filterDate) return false;

      const panelistInterviews = interviews.filter((i) =>
        i.panels.some((p) => p.userId === panelistId)
      );

      const matchesCollege =
        !filterCollege ||
        panelistInterviews.some((i) => {
          const parts = i.role.split(' - ');
          const interviewCollege = parts.length > 1 ? parts[1].trim().toLowerCase() : '';
          return interviewCollege === filterCollege.toLowerCase();
        });

      const matchesDate =
        !filterDate ||
        panelistInterviews.some((i) => {
          if (i.scheduledSlotStart) {
            return i.scheduledSlotStart.split('T')[0] === filterDate;
          }
          const fDate = filterDate;
          const sDate = i.startDate.split('T')[0];
          const eDate = i.endDate.split('T')[0];
          return fDate >= sDate && fDate <= eDate;
        });

      return matchesCollege && matchesDate;
    },
    [filterCollege, filterDate, interviews]
  );

  // Filtered panelists
  const filteredPanelists = panelists.filter(
    (p) =>
      p.displayName.toLowerCase().includes(panelistFilterText.toLowerCase()) ||
      p.email.toLowerCase().includes(panelistFilterText.toLowerCase())
  );

  const matchedPanelistIds = useMemo(() => {
    const matched = new Set<string>();
    filteredPanelists.forEach((p) => {
      if (isPanelistMatched(p.id)) {
        matched.add(p.id);
      }
    });
    return matched;
  }, [filteredPanelists, isPanelistMatched]);

  const sortPanelists = useCallback(
    (list: Panelist[]) => {
      return [...list].sort((a, b) => {
        const aMatched = matchedPanelistIds.has(a.id);
        const bMatched = matchedPanelistIds.has(b.id);
        if (aMatched && !bMatched) return -1;
        if (!aMatched && bMatched) return 1;
        return a.displayName.localeCompare(b.displayName);
      });
    },
    [matchedPanelistIds]
  );

  // Per-panelist stats helpers
  const panelistSubmittedCount = (panelistId: string, type?: 'L1' | 'L2') =>
    interviews.filter((i) => {
      if (type && !i.role.toLowerCase().includes(type.toLowerCase())) return false;
      return (
        (i.status === 'PENDING' || i.status === 'COLLECTED' || i.status === 'SCHEDULED') &&
        i.panels.some((p) => p.userId === panelistId && p.status === 'SUBMITTED')
      );
    }).length;

  const panelistScheduledCount = (panelistId: string, type?: 'L1' | 'L2') =>
    interviews.filter((i) => {
      if (type && !i.role.toLowerCase().includes(type.toLowerCase())) return false;
      return i.status === 'SCHEDULED' && i.panels.some((p) => p.userId === panelistId);
    }).length;

  const panelistPendingCount = (panelistId: string) =>
    interviews.filter(
      (i) =>
        i.status === 'PENDING' &&
        i.panels.some((p) => p.userId === panelistId && p.status === 'PENDING')
    ).length;

  // Filtered L1 & L2 lists based on active stats filter card selection
  const l1Panelists = sortPanelists(filteredPanelists.filter((p) => p.roles.includes('L1'))).filter((p) => {
    if (statFilter === 'l2' || statFilter === 'l2-scheduled') return false;
    if (statFilter === 'l1-scheduled') return panelistScheduledCount(p.id, 'L1') > 0;
    return true;
  });

  const l2Panelists = sortPanelists(filteredPanelists.filter((p) => p.roles.includes('L2'))).filter((p) => {
    if (statFilter === 'l1' || statFilter === 'l1-scheduled') return false;
    if (statFilter === 'l2-scheduled') return panelistScheduledCount(p.id, 'L2') > 0;
    return true;
  });

  const allL1Selected = l1Panelists.length > 0 && l1Panelists.every((p) => bulkSelectedL1Ids.includes(p.id));
  const allL2Selected = l2Panelists.length > 0 && l2Panelists.every((p) => bulkSelectedL2Ids.includes(p.id));

  // Column summary stats
  const l1ScheduledTotal = useMemo(() => {
    return interviews.filter((i) => {
      if (i.status !== 'SCHEDULED' || !i.role.toLowerCase().includes('l1')) return false;

      const parts = i.role.split(' - ');
      const interviewCollege = parts.length > 1 ? parts[1].trim().toLowerCase() : '';
      if (filterCollege && interviewCollege !== filterCollege.toLowerCase()) return false;

      if (filterDate) {
        if (i.scheduledSlotStart) {
          if (i.scheduledSlotStart.split('T')[0] !== filterDate) return false;
        } else {
          const fDate = filterDate;
          const sDate = i.startDate.split('T')[0];
          const eDate = i.endDate.split('T')[0];
          if (fDate < sDate || fDate > eDate) return false;
        }
      }
      return true;
    }).length;
  }, [interviews, filterCollege, filterDate]);

  const l2ScheduledTotal = useMemo(() => {
    return interviews.filter((i) => {
      if (i.status !== 'SCHEDULED' || !i.role.toLowerCase().includes('l2')) return false;

      const parts = i.role.split(' - ');
      const interviewCollege = parts.length > 1 ? parts[1].trim().toLowerCase() : '';
      if (filterCollege && interviewCollege !== filterCollege.toLowerCase()) return false;

      if (filterDate) {
        if (i.scheduledSlotStart) {
          if (i.scheduledSlotStart.split('T')[0] !== filterDate) return false;
        } else {
          const fDate = filterDate;
          const sDate = i.startDate.split('T')[0];
          const eDate = i.endDate.split('T')[0];
          if (fDate < sDate || fDate > eDate) return false;
        }
      }
      return true;
    }).length;
  }, [interviews, filterCollege, filterDate]);

  return (
    <section
      className="directory-card"
      style={{
        padding: '24px',
        borderRadius: '16px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-glass)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div className="directory-header" style={{ marginBottom: '20px' }}>
        <h2
          className="section-title"
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--fg)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Settings size={18} style={{ color: 'var(--fg-secondary)' }} /> Panelist Pool Directory
        </h2>
        <p
          className="section-description"
          style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--fg-secondary)' }}
        >
          Search registered panelists, review scheduling availability, and request slot nominations.
        </p>
      </div>

      <PanelistToolbar
        searchText={panelistFilterText}
        filterCollege={filterCollege}
        filterDate={filterDate}
        collegesList={collegesList}
        onSearchChange={setPanelistFilterText}
        onFilterCollegeChange={onFilterCollegeChange}
        onFilterDateChange={onFilterDateChange}
        onResetFilters={onResetFilters}
      />

      <PanelistStatsGrid
        filteredPanelists={filteredPanelists}
        l1ScheduledTotal={l1ScheduledTotal}
        l2ScheduledTotal={l2ScheduledTotal}
        statFilter={statFilter}
        onStatFilterChange={setStatFilter}
      />

      {filteredPanelists.length === 0 ? (
        <div
          className="empty-state"
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            background: 'var(--surface-hover)',
            borderRadius: '12px',
            border: '1px solid var(--border-glass)',
          }}
        >
          <div className="empty-icon" style={{ fontSize: '32px', marginBottom: '12px' }}>
            👥
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0' }}>No panelists found</h3>
          <p style={{ fontSize: '13px', color: 'var(--fg-secondary)', margin: 0 }}>
            Search your tenant directory and register panelists with their L1/L2 capability levels on the left.
          </p>
        </div>
      ) : (
        <div>
          {/* Tab Switcher for L1 vs L2 */}
          <div
            style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)', marginBottom: '16px', gap: '8px' }}
          >
            <button
              type="button"
              className={`tab-btn ${activeRoleTab === 'L1' ? 'active' : ''}`}
              onClick={() => setActiveRoleTab('L1')}
              style={{
                padding: '10px 16px',
                fontWeight: activeRoleTab === 'L1' ? 700 : 500,
                color: activeRoleTab === 'L1' ? 'var(--primary)' : 'var(--fg-secondary)',
                borderBottom:
                  activeRoleTab === 'L1' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '14px',
                borderLeft: 'none',
                borderRight: 'none',
                borderTop: 'none',
              }}
            >
              L1 Panelists ({l1Panelists.length})
            </button>
            <button
              type="button"
              className={`tab-btn ${activeRoleTab === 'L2' ? 'active' : ''}`}
              onClick={() => setActiveRoleTab('L2')}
              style={{
                padding: '10px 16px',
                fontWeight: activeRoleTab === 'L2' ? 700 : 500,
                color: activeRoleTab === 'L2' ? 'var(--primary)' : 'var(--fg-secondary)',
                borderBottom:
                  activeRoleTab === 'L2' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '14px',
                borderLeft: 'none',
                borderRight: 'none',
                borderTop: 'none',
              }}
            >
              L2 Panelists ({l2Panelists.length})
            </button>
          </div>

          {/* Select All Checkbox toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px 16px',
              background: 'var(--surface-hover)',
              border: '1px solid var(--border-glass)',
              borderRadius: '10px',
              marginBottom: '12px',
            }}
          >
            <input
              type="checkbox"
              checked={activeRoleTab === 'L1' ? allL1Selected : allL2Selected}
              onChange={() =>
                activeRoleTab === 'L1' ? onToggleAllL1(l1Panelists) : onToggleAllL2(l2Panelists)
              }
              style={{ accentColor: 'var(--primary)', cursor: 'pointer', marginRight: '10px' }}
            />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg-secondary)' }}>
              Select All {activeRoleTab} Panelists
            </span>
          </div>

          {/* Panelists list */}
          <div className="panelist-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(activeRoleTab === 'L1' ? l1Panelists : l2Panelists).length === 0 ? (
              <div
                className="empty-state"
                style={{
                  padding: '2.5rem 1rem',
                  textAlign: 'center',
                  background: 'var(--surface-hover)',
                  borderRadius: '12px',
                }}
              >
                <p style={{ fontSize: '13px', color: 'var(--fg-secondary)', margin: 0 }}>
                  No {activeRoleTab} panelists matching active filters.
                </p>
              </div>
            ) : (
              (activeRoleTab === 'L1' ? l1Panelists : l2Panelists).map((p) => (
                <PanelistRow
                  key={p.id}
                  panelist={p}
                  isSelected={
                    activeRoleTab === 'L1'
                      ? bulkSelectedL1Ids.includes(p.id)
                      : bulkSelectedL2Ids.includes(p.id)
                  }
                  isMatched={matchedPanelistIds.has(p.id)}
                  scheduledCount={panelistScheduledCount(p.id, activeRoleTab)}
                  submittedCount={panelistSubmittedCount(p.id, activeRoleTab)}
                  pendingCount={panelistPendingCount(p.id)}
                  onToggleSelect={() => {
                    if (activeRoleTab === 'L1') {
                      onToggleL1(p.id);
                    } else {
                      onToggleL2(p.id);
                    }
                  }}
                  onRequestSlot={() => onRequestSlot(p, activeRoleTab)}
                  onDelete={() => onDeletePanelist(p.id)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
};
