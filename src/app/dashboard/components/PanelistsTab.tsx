'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield, Settings, Search, Loader2, Trash2, Info, Clock, Building2, Check
} from 'lucide-react';
import { Panelist, Interview, College } from '@/lib/db';
import { GraphUser } from '@/lib/graph';

interface PanelistsTabProps {
  panelists: Panelist[];
  setPanelists: React.Dispatch<React.SetStateAction<Panelist[]>>;
  interviews: Interview[];
  setInterviews: React.Dispatch<React.SetStateAction<Interview[]>>;
  collegesList: College[];
  todayStr: string;
}

export default function PanelistsTab({
  panelists,
  setPanelists,
  interviews,
  setInterviews,
  collegesList,
  todayStr,
}: PanelistsTabProps) {
  // ── Scheduler Defaults ───────────────────────────────────────────────────
  const [l1TimeStart, setL1TimeStart] = useState('10:00');
  const [l1TimeEnd, setL1TimeEnd] = useState('13:00');
  const [l2TimeStart, setL2TimeStart] = useState('14:00');
  const [l2TimeEnd, setL2TimeEnd] = useState('17:00');
  const [collegeName, setCollegeName] = useState('');

  const getDefaultDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };
  const [defaultStartDate, setDefaultStartDate] = useState(getDefaultDate);
  const [defaultEndDate, setDefaultEndDate] = useState(getDefaultDate);

  // ── Admin panelist registration ──────────────────────────────────────────
  const [adminQuery, setAdminQuery] = useState('');
  const [adminSearchResults, setAdminSearchResults] = useState<GraphUser[]>([]);
  const [isAdminSearching, setIsAdminSearching] = useState(false);
  const [adminSelectedUser, setAdminSelectedUser] = useState<GraphUser | null>(null);
  const [adminRoles, setAdminRoles] = useState<('L1' | 'L2')[]>(['L1']);
  const [isAdminSaving, setIsAdminSaving] = useState(false);
  const [panelistFilterText, setPanelistFilterText] = useState('');

  // ── Bulk selection ────────────────────────────────────────────────────────
  const [bulkSelectedL1Ids, setBulkSelectedL1Ids] = useState<string[]>([]);
  const [bulkSelectedL2Ids, setBulkSelectedL2Ids] = useState<string[]>([]);

  // ── Slot request overlay modal ────────────────────────────────────────────
  const [reqPanelists, setReqPanelists] = useState<Panelist[]>([]);
  const [reqDuration, setReqDuration] = useState('30');
  const [reqStartDate, setReqStartDate] = useState('');
  const [reqEndDate, setReqEndDate] = useState('');
  const [reqInterviewType, setReqInterviewType] = useState<'L1' | 'L2' | 'General'>('L1');
  const [reqSlots, setReqSlots] = useState<{ startTime: string; endTime: string; selected: boolean }[]>([]);
  const [reqCollegeName, setReqCollegeName] = useState('');
  const [isRequestingSlot, setIsRequestingSlot] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredPanelists = panelists.filter(
    (p) =>
      p.displayName.toLowerCase().includes(panelistFilterText.toLowerCase()) ||
      p.email.toLowerCase().includes(panelistFilterText.toLowerCase())
  );
  const l1Panelists = filteredPanelists.filter((p) => p.roles.includes('L1'));
  const l2Panelists = filteredPanelists.filter((p) => p.roles.includes('L2'));

  const allL1Selected =
    l1Panelists.length > 0 && l1Panelists.every((p) => bulkSelectedL1Ids.includes(p.id));
  const allL2Selected =
    l2Panelists.length > 0 && l2Panelists.every((p) => bulkSelectedL2Ids.includes(p.id));

  // ── Active interview count per panelist ───────────────────────────────────
  const activePanelistInterviewCount = (panelistId: string) =>
    interviews.filter(
      (i) =>
        (i.status === 'PENDING' || i.status === 'COLLECTED') &&
        i.panels.some((p) => p.userId === panelistId)
    ).length;

  // ── Debounced admin Entra directory search ────────────────────────────────
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
          const filtered = data.filter(
            (u: GraphUser) => !panelists.some((p) => p.id === u.id)
          );
          setAdminSearchResults(filtered);
        }
      } catch (err) {
        console.error('Error in admin search:', err);
      } finally {
        setIsAdminSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [adminQuery, panelists]);

  // ── Auto-generate proposed slots when modal is open ───────────────────────
  useEffect(() => {
    if (reqPanelists.length > 0 && reqStartDate && reqEndDate) {
      const timingStart = reqInterviewType === 'L1' ? l1TimeStart : l2TimeStart;
      const timingEnd = reqInterviewType === 'L1' ? l1TimeEnd : l2TimeEnd;
      const [startH, startM] = timingStart.split(':').map(Number);
      const [endH, endM] = timingEnd.split(':').map(Number);

      const generated: { startTime: string; endTime: string; selected: boolean }[] = [];
      const currentDay = new Date(reqStartDate);
      const endDay = new Date(reqEndDate);

      while (currentDay <= endDay) {
        const year = currentDay.getFullYear();
        const month = currentDay.getMonth();
        const date = currentDay.getDate();
        const dayStart = new Date(year, month, date, startH, startM, 0);
        const dayEnd = new Date(year, month, date, endH, endM, 0);
        let time = dayStart.getTime();
        const stepMs = 30 * 60 * 1000;
        while (time + stepMs <= dayEnd.getTime()) {
          generated.push({
            startTime: new Date(time).toISOString(),
            endTime: new Date(time + stepMs).toISOString(),
            selected: true,
          });
          time += stepMs;
        }
        currentDay.setDate(currentDay.getDate() + 1);
      }
      setReqSlots(generated);
    } else {
      setReqSlots([]);
    }
  }, [reqPanelists, reqStartDate, reqEndDate, reqInterviewType, l1TimeStart, l1TimeEnd, l2TimeStart, l2TimeEnd]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddPanelist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminSelectedUser) return;
    if (adminRoles.length === 0) {
      alert('Please select at least one role capability (L1 or L2).');
      return;
    }
    setIsAdminSaving(true);
    try {
      const res = await fetch('/api/panelists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: {
            id: adminSelectedUser.id,
            displayName: adminSelectedUser.displayName,
            email: adminSelectedUser.mail || adminSelectedUser.userPrincipalName,
          },
          roles: adminRoles,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save panelist.');
      }
      const newPanelist = await res.json();
      const existsIdx = panelists.findIndex((p) => p.id === newPanelist.id);
      if (existsIdx !== -1) {
        const updated = [...panelists];
        updated[existsIdx] = newPanelist;
        setPanelists(updated);
      } else {
        setPanelists([...panelists, newPanelist]);
      }
      setAdminSelectedUser(null);
      setAdminQuery('');
      setAdminRoles(['L1']);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error saving panelist');
    } finally {
      setIsAdminSaving(false);
    }
  };

  const handleDeletePanelist = async (id: string) => {
    if (!confirm('Are you sure you want to remove this panelist from the pre-approved pool?')) return;
    try {
      const res = await fetch(`/api/panelists/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPanelists(panelists.filter((p) => p.id !== id));
      } else {
        alert('Failed to remove panelist.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleSelectAllL1 = () => {
    if (allL1Selected) {
      setBulkSelectedL1Ids(bulkSelectedL1Ids.filter((id) => !l1Panelists.some((p) => p.id === id)));
    } else {
      const newIds = [...bulkSelectedL1Ids];
      l1Panelists.forEach((p) => { if (!newIds.includes(p.id)) newIds.push(p.id); });
      setBulkSelectedL1Ids(newIds);
    }
  };

  const handleToggleSelectAllL2 = () => {
    if (allL2Selected) {
      setBulkSelectedL2Ids(bulkSelectedL2Ids.filter((id) => !l2Panelists.some((p) => p.id === id)));
    } else {
      const newIds = [...bulkSelectedL2Ids];
      l2Panelists.forEach((p) => { if (!newIds.includes(p.id)) newIds.push(p.id); });
      setBulkSelectedL2Ids(newIds);
    }
  };

  const handleOpenSlotRequest = (p: Panelist | Panelist[], stage: 'L1' | 'L2') => {
    const arr = Array.isArray(p) ? p : [p];
    setReqPanelists(arr);
    setReqInterviewType(stage);
    setReqDuration('30');
    setReqStartDate(defaultStartDate);
    setReqEndDate(defaultEndDate);
    setReqCollegeName(collegeName);
  };

  const handleSendSlotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reqPanelists.length === 0) return;
    if (!reqCollegeName || !reqCollegeName.trim()) {
      alert('College / Institution name is required.');
      return;
    }
    if (reqStartDate < todayStr) { alert('Start date cannot be in the past.'); return; }
    if (reqEndDate < reqStartDate) { alert('End date cannot be before the start date.'); return; }
    const selectedProposedSlots = reqSlots.filter((s) => s.selected);
    if (selectedProposedSlots.length === 0) {
      alert('Please select or enable at least one proposed slot option.');
      return;
    }
    setIsRequestingSlot(true);
    try {
      const res = await fetch('/api/interviews/request-panelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          panelists: reqPanelists,
          duration: reqDuration,
          startDate: reqStartDate,
          endDate: reqEndDate,
          interviewType: reqInterviewType,
          slots: selectedProposedSlots.map((s) => ({ startTime: s.startTime, endTime: s.endTime })),
          collegeName: reqCollegeName,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to dispatch slot request.');
      }
      const result = await res.json();
      setInterviews([result.interview, ...interviews]);
      setReqPanelists([]);
      setBulkSelectedL1Ids([]);
      setBulkSelectedL2Ids([]);
      alert(`Teams notification sent successfully to ${reqPanelists.map((p) => p.displayName).join(', ')}!`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error occurred while sending slot request.');
    } finally {
      setIsRequestingSlot(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* Interview Scheduler Defaults Card */}
      <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={18} className="text-primary" /> Interview Scheduler Defaults
        </h3>
        <p className="text-muted text-xs" style={{ marginBottom: '1.25rem' }}>
          Configure the default daily time windows, proposed date range, and college/institution name used when auto-generating interview slot proposals.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1.25rem' }}>

          {/* L1 timing */}
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: '#60a5fa', fontWeight: 600 }}>L1 Timing Period (Technical Screening)</h4>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>Start Time</label>
                <input type="time" className="form-input" style={{ fontSize: '0.85rem', padding: '0.4rem' }} value={l1TimeStart} onChange={(e) => setL1TimeStart(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>End Time</label>
                <input type="time" className="form-input" style={{ fontSize: '0.85rem', padding: '0.4rem' }} value={l1TimeEnd} onChange={(e) => setL1TimeEnd(e.target.value)} />
              </div>
            </div>
          </div>

          {/* L2 timing */}
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: '#a78bfa', fontWeight: 600 }}>L2 Timing Period (System Design/Management)</h4>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>Start Time</label>
                <input type="time" className="form-input" style={{ fontSize: '0.85rem', padding: '0.4rem' }} value={l2TimeStart} onChange={(e) => setL2TimeStart(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>End Time</label>
                <input type="time" className="form-input" style={{ fontSize: '0.85rem', padding: '0.4rem' }} value={l2TimeEnd} onChange={(e) => setL2TimeEnd(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Date Range */}
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: '#34d399', fontWeight: 600 }}>Default Proposed Date Range</h4>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>Start Date</label>
                <input type="date" className="form-input" style={{ fontSize: '0.85rem', padding: '0.4rem' }} value={defaultStartDate} min={todayStr} onChange={(e) => setDefaultStartDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.7rem' }}>End Date</label>
                <input type="date" className="form-input" style={{ fontSize: '0.85rem', padding: '0.4rem' }} value={defaultEndDate} min={defaultStartDate || todayStr} onChange={(e) => setDefaultEndDate(e.target.value)} />
              </div>
            </div>
          </div>

          {/* College Default */}
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: '#fb923c', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Building2 size={14} /> College / Institution
            </h4>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.7rem' }}>College Name</label>
              <select
                className="form-input"
                style={{ fontSize: '0.85rem', padding: '0.4rem', height: '36px' }}
                value={collegeName}
                onChange={(e) => setCollegeName(e.target.value)}
              >
                <option value="">Select College...</option>
                {collegesList.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <p className="text-muted" style={{ fontSize: '0.65rem', marginTop: '0.5rem', lineHeight: 1.4 }}>
              Default institution shown in slot request messages.
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>

        {/* Left: Register new panelist */}
        <div className="glass-card" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1.25rem' }} className="flex-gap-2">
            <Shield size={18} className="text-primary" /> Register New Panelist
          </h3>
          <form onSubmit={handleAddPanelist}>
            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Search Colleague (Directory)</label>
              <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                <Search size={14} className="text-muted" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2.25rem' }}
                  value={adminQuery}
                  onChange={(e) => {
                    setAdminQuery(e.target.value);
                    if (adminSelectedUser) setAdminSelectedUser(null);
                  }}
                  placeholder="Type name or email..."
                />
                {isAdminSearching && (
                  <Loader2 size={14} className="animate-spin text-muted" style={{ position: 'absolute', right: '12px' }} />
                )}
              </div>
              {adminSearchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  background: 'var(--bg-surface)', border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-md)', boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
                  marginTop: '4px', maxHeight: '180px', overflowY: 'auto'
                }}>
                  {adminSearchResults.map((user) => (
                    <div
                      key={user.id}
                      style={{ padding: '0.5rem 1rem', cursor: 'pointer', transition: 'var(--transition-fast)' }}
                      className="search-item-hover"
                      onClick={() => {
                        setAdminSelectedUser(user);
                        setAdminQuery(user.displayName);
                        setAdminSearchResults([]);
                      }}
                    >
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user.displayName}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user.mail || user.userPrincipalName}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {adminSelectedUser && (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', marginBottom: '1.25rem' }}>
                <div className="text-muted text-xs">Selected Colleague</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{adminSelectedUser.displayName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{adminSelectedUser.mail || adminSelectedUser.userPrincipalName}</div>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Interview Capability Levels</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={adminRoles.includes('L1')}
                    onChange={(e) => {
                      if (e.target.checked) setAdminRoles([...adminRoles, 'L1']);
                      else setAdminRoles(adminRoles.filter((r) => r !== 'L1'));
                    }}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  L1 Panelist (Technical Screening/Coding)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={adminRoles.includes('L2')}
                    onChange={(e) => {
                      if (e.target.checked) setAdminRoles([...adminRoles, 'L2']);
                      else setAdminRoles(adminRoles.filter((r) => r !== 'L2'));
                    }}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  L2 Panelist (System Design/Management)
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={!adminSelectedUser || adminRoles.length === 0 || isAdminSaving}
            >
              {isAdminSaving ? (
                <><Loader2 size={16} className="animate-spin" /> Saving...</>
              ) : (
                'Register Panelist'
              )}
            </button>
          </form>
        </div>

        {/* Right: Panelists Split Directories */}
        <div className="glass-card">
          <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.2rem' }} className="flex-gap-2">
              <Settings size={18} className="text-muted" /> Panelist Pool Directories
            </h3>
            <div style={{ position: 'relative', width: '200px' }}>
              <Search size={12} className="text-muted" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '2rem', paddingRight: '0.5rem', paddingTop: '0.4rem', paddingBottom: '0.4rem', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)' }}
                value={panelistFilterText}
                onChange={(e) => setPanelistFilterText(e.target.value)}
                placeholder="Filter panelists..."
              />
            </div>
          </div>

          {filteredPanelists.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', border: '1px dashed var(--border-glass)', borderRadius: 'var(--radius-md)' }}>
              <Info size={32} className="text-muted animate-pulse" style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>No Panelists Registered</div>
              <p className="text-muted text-xs">Search your tenant directory and register panelists with their L1/L2 capability levels on the left.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

              {/* L1 Column */}
              <div>
                <h4 style={{ fontSize: '0.85rem', color: '#60a5fa', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.4rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={allL1Selected}
                    onChange={handleToggleSelectAllL1}
                    style={{ accentColor: '#60a5fa', cursor: 'pointer' }}
                    title="Select All L1 Panelists"
                  />
                  L1 Screening Panels ({l1Panelists.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                  {l1Panelists.length === 0 ? (
                    <div className="text-muted text-xs" style={{ padding: '1rem', textAlign: 'center' }}>No L1 panelists registered.</div>
                  ) : (
                    l1Panelists.map((p) => {
                      const isSelected = bulkSelectedL1Ids.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem',
                            background: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                            border: isSelected ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid var(--border-glass)',
                            borderRadius: 'var(--radius-md)', transition: 'var(--transition-fast)'
                          }}
                        >
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                if (isSelected) setBulkSelectedL1Ids(bulkSelectedL1Ids.filter((id) => id !== p.id));
                                else setBulkSelectedL1Ids([...bulkSelectedL1Ids, p.id]);
                              }}
                              style={{ accentColor: 'var(--primary)', marginTop: '3px', cursor: 'pointer' }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.displayName}</div>
                              <div className="text-muted text-xs" style={{ wordBreak: 'break-all', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                            <button
                              onClick={() => handleOpenSlotRequest(p, 'L1')}
                              className="btn btn-primary btn-xs"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', height: 'auto', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa' }}
                            >
                              Send Request
                            </button>
                            <button
                              onClick={() => handleDeletePanelist(p.id)}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={(e) => e.currentTarget.style.color = ''}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* L2 Column */}
              <div>
                <h4 style={{ fontSize: '0.85rem', color: '#a78bfa', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.4rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={allL2Selected}
                    onChange={handleToggleSelectAllL2}
                    style={{ accentColor: '#a78bfa', cursor: 'pointer' }}
                    title="Select All L2 Panelists"
                  />
                  L2 System/Mgmt Panels ({l2Panelists.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                  {l2Panelists.length === 0 ? (
                    <div className="text-muted text-xs" style={{ padding: '1rem', textAlign: 'center' }}>No L2 panelists registered.</div>
                  ) : (
                    l2Panelists.map((p) => {
                      const isSelected = bulkSelectedL2Ids.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem',
                            background: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                            border: isSelected ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid var(--border-glass)',
                            borderRadius: 'var(--radius-md)', transition: 'var(--transition-fast)'
                          }}
                        >
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                if (isSelected) setBulkSelectedL2Ids(bulkSelectedL2Ids.filter((id) => id !== p.id));
                                else setBulkSelectedL2Ids([...bulkSelectedL2Ids, p.id]);
                              }}
                              style={{ accentColor: 'var(--primary)', marginTop: '3px', cursor: 'pointer' }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.displayName}</div>
                              <div className="text-muted text-xs" style={{ wordBreak: 'break-all', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                            <button
                              onClick={() => handleOpenSlotRequest(p, 'L2')}
                              className="btn btn-primary btn-xs"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', height: 'auto', background: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#c084fc' }}
                            >
                              Send Request
                            </button>
                            <button
                              onClick={() => handleDeletePanelist(p.id)}
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={(e) => e.currentTarget.style.color = ''}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Floating Bulk Action Bar */}
          {(bulkSelectedL1Ids.length > 0 || bulkSelectedL2Ids.length > 0) && (
            <div style={{
              position: 'sticky', bottom: '1rem',
              background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
              zIndex: 90, marginTop: '1.5rem'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                <span className="text-primary" style={{ marginRight: '4px' }}>{bulkSelectedL1Ids.length + bulkSelectedL2Ids.length}</span> Panelists Selected
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => {
                    const selectedPanelists = panelists.filter((p) => bulkSelectedL1Ids.includes(p.id));
                    handleOpenSlotRequest(selectedPanelists, 'L1');
                  }}
                  className="btn btn-primary btn-sm"
                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', height: 'auto', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#60a5fa' }}
                  disabled={bulkSelectedL1Ids.length === 0}
                >
                  Request L1 Slots
                </button>
                <button
                  onClick={() => {
                    const selectedPanelists = panelists.filter((p) => bulkSelectedL2Ids.includes(p.id));
                    handleOpenSlotRequest(selectedPanelists, 'L2');
                  }}
                  className="btn btn-primary btn-sm"
                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', height: 'auto', background: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.4)', color: '#c084fc' }}
                  disabled={bulkSelectedL2Ids.length === 0}
                >
                  Request L2 Slots
                </button>
                <button
                  onClick={() => { setBulkSelectedL1Ids([]); setBulkSelectedL2Ids([]); }}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', height: 'auto', border: '1px solid var(--border-glass)', background: 'transparent' }}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Request Slot Overlay Modal */}
      {reqPanelists.length > 0 && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
          zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'
        }}>
          <div className="glass-card animate-pulse-once" style={{ maxWidth: '520px', width: '100%', padding: '2rem', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-glass)' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
              Request Slots from {reqPanelists.length === 1 ? reqPanelists[0].displayName : `${reqPanelists.length} Panelists`}
            </h3>

            {reqPanelists.length > 1 && (
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem 0.75rem', borderRadius: '4px', border: '1px solid var(--border-glass)', marginBottom: '1rem', fontSize: '0.75rem' }}>
                <span className="text-muted block font-semibold" style={{ marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invited Panel Members:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                  {reqPanelists.map((p) => (
                    <span key={p.id} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>
                      {p.displayName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSendSlotRequest}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Interview Stage</label>
                  <select className="form-input" value={reqInterviewType} onChange={(e) => setReqInterviewType(e.target.value as any)}>
                    <option value="L1">L1 Interview</option>
                    <option value="L2">L2 Interview</option>
                    <option value="General">General / Custom</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Duration</label>
                  <select className="form-input" value={reqDuration} onChange={(e) => setReqDuration(e.target.value)}>
                    <option value="30">30 mins</option>
                    <option value="45">45 mins</option>
                    <option value="60">60 mins</option>
                    <option value="90">90 mins</option>
                  </select>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Proposed Range Start</label>
                  <input type="date" className="form-input" value={reqStartDate} min={todayStr} onChange={(e) => setReqStartDate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Proposed Range End</label>
                  <input type="date" className="form-input" value={reqEndDate} min={reqStartDate || todayStr} onChange={(e) => setReqEndDate(e.target.value)} required />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">College / Institution</label>
                <select className="form-input" style={{ height: '36px' }} value={reqCollegeName} onChange={(e) => setReqCollegeName(e.target.value)} required>
                  <option value="">Select College...</option>
                  {collegesList.map((c) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Proposed Slots Builder */}
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--text-main)', fontWeight: 600 }}>Proposed Slot Options Checklist</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {reqSlots.length === 0 ? (
                    <span className="text-muted text-xs block text-center" style={{ padding: '0.5rem 0' }}>No proposed slot options added yet. Select range start/end.</span>
                  ) : (
                    reqSlots.map((s, idx) => {
                      const start = new Date(s.startTime);
                      const end = new Date(s.endTime);
                      return (
                        <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.75rem' }}>
                          <input
                            type="checkbox"
                            checked={s.selected}
                            onChange={(e) => {
                              const updated = [...reqSlots];
                              updated[idx].selected = e.target.checked;
                              setReqSlots(updated);
                            }}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          <span>
                            {start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} @ {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (UTC)
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Teams Message Preview */}
              <div style={{ background: '#090d16', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', marginBottom: '1.5rem' }}>
                <span className="text-muted text-xs block font-semibold" style={{ marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Teams Message Preview Card</span>
                <div style={{ borderLeft: '4px solid var(--primary)', paddingLeft: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '0.25rem' }}>Interview Slot Request</div>
                  <p style={{ margin: '4px 0', fontSize: '0.8rem' }}>Hello <strong>{reqPanelists.length === 1 ? reqPanelists[0].displayName : '[Panelist Name]'}</strong>,</p>
                  <p style={{ margin: '4px 0', fontSize: '0.8rem' }}>
                    You have been requested to conduct an <strong>{reqInterviewType} Interview</strong>{reqCollegeName ? <span> for <strong>{reqCollegeName}</strong></span> : ''}.
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '0.8rem' }}>
                    Proposed Interview Date Range: <strong>{new Date(reqStartDate || todayStr).toLocaleDateString()} - {new Date(reqEndDate || todayStr).toLocaleDateString()}</strong>
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '0.8rem' }}>Please select one of the following proposed slots to book instantly:</p>
                  <div style={{ margin: '8px 0', paddingLeft: '1rem', color: 'var(--text-main)', fontSize: '0.75rem' }}>
                    {reqSlots.filter((s) => s.selected).slice(0, 6).map((s, i) => {
                      const d = new Date(s.startTime);
                      return <div key={i}>• {d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} @ {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (UTC)</div>;
                    })}
                    {reqSlots.filter((s) => s.selected).length > 6 && <div>• and {reqSlots.filter((s) => s.selected).length - 6} more slots...</div>}
                    {reqSlots.filter((s) => s.selected).length === 0 && <div style={{ fontStyle: 'italic', color: 'var(--danger)' }}>No slots selected! Please enable at least one slot.</div>}
                  </div>
                  <div style={{ marginTop: '0.75rem', background: 'var(--primary)', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '4px', display: 'inline-block', fontSize: '0.75rem', fontWeight: 600 }}>Select Slot Option</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setReqPanelists([])}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={reqSlots.filter((s) => s.selected).length === 0 || isRequestingSlot}
                >
                  {isRequestingSlot ? <Loader2 size={16} className="animate-spin" /> : 'Send Slot Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
