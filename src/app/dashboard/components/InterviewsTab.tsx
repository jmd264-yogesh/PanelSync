'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus, Calendar, User, Users, Clock, CheckCircle, XCircle,
  Search, Loader2, Trash2, Video, Check, Info, CalendarCheck,
  ListFilter, MessageSquare, Bell, Send, X, TrendingUp, AlertCircle
} from 'lucide-react';
import { Interview, Panelist, UploadedCandidate, InterviewPanel } from '@/lib/db';
import { GraphUser } from '@/lib/graph';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';

interface InterviewsTabProps {
  interviews: Interview[];
  setInterviews: React.Dispatch<React.SetStateAction<Interview[]>>;
  panelists: Panelist[];
  candidates: UploadedCandidate[];
  setCandidates: React.Dispatch<React.SetStateAction<UploadedCandidate[]>>;
  todayStr: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function renderStarsStatic(rating: number) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} style={{ color: star <= rating ? '#fbbf24' : 'rgba(255,255,255,0.12)', fontSize: '1rem', lineHeight: 1 }}>★</span>
      ))}
    </div>
  );
}

function getOverlappingSlots(interview: Interview): { start: string; end: string }[] {
  const panels = interview.panels;
  if (!panels || panels.length === 0) return [];
  const activePanels = panels.filter((p) => p.status === 'SUBMITTED');
  if (activePanels.length === 0) return [];

  const duration = interview.duration;
  const limitStart = new Date(interview.startDate);
  const limitEnd = new Date(interview.endDate);
  const intervalMin = 15;
  const chunkMs = intervalMin * 60 * 1000;
  const durationMs = duration * 60 * 1000;
  const startMs = limitStart.getTime();
  const endMs = limitEnd.getTime();
  const matches: { start: string; end: string }[] = [];

  for (let time = startMs; time + durationMs <= endMs; time += chunkMs) {
    const slotStart = new Date(time);
    const slotEnd = new Date(time + durationMs);
    const allAvailable = activePanels.every((panel) =>
      panel.availabilities.some((avail) => {
        const aS = new Date(avail.startTime).getTime();
        const aE = new Date(avail.endTime).getTime();
        return aS <= slotStart.getTime() && aE >= slotEnd.getTime();
      })
    );
    if (allAvailable) matches.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
  }

  return matches.filter((slot, idx) => {
    if (idx === 0) return true;
    const prev = matches[idx - 1];
    return new Date(slot.start).getTime() - new Date(prev.start).getTime() >= 30 * 60 * 1000;
  });
}

