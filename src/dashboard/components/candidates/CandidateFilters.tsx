/**
 * CandidateFilters Component
 *
 * Filter controls for the candidate queue (search, status, college, date, drive scope).
 */

'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/common/components/ui/select';
import type { College, Drive } from '@server/lib/db';
import type { CandidateFilters as CandidateFiltersType } from '@/common/types/candidate';

interface CandidateFiltersProps {
  filters: CandidateFiltersType;
  collegesList: College[];
  activeDrive: Drive | null;
  onSearchChange: (query: string) => void;
  onStatusChange: (status: 'all' | 'WAITING' | 'MAPPED') => void;
  onCollegeChange: (college: string) => void;
  onDateChange: (date: string) => void;
  onScopeChange: (scope: boolean) => void;
}

export const CandidateFilters: React.FC<CandidateFiltersProps> = ({
  filters,
  collegesList,
  activeDrive,
  onSearchChange,
  onStatusChange,
  onCollegeChange,
  onDateChange,
  onScopeChange,
}) => {
  return (
    <div className="filter-toolbar">
      {/* Search Input */}
      <div className="search-field" style={{ position: 'relative' }}>
        <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
          Search
        </label>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search candidate..."
            className="form-input"
            value={filters.searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ paddingLeft: '28px', fontSize: '0.75rem', height: '32px', borderRadius: 'var(--radius-sm)' }}
          />
        </div>
      </div>

      {/* Status Filter */}
      <div>
        <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
          Status
        </label>
        <Select value={filters.statusFilter} onValueChange={(val) => onStatusChange(val as any)}>
          <SelectTrigger className="text-left w-full" style={{ fontSize: '0.75rem', height: '32px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', color: 'inherit' }}>
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="WAITING">Waiting</SelectItem>
            <SelectItem value="MAPPED">Mapped</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* College Filter */}
      <div>
        <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
          College (Drive)
        </label>
        <Select value={filters.collegeFilter} onValueChange={(val) => onCollegeChange(val || 'all')}>
          <SelectTrigger className="text-left w-full" style={{ fontSize: '0.75rem', height: '32px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', color: 'inherit' }}>
            <SelectValue placeholder="All Colleges" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Colleges</SelectItem>
            {collegesList.map((c) => (
              <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date Filter */}
      <div>
        <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
          Drive Date
        </label>
        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
          <input
            type="date"
            value={filters.dateFilter === 'all' ? '' : filters.dateFilter}
            onChange={(e) => onDateChange(e.target.value || 'all')}
            style={{
              width: '100%',
              padding: '0.3rem 0.5rem',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-sm)',
              color: 'inherit',
              fontSize: '0.75rem',
              height: '32px',
              colorScheme: 'dark',
              cursor: 'pointer',
            }}
          />
          {filters.dateFilter !== 'all' && (
            <button
              type="button"
              onClick={() => onDateChange('all')}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Clear date filter"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Active Drive Scope */}
      <div className="checkbox-field">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', cursor: activeDrive ? 'pointer' : 'not-allowed', color: activeDrive ? 'inherit' : 'var(--text-muted)', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={filters.scopeToActiveDrive && !!activeDrive}
            disabled={!activeDrive}
            onChange={(e) => onScopeChange(e.target.checked)}
            style={{ accentColor: 'var(--primary)', cursor: activeDrive ? 'pointer' : 'not-allowed' }}
          />
          <span>Active Drive only</span>
        </label>
      </div>
    </div>
  );
};
