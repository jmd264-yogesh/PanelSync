'use client';

import React from 'react';
import { ProposedSlot } from '@/common/types/panelist';
import { formatTimeSlot } from '@/common/util/panelists/timeSlotGenerator';

interface SlotChecklistProps {
  slots: ProposedSlot[];
  onToggleSlot: (index: number) => void;
}

export const SlotChecklist = ({ slots, onToggleSlot }: SlotChecklistProps) => {
  return (
    <div
      style={{
        background: 'var(--surface-soft)',
        border: '1px solid var(--border)',
        padding: '1rem',
        borderRadius: '12px',
        marginBottom: '1.5rem',
      }}
    >
      <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--fg)', fontWeight: 800 }}>
        Proposed Slot Options Checklist
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
        {slots.length === 0 ? (
          <span className="text-muted text-xs block text-center" style={{ padding: '0.5rem 0' }}>
            No proposed slot options added yet. Select range start/end.
          </span>
        ) : (
          slots.map((s, idx) => (
            <label
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: 'var(--fg)',
              }}
            >
              <input
                type="checkbox"
                checked={s.selected}
                onChange={() => onToggleSlot(idx)}
                style={{ accentColor: 'var(--accent)' }}
              />
              <span>{formatTimeSlot(s)}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
};
