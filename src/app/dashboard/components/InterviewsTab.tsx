'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Calendar, User, Users, Clock, CheckCircle, XCircle,
  Search, Loader2, Trash2, Video, Check, Info, CalendarCheck,
  ListFilter, MessageSquare, Bell, Send, X, TrendingUp, AlertCircle, Compass
} from 'lucide-react';
import { Interview, Panelist, UploadedCandidate, InterviewPanel, College, Drive } from '@/lib/db';
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

interface InterviewsTabProps {
  interviews: Interview[];
  setInterviews: React.Dispatch<React.SetStateAction<Interview[]>>;
  panelists: Panelist[];
  candidates: UploadedCandidate[];
  setCandidates: React.Dispatch<React.SetStateAction<UploadedCandidate[]>>;
  todayStr: string;
  collegesList: College[];
  drives: Drive[];
  activeDrive: Drive | null;
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

function parseFeedbackSafely(rawFeedback: string | null | undefined) {
  if (!rawFeedback) return null;
  if (rawFeedback.trim().startsWith('{')) {
    try {
      return JSON.parse(rawFeedback);
    } catch (e) {
      return null;
    }
  }
  return null;
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
  collegesList,
  drives,
  activeDrive,
}: InterviewsTabProps) {
  // ── UI States ─────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'COLLECTED' | 'SCHEDULED'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'L1' | 'L2'>('L1');
  const [collegeFilter, setCollegeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  // Drive the dashboard scopes to. Defaults to the active drive, but the recruiter
  // can switch to any other drive here without changing the global active drive.
  const [selectedDriveId, setSelectedDriveId] = useState<string>(activeDrive?.id ?? 'all');
  const didInitDrive = useRef(false);
  const [showRepliedModal, setShowRepliedModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
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

  // On first load, default the dashboard's selected drive to the active drive.
  useEffect(() => {
    if (!didInitDrive.current && activeDrive) {
      setSelectedDriveId(activeDrive.id);
      didInitDrive.current = true;
    }
  }, [activeDrive]);

  // When the selected drive changes, scope the college filter and create-form
  // default dates to that drive (a range spanning start → end).
  useEffect(() => {
    const drive = drives.find((d) => d.id === selectedDriveId) ?? null;
    if (drive) {
      setCollegeFilter(drive.collegeName);
      setStartDate(drive.startDate);
      setEndDate(drive.endDate);
      setDateFilter(drive.startDate);
    } else {
      setCollegeFilter('all');
      setDateFilter('all');
    }
  }, [selectedDriveId, drives]);

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
  const selectedDrive = selectedDriveId === 'all' ? null : (drives.find((d) => d.id === selectedDriveId) ?? null);

  /** True when an interview falls inside the selected drive's date window. */
  const interviewInDriveWindow = (i: Interview, drive: Drive) => {
    // Verify college matches
    const candidate = candidates.find(c => c.email.toLowerCase() === i.candidateEmail.toLowerCase());
    if (candidate) {
      if (!candidate.collegeDrive || candidate.collegeDrive.toLowerCase() !== drive.collegeName.toLowerCase()) {
        return false;
      }
    } else {
      // For Pending Assignment: check if the college name is in the role
      if (!i.role.toLowerCase().includes(drive.collegeName.toLowerCase())) {
        return false;
      }
    }

    const ds = drive.startDate;
    const de = drive.endDate;
    if (i.status === 'SCHEDULED' && i.scheduledSlotStart) {
      const d = i.scheduledSlotStart.split('T')[0];
      return d >= ds && d <= de;
    }
    // Otherwise treat the interview's proposed window as overlapping the drive window.
    const iS = i.startDate.split('T')[0];
    const iE = i.endDate.split('T')[0];
    return iS <= de && iE >= ds;
  };

  const getFilteredInterviews = () => {
    let filtered = interviews;

    if (selectedDrive) {
      filtered = filtered.filter((i) => interviewInDriveWindow(i, selectedDrive));
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((i) => i.status === statusFilter);
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((i) => i.role.toLowerCase().includes(typeFilter.toLowerCase()));
    }

    if (dateFilter !== 'all') {
      filtered = filtered.filter((i) => {
        if (i.status === 'SCHEDULED' && i.scheduledSlotStart) {
          return i.scheduledSlotStart.split('T')[0] === dateFilter;
        }
        const startD = i.startDate.split('T')[0];
        const endD = i.endDate.split('T')[0];
        return dateFilter >= startD && dateFilter <= endD;
      });
    }

    if (collegeFilter !== 'all') {
      filtered = filtered.filter((i) => {
        const candidate = candidates.find(c => c.email.toLowerCase() === i.candidateEmail.toLowerCase());
        if (candidate) {
          return candidate.collegeDrive && candidate.collegeDrive.toLowerCase() === collegeFilter.toLowerCase();
        }
        return i.role.toLowerCase().includes(collegeFilter.toLowerCase());
      });
    }

    return filtered;
  };

  const filteredInterviewsList = getFilteredInterviews();

  // ── Drive Metrics ─────────────────────────────────────────────────────────
  const candidateCardTitle = typeFilter === 'all' ? 'Candidates' : `${typeFilter} Candidates`;

  // Filter candidates matching the current dashboard scopes (drive, college, date, type)
  const driveCandidatesRaw = candidates.filter((c) => {
    const matchesDrive = selectedDrive
      ? c.collegeDrive?.toLowerCase() === selectedDrive.collegeName.toLowerCase()
      : true;
    const matchesCollegeFilter = collegeFilter !== 'all'
      ? c.collegeDrive?.toLowerCase() === collegeFilter.toLowerCase()
      : true;
    const matchesDateFilter = dateFilter !== 'all'
      ? c.preferredDate === dateFilter
      : true;
    const matchesType = typeFilter === 'all' || 
      (typeFilter === 'L1' && (!c.outcomeStatus || c.outcomeStatus === 'PENDING')) ||
      (typeFilter === 'L2' && c.outcomeStatus === 'PASSED_L1');
    return matchesDrive && matchesCollegeFilter && matchesDateFilter && matchesType;
  });

  // Dynamic set of candidate emails mapped to active interviews of the current role/type
  const mappedEmails = new Set(
    interviews
      .filter((i) => {
        const matchesType = typeFilter === 'all' || i.role.toLowerCase().includes(typeFilter.toLowerCase());
        const isAssigned = i.candidateName !== 'Pending Assignment' && i.candidateEmail !== 'pending@assign.com';
        return matchesType && isAssigned;
      })
      .map((i) => i.candidateEmail.toLowerCase())
  );

  // Deduplicate candidates by email to avoid counting duplicates in metrics, prioritizing keeping 'MAPPED' status
  const uniqueDriveCandidatesMap = new Map<string, UploadedCandidate>();
  for (const c of driveCandidatesRaw) {
    const emailKey = c.email.toLowerCase();
    const existing = uniqueDriveCandidatesMap.get(emailKey);
    if (!existing || c.status === 'MAPPED') {
      uniqueDriveCandidatesMap.set(emailKey, c);
    }
  }
  const uniqueDriveCandidates = Array.from(uniqueDriveCandidatesMap.values());

  const driveCandidatesCount = uniqueDriveCandidates.length;
  const driveMapped = uniqueDriveCandidates.filter(
    (c) => c.status === 'MAPPED' || mappedEmails.has(c.email.toLowerCase())
  ).length;
  const drivePending = uniqueDriveCandidates.filter(
    (c) => c.status !== 'MAPPED' && !mappedEmails.has(c.email.toLowerCase())
  ).length;

  const candidateCardColor = typeFilter === 'L2' ? '#a78bfa' : '#60a5fa';
  const candidateCardBg = typeFilter === 'L2' ? 'rgba(167,139,250,0.08)' : 'rgba(96,165,250,0.08)';
  const candidateCardBorder = typeFilter === 'L2' ? '1px solid rgba(167,139,250,0.2)' : '1px solid rgba(96,165,250,0.2)';

  // Filter interviews matching current dashboard scopes (drive, type, date, college), independent of statusFilter
  const getInterviewsForMetrics = () => {
    let filtered = interviews;

    if (selectedDrive) {
      filtered = filtered.filter((i) => interviewInDriveWindow(i, selectedDrive));
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((i) => i.role.toLowerCase().includes(typeFilter.toLowerCase()));
    }

    if (dateFilter !== 'all') {
      filtered = filtered.filter((i) => {
        if (i.status === 'SCHEDULED' && i.scheduledSlotStart) {
          return i.scheduledSlotStart.split('T')[0] === dateFilter;
        }
        const startD = i.startDate.split('T')[0];
        const endD = i.endDate.split('T')[0];
        return dateFilter >= startD && dateFilter <= endD;
      });
    }

    if (collegeFilter !== 'all') {
      filtered = filtered.filter((i) => {
        const candidate = candidates.find(c => c.email.toLowerCase() === i.candidateEmail.toLowerCase());
        if (candidate) {
          return candidate.collegeDrive && candidate.collegeDrive.toLowerCase() === collegeFilter.toLowerCase();
        }
        return i.role.toLowerCase().includes(collegeFilter.toLowerCase());
      });
    }

    return filtered;
  };

  const interviewsForMetricsList = getInterviewsForMetrics();

  const drivePanels = interviewsForMetricsList.flatMap((i) =>
    i.panels.map((p) => ({
      ...p,
      candidateName: i.candidateName,
      role: i.role,
      interviewStatus: i.status,
      scheduledSlotStart: i.scheduledSlotStart,
      scheduledSlotEnd: i.scheduledSlotEnd,
      interviewDuration: i.duration
    }))
  );

  // Deduplicate drive panels by panelist email for requested/replied/rejected/pending slot request metrics,
  // accumulating candidate names, roles, and given slot timings for clear display.
  const getUniqueDrivePanels = (panelsList: typeof drivePanels) => {
    const panelsMap = new Map<string, typeof drivePanels[0] & {
      candidateNames: string[];
      roles: string[];
      givenSlots: { startTime: string; endTime: string }[];
    }>();

    for (const p of panelsList) {
      const emailKey = p.email.toLowerCase();
      const slots = p.status === 'SUBMITTED'
        ? (p.scheduledSlotStart
            ? [{ startTime: p.scheduledSlotStart, endTime: p.scheduledSlotEnd || '' }]
            : (p.availabilities || []).map(av => ({ startTime: av.startTime, endTime: av.endTime })))
        : [];

      const existing = panelsMap.get(emailKey);
      if (!existing) {
        panelsMap.set(emailKey, {
          ...p,
          candidateNames: [p.candidateName],
          roles: [p.role],
          givenSlots: slots
        });
      } else {
        if (!existing.candidateNames.includes(p.candidateName)) {
          existing.candidateNames.push(p.candidateName);
        }
        if (!existing.roles.includes(p.role)) {
          existing.roles.push(p.role);
        }

        // Accumulate given slots (avoiding duplicates)
        for (const s of slots) {
          const isDup = existing.givenSlots.some(
            (existSlot) => existSlot.startTime === s.startTime && existSlot.endTime === s.endTime
          );
          if (!isDup) {
            existing.givenSlots.push(s);
          }
        }

        // Resolve status: prioritize SUBMITTED, then REJECTED, then PENDING
        if (p.status === 'SUBMITTED') {
          existing.status = 'SUBMITTED';
          existing.submittedAt = p.submittedAt;
          existing.feedback = p.feedback;
          existing.decision = p.decision;
        } else if (p.status === 'REJECTED' && existing.status === 'PENDING') {
          existing.status = 'REJECTED';
          existing.submittedAt = p.submittedAt;
          existing.feedback = p.feedback;
          existing.decision = p.decision;
        }
      }
    }
    return Array.from(panelsMap.values());
  };

  const uniqueDrivePanels = getUniqueDrivePanels(drivePanels);

  const drivePanelistsRequested = uniqueDrivePanels.length;
  const drivePanelistsReplied = uniqueDrivePanels.filter((p) => p.status === 'SUBMITTED').length;
  const drivePanelistsRejected = uniqueDrivePanels.filter((p) => p.status === 'REJECTED').length;
  const drivePanelistsPending = uniqueDrivePanels.filter((p) => p.status === 'PENDING').length;

  const totalSlotsGiven = uniqueDrivePanels
    .filter((p) => p.status === 'SUBMITTED')
    .reduce((sum, p) => sum + (p.givenSlots?.length || 0), 0);

  const drivePassed = drivePanels.filter((p) => p.decision === 'PASSED').length;
  const driveRejected = drivePanels.filter((p) => p.decision === 'REJECTED').length;

  // ── Cohort Analytics (L1 & L2 breakdown, reacting to the selected drive + college/date filters) ──────────────
  const getOverallInterviewsForAnalytics = () => {
    let filtered = interviews;

    if (selectedDrive) {
      filtered = filtered.filter((i) => interviewInDriveWindow(i, selectedDrive));
    }

    if (dateFilter !== 'all') {
      filtered = filtered.filter((i) => {
        if (i.status === 'SCHEDULED' && i.scheduledSlotStart) {
          return i.scheduledSlotStart.split('T')[0] === dateFilter;
        }
        const startD = i.startDate.split('T')[0];
        const endD = i.endDate.split('T')[0];
        return dateFilter >= startD && dateFilter <= endD;
      });
    }

    if (collegeFilter !== 'all') {
      filtered = filtered.filter((i) => {
        const candidate = candidates.find(c => c.email.toLowerCase() === i.candidateEmail.toLowerCase());
        if (candidate) {
          return candidate.collegeDrive && candidate.collegeDrive.toLowerCase() === collegeFilter.toLowerCase();
        }
        return i.role.toLowerCase().includes(collegeFilter.toLowerCase());
      });
    }

    return filtered;
  };

  const overallInterviewsForAnalytics = getOverallInterviewsForAnalytics();

  const l1Filtered = overallInterviewsForAnalytics.filter((i) => i.role.toLowerCase().includes('l1'));
  const l2Filtered = overallInterviewsForAnalytics.filter((i) => i.role.toLowerCase().includes('l2'));

  // Find mapped emails for L1 and L2 separately
  const mappedL1Emails = new Set(
    interviews
      .filter((i) => i.role.toLowerCase().includes('l1') && i.candidateName !== 'Pending Assignment' && i.candidateEmail !== 'pending@assign.com')
      .map((i) => i.candidateEmail.toLowerCase())
  );

  const mappedL2Emails = new Set(
    interviews
      .filter((i) => i.role.toLowerCase().includes('l2') && i.candidateName !== 'Pending Assignment' && i.candidateEmail !== 'pending@assign.com')
      .map((i) => i.candidateEmail.toLowerCase())
  );

  const getCandidatesForBreakdown = () => {
    const rawList = candidates.filter((c) => {
      const matchesDrive = selectedDrive
        ? c.collegeDrive?.toLowerCase() === selectedDrive.collegeName.toLowerCase()
        : true;
      const matchesCollegeFilter = collegeFilter !== 'all'
        ? c.collegeDrive?.toLowerCase() === collegeFilter.toLowerCase()
        : true;
      const matchesDateFilter = dateFilter !== 'all'
        ? c.preferredDate === dateFilter
        : true;
      return matchesDrive && matchesCollegeFilter && matchesDateFilter;
    });

    const map = new Map<string, UploadedCandidate>();
    for (const c of rawList) {
      const emailKey = c.email.toLowerCase();
      const existing = map.get(emailKey);
      if (!existing || c.status === 'MAPPED') {
        map.set(emailKey, c);
      }
    }
    return Array.from(map.values());
  };

  const breakdownCandidates = getCandidatesForBreakdown();

  const l1Scheduled = l1Filtered.filter((i) => i.status === 'SCHEDULED').length;
  const l1Collected = l1Filtered.filter((i) => i.status === 'COLLECTED').length;
  const l1Pending = l1Filtered.filter((i) => i.status === 'PENDING').length;
  const l1CandidatesPending = breakdownCandidates.filter((c) => {
    const isWaiting = c.status === 'WAITING' && !mappedL1Emails.has(c.email.toLowerCase());
    const isL1 = !c.outcomeStatus || c.outcomeStatus === 'PENDING';
    return isWaiting && isL1;
  }).length;

  const l2Scheduled = l2Filtered.filter((i) => i.status === 'SCHEDULED').length;
  const l2Collected = l2Filtered.filter((i) => i.status === 'COLLECTED').length;
  const l2Pending = l2Filtered.filter((i) => i.status === 'PENDING').length;
  const l2CandidatesPending = breakdownCandidates.filter((c) => {
    const isWaiting = c.status === 'WAITING' && !mappedL2Emails.has(c.email.toLowerCase());
    const isL2 = c.outcomeStatus === 'PASSED_L1';
    return isWaiting && isL2;
  }).length;

  const l1Panels = l1Filtered.flatMap((i) => i.panels);
  const l1PanelsRequested = l1Panels.length;
  const l1PanelsReplied = l1Panels.filter((p) => p.status === 'SUBMITTED').length;

  const l2Panels = l2Filtered.flatMap((i) => i.panels);
  const l2PanelsRequested = l2Panels.length;
  const l2PanelsReplied = l2Panels.filter((p) => p.status === 'SUBMITTED').length;

  console.log('STATS_DEBUG:', {
    typeFilter,
    statusFilter,
    dateFilter,
    collegeFilter,
    overallLength: overallInterviewsForAnalytics.length,
    filteredLength: filteredInterviewsList.length,
    l1Scheduled,
    l2Scheduled,
    l1Pending,
    l2Pending
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header with Title and Action */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.25rem' }}>Interview Dashboard</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Overview of all L1 & L2 interviews, panelist responses, and scheduling status</p>
        </div>
        {/* <button className="btn btn-primary flex-gap-2" onClick={() => { setShowCreateForm(!showCreateForm); setSelectedInterview(null); }}>
          <Plus size={16} /> New Interview
        </button> */}
      </div>

      {/* Drive Selector — scopes the whole dashboard to one drive */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '0.85rem 1rem', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: 700, fontSize: '0.85rem' }}>
          <Compass size={16} /> Viewing Drive
        </div>
        <div style={{ minWidth: '240px' }}>
          <Select value={selectedDriveId} onValueChange={(val) => setSelectedDriveId(val || 'all')}>
            <SelectTrigger className="w-full text-left" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', fontSize: '0.9rem', height: '38px' }}>
              <SelectValue placeholder="All Drives" />
            </SelectTrigger>
            <SelectContent className="dark:bg-[#0e131f] dark:text-white border dark:border-zinc-800">
              <SelectItem value="all">All Drives</SelectItem>
              {drives.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.collegeName}{d.status === 'CLOSED' ? ' (Closed)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedDrive ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <Clock size={13} />
            <span>
              {selectedDrive.startDate === selectedDrive.endDate
                ? new Date(selectedDrive.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                : `${new Date(selectedDrive.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(selectedDrive.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`}
            </span>
            {selectedDrive.status === 'CLOSED' && <span className="badge badge-danger" style={{ fontSize: '0.6rem' }}>Closed</span>}
            {activeDrive?.id === selectedDrive.id && <span className="badge badge-success" style={{ fontSize: '0.6rem' }}>Active</span>}
          </div>
        ) : (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Showing interviews across all drives.</span>
        )}
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-lg)' }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Status</label>
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as any)}>
            <SelectTrigger className="w-full text-left" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', fontSize: '0.9rem', height: '38px' }}>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent className="dark:bg-[#0e131f] dark:text-white border dark:border-zinc-800">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="PENDING">Awaiting Panels</SelectItem>
              <SelectItem value="COLLECTED">Ready to Book</SelectItem>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Interview Type</label>
          <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val as any)}>
            <SelectTrigger className="w-full text-left" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', fontSize: '0.9rem', height: '38px' }}>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent className="dark:bg-[#0e131f] dark:text-white border dark:border-zinc-800">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="L1">L1 Interviews</SelectItem>
              <SelectItem value="L2">L2 Interviews</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Date</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="date"
              value={dateFilter === 'all' ? '' : dateFilter}
              onChange={(e) => setDateFilter(e.target.value || 'all')}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-sm)',
                color: 'inherit',
                fontSize: '0.9rem',
                cursor: 'pointer',
                colorScheme: 'dark'
              }}
            />
            {dateFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setDateFilter('all')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Clear date filter"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>College</label>
          <Select value={collegeFilter} onValueChange={(val) => setCollegeFilter(val || '')}>
            <SelectTrigger className="w-full text-left" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', fontSize: '0.9rem', height: '38px' }}>
              <SelectValue placeholder="All Colleges" />
            </SelectTrigger>
            <SelectContent className="dark:bg-[#0e131f] dark:text-white border dark:border-zinc-800">
              <SelectItem value="all">All Colleges</SelectItem>
              {collegesList.map((c) => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.5rem' }}>
        {/* Left Column: Interview List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Drive Metrics Dashboard */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {/* Card 1: Candidates Mapped */}
            <div style={{
              padding: '1rem',
              background: 'rgba(14,165,233,0.08)',
              border: '1px solid rgba(14,165,233,0.2)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '90px'
            }}>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', margin: 0, marginBottom: '0.3rem' }}>Candidates Mapped</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem' }}>
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0ea5e9', lineHeight: 1 }}>{driveMapped}</span>
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>/ {driveCandidatesCount}</span>
                </div>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {drivePending} pending
                </div>
              </div>
              <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '2.5px', overflow: 'hidden', marginTop: '0.4rem' }}>
                <div style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #0ea5e9, #22c55e)',
                  width: driveCandidatesCount > 0 ? `${(driveMapped / driveCandidatesCount) * 100}%` : '0%',
                  transition: 'width 0.3s ease-in-out'
                }} />
              </div>
            </div>

            {/* Card 2: Merged Panel Requests Overview (Interactive) */}
            <div
              onClick={() => setShowRepliedModal(true)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(167,139,250,0.12)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(167,139,250,0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              style={{
                padding: '1rem',
                background: 'rgba(167,139,250,0.08)',
                border: '1px solid rgba(167,139,250,0.2)',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '90px'
              }}
              title="Click to view details"
            >
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Panel Requests</span>
                <span style={{ fontSize: '0.55rem', textTransform: 'none', color: '#a78bfa', background: 'rgba(167,139,250,0.1)', padding: '1px 4px', borderRadius: '3px' }}>View list</span>
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.2rem' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>{drivePanelistsRequested}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>sent</span>
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.7rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ color: '#10b981', fontWeight: 600 }}>{drivePanelistsReplied} accepted ({totalSlotsGiven} slots)</span>
                <span style={{ color: '#ef4444', fontWeight: 600 }}>{drivePanelistsRejected} rejected</span>
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>{drivePanelistsPending} yet to respond</span>
              </div>
            </div>

            {/* Card 3: Interview Results (Interactive) */}
            <div
              onClick={() => setShowFeedbackModal(true)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(16,185,129,0.12)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(16,185,129,0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              style={{
                padding: '1rem',
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '90px'
              }}
              title="Click to view candidate feedback"
            >
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', margin: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{typeFilter === 'all' ? 'Interview Results' : `${typeFilter} Results`}</span>
                <span style={{ fontSize: '0.55rem', textTransform: 'none', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '1px 4px', borderRadius: '3px' }}>View feedback</span>
              </p>
              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'baseline', marginTop: '0.25rem' }}>
                <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 800, marginRight: '0.15rem' }}>{drivePassed}</span> passed
                </span>
                <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 800, marginRight: '0.15rem' }}>{driveRejected}</span> rejected
                </span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                {drivePanels.filter(p => p.decision === 'PASSED' || p.decision === 'REJECTED').length} feedback submitted
              </div>
            </div>
          </div>

          {/* Interviews List */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(() => {
              const panelRequestsList = filteredInterviewsList.flatMap<{
                key: string;
                interview: Interview;
                panel: InterviewPanel | null;
              }>((interview) => {
                if (interview.candidateName !== 'Pending Assignment') {
                  // Mapped interview: group panels together in a single card
                  return [{
                    key: `${interview.id}-mapped`,
                    interview,
                    panel: null
                  }];
                }
                
                // Unmapped (Pending Assignment) interview: one card per panel request
                if (interview.panels.length === 0) {
                  return [{
                    key: `${interview.id}-unassigned`,
                    interview,
                    panel: null
                  }];
                }
                return interview.panels.map((p) => ({
                  key: `${interview.id}-${p.id}`,
                  interview,
                  panel: p
                }));
              });

              if (panelRequestsList.length === 0) {
                return (
                  <div className="glass-card text-center" style={{ padding: '3rem 2rem' }}>
                    <CalendarCheck size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
                    <h4 style={{ marginBottom: '0.5rem' }}>No Interviews Found</h4>
                    <p className="text-muted text-sm">Create a new interview or adjust your filters.</p>
                  </div>
                );
              }

              return panelRequestsList.map(({ key, interview, panel }) => {
                const isSelected = selectedInterview?.id === interview.id;
                const isL1 = interview.role.toLowerCase().includes('l1');
                const isL2 = interview.role.toLowerCase().includes('l2');
                const typeColor = isL1 ? '#60a5fa' : isL2 ? '#a78bfa' : '#10b981';
                
                // Color status indicator based on this specific panel request
                const isSlotSubmitted = panel ? panel.status === 'SUBMITTED' : false;
                const statusColor = interview.status === 'SCHEDULED' 
                  ? '#10b981' 
                  : (panel 
                      ? (isSlotSubmitted ? '#0ea5e9' : '#f59e0b') 
                      : (interview.status === 'COLLECTED' ? '#0ea5e9' : '#f59e0b'));
                
                const initials = interview.candidateName === 'Pending Assignment' ? '?' : interview.candidateName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

                return (
                  <div
                    key={key}
                    onClick={() => { setSelectedInterview(interview); setShowInterviewModal(true); }}
                    style={{
                      padding: '1.25rem',
                      background: isSelected ? 'rgba(96,165,250,0.08)' : 'rgba(255,255,255,0.015)',
                      borderTop: isSelected ? '1px solid rgba(96,165,250,0.4)' : '1px solid var(--border-glass)',
                      borderRight: isSelected ? '1px solid rgba(96,165,250,0.4)' : '1px solid var(--border-glass)',
                      borderBottom: isSelected ? '1px solid rgba(96,165,250,0.4)' : '1px solid var(--border-glass)',
                      borderLeft: `4px solid ${typeColor}`,
                      borderRadius: 'var(--radius-lg)',
                      cursor: 'pointer',
                      transition: 'all 0.25s ease',
                      boxShadow: isSelected ? '0 4px 20px -5px rgba(96,165,250,0.15)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      {/* Avatar */}
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `${typeColor}12`, border: `1px solid ${typeColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0, color: typeColor }}>
                        {initials}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {/* Candidate Row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {isL1 && <span style={{ fontSize: '0.55rem', fontWeight: 800, padding: '0.1rem 0.35rem', background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.35)', borderRadius: '4px', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>L1</span>}
                          {isL2 && <span style={{ fontSize: '0.55rem', fontWeight: 800, padding: '0.1rem 0.35rem', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '4px', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>L2</span>}
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Candidate:</span>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>{interview.candidateName}</h4>
                        </div>

                        {/* Role Details */}
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, opacity: 0.9 }}>{interview.role}</p>

                        {/* Panelist Row & Status */}
                        {interview.candidateName !== 'Pending Assignment' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Panelists:</span>
                            {(() => {
                              const panelsToDisplay = interview.status === 'SCHEDULED'
                                ? interview.panels.filter((p) => p.status === 'SUBMITTED')
                                : interview.panels;
                              
                              // Fallback if none are submitted but it is scheduled
                              const finalPanels = panelsToDisplay.length > 0 ? panelsToDisplay : interview.panels;

                              return finalPanels.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingLeft: '0.5rem', borderLeft: '2px solid rgba(255, 255, 255, 0.08)' }}>
                                  {finalPanels.map((p) => (
                                    <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                      <strong style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                                        {p.name} ({p.email})
                                      </strong>
                                      
                                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                                        {/* Slots Badge */}
                                        {p.status === 'SUBMITTED' ? (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                            <span style={{
                                              fontSize: '0.65rem',
                                              fontWeight: 700,
                                              padding: '0.15rem 0.4rem',
                                              background: 'rgba(16, 185, 129, 0.1)',
                                              border: '1px solid rgba(16, 185, 129, 0.2)',
                                              borderRadius: '4px',
                                              color: '#10b981',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '0.25rem',
                                              width: 'fit-content'
                                            }}>
                                              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#10b981' }} />
                                              Slots Provided
                                            </span>
                                            {p.availabilities && p.availabilities.length > 0 && !interview.scheduledSlotStart && (
                                              <div style={{
                                                fontSize: '0.7rem',
                                                color: 'var(--text-muted)',
                                                paddingLeft: '0.5rem',
                                                borderLeft: '1px dashed rgba(16, 185, 129, 0.3)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.1rem'
                                              }}>
                                                {p.availabilities.map((av) => {
                                                  const start = new Date(av.startTime);
                                                  const end = new Date(av.endTime);
                                                  return (
                                                    <div key={av.id}>
                                                      {start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} &bull;{' '}
                                                      {start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <span style={{
                                            fontSize: '0.65rem',
                                            fontWeight: 700,
                                            padding: '0.15rem 0.4rem',
                                            background: 'rgba(245, 158, 11, 0.1)',
                                            border: '1px solid rgba(245, 158, 11, 0.2)',
                                            borderRadius: '4px',
                                            color: '#f59e0b',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.25rem'
                                          }}>
                                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#f59e0b' }} />
                                            Slots Pending
                                          </span>
                                        )}

                                        {/* Feedback Badge */}
                                        {p.decision === 'PASSED' ? (
                                          <span style={{
                                            fontSize: '0.65rem',
                                            fontWeight: 700,
                                            padding: '0.15rem 0.4rem',
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            border: '1px solid rgba(16, 185, 129, 0.2)',
                                            borderRadius: '4px',
                                            color: '#10b981',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.25rem'
                                          }}>
                                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#10b981' }} />
                                            Feedback: Passed
                                          </span>
                                        ) : p.decision === 'REJECTED' ? (
                                          <span style={{
                                            fontSize: '0.65rem',
                                            fontWeight: 700,
                                            padding: '0.15rem 0.4rem',
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            border: '1px solid rgba(239, 68, 68, 0.2)',
                                            borderRadius: '4px',
                                            color: '#ef4444',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.25rem'
                                          }}>
                                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ef4444' }} />
                                            Feedback: Rejected
                                          </span>
                                        ) : (
                                          <span style={{
                                            fontSize: '0.65rem',
                                            fontWeight: 700,
                                            padding: '0.15rem 0.4rem',
                                            background: 'rgba(245, 158, 11, 0.1)',
                                            border: '1px solid rgba(245, 158, 11, 0.2)',
                                            borderRadius: '4px',
                                            color: '#f59e0b',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.25rem'
                                          }}>
                                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#f59e0b' }} />
                                            Feedback: Pending
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <strong style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Awaiting assignment</strong>
                              );
                            })()}
                          </div>
                        ) : (
                          <>
                            {/* Panelist Row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Panelist:</span>
                              <strong style={{ color: panel ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: 600 }}>
                                {panel ? `${panel.name} (${panel.email})` : 'Awaiting assignment'}
                              </strong>
                            </div>

                            {/* Feedback / Response Status */}
                            {panel && (
                              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                                {/* Slots Badge */}
                                {panel.status === 'SUBMITTED' ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <span style={{
                                      fontSize: '0.65rem',
                                      fontWeight: 700,
                                      padding: '0.15rem 0.4rem',
                                      background: 'rgba(16, 185, 129, 0.1)',
                                      border: '1px solid rgba(16, 185, 129, 0.2)',
                                      borderRadius: '4px',
                                      color: '#10b981',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                      width: 'fit-content'
                                    }}>
                                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#10b981' }} />
                                      Slots Provided
                                    </span>
                                    {panel.availabilities && panel.availabilities.length > 0 && !interview.scheduledSlotStart && (
                                      <div style={{
                                        fontSize: '0.7rem',
                                        color: 'var(--text-muted)',
                                        paddingLeft: '0.5rem',
                                        borderLeft: '1px dashed rgba(16, 185, 129, 0.3)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.1rem'
                                      }}>
                                        {panel.availabilities.map((av) => {
                                          const start = new Date(av.startTime);
                                          const end = new Date(av.endTime);
                                          return (
                                            <div key={av.id}>
                                              {start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} &bull;{' '}
                                              {start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    padding: '0.15rem 0.4rem',
                                    background: 'rgba(245, 158, 11, 0.1)',
                                    border: '1px solid rgba(245, 158, 11, 0.2)',
                                    borderRadius: '4px',
                                    color: '#f59e0b',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                  }}>
                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#f59e0b' }} />
                                    Slots Pending
                                  </span>
                                )}

                                {/* Feedback Badge */}
                                {panel.decision === 'PASSED' ? (
                                  <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    padding: '0.15rem 0.4rem',
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                    borderRadius: '4px',
                                    color: '#10b981',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                  }}>
                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#10b981' }} />
                                    Feedback: Passed
                                  </span>
                                ) : panel.decision === 'REJECTED' ? (
                                  <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    padding: '0.15rem 0.4rem',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    borderRadius: '4px',
                                    color: '#ef4444',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                  }}>
                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ef4444' }} />
                                    Feedback: Rejected
                                  </span>
                                ) : (
                                  <span style={{
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    padding: '0.15rem 0.4rem',
                                    background: 'rgba(245, 158, 11, 0.1)',
                                    border: '1px solid rgba(245, 158, 11, 0.2)',
                                    borderRadius: '4px',
                                    color: '#f59e0b',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                  }}>
                                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#f59e0b' }} />
                                    Feedback: Pending
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {/* Timing Block */}
                        <div style={{ fontSize: '0.75rem', color: statusColor, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
                          {interview.scheduledSlotStart ? (
                            <>
                              <CalendarCheck size={13} style={{ color: statusColor }} />
                              <span>
                                {new Date(interview.scheduledSlotStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })} &bull;{' '}
                                {new Date(interview.scheduledSlotStart).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} –{' '}
                                {new Date(interview.scheduledSlotEnd || (new Date(interview.scheduledSlotStart).getTime() + (interview.duration || 60) * 60000)).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}{' '}
                                ({interview.duration}m)
                              </span>
                            </>
                          ) : (
                            <>
                              <Clock size={13} style={{ color: statusColor }} />
                              <span>
                                Pref: {new Date(interview.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – {new Date(interview.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
                                ({interview.duration}m)
                              </span>
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
              });
            })()}
          </div>
        </div>

        {/* Right Column: Analytics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Analytics Header */}
          <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={18} /> Analytics Overview
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              {/* L1 Cohort */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderRight: '1px solid var(--border-glass)', paddingRight: '1.25rem' }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#60a5fa', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>L1 Cohort</h4>
                
                <div>
                  <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0 0 0.5rem 0' }}>Status Overview</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {[
                      { label: 'Scheduled', value: l1Scheduled, color: '#10b981' },
                      { label: 'Ready to Book', value: l1Collected, color: '#0ea5e9' },
                      { label: 'Panelists yet to respond', value: l1Pending, color: '#f59e0b' },
                      { label: 'Candidates Pending', value: l1CandidatesPending, color: '#94a3b8' },
                    ].map((stat) => (
                      <div key={stat.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: stat.color }} />
                          {stat.label}
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--text-normal)' }}>{stat.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                  <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0 0 0.4rem 0' }}>Panelist Responses</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#60a5fa', width: l1PanelsRequested > 0 ? `${(l1PanelsReplied / l1PanelsRequested) * 100}%` : '0%', transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{l1PanelsReplied}/{l1PanelsRequested}</span>
                  </div>
                </div>
              </div>

              {/* L2 Cohort */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#a78bfa', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>L2 Cohort</h4>
                
                <div>
                  <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0 0 0.5rem 0' }}>Status Overview</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {[
                      { label: 'Scheduled', value: l2Scheduled, color: '#10b981' },
                      { label: 'Ready to Book', value: l2Collected, color: '#0ea5e9' },
                      { label: 'Panelists yet to respond', value: l2Pending, color: '#f59e0b' },
                      { label: 'Candidates Pending', value: l2CandidatesPending, color: '#94a3b8' },
                    ].map((stat) => (
                      <div key={stat.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: stat.color }} />
                          {stat.label}
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--text-normal)' }}>{stat.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                  <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', margin: '0 0 0.4rem 0' }}>Panelist Responses</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#a78bfa', width: l2PanelsRequested > 0 ? `${(l2PanelsReplied / l2PanelsRequested) * 100}%` : '0%', transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{l2PanelsReplied}/{l2PanelsRequested}</span>
                  </div>
                </div>
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
                
                <Select value={interviewType} onValueChange={(val) => setInterviewType(val as any)}>
                  <SelectTrigger className="w-full text-left" style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', fontSize: '0.9rem', height: '38px' }}>
                    <SelectValue placeholder="Select Interview Type" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-[#0e131f] dark:text-white border dark:border-zinc-800">
                    <SelectItem value="L1">L1 Interview</SelectItem>
                    <SelectItem value="L2">L2 Interview</SelectItem>
                    <SelectItem value="General">General Interview</SelectItem>
                  </SelectContent>
                </Select>

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
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.75rem 0' }}>
                  {selectedInterview.status === 'SCHEDULED' ? 'Panelist' : 'Panel Members'}
                </h3>
                {(() => {
                  const panelsToDisplay = selectedInterview.status === 'SCHEDULED'
                    ? selectedInterview.panels.filter((p) => p.status === 'SUBMITTED')
                    : selectedInterview.panels;
                  const finalPanels = panelsToDisplay.length > 0 ? panelsToDisplay : selectedInterview.panels;

                  if (finalPanels.length === 0) {
                    return <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>No panels assigned</p>;
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {finalPanels.map((p) => (
                        <div key={p.id} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <div>
                              <p style={{ fontSize: '0.9rem', fontWeight: 600, margin: '0 0 0.2rem 0' }}>{p.name}</p>
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Status: {p.status === 'SUBMITTED' ? '✓ Responded' : 'Pending'}</p>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              {/* Send Reminder button if booked and feedback decision is pending */}
                              {selectedInterview.status === 'SCHEDULED' && p.status === 'SUBMITTED' && !p.decision && (
                                <button
                                  onClick={(e) => handleSendFeedbackReminder(selectedInterview.id, e)}
                                  disabled={sendingFeedbackReminderId === selectedInterview.id}
                                  style={{
                                    padding: '0.35rem 0.75rem',
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: '#a5b4fc',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  {sendingFeedbackReminderId === selectedInterview.id ? 'Sending...' : 'Send Reminder'}
                                </button>
                              )}

                              {p.status === 'PENDING' && (
                                <button onClick={() => handleResendInvite(selectedInterview.id, p.id)} disabled={resendingPanelId === p.id} style={{ padding: '0.35rem 0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                                  {resendingPanelId === p.id ? 'Resending...' : 'Resend'}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Render Decision & Feedback Details directly for this panel if submitted */}
                          {p.decision && (
                            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', width: '100%' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Decision:</span>
                                <span style={{
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  padding: '0.15rem 0.45rem',
                                  background: p.decision === 'PASSED' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                  border: p.decision === 'PASSED' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                                  borderRadius: '4px',
                                  color: p.decision === 'PASSED' ? '#10b981' : '#ef4444',
                                  textTransform: 'uppercase'
                                }}>
                                  {p.decision}
                                </span>
                              </div>

                              {/* Feedback Comments */}
                              {p.feedback && (() => {
                                try {
                                  const parsed = JSON.parse(p.feedback);
                                  
                                  // Determine L1 vs L2 structure
                                  const scores = parsed.scores || {};
                                  const notes = parsed.notes || {};
                                  
                                  return (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-normal)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                      {/* Scores Grid */}
                                      {Object.keys(scores).length > 0 && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.5rem', background: 'rgba(0,0,0,0.15)', padding: '0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.02)' }}>
                                          {Object.entries(scores).map(([key, val]) => (
                                            <div key={key} style={{ display: 'flex', flexDirection: 'column' }}>
                                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{key}</span>
                                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8' }}>{String(val)} / 5</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      
                                      {/* Notes / Comments */}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', background: 'rgba(0,0,0,0.1)', padding: '0.5rem', borderRadius: '4px' }}>
                                        {Object.entries(notes).map(([key, val]) => {
                                          if (!val) return null;
                                          // Format label nicely (e.g. codingNotes -> Coding Notes)
                                          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                                          return (
                                            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>{label}:</span>
                                              <span style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{String(val)}</span>
                                            </div>
                                          );
                                        })}
                                        
                                        {/* Fallback to simple comments if no notes entries match */}
                                        {Object.keys(notes).length === 0 && parsed.comments && (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>Comments:</span>
                                            <span style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{String(parsed.comments)}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                } catch (e) {
                                  // Fallback for non-JSON or plain text feedback
                                  return (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-normal)', margin: 0, whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.15)', padding: '0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.02)' }}>
                                      {p.feedback}
                                    </p>
                                  );
                                }
                              })()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
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
              
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1.25rem' }}>
                <ConfirmDialog
                  trigger={
                    <button style={{ width: '100%', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', color: '#f87171', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} />
                  }
                  triggerChildren={
                    <>
                      <Trash2 size={16} /> Delete Interview
                    </>
                  }
                  title="Delete this interview?"
                  description="This will soft-delete the interview record and release any mapped candidates. If a Teams meeting was scheduled, the calendar event will also be removed."
                  confirmLabel="Yes, Delete"
                  onConfirm={() => {
                    handleDeleteInterview(selectedInterview.id);
                    setShowInterviewModal(false);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Panelist Availability Status Dialog Box */}
      {showRepliedModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--background)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-xl)', width: '90%', maxWidth: '550px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Panelist Availability Status</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '0.25rem 0 0 0' }}>Detailed response status for the filtered interviews cohort</p>
              </div>
              <button onClick={() => setShowRepliedModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* 1st Priority: Yet to Respond Section */}
              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Clock size={14} /> Yet to Respond ({uniqueDrivePanels.filter(p => p.status === 'PENDING').length})
                </h4>
                {uniqueDrivePanels.filter(p => p.status === 'PENDING').length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, paddingLeft: '1.25rem' }}>All panel members have responded.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.50rem' }}>
                    {uniqueDrivePanels.filter(p => p.status === 'PENDING').map((panel, idx) => (
                      <div key={`${panel.id}-${idx}`} style={{ padding: '0.6rem 0.8rem', background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{panel.name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{panel.email}</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                          <div>Candidate: {panel.candidateNames.join(', ')}</div>
                          <div>Role: {panel.roles.join(', ')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2nd Priority: Rejected Section */}
              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <XCircle size={14} /> Rejected ({uniqueDrivePanels.filter(p => p.status === 'REJECTED').length})
                </h4>
                {uniqueDrivePanels.filter(p => p.status === 'REJECTED').length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, paddingLeft: '1.25rem' }}>No rejected nominations.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.50rem' }}>
                    {uniqueDrivePanels.filter(p => p.status === 'REJECTED').map((panel, idx) => (
                      <div key={`${panel.id}-${idx}`} style={{ padding: '0.6rem 0.8rem', background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{panel.name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{panel.email}</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                          <div>Candidate: {panel.candidateNames.join(', ')}</div>
                          <div>Role: {panel.roles.join(', ')}</div>
                        </div>
                        {panel.feedback && (
                          <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '0.2rem', padding: '0.3rem 0.5rem', background: 'rgba(239,68,68,0.08)', borderRadius: '4px', borderLeft: '2px solid #ef4444' }}>
                            <strong>Reason:</strong> {panel.feedback}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3rd Priority: Accepted Section */}
              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle size={14} /> Accepted ({uniqueDrivePanels.filter(p => p.status === 'SUBMITTED').length})
                </h4>
                {uniqueDrivePanels.filter(p => p.status === 'SUBMITTED').length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, paddingLeft: '1.25rem' }}>No responses yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.50rem' }}>
                    {uniqueDrivePanels.filter(p => p.status === 'SUBMITTED').map((panel, idx) => (
                      <div key={`${panel.id}-${idx}`} style={{ padding: '0.6rem 0.8rem', background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{panel.name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{panel.email}</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                          <div>Candidate: {panel.candidateNames.join(', ')}</div>
                          <div>Role: {panel.roles.join(', ')}</div>
                        </div>
                        {panel.givenSlots && panel.givenSlots.length > 0 && (
                          <div style={{ marginTop: '0.4rem', paddingTop: '0.4rem', borderTop: '1px dashed rgba(16,185,129,0.2)' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Clock size={11} />
                              Slots Provided ({panel.givenSlots.length}):
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '0.85rem' }}>
                              {panel.givenSlots.map((slot, sIdx) => {
                                const start = new Date(slot.startTime);
                                const end = new Date(slot.endTime);
                                return (
                                  <div key={sIdx} style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    {start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} &bull;{' '}
                                    <span style={{ fontWeight: 600, color: 'inherit' }}>
                                      {start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(255,255,255,0.01)' }}>
              <button className="btn btn-secondary" onClick={() => setShowRepliedModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Evaluation Feedback Dialog Box */}
      {showFeedbackModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--background)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-xl)', width: '90%', maxWidth: '650px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Candidate Evaluation Feedback</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '0.25rem 0 0 0' }}>Detailed feedback and outcomes from panelists for this cohort</p>
              </div>
              <button onClick={() => setShowFeedbackModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {drivePanels.filter(p => p.decision === 'PASSED' || p.decision === 'REJECTED').length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                  <MessageSquare size={36} style={{ opacity: 0.3, margin: '0 auto 0.75rem' }} />
                  <p style={{ fontSize: '0.85rem', margin: 0 }}>No panelist evaluation feedback has been submitted for this cohort yet.</p>
                </div>
              ) : (
                drivePanels.filter(p => p.decision === 'PASSED' || p.decision === 'REJECTED').map((panel, idx) => {
                  const parsed = parseFeedbackSafely(panel.feedback);
                  const isPassed = panel.decision === 'PASSED';
                  const outcomeColor = isPassed ? '#10b981' : '#ef4444';
                  const outcomeBg = isPassed ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)';
                  const outcomeBorder = isPassed ? '1px solid rgba(16,185,129,0.15)' : '1px solid rgba(239,68,68,0.15)';

                  return (
                    <div key={`${panel.id}-${idx}`} style={{ padding: '1rem', background: outcomeBg, border: outcomeBorder, borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-normal)' }}>{panel.candidateName}</h4>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{panel.role}</span>
                        </div>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.2rem 0.5rem', background: `${outcomeColor}15`, border: `1px solid ${outcomeColor}30`, borderRadius: '4px', color: outcomeColor }}>
                          {isPassed ? 'PASSED' : 'REJECTED'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.78rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.6rem', marginTop: '0.2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '0.4rem', fontSize: '0.72rem' }}>
                          <span>Evaluated by: <strong>{panel.name}</strong> ({panel.email})</span>
                        </div>

                        {/* Structured Scores if available */}
                        {parsed && parsed.scores && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', margin: '0.5rem 0', background: 'rgba(255,255,255,0.01)', padding: '0.5rem', borderRadius: '4px' }}>
                            {Object.entries(parsed.scores).map(([metric, score]) => {
                              const displayNames: Record<string, string> = {
                                coding: 'Coding & Problem Solving',
                                communication: 'Technical Communication',
                                fundamentals: 'CS Fundamentals',
                                systemDesign: 'System Design & Scalability',
                                technicalDepth: 'Technical Depth & Experience',
                                leadership: 'Leadership & Ownership',
                                culturalFit: 'Cultural Fit & MS Values',
                                technical: 'Technical Depth',
                                collaboration: 'Collaboration & Teamwork'
                              };
                              return (
                                <div key={metric} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{displayNames[metric] || metric}:</span>
                                  {renderStarsStatic(score as number)}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Comments / Feedback Text */}
                        <div style={{ marginTop: '0.4rem' }}>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Evaluation Comments</span>
                          <p style={{ margin: 0, color: 'var(--text-normal)', fontSize: '0.8rem', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                            {parsed ? parsed.comments : (panel.feedback || 'No comments provided.')}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'flex-end', background: 'rgba(255,255,255,0.01)' }}>
              <button className="btn btn-secondary" onClick={() => setShowFeedbackModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
