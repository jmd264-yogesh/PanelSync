'use client';

import React, { useState, useEffect } from 'react';
import { 
  Interview, 
  InterviewPanel, 
  PanelAvailability,
  Panelist,
  UploadedCandidate
} from '@/lib/db';
import * as XLSX from 'xlsx';
import { GraphUser } from '@/lib/graph';
import {
  Plus,
  Calendar,
  User,
  Users,
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
  Shield,
  Settings,
  ListFilter,
  Building2
} from 'lucide-react';

interface DashboardClientProps {
  initialInterviews: Interview[];
  initialPanelists: Panelist[];
}

export default function DashboardClient({ initialInterviews, initialPanelists }: DashboardClientProps) {
  // Navigation & DB States
  const [activeTab, setActiveTab] = useState<'interviews' | 'panelists' | 'recruiters' | 'candidates'>('interviews');
  const [interviews, setInterviews] = useState<Interview[]>(initialInterviews);
  const [panelists, setPanelists] = useState<Panelist[]>(initialPanelists);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);

  // Candidates Queue States
  const [candidates, setCandidates] = useState<UploadedCandidate[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<'all' | 'WAITING' | 'MAPPED'>('all');
  const [isUploadingCandidates, setIsUploadingCandidates] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const [uploadDefaultDate, setUploadDefaultDate] = useState('');

  // View States
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cockpitView, setCockpitView] = useState<'list' | 'tracker'>('list');

  // Recruiters Tab States & Handlers
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
    if (activeTab === 'recruiters') {
      fetchRecruiters();
    }
  }, [activeTab]);

  const fetchCandidates = async () => {
    setIsLoadingCandidates(true);
    try {
      const res = await fetch('/api/candidates');
      if (res.ok) {
        const data = await res.json();
        setCandidates(data);
      }
    } catch (err) {
      console.error('Failed to fetch candidates:', err);
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'candidates') {
      fetchCandidates();
    }
  }, [activeTab]);

  const parseExcelDate = (value: any): string | undefined => {
    if (!value) return undefined;
    
    // JS Date object
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    
    // Excel numeric date value
    if (typeof value === 'number') {
      const date = new Date((value - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    
    // General date parsing
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    
    return undefined;
  };

  const handleDownloadTemplate = () => {
    const csvContent = 'data:text/csv;charset=utf-8,Name,Email,Date\nJohn Doe,john.doe@example.com,2026-06-15\nJane Smith,jane.smith@example.com,';
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'candidate_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCandidates(true);
    setUploadError(null);
    setUploadSuccessMessage(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error('Could not read file data');

        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(sheet);

        if (json.length === 0) {
          throw new Error('The spreadsheet is empty.');
        }

        const parsedCandidates = json
          .map((row) => {
            const keys = Object.keys(row);
            const nameKey = keys.find((k) => k.toLowerCase() === 'name');
            const emailKey = keys.find((k) => k.toLowerCase() === 'email');
            const dateKey = keys.find((k) => k.toLowerCase() === 'date' || k.toLowerCase() === 'preferred date' || k.toLowerCase() === 'interview date');
            
            if (nameKey && emailKey) {
              const name = String(row[nameKey]).trim();
              const email = String(row[emailKey]).trim();
              const rawDate = dateKey ? row[dateKey] : undefined;
              const preferredDate = parseExcelDate(rawDate) || (uploadDefaultDate ? uploadDefaultDate : undefined);

              return {
                name,
                email,
                preferredDate,
              };
            }
            return null;
          })
          .filter((c): c is { name: string; email: string; preferredDate: string | undefined } => c !== null && c.name !== '' && c.email !== '');

        if (parsedCandidates.length === 0) {
          throw new Error("Could not find matching 'Name' and 'Email' columns in the uploaded file.");
        }

        const res = await fetch('/api/candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidates: parsedCandidates }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to upload candidates');
        }

        const result = await res.json();
        setCandidates(result.candidates);
        setInterviews(result.interviews);
        setUploadSuccessMessage(
          `Successfully uploaded ${parsedCandidates.length} candidate(s). ${result.mappedCount} candidate(s) were automatically mapped to L1 panels.`
        );
      } catch (err: any) {
        console.error(err);
        setUploadError(err.message || 'An error occurred during file parsing or upload.');
      } finally {
        setIsUploadingCandidates(false);
        e.target.value = '';
      }
    };

    reader.onerror = () => {
      setUploadError('Failed to read file.');
      setIsUploadingCandidates(false);
    };

    reader.readAsBinaryString(file);
  };

  const handleUpdateCandidateDate = async (id: string, preferredDate: string) => {
    try {
      const res = await fetch(`/api/candidates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredDate: preferredDate || null }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update candidate preferred date');
      }

      const result = await res.json();
      setCandidates(result.candidates);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error updating candidate date');
    }
  };

  const handleDeleteCandidate = async (id: string) => {
    if (!confirm('Are you sure you want to remove this candidate from the queue?')) return;
    try {
      const res = await fetch(`/api/candidates/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const result = await res.json();
        setCandidates(result.candidates);
      } else {
        alert('Failed to delete candidate.');
      }
    } catch (err) {
      console.error('Error deleting candidate:', err);
    }
  };

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
    if (!confirm(`Are you sure you want to revoke sign-in permission for ${email}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/recruiters/${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to revoke recruiter access.');
      }
      await fetchRecruiters();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'An error occurred revoking access.');
    }
  };

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
  const [collegeName, setCollegeName] = useState('');

  // Panelist-First slot request form states (New Flow)
  const [reqPanelists, setReqPanelists] = useState<Panelist[]>([]);
  const [reqDuration, setReqDuration] = useState('30');
  const [reqStartDate, setReqStartDate] = useState('');
  const [reqEndDate, setReqEndDate] = useState('');
  const [reqInterviewType, setReqInterviewType] = useState<'L1' | 'L2' | 'General'>('L1');
  const [reqSlots, setReqSlots] = useState<{ startTime: string; endTime: string; selected: boolean }[]>([]);
  const [isRequestingSlot, setIsRequestingSlot] = useState(false);
  const [bulkSelectedL1Ids, setBulkSelectedL1Ids] = useState<string[]>([]);
  const [bulkSelectedL2Ids, setBulkSelectedL2Ids] = useState<string[]>([]);

  const [defaultStartDate, setDefaultStartDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [defaultEndDate, setDefaultEndDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1); // Same day default window
    return tomorrow.toISOString().split('T')[0];
  });

  // Assign Candidate form states (New Flow)
  const [assignCandidateName, setAssignCandidateName] = useState('');
  const [assignCandidateEmail, setAssignCandidateEmail] = useState('');
  const [isAssigningCandidate, setIsAssigningCandidate] = useState(false);
  const [isEditingMapping, setIsEditingMapping] = useState(false);
  const [sendAsTeamsMeeting, setSendAsTeamsMeeting] = useState(true);
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);
  const [resendingPanelId, setResendingPanelId] = useState<string | null>(null);

  // Date Editor States
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [isUpdatingDates, setIsUpdatingDates] = useState(false);
  const [selectedInterviewForConfig, setSelectedInterviewForConfig] = useState<Interview | null>(null);

  // UI / UX States
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'COLLECTED' | 'SCHEDULED'>('all');
  const [detailTab, setDetailTab] = useState<'overview' | 'panels' | 'booking'>('overview');
  const [createError, setCreateError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

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
      setIsEditingDates(false);
    }

    if (selectedInterviewForConfig) {
      const updated = interviews.find((i) => i.id === selectedInterviewForConfig.id);
      setSelectedInterviewForConfig(updated || null);
    }
  }, [interviews, selectedInterview, selectedInterviewForConfig]);

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
    if (reqPanelists.length > 0 && reqStartDate && reqEndDate) {
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
  }, [reqPanelists, reqStartDate, reqEndDate, reqInterviewType, l1TimeStart, l1TimeEnd, l2TimeStart, l2TimeEnd]);

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
  const handleOpenSlotRequest = (p: Panelist | Panelist[], stage: 'L1' | 'L2') => {
    const arr = Array.isArray(p) ? p : [p];
    setReqPanelists(arr);
    setReqInterviewType(stage);
    setReqDuration('30');
    setReqStartDate(defaultStartDate);
    setReqEndDate(defaultEndDate);
  };

  // Submit L1/L2 Automagic Slot request
  const handleSendSlotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reqPanelists.length === 0) return;

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
    setCreateError(null);

    if (!candidateName.trim()) { setCreateError('Please enter the candidate name.'); return; }
    if (!candidateEmail.trim()) { setCreateError('Please enter the candidate email.'); return; }
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

  const handleCancelBooking = async () => {
    if (!selectedInterview) return;

    if (!confirm('Are you sure you want to cancel this booking and remove the scheduled slot? This will delete the calendar event from Microsoft Teams.')) {
      return;
    }

    setIsCancellingBooking(true);
    try {
      const res = await fetch('/api/interviews/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: selectedInterview.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to cancel booking');
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

    if (editStartDate < todayStr) {
      alert('Start date cannot be in the past.');
      return;
    }
    if (editEndDate < editStartDate) {
      alert('End date cannot be before the start date.');
      return;
    }

    setIsUpdatingDates(true);
    try {
      // Determine interview type (L1 or L2) from the role name or default to L1
      let type: 'L1' | 'L2' | 'General' = 'L1';
      if (target.role.includes('L2')) {
        type = 'L2';
      } else if (target.role.includes('General')) {
        type = 'General';
      }

      // Compute slots
      const timingStart = type === 'L2' ? l2TimeStart : l1TimeStart;
      const timingEnd = type === 'L2' ? l2TimeEnd : l1TimeEnd;
      
      const [startH, startM] = timingStart.split(':').map(Number);
      const [endH, endM] = timingEnd.split(':').map(Number);

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
        const stepMs = 30 * 60 * 1000;

        while (time + stepMs <= dayEnd.getTime()) {
          generatedSlots.push({
            startTime: new Date(time).toISOString(),
            endTime: new Date(time + stepMs).toISOString(),
          });
          time += stepMs;
        }

        currentDay.setDate(currentDay.getDate() + 1);
      }

      const res = await fetch(`/api/interviews/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: editStartDate,
          endDate: editEndDate,
          slots: generatedSlots,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update interview dates.');
      }

      const data = await res.json();
      const updatedList = interviews.map((i) => {
        if (i.id === target.id) {
          return data.interview;
        }
        return i;
      });

      setInterviews(updatedList);
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

  // Stats
  const statsPending = interviews.filter((i) => i.status === 'PENDING').length;
  const statsCollected = interviews.filter((i) => i.status === 'COLLECTED').length;
  const statsScheduled = interviews.filter((i) => i.status === 'SCHEDULED').length;

  // Filtered interview list based on status pill selection
  const filteredInterviews = statusFilter === 'all'
    ? interviews
    : interviews.filter((i) => i.status === statusFilter);

  // Active interview count per panelist (PENDING or COLLECTED)
  const activePanelistInterviewCount = (panelistId: string) =>
    interviews.filter(
      (i) => (i.status === 'PENDING' || i.status === 'COLLECTED') && i.panels.some((p) => p.userId === panelistId)
    ).length;

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
  const pendingInterviews = interviews.filter((i) => i.status === 'PENDING');

  const allL1Selected = l1Panelists.length > 0 && l1Panelists.every((p) => bulkSelectedL1Ids.includes(p.id));
  const handleToggleSelectAllL1 = () => {
    if (allL1Selected) {
      setBulkSelectedL1Ids(bulkSelectedL1Ids.filter((id) => !l1Panelists.some((p) => p.id === id)));
    } else {
      const newIds = [...bulkSelectedL1Ids];
      l1Panelists.forEach((p) => {
        if (!newIds.includes(p.id)) newIds.push(p.id);
      });
      setBulkSelectedL1Ids(newIds);
    }
  };

  const allL2Selected = l2Panelists.length > 0 && l2Panelists.every((p) => bulkSelectedL2Ids.includes(p.id));
  const handleToggleSelectAllL2 = () => {
    if (allL2Selected) {
      setBulkSelectedL2Ids(bulkSelectedL2Ids.filter((id) => !l2Panelists.some((p) => p.id === id)));
    } else {
      const newIds = [...bulkSelectedL2Ids];
      l2Panelists.forEach((p) => {
        if (!newIds.includes(p.id)) newIds.push(p.id);
      });
      setBulkSelectedL2Ids(newIds);
    }
  };

  return (
    <div>
      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
        <button
          onClick={() => { setActiveTab('interviews'); setAdminSelectedUser(null); }}
          className="btn btn-sm"
          style={{
            background: activeTab === 'interviews' ? 'rgba(99,102,241,0.1)' : 'transparent',
            border: activeTab === 'interviews' ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--border-glass)',
            color: activeTab === 'interviews' ? 'var(--primary)' : 'var(--text-muted)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.4rem 1rem',
            fontWeight: 600,
            fontSize: '0.85rem',
          }}
        >
          Interviews
        </button>
        <button
          onClick={() => { setActiveTab('panelists'); setSelectedInterview(null); setShowCreateForm(false); }}
          className="btn btn-sm"
          style={{
            background: activeTab === 'panelists' ? 'rgba(99,102,241,0.1)' : 'transparent',
            border: activeTab === 'panelists' ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--border-glass)',
            color: activeTab === 'panelists' ? 'var(--primary)' : 'var(--text-muted)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.4rem 1rem',
            fontWeight: 600,
            fontSize: '0.85rem',
          }}
        >
          Panelists
        </button>
        <button
          onClick={() => { setActiveTab('recruiters'); setSelectedInterview(null); setShowCreateForm(false); }}
          className="btn btn-sm"
          style={{
            background: activeTab === 'recruiters' ? 'rgba(99,102,241,0.1)' : 'transparent',
            border: activeTab === 'recruiters' ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--border-glass)',
            color: activeTab === 'recruiters' ? 'var(--primary)' : 'var(--text-muted)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.4rem 1rem',
            fontWeight: 600,
            fontSize: '0.85rem',
          }}
        >
          Recruiters
        </button>
        <button
          onClick={() => { setActiveTab('candidates'); setSelectedInterview(null); setShowCreateForm(false); }}
          className="btn btn-sm"
          style={{
            background: activeTab === 'candidates' ? 'rgba(99,102,241,0.1)' : 'transparent',
            border: activeTab === 'candidates' ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--border-glass)',
            color: activeTab === 'candidates' ? 'var(--primary)' : 'var(--text-muted)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.4rem 1rem',
            fontWeight: 600,
            fontSize: '0.85rem',
          }}
        >
          Candidate Queue
        </button>
      </div>

      {/* VIEW A: INTERVIEWS SCHEDULER TAB */}
      {activeTab === 'interviews' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
          
          {/* Left: Interviews list & Panelist Tracker */}
          <div>
            {/* Stats Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {[
                { label: 'Total', value: interviews.length, color: 'var(--text-muted)', active: statusFilter === 'all', onClick: () => setStatusFilter('all') },
                { label: 'Pending', value: statsPending, color: '#f59e0b', active: statusFilter === 'PENDING', onClick: () => setStatusFilter('PENDING') },
                { label: 'Ready', value: statsCollected, color: '#0ea5e9', active: statusFilter === 'COLLECTED', onClick: () => setStatusFilter('COLLECTED') },
                { label: 'Scheduled', value: statsScheduled, color: '#10b981', active: statusFilter === 'SCHEDULED', onClick: () => setStatusFilter('SCHEDULED') },
              ].map((stat) => (
                <button
                  key={stat.label}
                  onClick={stat.onClick}
                  style={{
                    background: stat.active ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${stat.active ? stat.color : 'var(--border-glass)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 0.5rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'var(--transition-fast)',
                    color: 'inherit',
                  }}
                >
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
                </button>
              ))}
            </div>

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

                      const statusBorderColor = interview.status === 'SCHEDULED'
                        ? '#10b981'
                        : interview.status === 'COLLECTED'
                        ? '#0ea5e9'
                        : '#f59e0b';

                      // Dynamic status colors for avatar and badge text
                      const avatarColors = interview.status === 'SCHEDULED'
                        ? { bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.3)', color: '#34d399' }
                        : interview.status === 'COLLECTED'
                        ? { bg: 'rgba(14, 165, 233, 0.08)', border: 'rgba(14, 165, 233, 0.3)', color: '#38bdf8' }
                        : { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24' };

                      // Candidate initials for avatar
                      const initials = interview.candidateName === 'Pending Assignment'
                        ? '?'
                        : interview.candidateName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

                      return (
                        <div
                          key={interview.id}
                          className={`glass-card ${isSelected ? 'selected-interview' : 'cockpit-card-hover'}`}
                          style={{
                            padding: '1rem 1.25rem 1rem 0',
                            cursor: 'pointer',
                            display: 'flex',
                            gap: '0',
                            overflow: 'hidden',
                            transition: 'var(--transition-fast)',
                          }}
                          onClick={() => {
                            setSelectedInterview(interview);
                            setShowCreateForm(false);
                            setSelectedSlot(null);
                            setDetailTab('overview');
                          }}
                        >
                          {/* Status left border strip */}
                          <div style={{ width: '4px', background: statusBorderColor, flexShrink: 0, marginRight: '1rem', borderRadius: '4px 0 0 4px' }} />

                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Top row: avatar + name + badges */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.65rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                                <div style={{
                                  width: '36px', height: '36px', flexShrink: 0,
                                  background: avatarColors.bg,
                                  border: `1px solid ${avatarColors.border}`,
                                  borderRadius: '50%',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '0.8rem', fontWeight: 800, color: avatarColors.color,
                                }}>
                                  {initials}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <h4 style={{ fontSize: '0.95rem', marginBottom: '0', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {interview.candidateName === 'Pending Assignment' ? (
                                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontWeight: 500 }}>Pending Assignment</span>
                                    ) : interview.candidateName}
                                  </h4>
                                  <p className="text-muted" style={{ fontSize: '0.7rem', marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {interview.role}
                                  </p>
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px', flexShrink: 0 }}>
                                {interview.status === 'PENDING' && <span className="badge badge-pending" style={{ fontSize: '0.6rem', whiteSpace: 'nowrap' }}>Awaiting Panels</span>}
                                {interview.status === 'COLLECTED' && <span className="badge badge-info" style={{ fontSize: '0.6rem', whiteSpace: 'nowrap' }}>Ready to Book</span>}
                                {interview.status === 'SCHEDULED' && <span className="badge badge-success" style={{ fontSize: '0.6rem', whiteSpace: 'nowrap' }}>Scheduled</span>}
                              </div>
                            </div>

                            {/* Panelists list */}
                            {interview.panels && interview.panels.length > 0 && (
                              <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '0.45rem', 
                                marginBottom: '0.75rem',
                                padding: '0.6rem 0.75rem',
                                background: 'rgba(255, 255, 255, 0.02)',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid rgba(255, 255, 255, 0.04)'
                              }}>
                                {/* Sent Request To / Availability Provided By */}
                                <div>
                                  <div style={{ 
                                    fontSize: '0.625rem', 
                                    textTransform: 'uppercase', 
                                    letterSpacing: '0.05em', 
                                    color: interview.status === 'COLLECTED' || interview.status === 'SCHEDULED' ? '#10b981' : 'var(--text-muted)', 
                                    fontWeight: 700, 
                                    marginBottom: '3px' 
                                  }}>
                                    {interview.status === 'COLLECTED' 
                                      ? 'Availability Provided By (Accepted)' 
                                      : interview.status === 'SCHEDULED' 
                                      ? 'Confirmed Panels' 
                                      : 'Sent Request To'}
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                    {interview.panels.map((p) => {
                                      const hasResponded = p.status === 'SUBMITTED';
                                      return (
                                        <span 
                                          key={p.id} 
                                          style={{ 
                                            fontSize: '0.7rem', 
                                            fontWeight: 500,
                                            padding: '0.15rem 0.4rem', 
                                            borderRadius: '4px',
                                            background: hasResponded ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                                            border: hasResponded ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid var(--border-glass)',
                                            color: hasResponded ? '#10b981' : 'var(--text-main)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '3.5px'
                                          }}
                                        >
                                          {hasResponded && <CheckCircle size={10} />}
                                          {p.name}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Waiting on Response From */}
                                {interview.panels.some((p) => p.status === 'PENDING') && (
                                  <div style={{ marginTop: '0.25rem', borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '0.25rem' }}>
                                    <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fbbf24', fontWeight: 700, marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                      <span className="animate-pulse" style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                                      Waiting on Response From
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                      {interview.panels.filter((p) => p.status === 'PENDING').map((p) => (
                                        <span 
                                          key={p.id} 
                                          style={{ 
                                            fontSize: '0.7rem', 
                                            fontWeight: 600,
                                            padding: '0.15rem 0.4rem', 
                                            borderRadius: '4px',
                                            background: 'rgba(245, 158, 11, 0.08)',
                                            border: '1px solid rgba(245, 158, 11, 0.2)',
                                            color: '#fbbf24',
                                          }}
                                        >
                                          {p.name}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Bottom row: scheduled info or date range + delete */}
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              marginTop: '0.5rem',
                              paddingTop: '0.5rem',
                              borderTop: '1px solid rgba(255, 255, 255, 0.04)' 
                            }}>
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
                                {/* Quick actions based on status */}
                                {interview.status === 'COLLECTED' && (
                                  <button 
                                    className="btn btn-primary btn-xs" 
                                    style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'var(--secondary)', border: 'none', height: 'auto', display: 'flex', alignItems: 'center', gap: '2px' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedInterview(interview);
                                      setShowCreateForm(false);
                                      setSelectedSlot(null);
                                      setDetailTab('booking');
                                    }}
                                  >
                                    <Calendar size={9} /> Book
                                  </button>
                                )}
                                {interview.status === 'SCHEDULED' && interview.teamsMeetingUrl && (
                                  <a 
                                    href={interview.teamsMeetingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-primary btn-xs" 
                                    style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'var(--success)', border: 'none', height: 'auto', display: 'flex', alignItems: 'center', gap: '2px' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Video size={9} /> Join
                                  </a>
                                )}
                                {interview.status === 'PENDING' && (
                                  <button 
                                    className="btn btn-secondary btn-xs" 
                                    style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border-glass)', height: 'auto', display: 'flex', alignItems: 'center', gap: '2px', background: 'rgba(255,255,255,0.02)' }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedInterview(interview);
                                      setShowCreateForm(false);
                                      setDetailTab('panels');
                                    }}
                                  >
                                    <Users size={9} /> View Panels
                                  </button>
                                )}

                                <button
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '0.2rem', borderRadius: '4px', border: 'none', background: 'transparent' }}
                                  onClick={(e) => handleDeleteInterview(interview.id, e)}
                                >
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
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button
                                    className="btn btn-secondary btn-sm flex-gap-2"
                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', height: 'auto' }}
                                    onClick={() => {
                                      setSelectedInterview(nom.interview);
                                      setEditStartDate(nom.interview.startDate.split('T')[0]);
                                      setEditEndDate(nom.interview.endDate.split('T')[0]);
                                      setDetailTab('overview');
                                      setIsEditingDates(true);
                                    }}
                                  >
                                    <Calendar size={11} /> Change Dates
                                  </button>
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
                              <strong style={{ fontSize: '0.95rem' }}>
                                {interview.candidateName === 'Pending Assignment' ? (
                                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontWeight: 500 }}>Pending Assignment</span>
                                ) : interview.candidateName}
                              </strong>
                              <span className="text-muted text-xs block" style={{ opacity: 0.8, marginTop: '2px' }}>
                                {interview.role} ({interview.duration} mins)
                              </span>
                            </div>
                            <span className="badge badge-pending" style={{ fontSize: '0.7rem' }}>Awaiting Panels</span>
                          </div>

                          <div style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-sm)', marginTop: '0.5rem', marginBottom: '0.75rem' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginBottom: '2px' }}>Proposed Date Window</div>
                            <div style={{ fontWeight: 600 }}>
                              {new Date(interview.startDate).toLocaleDateString()} - {new Date(interview.endDate).toLocaleDateString()}
                            </div>
                          </div>

                          {/* Nominated Panelists List */}
                          {interview.panels && interview.panels.length > 0 && (
                            <div style={{ 
                              display: 'flex', 
                              flexDirection: 'column', 
                              gap: '0.5rem', 
                              padding: '0.6rem 0.75rem',
                              background: 'rgba(255, 255, 255, 0.02)',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid rgba(255, 255, 255, 0.04)',
                              marginBottom: '0.75rem'
                            }}>
                              {/* Sent Request To */}
                              <div>
                                <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '3px' }}>
                                  Sent Request To
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                  {interview.panels.map((p) => (
                                    <span 
                                      key={p.id} 
                                      style={{ 
                                        fontSize: '0.7rem', 
                                        fontWeight: 500,
                                        padding: '0.15rem 0.4rem', 
                                        borderRadius: '4px',
                                        background: p.status === 'SUBMITTED' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                                        border: p.status === 'SUBMITTED' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-glass)',
                                        color: p.status === 'SUBMITTED' ? '#10b981' : 'var(--text-main)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                      }}
                                    >
                                      {p.status === 'SUBMITTED' && <CheckCircle size={10} />}
                                      {p.name}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Waiting on Response From */}
                              {interview.panels.some((p) => p.status === 'PENDING') && (
                                <div style={{ marginTop: '0.25rem', borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '0.25rem' }}>
                                  <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#fbbf24', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <span className="animate-pulse" style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                                    Waiting on Response From
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    {interview.panels.filter((p) => p.status === 'PENDING').map((p) => (
                                      <div 
                                        key={p.id} 
                                        style={{ 
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          background: 'rgba(245, 158, 11, 0.04)',
                                          border: '1px solid rgba(245, 158, 11, 0.15)',
                                          padding: '0.35rem 0.5rem',
                                          borderRadius: '4px'
                                        }}
                                      >
                                        <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#fbbf24' }}>
                                          {p.name}
                                        </span>
                                        <button
                                          onClick={() => handleResendInvite(interview.id, p.id)}
                                          className="btn btn-secondary btn-xs"
                                          style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem', height: 'auto', display: 'flex', alignItems: 'center', gap: '2px' }}
                                          disabled={resendingPanelId === p.id}
                                        >
                                          {resendingPanelId === p.id ? (
                                            <><Loader2 size={8} className="animate-spin" /> Sending...</>
                                          ) : (
                                            'Resend'
                                          )}
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <button
                              onClick={() => {
                                setSelectedInterview(interview);
                                setEditStartDate(interview.startDate.split('T')[0]);
                                setEditEndDate(interview.endDate.split('T')[0]);
                                setDetailTab('overview');
                                setIsEditingDates(true);
                              }}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', height: 'auto', display: 'flex', alignItems: 'center', gap: '3px' }}
                            >
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
                        min={todayStr}
                        onChange={(e) => { setStartDate(e.target.value); setCreateError(null); }}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Proposed Range End</label>
                      <input
                        type="date"
                        className="form-input"
                        value={endDate}
                        min={startDate || todayStr}
                        onChange={(e) => { setEndDate(e.target.value); setCreateError(null); }}
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
                          const activeCount = activePanelistInterviewCount(p.id);
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
                                transition: 'var(--transition-fast)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                              }}
                            >
                              {p.displayName} {isChosen ? '✓' : '+'}
                              {activeCount > 0 && (
                                <span style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '9px', padding: '0 5px', fontSize: '0.6rem', fontWeight: 700 }}>
                                  {activeCount} active
                                </span>
                              )}
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

                  {/* Inline error banner */}
                  {createError && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', padding: '0.6rem 0.9rem', fontSize: '0.8rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <XCircle size={14} style={{ flexShrink: 0 }} /> {createError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: '0.5rem' }}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <><Loader2 size={16} className="animate-spin" /> Dispatching Teams Invites...</>
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
                {/* Header */}
                <div className="flex-between" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span className="text-muted text-xs block" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Interview Details</span>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedInterview.candidateName === 'Pending Assignment' ? (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending Assignment</span>
                      ) : selectedInterview.candidateName}
                    </h3>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>{selectedInterview.role} · {selectedInterview.duration} mins</span>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSelectedInterview(null)} style={{ flexShrink: 0, marginLeft: '0.75rem' }}>
                    Close
                  </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border-glass)', marginBottom: '1.25rem' }}>
                  {([
                    { key: 'overview', label: 'Overview', icon: <User size={13} /> },
                    { key: 'panels', label: 'Panels', icon: <Users size={13} /> },
                    { key: 'booking', label: 'Booking', icon: <Calendar size={13} /> },
                  ] as { key: typeof detailTab; label: string; icon: React.ReactNode }[]).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setDetailTab(tab.key)}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        borderBottom: detailTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                        color: detailTab === tab.key ? 'var(--text-main)' : 'var(--text-muted)',
                        padding: '0.5rem 0.25rem',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem',
                        transition: 'color 0.2s',
                      }}
                    >
                      {tab.icon} {tab.label}
                    </button>
                  ))}
                </div>

                {/* TAB: Overview */}
                {detailTab === 'overview' && (
                  <div>
                    {/* Candidate assign / edit */}
                    {(selectedInterview.candidateName === 'Pending Assignment' || isEditingMapping) ? (
                      <div style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.15)', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
                        <h4 style={{ color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <User size={15} className="text-primary" />
                          {selectedInterview.candidateName === 'Pending Assignment' ? 'Assign Candidate' : 'Edit Candidate'}
                        </h4>
                        <p className="text-muted text-xs" style={{ marginBottom: '1rem' }}>
                          The Teams calendar invite will auto-update with candidate details.
                        </p>
                        <form onSubmit={async (e) => { await handleAssignCandidate(e); setIsEditingMapping(false); }} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: '0.72rem' }}>Candidate Name</label>
                              <input type="text" className="form-input" style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }} value={assignCandidateName} onChange={(e) => setAssignCandidateName(e.target.value)} placeholder="Alice Smith" required />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: '0.72rem' }}>Email (Optional)</label>
                              <input type="email" className="form-input" style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }} value={assignCandidateEmail} onChange={(e) => setAssignCandidateEmail(e.target.value)} placeholder="alice@example.com" />
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <label className="switch-container">
                              <input type="checkbox" className="switch-input" checked={sendAsTeamsMeeting} onChange={(e) => setSendAsTeamsMeeting(e.target.checked)} />
                              <span className="switch-toggle"></span>
                              <span className="switch-label">Teams meeting</span>
                            </label>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="submit" className="btn btn-primary btn-sm" disabled={isAssigningCandidate} style={{ flex: 1 }}>
                              {isAssigningCandidate ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Confirm & Save'}
                            </button>
                            {selectedInterview.candidateName !== 'Pending Assignment' && (
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsEditingMapping(false)}>Cancel</button>
                            )}
                          </div>
                        </form>
                      </div>
                    ) : (
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span className="text-muted text-xs block" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Candidate</span>
                          <strong style={{ fontSize: '1rem', color: 'var(--primary)' }}>{selectedInterview.candidateName}</strong>
                          {selectedInterview.candidateEmail && selectedInterview.candidateEmail !== 'pending@assign.com' && (
                            <span className="text-muted text-xs block" style={{ marginTop: '2px' }}>{selectedInterview.candidateEmail}</span>
                          )}
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setAssignCandidateName(selectedInterview.candidateName); setAssignCandidateEmail(selectedInterview.candidateEmail === 'pending@assign.com' ? '' : selectedInterview.candidateEmail); setIsEditingMapping(true); }}>
                          Edit
                        </button>
                      </div>
                    )}

                    {/* Interview meta grid */}
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

                    {/* Date Window Editor Form */}
                    {isEditingDates ? (
                      <div style={{ background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.15)', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
                        <h4 style={{ color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Calendar size={15} className="text-primary" />
                          Change Interview Date Window
                        </h4>
                        <p className="text-muted text-xs" style={{ marginBottom: '1rem' }}>
                          This will reset the availability collection flow and generate proposed slots in the new range.
                        </p>
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
                        <button 
                          className="btn btn-secondary btn-sm flex-gap-2" 
                          onClick={() => {
                            setEditStartDate(selectedInterview.startDate.split('T')[0]);
                            setEditEndDate(selectedInterview.endDate.split('T')[0]);
                            setIsEditingDates(true);
                          }}
                        >
                          <Calendar size={14} /> Change Date Window
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB: Panels */}
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
                            {p.availabilities && p.availabilities.length > 0 && (
                              <div style={{ fontSize: '0.65rem', color: '#0ea5e9', marginTop: '2px' }}>{p.availabilities.length} slot{p.availabilities.length !== 1 ? 's' : ''} submitted</div>
                            )}
                          </div>
                        </div>
                        {p.status === 'SUBMITTED' ? (
                          <span className="badge badge-success" style={{ fontSize: '0.6rem' }}><CheckCircle size={9} style={{ display: 'inline', marginRight: '2px' }} />Responded</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                            <span className="badge badge-pending" style={{ fontSize: '0.6rem' }}><Clock size={9} style={{ display: 'inline', marginRight: '2px' }} />Pending</span>
                            <button
                              onClick={() => handleResendInvite(selectedInterview.id, p.id)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.15rem 0.4rem', fontSize: '0.6rem', height: 'auto', display: 'flex', alignItems: 'center', gap: '2px' }}
                              disabled={resendingPanelId === p.id}
                            >
                              {resendingPanelId === p.id ? (
                                <><Loader2 size={8} className="animate-spin" /> Sending...</>
                              ) : (
                                'Resend Invite'
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB: Booking */}
                {detailTab === 'booking' && (
                  <div>
                    {selectedInterview.status === 'SCHEDULED' ? (
                      <div style={{ background: 'var(--success-glow)', border: '1px solid var(--success)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
                        <h4 style={{ color: 'var(--success)', fontSize: '1rem', marginBottom: '1rem' }} className="flex-gap-2">
                          <CheckCircle size={18} /> Meeting Scheduled!
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16,185,129,0.15)' }}>
                            <div className="text-muted text-xs" style={{ marginBottom: '2px' }}>Panelist(s)</div>
                            <strong style={{ fontSize: '0.9rem' }}>
                              {selectedInterview.panels.filter((p) => p.status === 'SUBMITTED').map((p) => p.name).join(', ') || 'None'}
                            </strong>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16,185,129,0.15)' }}>
                            <div className="text-muted text-xs" style={{ marginBottom: '2px' }}>Date</div>
                            <strong style={{ fontSize: '0.9rem' }}>{new Date(selectedInterview.scheduledSlotStart || '').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16,185,129,0.15)' }}>
                            <div className="text-muted text-xs" style={{ marginBottom: '2px' }}>Time Slot (UTC)</div>
                            <strong style={{ fontSize: '0.9rem' }}>
                              {new Date(selectedInterview.scheduledSlotStart || '').toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} –{' '}
                              {new Date(selectedInterview.scheduledSlotEnd || '').toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </strong>
                          </div>
                        </div>
                        {selectedInterview.teamsMeetingUrl && (
                          <a href={selectedInterview.teamsMeetingUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary flex-gap-2" style={{ width: '100%', background: 'var(--success)', border: 'none', marginBottom: '0.5rem' }}>
                            <Video size={16} /> Join Teams Meeting
                          </a>
                        )}
                        <button
                          onClick={handleCancelBooking}
                          className="btn btn-secondary flex-gap-2"
                          style={{ width: '100%', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)' }}
                          disabled={isCancellingBooking}
                        >
                          {isCancellingBooking ? (
                            <><Loader2 size={16} className="animate-spin" /> Cancelling Booking...</>
                          ) : (
                            'Remove Booked Slot / Cancel Meeting'
                          )}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', fontWeight: 600 }} className="flex-gap-2">
                          <Calendar size={15} /> Overlapping Free Slots
                        </h4>

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
                                <><Loader2 size={16} className="animate-spin" /> Scheduling Teams Event...</>
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
          
          {/* Interview Scheduler Defaults Card */}
          <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} className="text-primary" /> Interview Scheduler Defaults
            </h3>
            <p className="text-muted text-xs" style={{ marginBottom: '1.25rem' }}>
              Configure the default daily time windows, proposed date range, and college/institution name used when auto-generating interview slot proposals.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1.25rem' }}>
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

              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: '#fb923c', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Building2 size={14} /> College / Institution
                </h4>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>College Name</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '0.85rem', padding: '0.4rem' }}
                    value={collegeName}
                    onChange={(e) => setCollegeName(e.target.value)}
                    placeholder="e.g. IIT Bombay, NIT Trichy..."
                  />
                </div>
                <p className="text-muted" style={{ fontSize: '0.65rem', marginTop: '0.5rem', lineHeight: 1.4 }}>
                  Default institution shown in slot request messages.
                </p>
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
                                display: 'flex', 
                                flexDirection: 'column',
                                gap: '0.5rem',
                                padding: '0.75rem',
                                background: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                                border: isSelected ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid var(--border-glass)',
                                borderRadius: 'var(--radius-md)',
                                transition: 'var(--transition-fast)'
                              }}
                            >
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                <input 
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    if (isSelected) {
                                      setBulkSelectedL1Ids(bulkSelectedL1Ids.filter((id) => id !== p.id));
                                    } else {
                                      setBulkSelectedL1Ids([...bulkSelectedL1Ids, p.id]);
                                    }
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

                  {/* Column 2: L2 Panelists Directory */}
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
                                display: 'flex', 
                                flexDirection: 'column',
                                gap: '0.5rem',
                                padding: '0.75rem',
                                background: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255, 255, 255, 0.01)',
                                border: isSelected ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid var(--border-glass)',
                                borderRadius: 'var(--radius-md)',
                                transition: 'var(--transition-fast)'
                              }}
                            >
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                <input 
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    if (isSelected) {
                                      setBulkSelectedL2Ids(bulkSelectedL2Ids.filter((id) => id !== p.id));
                                    } else {
                                      setBulkSelectedL2Ids([...bulkSelectedL2Ids, p.id]);
                                    }
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
                  position: 'sticky', 
                  bottom: '1rem', 
                  background: 'rgba(15, 23, 42, 0.9)', 
                  backdropFilter: 'blur(10px)', 
                  border: '1px solid rgba(99, 102, 241, 0.3)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '0.75rem 1.25rem', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                  zIndex: 90,
                  marginTop: '1.5rem'
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
                      onClick={() => {
                        setBulkSelectedL1Ids([]);
                        setBulkSelectedL2Ids([]);
                      }}
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
        </div>
      )}

      {/* VIEW C: MANAGE RECRUITERS TAB */}
      {activeTab === 'recruiters' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '2rem' }}>
            
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
                              <button
                                onClick={() => handleRemoveRecruiter(recruiter.email)}
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem' }}
                                onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                onMouseLeave={(e) => e.currentTarget.style.color = ''}
                                title="Revoke access"
                              >
                                <Trash2 size={15} />
                              </button>
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
      )}

      {/* VIEW D: CANDIDATES QUEUE TAB */}
      {activeTab === 'candidates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
            
            {/* Left Column: Upload area */}
            <div className="glass-card" style={{ height: 'fit-content', padding: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={18} className="text-primary" />
                Candidate Bulk Upload
              </h3>
              <p className="text-muted text-xs" style={{ marginBottom: '1.25rem' }}>
                Upload an Excel template or CSV containing candidate <strong>Name</strong> and <strong>Email</strong> to add them to the queue.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Default Date Selection (Optional) */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Default Interview Date (Optional)</label>
                  <input
                    type="date"
                    className="form-input"
                    value={uploadDefaultDate}
                    onChange={(e) => setUploadDefaultDate(e.target.value)}
                    min={todayStr}
                    style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}
                  />
                </div>
                <div style={{
                  border: '2px dashed var(--border-glass)',
                  borderRadius: 'var(--radius-md)',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  background: 'rgba(0, 0, 0, 0.15)',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'var(--transition-fast)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
                >
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelUpload}
                    disabled={isUploadingCandidates}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer'
                    }}
                  />
                  {isUploadingCandidates ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <Loader2 size={32} className="animate-spin text-primary" />
                      <span className="text-xs text-muted">Parsing & Uploading File...</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <Plus size={32} className="text-muted" />
                      <span className="text-xs font-semibold text-main">Click or Drag File Here</span>
                      <span className="text-xxs text-muted">Supports XLSX, XLS, CSV</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleDownloadTemplate}
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                >
                  Download CSV Template
                </button>

                {uploadError && (
                  <div style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem',
                    color: '#f87171',
                    fontSize: '0.8rem'
                  }}>
                    {uploadError}
                  </div>
                )}

                {uploadSuccessMessage && (
                  <div style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.75rem',
                    color: '#34d399',
                    fontSize: '0.8rem'
                  }}>
                    {uploadSuccessMessage}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Queue Listing */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem', fontFamily: 'var(--font-heading)' }}>
                    Authorized Candidate Queue
                  </h3>
                  <p className="text-muted text-xs">
                    List of candidates uploaded and waiting for/mapped to L1 interviews.
                  </p>
                </div>

                {/* Filters */}
                <div className="flex-gap-2">
                  <div style={{ position: 'relative', width: '180px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      placeholder="Search candidate..."
                      className="form-input"
                      value={candidateSearchQuery}
                      onChange={(e) => setCandidateSearchQuery(e.target.value)}
                      style={{ paddingLeft: '28px', fontSize: '0.75rem', height: '32px', borderRadius: 'var(--radius-sm)' }}
                    />
                  </div>
                  <select
                    className="form-input"
                    value={candidateStatusFilter}
                    onChange={(e) => setCandidateStatusFilter(e.target.value as any)}
                    style={{ fontSize: '0.75rem', height: '32px', width: '120px', borderRadius: 'var(--radius-sm)' }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="WAITING">Waiting</option>
                    <option value="MAPPED">Mapped</option>
                  </select>
                </div>
              </div>

              {isLoadingCandidates ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                  <Loader2 size={32} className="animate-spin text-primary" />
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Name</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Email</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Preferred Date</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Uploaded At</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Status</th>
                        <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Mapped Interview</th>
                        <th style={{ padding: '0.75rem 1rem', width: '60px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates
                        .filter((c) => {
                          const matchesQuery = c.name.toLowerCase().includes(candidateSearchQuery.toLowerCase()) ||
                                               c.email.toLowerCase().includes(candidateSearchQuery.toLowerCase());
                          const matchesStatus = candidateStatusFilter === 'all' || c.status === candidateStatusFilter;
                          return matchesQuery && matchesStatus;
                        })
                        .map((candidate) => {
                          const mappedIntv = candidate.mappedInterviewId 
                            ? interviews.find((i) => i.id === candidate.mappedInterviewId)
                            : null;

                          return (
                            <tr key={candidate.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }} className="search-item-hover">
                              <td style={{ padding: '1rem', color: 'var(--text-main)', fontWeight: 600 }}>{candidate.name}</td>
                              <td style={{ padding: '1rem', color: 'var(--text-main)' }}>{candidate.email}</td>
                              <td style={{ padding: '1rem' }}>
                                {candidate.status === 'WAITING' ? (
                                  <input
                                    type="date"
                                    className="form-input"
                                    value={candidate.preferredDate || ''}
                                    onChange={(e) => handleUpdateCandidateDate(candidate.id, e.target.value)}
                                    style={{
                                      fontSize: '0.8rem',
                                      padding: '0.2rem 0.4rem',
                                      height: '28px',
                                      width: '135px',
                                      borderRadius: 'var(--radius-sm)',
                                      background: 'rgba(0, 0, 0, 0.3)',
                                      border: '1px solid var(--border-glass)',
                                      color: 'var(--text-main)'
                                    }}
                                  />
                                ) : (
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    {candidate.preferredDate ? new Date(candidate.preferredDate).toLocaleDateString() : 'N/A'}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                {new Date(candidate.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td style={{ padding: '1rem' }}>
                                {candidate.status === 'WAITING' ? (
                                  <span className="badge badge-pending">Waiting</span>
                                ) : (
                                  <span className="badge badge-success">Mapped</span>
                                )}
                              </td>
                              <td style={{ padding: '1rem', fontSize: '0.8rem' }}>
                                {mappedIntv ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    <span style={{ fontWeight: 600 }}>{mappedIntv.role}</span>
                                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                                      {mappedIntv.scheduledSlotStart 
                                        ? new Date(mappedIntv.scheduledSlotStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                                        : 'Pending Slot'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted font-italic">—</span>
                                )}
                              </td>
                              <td style={{ padding: '1rem', textAlign: 'right' }}>
                                <button
                                  onClick={() => handleDeleteCandidate(candidate.id)}
                                  disabled={candidate.status === 'MAPPED'}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: candidate.status === 'MAPPED' ? 'not-allowed' : 'pointer',
                                    color: candidate.status === 'MAPPED' ? 'rgba(255,255,255,0.02)' : 'var(--text-muted)',
                                    padding: '0.2rem'
                                  }}
                                  onMouseEnter={(e) => { if (candidate.status !== 'MAPPED') e.currentTarget.style.color = '#ef4444'; }}
                                  onMouseLeave={(e) => { if (candidate.status !== 'MAPPED') e.currentTarget.style.color = ''; }}
                                  title={candidate.status === 'MAPPED' ? 'Cannot delete mapped candidate' : 'Remove candidate'}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                      {candidates.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            No candidates registered in the queue. Download the template on the left and upload candidates.
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
      )}


      {/* Request Slot Overlay Modal (New Automagic Flow) */}
      {reqPanelists.length > 0 && (
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
                    min={todayStr}
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
                    min={reqStartDate || todayStr}
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
                  <p style={{ margin: '4px 0', fontSize: '0.8rem' }}>
                    Hello <strong>{reqPanelists.length === 1 ? reqPanelists[0].displayName : '[Panelist Name]'}</strong>,
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '0.8rem' }}>You have been requested to conduct an <strong>{reqInterviewType} Interview</strong>.</p>
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
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setReqPanelists([])}
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
          border-color: var(--primary) !important;
          box-shadow: 0 0 15px rgba(99, 102, 241, 0.25) !important;
        }
        .cockpit-card-hover {
          transition: var(--transition-fast) !important;
        }
        .cockpit-card-hover:hover {
          background: rgba(22, 29, 47, 0.6) !important;
          border-color: rgba(255, 255, 255, 0.12) !important;
          transform: translateY(-2px);
          box-shadow: var(--shadow-card), 0 4px 20px rgba(99, 102, 241, 0.08) !important;
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
