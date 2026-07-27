'use client';

import React from 'react';
import { Building2, Clock } from 'lucide-react';
import { Drive, College } from '@server/lib/db';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/common/components/ui/select';

interface DriveInfoSectionProps {
  activeDrive: Drive | null;
  collegeName: string;
  startDate: string;
  endDate: string;
  collegesList: College[];
  todayStr: string;
  onCollegeNameChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
}

export const DriveInfoSection = ({
  activeDrive,
  collegeName,
  startDate,
  endDate,
  collegesList,
  todayStr,
  onCollegeNameChange,
  onStartDateChange,
  onEndDateChange,
}: DriveInfoSectionProps) => {
  if (activeDrive) {
    return (
      <div className="form-group">
        <label className="form-label">Drive Window &amp; Location (from Active Drive)</label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            flexWrap: 'wrap',
            background: 'var(--accent-light)',
            border: '1px solid rgba(13, 124, 102, 0.2)',
            borderRadius: '12px',
            padding: '0.65rem 0.85rem',
            fontSize: '0.8rem',
            color: 'var(--accent)',
            fontWeight: 600,
          }}
        >
          <Building2 size={14} />
          <strong>{activeDrive.collegeName}</strong>
          <span className="text-muted">·</span>
          <Clock size={13} />
          <span>
            {activeDrive.startDate === activeDrive.endDate
              ? new Date(activeDrive.startDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : `${new Date(activeDrive.startDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })} – ${new Date(activeDrive.endDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}`}
          </span>
        </div>
        <p className="text-xs text-muted" style={{ marginTop: '0.4rem' }}>
          Slots are generated across the selected window below, defaulted to the active drive. Change the drive
          itself in the <strong>Drives</strong> tab.
        </p>
        <div className="grid-2" style={{ marginTop: '0.75rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Slot Range Start</label>
            <input
              type="date"
              className="input-control"
              value={startDate}
              min={activeDrive.startDate}
              max={activeDrive.endDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              required
              style={{ colorScheme: 'dark' }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Slot Range End</label>
            <input
              type="date"
              className="input-control"
              value={endDate}
              min={startDate || activeDrive.startDate}
              max={activeDrive.endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              required
              style={{ colorScheme: 'dark' }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="form-group">
      <div
        style={{
          background: 'var(--warning-light)',
          border: '1px solid rgba(212, 146, 11, 0.25)',
          borderRadius: '12px',
          padding: '0.65rem 0.85rem',
          color: 'var(--warning)',
          fontSize: '0.78rem',
          marginBottom: '0.75rem',
          lineHeight: 1.4,
        }}
      >
        No active drive selected. Set an active drive in the <strong>Drives</strong> tab so the slot window and
        college are picked automatically. Falling back to a default date range below.
      </div>
      <label className="form-label">College / Institution</label>
      <Select value={collegeName} onValueChange={(val) => onCollegeNameChange(val || '')}>
        <SelectTrigger className="select-control" style={{ color: 'inherit' }}>
          <SelectValue placeholder="Select College..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_none_placeholder">Select College...</SelectItem>
          {collegesList.map((c) => (
            <SelectItem key={c.id} value={c.name}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="grid-2" style={{ marginTop: '0.75rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Proposed Range Start</label>
          <input
            type="date"
            className="input-control"
            value={startDate}
            min={todayStr}
            onChange={(e) => onStartDateChange(e.target.value)}
            required
            style={{ colorScheme: 'dark' }}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Proposed Range End</label>
          <input
            type="date"
            className="input-control"
            value={endDate}
            min={startDate || todayStr}
            onChange={(e) => onEndDateChange(e.target.value)}
            required
            style={{ colorScheme: 'dark' }}
          />
        </div>
      </div>
    </div>
  );
};
