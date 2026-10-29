'use client';

import React, { useMemo, useState } from 'react';
import { Users, Sparkles, CheckCircle2, AlertTriangle, Loader2, Pencil } from 'lucide-react';
import { SectionHeader } from '@/components/recalibrate/primitives';
import { parseDialogueTurns } from '@/lib/transcript';
import { applySpeakerMap, summarizeSpeakers, validateSpeakerMap } from '@/lib/in-person';
import type { SpeakerAssignment, SpeakerMap } from '@/lib/db';

// The "who is who" step of the in-person flow. The room recording is transcribed with
// neutral "Speaker N" labels; here a panelist confirms which voice is the candidate (and
// which panelist each other voice is) before anything is scored. AI suggestions pre-fill
// the choices but are clearly marked as suggestions.

interface Props {
  /** Raw neutral-label transcript (the server's source of truth). */
  transcriptText: string;
  speakerMap: SpeakerMap | null;
  speakersConfirmedAt: string | null;
  candidateName: string;
  panelNames: string[];
  isConfirming: boolean;
  onConfirm: (map: SpeakerMap) => Promise<void>;
}

const ROLE_COLOR = {
  candidate: 'var(--rc-brand, #7c3aed)',
  panelist: 'var(--info, #0ea5e9)',
  ignore: 'var(--text-muted)',
} as const;

