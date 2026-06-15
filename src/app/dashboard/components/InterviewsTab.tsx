'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus, Calendar, User, Users, Clock, CheckCircle, XCircle,
  Search, Loader2, Trash2, Video, Check, Info, CalendarCheck,
  ListFilter, MessageSquare, Bell, Send
} from 'lucide-react';
import { Interview, Panelist, UploadedCandidate, InterviewPanel } from '@/lib/db';
import { GraphUser } from '@/lib/graph';

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
  const [cockpitView, setCockpitView] = useState<'list' | 'tracker'>('list');
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
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
  const filteredInterviews = statusFilter === 'all' ? interviews : interviews.filter((i) => i.status === statusFilter);
  const commonSlots = selectedInterview ? getOverlappingSlots(selectedInterview) : [];

  // L1 / L2 type derived counts
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
  // Sync selected interview when interviews list updates
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

  // Debounced panel directory search
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
      setDetailTab('overview');
    } catch (error: any) {
      console.error(error);
      setCreateError(error.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteInterview = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this interview record?')) return;
    try {
      const res = await fetch(`/api/interviews/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setInterviews(interviews.filter((i) => i.id !== id));
        if (selectedInterview?.id === id) setSelectedInterview(null);
      } else {
        alert('Failed to delete interview');
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
      alert(err.message || 'Error scheduling meeting');
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!selectedInterview) return;
    if (!confirm('Are you sure you want to cancel this booking? This will delete the calendar event from Microsoft Teams.')) return;
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
      alert('Successfully cancelled meeting and removed scheduled slot.');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error cancelling meeting');
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
      alert('Successfully resent Teams notification reminder!');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error resending invitation');
    } finally {
      setResendingPanelId(null);
    }
  };

  const handleUpdateDates = async (e: React.FormEvent, targetInterviewOverride?: Interview) => {
    if (e) e.preventDefault();
    const target = targetInterviewOverride || selectedInterview;
    if (!target) return;
    if (editStartDate < todayStr) { alert('Start date cannot be in the past.'); return; }
    if (editEndDate < editStartDate) { alert('End date cannot be before the start date.'); return; }
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
      alert('Successfully updated interview date range and reset proposed availability slots.');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error updating dates');
    } finally {
      setIsUpdatingDates(false);
    }
  };

  // ── Send Feedback Reminder ────────────────────────────────────────────────
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
      alert(`✓ Feedback reminder sent to ${sentCount} panelist${sentCount !== 1 ? 's' : ''}${skippedCount > 0 ? ` (${skippedCount} skipped — same user)` : ''}.`);
    } catch (err: any) {
      alert(`Failed to send reminder: ${err.message}`);
    } finally {
      setSendingFeedbackReminderId(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>

      {/* Left: Interviews list & Panelist Tracker */}
      <div>
        {/* Stats Bar */}
        <div style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {/* Status filter row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
            {[
              { label: 'Total', value: interviews.length, color: 'var(--text-muted)', active: statusFilter === 'all', onClick: () => setStatusFilter('all') },
              { label: 'Pending', value: statsPending, color: '#f59e0b', active: statusFilter === 'PENDING', onClick: () => setStatusFilter('PENDING') },
              { label: 'Ready', value: statsCollected, color: '#0ea5e9', active: statusFilter === 'COLLECTED', onClick: () => setStatusFilter('COLLECTED') },
              { label: 'Scheduled', value: statsScheduled, color: '#10b981', active: statusFilter === 'SCHEDULED', onClick: () => setStatusFilter('SCHEDULED') },
            ].map((stat) => (
              <button key={stat.label} onClick={stat.onClick} style={{ background: stat.active ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)', border: `1px solid ${stat.active ? stat.color : 'var(--border-glass)'}`, borderRadius: 'var(--radius-md)', padding: '0.6rem 0.5rem', textAlign: 'center', cursor: 'pointer', transition: 'var(--transition-fast)', color: 'inherit' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.15rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
              </button>
            ))}
          </div>
          {/* L1 / L2 breakdown row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr', gap: '0.4rem' }}>
            {[
              { label: 'L1 Total', value: statsL1Total, color: '#60a5fa', bg: 'rgba(96,165,250,0.06)', border: 'rgba(96,165,250,0.2)' },
              { label: 'L1 Pending', value: statsL1Pending, color: '#fbbf24', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)' },
              { label: 'L1 Scheduled', value: statsL1Scheduled, color: '#34d399', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)' },
              { label: 'L2 Total', value: statsL2Total, color: '#a78bfa', bg: 'rgba(167,139,250,0.06)', border: 'rgba(167,139,250,0.2)' },
              { label: 'L2 Pending', value: statsL2Pending, color: '#fbbf24', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)' },
              { label: 'L2 Scheduled', value: statsL2Scheduled, color: '#34d399', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)' },
            ].map((s) => (
              <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 'var(--radius-sm)', padding: '0.3rem 0.25rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '0.5rem', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Segmented Toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', padding: '2px', marginBottom: '1.5rem' }}>
          {[
            { key: 'list', label: 'Interviews Cockpit' },
            { key: 'tracker', label: 'Panelist Mapping Tracker' },
          ].map((v) => (
            <button key={v.key} onClick={() => setCockpitView(v.key as any)} style={{ flex: 1, background: cockpitView === v.key ? 'var(--primary)' : 'transparent', border: 'none', color: '#fff', padding: '0.4rem 0.75rem', fontSize: '0.85rem', fontWeight: 600, borderRadius: 'var(--radius-xs)', cursor: 'pointer', transition: 'background-color 0.2s' }}>
              {v.label}
            </button>
          ))}
        </div>

        {cockpitView === 'list' ? (
          <>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Active Interviews</h2>
              <button className="btn btn-primary btn-sm flex-gap-2" onClick={() => { setShowCreateForm(!showCreateForm); setSelectedInterview(null); }}>
                <Plus size={16} /> New Interview
              </button>
            </div>

            {interviews.length === 0 ? (
              <div className="glass-card text-center" style={{ padding: '4rem 2rem' }}>
                <CalendarCheck size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
                <h4 style={{ marginBottom: '0.5rem' }}>No Interviews Yet</h4>
                <p className="text-muted text-sm">Create a new interview schedule to nominate panels and book slots.</p>
              </div>
            ) : filteredInterviews.length === 0 ? (
              <div className="glass-card text-center" style={{ padding: '3rem 2rem' }}>
                <ListFilter size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 0.75rem', opacity: 0.4 }} />
                <h4 style={{ marginBottom: '0.5rem' }}>No matches</h4>
                <p className="text-muted text-sm">No interviews in this status. Try a different filter.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredInterviews.map((interview) => {
                  const totalPanels = interview.panels.length;
                  const submittedPanels = interview.panels.filter((p) => p.status === 'SUBMITTED').length;
                  const isSelected = selectedInterview?.id === interview.id;
                  const statusBorderColor = interview.status === 'SCHEDULED' ? '#10b981' : interview.status === 'COLLECTED' ? '#0ea5e9' : '#f59e0b';
                  const avatarColors = interview.status === 'SCHEDULED'
                    ? { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.3)', color: '#34d399' }
                    : interview.status === 'COLLECTED'
                    ? { bg: 'rgba(14,165,233,0.08)', border: 'rgba(14,165,233,0.3)', color: '#38bdf8' }
                    : { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)', color: '#fbbf24' };
                  const initials = interview.candidateName === 'Pending Assignment' ? '?' : interview.candidateName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

                  return (
                    <div
                      key={interview.id}
                      className={`glass-card ${isSelected ? 'selected-interview' : 'cockpit-card-hover'}`}
                      style={{ padding: '1rem 1.25rem 1rem 0', cursor: 'pointer', display: 'flex', gap: '0', overflow: 'hidden', transition: 'var(--transition-fast)' }}
                      onClick={() => { setSelectedInterview(interview); setShowCreateForm(false); setSelectedSlot(null); setDetailTab('overview'); }}
                    >
                      {/* Left accent: L1=blue, L2=purple, else status color */}
                      {(() => {
                        const isL1 = interview.role.toLowerCase().includes('l1');
                        const isL2 = interview.role.toLowerCase().includes('l2');
                        const typeColor = isL1 ? '#60a5fa' : isL2 ? '#a78bfa' : statusBorderColor;
                        return <div style={{ width: '4px', background: typeColor, flexShrink: 0, marginRight: '1rem', borderRadius: '4px 0 0 4px' }} />;
                      })()}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.65rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                            <div style={{ width: '36px', height: '36px', flexShrink: 0, background: avatarColors.bg, border: `1px solid ${avatarColors.border}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, color: avatarColors.color }}>
                              {initials}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1px', flexWrap: 'wrap' }}>
                                {/* L1 / L2 type pill */}
                                {interview.role.toLowerCase().includes('l1') && (
                                  <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.35)', color: '#60a5fa', letterSpacing: '0.04em', flexShrink: 0 }}>L1</span>
                                )}
                                {interview.role.toLowerCase().includes('l2') && (
                                  <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)', color: '#a78bfa', letterSpacing: '0.04em', flexShrink: 0 }}>L2</span>
                                )}
                                <h4 style={{ fontSize: '0.95rem', marginBottom: '0', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {interview.candidateName === 'Pending Assignment' ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontWeight: 500 }}>Pending Assignment</span> : interview.candidateName}
                                </h4>
                              </div>
                              <p className="text-muted" style={{ fontSize: '0.7rem', marginTop: '0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{interview.role}</p>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
                            {interview.status === 'PENDING' && <span className="badge badge-pending" style={{ fontSize: '0.6rem', whiteSpace: 'nowrap' }}>Awaiting Panels</span>}
                            {interview.status === 'COLLECTED' && <span className="badge badge-info" style={{ fontSize: '0.6rem', whiteSpace: 'nowrap' }}>Ready to Book</span>}
                            {interview.status === 'SCHEDULED' && <span className="badge badge-success" style={{ fontSize: '0.6rem', whiteSpace: 'nowrap' }}>Scheduled</span>}
                          </div>
                        </div>

                        {interview.panels && interview.panels.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: '0.75rem', padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <div>
                              <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: interview.status === 'COLLECTED' || interview.status === 'SCHEDULED' ? '#10b981' : 'var(--text-muted)', fontWeight: 700, marginBottom: '3px' }}>
                                {interview.status === 'COLLECTED' ? 'Availability Provided By (Accepted)' : interview.status === 'SCHEDULED' ? 'Confirmed Panels' : 'Sent Request To'}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                {interview.panels.map((p) => {
                                  const hasResponded = p.status === 'SUBMITTED';
                                  return (
                                    <span key={p.id} style={{ fontSize: '0.7rem', fontWeight: 500, padding: '0.15rem 0.4rem', borderRadius: '4px', background: hasResponded ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)', border: hasResponded ? '1px solid rgba(16,185,129,0.25)' : '1px solid var(--border-glass)', color: hasResponded ? '#10b981' : 'var(--text-main)', display: 'inline-flex', alignItems: 'center', gap: '3.5px' }}>
                                      {hasResponded && <CheckCircle size={10} />}{p.name}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                            {interview.panels.some((p) => p.status === 'PENDING') && (
                              <div style={{ marginTop: '0.25rem', borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '0.25rem' }}>
                                <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fbbf24', fontWeight: 700, marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <span className="animate-pulse" style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} /> Waiting on Response From
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                  {interview.panels.filter((p) => p.status === 'PENDING').map((p) => (
                                    <span key={p.id} style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24' }}>{p.name}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          {interview.status === 'SCHEDULED' && interview.scheduledSlotStart ? (
                            <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
                              <CheckCircle size={11} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
                              {new Date(interview.scheduledSlotStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {new Date(interview.scheduledSlotStart).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '0.7rem' }}>
                              <Clock size={10} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
                              {new Date(interview.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {new Date(interview.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {interview.status === 'COLLECTED' && (
                              <button className="btn btn-primary btn-xs" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'var(--secondary)', border: 'none', height: 'auto', display: 'flex', alignItems: 'center', gap: '2px' }}
                                onClick={(e) => { e.stopPropagation(); setSelectedInterview(interview); setShowCreateForm(false); setSelectedSlot(null); setDetailTab('booking'); }}>
                                <Calendar size={9} /> Book
                              </button>
                            )}
                            {interview.status === 'SCHEDULED' && interview.teamsMeetingUrl && (
                              <a href={interview.teamsMeetingUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-xs" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'var(--success)', border: 'none', height: 'auto', display: 'flex', alignItems: 'center', gap: '2px' }} onClick={(e) => e.stopPropagation()}>
                                <Video size={9} /> Join
                              </a>
                            )}
                            {/* Feedback reminder button — always shown for SCHEDULED, highlighted after slot ends */}
                            {interview.status === 'SCHEDULED' && (() => {
                              const slotEndTime = interview.scheduledSlotEnd ? new Date(interview.scheduledSlotEnd).getTime() : null;
                              const slotEnded = slotEndTime ? Date.now() > slotEndTime : false;
                              const isSending = sendingFeedbackReminderId === interview.id;
                              return (
                                <button
                                  className="btn btn-xs"
                                  disabled={isSending}
                                  onClick={(e) => handleSendFeedbackReminder(interview.id, e)}
                                  style={{
                                    fontSize: '0.65rem', padding: '0.15rem 0.5rem', borderRadius: '4px',
                                    height: 'auto', display: 'flex', alignItems: 'center', gap: '3px',
                                    background: slotEnded ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                                    border: slotEnded ? '1px solid rgba(167,139,250,0.4)' : '1px solid var(--border-glass)',
                                    color: slotEnded ? '#a78bfa' : 'var(--text-muted)',
                                    fontWeight: slotEnded ? 700 : 400,
                                    cursor: 'pointer',
                                  }}
                                  title={slotEnded ? 'Slot ended — send feedback reminder now' : 'Send feedback reminder to panelists'}
                                >
                                  {isSending ? <Loader2 size={9} className="animate-spin" /> : <Bell size={9} />}
                                  {slotEnded ? 'Remind Feedback' : 'Remind'}
                                </button>
                              );
                            })()}
                            {interview.status === 'PENDING' && (
                              <button className="btn btn-secondary btn-xs" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)', height: 'auto', display: 'flex', alignItems: 'center', gap: '2px', background: 'rgba(255,255,255,0.02)' }}
                                onClick={(e) => { e.stopPropagation(); setSelectedInterview(interview); setShowCreateForm(false); setDetailTab('panels'); }}>
                                <Users size={9} /> View Panels
                              </button>
                            )}
                            <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem', borderRadius: '4px', border: 'none', background: 'transparent' }} onClick={(e) => handleDeleteInterview(interview.id, e)}>
                              <Trash2 size={13} className="text-muted" style={{ transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'} onMouseLeave={(e) => e.currentTarget.style.color = ''} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Panelist Mapping Tracker View */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Responded */}
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 600, color: '#60a5fa', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={16} /> Responded Panelists (Availability Provided)
              </h3>
              {respondedNominations.length === 0 ? (
                <div className="glass-card text-center" style={{ padding: '2.5rem' }}>
                  <span className="text-muted text-xs">No responses received yet. Awaiting panelist actions.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {respondedNominations.map((nom) => (
                    <div key={nom.id} className="glass-card" style={{ padding: '1.25rem' }}>
                      <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px' }}>
                            {nom.interview.role.toLowerCase().includes('l1') && (
                              <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa' }}>L1</span>
                            )}
                            {nom.interview.role.toLowerCase().includes('l2') && (
                              <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}>L2</span>
                            )}
                            <strong style={{ fontSize: '0.95rem' }}>{nom.name}</strong>
                          </div>
                          <span className="text-muted text-xs block" style={{ opacity: 0.8 }}>{nom.email}</span>
                        </div>
                        <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Responded</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '0.6rem 0.8rem', borderRadius: '4px', marginTop: '0.5rem', marginBottom: '0.75rem' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '2px' }}>Interview Stage & Timing</div>
                        <div style={{ fontWeight: 600 }}>{nom.interview.role} ({nom.interview.duration} mins)</div>
                        {nom.interview.scheduledSlotStart && (
                          <div style={{ marginTop: '0.25rem', color: 'var(--text-main)', fontSize: '0.75rem' }}>Scheduled slot: <strong>{new Date(nom.interview.scheduledSlotStart).toLocaleString()}</strong></div>
                        )}
                      </div>
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                        {nom.interview.candidateName !== 'Pending Assignment' ? (
                          <div className="flex-between" style={{ alignItems: 'center' }}>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned Candidate</span>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)', marginTop: '2px' }}>{nom.interview.candidateName}</div>
                              {nom.interview.candidateEmail && nom.interview.candidateEmail !== 'pending@assign.com' && (
                                <span className="text-muted text-xs block">{nom.interview.candidateEmail}</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="btn btn-secondary btn-sm flex-gap-2" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', height: 'auto' }}
                                onClick={() => { setSelectedInterview(nom.interview); setEditStartDate(nom.interview.startDate.split('T')[0]); setEditEndDate(nom.interview.endDate.split('T')[0]); setDetailTab('overview'); setIsEditingDates(true); }}>
                                <Calendar size={11} /> Change Dates
                              </button>
                              <button className="btn btn-secondary btn-sm animate-pulse-once" style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', height: 'auto' }}
                                onClick={() => { setSelectedInterview(nom.interview); setCockpitView('list'); }}>
                                Edit Mapping / Details
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ padding: '0.25rem 0' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No Candidate Mapped</span>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                              * Please go to the <strong>Candidates Queue</strong> tab to map a candidate to this slot.
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending */}
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 600, color: '#f59e0b', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={16} /> Pending Response (Awaiting Availability)
              </h3>
              {pendingInterviews.length === 0 ? (
                <div className="glass-card text-center" style={{ padding: '2.5rem' }}>
                  <span className="text-muted text-xs">No pending requests. All panelists have responded.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {pendingInterviews.map((interview) => (
                    <div key={interview.id} className="glass-card" style={{ padding: '1.25rem' }}>
                      <div className="flex-between" style={{ alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2px' }}>
                            {interview.role.toLowerCase().includes('l1') && (
                              <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa' }}>L1</span>
                            )}
                            {interview.role.toLowerCase().includes('l2') && (
                              <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}>L2</span>
                            )}
                            <strong style={{ fontSize: '0.95rem' }}>
                              {interview.candidateName === 'Pending Assignment' ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontWeight: 500 }}>Pending Assignment</span> : interview.candidateName}
                            </strong>
                          </div>
                          <span className="text-muted text-xs block" style={{ opacity: 0.8, marginTop: '2px' }}>{interview.role} ({interview.duration} mins)</span>
                        </div>
                        <span className="badge badge-pending" style={{ fontSize: '0.7rem' }}>Awaiting Panels</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', marginTop: '0.5rem', marginBottom: '0.75rem' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '2px' }}>Proposed Date Window</div>
                        <div style={{ fontWeight: 600 }}>{new Date(interview.startDate).toLocaleDateString()} - {new Date(interview.endDate).toLocaleDateString()}</div>
                      </div>
                      {interview.panels && interview.panels.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.04)', marginBottom: '0.75rem' }}>
                          <div>
                            <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '3px' }}>Sent Request To</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                              {interview.panels.map((p) => (
                                <span key={p.id} style={{ fontSize: '0.7rem', fontWeight: 500, padding: '0.15rem 0.4rem', borderRadius: '4px', background: p.status === 'SUBMITTED' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)', border: p.status === 'SUBMITTED' ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border-glass)', color: p.status === 'SUBMITTED' ? '#10b981' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  {p.status === 'SUBMITTED' && <CheckCircle size={10} />}{p.name}
                                </span>
                              ))}
                            </div>
                          </div>
                          {interview.panels.some((p) => p.status === 'PENDING') && (
                            <div style={{ marginTop: '0.25rem', borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '0.25rem' }}>
                              <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fbbf24', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span className="animate-pulse" style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} /> Waiting on Response From
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                {interview.panels.filter((p) => p.status === 'PENDING').map((p) => (
                                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)', padding: '0.35rem 0.5rem', borderRadius: '4px' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#fbbf24' }}>{p.name}</span>
                                    <button onClick={() => handleResendInvite(interview.id, p.id)} className="btn btn-secondary btn-xs" style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', height: 'auto', display: 'flex', alignItems: 'center', gap: '2px' }} disabled={resendingPanelId === p.id}>
                                      {resendingPanelId === p.id ? <><Loader2 size={8} className="animate-spin" /> Sending...</> : 'Resend'}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button onClick={() => { setSelectedInterview(interview); setEditStartDate(interview.startDate.split('T')[0]); setEditEndDate(interview.endDate.split('T')[0]); setDetailTab('overview'); setIsEditingDates(true); }} className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', height: 'auto', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Calendar size={11} /> Change Dates
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: Dynamic form / Interview details */}
      <div>
        {/* Create Interview Form */}
        {showCreateForm && (
          <div className="glass-card" style={{ position: 'sticky', top: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Schedule New Interview</h3>
            <form onSubmit={handleCreateInterview}>
              <div className="form-group">
                <label className="form-label">Select Candidate (from WAITING Queue)</label>
                <select className="form-input" style={{ height: '36px' }}
                  value={candidates.find(c => c.name === candidateName && c.email === candidateEmail)?.id || ''}
                  onChange={(e) => {
                    const cand = candidates.find(c => c.id === e.target.value);
                    if (cand) { setCandidateName(cand.name); setCandidateEmail(cand.email); }
                    else { setCandidateName(''); setCandidateEmail(''); }
                  }} required>
                  <option value="">Select Candidate...</option>
                  {candidates.filter(c => c.status === 'WAITING').map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.email}) – {c.college}</option>
                  ))}
                </select>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Interview Stage</label>
                  <select className="form-input" value={interviewType} onChange={(e) => { setInterviewType(e.target.value as any); setSelectedPanels([]); }}>
                    <option value="L1">L1 Interview (Screening)</option>
                    <option value="L2">L2 Interview (System Design/Management)</option>
                    <option value="General">General / Custom Interview</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Job Title / Focus area</label>
                  <input type="text" className="form-input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Coding Loop, Manager Fit" required />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Duration</label>
                  <select className="form-input" value={duration} onChange={(e) => setDuration(e.target.value)}>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                  </select>
                </div>
                <div className="form-group" />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Proposed Range Start</label>
                  <input type="date" className="form-input" value={startDate} min={todayStr} onChange={(e) => { setStartDate(e.target.value); setCreateError(null); }} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Proposed Range End</label>
                  <input type="date" className="form-input" value={endDate} min={startDate || todayStr} onChange={(e) => { setEndDate(e.target.value); setCreateError(null); }} required />
                </div>
              </div>

              {/* Recommended panelists chips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', background: 'rgba(255,255,255,0.01)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                <span className="text-muted text-xs font-semibold flex-gap-2"><Check size={12} className="text-primary" /> Recommended {interviewType} Panelists</span>
                {recommendedPanelists.length === 0 ? (
                  <span className="text-muted text-xs" style={{ padding: '0.25rem 0' }}>No pre-approved panelists found for {interviewType}. Search corporate directory below.</span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                    {recommendedPanelists.map((p) => {
                      const isChosen = selectedPanels.some((sp) => sp.id === p.id);
                      const activeCount = activePanelistInterviewCount(p.id);
                      return (
                        <button type="button" key={p.id} onClick={() => handleToggleRecommendedPanelist(p)}
                          style={{ background: isChosen ? 'var(--primary-glow)' : 'rgba(255,255,255,0.03)', border: isChosen ? '1px solid var(--primary)' : '1px solid var(--border-glass)', color: isChosen ? 'var(--text-main)' : 'var(--text-muted)', padding: '0.3rem 0.75rem', borderRadius: '50px', fontSize: '0.75rem', cursor: 'pointer', transition: 'var(--transition-fast)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {p.displayName} {isChosen ? '✓' : '+'}
                          {activeCount > 0 && <span style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '9px', padding: '0 5px', fontSize: '0.6rem', fontWeight: 700 }}>{activeCount} active</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Directory search fallback */}
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Search Corporate Directory (Fallback)</label>
                <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                  <Search size={14} className="text-muted" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
                  <input type="text" className="form-input" style={{ paddingLeft: '2.25rem', fontSize: '0.875rem' }} value={panelSearchQuery} onChange={(e) => setPanelSearchQuery(e.target.value)} placeholder="Search another colleague..." />
                  {isSearchingPanels && <Loader2 size={14} className="animate-pulse text-muted" style={{ position: 'absolute', right: '12px' }} />}
                </div>
                {searchResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 16px rgba(0,0,0,0.5)', marginTop: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                    {searchResults.map((user) => (
                      <div key={user.id} style={{ padding: '0.5rem 1rem', cursor: 'pointer', transition: 'var(--transition-fast)' }} className="search-item-hover" onClick={() => handleAddPanel(user)}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user.displayName}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user.mail || user.userPrincipalName}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedPanels.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem', marginTop: '-0.25rem' }}>
                  {selectedPanels.map((panel) => (
                    <div key={panel.id} style={{ background: 'var(--primary-glow)', border: '1px solid var(--primary)', padding: '0.25rem 0.75rem', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                      <span>{panel.displayName}</span>
                      <button type="button" onClick={() => handleRemovePanel(panel.id)} style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {createError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.9rem', fontSize: '0.8rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <XCircle size={14} style={{ flexShrink: 0 }} /> {createError}
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={isLoading}>
                {isLoading ? <><Loader2 size={16} className="animate-spin" /> Dispatching Teams Invites...</> : 'Send Teams Invites'}
              </button>
            </form>
          </div>
        )}

        {/* Detail panel for selected interview */}
        {selectedInterview && (
          <div className="glass-card" style={{ position: 'sticky', top: '2rem' }}>
            {/* Header */}
            <div className="flex-between" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span className="text-muted text-xs block" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Interview Details</span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedInterview.candidateName === 'Pending Assignment' ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending Assignment</span> : selectedInterview.candidateName}
                </h3>
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>{selectedInterview.role} · {selectedInterview.duration} mins</span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedInterview(null)} style={{ flexShrink: 0, marginLeft: '0.75rem' }}>Close</button>
            </div>

            {/* Sub-tabs */}
            <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border-glass)', marginBottom: '1.25rem' }}>
              {([
                { key: 'overview', label: 'Overview', icon: <User size={13} /> },
                { key: 'panels', label: 'Panels', icon: <Users size={13} /> },
                { key: 'booking', label: 'Booking', icon: <Calendar size={13} /> },
                { key: 'feedback', label: 'Feedback', icon: <MessageSquare size={13} /> },
              ] as { key: typeof detailTab; label: string; icon: React.ReactNode }[]).map((tab) => (
                <button key={tab.key} onClick={() => setDetailTab(tab.key)}
                  style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: detailTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent', color: detailTab === tab.key ? 'var(--text-main)' : 'var(--text-muted)', padding: '0.5rem 0.25rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', transition: 'color 0.2s' }}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Overview Tab */}
            {detailTab === 'overview' && (
              <div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
                  <span className="text-muted text-xs block" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Candidate</span>
                  {selectedInterview.candidateName === 'Pending Assignment' ? (
                    <div>
                      <strong style={{ fontSize: '1rem', color: '#fb923c' }}>Pending Assignment</strong>
                      <span className="text-muted text-xs block" style={{ marginTop: '4px' }}>No candidate is currently mapped to this interview slot. Please go to the <strong>Candidates Queue</strong> tab to map a candidate.</span>
                    </div>
                  ) : (
                    <div>
                      <strong style={{ fontSize: '1rem', color: 'var(--primary)' }}>{selectedInterview.candidateName}</strong>
                      {selectedInterview.candidateEmail && selectedInterview.candidateEmail !== 'pending@assign.com' && (
                        <span className="text-muted text-xs block" style={{ marginTop: '2px' }}>{selectedInterview.candidateEmail}</span>
                      )}
                      <span className="text-muted block text-xxs" style={{ marginTop: '8px', fontStyle: 'italic' }}>* Candidate details and mapping can only be edited or modified from the Candidates Queue tab.</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  {[
                    { label: 'Stage', value: selectedInterview.role },
                    { label: 'Duration', value: `${selectedInterview.duration} minutes` },
                    { label: 'Status', value: selectedInterview.status === 'PENDING' ? 'Awaiting Panels' : selectedInterview.status === 'COLLECTED' ? 'Ready to Book' : selectedInterview.status === 'SCHEDULED' ? 'Scheduled' : selectedInterview.status },
                    { label: 'Date Window', value: `${new Date(selectedInterview.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(selectedInterview.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` },
                  ].map((item) => (
                    <div key={item.label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                      <div className="text-muted" style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{item.label}</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {/* Date editor */}
                {isEditingDates ? (
                  <div style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
                    <h4 style={{ color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Calendar size={15} className="text-primary" /> Change Interview Date Window
                    </h4>
                    <p className="text-muted text-xs" style={{ marginBottom: '1rem' }}>This will reset the availability collection flow and generate proposed slots in the new range.</p>
                    <form onSubmit={handleUpdateDates} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.72rem' }}>Start Date</label>
                          <input type="date" className="form-input" style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }} value={editStartDate} min={todayStr} onChange={(e) => setEditStartDate(e.target.value)} required />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.72rem' }}>End Date</label>
                          <input type="date" className="form-input" style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }} value={editEndDate} min={editStartDate || todayStr} onChange={(e) => setEditEndDate(e.target.value)} required />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={isUpdatingDates} style={{ flex: 1 }}>
                          {isUpdatingDates ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Save New Range'}
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsEditingDates(false)}>Cancel</button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary btn-sm flex-gap-2" onClick={() => { setEditStartDate(selectedInterview.startDate.split('T')[0]); setEditEndDate(selectedInterview.endDate.split('T')[0]); setIsEditingDates(true); }}>
                      <Calendar size={14} /> Change Date Window
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Panels Tab */}
            {detailTab === 'panels' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedInterview.panels.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No panels nominated.</div>
                ) : selectedInterview.panels.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: `1px solid ${p.status === 'SUBMITTED' ? 'rgba(16,185,129,0.2)' : 'var(--border-glass)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: p.status === 'SUBMITTED' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${p.status === 'SUBMITTED' ? 'rgba(16,185,129,0.3)' : 'var(--border-glass)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: p.status === 'SUBMITTED' ? '#10b981' : 'var(--text-muted)', flexShrink: 0 }}>
                        {p.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.name}</div>
                        <div className="text-muted text-xs">{p.email}</div>
                        {p.availabilities && p.availabilities.length > 0 && <div style={{ fontSize: '0.65rem', color: '#0ea5e9', marginTop: '2px' }}>{p.availabilities.length} slot{p.availabilities.length !== 1 ? 's' : ''} submitted</div>}
                      </div>
                    </div>
                    {p.status === 'SUBMITTED' ? (
                      <span className="badge badge-success" style={{ fontSize: '0.6rem' }}><CheckCircle size={9} style={{ display: 'inline', marginRight: '2px' }} />Responded</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span className="badge badge-pending" style={{ fontSize: '0.6rem' }}><Clock size={9} style={{ display: 'inline', marginRight: '2px' }} />Pending</span>
                        <button onClick={() => handleResendInvite(selectedInterview.id, p.id)} className="btn btn-secondary btn-sm" style={{ padding: '0.15rem 0.4rem', fontSize: '0.6rem', height: 'auto', display: 'flex', alignItems: 'center', gap: '2px' }} disabled={resendingPanelId === p.id}>
                          {resendingPanelId === p.id ? <><Loader2 size={8} className="animate-spin" /> Sending...</> : 'Resend Invite'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Booking Tab */}
            {detailTab === 'booking' && (
              <div>
                {selectedInterview.status === 'SCHEDULED' ? (
                  <div style={{ background: 'var(--success-glow)', border: '1px solid var(--success)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
                    <h4 style={{ color: 'var(--success)', fontSize: '1rem', marginBottom: '1rem' }} className="flex-gap-2"><CheckCircle size={18} /> Meeting Scheduled!</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      {[
                        { label: 'Panelist(s)', value: selectedInterview.panels.filter((p) => p.status === 'SUBMITTED').map((p) => p.name).join(', ') || 'None' },
                        { label: 'Date', value: new Date(selectedInterview.scheduledSlotStart || '').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
                        { label: 'Time Slot (UTC)', value: `${new Date(selectedInterview.scheduledSlotStart || '').toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} – ${new Date(selectedInterview.scheduledSlotEnd || '').toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` },
                      ].map((item) => (
                        <div key={item.label} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16,185,129,0.15)' }}>
                          <div className="text-muted text-xs" style={{ marginBottom: '2px' }}>{item.label}</div>
                          <strong style={{ fontSize: '0.9rem' }}>{item.value}</strong>
                        </div>
                      ))}
                    </div>
                    {selectedInterview.teamsMeetingUrl && (
                      <a href={selectedInterview.teamsMeetingUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary flex-gap-2" style={{ width: '100%', background: 'var(--success)', border: 'none', marginBottom: '0.5rem' }}>
                        <Video size={16} /> Join Teams Meeting
                      </a>
                    )}
                    <button onClick={handleCancelBooking} className="btn btn-secondary flex-gap-2" style={{ width: '100%', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }} disabled={isCancellingBooking}>
                      {isCancellingBooking ? <><Loader2 size={16} className="animate-spin" /> Cancelling Booking...</> : 'Remove Booked Slot / Cancel Meeting'}
                    </button>
                  </div>
                ) : (
                  <div>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', fontWeight: 600 }} className="flex-gap-2"><Calendar size={15} /> Overlapping Free Slots</h4>
                    {selectedInterview.panels.filter((p) => p.status === 'SUBMITTED').length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', border: '1px dashed var(--border-glass)', borderRadius: 'var(--radius-md)' }}>
                        <Info size={24} className="text-muted" style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>No availability yet.</div>
                        <p className="text-muted text-xs">Slots will appear once at least one panel member submits their availability.</p>
                      </div>
                    ) : commonSlots.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', border: '1px dashed var(--border-glass)', borderRadius: 'var(--radius-md)' }}>
                        <Info size={24} className="text-muted" style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>No overlapping slots.</div>
                        <p className="text-muted text-xs">No common {selectedInterview.duration}-min window found across all submissions.</p>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', marginBottom: '1.25rem', paddingRight: '4px' }}>
                          {commonSlots.map((slot, index) => {
                            const startObj = new Date(slot.start);
                            const endObj = new Date(slot.end);
                            const isSlotSelected = selectedSlot?.start === slot.start;
                            return (
                              <div key={index} onClick={() => setSelectedSlot(slot)}
                                style={{ padding: '0.75rem 1rem', cursor: 'pointer', background: isSlotSelected ? 'var(--primary-glow)' : 'rgba(255,255,255,0.01)', border: isSlotSelected ? '1px solid var(--primary)' : '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', transition: 'var(--transition-fast)' }}
                                className={!isSlotSelected ? 'search-item-hover' : ''}>
                                <div className="flex-between">
                                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{startObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}</span>
                                  <span style={{ fontSize: '0.8rem', color: isSlotSelected ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                                    {startObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - {endObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} (UTC)
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {selectedSlot && (
                          <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                            <div className="form-group">
                              <label className="form-label">Invitation Message / Agenda</label>
                              <textarea className="form-input" rows={3} style={{ resize: 'none' }} value={bookingDescription} onChange={(e) => setBookingDescription(e.target.value)} placeholder="Provide details about the interview topics..." />
                            </div>
                            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleBookSlot} disabled={isBooking}>
                              {isBooking ? <><Loader2 size={16} className="animate-spin" /> Scheduling Teams Event...</> : 'Confirm Teams Booking'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Feedback Tab */}
            {detailTab === 'feedback' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)' }}>
                  <MessageSquare size={15} /> Panel Feedback & Ratings
                </h4>
                {selectedInterview.panels.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', border: '1px dashed var(--border-glass)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No panels nominated for this interview.
                  </div>
                ) : (
                  selectedInterview.panels.map((p) => {
                    let parsed: any = null;
                    let isJson = false;
                    try { if (p.feedback && p.feedback.startsWith('{')) { parsed = JSON.parse(p.feedback); isJson = true; } } catch (e) {}
                    const hasSubmitted = p.status === 'SUBMITTED' && (p.feedback || p.decision);
                    return (
                      <div key={p.id} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                          <div>
                            <strong style={{ fontSize: '0.85rem', display: 'block' }}>{p.name}</strong>
                            <span className="text-muted text-xs block">{p.email}</span>
                          </div>
                          <div>
                            {hasSubmitted ? (
                              <span className={`badge ${p.decision === 'PASSED' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.6rem' }}>
                                {p.decision === 'PASSED' ? 'Passed' : 'Rejected'}
                              </span>
                            ) : (
                              <span className="badge badge-pending" style={{ fontSize: '0.6rem' }}>Pending</span>
                            )}
                          </div>
                        </div>
                        {!hasSubmitted ? (
                          <p className="text-muted text-xs font-italic" style={{ margin: 0 }}>Waiting for panelist feedback submission.</p>
                        ) : isJson && parsed ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Round: {parsed.type || 'L1/L2'}</div>
                            {parsed.type === 'L1' && parsed.scores && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {[['Coding & Problem Solving', parsed.scores.coding, parsed.notes?.codingNotes], ['Technical Communication', parsed.scores.communication, parsed.notes?.communicationNotes], ['CS Fundamentals', parsed.scores.fundamentals, parsed.notes?.fundamentalsNotes]].map(([label, score, note]) => (
                                  <div key={label as string}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                      <span style={{ fontWeight: 600 }}>{label}:</span>
                                      {renderStarsStatic(score as number)}
                                    </div>
                                    {note && <p style={{ color: 'var(--text-muted)', margin: '0 0 0.25rem 0', fontSize: '0.75rem', lineHeight: 1.4 }}>{note}</p>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {parsed.type === 'L2' && parsed.scores && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {[['System Design & Scalability', parsed.scores.systemDesign, parsed.notes?.systemDesignNotes], ['Technical Depth & Experience', parsed.scores.technicalDepth, parsed.notes?.technicalDepthNotes], ['Leadership & Ownership', parsed.scores.leadership, parsed.notes?.leadershipNotes], ['Cultural Fit & MS Values', parsed.scores.culturalFit, parsed.notes?.culturalFitNotes]].map(([label, score, note]) => (
                                  <div key={label as string}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                      <span style={{ fontWeight: 600 }}>{label}:</span>
                                      {renderStarsStatic(score as number)}
                                    </div>
                                    {note && <p style={{ color: 'var(--text-muted)', margin: '0 0 0.25rem 0', fontSize: '0.75rem', lineHeight: 1.4 }}>{note}</p>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {parsed.type === 'General' && parsed.scores && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {[['Technical Depth', parsed.scores.technical, parsed.notes?.technicalNotes], ['Communication', parsed.scores.communication, parsed.notes?.communicationNotes], ['Collaboration & Teamwork', parsed.scores.collaboration, parsed.notes?.collaborationNotes]].map(([label, score, note]) => (
                                  <div key={label as string}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                      <span style={{ fontWeight: 600 }}>{label}:</span>
                                      {renderStarsStatic(score as number)}
                                    </div>
                                    {note && <p style={{ color: 'var(--text-muted)', margin: '0 0 0.25rem 0', fontSize: '0.75rem', lineHeight: 1.4 }}>{note}</p>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {parsed.comments && (
                              <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.4rem', marginTop: '0.2rem' }}>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>Overall Comments</span>
                                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.78rem', lineHeight: 1.4 }}>{parsed.comments}</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>{p.feedback && <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.78rem', lineHeight: 1.4 }}>{p.feedback}</p>}</div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* Idle state */}
        {!showCreateForm && !selectedInterview && (
          <div className="glass-card text-center" style={{ padding: '6rem 2rem', position: 'sticky', top: '2rem' }}>
            <Calendar size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1.5rem', opacity: 0.3 }} />
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Select an Interview</h3>
            <p className="text-muted text-sm" style={{ maxWidth: '300px', margin: '0 auto' }}>
              Choose an interview card from the left panel to review responses, check overlaps, and book the meeting.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