export default function InterviewsTab({
  interviews,
  setInterviews,
  panelists,
  candidates,
  setCandidates,
  todayStr,
}: InterviewsTabProps) {
  // ── UI States ─────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'COLLECTED' | 'SCHEDULED'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'L1' | 'L2'>('all');
  const [collegeFilter, setCollegeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'panels' | 'booking' | 'feedback'>('overview');

  // ── Create Interview Form States ───────────────────────────────────────────
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [role, setRole] = useState('');
  const [duration, setDuration] = useState('45');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [interviewType, setInterviewType] = useState<'L1' | 'L2' | 'General'>('L1');
  const [selectedPanels, setSelectedPanels] = useState<GraphUser[]>([]);
  const [panelSearchQuery, setPanelSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GraphUser[]>([]);
  const [isSearchingPanels, setIsSearchingPanels] = useState(false);

  // ── Booking States ─────────────────────────────────────────────────────────
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [bookingDescription, setBookingDescription] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);
  const [resendingPanelId, setResendingPanelId] = useState<string | null>(null);
  const [sendingFeedbackReminderId, setSendingFeedbackReminderId] = useState<string | null>(null);

  // ── Date Edit States ───────────────────────────────────────────────────────
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [isUpdatingDates, setIsUpdatingDates] = useState(false);
  const [selectedInterviewForConfig, setSelectedInterviewForConfig] = useState<Interview | null>(null);

  // ── Derived Values ────────────────────────────────────────────────────────
  const statsPending = interviews.filter((i) => i.status === 'PENDING').length;
  const statsCollected = interviews.filter((i) => i.status === 'COLLECTED').length;
  const statsScheduled = interviews.filter((i) => i.status === 'SCHEDULED').length;
  const statsL1Total = interviews.filter((i) => i.role.toLowerCase().includes('l1')).length;
  const statsL2Total = interviews.filter((i) => i.role.toLowerCase().includes('l2')).length;
  const statsL1Scheduled = interviews.filter((i) => i.status === 'SCHEDULED' && i.role.toLowerCase().includes('l1')).length;
  const statsL2Scheduled = interviews.filter((i) => i.status === 'SCHEDULED' && i.role.toLowerCase().includes('l2')).length;
  const statsL1Pending = interviews.filter((i) => i.status === 'PENDING' && i.role.toLowerCase().includes('l1')).length;
  const statsL2Pending = interviews.filter((i) => i.status === 'PENDING' && i.role.toLowerCase().includes('l2')).length;

  const allNominations = interviews.flatMap((interview) =>
    interview.panels.map((p) => ({ ...p, interview }))
  );
  const respondedNominations = allNominations.filter((n) => n.status === 'SUBMITTED');
  const pendingInterviews = interviews.filter((i) => i.status === 'PENDING');

  const recommendedPanelists = panelists.filter((p) => {
    if (interviewType === 'General') return true;
    return p.roles.includes(interviewType as 'L1' | 'L2');
  });

  const activePanelistInterviewCount = (panelistId: string) =>
    interviews.filter(
      (i) => (i.status === 'PENDING' || i.status === 'COLLECTED') && i.panels.some((p) => p.userId === panelistId)
    ).length;

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedInterview) {
      const updated = interviews.find((i) => i.id === selectedInterview.id);
      setSelectedInterview(updated || null);
    }
    if (selectedInterviewForConfig) {
      const updated = interviews.find((i) => i.id === selectedInterviewForConfig.id);
      setSelectedInterviewForConfig(updated || null);
    }
  }, [interviews]);

  useEffect(() => {
    if (panelSearchQuery.trim().length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setIsSearchingPanels(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(panelSearchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.filter((u: GraphUser) => !selectedPanels.some((sp) => sp.id === u.id)));
        }
      } catch (err) {
        console.error('Error searching panels:', err);
      } finally {
        setIsSearchingPanels(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [panelSearchQuery, selectedPanels]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddPanel = (user: GraphUser) => {
    if (!selectedPanels.some((p) => p.id === user.id)) {
      setSelectedPanels([...selectedPanels, user]);
    }
    setPanelSearchQuery('');
    setSearchResults([]);
  };

  const handleToggleRecommendedPanelist = (p: Panelist) => {
    const isChosen = selectedPanels.some((sp) => sp.id === p.id);
    if (isChosen) {
      setSelectedPanels(selectedPanels.filter((sp) => sp.id !== p.id));
    } else {
      setSelectedPanels([...selectedPanels, { id: p.id, displayName: p.displayName, mail: p.email, userPrincipalName: p.email }]);
    }
  };

  const handleRemovePanel = (userId: string) => {
    setSelectedPanels(selectedPanels.filter((p) => p.id !== userId));
  };

  const handleCreateInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!candidateName.trim()) { setCreateError('Please select a candidate from the queue.'); return; }
    if (!role.trim()) { setCreateError('Please enter the job title / focus area.'); return; }
    if (!startDate) { setCreateError('Please select a proposed range start date.'); return; }
    if (!endDate) { setCreateError('Please select a proposed range end date.'); return; }
    if (startDate < todayStr) { setCreateError('Start date cannot be in the past.'); return; }
    if (endDate < startDate) { setCreateError('End date cannot be before the start date.'); return; }
    if (selectedPanels.length === 0) { setCreateError('Please select at least one panel member.'); return; }

    setIsLoading(true);
    try {
      const res = await fetch('/api/interviews/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateName,
          candidateEmail,
          role: `${interviewType} - ${role}`,
          duration: parseInt(duration, 10),
          startDate,
          endDate,
          panels: selectedPanels,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to submit interview invitation.');
      }
      const result = await res.json();
      setInterviews([result.interview, ...interviews]);
      setCandidateName('');
      setCandidateEmail('');
      setRole('');
      setDuration('45');
      setStartDate('');
      setEndDate('');
      setSelectedPanels([]);
      setInterviewType('L1');
      setShowCreateForm(false);
      setCreateError(null);
      setSelectedInterview(result.interview);
      setShowInterviewModal(true);
      setDetailTab('overview');
    } catch (error: any) {
      console.error(error);
      setCreateError(error.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteInterview = async (id: string) => {
    try {
      const res = await fetch(`/api/interviews/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setInterviews(interviews.filter((i) => i.id !== id));
        if (selectedInterview?.id === id) setSelectedInterview(null);
        toast.success('Interview record deleted.');
      } else {
        toast.error('Failed to delete interview');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBookSlot = async () => {
    if (!selectedInterview || !selectedSlot) return;
    setIsBooking(true);
    try {
      const res = await fetch('/api/interviews/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId: selectedInterview.id, startTime: selectedSlot.start, endTime: selectedSlot.end, description: bookingDescription }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to book meeting');
      }
      setInterviews(interviews.map((i) =>
        i.id === selectedInterview.id ? { ...i, status: 'SCHEDULED' as const, scheduledSlotStart: selectedSlot.start, scheduledSlotEnd: selectedSlot.end } : i
      ));
      setSelectedSlot(null);
      setBookingDescription('');
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error scheduling meeting');
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!selectedInterview) return;
    setIsCancellingBooking(true);
    try {
      const res = await fetch('/api/interviews/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId: selectedInterview.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to cancel booking');
      }
      const data = await res.json();
      setInterviews(interviews.map((i) => i.id === selectedInterview.id ? data.interview : i));
      setSelectedInterview(data.interview);
      toast.success('Successfully cancelled meeting and removed scheduled slot.');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error cancelling meeting');
    } finally {
      setIsCancellingBooking(false);
    }
  };

  const handleResendInvite = async (interviewId: string, panelId: string) => {
    setResendingPanelId(panelId);
    try {
      const res = await fetch('/api/interviews/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId, panelId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to resend invitation');
      }
      toast.success('Successfully resent Teams notification reminder!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error resending invitation');
    } finally {
      setResendingPanelId(null);
    }
  };

  const handleUpdateDates = async (e: React.FormEvent, targetInterviewOverride?: Interview) => {
    if (e) e.preventDefault();
    const target = targetInterviewOverride || selectedInterview;
    if (!target) return;
    if (editStartDate < todayStr) { toast.error('Start date cannot be in the past.'); return; }
    if (editEndDate < editStartDate) { toast.error('End date cannot be before the start date.'); return; }
    setIsUpdatingDates(true);
    try {
      let type: 'L1' | 'L2' | 'General' = 'L1';
      if (target.role.includes('L2')) type = 'L2';
      else if (target.role.includes('General')) type = 'General';
      const [startH, startM] = (type === 'L2' ? '14:00' : '10:00').split(':').map(Number);
      const [endH, endM] = (type === 'L2' ? '17:00' : '13:00').split(':').map(Number);
      const generatedSlots: { startTime: string; endTime: string }[] = [];
      const currentDay = new Date(editStartDate);
      const endDay = new Date(editEndDate);
      while (currentDay <= endDay) {
        const year = currentDay.getFullYear();
        const month = currentDay.getMonth();
        const date = currentDay.getDate();
        const dayStart = new Date(year, month, date, startH, startM, 0);
        const dayEnd = new Date(year, month, date, endH, endM, 0);
        let time = dayStart.getTime();
        while (time + 30 * 60 * 1000 <= dayEnd.getTime()) {
          generatedSlots.push({ startTime: new Date(time).toISOString(), endTime: new Date(time + 30 * 60 * 1000).toISOString() });
          time += 30 * 60 * 1000;
        }
        currentDay.setDate(currentDay.getDate() + 1);
      }
      const res = await fetch(`/api/interviews/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: editStartDate, endDate: editEndDate, slots: generatedSlots }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update interview dates.');
      }
      const data = await res.json();
      setInterviews(interviews.map((i) => i.id === target.id ? data.interview : i));
      if (targetInterviewOverride) {
        setSelectedInterviewForConfig(data.interview);
      } else {
        setSelectedInterview(data.interview);
        setIsEditingDates(false);
      }
      toast.success('Successfully updated interview date range and reset proposed availability slots.');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error updating dates');
    } finally {
      setIsUpdatingDates(false);
    }
  };

  const handleSendFeedbackReminder = async (interviewId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSendingFeedbackReminderId(interviewId);
    try {
      const res = await fetch('/api/interviews/send-feedback-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reminder');
      const sentCount = data.sent?.length ?? 0;
      const skippedCount = data.skipped?.length ?? 0;
      toast.success(`Feedback reminder sent to ${sentCount} panelist${sentCount !== 1 ? 's' : ''}${skippedCount > 0 ? ` (${skippedCount} skipped — same user)` : ''}.`);
    } catch (err: any) {
      toast.error(`Failed to send reminder: ${err.message}`);
    } finally {
      setSendingFeedbackReminderId(null);
    }
  };

  // ── Filtering Logic ───────────────────────────────────────────────────────
  const getFilteredInterviews = () => {
    let filtered = interviews;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((i) => i.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((i) => i.role.toLowerCase().includes(typeFilter.toLowerCase()));
    }

    if (dateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      filtered = filtered.filter((i) => {
        const iDate = new Date(i.startDate);
        iDate.setHours(0, 0, 0, 0);
        if (dateFilter === 'today') return iDate.getTime() === today.getTime();
        if (dateFilter === 'week') return iDate >= startOfWeek && iDate <= today;
        if (dateFilter === 'month') return iDate >= startOfMonth && iDate <= today;
        return true;
      });
    }

    return filtered;
  };

  const filteredInterviewsList = getFilteredInterviews();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header with Title and Action */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>Interview Dashboard</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Overview of all L1 & L2 interviews, panelist responses, and scheduling status</p>
        </div>
        <button className="btn btn-primary flex-gap-2" onClick={() => { setShowCreateForm(!showCreateForm); setSelectedInterview(null); }}>
          <Plus size={16} /> New Interview
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-lg)' }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Status</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', fontSize: '0.9rem', cursor: 'pointer' }}>
            <option value="all">All Status</option>
            <option value="PENDING">Awaiting Panels</option>
            <option value="COLLECTED">Ready to Book</option>
            <option value="SCHEDULED">Scheduled</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Interview Type</label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', fontSize: '0.9rem', cursor: 'pointer' }}>
            <option value="all">All Types</option>
            <option value="L1">L1 Interviews</option>
            <option value="L2">L2 Interviews</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Date Range</label>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', fontSize: '0.9rem', cursor: 'pointer' }}>
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>College</label>
          <select value={collegeFilter} onChange={(e) => setCollegeFilter(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', fontSize: '0.9rem', cursor: 'pointer' }}>
            <option value="all">All Colleges</option>
          </select>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.5rem' }}>
        {/* Left Column: Interview List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Stats Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {[
              { label: 'L1 Interviews', value: statsL1Total, scheduled: statsL1Scheduled, color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)' },
              { label: 'L2 Interviews', value: statsL2Total, scheduled: statsL2Scheduled, color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)' },
              { label: 'Total Active', value: interviews.length, scheduled: statsScheduled, color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
            ].map((stat) => (
              <div key={stat.label} style={{ padding: '1rem', background: stat.bg, border: `1px solid ${stat.border}`, borderRadius: 'var(--radius-lg)' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', margin: 0, marginBottom: '0.5rem' }}>{stat.label}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, color: stat.color }}>{stat.value}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>•</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{stat.scheduled} scheduled</span>
                </div>
              </div>
            ))}
          </div>

          {/* Interviews List */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredInterviewsList.length === 0 ? (
              <div className="glass-card text-center" style={{ padding: '3rem 2rem' }}>
                <CalendarCheck size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
                <h4 style={{ marginBottom: '0.5rem' }}>No Interviews Found</h4>
                <p className="text-muted text-sm">Create a new interview or adjust your filters.</p>
              </div>
            ) : (
              filteredInterviewsList.map((interview) => {
                const isSelected = selectedInterview?.id === interview.id;
                const isL1 = interview.role.toLowerCase().includes('l1');
                const isL2 = interview.role.toLowerCase().includes('l2');
                const typeColor = isL1 ? '#60a5fa' : isL2 ? '#a78bfa' : '#10b981';
                const statusColor = interview.status === 'SCHEDULED' ? '#10b981' : interview.status === 'COLLECTED' ? '#0ea5e9' : '#f59e0b';
                const initials = interview.candidateName === 'Pending Assignment' ? '?' : interview.candidateName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

                return (
                  <div
                    key={interview.id}
                    onClick={() => { setSelectedInterview(interview); setShowInterviewModal(true); }}
                    style={{
                      padding: '1rem',
                      background: isSelected ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.02)',
                      border: isSelected ? '1px solid #60a5fa' : '1px solid var(--border-glass)',
                      borderLeft: `4px solid ${typeColor}`,
                      borderRadius: 'var(--radius-lg)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      {/* Avatar */}
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `${typeColor}15`, border: `1px solid ${typeColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0, color: typeColor }}>
                        {initials}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                          {isL1 && <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '0.15rem 0.4rem', background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.35)', borderRadius: '4px', color: '#60a5fa' }}>L1</span>}
                          {isL2 && <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '0.15rem 0.4rem', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '4px', color: '#a78bfa' }}>L2</span>}
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>{interview.candidateName}</h4>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, marginBottom: '0.5rem' }}>{interview.role}</p>
                        
                        {/* Panel Status */}
                        {interview.panels.length > 0 && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                            {interview.panels.filter((p) => p.status === 'SUBMITTED').length} / {interview.panels.length} panels responded
                          </div>
                        )}

                        {/* Date/Time */}
                        <div style={{ fontSize: '0.75rem', color: statusColor, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          {interview.status === 'SCHEDULED' && interview.scheduledSlotStart ? (
                            <>
                              <CheckCircle size={12} />
                              {new Date(interview.scheduledSlotStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at {new Date(interview.scheduledSlotStart).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </>
                          ) : (
                            <>
                              <Clock size={12} />
                              {new Date(interview.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {new Date(interview.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div style={{ flexShrink: 0 }}>
                        {interview.status === 'PENDING' && <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.25rem 0.5rem', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', color: '#f59e0b', whiteSpace: 'nowrap' }}>Awaiting</span>}
                        {interview.status === 'COLLECTED' && <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.25rem 0.5rem', background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)', borderRadius: '4px', color: '#0ea5e9', whiteSpace: 'nowrap' }}>Ready</span>}
                        {interview.status === 'SCHEDULED' && <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.25rem 0.5rem', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '4px', color: '#10b981', whiteSpace: 'nowrap' }}>Scheduled</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Analytics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Analytics Header */}
          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-lg)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={18} /> Analytics
            </h3>

            {/* Status Overview */}
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0 0 0.5rem 0' }}>Status Overview</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { label: 'Scheduled', value: statsScheduled, color: '#10b981' },
                  { label: 'Ready to Book', value: statsCollected, color: '#0ea5e9' },
                  { label: 'Awaiting Panels', value: statsPending, color: '#f59e0b' },
                ].map((stat) => (
                  <div key={stat.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stat.color }} />
                      {stat.label}
                    </div>
                    <span style={{ fontWeight: 700, color: stat.color }}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Panelist Response Rate */}
            <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0 0 0.5rem 0' }}>Panelist Responses</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#10b981', width: allNominations.length > 0 ? `${(respondedNominations.length / allNominations.length) * 100}%` : '0%', transition: 'width 0.3s' }} />
                  </div>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981', whiteSpace: 'nowrap' }}>{respondedNominations.length} / {allNominations.length}</span>
              </div>
            </div>
          </div>

          {/* Create Form or Info Box */}
          {showCreateForm ? (
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-lg)', overflowY: 'auto', maxHeight: 'calc(100vh - 400px)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Create New Interview</h3>
              <form onSubmit={handleCreateInterview} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input type="text" placeholder="Candidate Name" value={candidateName} onChange={(e) => setCandidateName(e.target.value)} style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', fontSize: '0.9rem' }} />
                <input type="email" placeholder="Email" value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)} style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', fontSize: '0.9rem' }} />
                <input type="text" placeholder="Job Title / Focus Area" value={role} onChange={(e) => setRole(e.target.value)} style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', fontSize: '0.9rem' }} />
                
                <select value={interviewType} onChange={(e) => setInterviewType(e.target.value as any)} style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', fontSize: '0.9rem', cursor: 'pointer' }}>
                  <option value="L1">L1 Interview</option>
                  <option value="L2">L2 Interview</option>
                  <option value="General">General Interview</option>
                </select>

                <input type="number" min="15" max="180" value={duration} onChange={(e) => setDuration(e.target.value)} style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', fontSize: '0.9rem' }} placeholder="Duration (mins)" />

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ flex: 1, padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', fontSize: '0.9rem' }} />
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ flex: 1, padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', fontSize: '0.9rem' }} />
                </div>

                {createError && <p style={{ color: '#ef4444', fontSize: '0.75rem', margin: 0 }}>{createError}</p>}

                <button type="submit" disabled={isLoading} style={{ padding: '0.5rem 0.75rem', background: 'var(--primary)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                  {isLoading ? 'Creating...' : 'Create Interview'}
                </button>
              </form>
            </div>
          ) : selectedInterview ? (
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-lg)' }}>
              <button onClick={() => setShowInterviewModal(true)} style={{ width: '100%', padding: '0.75rem', background: 'var(--primary)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                View Interview Details
              </button>
            </div>
          ) : (
            <div style={{ padding: '2rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
              <Calendar size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 0.75rem', opacity: 0.5 }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>Select an interview from the list to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Interview Detail Modal */}
      {showInterviewModal && selectedInterview && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--background)', borderRadius: 'var(--radius-xl)', width: '90%', maxWidth: '900px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            {/* Modal Header */}
            <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>{selectedInterview.candidateName}</h2>
              <button onClick={() => setShowInterviewModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem' }}>
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0, marginBottom: '0.25rem' }}>Role</p>
                  <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>{selectedInterview.role}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0, marginBottom: '0.25rem' }}>Status</p>
                  <div>
                    {selectedInterview.status === 'PENDING' && <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.5rem', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', color: '#f59e0b' }}>Awaiting Panels</span>}
                    {selectedInterview.status === 'COLLECTED' && <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.5rem', background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)', borderRadius: '4px', color: '#0ea5e9' }}>Ready to Book</span>}
                    {selectedInterview.status === 'SCHEDULED' && <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.5rem', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '4px', color: '#10b981' }}>Scheduled</span>}
                  </div>
                </div>
              </div>

              {/* Panels Section */}
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-lg)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.75rem 0' }}>Panel Members</h3>
                {selectedInterview.panels.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No panels assigned</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedInterview.panels.map((p) => (
                      <div key={p.id} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: '0 0 0.2rem 0' }}>{p.name}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Status: {p.status === 'SUBMITTED' ? '✓ Responded' : 'Pending'}</p>
                        </div>
                        {p.status === 'PENDING' && (
                          <button onClick={() => handleResendInvite(selectedInterview.id, p.id)} disabled={resendingPanelId === p.id} style={{ padding: '0.35rem 0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                            {resendingPanelId === p.id ? 'Resending...' : 'Resend'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              {selectedInterview.status === 'COLLECTED' && (
                <button onClick={() => setDetailTab('booking')} style={{ width: '100%', padding: '0.75rem', background: 'var(--primary)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                  Book Meeting
                </button>
              )}
              
              {selectedInterview.status === 'SCHEDULED' && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {selectedInterview.teamsMeetingUrl && (
                    <a href={selectedInterview.teamsMeetingUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '0.75rem', background: 'var(--success)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <Video size={16} /> Join Meeting
                    </a>
                  )}
                  <button onClick={() => setDetailTab('feedback')} style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                    Feedback
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
