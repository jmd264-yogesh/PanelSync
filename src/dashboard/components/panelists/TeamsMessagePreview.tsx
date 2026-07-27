'use client';

import React from 'react';
import { Panelist } from '@server/lib/db';
import { ProposedSlot } from '@/common/types/panelist';

interface TeamsMessagePreviewProps {
  panelists: Panelist[];
  interviewType: string;
  collegeName: string;
  startDate: string;
  endDate: string;
  duration: string;
  selectedSlots: ProposedSlot[];
  todayStr: string;
}

export const TeamsMessagePreview = ({
  panelists,
  interviewType,
  collegeName,
  startDate,
  endDate,
  duration,
  selectedSlots,
  todayStr,
}: TeamsMessagePreviewProps) => {
  return (
    <div
      style={{
        background: 'var(--preview-bg)',
        padding: '1.25rem',
        borderRadius: '14px',
        border: '1px solid var(--border)',
        marginBottom: '1.5rem',
      }}
    >
      <span
        className="text-muted text-xs block font-bold"
        style={{ marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
      >
        Teams Message Preview Card
      </span>
      <div style={{ paddingLeft: '0.75rem', fontSize: '0.8rem', color: 'var(--fg-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontWeight: 850 }}>📅 Campus Hiring Interview Slot Request</span>
        </div>

        <p style={{ margin: '4px 0', fontSize: '0.8rem', color: 'var(--fg)' }}>
          Hello <strong>{panelists.length === 1 ? panelists[0].displayName : '[Panelist Name]'}</strong>,
        </p>
        <p style={{ margin: '4px 0', fontSize: '0.8rem' }}>
          You have been requested to conduct an interview.
        </p>

        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '10px 12px',
            margin: '10px 0',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
            <div>
              <div
                style={{
                  fontSize: '0.65rem',
                  color: 'var(--fg-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 650,
                }}
              >
                Interview Round
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--fg)' }}>
                {interviewType} Interview{collegeName ? ` - ${collegeName}` : ''}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: '0.65rem',
                  color: 'var(--fg-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 650,
                }}
              >
                Proposed Dates
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--fg)' }}>
                {new Date(startDate || todayStr).toLocaleDateString('en-US')} -{' '}
                {new Date(endDate || todayStr).toLocaleDateString('en-US')}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: '0.65rem',
                  color: 'var(--fg-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 650,
                }}
              >
                Duration
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--fg)' }}>{duration} minutes</div>
            </div>
            <div>
              <div
                style={{
                  fontSize: '0.65rem',
                  color: 'var(--fg-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 650,
                }}
              >
                Nominated Panelist
              </div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--fg)' }}>
                {panelists.length === 1 ? panelists[0].displayName : '[Panelist Name]'}
              </div>
            </div>
          </div>
        </div>

        <p style={{ margin: '4px 0', fontSize: '0.8rem' }}>
          Please select one of the following proposed slots to book instantly:
        </p>
        <div style={{ margin: '8px 0', paddingLeft: '1rem', color: 'var(--fg)', fontSize: '0.75rem' }}>
          {selectedSlots.slice(0, 6).map((s, i) => {
            const d = new Date(s.startTime);
            return (
              <div key={i}>
                • {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} @{' '}
                {d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} (IST)
              </div>
            );
          })}
          {selectedSlots.length > 6 && <div>• and {selectedSlots.length - 6} more slots...</div>}
          {selectedSlots.length === 0 && (
            <div style={{ fontStyle: 'italic', color: 'var(--danger)' }}>
              No slots selected! Please enable at least one slot.
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: '0.75rem',
            background: '#6366f1',
            color: '#fff',
            padding: '0.4rem 0.8rem',
            borderRadius: '6px',
            display: 'inline-block',
            fontSize: '0.75rem',
            fontWeight: 700,
          }}
        >
          Review Availability
        </div>
      </div>
    </div>
  );
};
