'use client';

import React from 'react';
import { Panelist } from '@server/lib/db';
import { GraphUser } from '@server/lib/graph';

interface UserSearchDropdownProps {
  results: GraphUser[];
  panelists: Panelist[];
  onSelectUser: (user: GraphUser, alreadyRegisteredRoles?: ('L1' | 'L2')[]) => void;
}

export const UserSearchDropdown = ({ results, panelists, onSelectUser }: UserSearchDropdownProps) => {
  if (results.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 10,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        boxShadow: 'var(--shadow-md)',
        marginTop: '6px',
        maxHeight: '180px',
        overflowY: 'auto',
      }}
    >
      {results.map((user) => {
        const alreadyRegistered = panelists.find((p) => p.id === user.id);
        return (
          <div
            key={user.id}
            style={{ padding: '0.65rem 1rem', cursor: 'pointer', transition: 'var(--transition-fast)' }}
            className="search-item-hover"
            onClick={() => onSelectUser(user, alreadyRegistered?.roles)}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
              }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--fg)' }}>
                {user.displayName}
              </div>
              {alreadyRegistered && (
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                  {alreadyRegistered.roles.map((r) => (
                    <span
                      key={r}
                      style={{
                        fontSize: '0.6rem',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px',
                        background: r === 'L1' ? 'var(--l1-soft)' : 'var(--l2-soft)',
                        border: '1px solid var(--border)',
                        color: r === 'L1' ? 'var(--l1)' : 'var(--l2)',
                        fontWeight: 800,
                      }}
                    >
                      {r}
                    </span>
                  ))}
                  <span
                    style={{
                      fontSize: '0.6rem',
                      padding: '0.1rem 0.35rem',
                      borderRadius: '4px',
                      background: 'var(--accent-light)',
                      border: '1px solid var(--border)',
                      color: 'var(--accent)',
                      fontWeight: 800,
                    }}
                  >
                    registered
                  </span>
                </div>
              )}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>
              {user.mail || user.userPrincipalName}
            </div>
          </div>
        );
      })}
    </div>
  );
};
