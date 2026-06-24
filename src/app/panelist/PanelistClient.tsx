'use client';

import React, { useState } from 'react';
import { PanelistInterview, Interview, InterviewPanel, Drive } from '@/lib/db';
import AvailabilityClient from '../availability/[token]/AvailabilityClient';
import {
  Video,
  CheckCircle,
  XCircle,
  Clock,
  User,
  MessageSquare,
  Loader2,
  CalendarCheck,
  Calendar,
  AlertCircle,
  SlidersHorizontal,
  X
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PanelistClientProps {
  initialInterviews: PanelistInterview[];
  initialRequests: { interview: Interview; panel: InterviewPanel }[];
  panelistRoles: string[];
  panelistName: string;
  activeDrive: Drive | null;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending',
  PASSED_L1: 'Passed L1',
  PASSED_L2: 'Passed L2',
  SELECTED: 'Selected',
  REJECTED: 'Rejected',
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'badge-pending',
  PASSED_L1: 'badge-info',
  PASSED_L2: 'badge-info',
  SELECTED: 'badge-success',
  REJECTED: 'badge-danger',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#f59e0b',
  PASSED_L1: '#0ea5e9',
  PASSED_L2: '#7c3aed',
  SELECTED: '#10b981',
  REJECTED: '#ef4444',
};

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

export default function PanelistClient({ initialInterviews, initialRequests, panelistRoles, panelistName, activeDrive }: PanelistClientProps) {
  const [interviews, setInterviews] = useState<PanelistInterview[]>(initialInterviews);
  const [pendingRequests, setPendingRequests] = useState<{ interview: Interview; panel: InterviewPanel }[]>(initialRequests);
  const [selectedRequest, setSelectedRequest] = useState<{ interview: Interview; panel: InterviewPanel } | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, string>>({});
  const [submittingFeedback, setSubmittingFeedback] = useState<Record<string, boolean>>({});
  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});
  const [feedbackError, setFeedbackError] = useState<Record<string, string | null>>({});
  const [isEditing, setIsEditing] = useState<Record<string, boolean>>({});
  const [pendingL1PassConfirm, setPendingL1PassConfirm] = useState<PanelistInterview | null>(null);

  // Filter states
  const [filterActiveDrive, setFilterActiveDrive] = useState(!!activeDrive);
  const [filterDate, setFilterDate] = useState<string | null>(null);

  // Accordion state for feedback cards
  const [expandedFeedbacks, setExpandedFeedbacks] = useState<Record<string, boolean>>({});
  const [l1FeedbacksForCandidate, setL1FeedbacksForCandidate] = useState<Record<string, { panelId: string; panelistName: string; panelistEmail: string; role: string; decision: string; feedback: string; submittedAt: string | null }[]>>({});
  const [loadingL1Feedbacks, setLoadingL1Feedbacks] = useState<Record<string, boolean>>({});
  
  // Primary tab state (Panels vs Interviews & Feedback)
  const [activePrimaryTab, setActivePrimaryTab] = useState<'PANELS' | 'FEEDBACK'>('PANELS');

  // Round Tab state for filtering L1 vs L2 candidates
  const [activeRoundTab, setActiveRoundTab] = useState<'ALL' | 'L1' | 'L2'>('ALL');

  const fetchL1FeedbackForCandidate = async (candidateEmail: string, panelId: string) => {
    if (l1FeedbacksForCandidate[panelId]) return;
    setLoadingL1Feedbacks((prev) => ({ ...prev, [panelId]: true }));
    try {
      const res = await fetch(`/api/panelist/l1-feedback?email=${encodeURIComponent(candidateEmail)}`);
      if (res.ok) {
        const data = await res.json();
        setL1FeedbacksForCandidate((prev) => ({ ...prev, [panelId]: data.feedbacks }));
      }
    } catch (err) {
      console.error('Failed to load L1 feedbacks:', err);
    } finally {
      setLoadingL1Feedbacks((prev) => ({ ...prev, [panelId]: false }));
    }
  };

  const toggleFeedbackExpansion = (panelId: string, isL2Role: boolean, candidateEmail: string) => {
    setExpandedFeedbacks((prev) => {
      const nextState = !prev[panelId];
      if (nextState && isL2Role && candidateEmail) {
        fetchL1FeedbackForCandidate(candidateEmail, panelId);
      }
      return { ...prev, [panelId]: nextState };
    });
  };

  // Structured score states keyed by panelId
  const [l1Ratings, setL1Ratings] = useState<Record<string, { coding: number; communication: number; fundamentals: number; codingNotes: string; commNotes: string; fundNotes: string; comments: string }>>({});
  const [l2Ratings, setL2Ratings] = useState<Record<string, { design: number; depth: number; leadership: number; fit: number; designNotes: string; depthNotes: string; leadNotes: string; fitNotes: string; comments: string }>>({});
  const [genRatings, setGenRatings] = useState<Record<string, { technical: number; communication: number; collaboration: number; techNotes: string; commNotes: string; collabNotes: string; comments: string }>>({});

  const isL1 = panelistRoles.includes('L1');
  const isL2 = panelistRoles.includes('L2');

  const getCollegeNameFromRole = (role: string): string => {
    const parts = role.split(' - ');
    return parts.length > 1 ? parts[1].trim() : '';
  };

  const isFromActiveDrive = (role: string): boolean => {
    if (!activeDrive || !activeDrive.collegeName) return false;
    const college = getCollegeNameFromRole(role);
    return college.toLowerCase() === activeDrive.collegeName.toLowerCase();
  };

  const getRoleBadgeStyle = (role: string) => {
    const isL1Role = role.toLowerCase().includes('l1');
    const isL2Role = role.toLowerCase().includes('l2');
    
    if (isL1Role) {
      return {
        background: 'var(--badge-l1-bg)',
        border: '1px solid var(--badge-l1-border)',
        color: 'var(--badge-l1-text)',
        label: 'L1 Round'
      };
    } else if (isL2Role) {
      return {
        background: 'var(--badge-l2-bg)',
        border: '1px solid var(--badge-l2-border)',
        color: 'var(--badge-l2-text)',
        label: 'L2 Round'
      };
    }
    return {
      background: 'rgba(99, 102, 241, 0.08)',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      color: 'var(--primary)',
      label: 'General Round'
    };
  };

  // Memoized sorted and filtered interviews:
  // 1. Active drive first
  // 2. Chronologically by slot timing (earliest scheduledSlotStart first)
  // 3. Alphabetically by college name
  const filteredSortedInterviews = React.useMemo(() => {
    let result = [...interviews];

    if (filterActiveDrive && activeDrive) {
      result = result.filter((i) => isFromActiveDrive(i.role));
    }

    if (filterDate) {
      result = result.filter((i) => {
        if (!i.scheduledSlotStart) return false;
        const d = new Date(i.scheduledSlotStart);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const localDateStr = `${y}-${m}-${day}`;
        return localDateStr === filterDate;
      });
    }

    if (activeRoundTab === 'L1') {
      result = result.filter((i) => i.role.toLowerCase().includes('l1'));
    } else if (activeRoundTab === 'L2') {
      result = result.filter((i) => i.role.toLowerCase().includes('l2'));
    }

    return result.sort((a, b) => {
      // 1. Prioritize pending feedback (where feedback is not yet submitted)
      const aPending = !(a.panelFeedback || a.panelDecision);
      const bPending = !(b.panelFeedback || b.panelDecision);
      if (aPending && !bPending) return -1;
      if (!aPending && bPending) return 1;

      // 2. Active drive first
      const aActive = isFromActiveDrive(a.role);
      const bActive = isFromActiveDrive(b.role);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      // 3. Chronologically by slot timing (earliest scheduledSlotStart first)
      const aTime = new Date(a.scheduledSlotStart).getTime();
      const bTime = new Date(b.scheduledSlotStart).getTime();
      if (aTime !== bTime) {
        return aTime - bTime;
      }

      const aCollege = getCollegeNameFromRole(a.role);
      const bCollege = getCollegeNameFromRole(b.role);
      return aCollege.localeCompare(bCollege);
    });
  }, [interviews, activeDrive, filterActiveDrive, filterDate, activeRoundTab]);

  // Memoized sorted and filtered pending requests (slots):
  // 1. Active drive first
  // 2. Chronologically descending (latest startDate first)
  // 3. Fallback to newest creation time (createdAt) first
  const filteredSortedRequests = React.useMemo(() => {
    let result = [...pendingRequests];

    if (filterActiveDrive && activeDrive) {
      result = result.filter((req) => isFromActiveDrive(req.interview.role));
    }

    if (filterDate) {
      const [y, m, d] = filterDate.split('-').map(Number);
      const targetDate = new Date(y, m - 1, d);
      targetDate.setHours(0, 0, 0, 0);
      result = result.filter((req) => {
        const start = new Date(req.interview.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(req.interview.endDate);
        end.setHours(23, 59, 59, 999);
        return targetDate >= start && targetDate <= end;
      });
    }

    if (activeRoundTab === 'L1') {
      result = result.filter((req) => req.interview.role.toLowerCase().includes('l1'));
    } else if (activeRoundTab === 'L2') {
      result = result.filter((req) => req.interview.role.toLowerCase().includes('l2'));
    }

    return result.sort((a, b) => {
      const aActive = isFromActiveDrive(a.interview.role);
      const bActive = isFromActiveDrive(b.interview.role);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;

      const aStart = new Date(a.interview.startDate).getTime();
      const bStart = new Date(b.interview.startDate).getTime();
      if (aStart !== bStart) {
        return bStart - aStart; // latest first
      }

      const aCreate = a.interview.createdAt ? new Date(a.interview.createdAt).getTime() : 0;
      const bCreate = b.interview.createdAt ? new Date(b.interview.createdAt).getTime() : 0;
      return bCreate - aCreate; // latest first
    });
  }, [pendingRequests, activeDrive, filterActiveDrive, filterDate, activeRoundTab]);

  // Memoized dynamic counts for primary and secondary tabs (taking into account active drive and date filters)
  const tabCounts = React.useMemo(() => {
    // Filter pending requests first
    let tempReqs = [...pendingRequests];
    if (filterActiveDrive && activeDrive) {
      tempReqs = tempReqs.filter((req) => isFromActiveDrive(req.interview.role));
    }
    if (filterDate) {
      const [y, m, d] = filterDate.split('-').map(Number);
      const targetDate = new Date(y, m - 1, d);
      targetDate.setHours(0, 0, 0, 0);
      tempReqs = tempReqs.filter((req) => {
        const start = new Date(req.interview.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(req.interview.endDate);
        end.setHours(23, 59, 59, 999);
        return targetDate >= start && targetDate <= end;
      });
    }

    // Filter interviews next
    let tempInterviews = [...interviews];
    if (filterActiveDrive && activeDrive) {
      tempInterviews = tempInterviews.filter((i) => isFromActiveDrive(i.role));
    }
    if (filterDate) {
      tempInterviews = tempInterviews.filter((i) => {
        if (!i.scheduledSlotStart) return false;
        const d = new Date(i.scheduledSlotStart);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const localDateStr = `${y}-${m}-${day}`;
        return localDateStr === filterDate;
      });
    }

    // Total requests vs scheduled
    const totalRequests = tempReqs.length;
    const totalFeedback = tempInterviews.length;

    // Split by round for requests
    const l1Requests = tempReqs.filter(r => r.interview.role.toLowerCase().includes('l1')).length;
    const l2Requests = tempReqs.filter(r => r.interview.role.toLowerCase().includes('l2')).length;
    const generalRequests = totalRequests - l1Requests - l2Requests;

    // Split by round for interviews (feedback)
    const l1Feedback = tempInterviews.filter(i => i.role.toLowerCase().includes('l1')).length;
    const l2Feedback = tempInterviews.filter(i => i.role.toLowerCase().includes('l2')).length;
    const generalFeedback = totalFeedback - l1Feedback - l2Feedback;

    return {
      requests: {
        total: totalRequests,
        l1: l1Requests,
        l2: l2Requests,
        general: generalRequests
      },
      feedback: {
        total: totalFeedback,
        l1: l1Feedback,
        l2: l2Feedback,
        general: generalFeedback
      }
    };
  }, [interviews, pendingRequests, filterActiveDrive, filterDate, activeDrive]);

  const refreshInterviews = async () => {
    try {
      const [interviewsRes, requestsRes] = await Promise.all([
        fetch('/api/panelist/interviews'),
        fetch('/api/panelist/requests')
      ]);
      if (interviewsRes.ok) setInterviews(await interviewsRes.ok ? await interviewsRes.json() : []);
      if (requestsRes.ok) setPendingRequests(await requestsRes.ok ? await requestsRes.json() : []);
    } catch (err) {
      console.error('Failed to refresh interviews or requests', err);
    }
  };

  const startEditing = (interview: PanelistInterview) => {
    let parsed: any = null;
    try {
      if (interview.panelFeedback && interview.panelFeedback.startsWith('{')) {
        parsed = JSON.parse(interview.panelFeedback);
      }
    } catch (e) {}

    const roleLower = interview.role.toLowerCase();
    const isL1Role = roleLower.includes('l1');
    const isL2Role = roleLower.includes('l2');

    if (isL1Role && parsed && parsed.scores) {
      setL1Ratings((prev) => ({
        ...prev,
        [interview.panelId]: {
          coding: parsed.scores.coding || 0,
          communication: parsed.scores.communication || 0,
          fundamentals: parsed.scores.fundamentals || 0,
          codingNotes: parsed.notes?.codingNotes || '',
          commNotes: parsed.notes?.communicationNotes || '',
          fundNotes: parsed.notes?.fundamentalsNotes || '',
          comments: parsed.comments || '',
        },
      }));
    } else if (isL2Role && parsed && parsed.scores) {
      setL2Ratings((prev) => ({
        ...prev,
        [interview.panelId]: {
          design: parsed.scores.systemDesign || 0,
          depth: parsed.scores.technicalDepth || 0,
          leadership: parsed.scores.leadership || 0,
          fit: parsed.scores.culturalFit || 0,
          designNotes: parsed.notes?.systemDesignNotes || '',
          depthNotes: parsed.notes?.technicalDepthNotes || '',
          leadNotes: parsed.notes?.leadershipNotes || '',
          fitNotes: parsed.notes?.culturalFitNotes || '',
          comments: parsed.comments || '',
        },
      }));
    } else if (parsed && parsed.scores) {
      setGenRatings((prev) => ({
        ...prev,
        [interview.panelId]: {
          technical: parsed.scores.technical || 0,
          communication: parsed.scores.communication || 0,
          collaboration: parsed.scores.collaboration || 0,
          techNotes: parsed.notes?.technicalNotes || '',
          commNotes: parsed.notes?.communicationNotes || '',
          collabNotes: parsed.notes?.collaborationNotes || '',
          comments: parsed.comments || '',
        },
      }));
    }

    setIsEditing((prev) => ({ ...prev, [interview.panelId]: true }));
  };

  const handleStatusChange = async (interview: PanelistInterview, newStatus: string) => {
    if (!interview.candidateId) return;
    setUpdatingStatus((prev) => ({ ...prev, [interview.panelId]: true }));
    try {
      const res = await fetch(`/api/panelist/candidate-status/${interview.candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcomeStatus: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      setInterviews((prev) =>
        prev.map((i) => i.panelId === interview.panelId ? { ...i, outcomeStatus: newStatus } : i)
      );
    } catch (err) {
      console.error('Status update failed', err);
    } finally {
      setUpdatingStatus((prev) => ({ ...prev, [interview.panelId]: false }));
    }
  };

  const handleFeedbackSubmit = (interview: PanelistInterview, decision: 'PASSED' | 'REJECTED') => {
    const roleLower = interview.role.toLowerCase();
    const isL1Role = roleLower.includes('l1');

    if (isL1Role && decision === 'PASSED') {
      setPendingL1PassConfirm(interview);
      return;
    }

    performFeedbackSubmit(interview, decision);
  };

  const performFeedbackSubmit = async (interview: PanelistInterview, decision: 'PASSED' | 'REJECTED') => {
    const roleLower = interview.role.toLowerCase();
    const isL1Role = roleLower.includes('l1');
    const isL2Role = roleLower.includes('l2');

    setSubmittingFeedback((prev) => ({ ...prev, [interview.panelId]: true }));
    setFeedbackError((prev) => ({ ...prev, [interview.panelId]: null }));

    let feedbackString = '';

    try {
      if (isL1Role) {
        const current = l1Ratings[interview.panelId] || {
          coding: 0,
          communication: 0,
          fundamentals: 0,
          codingNotes: '',
          commNotes: '',
          fundNotes: '',
          comments: '',
        };

        if (current.coding === 0 || current.communication === 0 || current.fundamentals === 0) {
          throw new Error('Please provide ratings for all evaluation metrics.');
        }

        feedbackString = JSON.stringify({
          type: 'L1',
          scores: {
            coding: current.coding,
            communication: current.communication,
            fundamentals: current.fundamentals,
          },
          notes: {
            codingNotes: current.codingNotes,
            communicationNotes: current.commNotes,
            fundamentalsNotes: current.fundNotes,
          },
          comments: current.comments,
        });
      } else if (isL2Role) {
        const current = l2Ratings[interview.panelId] || {
          design: 0,
          depth: 0,
          leadership: 0,
          fit: 0,
          designNotes: '',
          depthNotes: '',
          leadNotes: '',
          fitNotes: '',
          comments: '',
        };

        if (current.design === 0 || current.depth === 0 || current.leadership === 0 || current.fit === 0) {
          throw new Error('Please provide ratings for all evaluation metrics.');
        }

        feedbackString = JSON.stringify({
          type: 'L2',
          scores: {
            systemDesign: current.design,
            technicalDepth: current.depth,
            leadership: current.leadership,
            culturalFit: current.fit,
          },
          notes: {
            systemDesignNotes: current.designNotes,
            technicalDepthNotes: current.depthNotes,
            leadershipNotes: current.leadNotes,
            culturalFitNotes: current.fitNotes,
          },
          comments: current.comments,
        });
      } else {
        const current = genRatings[interview.panelId] || {
          technical: 0,
          communication: 0,
          collaboration: 0,
          techNotes: '',
          commNotes: '',
          collabNotes: '',
          comments: '',
        };

        if (current.technical === 0 || current.communication === 0 || current.collaboration === 0) {
          throw new Error('Please provide ratings for all evaluation metrics.');
        }

        feedbackString = JSON.stringify({
          type: 'General',
          scores: {
            technical: current.technical,
            communication: current.communication,
            collaboration: current.collaboration,
          },
          notes: {
            technicalNotes: current.techNotes,
            communicationNotes: current.commNotes,
            collaborationNotes: current.collabNotes,
          },
          comments: current.comments,
        });
      }

      const res = await fetch(`/api/panelist/feedback/${interview.panelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedbackString, decision }),
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to submit feedback');
      }

      setIsEditing((prev) => ({ ...prev, [interview.panelId]: false }));
      await refreshInterviews();
    } catch (err: any) {
      setFeedbackError((prev) => ({ ...prev, [interview.panelId]: err.message || 'Failed to submit' }));
    } finally {
      setSubmittingFeedback((prev) => ({ ...prev, [interview.panelId]: false }));
    }
  };

  const renderStarRating = (
    currentRating: number,
    onChange: (rating: number) => void,
    disabled = false
  ) => {
    return (
      <div style={{ display: 'flex', gap: '6px' }}>
        {[1, 2, 3, 4, 5].map((star) => {
          const active = star <= currentRating;
          return (
            <span
              key={star}
              onClick={() => { if (!disabled) onChange(star); }}
              style={{
                cursor: disabled ? 'default' : 'pointer',
                color: active ? '#fbbf24' : 'var(--star-empty)',
                fontSize: '1.4rem',
                lineHeight: 1,
                transition: 'transform 0.1s',
                userSelect: 'none',
              }}
              onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(1.25)'; }}
              onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(1)'; }}
            >
              ★
            </span>
          );
        })}
      </div>
    );
  };

  const renderStarsStatic = (rating: number) => {
    return (
      <div style={{ display: 'flex', gap: '3px' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            style={{
              color: star <= rating ? '#fbbf24' : 'var(--star-empty)',
              fontSize: '1.1rem',
              lineHeight: 1,
            }}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatDriveDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };


  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.3rem' }}>
          My Interviews
        </h1>
        <p className="text-muted text-sm">
          {interviews.length === 0
            ? 'No scheduled interviews assigned to you yet.'
            : `${interviews.length} scheduled interview${interviews.length !== 1 ? 's' : ''} assigned to you`}
          {panelistRoles.length > 0 && (
            <span style={{ marginLeft: '0.75rem' }}>
              {panelistRoles.map((r) => (
                <span key={r} className="badge badge-info" style={{ fontSize: '0.6rem', marginLeft: '0.3rem' }}>{r}</span>
              ))}
            </span>
          )}
        </p>
      </div>

      {/* Filter Bar */}
      <div style={{ 
        padding: '0.65rem 1.25rem', 
        marginBottom: '2.5rem', 
        display: 'flex', 
        gap: '1rem', 
        alignItems: 'center', 
        flexWrap: 'wrap',
        borderRadius: '12px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-glass)',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 650, color: 'var(--text-muted)' }}>
          <SlidersHorizontal size={13} />
          <span>Filters:</span>
        </div>
        
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
          {/* Active Drive Scope */}
          {activeDrive && (
            <button
              onClick={() => setFilterActiveDrive(!filterActiveDrive)}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '50px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                border: filterActiveDrive ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                background: filterActiveDrive ? 'var(--primary-glow)' : 'transparent',
                color: filterActiveDrive ? 'var(--primary)' : 'var(--text-muted)',
                outline: 'none',
              }}
            >
              <span style={{ 
                width: 6, 
                height: 6, 
                borderRadius: '50%', 
                background: filterActiveDrive ? 'var(--primary)' : 'var(--text-muted)',
                display: 'inline-block',
                transition: 'background-color 0.2s'
              }} />
              <span>Active Drive Only ({activeDrive.collegeName})</span>
            </button>
          )}

          {/* Calendar Date Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 550 }}>Date:</span>
            <input
              type="date"
              className="form-input"
              value={filterDate || ''}
              onChange={(e) => setFilterDate(e.target.value || null)}
              style={{
                padding: '0.35rem 2.2rem 0.35rem 0.75rem',
                fontSize: '0.78rem',
                borderRadius: '50px',
                height: '32px',
                width: '145px',
                minHeight: 'auto',
                border: filterDate ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                backgroundColor: filterDate ? 'var(--primary-glow)' : 'transparent',
                color: filterDate ? 'var(--primary)' : 'var(--text-muted)',
                outline: 'none',
                cursor: 'pointer',
              }}
            />
          </div>
        </div>

        {/* Reset Filters Link */}
        {(filterActiveDrive || filterDate) && (
          <button
            onClick={() => { setFilterActiveDrive(false); setFilterDate(null); }}
            style={{
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '0.35rem 0.8rem',
              borderRadius: '50px',
              transition: 'var(--transition-fast)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              outline: 'none'
            }}
          >
            <X size={11} />
            <span>Clear Filters</span>
          </button>
        )}
      </div>      {/* Primary Tab Switcher */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-glass)',
        marginBottom: '2rem',
        gap: '2rem',
        fontSize: '0.95rem',
        fontWeight: 650,
      }}>
        <button
          onClick={() => {
            setActivePrimaryTab('PANELS');
            setActiveRoundTab('ALL');
          }}
          style={{
            padding: '0.75rem 0.25rem',
            border: 'none',
            background: 'none',
            borderBottom: activePrimaryTab === 'PANELS' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
            color: activePrimaryTab === 'PANELS' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'var(--transition-fast)',
            outline: 'none',
          }}
        >
          <Calendar size={16} />
          <span>Availability Requests (Panels)</span>
          <span style={{
            fontSize: '0.75rem',
            background: activePrimaryTab === 'PANELS' ? 'var(--primary)' : 'var(--border-glass)',
            color: activePrimaryTab === 'PANELS' ? '#ffffff' : 'var(--text-muted)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontWeight: 700
          }}>
            {tabCounts.requests.total}
          </span>
        </button>

        <button
          onClick={() => {
            setActivePrimaryTab('FEEDBACK');
            setActiveRoundTab('ALL');
          }}
          style={{
            padding: '0.75rem 0.25rem',
            border: 'none',
            background: 'none',
            borderBottom: activePrimaryTab === 'FEEDBACK' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
            color: activePrimaryTab === 'FEEDBACK' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'var(--transition-fast)',
            outline: 'none',
          }}
        >
          <CalendarCheck size={16} />
          <span>Interviews &amp; Feedback</span>
          <span style={{
            fontSize: '0.75rem',
            background: activePrimaryTab === 'FEEDBACK' ? 'var(--primary)' : 'var(--border-glass)',
            color: activePrimaryTab === 'FEEDBACK' ? '#ffffff' : 'var(--text-muted)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontWeight: 700
          }}>
            {tabCounts.feedback.total}
          </span>
        </button>
      </div>

      {activePrimaryTab === 'PANELS' && (
        <div>
          {/* Round Tab Switcher */}
          <div style={{
            display: 'flex',
            gap: '0.35rem',
            marginBottom: '2rem',
            padding: '0.25rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-glass)',
            borderRadius: '8px',
            width: 'fit-content'
          }}>
            <button
              onClick={() => setActiveRoundTab('ALL')}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '6px',
                border: 'none',
                background: activeRoundTab === 'ALL' ? 'var(--primary-glow)' : 'transparent',
                color: activeRoundTab === 'ALL' ? 'var(--primary)' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>All Panels</span>
              <span style={{
                fontSize: '0.72rem',
                background: activeRoundTab === 'ALL' ? 'var(--primary)' : 'var(--border-glass)',
                color: activeRoundTab === 'ALL' ? '#ffffff' : 'var(--text-muted)',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 700
              }}>
                {tabCounts.requests.total}
              </span>
            </button>
            
            <button
              onClick={() => setActiveRoundTab('L1')}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '6px',
                border: 'none',
                background: activeRoundTab === 'L1' ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                color: activeRoundTab === 'L1' ? '#0ea5e9' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>L1 Round</span>
              <span style={{
                fontSize: '0.72rem',
                background: activeRoundTab === 'L1' ? '#0ea5e9' : 'var(--border-glass)',
                color: activeRoundTab === 'L1' ? '#ffffff' : 'var(--text-muted)',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 700
              }}>
                {tabCounts.requests.l1}
              </span>
            </button>
            
            <button
              onClick={() => setActiveRoundTab('L2')}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '6px',
                border: 'none',
                background: activeRoundTab === 'L2' ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                color: activeRoundTab === 'L2' ? '#7c3aed' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>L2 Round</span>
              <span style={{
                fontSize: '0.72rem',
                background: activeRoundTab === 'L2' ? '#7c3aed' : 'var(--border-glass)',
                color: activeRoundTab === 'L2' ? '#ffffff' : 'var(--text-muted)',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 700
              }}>
                {tabCounts.requests.l2}
              </span>
            </button>
          </div>

          {/* Pending Action / Slot Requests Section */}
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} className="text-primary" />
              Pending Action / Slot Requests
              {pendingRequests.length > 0 && (
                <span className="badge badge-pending" style={{ fontSize: '0.65rem', marginLeft: '8px' }}>
                  {filteredSortedRequests.length !== pendingRequests.length 
                    ? `${filteredSortedRequests.length} of ${pendingRequests.length} filtered` 
                    : `${pendingRequests.length} action required`}
                </span>
              )}
            </h2>

            {filteredSortedRequests.length === 0 ? (
              <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', border: '1px dashed var(--border-glass)' }}>
                <span className="text-muted text-sm">
                  {pendingRequests.length === 0 
                    ? 'No pending slot requests at the moment.' 
                    : 'No pending slot requests match the active filters.'}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {filteredSortedRequests.map((req) => {
                  const dateRange = `${new Date(req.interview.startDate).toLocaleDateString('en-US')} - ${new Date(req.interview.endDate).toLocaleDateString('en-US')}`;
                  const isL1Role = req.interview.role.toLowerCase().includes('l1');
                  const isL2Role = req.interview.role.toLowerCase().includes('l2');
                  const borderCol = isL1Role ? '#0ea5e9' : (isL2Role ? '#7c3aed' : 'var(--primary)');
                  const badgeStyle = getRoleBadgeStyle(req.interview.role);

                  const collegeName = getCollegeNameFromRole(req.interview.role);
                  const isReqFromActiveDrive = isFromActiveDrive(req.interview.role);

                  return (
                    <div
                      key={req.panel.id}
                      className="glass-card"
                      style={{
                        padding: '1.25rem 1.5rem',
                        borderTop: '1px solid var(--border-glass)',
                        borderRight: '1px solid var(--border-glass)',
                        borderBottom: '1px solid var(--border-glass)',
                        borderLeft: `4px solid ${borderCol}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ 
                            fontSize: '0.65rem', 
                            background: badgeStyle.background, 
                            border: badgeStyle.border, 
                            borderRadius: '4px', 
                            padding: '0.15rem 0.45rem', 
                            color: badgeStyle.color,
                            fontWeight: 700 
                          }}>
                            {badgeStyle.label}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{req.interview.role}</span>
                          <span className="badge badge-pending" style={{ fontSize: '0.6rem' }}>
                            Availability Requested
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {collegeName && (
                            <div className="text-muted text-xs">
                              College: <strong>{collegeName}</strong>
                            </div>
                          )}
                          
                          {isReqFromActiveDrive && activeDrive && (
                            <div style={{
                              fontSize: '0.75rem',
                              color: '#0ea5e9',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              margin: '2px 0 4px 0'
                            }}>
                              <span style={{
                                display: 'inline-block',
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: '#0ea5e9'
                              }}></span>
                              Active Drive: {activeDrive.collegeName} ({formatDriveDate(activeDrive.startDate)} - {formatDriveDate(activeDrive.endDate)})
                            </div>
                          )}

                          <div className="text-muted text-xs">
                            Proposed Date Range: <strong>{dateRange}</strong>
                          </div>
                          
                          <div className="text-muted text-xs">
                            Duration: <strong>{req.interview.duration} minutes</strong>
                          </div>
                        </div>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setSelectedRequest(req)}
                      >
                        Provide Availability / Select Slot
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activePrimaryTab === 'FEEDBACK' && (
        <div>
          {/* Round Tab Switcher */}
          <div style={{
            display: 'flex',
            gap: '0.35rem',
            marginBottom: '2rem',
            padding: '0.25rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-glass)',
            borderRadius: '8px',
            width: 'fit-content'
          }}>
            <button
              onClick={() => setActiveRoundTab('ALL')}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '6px',
                border: 'none',
                background: activeRoundTab === 'ALL' ? 'var(--primary-glow)' : 'transparent',
                color: activeRoundTab === 'ALL' ? 'var(--primary)' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>All Rounds</span>
              <span style={{
                fontSize: '0.72rem',
                background: activeRoundTab === 'ALL' ? 'var(--primary)' : 'var(--border-glass)',
                color: activeRoundTab === 'ALL' ? '#ffffff' : 'var(--text-muted)',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 700
              }}>
                {tabCounts.feedback.total}
              </span>
            </button>
            
            <button
              onClick={() => setActiveRoundTab('L1')}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '6px',
                border: 'none',
                background: activeRoundTab === 'L1' ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                color: activeRoundTab === 'L1' ? '#0ea5e9' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>L1 Round</span>
              <span style={{
                fontSize: '0.72rem',
                background: activeRoundTab === 'L1' ? '#0ea5e9' : 'var(--border-glass)',
                color: activeRoundTab === 'L1' ? '#ffffff' : 'var(--text-muted)',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 700
              }}>
                {tabCounts.feedback.l1}
              </span>
            </button>
            
            <button
              onClick={() => setActiveRoundTab('L2')}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '6px',
                border: 'none',
                background: activeRoundTab === 'L2' ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                color: activeRoundTab === 'L2' ? '#7c3aed' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span>L2 Round</span>
              <span style={{
                fontSize: '0.72rem',
                background: activeRoundTab === 'L2' ? '#7c3aed' : 'var(--border-glass)',
                color: activeRoundTab === 'L2' ? '#ffffff' : 'var(--text-muted)',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 700
              }}>
                {tabCounts.feedback.l2}
              </span>
            </button>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem' }}>
              Scheduled Assignments
              {filteredSortedInterviews.length !== interviews.length && (
                <span className="text-muted text-xs" style={{ marginLeft: '8px', fontWeight: 400 }}>
                  ({filteredSortedInterviews.length} of {interviews.length} shown)
                </span>
              )}
            </h2>
          </div>

          {filteredSortedInterviews.length === 0 ? (
            <div className="glass-card text-center" style={{ padding: '4rem 2rem' }}>
              <CalendarCheck size={44} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
              <p style={{ fontWeight: 600, marginBottom: '0.4rem' }}>
                {interviews.length === 0 ? 'No Interviews Yet' : 'No Matching Interviews'}
              </p>
              <p className="text-muted text-sm">
                {interviews.length === 0 
                  ? 'Once a recruiter schedules an interview and assigns you as a panelist, it will appear here.'
                  : 'Try adjusting your filters above to see other scheduled assignments.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {filteredSortedInterviews.map((interview) => {
                const outcomeStatus = interview.outcomeStatus || 'PENDING';
                const statusColor = STATUS_COLOR[outcomeStatus] || '#94a3b8';
                const initials = interview.candidateName
                  .split(' ').map((w) => w[0] || '').slice(0, 2).join('').toUpperCase();
                const feedbackAlreadySubmitted = !!interview.panelFeedback || !!interview.panelDecision;
                const isL1Role = interview.role.toLowerCase().includes('l1');
                const isL2Role = interview.role.toLowerCase().includes('l2');
                const accentColor = isL1Role ? '#0ea5e9' : (isL2Role ? '#7c3aed' : 'var(--primary)');
                const isSubmitting = submittingFeedback[interview.panelId];

                return (
                  <div
                    key={interview.panelId}
                    className="glass-card"
                    style={{
                      padding: '1.25rem 1.5rem',
                      borderTop: '1px solid var(--border-glass)',
                      borderRight: '1px solid var(--border-glass)',
                      borderBottom: '1px solid var(--border-glass)',
                      borderLeft: `3px solid ${accentColor}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem'
                    }}
                  >
                    {/* Top row: candidate info + status */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: '50%',
                          background: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
                          border: `1px solid color-mix(in srgb, ${accentColor} 20%, transparent)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.8rem', fontWeight: 700, color: accentColor, flexShrink: 0,
                        }}>
                          {initials || <User size={16} />}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem', fontFamily: 'var(--font-heading)' }}>{interview.candidateName}</span>
                            <span style={{ 
                              fontSize: '0.68rem', 
                              background: getRoleBadgeStyle(interview.role).background, 
                              border: getRoleBadgeStyle(interview.role).border, 
                              borderRadius: '4px', 
                              padding: '0.08rem 0.35rem', 
                              color: getRoleBadgeStyle(interview.role).color,
                              fontWeight: 600
                            }}>
                              {interview.role}
                            </span>
                          </div>
                          <div className="text-muted text-xs" style={{ marginTop: '0.1rem' }}>{interview.candidateEmail}</div>
                        </div>
                      </div>

                      {/* Minimal status indicator */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: statusColor }}></span>
                        <span>{STATUS_LABEL[outcomeStatus] || outcomeStatus}</span>
                      </div>
                    </div>

                    {/* Scheduled time + Teams link */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      padding: '0.5rem 0',
                      borderBottom: '1px solid var(--border-glass)',
                      borderTop: '1px solid var(--border-glass)',
                      marginTop: '0.25rem',
                      marginBottom: '0.25rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontWeight: 550, color: 'var(--text-main)' }}>{formatDateTime(interview.scheduledSlotStart)}</span>
                        <span>•</span>
                        <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                        <span>{interview.duration} min</span>
                      </div>
                      {interview.teamsMeetingUrl && (
                        <a
                          href={interview.teamsMeetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: 'var(--primary)',
                            textDecoration: 'none',
                            transition: 'color 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--primary)'}
                        >
                          <Video size={13} />
                          <span>Join Teams Call</span>
                        </a>
                      )}
                    </div>

                    {/* Feedback section */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'flex-start', margin: '0.25rem 0' }}>
                        <button
                          onClick={() => toggleFeedbackExpansion(
                            interview.panelId,
                            interview.role.toLowerCase().includes('l2'),
                            interview.candidateEmail
                          )}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: '0.25rem 0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            transition: 'color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--primary)'}
                        >
                          <MessageSquare size={13} />
                          <span>{feedbackAlreadySubmitted ? 'View Submitted Feedback' : 'Submit Candidate Feedback'}</span>
                          <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                            {expandedFeedbacks[interview.panelId] ? '▲' : '▼'}
                          </span>
                        </button>
                      </div>

                      {expandedFeedbacks[interview.panelId] && (
                        <div style={{
                          paddingLeft: '1rem',
                          borderLeft: '2px solid var(--border-glass)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem',
                          marginTop: '0.75rem',
                          paddingTop: '0.25rem',
                          paddingBottom: '0.25rem'
                        }}>
                          
                          {/* L1 Feedback for L2 Panelists */}
                          {interview.role.toLowerCase().includes('l2') && (
                            <div style={{
                              marginBottom: '1rem',
                              paddingBottom: '1rem',
                              borderBottom: '1px dashed var(--border-glass)',
                            }}>
                              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-main)' }}>
                                <MessageSquare size={13} className="text-primary" />
                                L1 Round Feedback Reference
                              </h4>

                              {loadingL1Feedbacks[interview.panelId] ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  <Loader2 size={13} className="animate-spin text-primary" />
                                  <span>Loading L1 feedback...</span>
                                </div>
                              ) : !l1FeedbacksForCandidate[interview.panelId] || l1FeedbacksForCandidate[interview.panelId].length === 0 ? (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  No submitted L1 feedback found for this candidate.
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                  {l1FeedbacksForCandidate[interview.panelId].map((l1, idx) => {
                                    const parsedL1 = parseFeedbackSafely(l1.feedback);
                                    const isPassedL1 = l1.decision === 'PASSED';
                                    const badgeColor = isPassedL1 ? 'var(--success)' : 'var(--danger)';
                                    const badgeBg = isPassedL1 ? 'var(--success-glow)' : 'var(--danger-glow)';
                                    const badgeBorder = isPassedL1 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';

                                    return (
                                      <div key={l1.panelId || idx} style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.35rem'
                                      }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            Evaluator: <strong style={{ color: 'var(--text-main)' }}>{l1.panelistName}</strong>
                                          </div>
                                          <span className="badge" style={{
                                            fontSize: '0.58rem',
                                            background: badgeBg,
                                            border: `1px solid ${badgeBorder}`,
                                            color: badgeColor,
                                            padding: '0.08rem 0.35rem'
                                          }}>
                                            {l1.decision}
                                          </span>
                                        </div>

                                        {parsedL1 && parsedL1.scores && (
                                          <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.2rem',
                                            margin: '0.15rem 0',
                                          }}>
                                            {Object.entries(parsedL1.scores).map(([metric, score]) => {
                                              const displayNames: Record<string, string> = {
                                                coding: 'Coding',
                                                communication: 'Communication',
                                                fundamentals: 'Fundamentals'
                                              };
                                              return (
                                                <div key={metric} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                                    {displayNames[metric] || metric}:
                                                  </span>
                                                  {renderStarsStatic(score as number)}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}

                                        <div style={{ fontSize: '0.75rem' }}>
                                          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '1px' }}>
                                            Comments
                                          </span>
                                          <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.75rem', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                                            {parsedL1 ? parsedL1.comments : (l1.feedback || 'No comments.')}
                                          </p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                          {feedbackAlreadySubmitted && !isEditing[interview.panelId] ? (
                        (() => {
                          let parsed: any = null;
                          let isJson = false;
                          try {
                            if (interview.panelFeedback && interview.panelFeedback.startsWith('{')) {
                              parsed = JSON.parse(interview.panelFeedback);
                              isJson = true;
                            }
                          } catch (e) {}

                          let editTimeRemaining = '';
                          let canEdit = false;
                          let isL1PassLocked = false;

                          if (interview.panelSubmittedAt) {
                            const submittedDate = new Date(interview.panelSubmittedAt);
                            const elapsedMs = Date.now() - submittedDate.getTime();
                            const twoHoursMs = 2 * 60 * 60 * 1000;
                            const remainingMs = twoHoursMs - elapsedMs;

                            if (remainingMs > 0) {
                              canEdit = true;
                              const remainingMins = Math.ceil(remainingMs / (60 * 1000));
                              editTimeRemaining = `${remainingMins} min remaining`;
                            }
                          }

                          // L1 Pass locking check
                          if (interview.role.toLowerCase().includes('l1') && interview.panelDecision === 'PASSED') {
                            canEdit = false;
                            isL1PassLocked = true;
                          }

                          const renderFeedbackHeader = () => (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <CheckCircle size={13} style={{ color: interview.panelDecision === 'PASSED' ? 'var(--success)' : 'var(--danger)' }} />
                                <span style={{ fontSize: '0.8rem', color: interview.panelDecision === 'PASSED' ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                                  {(isJson && parsed?.type) ? parsed.type : 'Interview'} Feedback — {interview.panelDecision === 'PASSED' ? 'Passed' : 'Rejected'}
                                </span>
                              </div>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {isL1PassLocked && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    L1 Pass Final (Locked)
                                  </span>
                                )}
                                {!isL1PassLocked && canEdit && (
                                  <>
                                    <span style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 600 }}>
                                      ⏱️ {editTimeRemaining}
                                    </span>
                                    <button
                                      onClick={() => startEditing(interview)}
                                      className="btn btn-secondary btn-xs"
                                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                    >
                                      Edit Feedback
                                    </button>
                                  </>
                                )}
                                {!isL1PassLocked && !canEdit && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    Editing Window Expired
                                  </span>
                                )}
                              </div>
                            </div>
                          );

                          if (isJson && parsed) {
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                {renderFeedbackHeader()}

                                {/* Scores & individual notes */}
                                {parsed.type === 'L1' && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem' }}>
                                    <div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600 }}>Coding &amp; Problem Solving:</span>
                                        {renderStarsStatic(parsed.scores?.coding || 0)}
                                      </div>
                                      {parsed.notes?.codingNotes && <p style={{ color: 'var(--text-muted)', margin: '2px 0 0 0', fontSize: '0.72rem', lineHeight: 1.35 }}>{parsed.notes.codingNotes}</p>}
                                    </div>
                                    <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.25rem' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600 }}>Technical Communication:</span>
                                        {renderStarsStatic(parsed.scores?.communication || 0)}
                                      </div>
                                      {parsed.notes?.communicationNotes && <p style={{ color: 'var(--text-muted)', margin: '2px 0 0 0', fontSize: '0.72rem', lineHeight: 1.35 }}>{parsed.notes.communicationNotes}</p>}
                                    </div>
                                    <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.25rem' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600 }}>CS Fundamentals:</span>
                                        {renderStarsStatic(parsed.scores?.fundamentals || 0)}
                                      </div>
                                      {parsed.notes?.fundamentalsNotes && <p style={{ color: 'var(--text-muted)', margin: '2px 0 0 0', fontSize: '0.72rem', lineHeight: 1.35 }}>{parsed.notes.fundamentalsNotes}</p>}
                                    </div>
                                  </div>
                                )}

                                {parsed.type === 'L2' && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem' }}>
                                    <div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600 }}>System Design &amp; Scalability:</span>
                                        {renderStarsStatic(parsed.scores?.systemDesign || 0)}
                                      </div>
                                      {parsed.notes?.systemDesignNotes && <p style={{ color: 'var(--text-muted)', margin: '2px 0 0 0', fontSize: '0.72rem', lineHeight: 1.35 }}>{parsed.notes.systemDesignNotes}</p>}
                                    </div>
                                    <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.25rem' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600 }}>Technical Depth &amp; Experience:</span>
                                        {renderStarsStatic(parsed.scores?.technicalDepth || 0)}
                                      </div>
                                      {parsed.notes?.technicalDepthNotes && <p style={{ color: 'var(--text-muted)', margin: '2px 0 0 0', fontSize: '0.72rem', lineHeight: 1.35 }}>{parsed.notes.technicalDepthNotes}</p>}
                                    </div>
                                    <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.25rem' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600 }}>Leadership &amp; Ownership:</span>
                                        {renderStarsStatic(parsed.scores?.leadership || 0)}
                                      </div>
                                      {parsed.notes?.leadershipNotes && <p style={{ color: 'var(--text-muted)', margin: '2px 0 0 0', fontSize: '0.72rem', lineHeight: 1.35 }}>{parsed.notes.leadershipNotes}</p>}
                                    </div>
                                    <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.25rem' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600 }}>Cultural Fit &amp; MS Values:</span>
                                        {renderStarsStatic(parsed.scores?.culturalFit || 0)}
                                      </div>
                                      {parsed.notes?.culturalFitNotes && <p style={{ color: 'var(--text-muted)', margin: '2px 0 0 0', fontSize: '0.72rem', lineHeight: 1.35 }}>{parsed.notes.culturalFitNotes}</p>}
                                    </div>
                                  </div>
                                )}

                                {parsed.type === 'General' && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.75rem' }}>
                                    <div>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600 }}>Technical Depth:</span>
                                        {renderStarsStatic(parsed.scores?.technical || 0)}
                                      </div>
                                      {parsed.notes?.technicalNotes && <p style={{ color: 'var(--text-muted)', margin: '2px 0 0 0', fontSize: '0.72rem', lineHeight: 1.35 }}>{parsed.notes.technicalNotes}</p>}
                                    </div>
                                    <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.25rem' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600 }}>Communication:</span>
                                        {renderStarsStatic(parsed.scores?.communication || 0)}
                                      </div>
                                      {parsed.notes?.communicationNotes && <p style={{ color: 'var(--text-muted)', margin: '2px 0 0 0', fontSize: '0.72rem', lineHeight: 1.35 }}>{parsed.notes.communicationNotes}</p>}
                                    </div>
                                    <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.25rem' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600 }}>Collaboration &amp; Teamwork:</span>
                                        {renderStarsStatic(parsed.scores?.collaboration || 0)}
                                      </div>
                                      {parsed.notes?.collaborationNotes && <p style={{ color: 'var(--text-muted)', margin: '2px 0 0 0', fontSize: '0.72rem', lineHeight: 1.35 }}>{parsed.notes.collaborationNotes}</p>}
                                    </div>
                                  </div>
                                )}

                                {/* Overall summary notes */}
                                {parsed.comments && (
                                  <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Overall Summary Notes</div>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>{parsed.comments}</p>
                                  </div>
                                )}
                              </div>
                            );
                          }

                          // Fallback to legacy string feedback
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                              {renderFeedbackHeader()}
                              {interview.panelFeedback && (
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                                  {interview.panelFeedback}
                                </p>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        (() => {
                          const roleLower = interview.role.toLowerCase();
                          const isL1Role = roleLower.includes('l1');
                          const isL2Role = roleLower.includes('l2');

                          if (isL1Role) {
                            const current = l1Ratings[interview.panelId] || {
                              coding: 0,
                              communication: 0,
                              fundamentals: 0,
                              codingNotes: '',
                              commNotes: '',
                              fundNotes: '',
                              comments: '',
                            };

                            const updateL1 = (field: keyof typeof current, val: any) => {
                              setL1Ratings((prev) => ({
                                ...prev,
                                [interview.panelId]: { ...(prev[interview.panelId] || current), [field]: val },
                              }));
                            };

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '0.25rem' }}>
                                  Evaluating L1 Screening Round Metrics:
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                  <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Coding &amp; Problem Solving *</span>
                                      {renderStarRating(current.coding, (r) => updateL1('coding', r), isSubmitting)}
                                    </div>
                                    <textarea
                                      className="form-input"
                                      rows={2}
                                      placeholder="Specific coding questions, algorithmic depth, edge cases..."
                                      style={{ fontSize: '0.78rem', resize: 'vertical' }}
                                      value={current.codingNotes}
                                      onChange={(e) => updateL1('codingNotes', e.target.value)}
                                      disabled={isSubmitting}
                                    />
                                  </div>

                                  <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Technical Communication *</span>
                                      {renderStarRating(current.communication, (r) => updateL1('communication', r), isSubmitting)}
                                    </div>
                                    <textarea
                                      className="form-input"
                                      rows={2}
                                      placeholder="Explanation clarity, technical dialogue, structure..."
                                      style={{ fontSize: '0.78rem', resize: 'vertical' }}
                                      value={current.commNotes}
                                      onChange={(e) => updateL1('commNotes', e.target.value)}
                                      disabled={isSubmitting}
                                    />
                                  </div>

                                  <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>CS Fundamentals *</span>
                                      {renderStarRating(current.fundamentals, (r) => updateL1('fundamentals', r), isSubmitting)}
                                    </div>
                                    <textarea
                                      className="form-input"
                                      rows={2}
                                      placeholder="Basic DSA, runtime complexity, OS/memory/networks..."
                                      style={{ fontSize: '0.78rem', resize: 'vertical' }}
                                      value={current.fundNotes}
                                      onChange={(e) => updateL1('fundNotes', e.target.value)}
                                      disabled={isSubmitting}
                                    />
                                  </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Overall Comments / Summary Recommendation</label>
                                  <textarea
                                    className="form-input"
                                    rows={2}
                                    placeholder="Summary comments of L1 performance..."
                                    style={{ fontSize: '0.8rem', resize: 'vertical' }}
                                    value={current.comments}
                                    onChange={(e) => updateL1('comments', e.target.value)}
                                    disabled={isSubmitting}
                                  />
                                </div>

                                {feedbackError[interview.panelId] && (
                                  <p style={{ color: '#ef4444', fontSize: '0.78rem' }}>
                                    {feedbackError[interview.panelId]}
                                  </p>
                                )}

                                {/* Warning banner for L1 PASSED locking */}
                                <div style={{ marginTop: '0.5rem', marginBottom: '0.75rem', padding: '0.75rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-sm)', color: '#fbbf24', fontSize: '0.75rem', lineHeight: 1.4 }}>
                                  <strong>⚠️ L1 Decision Warning:</strong> Submitting a <strong>Pass L1</strong> decision is final. The candidate will immediately progress to the L2 queue, and you will not be able to edit or revert this feedback.
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                  <button
                                    onClick={() => handleFeedbackSubmit(interview, 'PASSED')}
                                    disabled={isSubmitting}
                                    className="btn btn-sm"
                                    style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--success)' }}
                                  >
                                    {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                    Submit &amp; Pass L1
                                  </button>
                                  <button
                                    onClick={() => handleFeedbackSubmit(interview, 'REJECTED')}
                                    disabled={isSubmitting}
                                    className="btn btn-sm"
                                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}
                                  >
                                    {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                                    Submit &amp; Reject
                                  </button>
                                  {isEditing[interview.panelId] && (
                                    <button
                                      type="button"
                                      onClick={() => setIsEditing((prev) => ({ ...prev, [interview.panelId]: false }))}
                                      className="btn btn-secondary btn-sm"
                                    >
                                      Cancel Edit
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          if (isL2Role) {
                            const current = l2Ratings[interview.panelId] || {
                              design: 0,
                              depth: 0,
                              leadership: 0,
                              fit: 0,
                              designNotes: '',
                              depthNotes: '',
                              leadNotes: '',
                              fitNotes: '',
                              comments: '',
                            };

                            const updateL2 = (field: keyof typeof current, val: any) => {
                              setL2Ratings((prev) => ({
                                ...prev,
                                [interview.panelId]: { ...(prev[interview.panelId] || current), [field]: val },
                              }));
                            };

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '0.25rem' }}>
                                  Evaluating L2 System Design &amp; Fit Metrics:
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                  <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>System Design &amp; Scalability *</span>
                                      {renderStarRating(current.design, (r) => updateL2('design', r), isSubmitting)}
                                    </div>
                                    <textarea
                                      className="form-input"
                                      rows={2}
                                      placeholder="Architecture, API design, trade-offs, database choices..."
                                      style={{ fontSize: '0.78rem', resize: 'vertical' }}
                                      value={current.designNotes}
                                      onChange={(update) => updateL2('designNotes', update.target.value)}
                                      disabled={isSubmitting}
                                    />
                                  </div>

                                  <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Technical Depth &amp; Experience *</span>
                                      {renderStarRating(current.depth, (r) => updateL2('depth', r), isSubmitting)}
                                    </div>
                                    <textarea
                                      className="form-input"
                                      rows={2}
                                      placeholder="Past project complexity, deep tech troubleshooting, domain knowledge..."
                                      style={{ fontSize: '0.78rem', resize: 'vertical' }}
                                      value={current.depthNotes}
                                      onChange={(update) => updateL2('depthNotes', update.target.value)}
                                      disabled={isSubmitting}
                                    />
                                  </div>

                                  <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Leadership &amp; Ownership *</span>
                                      {renderStarRating(current.leadership, (r) => updateL2('leadership', r), isSubmitting)}
                                    </div>
                                    <textarea
                                      className="form-input"
                                      rows={2}
                                      placeholder="Ownership mindset, problem driving, initiative, peer support..."
                                      style={{ fontSize: '0.78rem', resize: 'vertical' }}
                                      value={current.leadNotes}
                                      onChange={(update) => updateL2('leadNotes', update.target.value)}
                                      disabled={isSubmitting}
                                    />
                                  </div>

                                  <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Cultural Fit &amp; MS Values *</span>
                                      {renderStarRating(current.fit, (r) => updateL2('fit', r), isSubmitting)}
                                    </div>
                                    <textarea
                                      className="form-input"
                                      rows={2}
                                      placeholder="Growth mindset, customer obsession, inclusion, alignment..."
                                      style={{ fontSize: '0.78rem', resize: 'vertical' }}
                                      value={current.fitNotes}
                                      onChange={(update) => updateL2('fitNotes', update.target.value)}
                                      disabled={isSubmitting}
                                    />
                                  </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                  <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Overall Comments / Summary Recommendation</label>
                                  <textarea
                                    className="form-input"
                                    rows={2}
                                    placeholder="Summary comments of L2 performance..."
                                    style={{ fontSize: '0.8rem', resize: 'vertical' }}
                                    value={current.comments}
                                    onChange={(update) => updateL2('comments', update.target.value)}
                                    disabled={isSubmitting}
                                  />
                                </div>

                                {feedbackError[interview.panelId] && (
                                  <p style={{ color: '#ef4444', fontSize: '0.78rem' }}>
                                    {feedbackError[interview.panelId]}
                                  </p>
                                )}

                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                  <button
                                    onClick={() => handleFeedbackSubmit(interview, 'PASSED')}
                                    disabled={isSubmitting}
                                    className="btn btn-sm"
                                    style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#c084fc' }}
                                  >
                                    {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                    Submit &amp; Pass L2
                                  </button>
                                  <button
                                    onClick={() => handleFeedbackSubmit(interview, 'REJECTED')}
                                    disabled={isSubmitting}
                                    className="btn btn-sm"
                                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}
                                  >
                                    {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                                    Submit &amp; Reject
                                  </button>
                                  {isEditing[interview.panelId] && (
                                    <button
                                      type="button"
                                      onClick={() => setIsEditing((prev) => ({ ...prev, [interview.panelId]: false }))}
                                      className="btn btn-secondary btn-sm"
                                    >
                                      Cancel Edit
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          // General round layout
                          const current = genRatings[interview.panelId] || {
                            technical: 0,
                            communication: 0,
                            collaboration: 0,
                            techNotes: '',
                            commNotes: '',
                            collabNotes: '',
                            comments: '',
                          };

                          const updateGen = (field: keyof typeof current, val: any) => {
                            setGenRatings((prev) => ({
                              ...prev,
                              [interview.panelId]: { ...(prev[interview.panelId] || current), [field]: val },
                            }));
                          };

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '0.25rem' }}>
                                Evaluating General Interview Metrics:
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Technical Depth *</span>
                                    {renderStarRating(current.technical, (r) => updateGen('technical', r), isSubmitting)}
                                  </div>
                                  <textarea
                                    className="form-input"
                                    rows={2}
                                    placeholder="Technical skill assessment, technical expertise, coding depth..."
                                    style={{ fontSize: '0.78rem', resize: 'vertical' }}
                                    value={current.techNotes}
                                    onChange={(update) => updateGen('techNotes', update.target.value)}
                                    disabled={isSubmitting}
                                  />
                                </div>

                                <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Communication *</span>
                                    {renderStarRating(current.communication, (r) => updateGen('communication', r), isSubmitting)}
                                  </div>
                                  <textarea
                                    className="form-input"
                                    rows={2}
                                    placeholder="Communication skills, explanations structure, discussion..."
                                    style={{ fontSize: '0.78rem', resize: 'vertical' }}
                                    value={current.commNotes}
                                    onChange={(update) => updateGen('commNotes', update.target.value)}
                                    disabled={isSubmitting}
                                  />
                                </div>

                                <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Collaboration &amp; Teamwork *</span>
                                    {renderStarRating(current.collaboration, (r) => updateGen('collaboration', r), isSubmitting)}
                                  </div>
                                  <textarea
                                    className="form-input"
                                    rows={2}
                                    placeholder="Collaborative problem solving, feedback receipt, ownership..."
                                    style={{ fontSize: '0.78rem', resize: 'vertical' }}
                                    value={current.collabNotes}
                                    onChange={(update) => updateGen('collabNotes', update.target.value)}
                                    disabled={isSubmitting}
                                  />
                                </div>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Overall Comments / Summary Recommendation</label>
                                <textarea
                                  className="form-input"
                                  rows={2}
                                  placeholder="Summary comments of performance..."
                                  style={{ fontSize: '0.8rem', resize: 'vertical' }}
                                  value={current.comments}
                                  onChange={(update) => updateGen('comments', update.target.value)}
                                  disabled={isSubmitting}
                                />
                              </div>

                              {feedbackError[interview.panelId] && (
                                <p style={{ color: '#ef4444', fontSize: '0.78rem' }}>
                                  {feedbackError[interview.panelId]}
                                </p>
                              )}

                              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                <button
                                  onClick={() => handleFeedbackSubmit(interview, 'PASSED')}
                                  disabled={isSubmitting}
                                  className="btn btn-sm"
                                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--success)' }}
                                >
                                  {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                  Submit &amp; Pass
                                </button>
                                <button
                                  onClick={() => handleFeedbackSubmit(interview, 'REJECTED')}
                                  disabled={isSubmitting}
                                  className="btn btn-sm"
                                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}
                                >
                                  {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                                  Submit &amp; Reject
                                </button>
                                {isEditing[interview.panelId] && (
                                  <button
                                    type="button"
                                    onClick={() => setIsEditing((prev) => ({ ...prev, [interview.panelId]: false }))}
                                    className="btn btn-secondary btn-sm"
                                  >
                                    Cancel Edit
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })()
                      )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <AlertDialog
        open={!!pendingL1PassConfirm}
        onOpenChange={(open: boolean) => { if (!open) setPendingL1PassConfirm(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm final L1 decision</AlertDialogTitle>
            <AlertDialogDescription>
              Once you submit a &quot;Passed&quot; decision for L1, it is final and cannot be edited or changed, even within the 2-hour window. Are you sure you want to pass this candidate?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingL1PassConfirm) {
                  performFeedbackSubmit(pendingL1PassConfirm, 'PASSED');
                }
                setPendingL1PassConfirm(null);
              }}
            >
              Yes, Pass L1
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedRequest && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '680px',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative',
            padding: '2rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          }}>
            <button
              onClick={() => {
                setSelectedRequest(null);
                refreshInterviews();
              }}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '1.5rem',
                lineHeight: 1,
              }}
            >
              &times;
            </button>
            <AvailabilityClient
              interview={selectedRequest.interview}
              panel={selectedRequest.panel}
            />
          </div>
        </div>
      )}
    </div>
  );
}

