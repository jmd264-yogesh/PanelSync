'use client';

import React, { useState } from 'react';
import { Compass, Trash2, Loader2, CalendarRange, Check, Lock, Unlock } from 'lucide-react';
import { Drive, College } from '@/lib/db';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DrivesTabProps {
  drives: Drive[];
  activeDrive: Drive | null;
  onDrivesChange: () => Promise<void>;
  collegesList: College[];
}

export default function DrivesTab({ drives, activeDrive, onDrivesChange, collegesList }: DrivesTabProps) {
  const [selectedCollege, setSelectedCollege] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAddingDrive, setIsAddingDrive] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null);
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null);

  const handleAddDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollege.trim() || !startDate.trim() || !endDate.trim()) return;
    if (endDate < startDate) {
      setDriveError('End date cannot be before the start date.');
      return;
    }

    setIsAddingDrive(true);
    setDriveError(null);
    try {
      const res = await fetch('/api/drives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collegeName: selectedCollege.trim(),
          startDate: startDate.trim(),
          endDate: endDate.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add drive.');
      }

      setSelectedCollege('');
      setStartDate('');
      setEndDate('');
      await onDrivesChange();
      toast.success('Drive scheduled successfully.');
    } catch (err: any) {
      console.error(err);
      setDriveError(err.message || 'An error occurred scheduled drive.');
    } finally {
      setIsAddingDrive(false);
    }
  };

  const handleSetStatus = async (id: string, status: 'OPEN' | 'CLOSED') => {
    setStatusChangingId(id);
    try {
      const res = await fetch(`/api/drives/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update drive status.');
      }
      await onDrivesChange();
      toast.success(status === 'CLOSED' ? 'Drive closed.' : 'Drive reopened.');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'An error occurred updating drive status.');
    } finally {
      setStatusChangingId(null);
    }
  };

  const handleSetActive = async (id: string) => {
    setSettingActiveId(id);
    try {
      const res = await fetch('/api/drives/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to set active drive.');
      }

      await onDrivesChange();
      toast.success('Active drive updated.');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'An error occurred setting active drive.');
    } finally {
      setSettingActiveId(null);
    }
  };

  const handleDeleteDrive = async (id: string) => {
    try {
      const res = await fetch(`/api/drives/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete drive.');
      }
      await onDrivesChange();
      toast.success('Drive deleted from the schedule.');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'An error occurred deleting drive.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="dashboard-two-column" style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '2rem' }}>
        
        {/* Left: Schedule Drive Form */}
        <div className="glass-card" style={{ height: 'fit-content', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1.25rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarRange size={18} className="text-primary" />
            Schedule New Drive
          </h3>
          
          <form onSubmit={handleAddDrive} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>College Name</label>
              <Select value={selectedCollege} onValueChange={(val) => setSelectedCollege(val || '')}>
                <SelectTrigger className="w-full text-left" style={{ marginTop: '0.5rem', height: '36px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit' }}>
                  <SelectValue placeholder="Select College / Institution..." />
                </SelectTrigger>
                <SelectContent >
                  <SelectItem value="_none_placeholder">Select College / Institution...</SelectItem>
                  {collegesList.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {collegesList.length === 0 && (
                <p className="text-xs text-muted" style={{ marginTop: '0.25rem' }}>
                  No colleges registered. Please add a college in the <strong>Colleges</strong> tab first.
                </p>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Drive Start Date</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                style={{ marginTop: '0.5rem' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Drive End Date</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                required
                style={{ marginTop: '0.5rem' }}
              />
            </div>

            {driveError && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem',
                color: '#f87171',
                fontSize: '0.8rem'
              }}>
                {driveError}
              </div>
            )}
            
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isAddingDrive || !selectedCollege || !startDate || !endDate}
              style={{ width: '100%' }}
            >
              {isAddingDrive ? (
                <><Loader2 size={16} className="animate-spin" style={{ marginRight: '8px' }} /> Scheduling...</>
              ) : (
                'Schedule Drive'
              )}
            </button>
          </form>
        </div>
        
        {/* Right: Scheduled Drives List */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Compass size={18} className="text-primary" />
            Scheduled Recruitment Drives
          </h3>
          <p className="text-muted text-xs" style={{ marginBottom: '1.5rem' }}>
            Choose an <strong>Active Drive</strong> to automatically filter and set default ranges and locations throughout all dashboards.
          </p>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>College Name</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Drive Window</th>
                  <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '0.75rem 1rem', width: '300px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {drives.map((drive) => {
                  const isActive = activeDrive?.id === drive.id;
                  const isClosed = drive.status === 'CLOSED';
                  const fmt = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  return (
                    <tr key={drive.id} style={{ borderBottom: '1px solid var(--border-glass)', transition: 'var(--transition-fast)', opacity: isClosed ? 0.7 : 1 }} className="search-item-hover">
                      <td style={{ padding: '1rem', fontWeight: 500, color: 'var(--text-main)' }}>{drive.collegeName}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                        {drive.startDate === drive.endDate
                          ? fmt(drive.startDate)
                          : `${fmt(drive.startDate)} – ${fmt(drive.endDate)}`}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {isClosed ? (
                          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', width: 'fit-content' }}>
                            <Lock size={10} /> Closed
                          </span>
                        ) : isActive ? (
                          <span className="badge badge-success flex-gap-1" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', width: 'fit-content' }}>
                            <Check size={10} /> Active Drive
                          </span>
                        ) : (
                          <span className="badge badge-pending" style={{ opacity: 0.6 }}>Inactive</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {isClosed ? (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleSetStatus(drive.id, 'OPEN')}
                              disabled={statusChangingId === drive.id}
                              style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              {statusChangingId === drive.id ? <Loader2 size={12} className="animate-spin" /> : <><Unlock size={12} /> Reopen</>}
                            </button>
                          ) : (
                            <>
                              {!isActive && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleSetActive(drive.id)}
                                  disabled={settingActiveId === drive.id}
                                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', height: 'auto' }}
                                >
                                  {settingActiveId === drive.id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    'Set Active'
                                  )}
                                </button>
                              )}

                              <ConfirmDialog
                                trigger={
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={statusChangingId === drive.id}
                                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', height: 'auto', color: '#fbbf24', borderColor: 'rgba(245,158,11,0.3)' }}
                                  />
                                }
                                triggerChildren={statusChangingId === drive.id ? <Loader2 size={12} className="animate-spin" /> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Lock size={12} /> Close Drive</span>}
                                title="Close this drive?"
                                description="Closing marks the drive as completed and removes it as the active drive. You can reopen it later."
                                confirmLabel="Yes, Close"
                                onConfirm={() => handleSetStatus(drive.id, 'CLOSED')}
                              />
                            </>
                          )}

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
                                title="Delete Drive"
                              />
                            }
                            triggerChildren={<Trash2 size={15} />}
                            title="Delete this scheduled drive?"
                            description="This will remove the drive details from the scheduler records."
                            confirmLabel="Yes, Delete"
                            onConfirm={() => handleDeleteDrive(drive.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                
                {drives.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      No recruitment drives scheduled. Add a drive on the left to start.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

