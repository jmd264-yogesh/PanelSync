'use client';

import React, { useState, useEffect } from 'react';
import { 
  Interview, 
  InterviewPanel, 
  PanelAvailability,
  Panelist
} from '@/lib/db';
import { GraphUser } from '@/lib/graph';
import { 
  Plus, 
  Calendar, 
  User, 
  Mail, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Search, 
  Loader2, 
  Trash2, 
  Video, 
  Check, 
  Info,
  CalendarCheck,
  ChevronRight,
  Shield,
  Settings,
  ListFilter
} from 'lucide-react';

interface DashboardClientProps {
  initialInterviews: Interview[];
  initialPanelists: Panelist[];
}

export default function DashboardClient({ initialInterviews, initialPanelists }: DashboardClientProps) {
  // Navigation & DB States
  const [activeTab, setActiveTab] = useState<'interviews' | 'panelists'>('interviews');
  const [interviews, setInterviews] = useState<Interview[]>(initialInterviews);
  const [panelists, setPanelists] = useState<Panelist[]>(initialPanelists);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);

  // View States
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cockpitView, setCockpitView] = useState<'list' | 'tracker'>('list');

  // Scheduler Form States (Original Flow)
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

  // Booking details States (Original Flow)
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [bookingDescription, setBookingDescription] = useState('');
  const [isBooking, setIsBooking] = useState(false);

  // Admin Tab: Panelist Management States
  const [adminQuery, setAdminQuery] = useState('');
  const [adminSearchResults, setAdminSearchResults] = useState<GraphUser[]>([]);
  const [isAdminSearching, setIsAdminSearching] = useState(false);
  const [adminSelectedUser, setAdminSelectedUser] = useState<GraphUser | null>(null);
  const [adminRoles, setAdminRoles] = useState<('L1' | 'L2')[]>(['L1']);
  const [panelistFilterText, setPanelistFilterText] = useState('');
  const [isAdminSaving, setIsAdminSaving] = useState(false);

  // Config States for L1/L2 Interview Periods
  const [l1TimeStart, setL1TimeStart] = useState('10:00');
  const [l1TimeEnd, setL1TimeEnd] = useState('13:00');
  const [l2TimeStart, setL2TimeStart] = useState('14:00');
  const [l2TimeEnd, setL2TimeEnd] = useState('17:00');

  // Panelist-First slot request form states (New Flow)
  const [reqPanelist, setReqPanelist] = useState<Panelist | null>(null);
  const [reqDuration, setReqDuration] = useState('30');
  const [reqStartDate, setReqStartDate] = useState('');
  const [reqEndDate, setReqEndDate] = useState('');
  const [reqInterviewType, setReqInterviewType] = useState<'L1' | 'L2' | 'General'>('L1');
  const [reqSlots, setReqSlots] = useState<{ startTime: string; endTime: string; selected: boolean }[]>([]);
  const [isRequestingSlot, setIsRequestingSlot] = useState(false);

  // Assign Candidate form states (New Flow)
  const [assignCandidateName, setAssignCandidateName] = useState('');
  const [assignCandidateEmail, setAssignCandidateEmail] = useState('');
  const [isAssigningCandidate, setIsAssigningCandidate] = useState(false);
  const [isEditingMapping, setIsEditingMapping] = useState(false);
  const [sendAsTeamsMeeting, setSendAsTeamsMeeting] = useState(true);

  // Sync selected interview details if the interviews list updates & sync candidate assignment form values
  useEffect(() => {
    if (selectedInterview) {
      const updated = interviews.find((i) => i.id === selectedInterview.id);
      setSelectedInterview(updated || null);
      if (updated) {
        if (updated.candidateName !== 'Pending Assignment') {
          setAssignCandidateName(updated.candidateName);
          setAssignCandidateEmail(updated.candidateEmail === 'pending@assign.com' ? '' : updated.candidateEmail);
        } else {
          setAssignCandidateName('');
          setAssignCandidateEmail('');
        }
      }
    } else {
      setAssignCandidateName('');
      setAssignCandidateEmail('');
      setIsEditingMapping(false);
    }
  }, [interviews, selectedInterview]);

  // Autocomplete search for scheduler panels
  useEffect(() => {
    if (panelSearchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingPanels(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(panelSearchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          const filtered = data.filter(
            (u: GraphUser) => !selectedPanels.some((sp) => sp.id === u.id)
          );
          setSearchResults(filtered);
        }
      } catch (err) {
        console.error('Error searching panels:', err);
      } finally {
        setIsSearchingPanels(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [panelSearchQuery, selectedPanels]);

  // Autocomplete search for admin panelist registration
  useEffect(() => {
    if (adminQuery.trim().length < 2) {
      setAdminSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsAdminSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(adminQuery)}`);
        if (res.ok) {
          const data = await res.json();
          // Filter out users already in local panelist database
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

    return () => clearTimeout(delayDebounceFn);
  }, [adminQuery, panelists]);

  // Automatically compute proposed slot list based on config and date ranges
  useEffect(() => {
    if (reqPanelist && reqStartDate && reqEndDate) {
      const timingStart = reqInterviewType === 'L1' ? l1TimeStart : l2TimeStart;
      const timingEnd = reqInterviewType === 'L1' ? l1TimeEnd : l2TimeEnd;
      
      const [startH, startM] = timingStart.split(':').map(Number);
      const [endH, endM] = timingEnd.split(':').map(Number);

      const generated: { startTime: string; endTime: string; selected: boolean }[] = [];
      
      // Setup current and end date
      const currentDay = new Date(reqStartDate);
      const endDay = new Date(reqEndDate);

      while (currentDay <= endDay) {
        const year = currentDay.getFullYear();
        const month = currentDay.getMonth();
        const date = currentDay.getDate();

        const dayStart = new Date(year, month, date, startH, startM, 0);
        const dayEnd = new Date(year, month, date, endH, endM, 0);

        let time = dayStart.getTime();
        const stepMs = 30 * 60 * 1000; // 30 mins interval

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
  }, [reqPanelist, reqStartDate, reqEndDate, reqInterviewType, l1TimeStart, l1TimeEnd, l2TimeStart, l2TimeEnd]);

  // Recommended panelists based on interview level
  const recommendedPanelists = panelists.filter((p) => {
    if (interviewType === 'General') return true;
    return p.roles.includes(interviewType as 'L1' | 'L2');
  });

  // Handle adding panel from recommendations/search
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
      setSelectedPanels([
        ...selectedPanels,
        {
          id: p.id,
          displayName: p.displayName,
          mail: p.email,
          userPrincipalName: p.email,
        },
      ]);
    }
  };

  const handleRemovePanel = (userId: string) => {
    setSelectedPanels(selectedPanels.filter((p) => p.id !== userId));
  };

  // Open the slot request preview modal
  const handleOpenSlotRequest = (p: Panelist, stage: 'L1' | 'L2') => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    setReqPanelist(p);
    setReqInterviewType(stage);
    setReqDuration('30');
    setReqStartDate(tomorrowStr);
    setReqEndDate(tomorrowStr);
  };

  // Submit L1/L2 Automagic Slot request
  const handleSendSlotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqPanelist) return;

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
          panelist: reqPanelist,
          duration: reqDuration,
          startDate: reqStartDate,
          endDate: reqEndDate,
          interviewType: reqInterviewType,
          slots: selectedProposedSlots.map((s) => ({ startTime: s.startTime, endTime: s.endTime })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to dispatch slot request.');
      }

      const result = await res.json();
      setInterviews([result.interview, ...interviews]);
      setReqPanelist(null);
      alert(`Teams notification sent successfully to ${reqPanelist.displayName}!`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error occurred while sending slot request.');
    } finally {
      setIsRequestingSlot(false);
    }
  };

  // Recruiter assigns a candidate details to a slot (updates SQL and Outlook Graph Event)
  const handleAssignCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInterview) return;

    setIsAssigningCandidate(true);
    try {
      const res = await fetch('/api/interviews/assign-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: selectedInterview.id,
          candidateName: assignCandidateName,
          candidateEmail: assignCandidateEmail,
          sendAsTeamsMeeting,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to assign candidate.');
      }

      const data = await res.json();
      
      const updatedList = interviews.map((i) => {
        if (i.id === selectedInterview.id) {
          return data.interview;
        }
        return i;
      });
      
      setInterviews(updatedList);
      setSelectedInterview(data.interview);
      alert(`Successfully assigned ${assignCandidateName} and updated Outlook invite.`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error assigning candidate');
    } finally {
      setIsAssigningCandidate(false);
    }
  };

  // Submit original new interview create form
  const handleCreateInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPanels.length === 0) {
      alert('Please select at least one panel member.');
      return;
    }

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
      
      // Reset fields
      setCandidateName('');
      setCandidateEmail('');
      setRole('');
      setDuration('45');
      setStartDate('');
      setEndDate('');
      setSelectedPanels([]);
      setInterviewType('L1');
      setShowCreateForm(false);
      setSelectedInterview(result.interview);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Error occurred while saving');
    } finally {
      setIsLoading(false);
    }
  };

  // Book meeting (Original Flow)
  const handleBookSlot = async () => {
    if (!selectedInterview || !selectedSlot) return;

    setIsBooking(true);
    try {
      const res = await fetch('/api/interviews/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: selectedInterview.id,
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
          description: bookingDescription,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to book meeting');
      }

      // Re-fetch list or update local state
      const updatedList = interviews.map((i) => {
        if (i.id === selectedInterview.id) {
          return {
            ...i,
            status: 'SCHEDULED' as const,
            scheduledSlotStart: selectedSlot.start,
            scheduledSlotEnd: selectedSlot.end,
          };
        }
        return i;
      });
      
      setInterviews(updatedList);
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

  // Delete interview
  const handleDeleteInterview = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this interview record? This will remove it from the dashboard.')) {
      return;
    }

    try {
      const res = await fetch(`/api/interviews/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setInterviews(interviews.filter((i) => i.id !== id));
        if (selectedInterview?.id === id) {
          setSelectedInterview(null);
        }
      } else {
        alert('Failed to delete interview');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Admin Tab: Add/Register panelist
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
      
      // Update list
      const existsIdx = panelists.findIndex((p) => p.id === newPanelist.id);
      if (existsIdx !== -1) {
        const updated = [...panelists];
        updated[existsIdx] = newPanelist;
        setPanelists(updated);
      } else {
        setPanelists([...panelists, newPanelist]);
      }

      // Reset
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

  // Admin Tab: Delete panelist
  const handleDeletePanelist = async (id: string) => {
    if (!confirm('Are you sure you want to remove this panelist from the pre-approved pool?')) {
      return;
    }

    try {
      const res = await fetch(`/api/panelists/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setPanelists(panelists.filter((p) => p.id !== id));
      } else {
        alert('Failed to remove panelist.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Overlap calculation (Original Flow)
  const getOverlappingSlots = (interview: Interview) => {
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

      const allAvailable = activePanels.every((panel) => {
        return panel.availabilities.some((avail) => {
          const availStart = new Date(avail.startTime).getTime();
          const availEnd = new Date(avail.endTime).getTime();
          return availStart <= slotStart.getTime() && availEnd >= slotEnd.getTime();
        });
      });

      if (allAvailable) {
        matches.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
        });
      }
    }

    return matches.filter((slot, idx) => {
      if (idx === 0) return true;
      const prev = matches[idx - 1];
      const prevStart = new Date(prev.start).getTime();
      const currentStart = new Date(slot.start).getTime();
      return currentStart - prevStart >= 30 * 60 * 1000;
    });
  };

  const commonSlots = selectedInterview ? getOverlappingSlots(selectedInterview) : [];
  
  const filteredPanelists = panelists.filter(
    (p) =>
      p.displayName.toLowerCase().includes(panelistFilterText.toLowerCase()) ||
      p.email.toLowerCase().includes(panelistFilterText.toLowerCase())
  );

  // Split Panelists directory into L1 and L2 lists
  const l1Panelists = filteredPanelists.filter((p) => p.roles.includes('L1'));
  const l2Panelists = filteredPanelists.filter((p) => p.roles.includes('L2'));

  // Flatten panel nominations across all active interviews
  const allNominations = interviews.flatMap((interview) => 
    interview.panels.map((p) => ({
      ...p,
      interview,
    }))
  );

  const respondedNominations = allNominations.filter((n) => n.status === 'SUBMITTED');
  const pendingNominations = allNominations.filter((n) => n.status === 'PENDING');

  return (
    <div>
      {/* Navigation Tabs */}
      <div 
        style={{ 
          display: 'flex', 
          gap: '1rem', 
          marginBottom: '2rem', 
          borderBottom: '1px solid var(--border-glass)', 
          paddingBottom: '0.5rem' 
        }}
      >
        <button 
          onClick={() => {
            setActiveTab('interviews');
            setAdminSelectedUser(null);
          }}
          className="btn"
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'interviews' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'interviews' ? 'var(--text-main)' : 'var(--text-muted)',
            borderRadius: 0,
            padding: '0.5rem 1rem',
            fontWeight: 600,
            fontSize: '0.95rem'
          }}
        >
          Interviews Cockpit
        </button>
        <button 
          onClick={() => {
            setActiveTab('panelists');
            setSelectedInterview(null);
            setShowCreateForm(false);
          }}
          className="btn"
          style={{
            background: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'panelists' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'panelists' ? 'var(--text-main)' : 'var(--text-muted)',
            borderRadius: 0,
            padding: '0.5rem 1rem',
            fontWeight: 600,
            fontSize: '0.95rem'
          }}
        >
          Manage Panelists (Admin)
        </button>
      </div>

      {/* VIEW A: INTERVIEWS SCHEDULER TAB */}
      {activeTab === 'interviews' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
          
          {/* Left: Interviews list & Panelist Tracker */}
          <div>
            {/* Segmented Control Toggle */}
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', padding: '2px', marginBottom: '1.5rem' }}>
              <button
                onClick={() => setCockpitView('list')}
                style={{
                  flex: 1,
                  background: cockpitView === 'list' ? 'var(--primary)' : 'transparent',
                  border: 'none',
                  color: '#fff',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-xs)',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                Interviews Cockpit
              </button>
              <button
                onClick={() => setCockpitView('tracker')}
                style={{
                  flex: 1,
                  background: cockpitView === 'tracker' ? 'var(--primary)' : 'transparent',
                  border: 'none',
                  color: '#fff',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-xs)',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                Panelist Mapping Tracker
              </button>
            </div>

            {cockpitView === 'list' ? (
              <>
                <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Active Interviews</h2>
                  <button 
                    className="btn btn-primary btn-sm flex-gap-2"
                    onClick={() => {
                      setShowCreateForm(!showCreateForm);
                      setSelectedInterview(null);
                    }}
                  >
                    <Plus size={16} />
                    New Interview
                  </button>
                </div>

                {interviews.length === 0 ? (
                  <div className="glass-card text-center" style={{ padding: '4rem 2rem' }}>
                    <CalendarCheck size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
                    <h4 style={{ marginBottom: '0.5rem' }}>No Interviews Yet</h4>
                    <p className="text-muted text-sm">Create a new interview schedule to nominate panels and book slots.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {interviews.map((interview) => {
                      const totalPanels = interview.panels.length;
                      const submittedPanels = interview.panels.filter((p) => p.status === 'SUBMITTED').length;
                      const isSelected = selectedInterview?.id === interview.id;

                      return (
                        <div 
                          key={interview.id} 
                          className={`glass-card ${isSelected ? 'selected-interview' : ''}`}
                          style={{ 
                            padding: '1.25rem 1.5rem', 
                            cursor: 'pointer',
                            borderColor: isSelected ? 'var(--primary)' : 'var(--border-glass)',
                            boxShadow: isSelected ? '0 0 15px rgba(99, 102, 241, 0.2)' : 'var(--shadow-card)'
                          }}
                          onClick={() => {
                            setSelectedInterview(interview);
                            setShowCreateForm(false);
                            setSelectedSlot(null);
                          }}
                        >
                          <div className="flex-between">
                            <div>
                              <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>
                                {interview.candidateName === 'Pending Assignment' ? (
                                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending Assignment</span>
                                ) : (
                                  interview.candidateName
                                )}
                              </h4>
                              <p className="text-muted text-xs flex-gap-2" style={{ marginBottom: '0.75rem' }}>
                                <Mail size={12} /> {interview.candidateEmail === 'pending@assign.com' ? 'Pending candidate assignment' : interview.candidateEmail}
                              </p>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                              {interview.candidateName === 'Pending Assignment' && (
                                <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#a5b4fc', border: '1px solid rgba(99, 102, 241, 0.2)' }}>Pending Candidate</span>
                              )}
                              {interview.status === 'PENDING' && (
                                <span className="badge badge-pending">Pending Panel Response</span>
                              )}
                              {interview.status === 'COLLECTED' && (
                                <span className="badge badge-success">Ready to Book</span>
                              )}
                              {interview.status === 'SCHEDULED' && (
                                <span className="badge badge-info">Scheduled</span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                            <div>
                              <div className="text-muted text-xs" style={{ marginBottom: '2px' }}>Role / Stage</div>
                              <div className="text-sm font-semibold">{interview.role} ({interview.duration} mins)</div>
                            </div>
                            <div>
                              <div className="text-muted text-xs" style={{ marginBottom: '2px' }}>Panel Submissions</div>
                              <div className="text-sm font-semibold">
                                {submittedPanels} / {totalPanels} Responded
                              </div>
                            </div>
                          </div>

                          <div className="flex-between" style={{ marginTop: '0.75rem' }}>
                            <span className="text-muted text-xs flex-gap-2">
                              <Clock size={12} /> Range: {new Date(interview.startDate).toLocaleDateString()} - {new Date(interview.endDate).toLocaleDateString()}
                            </span>
                            <button 
                              className="btn btn-secondary btn-sm" 
                              style={{ padding: '0.25rem', borderRadius: '4px', border: 'none', background: 'transparent' }}
                              onClick={(e) => handleDeleteInterview(interview.id, e)}
                            >
                              <Trash2 size={14} className="text-muted" style={{ transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'} onMouseLeave={(e) => e.currentTarget.style.color = ''} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* Responded List */}
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
                              <strong style={{ fontSize: '0.95rem' }}>{nom.name}</strong>
                              <span className="text-muted text-xs block" style={{ opacity: 0.8 }}>{nom.email}</span>
                            </div>
                            <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Responded</span>
                          </div>

                          <div style={{ fontSize: '0.85rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '0.6rem 0.8rem', borderRadius: '4px', marginTop: '0.5rem', marginBottom: '0.75rem' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '2px' }}>Interview Stage & Timing</div>
                            <div style={{ fontWeight: 600 }}>{nom.interview.role} ({nom.interview.duration} mins)</div>
                            {nom.interview.scheduledSlotStart && (
                              <div style={{ marginTop: '0.25rem', color: 'var(--text-main)', fontSize: '0.75rem' }}>
                                Scheduled slot: <strong>{new Date(nom.interview.scheduledSlotStart).toLocaleString()}</strong>
                              </div>
                            )}
                          </div>

                          {/* Mapped Candidate tracking & mapping option */}
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                            {nom.interview.candidateName !== 'Pending Assignment' ? (
                              <div className="flex-between" style={{ alignItems: 'center' }}>
                                <div>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned Candidate</span>
                                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)', marginTop: '2px' }}>
                                    {nom.interview.candidateName}
                                  </div>
                                  {nom.interview.candidateEmail && nom.interview.candidateEmail !== 'pending@assign.com' && (
                                    <span className="text-muted text-xs block">{nom.interview.candidateEmail}</span>
                                  )}
                                </div>
                                <button
                                  className="btn btn-secondary btn-sm animate-pulse-once"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', height: 'auto' }}
                                  onClick={() => {
                                    setSelectedInterview(nom.interview);
                                    setCockpitView('list');
                                  }}
                                >
                                  Edit Mapping / Details
                                </button>
                              </div>
                            ) : (
                              <div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No Candidate Mapped</span>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
                                  <input
                                    type="text"
                                    placeholder="Enter candidate name..."
                                    className="form-input"
                                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem', flex: 2 }}
                                    id={`cand-name-${nom.id}`}
                                  />
                                  <input
                                    type="email"
                                    placeholder="Email (Optional)..."
                                    className="form-input"
                                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem', flex: 1.5 }}
                                    id={`cand-email-${nom.id}`}
                                  />
                                  
                                  {/* Custom Teams Meeting toggle in tracker row */}
                                  <label className="switch-container" style={{ gap: '0.4rem', marginRight: '0.25rem' }}>
                                    <input 
                                      type="checkbox" 
                                      className="switch-input"
                                      defaultChecked={true}
                                      id={`cand-teams-${nom.id}`}
                                    />
                                    <span className="switch-toggle" style={{ width: '40px', height: '20px' }}></span>
                                    <style>{`
                                      #cand-teams-${nom.id} + .switch-toggle::before {
                                        width: 14px;
                                        height: 14px;
                                        top: 3px;
                                        left: 3px;
                                      }
                                      #cand-teams-${nom.id}:checked + .switch-toggle::before {
                                        transform: translateX(20px);
                                      }
                                    `}</style>
                                    <span className="switch-label" style={{ fontSize: '0.75rem' }}>Teams meeting</span>
                                  </label>

                                  <button
                                    onClick={async () => {
                                      const nameEl = document.getElementById(`cand-name-${nom.id}`) as HTMLInputElement;
                                      const emailEl = document.getElementById(`cand-email-${nom.id}`) as HTMLInputElement;
                                      const teamsEl = document.getElementById(`cand-teams-${nom.id}`) as HTMLInputElement;
                                      if (!nameEl || !nameEl.value.trim()) {
                                        alert('Please enter a candidate name.');
                                        return;
                                      }
                                      
                                      try {
                                        const res = await fetch('/api/interviews/assign-candidate', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            interviewId: nom.interview.id,
                                            candidateName: nameEl.value.trim(),
                                            candidateEmail: emailEl.value.trim() || 'pending@assign.com',
                                            sendAsTeamsMeeting: teamsEl ? teamsEl.checked : true,
                                          }),
                                        });

                                        if (!res.ok) {
                                          const err = await res.json();
                                          throw new Error(err.error || 'Failed to assign candidate');
                                        }

                                        const data = await res.json();
                                        const updatedList = interviews.map((i) => {
                                          if (i.id === nom.interview.id) return data.interview;
                                          return i;
                                        });
                                        setInterviews(updatedList);
                                        alert('Candidate successfully mapped to panelist!');
                                      } catch (err: any) {
                                        console.error(err);
                                        alert(err.message || 'Error occurred while mapping');
                                      }
                                    }}
                                    className="btn btn-primary"
                                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', height: '34px', display: 'flex', alignItems: 'center' }}
                                  >
                                    Map
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pending Response List */}
                <div>
                  <h3 style={{ fontSize: '1.3rem', fontWeight: 600, color: '#f59e0b', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={16} /> Pending Response (Awaiting Availability)
                  </h3>
                  {pendingNominations.length === 0 ? (
                    <div className="glass-card text-center" style={{ padding: '2.5rem' }}>
                      <span className="text-muted text-xs">No pending requests. All panelists have responded.</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {pendingNominations.map((nom) => (
                        <div key={nom.id} className="glass-card" style={{ padding: '1rem 1.25rem' }}>
                          <div className="flex-between" style={{ alignItems: 'center' }}>
                            <div>
                              <strong style={{ fontSize: '0.95rem' }}>{nom.name}</strong>
                              <span className="text-muted text-xs block" style={{ opacity: 0.8 }}>{nom.email}</span>
                            </div>
                            <span className="badge badge-pending" style={{ fontSize: '0.7rem' }}>Pending</span>
                          </div>
                          <div style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '0.5rem 0.75rem', borderRadius: '4px', marginTop: '0.5rem' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '2px' }}>Role Stage Window</div>
                            <div style={{ fontWeight: 600 }}>{nom.interview.role}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                              Date range: {new Date(nom.interview.startDate).toLocaleDateString()} - {new Date(nom.interview.endDate).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Dynamic form / Interview booking details */}
          <div>
            {/* Create scheduling request form */}
            {showCreateForm && (
              <div className="glass-card" style={{ position: 'sticky', top: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Schedule New Interview</h3>
                
                <form onSubmit={handleCreateInterview}>
                  <div className="form-group">
                    <label className="form-label">Candidate Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={candidateName} 
                      onChange={(e) => setCandidateName(e.target.value)} 
                      placeholder="John Doe"
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Candidate Email</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      value={candidateEmail} 
                      onChange={(e) => setCandidateEmail(e.target.value)} 
                      placeholder="john.doe@external.com"
                      required 
                    />
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Interview Stage</label>
                      <select 
                        className="form-input"
                        value={interviewType}
                        onChange={(e) => {
                          setInterviewType(e.target.value as any);
                          setSelectedPanels([]); // clear panels selection on type change to allow fresh filtered recommendations
                        }}
                      >
                        <option value="L1">L1 Interview (Screening)</option>
                        <option value="L2">L2 Interview (System Design/Management)</option>
                        <option value="General">General / Custom Interview</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Job Title / Focus area</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={role} 
                        onChange={(e) => setRole(e.target.value)} 
                        placeholder="e.g. Coding Loop, Manager Fit"
                        required 
                      />
                    </div>
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Duration</label>
                      <select 
                        className="form-input" 
                        value={duration} 
                        onChange={(e) => setDuration(e.target.value)}
                      >
                        <option value="30">30 minutes</option>
                        <option value="45">45 minutes</option>
                        <option value="60">60 minutes</option>
                        <option value="90">90 minutes</option>
                      </select>
                    </div>
                    <div className="form-group">
                      {/* Empty space */}
                    </div>
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Proposed Range Start</label>
                      <input 
                        type="date" 
                        className="form-input" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Proposed Range End</label>
                      <input 
                        type="date" 
                        className="form-input" 
                        value={endDate} 
                        onChange={(e) => setEndDate(e.target.value)} 
                        required 
                      />
                    </div>
                  </div>

                  {/* recommended panelists chips */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem', background: 'rgba(255, 255, 255, 0.01)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                    <span className="text-muted text-xs font-semibold flex-gap-2">
                      <Check size={12} className="text-primary" /> Recommended {interviewType} Panelists
                    </span>
                    {recommendedPanelists.length === 0 ? (
                      <span className="text-muted text-xs" style={{ padding: '0.25rem 0' }}>
                        No pre-approved panelists found for {interviewType}. Search corporate directory below.
                      </span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                        {recommendedPanelists.map((p) => {
                          const isChosen = selectedPanels.some((sp) => sp.id === p.id);
                          return (
                            <button
                              type="button"
                              key={p.id}
                              onClick={() => handleToggleRecommendedPanelist(p)}
                              style={{
                                background: isChosen ? 'var(--primary-glow)' : 'rgba(255, 255, 255, 0.03)',
                                border: isChosen ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                                color: isChosen ? 'var(--text-main)' : 'var(--text-muted)',
                                padding: '0.3rem 0.75rem',
                                borderRadius: '50px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                transition: 'var(--transition-fast)'
                              }}
                            >
                              {p.displayName} {isChosen ? '✓' : '+'}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* fallback Microsoft Directory Search */}
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label className="form-label">Search Corporate Directory (Fallback)</label>
                    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                      <Search size={14} className="text-muted" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ paddingLeft: '2.25rem', fontSize: '0.875rem' }}
                        value={panelSearchQuery} 
                        onChange={(e) => setPanelSearchQuery(e.target.value)} 
                        placeholder="Search another colleague..." 
                      />
                      {isSearchingPanels && (
                        <Loader2 size={14} className="animate-pulse text-muted" style={{ position: 'absolute', right: '12px' }} />
                      )}
                    </div>

                    {/* Suggestions list */}
                    {searchResults.length > 0 && (
                      <div 
                        style={{ 
                          position: 'absolute', 
                          top: '100%', 
                          left: 0, 
                          right: 0, 
                          zIndex: 10, 
                          background: 'var(--bg-surface)', 
                          border: '1px solid var(--border-glass)', 
                          borderRadius: 'var(--radius-md)', 
                          boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
                          marginTop: '4px',
                          maxHeight: '180px',
                          overflowY: 'auto'
                        }}
                      >
                        {searchResults.map((user) => (
                          <div 
                            key={user.id}
                            style={{ padding: '0.5rem 1rem', cursor: 'pointer', transition: 'var(--transition-fast)' }}
                            className="search-item-hover"
                            onClick={() => handleAddPanel(user)}
                          >
                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user.displayName}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{user.mail || user.userPrincipalName}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Selected Panels List */}
                  {selectedPanels.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem', marginTop: '-0.25rem' }}>
                      {selectedPanels.map((panel) => (
                        <div 
                          key={panel.id} 
                          style={{ 
                            background: 'var(--primary-glow)', 
                            border: '1px solid var(--primary)', 
                            padding: '0.25rem 0.75rem', 
                            borderRadius: '100px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.75rem'
                          }}
                        >
                          <span>{panel.displayName}</span>
                          <button 
                            type="button" 
                            onClick={() => handleRemovePanel(panel.id)}
                            style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ width: '100%', marginTop: '0.5rem' }}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Dispatching Teams Invites...
                      </>
                    ) : (
                      'Send Teams Invites'
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Details & booking screen */}
            {selectedInterview && (
              <div className="glass-card" style={{ position: 'sticky', top: '2rem' }}>
                <div className="flex-between" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
                  <div>
                    <span className="text-muted text-xs block" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Interview Details</span>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>
                      {selectedInterview.candidateName === 'Pending Assignment' ? (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending Assignment</span>
                      ) : (
                        selectedInterview.candidateName
                      )}
                    </h3>
                  </div>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => setSelectedInterview(null)}
                  >
                    Close
                  </button>
                </div>

                {/* Inline Assign Candidate Form */}
                {(selectedInterview.candidateName === 'Pending Assignment' || isEditingMapping) ? (
                  <div style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.15)', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
                    <h4 style={{ color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <User size={16} className="text-primary" /> {selectedInterview.candidateName === 'Pending Assignment' ? 'Assign Candidate to Interview' : 'Edit Candidate Assignment'}
                    </h4>
                    <p className="text-muted text-xs" style={{ marginBottom: '1rem' }}>
                      Provide candidate details below. The Microsoft Teams calendar invite will automatically update and invite the candidate.
                    </p>
                    <form onSubmit={async (e) => {
                      await handleAssignCandidate(e);
                      setIsEditingMapping(false);
                    }} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Candidate Name</label>
                          <input
                            type="text"
                            className="form-input"
                            style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
                            value={assignCandidateName}
                            onChange={(e) => setAssignCandidateName(e.target.value)}
                            placeholder="e.g. Alice Smith"
                            required
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Candidate Email (Optional)</label>
                          <input
                            type="email"
                            className="form-input"
                            style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}
                            value={assignCandidateEmail}
                            onChange={(e) => setAssignCandidateEmail(e.target.value)}
                            placeholder="alice.smith@example.com"
                          />
                        </div>
                      </div>

                      {/* Teams Meeting custom toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                        <label className="switch-container">
                          <input 
                            type="checkbox" 
                            className="switch-input"
                            checked={sendAsTeamsMeeting}
                            onChange={(e) => setSendAsTeamsMeeting(e.target.checked)}
                          />
                          <span className="switch-toggle"></span>
                          <span className="switch-label">Teams meeting</span>
                        </label>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                        <button
                          type="submit"
                          className="btn btn-primary btn-sm"
                          disabled={isAssigningCandidate}
                          style={{ flex: 1 }}
                        >
                          {isAssigningCandidate ? (
                            <>
                              <Loader2 size={14} className="animate-spin" /> Saving...
                            </>
                          ) : (
                            'Confirm & Save'
                          )}
                        </button>
                        {selectedInterview.candidateName !== 'Pending Assignment' && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setIsEditingMapping(false)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-glass)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span className="text-muted text-xs block" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assigned Candidate</span>
                      <strong style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>{selectedInterview.candidateName}</strong>
                      {selectedInterview.candidateEmail && selectedInterview.candidateEmail !== 'pending@assign.com' && (
                        <span className="text-muted text-xs block" style={{ marginTop: '2px' }}>{selectedInterview.candidateEmail}</span>
                      )}
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setAssignCandidateName(selectedInterview.candidateName);
                        setAssignCandidateEmail(selectedInterview.candidateEmail === 'pending@assign.com' ? '' : selectedInterview.candidateEmail);
                        setIsEditingMapping(true);
                      }}
                    >
                      Edit Candidate
                    </button>
                  </div>
                )}

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <div className="text-muted text-xs">Role / Stage</div>
                      <div className="text-sm font-semibold">{selectedInterview.role}</div>
                    </div>
                    <div>
                      <div className="text-muted text-xs">Interview Duration</div>
                      <div className="text-sm font-semibold">{selectedInterview.duration} minutes</div>
                    </div>
                    <div>
                      <div className="text-muted text-xs">Candidate Email</div>
                      <div className="text-sm font-semibold" style={{ wordBreak: 'break-all' }}>
                        {selectedInterview.candidateEmail === 'pending@assign.com' ? 'Pending assignment' : selectedInterview.candidateEmail}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted text-xs">Requested Date Range</div>
                      <div className="text-sm font-semibold">
                        {new Date(selectedInterview.startDate).toLocaleDateString()} - {new Date(selectedInterview.endDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Nominated Panelists */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }} className="flex-gap-2">
                    <User size={16} /> Panels Status
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedInterview.panels.map((p) => (
                      <div 
                        key={p.id} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.75rem',
                          background: 'rgba(255,255,255,0.01)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-glass)'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.name}</div>
                          <div className="text-muted text-xs">{p.email}</div>
                        </div>
                        <div>
                          {p.status === 'SUBMITTED' ? (
                            <div className="flex-gap-2 badge badge-success" style={{ fontSize: '0.65rem' }}>
                              <CheckCircle size={10} /> Submitted / Booked
                            </div>
                          ) : (
                            <div className="flex-gap-2 badge badge-pending" style={{ fontSize: '0.65rem' }}>
                              <Clock size={10} /> Pending
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Scheduled booking details */}
                {selectedInterview.status === 'SCHEDULED' ? (
                  <div style={{ background: 'var(--success-glow)', border: '1px solid var(--success)', padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
                    <h4 style={{ color: 'var(--success)', fontSize: '1.05rem', marginBottom: '0.5rem' }} className="flex-gap-2">
                      <CheckCircle size={18} /> Meeting Scheduled!
                    </h4>
                    
                    <div style={{ fontSize: '0.9rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div>
                        <span className="text-muted text-xs block">Date & Time</span>
                        <strong>{new Date(selectedInterview.scheduledSlotStart || '').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                      </div>
                      <div>
                        <span className="text-muted text-xs block">Slot</span>
                        <strong>
                          {new Date(selectedInterview.scheduledSlotStart || '').toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedInterview.scheduledSlotEnd || '').toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} (UTC)
                        </strong>
                      </div>
                    </div>

                    {selectedInterview.teamsMeetingUrl && (
                      <a 
                        href={selectedInterview.teamsMeetingUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="btn btn-primary flex-gap-2"
                        style={{ width: '100%', background: 'var(--success)', border: 'none' }}
                      >
                        <Video size={16} /> Join Teams Meeting
                      </a>
                    )}
                  </div>
                ) : (
                  /* Slot Calculation & Booking Workspace */
                  <div>
                    <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }} className="flex-gap-2">
                      <Calendar size={16} /> Computed Overlapping Free Slots
                    </h4>

                    {selectedInterview.panels.filter((p) => p.status === 'SUBMITTED').length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', border: '1px dashed var(--border-glass)', borderRadius: 'var(--radius-md)' }}>
                        <Info size={24} className="text-muted" style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>No availability data yet.</div>
                        <p className="text-muted text-xs">We will compute slot options as soon as at least one panel member submits availability.</p>
                      </div>
                    ) : commonSlots.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', border: '1px dashed var(--border-glass)', borderRadius: 'var(--radius-md)' }}>
                        <Info size={24} className="text-muted" style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>No overlapping slots found.</div>
                        <p className="text-muted text-xs">There are no common slots of {selectedInterview.duration} mins matching everyone's submission. Coordinate manual booking.</p>
                      </div>
                    ) : (
                      <div>
                        {/* Time slots list */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', marginBottom: '1.25rem', paddingRight: '4px' }}>
                          {commonSlots.map((slot, index) => {
                            const startObj = new Date(slot.start);
                            const endObj = new Date(slot.end);
                            const isSlotSelected = selectedSlot?.start === slot.start;

                            return (
                              <div 
                                key={index}
                                onClick={() => setSelectedSlot(slot)}
                                style={{ 
                                  padding: '0.75rem 1rem', 
                                  cursor: 'pointer',
                                  background: isSlotSelected ? 'var(--primary-glow)' : 'rgba(255,255,255,0.01)',
                                  border: isSlotSelected ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                                  borderRadius: 'var(--radius-sm)',
                                  transition: 'var(--transition-fast)'
                                }}
                                className={!isSlotSelected ? 'search-item-hover' : ''}
                              >
                                <div className="flex-between">
                                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                    {startObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}
                                  </span>
                                  <span style={{ fontSize: '0.8rem', color: isSlotSelected ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                                    {startObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - {endObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} (UTC)
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Description & booking button */}
                        {selectedSlot && (
                          <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                            <div className="form-group">
                              <label className="form-label">Invitation Message / Agenda</label>
                              <textarea 
                                className="form-input"
                                rows={3}
                                style={{ resize: 'none' }}
                                value={bookingDescription}
                                onChange={(e) => setBookingDescription(e.target.value)}
                                placeholder="Provide details about the interview topics..."
                              />
                            </div>

                            <button 
                              className="btn btn-primary" 
                              style={{ width: '100%' }}
                              onClick={handleBookSlot}
                              disabled={isBooking}
                            >
                              {isBooking ? (
                                <>
                                  <Loader2 size={16} className="animate-spin" /> Scheduling Teams Event...
                                </>
                              ) : (
                                'Confirm Teams Booking'
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Idle status */}
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
      )}

      {/* VIEW B: MANAGE PANELISTS TAB (ADMIN PANEL) */}
      {activeTab === 'panelists' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Timing Period Configuration Card */}
          <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} className="text-primary" /> Auto-Scheduler Timing Configurations
            </h3>
            <p className="text-muted text-xs" style={{ marginBottom: '1.25rem' }}>
              Configure the default daily time windows during which interview slots can be automatically proposed. L1/L2 slot options will be auto-generated inside these ranges.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
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
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
            
            {/* Admin Left: Register new panelist */}
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

                  {/* Directory Autocomplete Suggestions */}
                  {adminSearchResults.length > 0 && (
                    <div 
                      style={{ 
                        position: 'absolute', 
                        top: '100%', 
                        left: 0, 
                        right: 0, 
                        zIndex: 10, 
                        background: 'var(--bg-surface)', 
                        border: '1px solid var(--border-glass)', 
                        borderRadius: 'var(--radius-md)', 
                        boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
                        marginTop: '4px',
                        maxHeight: '180px',
                        overflowY: 'auto'
                      }}
                    >
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

                {/* Roles configuration checkboxes */}
                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">Interview Capability Levels</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                      <input 
                        type="checkbox"
                        checked={adminRoles.includes('L1')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAdminRoles([...adminRoles, 'L1']);
                          } else {
                            setAdminRoles(adminRoles.filter((r) => r !== 'L1'));
                          }
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
                          if (e.target.checked) {
                            setAdminRoles([...adminRoles, 'L2']);
                          } else {
                            setAdminRoles(adminRoles.filter((r) => r !== 'L2'));
                          }
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
                    <>
                      <Loader2 size={16} className="animate-spin" /> Saving...
                    </>
                  ) : (
                    'Register Panelist'
                  )}
                </button>
              </form>
            </div>

            {/* Admin Right: Panelists Split Directories */}
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
                  
                  {/* Column 1: L1 Panelists Directory */}
                  <div>
                    <h4 style={{ fontSize: '0.85rem', color: '#60a5fa', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.4rem', fontWeight: 600 }}>
                      L1 Screening Panels ({l1Panelists.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                      {l1Panelists.length === 0 ? (
                        <div className="text-muted text-xs" style={{ padding: '1rem', textAlign: 'center' }}>No L1 panelists registered.</div>
                      ) : (
                        l1Panelists.map((p) => (
                          <div 
                            key={p.id}
                            style={{ 
                              display: 'flex', 
                              flexDirection: 'column',
                              gap: '0.5rem',
                              padding: '0.75rem',
                              background: 'rgba(255, 255, 255, 0.01)',
                              border: '1px solid var(--border-glass)',
                              borderRadius: 'var(--radius-md)'
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.displayName}</div>
                              <div className="text-muted text-xs" style={{ wordBreak: 'break-all', opacity: 0.7 }}>{p.email}</div>
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
                        ))
                      )}
                    </div>
                  </div>

                  {/* Column 2: L2 Panelists Directory */}
                  <div>
                    <h4 style={{ fontSize: '0.85rem', color: '#a78bfa', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.4rem', fontWeight: 600 }}>
                      L2 System/Mgmt Panels ({l2Panelists.length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                      {l2Panelists.length === 0 ? (
                        <div className="text-muted text-xs" style={{ padding: '1rem', textAlign: 'center' }}>No L2 panelists registered.</div>
                      ) : (
                        l2Panelists.map((p) => (
                          <div 
                            key={p.id}
                            style={{ 
                              display: 'flex', 
                              flexDirection: 'column',
                              gap: '0.5rem',
                              padding: '0.75rem',
                              background: 'rgba(255, 255, 255, 0.01)',
                              border: '1px solid var(--border-glass)',
                              borderRadius: 'var(--radius-md)'
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.displayName}</div>
                              <div className="text-muted text-xs" style={{ wordBreak: 'break-all', opacity: 0.7 }}>{p.email}</div>
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
                        ))
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Request Slot Overlay Modal (New Automagic Flow) */}
      {reqPanelist && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem'
        }}>
          <div className="glass-card animate-pulse-once" style={{ maxWidth: '520px', width: '100%', padding: '2rem', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border-glass)' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.75rem' }}>
              Request Slot from {reqPanelist.displayName}
            </h3>

            <form onSubmit={handleSendSlotRequest}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Interview Stage</label>
                  <select
                    className="form-input"
                    value={reqInterviewType}
                    onChange={(e) => setReqInterviewType(e.target.value as any)}
                  >
                    <option value="L1">L1 Interview</option>
                    <option value="L2">L2 Interview</option>
                    <option value="General">General / Custom</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Duration</label>
                  <select
                    className="form-input"
                    value={reqDuration}
                    onChange={(e) => setReqDuration(e.target.value)}
                  >
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
                  <input
                    type="date"
                    className="form-input"
                    value={reqStartDate}
                    onChange={(e) => setReqStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Proposed Range End</label>
                  <input
                    type="date"
                    className="form-input"
                    value={reqEndDate}
                    onChange={(e) => setReqEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Proposed Slots Builder / Auto-generated slots */}
              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--text-main)', fontWeight: 600 }}>Proposed Slot Options Checklist</h4>
                
                {/* Display proposed slots list */}
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

              {/* Real-time Teams message preview card */}
              <div style={{ background: '#090d16', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', marginBottom: '1.5rem' }}>
                <span className="text-muted text-xs block font-semibold" style={{ marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Teams Message Preview Card</span>
                <div style={{ borderLeft: '4px solid var(--primary)', paddingLeft: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '0.25rem' }}>Interview Slot Request</div>
                  <p style={{ margin: '4px 0', fontSize: '0.8rem' }}>Hello <strong>{reqPanelist.displayName}</strong>,</p>
                  <p style={{ margin: '4px 0', fontSize: '0.8rem' }}>You have been requested to conduct an <strong>{reqInterviewType} Interview</strong>.</p>
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
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setReqPanelist(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={reqSlots.filter((s) => s.selected).length === 0 || isRequestingSlot}
                >
                  {isRequestingSlot ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Send Slot Request'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .selected-interview {
          background: rgba(99, 102, 241, 0.05) !important;
        }
        .search-item-hover:hover {
          background: rgba(255, 255, 255, 0.04) !important;
        }
        .block {
          display: block;
        }
        .btn-xs {
          padding: 0.2rem 0.4rem;
          font-size: 0.7rem;
          height: auto;
        }
        .flex-gap-4 {
          display: flex;
          gap: 1rem;
          align-items: center;
        }
      `}</style>
    </div>
  );
}
