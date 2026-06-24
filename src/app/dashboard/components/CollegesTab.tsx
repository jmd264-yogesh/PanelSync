'use client';

import React, { useState } from 'react';
import { Building2, Trash2, Loader2 } from 'lucide-react';
import { College } from '@/lib/db';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';

interface CollegesTabProps {
  collegesList: College[];
  setCollegesList: React.Dispatch<React.SetStateAction<College[]>>;
}

export default function CollegesTab({ collegesList, setCollegesList }: CollegesTabProps) {
  const [newCollegeName, setNewCollegeName] = useState('');
  const [isAddingCollege, setIsAddingCollege] = useState(false);
  const [isLoadingColleges, setIsLoadingColleges] = useState(false);
  const [collegeError, setCollegeError] = useState<string | null>(null);

  const fetchColleges = async () => {
    setIsLoadingColleges(true);
    try {
      const res = await fetch('/api/colleges');
      if (res.ok) {
        const data = await res.json();
        setCollegesList(data);
      }
    } catch (err) {
      console.error('Failed to load colleges:', err);
    } finally {
      setIsLoadingColleges(false);
    }
  };

  const handleAddCollege = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollegeName.trim()) return;
    setIsAddingCollege(true);
    setCollegeError(null);
    try {
      const res = await fetch('/api/colleges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCollegeName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add college.');
      }
      setNewCollegeName('');
      await fetchColleges();
    } catch (err: any) {
      console.error(err);
      setCollegeError(err.message || 'An error occurred adding college.');
    } finally {
      setIsAddingCollege(false);
    }
  };

  const handleDeleteCollege = async (id: string) => {
    try {
      const res = await fetch(`/api/colleges/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete college.');
      }
      await fetchColleges();
      toast.success('College removed from the directory.');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'An error occurred deleting college.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="dashboard-two-column" style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '1.25rem' }}>
        
        {/* Left: Add College Form */}
        <div className="glass-card" style={{ height: 'fit-content', padding: '1.15rem' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={18} className="text-primary" />
            Add College / Institution
          </h3>
          
          <form onSubmit={handleAddCollege} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>College Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. IIT Bombay, NIT Trichy"
                value={newCollegeName}
                onChange={(e) => setNewCollegeName(e.target.value)}
                required
                style={{ marginTop: '0.5rem' }}
              />
            </div>
            
            {collegeError && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem',
                color: '#f87171',
                fontSize: '0.8rem'
              }}>
                {collegeError}
              </div>
            )}
            
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isAddingCollege || !newCollegeName.trim()}
              style={{ width: '100%' }}
            >
              {isAddingCollege ? (
                <><Loader2 size={16} className="animate-spin" style={{ marginRight: '8px' }} /> Adding...</>
              ) : (
                'Add College'
              )}
            </button>
          </form>
        </div>
        
        {/* Right: Colleges List */}
        <div className="glass-card" style={{ padding: '1.15rem' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building2 size={18} className="text-primary" />
            Registered Colleges Directory
          </h3>
          <p className="text-muted text-xs" style={{ marginBottom: '1.5rem' }}>
            This is the single source of truth for all colleges/institutions we will be visiting for interviews.
          </p>
          
          {isLoadingColleges ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>College / Institution Name</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Date Registered</th>
                    <th style={{ padding: '0.75rem 1rem', width: '80px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {collegesList.map((college) => (
                    <tr key={college.id} style={{ borderBottom: '1px solid var(--border-glass)', transition: 'var(--transition-fast)' }} className="search-item-hover">
                      <td style={{ padding: '1rem', fontWeight: 500, color: 'var(--text-main)' }}>{college.name}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                        {new Date(college.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <ConfirmDialog
                          trigger={
                            <button
                              style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                color: 'var(--text-muted)',
                                padding: '0.2rem'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={(e) => e.currentTarget.style.color = ''}
                              title="Delete College"
                            />
                          }
                          triggerChildren={<Trash2 size={15} />}
                          title="Delete this college?"
                          description="This will remove it from the select directory list."
                          confirmLabel="Yes, Delete"
                          onConfirm={() => handleDeleteCollege(college.id)}
                        />
                      </td>
                    </tr>
                  ))}
                  
                  {collegesList.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        No colleges registered. Add a college name on the left to start populate.
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

