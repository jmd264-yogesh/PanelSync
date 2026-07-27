'use client';

import React from 'react';

interface BulkSelectionBarProps {
  l1Count: number;
  l2Count: number;
  onRequestL1Slots: () => void;
  onRequestL2Slots: () => void;
  onClearSelection: () => void;
}

export const BulkSelectionBar = ({
  l1Count,
  l2Count,
  onRequestL1Slots,
  onRequestL2Slots,
  onClearSelection,
}: BulkSelectionBarProps) => {
  const totalCount = l1Count + l2Count;

  if (totalCount === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'sticky',
        bottom: '1rem',
        background: 'color-mix(in srgb, var(--bg-elevated) 92%, transparent)',
        backdropFilter: 'blur(12px)',
        border: '1px solid color-mix(in srgb, var(--primary) 35%, var(--border))',
        borderRadius: '16px',
        padding: '0.75rem 1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: 'var(--shadow-md)',
        zIndex: 90,
        marginTop: '1.5rem',
      }}
    >
      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--fg)' }}>
        <span style={{ color: 'var(--primary)', marginRight: '4px' }}>{totalCount}</span> Panelists
        Selected
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={onRequestL1Slots}
          className="btn btn-primary compact"
          style={{ height: '34px', fontSize: '12px' }}
          disabled={l1Count === 0}
        >
          Request L1 Slots
        </button>
        <button
          onClick={onRequestL2Slots}
          className="btn btn-primary compact"
          style={{ height: '34px', fontSize: '12px' }}
          disabled={l2Count === 0}
        >
          Request L2 Slots
        </button>
        <button
          onClick={onClearSelection}
          className="btn btn-secondary compact"
          style={{
            border: '1px solid var(--border)',
            background: 'transparent',
            height: '34px',
            fontSize: '12px',
          }}
        >
          Clear Selection
        </button>
      </div>
    </div>
  );
};
