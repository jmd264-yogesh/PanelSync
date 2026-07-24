'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield, Settings, Search, Loader2, Trash2, Info, Clock, Building2, Check, Download, Upload
} from 'lucide-react';
import { Panelist, Interview, College, Drive } from '@server/lib/db';
import { GraphUser } from '@server/lib/graph';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/common/components/ConfirmDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/common/components/ui/select';

interface PanelistsTabProps {
  panelists: Panelist[];
  setPanelists: React.Dispatch<React.SetStateAction<Panelist[]>>;
  interviews: Interview[];
  setInterviews: React.Dispatch<React.SetStateAction<Interview[]>>;
  collegesList: College[];
  todayStr: string;
  activeDrive: Drive | null;
}

export const PanelistsTab = ({
  panelists,
  setPanelists,
  interviews,
  setInterviews,
  collegesList,
  todayStr,
  activeDrive,
}: PanelistsTabProps) => {
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

  // Load scheduler defaults from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedL1Start = localStorage.getItem('ps_l1TimeStart');
      const storedL1End = localStorage.getItem('ps_l1TimeEnd');
      const storedL2Start = localStorage.getItem('ps_l2TimeStart');
      const storedL2End = localStorage.getItem('ps_l2TimeEnd');
      const storedCollege = localStorage.getItem('ps_collegeName');

      if (storedL1Start) setL1TimeStart(storedL1Start);
      if (storedL1End) setL1TimeEnd(storedL1End);
      if (storedL2Start) setL2TimeStart(storedL2Start);
      if (storedL2End) setL2TimeEnd(storedL2End);
      if (storedCollege) setCollegeName(storedCollege);
    }
  }, []);

  const saveSchedulerDefaults = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ps_l1TimeStart', l1TimeStart);
      localStorage.setItem('ps_l1TimeEnd', l1TimeEnd);
      localStorage.setItem('ps_l2TimeStart', l2TimeStart);
      localStorage.setItem('ps_l2TimeEnd', l2TimeEnd);
      localStorage.setItem('ps_collegeName', collegeName);
      toast.success('Scheduler defaults saved successfully!');
    }
  };

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

  // ── Interactive Stats Card Filter State ──────────────────────────────────
  const [statFilter, setStatFilter] = useState<'all' | 'l1' | 'l1-scheduled' | 'l2' | 'l2-scheduled'>('all');
  const [activeRoleTab, setActiveRoleTab] = useState<'L1' | 'L2'>('L1');

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

  // ── Filtered L1 & L2 lists based on active stats filter card selection ────
  const l1Panelists = sortPanelists(filteredPanelists.filter((p) => p.roles.includes('L1'))).filter((p) => {
    if (statFilter === 'l2' || statFilter === 'l2-scheduled') return false;
    if (statFilter === 'l1-scheduled') return panelistScheduledCount(p.id, 'L1') > 0;
    return true;
  });

  const l2Panelists = sortPanelists(filteredPanelists.filter((p) => p.roles.includes('L2'))).filter((p) => {
    if (statFilter === 'l1' || statFilter === 'l1-scheduled') return false;
    if (statFilter === 'l2-scheduled') return panelistScheduledCount(p.id, 'L2') > 0;
    return true;
  });

  const allL1Selected =
    l1Panelists.length > 0 && l1Panelists.every((p) => bulkSelectedL1Ids.includes(p.id));
  const allL2Selected =
    l2Panelists.length > 0 && l2Panelists.every((p) => bulkSelectedL2Ids.includes(p.id));

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
          candidateName: 'Pending Assignment',
          candidateEmail: 'pending@assignement.com',
          hiringType: 'CAMPUS',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to dispatch slot request.');
      }
      const result = await res.json();
      
      // Update local state handles bulk-created interviews returned by endpoint (one per selected panelist)
      if (result.interviews) {
        setInterviews([...result.interviews, ...interviews]);
      } else if (result.interview) {
        setInterviews([result.interview, ...interviews]);
      }

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

  // Helper to extract initials for custom panelist card avatar representation
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="panelists-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Panelists</h1>
          <p className="page-subtitle">
            Manage interview panelists, capability levels, slot requests, and scheduling availability.
          </p>
        </div>

        <div className="page-actions">
          <button className="btn btn-sm btn-secondary" onClick={() => toast.info('Import panelists functionality is placeholder-only')}>
            <Upload size={14} /> Import
          </button>
          <button className="btn btn-sm btn-secondary" onClick={() => toast.info('Export directory functionality is placeholder-only')}>
            <Download size={14} /> Export
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
              const el = document.getElementById('search-colleague-input');
              if (el) {
                el.focus();
                el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            Add Panelist
          </button>
        </div>
      </header>

      {/* Compact Settings Card for Scheduler Defaults */}
      <section className="scheduler-card">
        <div className="section-heading-row">
          <div>
            <h2 className="section-title">
              <Clock size={16} /> Scheduler Defaults
            </h2>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={saveSchedulerDefaults}>
            Save
          </button>
        </div>

        <div className="scheduler-grid neutral">
          {/* L1 timing window settings group */}
          <div className="scheduler-group">
            <div className="scheduler-group-title">L1 Timing</div>
            <div className="scheduler-field-row">
              <label>
                <input
                  type="time"
                  className="input-control"
                  value={l1TimeStart}
                  onChange={(e) => setL1TimeStart(e.target.value)}
                />
              </label>
              <label>
                <input
                  type="time"
                  className="input-control"
                  value={l1TimeEnd}
                  onChange={(e) => setL1TimeEnd(e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* L2 timing window settings group */}
          <div className="scheduler-group">
            <div className="scheduler-group-title">L2 Timing</div>
            <div className="scheduler-field-row">
              <label>
                <input
                  type="time"
                  className="input-control"
                  value={l2TimeStart}
                  onChange={(e) => setL2TimeStart(e.target.value)}
                />
              </label>
              <label>
                <input
                  type="time"
                  className="input-control"
                  value={l2TimeEnd}
                  onChange={(e) => setL2TimeEnd(e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* Date range settings group */}
          <div className="scheduler-group">
            <div className="scheduler-group-title">Date Range</div>
            <div className="scheduler-field-row">
              <label>
                <input
                  type="date"
                  className="input-control"
                  value={defaultStartDate}
                  min={todayStr}
                  onChange={(e) => setDefaultStartDate(e.target.value)}
                />
              </label>
              <label>
                <input
                  type="date"
                  className="input-control"
                  value={defaultEndDate}
                  min={defaultStartDate || todayStr}
                  onChange={(e) => setDefaultEndDate(e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* Institution details settings group */}
          <div className="scheduler-group">
            <div className="scheduler-group-title">Institution</div>
            <label>
              <Select value={collegeName} onValueChange={(val) => setCollegeName(val || '')}>
                <SelectTrigger className="select-control">
                  <SelectValue placeholder="College..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_placeholder">Select...</SelectItem>
                  {collegesList.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
        </div>
      </section>

      {/* Main refactored two-column workspace */}
      <section className="panelists-content-grid">
        
        {/* Left column card: Register New Panelist */}
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
              <label className="field-label" htmlFor="search-colleague-input">Search Colleague (Directory)</label>
              <div className="search-field">
                <span className="search-icon"><Search size={15} /></span>
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
                  <Loader2 size={15} className="animate-spin text-muted" style={{ position: 'absolute', right: '12px', top: '50%', marginTop: '-8.5px' }} />
                )}
              </div>

              {adminSearchResults.length > 0 && (
                <div style={{
                  position: 'absolute', left: 0, right: 0, zIndex: 10,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: '12px', boxShadow: 'var(--shadow-md)',
                  marginTop: '6px', maxHeight: '180px', overflowY: 'auto'
                }}>
                  {adminSearchResults.map((user) => {
                    const alreadyRegistered = panelists.find((p) => p.id === user.id);
                    return (
                      <div
                        key={user.id}
                        style={{ padding: '0.65rem 1rem', cursor: 'pointer', transition: 'var(--transition-fast)' }}
                        className="search-item-hover"
                        onClick={() => {
                          setAdminSelectedUser(user);
                          setAdminQuery(user.displayName);
                          setAdminSearchResults([]);
                          if (alreadyRegistered) setAdminRoles(alreadyRegistered.roles);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--fg)' }}>{user.displayName}</div>
                          {alreadyRegistered && (
                            <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                              {alreadyRegistered.roles.map((r) => (
                                <span key={r} style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem', borderRadius: '4px', background: r === 'L1' ? 'var(--l1-soft)' : 'var(--l2-soft)', border: '1px solid var(--border)', color: r === 'L1' ? 'var(--l1)' : 'var(--l2)', fontWeight: 800 }}>{r}</span>
                              ))}
                              <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'var(--accent-light)', border: '1px solid var(--border)', color: 'var(--accent)', fontWeight: 800 }}>registered</span>
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>{user.mail || user.userPrincipalName}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {adminSelectedUser && (
              <div style={{ background: 'var(--surface-soft)', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '1.25rem', marginTop: '1rem' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--fg-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Selected Colleague</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--fg)', marginTop: '2px' }}>{adminSelectedUser.displayName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>{adminSelectedUser.mail || adminSelectedUser.userPrincipalName}</div>
              </div>
            )}

            <div className="form-block">
              <div className="field-label">Interview Capability Levels</div>
              <div className="capability-list">
                <label className={`capability-option ${adminRoles.includes('L1') ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={adminRoles.includes('L1')}
                    onChange={(e) => {
                      if (e.target.checked) setAdminRoles([...adminRoles, 'L1']);
                      else setAdminRoles(adminRoles.filter((r) => r !== 'L1'));
                    }}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span>
                    <strong>L1 Panelist</strong>
                    <small>Technical screening / coding</small>
                  </span>
                </label>
                
                <label className={`capability-option ${adminRoles.includes('L2') ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={adminRoles.includes('L2')}
                    onChange={(e) => {
                      if (e.target.checked) setAdminRoles([...adminRoles, 'L2']);
                      else setAdminRoles(adminRoles.filter((r) => r !== 'L2'));
                    }}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span>
                    <strong>L2 Panelist</strong>
                    <small>System design / management</small>
                  </span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary register-submit"
              disabled={!adminSelectedUser || adminRoles.length === 0 || isAdminSaving}
            >
              {isAdminSaving ? (
                <><Loader2 size={16} className="animate-spin" /> Saving...</>
              ) : (
                'Register Panelist'
              )}
            </button>
          </form>
        </aside>

        {/* Right column card: Panelist Pool Directory */}
        <section className="directory-card" style={{ padding: '24px', borderRadius: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--border-glass)', boxShadow: 'var(--shadow-xs)' }}>
          <div className="directory-header" style={{ marginBottom: '20px' }}>
            <h2 className="section-title" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={18} style={{ color: 'var(--fg-secondary)' }} /> Panelist Pool Directory
            </h2>
            <p className="section-description" style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--fg-secondary)' }}>
              Search registered panelists, review scheduling availability, and request slot nominations.
            </p>
          </div>

          {/* Integrated search and filters toolbar row */}
          <div className="directory-toolbar" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)', display: 'flex' }}>
                <Search size={15} />
              </span>
              <input
                type="text"
                className="input-control"
                style={{ paddingLeft: '38px', height: '42px', borderRadius: '10px' }}
                value={panelistFilterText}
                onChange={(e) => setPanelistFilterText(e.target.value)}
                placeholder="Search panelists..."
              />
            </div>

            <select
              value={filterCollege}
              onChange={(e) => setFilterCollege(e.target.value)}
              className="select-control"
              style={{ width: '180px', height: '42px', borderRadius: '10px' }}
            >
              <option value="">All Colleges</option>
              {collegesList.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="input-control"
              style={{ width: '150px', height: '42px', borderRadius: '10px', colorScheme: 'dark' }}
            />

            {(filterCollege || filterDate) && (
              <button
                type="button"
                onClick={() => {
                  setFilterCollege(activeDrive ? activeDrive.collegeName : '');
                  setFilterDate(activeDrive ? activeDrive.startDate : '');
                }}
                className="btn btn-secondary"
                style={{ height: '42px', padding: '0 16px', borderRadius: '10px', fontSize: '12px' }}
              >
                Reset
              </button>
            )}
          </div>

          {/* Interactive Metric Filter Stats Cards Grid */}
          <div className="panelist-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
            <button
              type="button"
              className={`stat-card ${statFilter === 'l1' ? 'active' : ''}`}
              onClick={() => setStatFilter(statFilter === 'l1' ? 'all' : 'l1')}
            >
              <div className="stat-value">{filteredPanelists.filter((p) => p.roles.includes('L1')).length}</div>
              <div className="stat-label" style={{ fontSize: '11px', color: 'var(--fg-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '6px' }}>Total L1</div>
            </button>
            
            <button
              type="button"
              className={`stat-card ${statFilter === 'l1-scheduled' ? 'active' : ''}`}
              onClick={() => setStatFilter(statFilter === 'l1-scheduled' ? 'all' : 'l1-scheduled')}
            >
              <div className="stat-value">{l1ScheduledTotal}</div>
              <div className="stat-label" style={{ fontSize: '11px', color: 'var(--fg-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '6px' }}>Scheduled</div>
            </button>
            
            <button
              type="button"
              className={`stat-card ${statFilter === 'l2' ? 'active' : ''}`}
              onClick={() => setStatFilter(statFilter === 'l2' ? 'all' : 'l2')}
            >
              <div className="stat-value">{filteredPanelists.filter((p) => p.roles.includes('L2')).length}</div>
              <div className="stat-label" style={{ fontSize: '11px', color: 'var(--fg-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '6px' }}>Total L2</div>
            </button>
            
            <button
              type="button"
              className={`stat-card ${statFilter === 'l2-scheduled' ? 'active' : ''}`}
              onClick={() => setStatFilter(statFilter === 'l2-scheduled' ? 'all' : 'l2-scheduled')}
            >
              <div className="stat-value">{l2ScheduledTotal}</div>
              <div className="stat-label" style={{ fontSize: '11px', color: 'var(--fg-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '6px' }}>Scheduled</div>
            </button>
          </div>

          {filteredPanelists.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1.5rem', textAlign: 'center', background: 'var(--surface-hover)', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
              <div className="empty-icon" style={{ fontSize: '32px', marginBottom: '12px' }}>👥</div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0' }}>No panelists found</h3>
              <p style={{ fontSize: '13px', color: 'var(--fg-secondary)', margin: 0 }}>Search your tenant directory and register panelists with their L1/L2 capability levels on the left.</p>
            </div>
          ) : (
            <div>
              {/* Tab Switcher for L1 vs L2 */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)', marginBottom: '16px', gap: '8px' }}>
                <button
                  type="button"
                  className={`tab-btn ${activeRoleTab === 'L1' ? 'active' : ''}`}
                  onClick={() => setActiveRoleTab('L1')}
                  style={{
                    padding: '10px 16px',
                    fontWeight: activeRoleTab === 'L1' ? 700 : 500,
                    color: activeRoleTab === 'L1' ? 'var(--primary)' : 'var(--fg-secondary)',
                    borderBottom: activeRoleTab === 'L1' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '14px',
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderTop: 'none',
                  }}
                >
                  L1 Panelists ({l1Panelists.length})
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeRoleTab === 'L2' ? 'active' : ''}`}
                  onClick={() => setActiveRoleTab('L2')}
                  style={{
                    padding: '10px 16px',
                    fontWeight: activeRoleTab === 'L2' ? 700 : 500,
                    color: activeRoleTab === 'L2' ? 'var(--primary)' : 'var(--fg-secondary)',
                    borderBottom: activeRoleTab === 'L2' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '14px',
                    borderLeft: 'none',
                    borderRight: 'none',
                    borderTop: 'none',
                  }}
                >
                  L2 Panelists ({l2Panelists.length})
                </button>
              </div>

              {/* Select All Checkbox toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', background: 'var(--surface-hover)', border: '1px solid var(--border-glass)', borderRadius: '10px', marginBottom: '12px' }}>
                <input
                  type="checkbox"
                  checked={activeRoleTab === 'L1' ? allL1Selected : allL2Selected}
                  onChange={activeRoleTab === 'L1' ? handleToggleSelectAllL1 : handleToggleSelectAllL2}
                  style={{ accentColor: 'var(--primary)', cursor: 'pointer', marginRight: '10px' }}
                />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--fg-secondary)' }}>
                  Select All {activeRoleTab} Panelists
                </span>
              </div>

              {/* Panelists list */}
              <div className="panelist-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(activeRoleTab === 'L1' ? l1Panelists : l2Panelists).length === 0 ? (
                  <div className="empty-state" style={{ padding: '2.5rem 1rem', textAlign: 'center', background: 'var(--surface-hover)', borderRadius: '12px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--fg-secondary)', margin: 0 }}>No {activeRoleTab} panelists matching active filters.</p>
                  </div>
                ) : (
                  (activeRoleTab === 'L1' ? l1Panelists : l2Panelists).map((p) => {
                    const isSelected = activeRoleTab === 'L1' ? bulkSelectedL1Ids.includes(p.id) : bulkSelectedL2Ids.includes(p.id);
                    const scheduled = panelistScheduledCount(p.id, activeRoleTab);
                    const submitted = panelistSubmittedCount(p.id, activeRoleTab);
                    const pending = panelistPendingCount(p.id);
                    return (
                      <article
                        key={p.id}
                        className={`panelist-row ${isSelected ? 'selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            if (activeRoleTab === 'L1') {
                              if (isSelected) setBulkSelectedL1Ids(bulkSelectedL1Ids.filter((id) => id !== p.id));
                              else setBulkSelectedL1Ids([...bulkSelectedL1Ids, p.id]);
                            } else {
                              if (isSelected) setBulkSelectedL2Ids(bulkSelectedL2Ids.filter((id) => id !== p.id));
                              else setBulkSelectedL2Ids([...bulkSelectedL2Ids, p.id]);
                            }
                          }}
                          style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        <div className="panelist-avatar" style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          background: 'var(--primary-glow)',
                          color: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '14px',
                        }}>
                          {getInitials(p.displayName)}
                        </div>
                        <div className="panelist-identity" style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="panelist-name" style={{ fontWeight: 600, color: 'var(--fg)', fontSize: '14px' }}>{p.displayName}</span>
                            {matchedPanelistIds.has(p.id) && (
                              <span style={{ fontSize: '10px', background: 'rgba(22, 163, 74, 0.1)', color: 'var(--success)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>Matched</span>
                            )}
                          </div>
                          <div className="panelist-email" style={{ fontSize: '12px', color: 'var(--fg-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.email}>{p.email}</div>
                          <div className="panelist-meta">
                            <span>{scheduled} scheduled</span>
                            <span>•</span>
                            <span>{submitted} slots given</span>
                            {pending > 0 && (
                              <>
                                <span>•</span>
                                <span style={{ color: 'var(--warning)', fontWeight: 500 }}>{pending} pending</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button
                            onClick={() => handleOpenSlotRequest(p, activeRoleTab)}
                            className="request-slots-button"
                          >
                            Request Slots
                          </button>
                          <ConfirmDialog
                            trigger={
                              <button className="delete-row-btn" type="button">
                                <Trash2 size={14} />
                              </button>
                            }
                            title="Remove this panelist?"
                            description="This will remove the panelist from the pre-approved pool."
                            confirmLabel="Yes, Remove"
                            onConfirm={() => handleDeletePanelist(p.id)}
                          />
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Floating Bulk Action Bar */}
          {(bulkSelectedL1Ids.length > 0 || bulkSelectedL2Ids.length > 0) && (
            <div style={{
              position: 'sticky', bottom: '1rem',
              background: 'color-mix(in srgb, var(--bg-elevated) 92%, transparent)',
              backdropFilter: 'blur(12px)',
              border: '1px solid color-mix(in srgb, var(--primary) 35%, var(--border))',
              borderRadius: '16px',
              padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', boxShadow: 'var(--shadow-md)',
              zIndex: 90, marginTop: '1.5rem'
            }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--fg)' }}>
                <span style={{ color: 'var(--primary)', marginRight: '4px' }}>{bulkSelectedL1Ids.length + bulkSelectedL2Ids.length}</span> Panelists Selected
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => {
                    const selectedPanelists = panelists.filter((p) => bulkSelectedL1Ids.includes(p.id));
                    handleOpenSlotRequest(selectedPanelists, 'L1');
                  }}
                  className="btn btn-primary compact"
                  style={{ height: '34px', fontSize: '12px' }}
                  disabled={bulkSelectedL1Ids.length === 0}
                >
                  Request L1 Slots
                </button>
                <button
                  onClick={() => {
                    const selectedPanelists = panelists.filter((p) => bulkSelectedL2Ids.includes(p.id));
                    handleOpenSlotRequest(selectedPanelists, 'L2');
                  }}
                  className="btn btn-primary compact"
                  style={{ height: '34px', fontSize: '12px' }}
                  disabled={bulkSelectedL2Ids.length === 0}
                >
                  Request L2 Slots
                </button>
                <button
                  onClick={() => { setBulkSelectedL1Ids([]); setBulkSelectedL2Ids([]); }}
                  className="btn btn-secondary compact"
                  style={{ border: '1px solid var(--border)', background: 'transparent', height: '34px', fontSize: '12px' }}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}
        </section>
      </section>

      {/* Request Slot Overlay Modal */}
      {reqPanelists.length > 0 && (
        <div onClick={() => {
    setReqPanelists([]);
  }} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
          zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'
        }}>
          <div className="glass-card animate-pulse-once" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', width: '100%', padding: '2rem', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-glass)' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem', color: 'var(--fg)', fontFamily: 'var(--font-heading)', fontWeight: 700 }}>
              Request Slots from {reqPanelists.length === 1 ? reqPanelists[0].displayName : `${reqPanelists.length} Panelists`}
            </h3>

            {reqPanelists.length > 1 && (
              <div style={{ background: 'var(--surface-soft)', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1rem', fontSize: '0.75rem' }}>
                <span className="text-muted block font-semibold" style={{ marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invited Panel Members:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                  {reqPanelists.map((p) => (
                    <span key={p.id} style={{ background: 'var(--l1-soft)', border: '1px solid var(--l1-border)', color: 'var(--l1)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 650 }}>
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
                    <SelectTrigger className="select-control" style={{ color: 'inherit' }}>
                      <SelectValue placeholder="Select Stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L1">L1 Interview</SelectItem>
                      <SelectItem value="L2">L2 Interview</SelectItem>
                      <SelectItem value="General">General / Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="form-group">
                  <label className="form-label">Duration</label>
                  <Select value={reqDuration} onValueChange={(val) => setReqDuration(val || '')}>
                    <SelectTrigger className="select-control" style={{ color: 'inherit' }}>
                      <SelectValue placeholder="Select Duration" />
                    </SelectTrigger>
                    <SelectContent>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', background: 'var(--accent-light)', border: '1px solid rgba(13, 124, 102, 0.2)', borderRadius: '12px', padding: '0.65rem 0.85rem', fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600 }}>
                    <Building2 size={14} />
                    <strong>{activeDrive.collegeName}</strong>
                    <span className="text-muted">·</span>
                    <Clock size={13} />
                    <span>
                      {activeDrive.startDate === activeDrive.endDate
                        ? new Date(activeDrive.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : `${new Date(activeDrive.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(activeDrive.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    </span>
                  </div>
                  <p className="text-xs text-muted" style={{ marginTop: '0.4rem' }}>
                    Slots are generated across the selected window below, defaulted to the active drive. Change the drive itself in the <strong>Drives</strong> tab.
                  </p>
                  <div className="grid-2" style={{ marginTop: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Slot Range Start</label>
                      <input type="date" className="input-control" value={reqStartDate} min={activeDrive.startDate} max={activeDrive.endDate} onChange={(e) => setReqStartDate(e.target.value)} required style={{ colorScheme: 'dark' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Slot Range End</label>
                      <input type="date" className="input-control" value={reqEndDate} min={reqStartDate || activeDrive.startDate} max={activeDrive.endDate} onChange={(e) => setReqEndDate(e.target.value)} required style={{ colorScheme: 'dark' }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <div style={{ background: 'var(--warning-light)', border: '1px solid rgba(212, 146, 11, 0.25)', borderRadius: '12px', padding: '0.65rem 0.85rem', color: 'var(--warning)', fontSize: '0.78rem', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                    No active drive selected. Set an active drive in the <strong>Drives</strong> tab so the slot window and college are picked automatically. Falling back to a default date range below.
                  </div>
                  <label className="form-label">College / Institution</label>
                  <Select value={reqCollegeName} onValueChange={(val) => setReqCollegeName(val || '')}>
                    <SelectTrigger className="select-control" style={{ color: 'inherit' }}>
                      <SelectValue placeholder="Select College..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none_placeholder">Select College...</SelectItem>
                      {collegesList.map((c) => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="grid-2" style={{ marginTop: '0.75rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Proposed Range Start</label>
                      <input type="date" className="input-control" value={reqStartDate} min={todayStr} onChange={(e) => setReqStartDate(e.target.value)} required style={{ colorScheme: 'dark' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Proposed Range End</label>
                      <input type="date" className="input-control" value={reqEndDate} min={reqStartDate || todayStr} onChange={(e) => setReqEndDate(e.target.value)} required style={{ colorScheme: 'dark' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Proposed Slots Builder Checklist */}
              <div style={{ background: 'var(--surface-soft)', border: '1px solid var(--border)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--fg)', fontWeight: 800 }}>Proposed Slot Options Checklist</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {reqSlots.length === 0 ? (
                    <span className="text-muted text-xs block text-center" style={{ padding: '0.5rem 0' }}>No proposed slot options added yet. Select range start/end.</span>
                  ) : (
                    reqSlots.map((s, idx) => {
                      const start = new Date(s.startTime);
                      const end = new Date(s.endTime);
                      return (
                        <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '0.5rem 0.75rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--fg)' }}>
                          <input
                            type="checkbox"
                            checked={s.selected}
                            onChange={(e) => {
                              const updated = [...reqSlots];
                              updated[idx].selected = e.target.checked;
                              setReqSlots(updated);
                            }}
                            style={{ accentColor: 'var(--accent)' }}
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

              {/* Teams Message Preview Card */}
              <div style={{ background: 'var(--preview-bg)', padding: '1.25rem', borderRadius: '14px', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                <span className="text-muted text-xs block font-bold" style={{ marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Teams Message Preview Card</span>
                <div style={{ paddingLeft: '0.75rem', fontSize: '0.8rem', color: 'var(--fg-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 850 }}>📅 Campus Hiring Interview Slot Request</span>
                  </div>
                  
                  <p style={{ margin: '4px 0', fontSize: '0.8rem', color: 'var(--fg)' }}>Hello <strong>{reqPanelists.length === 1 ? reqPanelists[0].displayName : '[Panelist Name]'}</strong>,</p>
                  <p style={{ margin: '4px 0', fontSize: '0.8rem' }}>
                    You have been requested to conduct an interview.
                  </p>

                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', margin: '10px 0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--fg-muted)', textTransform: 'uppercase', fontWeight: 650 }}>Interview Round</div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--fg)' }}>{reqInterviewType} Interview{reqCollegeName ? ` - ${reqCollegeName}` : ''}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--fg-muted)', textTransform: 'uppercase', fontWeight: 650 }}>Proposed Dates</div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--fg)' }}>{new Date(reqStartDate || todayStr).toLocaleDateString('en-US')} - {new Date(reqEndDate || todayStr).toLocaleDateString('en-US')}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--fg-muted)', textTransform: 'uppercase', fontWeight: 650 }}>Duration</div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--fg)' }}>{reqDuration} minutes</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--fg-muted)', textTransform: 'uppercase', fontWeight: 650 }}>Nominated Panelist</div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--fg)' }}>{reqPanelists.length === 1 ? reqPanelists[0].displayName : '[Panelist Name]'}</div>
                      </div>
                    </div>
                  </div>

                  <p style={{ margin: '4px 0', fontSize: '0.8rem' }}>Please select one of the following proposed slots to book instantly:</p>
                  <div style={{ margin: '8px 0', paddingLeft: '1rem', color: 'var(--fg)', fontSize: '0.75rem' }}>
                    {reqSlots.filter((s) => s.selected).slice(0, 6).map((s, i) => {
                      const d = new Date(s.startTime);
                      return <div key={i}>• {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} @ {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} (IST)</div>;
                    })}
                    {reqSlots.filter((s) => s.selected).length > 6 && <div>• and {reqSlots.filter((s) => s.selected).length - 6} more slots...</div>}
                    {reqSlots.filter((s) => s.selected).length === 0 && <div style={{ fontStyle: 'italic', color: 'var(--danger)' }}>No slots selected! Please enable at least one slot.</div>}
                  </div>
                  
                  <div style={{ marginTop: '0.75rem', background: '#6366f1', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '6px', display: 'inline-block', fontSize: '0.75rem', fontWeight: 700 }}>Review Availability</div>
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
    </main>
  );
}
