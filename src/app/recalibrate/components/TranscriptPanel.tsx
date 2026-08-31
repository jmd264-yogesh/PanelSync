'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Loader2, RefreshCw, AlertTriangle, ChevronDown, User, Users } from 'lucide-react';
import { SectionHeader } from '@/components/recalibrate/primitives';
import { formatTimestamp, type SpeakerRole, type TranscriptAnalysis } from '@/lib/transcript';

interface TranscriptResponse {
  hasTranscript: boolean;
  fetchedAt: string | null;
  transcriptCount: number;
  analysis: TranscriptAnalysis | null;
}

const ROLE_STYLE: Record<SpeakerRole, { color: string; label: string }> = {
  candidate: { color: 'var(--rc-brand, #7c3aed)', label: 'Candidate' },
  panelist: { color: 'var(--info, #0ea5e9)', label: 'Panel' },
  unknown: { color: 'var(--text-muted)', label: 'Unattributed' },
};

/**
 * Teams meeting transcript for this interview.
 *
 * Read is separate from sync: the stored transcript loads with the workspace, and
 * pulling from Graph only happens when the panelist asks, because that round trip is
 * slow and pointless before the call has finished.
 */
export default function TranscriptPanel({ interviewId }: { interviewId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TranscriptResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/interviews/${interviewId}/transcript`);
        const json = await res.json();
        if (!cancelled && res.ok) setData(json);
      } catch {
        // A missing stored transcript isn't an error worth showing — the sync button is
        // the affordance here, and it reports its own failures.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [interviewId]);

  const sync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/transcript`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not fetch the transcript.');
      setData(json);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch the transcript.');
    } finally {
      setSyncing(false);
    }
  };

  const analysis = data?.analysis ?? null;

  return (
    <div className="glass-card" style={{ padding: '1rem', border: '1px solid rgba(14,165,233,0.25)' }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <SectionHeader icon={<FileText size={14} />} title="Interview Transcript" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {analysis && (
            <span className="text-xs text-muted" style={{ fontFamily: 'monospace' }}>
              {analysis.segments.length}
            </span>
          )}
          <ChevronDown
            size={16}
            style={{
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
              color: 'var(--text-muted)',
            }}
          />
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Loader2 size={13} className="animate-spin" />
              <span className="text-xs text-muted">Checking for a transcript…</span>
            </div>
          )}

          {!loading && (
            <>
              <button
                className="btn btn-sm"
                onClick={sync}
                disabled={syncing}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', alignSelf: 'flex-start' }}
              >
                {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                <span>{data?.hasTranscript ? 'Re-sync from Teams' : 'Fetch from Teams'}</span>
              </button>

              {error && (
                <div
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.4rem', padding: '0.55rem 0.7rem',
                    fontSize: '0.74rem', lineHeight: 1.5, borderRadius: '8px',
                    borderLeft: '3px solid var(--warning, #f59e0b)',
                    background: 'var(--warning-glow, rgba(245,158,11,0.08))',
                  }}
                >
                  <AlertTriangle size={13} style={{ marginTop: '1px', flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {!data?.hasTranscript && !error && (
                <p className="text-xs text-muted" style={{ margin: 0, lineHeight: 1.55 }}>
                  No transcript stored yet. Teams only produces one if transcription was started
                  during the call — it is not on by default.
                </p>
              )}

              {analysis && analysis.segments.length > 0 && (
                <>
                  {/* Talk-time split is the one number worth surfacing up front: a
                      candidate who spoke for 20% of a 45-minute interview usually means
                      the panel talked over them. */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem' }}>
                    <div>
                      <div
                        className="text-xs text-muted"
                        style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        Candidate talk time
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'monospace' }}>
                        {analysis.candidateTalkShare !== null
                          ? `${Math.round(analysis.candidateTalkShare * 100)}%`
                          : '—'}
                      </div>
                    </div>
                    <div>
                      <div
                        className="text-xs text-muted"
                        style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        Length
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'monospace' }}>
                        {formatTimestamp(analysis.durationMs)}
                      </div>
                    </div>
                    <div>
                      <div
                        className="text-xs text-muted"
                        style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        Words
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'monospace' }}>
                        {analysis.totalWords}
                      </div>
                    </div>
                  </div>

                  {analysis.candidateTalkShare === null && (
                    <p className="text-xs text-muted" style={{ margin: 0, lineHeight: 1.5 }}>
                      Could not match any speaker to the candidate by name, so the talk-time split is
                      unavailable. The transcript itself is still complete below.
                    </p>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {analysis.speakers.map((s) => (
                      <div
                        key={s.speaker}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.74rem' }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', minWidth: 0 }}>
                          {s.role === 'candidate' ? <User size={11} /> : <Users size={11} />}
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.speaker}
                          </span>
                          <span style={{ color: ROLE_STYLE[s.role].color, fontSize: '0.62rem', fontWeight: 700, flexShrink: 0 }}>
                            {ROLE_STYLE[s.role].label}
                          </span>
                        </span>
                        <span className="text-muted" style={{ fontFamily: 'monospace', flexShrink: 0 }}>
                          {Math.round(s.shareOfTime * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column',
                      gap: '0.5rem', paddingRight: '0.25rem', borderTop: '1px solid var(--border-glass)',
                      paddingTop: '0.6rem',
                    }}
                  >
                    {analysis.segments.map((segment, i) => (
                      <div key={`${segment.startMs}-${i}`} style={{ fontSize: '0.78rem', lineHeight: 1.55 }}>
                        <span
                          className="text-muted"
                          style={{ fontFamily: 'monospace', fontSize: '0.66rem', marginRight: '0.4rem' }}
                        >
                          {formatTimestamp(segment.startMs)}
                        </span>
                        <span
                          style={{ fontWeight: 700, color: ROLE_STYLE[segment.role].color, marginRight: '0.35rem' }}
                        >
                          {segment.speaker ?? 'Unknown'}:
                        </span>
                        <span>{segment.text}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
