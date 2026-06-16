'use client';

import React, { useState } from 'react';
import { PanelistInterview } from '@/lib/db';
import {
  Video,
  CheckCircle,
  XCircle,
  Clock,
  User,
  MessageSquare,
  Loader2,
  CalendarCheck,
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
  panelistRoles: string[];
  panelistName: string;
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

export default function PanelistClient({ initialInterviews, panelistRoles, panelistName }: PanelistClientProps) {
  const [interviews, setInterviews] = useState<PanelistInterview[]>(initialInterviews);
  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, string>>({});
  const [submittingFeedback, setSubmittingFeedback] = useState<Record<string, boolean>>({});
  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});
  const [feedbackError, setFeedbackError] = useState<Record<string, string | null>>({});
  const [isEditing, setIsEditing] = useState<Record<string, boolean>>({});
  const [pendingL1PassConfirm, setPendingL1PassConfirm] = useState<PanelistInterview | null>(null);

  // Structured score states keyed by panelId
  const [l1Ratings, setL1Ratings] = useState<Record<string, { coding: number; communication: number; fundamentals: number; codingNotes: string; commNotes: string; fundNotes: string; comments: string }>>({});
  const [l2Ratings, setL2Ratings] = useState<Record<string, { design: number; depth: number; leadership: number; fit: number; designNotes: string; depthNotes: string; leadNotes: string; fitNotes: string; comments: string }>>({});
  const [genRatings, setGenRatings] = useState<Record<string, { technical: number; communication: number; collaboration: number; techNotes: string; commNotes: string; collabNotes: string; comments: string }>>({});

  const isL1 = panelistRoles.includes('L1');
  const isL2 = panelistRoles.includes('L2');

  const refreshInterviews = async () => {
    try {
      const res = await fetch('/api/panelist/interviews');
      if (res.ok) setInterviews(await res.json());
    } catch (err) {
      console.error('Failed to refresh interviews', err);
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
                color: active ? '#fbbf24' : 'rgba(255, 255, 255, 0.15)',
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
              color: star <= rating ? '#fbbf24' : 'rgba(255, 255, 255, 0.12)',
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

      {interviews.length === 0 ? (
        <div className="glass-card text-center" style={{ padding: '4rem 2rem' }}>
          <CalendarCheck size={44} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
          <p style={{ fontWeight: 600, marginBottom: '0.4rem' }}>No Interviews Yet</p>
          <p className="text-muted text-sm">Once a recruiter schedules an interview and assigns you as a panelist, it will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {interviews.map((interview) => {
            const outcomeStatus = interview.outcomeStatus || 'PENDING';
            const statusColor = STATUS_COLOR[outcomeStatus] || '#94a3b8';
            const badgeClass = STATUS_BADGE[outcomeStatus] || 'badge-pending';
            const initials = interview.candidateName
              .split(' ').map((w) => w[0] || '').slice(0, 2).join('').toUpperCase();
            const feedbackAlreadySubmitted = !!interview.panelFeedback || !!interview.panelDecision;
            const isSubmitting = submittingFeedback[interview.panelId];
            const isUpdating = updatingStatus[interview.panelId];

            return (
              <div
                key={interview.panelId}
                className="glass-card"
                style={{ padding: '1.5rem', borderLeft: `4px solid ${statusColor}` }}
              >
                {/* Top row: candidate info + status */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: `${statusColor}22`, border: `1.5px solid ${statusColor}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.85rem', fontWeight: 700, color: statusColor, flexShrink: 0,
                  }}>
                    {initials || <User size={18} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem' }}>{interview.candidateName}</span>
                      <span className={`badge ${badgeClass}`} style={{ fontSize: '0.6rem' }}>
                        {STATUS_LABEL[outcomeStatus] || outcomeStatus}
                      </span>
                    </div>
                    <div className="text-muted text-sm" style={{ marginBottom: '0.25rem' }}>{interview.candidateEmail}</div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '4px', padding: '0.15rem 0.5rem', color: 'var(--primary)' }}>
                        {interview.role}
                      </span>
                      <span className="text-muted" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={11} /> {interview.duration} min
                      </span>
                    </div>
                  </div>
                </div>

                {/* Scheduled time + Teams link */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Scheduled</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{formatDateTime(interview.scheduledSlotStart)}</div>
                  </div>
                  {interview.teamsMeetingUrl && (
                    <a
                      href={interview.teamsMeetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm"
                    >
                      <Video size={13} /> Join Teams Meeting
                    </a>
                  )}
                </div>

                {/* Feedback section */}
                <div>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <MessageSquare size={11} /> Feedback
                  </div>

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
                          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {renderFeedbackHeader()}

                            {/* Scores & individual notes */}
                            {parsed.type === 'L1' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                    <span style={{ fontWeight: 600 }}>Coding &amp; Problem Solving:</span>
                                    {renderStarsStatic(parsed.scores?.coding || 0)}
                                  </div>
                                  {parsed.notes?.codingNotes && <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem 0', fontSize: '0.75rem', lineHeight: 1.4 }}>{parsed.notes.codingNotes}</p>}
                                </div>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                    <span style={{ fontWeight: 600 }}>Technical Communication:</span>
                                    {renderStarsStatic(parsed.scores?.communication || 0)}
                                  </div>
                                  {parsed.notes?.communicationNotes && <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem 0', fontSize: '0.75rem', lineHeight: 1.4 }}>{parsed.notes.communicationNotes}</p>}
                                </div>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                    <span style={{ fontWeight: 600 }}>CS Fundamentals:</span>
                                    {renderStarsStatic(parsed.scores?.fundamentals || 0)}
                                  </div>
                                  {parsed.notes?.fundamentalsNotes && <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem 0', fontSize: '0.75rem', lineHeight: 1.4 }}>{parsed.notes.fundamentalsNotes}</p>}
                                </div>
                              </div>
                            )}

                            {parsed.type === 'L2' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                    <span style={{ fontWeight: 600 }}>System Design &amp; Scalability:</span>
                                    {renderStarsStatic(parsed.scores?.systemDesign || 0)}
                                  </div>
                                  {parsed.notes?.systemDesignNotes && <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem 0', fontSize: '0.75rem', lineHeight: 1.4 }}>{parsed.notes.systemDesignNotes}</p>}
                                </div>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                    <span style={{ fontWeight: 600 }}>Technical Depth &amp; Experience:</span>
                                    {renderStarsStatic(parsed.scores?.technicalDepth || 0)}
                                  </div>
                                  {parsed.notes?.technicalDepthNotes && <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem 0', fontSize: '0.75rem', lineHeight: 1.4 }}>{parsed.notes.technicalDepthNotes}</p>}
                                </div>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                    <span style={{ fontWeight: 600 }}>Leadership &amp; Ownership:</span>
                                    {renderStarsStatic(parsed.scores?.leadership || 0)}
                                  </div>
                                  {parsed.notes?.leadershipNotes && <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem 0', fontSize: '0.75rem', lineHeight: 1.4 }}>{parsed.notes.leadershipNotes}</p>}
                                </div>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                    <span style={{ fontWeight: 600 }}>Cultural Fit &amp; MS Values:</span>
                                    {renderStarsStatic(parsed.scores?.culturalFit || 0)}
                                  </div>
                                  {parsed.notes?.culturalFitNotes && <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem 0', fontSize: '0.75rem', lineHeight: 1.4 }}>{parsed.notes.culturalFitNotes}</p>}
                                </div>
                              </div>
                            )}

                            {parsed.type === 'General' && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                    <span style={{ fontWeight: 600 }}>Technical Depth:</span>
                                    {renderStarsStatic(parsed.scores?.technical || 0)}
                                  </div>
                                  {parsed.notes?.technicalNotes && <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem 0', fontSize: '0.75rem', lineHeight: 1.4 }}>{parsed.notes.technicalNotes}</p>}
                                </div>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                    <span style={{ fontWeight: 600 }}>Communication:</span>
                                    {renderStarsStatic(parsed.scores?.communication || 0)}
                                  </div>
                                  {parsed.notes?.communicationNotes && <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem 0', fontSize: '0.75rem', lineHeight: 1.4 }}>{parsed.notes.communicationNotes}</p>}
                                </div>
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                                    <span style={{ fontWeight: 600 }}>Collaboration &amp; Teamwork:</span>
                                    {renderStarsStatic(parsed.scores?.collaboration || 0)}
                                  </div>
                                  {parsed.notes?.collaborationNotes && <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem 0', fontSize: '0.75rem', lineHeight: 1.4 }}>{parsed.notes.collaborationNotes}</p>}
                                </div>
                              </div>
                            )}

                            {/* Overall summary notes */}
                            {parsed.comments && (
                              <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>Overall Summary Notes</div>
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{parsed.comments}</p>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // Fallback to legacy string feedback
                      return (
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                          {renderFeedbackHeader()}
                          {interview.panelFeedback && (
                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
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
                              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
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

                              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
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

                              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
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
                              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
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

                              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
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

                              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
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

                              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
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
                            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
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

                            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
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

                            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-glass)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
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
              </div>
            );
          })}
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
    </div>
  );
}
