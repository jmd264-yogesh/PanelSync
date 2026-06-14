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

  const handleFeedbackSubmit = async (interview: PanelistInterview, decision: 'PASSED' | 'REJECTED') => {
    const feedback = feedbackDraft[interview.panelId] || '';
    setSubmittingFeedback((prev) => ({ ...prev, [interview.panelId]: true }));
    setFeedbackError((prev) => ({ ...prev, [interview.panelId]: null }));
    try {
      const res = await fetch(`/api/panelist/feedback/${interview.panelId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback, decision }),
      });
      if (!res.ok) throw new Error('Failed to submit feedback');
      await refreshInterviews();
      setFeedbackDraft((prev) => ({ ...prev, [interview.panelId]: '' }));
    } catch (err: any) {
      setFeedbackError((prev) => ({ ...prev, [interview.panelId]: err.message || 'Failed to submit' }));
    } finally {
      setSubmittingFeedback((prev) => ({ ...prev, [interview.panelId]: false }));
    }
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

                {/* Outcome status buttons (role-restricted) */}
                {interview.candidateId && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      Update Outcome
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {isL1 && (
                        <>
                          <button
                            onClick={() => handleStatusChange(interview, 'PASSED_L1')}
                            disabled={isUpdating || outcomeStatus === 'PASSED_L1'}
                            className="btn btn-sm"
                            style={{
                              background: outcomeStatus === 'PASSED_L1' ? 'rgba(14,165,233,0.15)' : 'transparent',
                              border: `1px solid ${outcomeStatus === 'PASSED_L1' ? '#0ea5e9' : 'var(--border-glass)'}`,
                              color: outcomeStatus === 'PASSED_L1' ? '#0ea5e9' : 'var(--text-muted)',
                            }}
                          >
                            {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                            Pass L1
                          </button>
                          <button
                            onClick={() => handleStatusChange(interview, 'REJECTED')}
                            disabled={isUpdating || outcomeStatus === 'REJECTED'}
                            className="btn btn-sm"
                            style={{
                              background: outcomeStatus === 'REJECTED' ? 'rgba(239,68,68,0.1)' : 'transparent',
                              border: `1px solid ${outcomeStatus === 'REJECTED' ? '#ef4444' : 'var(--border-glass)'}`,
                              color: outcomeStatus === 'REJECTED' ? '#ef4444' : 'var(--text-muted)',
                            }}
                          >
                            <XCircle size={12} /> Reject
                          </button>
                        </>
                      )}
                      {isL2 && (
                        <>
                          <button
                            onClick={() => handleStatusChange(interview, 'PASSED_L2')}
                            disabled={isUpdating || outcomeStatus === 'PASSED_L2'}
                            className="btn btn-sm"
                            style={{
                              background: outcomeStatus === 'PASSED_L2' ? 'rgba(124,58,237,0.15)' : 'transparent',
                              border: `1px solid ${outcomeStatus === 'PASSED_L2' ? '#7c3aed' : 'var(--border-glass)'}`,
                              color: outcomeStatus === 'PASSED_L2' ? '#7c3aed' : 'var(--text-muted)',
                            }}
                          >
                            {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                            Pass L2
                          </button>
                          <button
                            onClick={() => handleStatusChange(interview, 'REJECTED')}
                            disabled={isUpdating || outcomeStatus === 'REJECTED'}
                            className="btn btn-sm"
                            style={{
                              background: outcomeStatus === 'REJECTED' ? 'rgba(239,68,68,0.1)' : 'transparent',
                              border: `1px solid ${outcomeStatus === 'REJECTED' ? '#ef4444' : 'var(--border-glass)'}`,
                              color: outcomeStatus === 'REJECTED' ? '#ef4444' : 'var(--text-muted)',
                            }}
                          >
                            <XCircle size={12} /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Feedback section */}
                <div>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <MessageSquare size={11} /> Feedback
                  </div>

                  {feedbackAlreadySubmitted ? (
                    <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: interview.panelFeedback ? '0.4rem' : 0 }}>
                        <CheckCircle size={13} style={{ color: 'var(--success)' }} />
                        <span style={{ fontSize: '0.78rem', color: 'var(--success)', fontWeight: 600 }}>
                          Feedback submitted — {interview.panelDecision === 'PASSED' ? 'Passed' : 'Rejected'}
                        </span>
                      </div>
                      {interview.panelFeedback && (
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                          {interview.panelFeedback}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <textarea
                        className="form-input"
                        rows={3}
                        style={{ resize: 'vertical', fontSize: '0.85rem', marginBottom: '0.6rem' }}
                        placeholder="Write your interview notes and feedback here…"
                        value={feedbackDraft[interview.panelId] || ''}
                        onChange={(e) => setFeedbackDraft((prev) => ({ ...prev, [interview.panelId]: e.target.value }))}
                        disabled={isSubmitting}
                      />
                      {feedbackError[interview.panelId] && (
                        <p style={{ color: '#ef4444', fontSize: '0.78rem', marginBottom: '0.5rem' }}>
                          {feedbackError[interview.panelId]}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
