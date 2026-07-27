'use client';

import React from 'react';
import { PANELIST_ROLE_LABELS } from '@/common/constants/panelistRoles';

interface CapabilitySelectorProps {
  selectedRoles: ('L1' | 'L2')[];
  onToggleRole: (role: 'L1' | 'L2') => void;
}

export const CapabilitySelector = ({ selectedRoles, onToggleRole }: CapabilitySelectorProps) => {
  return (
    <div className="form-block">
      <div className="field-label">Interview Capability Levels</div>
      <div className="capability-list">
        <label className={`capability-option ${selectedRoles.includes('L1') ? 'selected' : ''}`}>
          <input
            type="checkbox"
            checked={selectedRoles.includes('L1')}
            onChange={() => onToggleRole('L1')}
            style={{ accentColor: 'var(--primary)' }}
          />
          <span>
            <strong>{PANELIST_ROLE_LABELS.L1.title}</strong>
            <small>{PANELIST_ROLE_LABELS.L1.description}</small>
          </span>
        </label>

        <label className={`capability-option ${selectedRoles.includes('L2') ? 'selected' : ''}`}>
          <input
            type="checkbox"
            checked={selectedRoles.includes('L2')}
            onChange={() => onToggleRole('L2')}
            style={{ accentColor: 'var(--primary)' }}
          />
          <span>
            <strong>{PANELIST_ROLE_LABELS.L2.title}</strong>
            <small>{PANELIST_ROLE_LABELS.L2.description}</small>
          </span>
        </label>
      </div>
    </div>
  );
};
