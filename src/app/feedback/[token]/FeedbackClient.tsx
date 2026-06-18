'use client';

import React, { useState } from 'react';
import { Interview, InterviewPanel } from '@/lib/db';
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Calendar,
  Clock,
  User,
  Briefcase,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';

interface FeedbackClientProps {
  interview: Interview;
  panel: InterviewPanel;
}

export default function FeedbackClient({ interview, panel }: FeedbackClientProps) {
  const [decision, setDecision] = useState<'PASSED' | 'REJECTED' | null>(
    (panel.decision as 'PASSED' | 'REJECTED' | null) ?? null
  );
  const [feedback, setFeedback] = useState(panel.feedback ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(!!panel.decision);
  const [errorMsg, setErrorMsg] = useState('');

  const isL1 = interview.role.toLowerCase().includes('l1');
  const isL2 = interview.role.toLowerCase().includes('l2');
  const accentColor = isL1 ? '#60a5fa' : isL2 ? '#a78bfa' : '#6366f1';
  const accentBg = isL1 ? 'rgba(96,165,250,0.1)' : isL2 ? 'rgba(167,139,250,0.1)' : 'rgba(99,102,241,0.1)';
  const accentBorder = isL1 ? 'rgba(96,165,250,0.3)' : isL2 ? 'rgba(167,139,250,0.3)' : 'rgba(99,102,241,0.3)';
  const roundLabel = isL1 ? 'L1 — Technical Screening' : isL2 ? 'L2 — System Design / Management' : interview.role;

  const slotStart = interview.scheduledSlotStart ? new Date(interview.scheduledSlotStart) : null;
  const slotEnd = interview.scheduledSlotEnd ? new Date(interview.scheduledSlotEnd) : null;

  const handleSubmit = async () => {
    if (!decision) {
      setErrorMsg('Please select a decision (Pass or Reject) before submitting.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/feedback/${panel.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, feedback }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit feedback.');
      }
      setSubmitted(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (submitted) {
    return (
      <div className="glass-card text-center" style={{ padding: '3rem 2rem' }}>
        {decision === 'PASSED' ? (
          <CheckCircle size={60} style={{ color: '#10b981', margin: '0 auto 1.5rem' }} />
        ) : (
          <XCircle size={60} style={{ color: '#ef4444', margin: '0 auto 1.5rem' }} />
        )}
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Feedback Submitted</h2>
        <p className="text-muted" style={{ fontSize: '0.95rem', marginBottom: '1.5rem' }}>
          Thank you, <strong>{panel.name}</strong>. Your{' '}
          <strong style={{ color: accentColor }}>{roundLabel}</strong> feedback for{' '}
          <strong>{interview.candidateName}</strong> has been recorded.
        </p>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.6rem 1.2rem',
            borderRadius: 'var(--radius-md)',
            background: decision === 'PASSED' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${decision === 'PASSED' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: decision === 'PASSED' ? '#10b981' : '#ef4444',
            fontWeight: 700,
            fontSize: '1rem',
            marginBottom: '1rem',
          }}
        >
          {decision === 'PASSED' ? <ThumbsUp size={18} /> : <ThumbsDown size={18} />}
          {decision === 'PASSED' ? 'Candidate PASSED' : 'Candidate REJECTED'}
        </div>

        {feedback && (
          <div
            style={{
              textAlign: 'left',
              padding: '0.75rem 1rem',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-sm)',
              marginTop: '1rem',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
            }}
          >
            <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.25rem' }}>
              Your Notes:
            </strong>
            {feedback}
          </div>
        )}

        <p className="text-muted text-xs" style={{ marginTop: '1.5rem' }}>
          You can close this tab now. The recruiter has been notified.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: '2rem 2rem 2.5rem' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem', marginBottom: '1.75rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: accentBg,
            border: `1px solid ${accentBorder}`,
            borderRadius: '6px',
            padding: '0.2rem 0.7rem',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: accentColor,
            marginBottom: '0.9rem',
          }}
        >
          {isL1 ? 'L1' : isL2 ? 'L2' : 'ROUND'} · Interview Feedback
        </div>
        <h2 style={{ fontSize: '1.6rem', marginBottom: '0.25rem' }}>
          Submit Your Feedback
        </h2>
        <p className="text-muted text-sm">
          Hi <strong style={{ color: 'var(--text-main)' }}>{panel.name}</strong>, please record your interview decision for this candidate.
        </p>
      </div>

      {/* Interview metadata */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem',
          marginBottom: '1.75rem',
          padding: '1rem',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border-glass)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
          <User size={15} style={{ color: accentColor, marginTop: '2px', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Candidate</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{interview.candidateName}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
          <Briefcase size={15} style={{ color: accentColor, marginTop: '2px', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Role</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{interview.role}</div>
          </div>
        </div>
        {slotStart && (
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
            <Calendar size={15} style={{ color: accentColor, marginTop: '2px', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Interview Date</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                {slotStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
        )}
        {slotStart && slotEnd && (
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
            <Clock size={15} style={{ color: accentColor, marginTop: '2px', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time Slot</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                {slotStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} –{' '}
                {slotEnd.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Decision buttons */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.6rem' }}>
          Your Decision *
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <button
            onClick={() => setDecision('PASSED')}
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${decision === 'PASSED' ? '#10b981' : 'var(--border-glass)'}`,
              background: decision === 'PASSED' ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.02)',
              color: decision === 'PASSED' ? '#10b981' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.15s ease',
              fontWeight: decision === 'PASSED' ? 700 : 500,
              boxShadow: decision === 'PASSED' ? '0 0 20px rgba(16,185,129,0.15)' : 'none',
            }}
          >
            <ThumbsUp size={24} />
            <span style={{ fontSize: '0.9rem' }}>PASS</span>
            <span style={{ fontSize: '0.65rem', opacity: 0.7, fontWeight: 400 }}>Candidate cleared this round</span>
          </button>

          <button
            onClick={() => setDecision('REJECTED')}
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${decision === 'REJECTED' ? '#ef4444' : 'var(--border-glass)'}`,
              background: decision === 'REJECTED' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.02)',
              color: decision === 'REJECTED' ? '#ef4444' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.15s ease',
              fontWeight: decision === 'REJECTED' ? 700 : 500,
              boxShadow: decision === 'REJECTED' ? '0 0 20px rgba(239,68,68,0.12)' : 'none',
            }}
          >
            <ThumbsDown size={24} />
            <span style={{ fontSize: '0.9rem' }}>REJECT</span>
            <span style={{ fontSize: '0.65rem', opacity: 0.7, fontWeight: 400 }}>Candidate did not clear this round</span>
          </button>
        </div>
      </div>

      {/* Feedback notes */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
          <MessageSquare size={13} /> Feedback Notes (Optional)
        </label>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Describe how the interview went — strengths, areas of improvement, specific observations..."
          style={{
            width: '100%',
            minHeight: '120px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)',
            padding: '0.85rem 1rem',
            color: 'var(--text-main)',
            fontSize: '0.875rem',
            resize: 'vertical',
            fontFamily: 'inherit',
            outline: 'none',
            transition: 'border-color 0.15s ease',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = accentColor)}
          onBlur={(e) => (e.currentTarget.style.borderColor = '')}
        />
      </div>

      {/* Error */}
      {errorMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem',
            background: 'var(--danger-glow)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--danger)',
            fontSize: '0.85rem',
            marginBottom: '1rem',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          {errorMsg}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!decision || isSubmitting}
        style={{
          width: '100%',
          padding: '0.9rem',
          background: !decision
            ? 'rgba(255,255,255,0.05)'
            : decision === 'PASSED'
            ? 'linear-gradient(135deg, #059669, #10b981)'
            : 'linear-gradient(135deg, #b91c1c, #ef4444)',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          color: '#fff',
          fontSize: '0.95rem',
          fontWeight: 700,
          cursor: !decision || isSubmitting ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          transition: 'all 0.2s ease',
          opacity: !decision ? 0.5 : 1,
        }}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Submitting...
          </>
        ) : decision === 'PASSED' ? (
          <>
            <ThumbsUp size={18} /> Submit — PASS
          </>
        ) : decision === 'REJECTED' ? (
          <>
            <ThumbsDown size={18} /> Submit — REJECT
          </>
        ) : (
          'Select a decision above to continue'
        )}
      </button>

      <p className="text-muted text-xs text-center" style={{ marginTop: '0.75rem' }}>
        Once submitted, feedback can be edited within 2 hours.
      </p>
    </div>
  );
}
