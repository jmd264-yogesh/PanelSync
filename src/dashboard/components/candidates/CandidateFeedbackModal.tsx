/**
 * CandidateFeedbackModal Component
 *
 * Displays comprehensive feedback from L1 and L2 interviews for a candidate.
 */

'use client';

import React from 'react';
import { X } from 'lucide-react';
import { parseFeedbackSafely } from '@common/util/feedback-parser';
import { getCandidateRoundResults } from '@/common/util/candidates/roundResultCalculation';
import type { UploadedCandidate, Interview } from '@server/lib/db';

interface CandidateFeedbackModalProps {
  candidate: UploadedCandidate;
  interviews: Interview[];
  onClose: () => void;
}

function renderStarsStatic(rating: number) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          style={{
            color: star <= rating ? '#fbbf24' : 'rgba(255,255,255,0.12)',
            fontSize: '1rem',
            lineHeight: 1,
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export const CandidateFeedbackModal: React.FC<CandidateFeedbackModalProps> = ({
  candidate,
  interviews,
  onClose,
}) => {
  const { l1Result, l2Result } = getCandidateRoundResults(candidate, interviews);

  const getBadge = (result: string) => {
    if (result === 'Passed')
      return (
        <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
          Passed
        </span>
      );
    if (result === 'Rejected')
      return (
        <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>
          Rejected
        </span>
      );
    if (result === 'Pending Feedback')
      return (
        <span className="badge badge-pending" style={{ fontSize: '0.65rem' }}>
          Pending Feedback
        </span>
      );
    if (result === 'Scheduled')
      return (
        <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
          Scheduled
        </span>
      );
    return (
      <span
        className="badge"
        style={{
          fontSize: '0.65rem',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid var(--border-glass)',
          color: 'var(--text-muted)',
        }}
      >
        Not Started
      </span>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-glass)',
          borderRadius: 'var(--radius-lg)',
          width: '90%',
          maxWidth: '650px',
          maxHeight: '85vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-card)',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.01)',
            width: '100%',
          }}
        >
          <div style={{ flex: 1 }}>
            <h3
              style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                margin: 0,
                color: 'var(--text-main)',
              }}
            >
              {candidate.name}
            </h3>
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.78rem',
                margin: '0.2rem 0 0 0',
              }}
            >
              {candidate.email} · {candidate.college}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          {/* Summary Badges */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              padding: '0.75rem 1rem',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                }}
              >
                L1 Stage:
              </span>
              {getBadge(l1Result)}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                }}
              >
                L2 Stage:
              </span>
              {getBadge(l2Result)}
            </div>
          </div>

          {/* L1 & L2 Details */}
          {['L1', 'L2'].map((round) => {
            const roundInterviews = interviews.filter(
              (i) =>
                i.candidateEmail.toLowerCase() === candidate.email.toLowerCase() &&
                i.role.toLowerCase().includes(round.toLowerCase())
            );

            const borderStyle =
              round === 'L1' ? '3px solid #3b82f6' : '3px solid #7c3aed';

            return (
              <div
                key={round}
                style={{
                  borderLeft: borderStyle,
                  paddingLeft: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                <h4
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    margin: 0,
                    color: 'var(--text-main)',
                  }}
                >
                  {round} Round Details
                </h4>

                {roundInterviews.length === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      fontStyle: 'italic',
                    }}
                  >
                    No {round} interviews scheduled.
                  </p>
                ) : (
                  roundInterviews.map((interview) => {
                    const isBooked =
                      interview.status === 'SCHEDULED' ||
                      interview.status === 'COLLECTED';
                    const submittedPanels = (interview.panels || []).filter(
                      (p) => p.status === 'SUBMITTED'
                    );
                    const pendingPanels = isBooked
                      ? []
                      : (interview.panels || []).filter(
                          (p) => p.status === 'PENDING'
                        );

                    return (
                      <div
                        key={interview.id}
                        style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
                      >
                        <div
                          style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}
                        >
                          Interview Status:{' '}
                          <strong style={{ color: 'var(--text-main)' }}>
                            {interview.status}
                          </strong>
                          {interview.scheduledSlotStart && (
                            <>
                              {' '}
                              · Scheduled for:{' '}
                              <strong style={{ color: 'var(--text-main)' }}>
                                {new Date(
                                  interview.scheduledSlotStart
                                ).toLocaleString()}
                              </strong>
                            </>
                          )}
                        </div>

                        {/* Panel Feedbacks */}
                        {submittedPanels.length === 0 &&
                          pendingPanels.length === 0 && (
                            <p
                              style={{
                                margin: 0,
                                fontSize: '0.78rem',
                                color: 'var(--text-muted)',
                                fontStyle: 'italic',
                              }}
                            >
                              No panel members nominated for this interview slot.
                            </p>
                          )}

                        {submittedPanels.map((panel) => {
                          const parsed = parseFeedbackSafely(panel.feedback);
                          const isPassed = panel.decision === 'PASSED';
                          const badgeColor = isPassed
                            ? 'var(--success)'
                            : 'var(--danger)';
                          const badgeBg = isPassed
                            ? 'var(--success-glow)'
                            : 'var(--danger-glow)';
                          const badgeBorder = isPassed
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(239, 68, 68, 0.2)';

                          return (
                            <div
                              key={panel.id}
                              style={{
                                padding: '0.75rem 1rem',
                                background: 'rgba(255,255,255,0.01)',
                                border: '1px solid var(--border-glass)',
                                borderRadius: 'var(--radius-sm)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                }}
                              >
                                <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                  Panelist:{' '}
                                  <span style={{ color: 'var(--text-main)' }}>
                                    {panel.name}
                                  </span>
                                </div>
                                <span
                                  className="badge"
                                  style={{
                                    fontSize: '0.62rem',
                                    background: badgeBg,
                                    border: `1px solid ${badgeBorder}`,
                                    color: badgeColor,
                                  }}
                                >
                                  {panel.decision}
                                </span>
                              </div>

                              {/* Star Ratings */}
                              {parsed && parsed.scores && (
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.25rem',
                                    margin: '0.25rem 0',
                                    background: 'rgba(255,255,255,0.01)',
                                    padding: '0.4rem',
                                    borderRadius: '4px',
                                  }}
                                >
                                  {Object.entries(parsed.scores).map(
                                    ([metric, score]) => {
                                      const displayNames: Record<string, string> = {
                                        coding: 'Coding & Problem Solving',
                                        communication: 'Technical Communication',
                                        fundamentals: 'CS Fundamentals',
                                        systemDesign: 'System Design & Scalability',
                                        technicalDepth: 'Technical Depth & Experience',
                                        leadership: 'Leadership & Ownership',
                                        culturalFit: 'Cultural Fit & MS Values',
                                        technical: 'Technical Depth',
                                        collaboration: 'Collaboration & Teamwork',
                                      };
                                      return (
                                        <div
                                          key={metric}
                                          style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                          }}
                                        >
                                          <span
                                            style={{
                                              fontSize: '0.7rem',
                                              color: 'var(--text-muted)',
                                            }}
                                          >
                                            {displayNames[metric] || metric}:
                                          </span>
                                          {renderStarsStatic(score as number)}
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              )}

                              {/* Comments */}
                              <div style={{ fontSize: '0.78rem' }}>
                                <span
                                  style={{
                                    fontSize: '0.65rem',
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase',
                                    fontWeight: 700,
                                    display: 'block',
                                    marginBottom: '2px',
                                  }}
                                >
                                  Comments
                                </span>
                                <p
                                  style={{
                                    margin: 0,
                                    color: 'var(--text-main)',
                                    lineHeight: 1.4,
                                    whiteSpace: 'pre-wrap',
                                    fontSize: '0.78rem',
                                  }}
                                >
                                  {parsed
                                    ? parsed.comments
                                    : panel.feedback || 'No comments provided.'}
                                </p>
                              </div>
                            </div>
                          );
                        })}

                        {pendingPanels.map((panel) => (
                          <div
                            key={panel.id}
                            style={{
                              padding: '0.5rem 0.75rem',
                              border: '1px dashed var(--border-glass)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--text-muted)',
                              fontSize: '0.78rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span>
                              Panelist: <strong>{panel.name}</strong> ({panel.email})
                            </span>
                            <span
                              className="badge badge-pending"
                              style={{ fontSize: '0.62rem' }}
                            >
                              Feedback Pending
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-glass)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'rgba(255,255,255,0.01)',
          }}
        >
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