export default function InPersonSpeakerReview(props: Props) {
  const { transcriptText, speakerMap, speakersConfirmedAt, candidateName, panelNames, isConfirming, onConfirm } = props;
  const rawTurns = useMemo(() => parseDialogueTurns(transcriptText), [transcriptText]);
  const summaries = useMemo(() => summarizeSpeakers(rawTurns), [rawTurns]);
  const labels = summaries.map((s) => s.label);

  const [draft, setDraft] = useState<SpeakerMap>(() => ({ ...(speakerMap ?? {}) }));
  const [editing, setEditing] = useState(!speakersConfirmedAt);

  const check = validateSpeakerMap(draft, labels);
  const candidateLabels = labels.filter((l) => draft[l]?.role === 'candidate');

  const setAssignment = (label: string, next: SpeakerAssignment) =>
    setDraft((d) => ({ ...d, [label]: next }));

  const confirmed = Boolean(speakersConfirmedAt) && !editing;
  const confirmedTurns = useMemo(
    () => (speakerMap && speakersConfirmedAt ? applySpeakerMap(rawTurns, speakerMap, candidateName) : []),
    [rawTurns, speakerMap, speakersConfirmedAt, candidateName],
  );
  const candidateShare = useMemo(() => {
    const total = summaries.reduce((sum, s) => sum + s.words, 0) || 1;
    return summaries.filter((s) => speakerMap?.[s.label]?.role === 'candidate').reduce((sum, s) => sum + s.words, 0) / total;
  }, [summaries, speakerMap]);

  if (labels.length === 0) return null;

  return (
    <div className="glass-card" style={{ padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: confirmed ? '1px solid var(--border-glass)' : '1px solid rgba(245, 158, 11, 0.45)' }}>
      <SectionHeader
        icon={<Users size={14} />}
        title="Who is who"
        right={confirmed
          ? <span className="text-xs" style={{ color: 'var(--success, #10b981)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle2 size={12} /> Confirmed</span>
          : <span className="text-xs" style={{ color: '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><AlertTriangle size={12} /> Needs confirmation</span>}
      />

      {confirmed ? (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {labels.map((l) => {
              const a = speakerMap?.[l];
              const who = a?.role === 'candidate' ? `Candidate (${candidateName})` : a?.role === 'panelist' ? `Panel${a.name ? ` (${a.name})` : ''}` : 'Ignored';
              return (
                <span key={l} className="badge" style={{ fontSize: '0.68rem', color: ROLE_COLOR[a?.role ?? 'ignore'], border: '1px solid var(--border-glass)', background: 'transparent' }}>
                  {l} → {who}
                </span>
              );
            })}
          </div>
          <div className="text-xs text-muted">
            Candidate spoke {Math.round(candidateShare * 100)}% of the words. AI scoring used only the candidate&apos;s lines.
          </div>
          <details>
            <summary className="text-xs" style={{ fontWeight: 700, cursor: 'pointer' }}>View confirmed transcript ({confirmedTurns.length} turns)</summary>
            <div style={{ maxHeight: '320px', overflowY: 'auto', marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {confirmedTurns.map((t, i) => (
                <div key={i} style={{ fontSize: '0.78rem', lineHeight: 1.5 }}>
                  {t.timestamp && <span className="text-muted" style={{ fontFamily: 'monospace', marginRight: '0.35rem' }}>[{t.timestamp}]</span>}
                  <strong style={{ color: ROLE_COLOR[t.role ?? 'panelist'] }}>{t.role === 'candidate' ? 'Candidate' : t.speaker}:</strong> {t.text}
                </div>
              ))}
            </div>
          </details>
          <div>
            <button className="btn btn-sm" onClick={() => setEditing(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <Pencil size={12} /> Change assignments
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
            The room recording was split into {labels.length} voice{labels.length === 1 ? '' : 's'}. Check each one and mark who it is —
            AI scoring runs only after you confirm, and only on the candidate&apos;s lines. If one person was split into two
            speakers, mark both as that person.
          </div>

          {summaries.map((sp) => {
            const a = draft[sp.label];
            const suggestion = speakerMap?.[sp.label]?.suggested ? speakerMap[sp.label] : null;
            return (
              <div key={sp.label} style={{ padding: '0.7rem 0.8rem', borderRadius: '10px', border: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <strong style={{ fontSize: '0.88rem' }}>{sp.label}</strong>
                  <span className="text-xs text-muted">
                    {Math.round(sp.share * 100)}% of words · {sp.turns} turns · {sp.questions} questions asked
                  </span>
                </div>

                {suggestion && (
                  <div className="text-xs" style={{ display: 'flex', gap: '0.3rem', alignItems: 'flex-start', color: '#c084fc' }}>
                    <Sparkles size={11} style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span>
                      AI suggests <strong>{suggestion.role === 'candidate' ? 'Candidate' : suggestion.role === 'panelist' ? `Panelist${suggestion.name ? ` (${suggestion.name})` : ''}` : 'Ignore'}</strong>
                      {suggestion.reason ? ` — ${suggestion.reason}` : ''}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  {sp.samples.map((line, i) => (
                    <div key={i} className="text-xs text-muted" style={{ fontStyle: 'italic', lineHeight: 1.45 }}>“{line}”</div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {(['candidate', 'panelist', 'ignore'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      className={`btn btn-sm ${a?.role === role ? 'btn-primary' : ''}`}
                      onClick={() => setAssignment(sp.label, { role, name: role === 'panelist' ? (a?.name ?? panelNames[0]) : undefined })}
                    >
                      {role === 'candidate' ? 'Candidate' : role === 'panelist' ? 'Panelist' : 'Ignore'}
                    </button>
                  ))}
                  {a?.role === 'panelist' && (
                    <select
                      className="form-input"
                      value={a.name ?? ''}
                      onChange={(e) => setAssignment(sp.label, { role: 'panelist', name: e.target.value || undefined })}
                      style={{ fontSize: '0.78rem', padding: '0.25rem 0.4rem', width: 'auto' }}
                    >
                      <option value="">Unnamed panelist</option>
                      {panelNames.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  )}
                </div>
              </div>
            );
          })}

          {candidateLabels.length > 1 && (
            <div className="text-xs" style={{ color: '#f59e0b' }}>
              {candidateLabels.join(' and ')} will both be treated as {candidateName}. Only do this if the transcription split one voice in two.
            </div>
          )}
          {!check.ok && <div className="text-xs" style={{ color: 'var(--danger, #ef4444)' }}>{check.error}</div>}

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              className="btn btn-primary btn-sm"
              disabled={!check.ok || isConfirming}
              onClick={async () => {
                await onConfirm(draft);
                setEditing(false);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              {isConfirming ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              Confirm &amp; score with AI
            </button>
            {speakersConfirmedAt && (
              <button className="btn btn-sm" onClick={() => { setDraft({ ...(speakerMap ?? {}) }); setEditing(false); }}>
                Cancel
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
