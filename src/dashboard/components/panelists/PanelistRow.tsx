'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { Panelist } from '@server/lib/db';
import { ConfirmDialog } from '@/common/components/ConfirmDialog';
import { getInitials } from '@/common/util/panelists/timeSlotGenerator';

interface PanelistRowProps {
  panelist: Panelist;
  isSelected: boolean;
  isMatched: boolean;
  scheduledCount: number;
  submittedCount: number;
  pendingCount: number;
  onToggleSelect: () => void;
  onRequestSlot: () => void;
  onDelete: () => void;
}

export const PanelistRow = ({
  panelist,
  isSelected,
  isMatched,
  scheduledCount,
  submittedCount,
  pendingCount,
  onToggleSelect,
  onRequestSlot,
  onDelete,
}: PanelistRowProps) => {
  return (
    <article className={`panelist-row ${isSelected ? 'selected' : ''}`}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggleSelect}
        style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
      />
      <div
        className="panelist-avatar"
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'var(--primary-glow)',
          color: 'var(--primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '14px',
        }}
      >
        {getInitials(panelist.displayName)}
      </div>
      <div className="panelist-identity" style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="panelist-name" style={{ fontWeight: 600, color: 'var(--fg)', fontSize: '14px' }}>
            {panelist.displayName}
          </span>
          {isMatched && (
            <span
              style={{
                fontSize: '10px',
                background: 'rgba(22, 163, 74, 0.1)',
                color: 'var(--success)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 600,
              }}
            >
              Matched
            </span>
          )}
        </div>
        <div
          className="panelist-email"
          style={{
            fontSize: '12px',
            color: 'var(--fg-secondary)',
            marginTop: '2px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={panelist.email}
        >
          {panelist.email}
        </div>
        <div className="panelist-meta">
          <span>{scheduledCount} scheduled</span>
          <span>•</span>
          <span>{submittedCount} slots given</span>
          {pendingCount > 0 && (
            <>
              <span>•</span>
              <span style={{ color: 'var(--warning)', fontWeight: 500 }}>{pendingCount} pending</span>
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={onRequestSlot} className="request-slots-button">
          Request Slots
        </button>
        <ConfirmDialog
          trigger={
            <button className="delete-row-btn" type="button">
              <Trash2 size={14} />
            </button>
          }
          title="Remove this panelist?"
          description="This will remove the panelist from the pre-approved pool."
          confirmLabel="Yes, Remove"
          onConfirm={onDelete}
        />
      </div>
    </article>
  );
};
