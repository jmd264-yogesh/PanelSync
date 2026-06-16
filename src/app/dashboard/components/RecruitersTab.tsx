'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Users, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';

export default function RecruitersTab() {
  const [recruiters, setRecruiters] = useState<{ email: string; addedBy: string | null; createdAt: string }[]>([]);
  const [isLoadingRecruiters, setIsLoadingRecruiters] = useState(false);
  const [newRecruiterEmail, setNewRecruiterEmail] = useState('');
  const [isAddingRecruiter, setIsAddingRecruiter] = useState(false);
  const [recruiterError, setRecruiterError] = useState<string | null>(null);

  const fetchRecruiters = async () => {
    setIsLoadingRecruiters(true);
    setRecruiterError(null);
    try {
      const res = await fetch('/api/recruiters');
      if (!res.ok) throw new Error('Failed to load allowed recruiters.');
      const data = await res.json();
      setRecruiters(data);
    } catch (err: any) {
      console.error(err);
      setRecruiterError(err.message || 'An error occurred loading recruiters.');
    } finally {
      setIsLoadingRecruiters(false);
    }
  };

  useEffect(() => {
    fetchRecruiters();
  }, []);

  const handleAddRecruiter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecruiterEmail.trim()) return;
    setIsAddingRecruiter(true);
    setRecruiterError(null);
    try {
      const res = await fetch('/api/recruiters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newRecruiterEmail.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add recruiter.');
      }
      setNewRecruiterEmail('');
      await fetchRecruiters();
    } catch (err: any) {
      console.error(err);
      setRecruiterError(err.message || 'An error occurred adding recruiter.');
    } finally {
      setIsAddingRecruiter(false);
    }
  };

  const handleRemoveRecruiter = async (email: string) => {
    try {
      const res = await fetch(`/api/recruiters/${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to revoke recruiter access.');
      }
      await fetchRecruiters();
      toast.success('Recruiter access revoked.');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'An error occurred revoking access.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="dashboard-two-column" style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '2rem' }}>
        
        {/* Left: Add Recruiter Form */}
        <div className="glass-card" style={{ height: 'fit-content', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={18} className="text-primary" />
            Add Approved Recruiter
          </h3>
          
          <form onSubmit={handleAddRecruiter} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Recruiter Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="name@jmangroup.com"
                value={newRecruiterEmail}
                onChange={(e) => setNewRecruiterEmail(e.target.value)}
                required
                style={{ marginTop: '0.5rem' }}
              />
            </div>
            
            {recruiterError && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem',
                color: '#f87171',
                fontSize: '0.8rem'
              }}>
                {recruiterError}
              </div>
            )}
            
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isAddingRecruiter || !newRecruiterEmail.trim()}
              style={{ width: '100%' }}
            >
              {isAddingRecruiter ? (
                <><Loader2 size={16} className="animate-spin" style={{ marginRight: '8px' }} /> Adding...</>
              ) : (
                'Add Recruiter'
              )}
            </button>
          </form>
        </div>
        
        {/* Right: Allowed Recruiters List */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={18} className="text-primary" />
            Authorized Recruiters Directory
          </h3>
          <p className="text-muted text-xs" style={{ marginBottom: '1.5rem' }}>
            Only the accounts listed below are permitted to sign in to PanelSync.
          </p>
          
          {isLoadingRecruiters ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Email Address</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Added By</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Date Added</th>
                    <th style={{ padding: '0.75rem 1rem', width: '80px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {/* Hardcoded System Pre-Approved Recruiters */}
                  {[
                    'yogeshwarang@jmangroup.com',
                    'jeffringoldwin@jmangroup.com',
                    'vishnuprriya@jmangroup.com'
                  ].map((systemEmail) => (
                    <tr key={systemEmail} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                      <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span>{systemEmail}</span>
                          <span style={{
                            fontSize: '0.65rem',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: '#a5b4fc',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            fontWeight: 700
                          }}>
                            System Pre-Approved
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>System Config</td>
                      <td style={{ padding: '1rem', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>Default</td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Locked</span>
                      </td>
                    </tr>
                  ))}
                  
                  {/* Database-added recruiters */}
                  {recruiters
                    .filter(r => ![
                      'yogeshwarang@jmangroup.com',
                      'jeffringoldwin@jmangroup.com',
                      'vishnuprriya@jmangroup.com'
                    ].includes(r.email.toLowerCase()))
                    .map((recruiter) => (
                      <tr key={recruiter.email} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }} className="search-item-hover">
                        <td style={{ padding: '1rem', color: 'var(--text-main)' }}>{recruiter.email}</td>
                        <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{recruiter.addedBy || 'N/A'}</td>
                        <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {new Date(recruiter.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <ConfirmDialog
                            trigger={
                              <button
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem' }}
                                onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                onMouseLeave={(e) => e.currentTarget.style.color = ''}
                                title="Revoke access"
                              />
                            }
                            triggerChildren={<Trash2 size={15} />}
                            title="Revoke recruiter access?"
                            description={`This will revoke sign-in permission for ${recruiter.email}.`}
                            confirmLabel="Yes, Revoke"
                            onConfirm={() => handleRemoveRecruiter(recruiter.email)}
                          />
                        </td>
                      </tr>
                    ))
                  }
                  
                  {/* Empty state when no database allowed recruiters */}
                  {recruiters.filter(r => ![
                    'yogeshwarang@jmangroup.com',
                    'jeffringoldwin@jmangroup.com',
                    'vishnuprriya@jmangroup.com'
                  ].includes(r.email.toLowerCase())).length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        No additional recruiters registered. Add a recruiter email on the left to authorize access.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
