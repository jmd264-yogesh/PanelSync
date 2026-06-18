'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield, Settings, Search, Loader2, Trash2, Info, Clock, Building2, Check
} from 'lucide-react';
import { Panelist, Interview, College, Drive } from '@/lib/db';
import { GraphUser } from '@/lib/graph';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PanelistsTabProps {
  panelists: Panelist[];
  setPanelists: React.Dispatch<React.SetStateAction<Panelist[]>>;
  interviews: Interview[];
  setInterviews: React.Dispatch<React.SetStateAction<Interview[]>>;
  collegesList: College[];
  todayStr: string;
  activeDrive: Drive | null;
}

export default function PanelistsTab({
  panelists,
  setPanelists,
  interviews,
  setInterviews,
  collegesList,
  todayStr,
  activeDrive,
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

  // ── Matching Filters State ────────────────────────────────────────────────
  const [filterCollege, setFilterCollege] = useState(activeDrive ? activeDrive.collegeName : '');
  const [filterDate, setFilterDate] = useState(activeDrive ? activeDrive.startDate : '');

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

  useEffect(() => {
    if (activeDrive) {
      setCollegeName(activeDrive.collegeName);
      setReqCollegeName(activeDrive.collegeName);
      setDefaultStartDate(activeDrive.startDate);
      setDefaultEndDate(activeDrive.endDate);
      setReqStartDate(activeDrive.startDate);
      setReqEndDate(activeDrive.endDate);
      setFilterCollege(activeDrive.collegeName);
      setFilterDate(activeDrive.startDate);
    }
  }, [activeDrive]);

  // Helper to determine if a panelist matches active drive / selected filters
  const isPanelistMatched = React.useCallback((panelistId: string) => {
    if (!filterCollege && !filterDate) return false;

    // Find all interviews this panelist is nominated in
    const panelistInterviews = interviews.filter((i) =>
      i.panels.some((p) => p.userId === panelistId)
    );

    const matchesCollege = !filterCollege || panelistInterviews.some((i) => {
      const parts = i.role.split(' - ');
      const interviewCollege = parts.length > 1 ? parts[1].trim().toLowerCase() : '';
      return interviewCollege === filterCollege.toLowerCase();
    });

    const matchesDate = !filterDate || panelistInterviews.some((i) => {
      if (i.scheduledSlotStart) {
        return i.scheduledSlotStart.split('T')[0] === filterDate;
      }
      const fDate = filterDate;
      const sDate = i.startDate.split('T')[0];
      const eDate = i.endDate.split('T')[0];
      return fDate >= sDate && fDate <= eDate;
    });

    return matchesCollege && matchesDate;
  }, [filterCollege, filterDate, interviews]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredPanelists = panelists.filter(
    (p) =>
      p.displayName.toLowerCase().includes(panelistFilterText.toLowerCase()) ||
      p.email.toLowerCase().includes(panelistFilterText.toLowerCase())
  );

  const matchedPanelistIds = React.useMemo(() => {
    const matched = new Set<string>();
    filteredPanelists.forEach((p) => {
      if (isPanelistMatched(p.id)) {
        matched.add(p.id);
      }
    });
    return matched;
  }, [filteredPanelists, isPanelistMatched]);

  const sortPanelists = React.useCallback((list: Panelist[]) => {
    return [...list].sort((a, b) => {
      const aMatched = matchedPanelistIds.has(a.id);
      const bMatched = matchedPanelistIds.has(b.id);
      if (aMatched && !bMatched) return -1;
      if (!aMatched && bMatched) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [matchedPanelistIds]);

  const l1Panelists = sortPanelists(filteredPanelists.filter((p) => p.roles.includes('L1')));
  const l2Panelists = sortPanelists(filteredPanelists.filter((p) => p.roles.includes('L2')));

  const allL1Selected =
    l1Panelists.length > 0 && l1Panelists.every((p) => bulkSelectedL1Ids.includes(p.id));
  const allL2Selected =
    l2Panelists.length > 0 && l2Panelists.every((p) => bulkSelectedL2Ids.includes(p.id));

  // ── Per-panelist stats helpers ────────────────────────────────────────────
  /** Interviews where panelist has submitted availability (PENDING or COLLECTED — slot provided) */
  const panelistSubmittedCount = (panelistId: string, type?: 'L1' | 'L2') =>
    interviews.filter((i) => {
      if (type && !i.role.toLowerCase().includes(type.toLowerCase())) return false;
      return (
        (i.status === 'PENDING' || i.status === 'COLLECTED' || i.status === 'SCHEDULED') &&
        i.panels.some((p) => p.userId === panelistId && p.status === 'SUBMITTED')
      );
    }).length;

  /** Completed (SCHEDULED) interviews where panelist participated */
  const panelistScheduledCount = (panelistId: string, type?: 'L1' | 'L2') =>
    interviews.filter((i) => {
      if (type && !i.role.toLowerCase().includes(type.toLowerCase())) return false;
      return i.status === 'SCHEDULED' && i.panels.some((p) => p.userId === panelistId);
    }).length;

  /** Interviews awaiting panelist response */
  const panelistPendingCount = (panelistId: string) =>
    interviews.filter(
      (i) =>
        i.status === 'PENDING' &&
        i.panels.some((p) => p.userId === panelistId && p.status === 'PENDING')
    ).length;

  // ── Column summary stats ──────────────────────────────────────────────────
  const l1ScheduledTotal = React.useMemo(() => {
    return interviews.filter((i) => {
      if (i.status !== 'SCHEDULED' || !i.role.toLowerCase().includes('l1')) return false;
      
      const parts = i.role.split(' - ');
      const interviewCollege = parts.length > 1 ? parts[1].trim().toLowerCase() : '';
      if (filterCollege && interviewCollege !== filterCollege.toLowerCase()) return false;
      
      if (filterDate) {
        if (i.scheduledSlotStart) {
          if (i.scheduledSlotStart.split('T')[0] !== filterDate) return false;
        } else {
          const fDate = filterDate;
          const sDate = i.startDate.split('T')[0];
          const eDate = i.endDate.split('T')[0];
          if (fDate < sDate || fDate > eDate) return false;
        }
      }
      return true;
    }).length;
  }, [interviews, filterCollege, filterDate]);

  const l2ScheduledTotal = React.useMemo(() => {
    return interviews.filter((i) => {
      if (i.status !== 'SCHEDULED' || !i.role.toLowerCase().includes('l2')) return false;
      
      const parts = i.role.split(' - ');
      const interviewCollege = parts.length > 1 ? parts[1].trim().toLowerCase() : '';
      if (filterCollege && interviewCollege !== filterCollege.toLowerCase()) return false;
      
      if (filterDate) {
        if (i.scheduledSlotStart) {
          if (i.scheduledSlotStart.split('T')[0] !== filterDate) return false;
        } else {
          const fDate = filterDate;
          const sDate = i.startDate.split('T')[0];
          const eDate = i.endDate.split('T')[0];
          if (fDate < sDate || fDate > eDate) return false;
        }
      }
      return true;
    }).length;
  }, [interviews, filterCollege, filterDate]);

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
          // Allow already-registered panelists in results so their roles can be updated
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
      toast.error('Please select at least one role capability (L1 or L2).');
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
      toast.success('Panelist saved successfully.');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error saving panelist');
    } finally {
      setIsAdminSaving(false);
    }
  };

  const handleDeletePanelist = async (id: string) => {
    try {
      const res = await fetch(`/api/panelists/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPanelists(panelists.filter((p) => p.id !== id));
        toast.success('Panelist removed from the pool.');
      } else {
        toast.error('Failed to remove panelist.');
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
    setReqStartDate(activeDrive ? activeDrive.startDate : defaultStartDate);
    setReqEndDate(activeDrive ? activeDrive.endDate : defaultEndDate);
    setReqCollegeName(activeDrive ? activeDrive.collegeName : collegeName);
  };

  const handleSendSlotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reqPanelists.length === 0) return;
    if (!reqCollegeName || !reqCollegeName.trim()) {
      toast.error('College / Institution name is required.');
      return;
    }
    if (!reqStartDate || !reqEndDate) { toast.error('No drive window available. Set an active drive in the Drives tab.'); return; }
    // Past-date guard only applies to manual entry; active-drive dates are trusted (a multi-day drive may already be underway).
    if (!activeDrive && reqStartDate < todayStr) { toast.error('Start date cannot be in the past.'); return; }
    if (reqEndDate < reqStartDate) { toast.error('End date cannot be before the start date.'); return; }
    const selectedProposedSlots = reqSlots.filter((s) => s.selected);
    if (selectedProposedSlots.length === 0) {
      toast.error('Please select or enable at least one proposed slot option.');
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
      toast.success(`Teams notification sent successfully to ${reqPanelists.map((p) => p.displayName).join(', ')}!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error occurred while sending slot request.');
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
              <Select value={collegeName} onValueChange={(val) => setCollegeName(val || '')}>
                <SelectTrigger className="w-full text-left" style={{ fontSize: '0.85rem', padding: '0.4rem', height: '36px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit' }}>
                  <SelectValue placeholder="Select College..." />
                </SelectTrigger>
                <SelectContent className="dark:bg-[#0e131f] dark:text-white border dark:border-zinc-800">
                  <SelectItem value="_none_placeholder">Select College...</SelectItem>
                  {collegesList.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  {adminSearchResults.map((user) => {
                    const alreadyRegistered = panelists.find((p) => p.id === user.id);
                    return (
                    <div
                      key={user.id}
                      style={{ padding: '0.5rem 1rem', cursor: 'pointer', transition: 'var(--transition-fast)' }}
                      className="search-item-hover"
                      onClick={() => {
                        setAdminSelectedUser(user);
                        setAdminQuery(user.displayName);
                        setAdminSearchResults([]);
                        // Pre-fill existing roles if updating
                        if (alreadyRegistered) setAdminRoles(alreadyRegistered.roles);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user.displayName}</div>
                        {alreadyRegistered && (
                          <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                            {alreadyRegistered.roles.map((r) => (
                              <span key={r} style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: '3px', background: r === 'L1' ? 'rgba(96,165,250,0.15)' : 'rgba(167,139,250,0.15)', border: r === 'L1' ? '1px solid rgba(96,165,250,0.3)' : '1px solid rgba(167,139,250,0.3)', color: r === 'L1' ? '#60a5fa' : '#a78bfa', fontWeight: 700 }}>{r}</span>
                            ))}
                            <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', borderRadius: '3px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981', fontWeight: 600 }}>registered</span>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user.mail || user.userPrincipalName}</div>
                    </div>
                    );
                  })}
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

          {/* Active Drive Matching Filter Controls */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '1.25rem',
            alignItems: 'center',
            flexWrap: 'wrap',
            background: 'rgba(255, 255, 255, 0.01)',
            border: '1px solid var(--border-glass)',
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.8rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="text-muted font-medium">Match College:</span>
              <select
                value={filterCollege}
                onChange={(e) => setFilterCollege(e.target.value)}
                className="form-input text-xs"
                style={{
                  width: '160px',
                  padding: '0.25rem 0.5rem',
                  height: '30px',
                  background: 'rgba(0,0,0,0.2)',
                  color: 'inherit',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <option value="" style={{ background: '#0e131f' }}>All Colleges</option>
                {collegesList.map((c) => (
                  <option key={c.id} value={c.name} style={{ background: '#0e131f' }}>{c.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="text-muted font-medium">Match Date:</span>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="form-input text-xs"
                style={{
                  width: '130px',
                  padding: '0.25rem 0.5rem',
                  height: '30px',
                  background: 'rgba(0,0,0,0.2)',
                  colorScheme: 'dark',
                  color: 'inherit',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-sm)'
                }}
              />
            </div>

            {(filterCollege || filterDate) && (
              <button
                type="button"
                onClick={() => {
                  setFilterCollege(activeDrive ? activeDrive.collegeName : '');
                  setFilterDate(activeDrive ? activeDrive.startDate : '');
                }}
                className="btn btn-secondary btn-xs"
                style={{
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.7rem',
                  height: '30px',
                  border: '1px solid var(--border-glass)',
                  background: 'transparent',
                  marginLeft: 'auto'
                }}
              >
                Reset to Active Drive
              </button>
            )}
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
                {/* L1 Column summary stats */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ flex: 1, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.6rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#60a5fa', lineHeight: 1 }}>{l1Panelists.length}</div>
                    <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total L1</div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.6rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981', lineHeight: 1 }}>{l1ScheduledTotal}</div>
                    <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scheduled</div>
                  </div>
                </div>
                <h4 style={{ fontSize: '0.85rem', color: '#60a5fa', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(96,165,250,0.15)', paddingBottom: '0.4rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={allL1Selected}
                    onChange={handleToggleSelectAllL1}
                    style={{ accentColor: '#60a5fa', cursor: 'pointer' }}
                    title="Select All L1 Panelists"
                  />
                  <span style={{ background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.75rem', color: '#60a5fa', fontWeight: 700 }}>L1</span>
                  Screening Panels ({l1Panelists.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                  {l1Panelists.length === 0 ? (
                    <div className="text-muted text-xs" style={{ padding: '1rem', textAlign: 'center' }}>No L1 panelists registered.</div>
                  ) : (
                    l1Panelists.map((p) => {
                      const isSelected = bulkSelectedL1Ids.includes(p.id);
                      const scheduled = panelistScheduledCount(p.id, 'L1');
                      const submitted = panelistSubmittedCount(p.id, 'L1');
                      const pending = panelistPendingCount(p.id);
                      return (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.65rem',
                            background: isSelected ? 'rgba(96,165,250,0.06)' : 'rgba(255,255,255,0.01)',
                            border: isSelected ? '1px solid rgba(96,165,250,0.35)' : '1px solid var(--border-glass)',
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
                              style={{ accentColor: '#60a5fa', marginTop: '3px', cursor: 'pointer' }}
                            />
                            <div style={{ minWidth: 0, flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.displayName}</div>
                                <div className="text-muted text-xs" style={{ opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
                              </div>
                              {matchedPanelistIds.has(p.id) && (
                                <span style={{ fontSize: '0.55rem', padding: '0.1rem 0.35rem', borderRadius: '3px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontWeight: 700, flexShrink: 0 }} title="Matches search/active drive filters">
                                  Matched
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Per-panelist stats row */}
                          <div style={{ display: 'flex', gap: '0.3rem', marginLeft: '1.5rem' }}>
                            <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem', borderRadius: '3px', background: scheduled > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)', border: scheduled > 0 ? '1px solid rgba(16,185,129,0.25)' : '1px solid var(--border-glass)', color: scheduled > 0 ? '#10b981' : 'var(--text-muted)', fontWeight: 600 }}>
                              ✓ {scheduled} scheduled
                            </span>
                            <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem', borderRadius: '3px', background: submitted > 0 ? 'rgba(96,165,250,0.08)' : 'rgba(255,255,255,0.03)', border: submitted > 0 ? '1px solid rgba(96,165,250,0.2)' : '1px solid var(--border-glass)', color: submitted > 0 ? '#60a5fa' : 'var(--text-muted)', fontWeight: 600 }}>
                              ◎ {submitted} slots given
                            </span>
                            {pending > 0 && (
                              <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem', borderRadius: '3px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', fontWeight: 600 }}>
                                ⏳ {pending} pending
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.1rem' }}>
                            <button
                              onClick={() => handleOpenSlotRequest(p, 'L1')}
                              className="btn btn-primary btn-xs"
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', height: 'auto', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}
                            >
                              Request Slots
                            </button>
                            <ConfirmDialog
                              trigger={
                                <button
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = ''}
                                />
                              }
                              triggerChildren={<Trash2 size={13} />}
                              title="Remove this panelist?"
                              description="This will remove the panelist from the pre-approved pool."
                              confirmLabel="Yes, Remove"
                              onConfirm={() => handleDeletePanelist(p.id)}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* L2 Column */}
              <div>
                {/* L2 Column summary stats */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ flex: 1, background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.6rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>{l2Panelists.length}</div>
                    <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total L2</div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.6rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981', lineHeight: 1 }}>{l2ScheduledTotal}</div>
                    <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scheduled</div>
                  </div>
                </div>
                <h4 style={{ fontSize: '0.85rem', color: '#a78bfa', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(167,139,250,0.15)', paddingBottom: '0.4rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={allL2Selected}
                    onChange={handleToggleSelectAllL2}
                    style={{ accentColor: '#a78bfa', cursor: 'pointer' }}
                    title="Select All L2 Panelists"
                  />
                  <span style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.75rem', color: '#a78bfa', fontWeight: 700 }}>L2</span>
                  System/Mgmt Panels ({l2Panelists.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                  {l2Panelists.length === 0 ? (
                    <div className="text-muted text-xs" style={{ padding: '1rem', textAlign: 'center' }}>No L2 panelists registered.</div>
                  ) : (
                    l2Panelists.map((p) => {
                      const isSelected = bulkSelectedL2Ids.includes(p.id);
                      const scheduled = panelistScheduledCount(p.id, 'L2');
                      const submitted = panelistSubmittedCount(p.id, 'L2');
                      const pending = panelistPendingCount(p.id);
                      return (
                        <div
                          key={p.id}
                          style={{
                            display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.65rem',
                            background: isSelected ? 'rgba(167,139,250,0.06)' : 'rgba(255,255,255,0.01)',
                            border: isSelected ? '1px solid rgba(167,139,250,0.35)' : '1px solid var(--border-glass)',
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
                              style={{ accentColor: '#a78bfa', marginTop: '3px', cursor: 'pointer' }}
                            />
                            <div style={{ minWidth: 0, flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.displayName}</div>
                                <div className="text-muted text-xs" style={{ opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
                              </div>
                              {matchedPanelistIds.has(p.id) && (
                                <span style={{ fontSize: '0.55rem', padding: '0.1rem 0.35rem', borderRadius: '3px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', fontWeight: 700, flexShrink: 0 }} title="Matches search/active drive filters">
                                  Matched
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Per-panelist stats row */}
                          <div style={{ display: 'flex', gap: '0.3rem', marginLeft: '1.5rem' }}>
                            <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem', borderRadius: '3px', background: scheduled > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)', border: scheduled > 0 ? '1px solid rgba(16,185,129,0.25)' : '1px solid var(--border-glass)', color: scheduled > 0 ? '#10b981' : 'var(--text-muted)', fontWeight: 600 }}>
                              ✓ {scheduled} scheduled
                            </span>
                            <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem', borderRadius: '3px', background: submitted > 0 ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.03)', border: submitted > 0 ? '1px solid rgba(167,139,250,0.2)' : '1px solid var(--border-glass)', color: submitted > 0 ? '#a78bfa' : 'var(--text-muted)', fontWeight: 600 }}>
                              ◎ {submitted} slots given
                            </span>
                            {pending > 0 && (
                              <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem', borderRadius: '3px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', fontWeight: 600 }}>
                                ⏳ {pending} pending
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.1rem' }}>
                            <button
                              onClick={() => handleOpenSlotRequest(p, 'L2')}
                              className="btn btn-primary btn-xs"
                              style={{ padding: '0.2rem 0.45rem', fontSize: '0.65rem', height: 'auto', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#c084fc' }}
                            >
                              Request Slots
                            </button>
                            <ConfirmDialog
                              trigger={
                                <button
                                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = ''}
                                />
                              }
                              triggerChildren={<Trash2 size={13} />}
                              title="Remove this panelist?"
                              description="This will remove the panelist from the pre-approved pool."
                              confirmLabel="Yes, Remove"
                              onConfirm={() => handleDeletePanelist(p.id)}
                            />
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
                  <Select value={reqInterviewType} onValueChange={(val) => setReqInterviewType(val as any)}>
                    <SelectTrigger className="w-full text-left" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', height: '38px' }}>
                      <SelectValue placeholder="Select Stage" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-[#0e131f] dark:text-white border dark:border-zinc-800">
                      <SelectItem value="L1">L1 Interview</SelectItem>
                      <SelectItem value="L2">L2 Interview</SelectItem>
                      <SelectItem value="General">General / Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-group">
                  <label className="form-label">Duration</label>
                  <Select value={reqDuration} onValueChange={(val) => setReqDuration(val || '')}>
                    <SelectTrigger className="w-full text-left" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', height: '38px' }}>
                      <SelectValue placeholder="Select Duration" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-[#0e131f] dark:text-white border dark:border-zinc-800">
                      <SelectItem value="30">30 mins</SelectItem>
                      <SelectItem value="45">45 mins</SelectItem>
                      <SelectItem value="60">60 mins</SelectItem>
                      <SelectItem value="90">90 mins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {activeDrive ? (
                <div className="form-group">
                  <label className="form-label">Drive Window &amp; Location (from Active Drive)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.85rem', fontSize: '0.8rem' }}>
                    <Building2 size={14} style={{ color: 'var(--primary)' }} />
                    <strong>{activeDrive.collegeName}</strong>
                    <span className="text-muted">·</span>
                    <Clock size={13} style={{ color: 'var(--text-muted)' }} />
                    <span>
                      {activeDrive.startDate === activeDrive.endDate
                        ? new Date(activeDrive.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : `${new Date(activeDrive.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(activeDrive.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </span>
                  </div>
                  <p className="text-xs text-muted" style={{ marginTop: '0.4rem' }}>
                    Slots are generated across the active drive window. Change it in the <strong>Drives</strong> tab.
                  </p>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">College / Institution</label>
                  <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.85rem', color: '#fbbf24', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
                    No active drive selected. Set an active drive in the <strong>Drives</strong> tab so the slot window and college are picked automatically. Falling back to a default date range below.
                  </div>
                  <Select value={reqCollegeName} onValueChange={(val) => setReqCollegeName(val || '')}>
                    <SelectTrigger className="w-full text-left" style={{ height: '36px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit' }}>
                      <SelectValue placeholder="Select College..." />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-[#0e131f] dark:text-white border dark:border-zinc-800">
                      <SelectItem value="_none_placeholder">Select College...</SelectItem>
                      {collegesList.map((c) => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="grid-2" style={{ marginTop: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Proposed Range Start</label>
                      <input type="date" className="form-input" value={reqStartDate} min={todayStr} onChange={(e) => setReqStartDate(e.target.value)} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Proposed Range End</label>
                      <input type="date" className="form-input" value={reqEndDate} min={reqStartDate || todayStr} onChange={(e) => setReqEndDate(e.target.value)} required />
                    </div>
                  </div>
                </div>
              )}

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
                            {start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} @ {start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} (IST)
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
                    Proposed Interview Date Range: <strong>{new Date(reqStartDate || todayStr).toLocaleDateString('en-US')} - {new Date(reqEndDate || todayStr).toLocaleDateString('en-US')}</strong>
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '0.8rem' }}>Please select one of the following proposed slots to book instantly:</p>
                  <div style={{ margin: '8px 0', paddingLeft: '1rem', color: 'var(--text-main)', fontSize: '0.75rem' }}>
                    {reqSlots.filter((s) => s.selected).slice(0, 6).map((s, i) => {
                      const d = new Date(s.startTime);
                      return <div key={i}>• {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} @ {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} (IST)</div>;
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

