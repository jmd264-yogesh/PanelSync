'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Search, Loader2 } from 'lucide-react';
import { Panelist } from '@server/lib/db';
import { GraphUser } from '@server/lib/graph';
import { UserSearchDropdown } from './UserSearchDropdown';
import { CapabilitySelector } from './CapabilitySelector';

interface AdminPanelistFormProps {
  panelists: Panelist[];
  onAdd: (user: GraphUser, roles: ('L1' | 'L2')[]) => Promise<boolean>;
  isAdminSaving: boolean;
}

export const AdminPanelistForm = ({ panelists, onAdd, isAdminSaving }: AdminPanelistFormProps) => {
  const [adminQuery, setAdminQuery] = useState('');
  const [adminSearchResults, setAdminSearchResults] = useState<GraphUser[]>([]);
  const [isAdminSearching, setIsAdminSearching] = useState(false);
  const [adminSelectedUser, setAdminSelectedUser] = useState<GraphUser | null>(null);
  const [adminRoles, setAdminRoles] = useState<('L1' | 'L2')[]>(['L1']);

  // Debounced admin Entra directory search
  useEffect(() => {
    if (adminQuery.trim().length < 2) {
      setAdminSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsAdminSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(adminQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setAdminSearchResults(data);
        }
      } catch (err) {
        console.error('Error in admin search:', err);
      } finally {
        setIsAdminSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [adminQuery, panelists]);

  const handleSelectUser = (user: GraphUser, existingRoles?: ('L1' | 'L2')[]) => {
    setAdminSelectedUser(user);
    setAdminQuery(user.displayName);
    setAdminSearchResults([]);
    if (existingRoles) setAdminRoles(existingRoles);
  };

  const handleToggleRole = (role: 'L1' | 'L2') => {
    if (adminRoles.includes(role)) {
      setAdminRoles(adminRoles.filter((r) => r !== role));
    } else {
      setAdminRoles([...adminRoles, role]);
    }
  };

  const handleAddPanelist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminSelectedUser) return;

    const success = await onAdd(adminSelectedUser, adminRoles);
    if (success) {
      setAdminSelectedUser(null);
      setAdminQuery('');
      setAdminRoles(['L1']);
    }
  };

  return (
    <aside className="register-card">
      <div className="section-heading-row compact">
        <div>
          <h2 className="section-title">
            <Shield size={18} style={{ color: 'var(--accent)' }} /> Register New Panelist
          </h2>
          <p className="section-description">Add a colleague to the interview panelist pool.</p>
        </div>
      </div>

      <form onSubmit={handleAddPanelist}>
        <div className="form-block">
          <label className="field-label" htmlFor="search-colleague-input">
            Search Colleague (Directory)
          </label>
          <div className="search-field">
            <span className="search-icon">
              <Search size={15} />
            </span>
            <input
              id="search-colleague-input"
              type="text"
              className="input-control search-control"
              value={adminQuery}
              onChange={(e) => {
                setAdminQuery(e.target.value);
                if (adminSelectedUser) setAdminSelectedUser(null);
              }}
              placeholder="Type name or email..."
            />
            {isAdminSearching && (
              <Loader2
                size={15}
                className="animate-spin text-muted"
                style={{ position: 'absolute', right: '12px', top: '50%', marginTop: '-8.5px' }}
              />
            )}
          </div>

          <UserSearchDropdown
            results={adminSearchResults}
            panelists={panelists}
            onSelectUser={handleSelectUser}
          />
        </div>

        {adminSelectedUser && (
          <div
            style={{
              background: 'var(--surface-soft)',
              padding: '0.75rem',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              marginBottom: '1.25rem',
              marginTop: '1rem',
            }}
          >
            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--fg-secondary)',
                textTransform: 'uppercase',
                fontWeight: 700,
                letterSpacing: '0.5px',
              }}
            >
              Selected Colleague
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--fg)', marginTop: '2px' }}>
              {adminSelectedUser.displayName}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
              {adminSelectedUser.mail || adminSelectedUser.userPrincipalName}
            </div>
          </div>
        )}

        <CapabilitySelector selectedRoles={adminRoles} onToggleRole={handleToggleRole} />

        <button
          type="submit"
          className="btn btn-primary register-submit"
          disabled={!adminSelectedUser || adminRoles.length === 0 || isAdminSaving}
        >
          {isAdminSaving ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Saving...
            </>
          ) : (
            'Register Panelist'
          )}
        </button>
      </form>
    </aside>
  );
};
