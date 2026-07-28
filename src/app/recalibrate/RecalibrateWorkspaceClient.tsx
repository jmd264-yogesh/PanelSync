'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Gauge, Search, ChevronDown } from 'lucide-react';
import type { PanelistInterview } from '@/lib/db';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import CandidateRail, { CandidateStatus, STATUS_META, initials } from './components/CandidateRail';
import RecalibrateWorkspace from './components/RecalibrateWorkspace';

export default function RecalibrateWorkspaceClient({
  initialInterviews,
  panelistName,
}: {
  initialInterviews: PanelistInterview[];
  panelistName: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [statuses, setStatuses] = useState<Record<string, CandidateStatus>>({});
  const [pickerOpen, setPickerOpen] = useState(false);

  const urlInterviewId = searchParams.get('interview');
  const [selectedId, setSelectedId] = useState<string | null>(urlInterviewId || initialInterviews[0]?.interviewId || null);

  // Lightweight parallel status fetch so the picker can show Not started / In progress /
  // Submitted per candidate without the visitor having to open each one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(initialInterviews.map(async (i) => {
        try {
          const res = await fetch(`/api/interviews/${i.interviewId}/recalibrate`);
          if (!res.ok) return [i.interviewId, 'not_started' as CandidateStatus] as const;
          const data = await res.json();
          const s = data.session;
          if (s?.submittedAt) return [i.interviewId, 'submitted' as CandidateStatus] as const;
          const hasProgress = (s?.questionScores && Object.keys(s.questionScores).length > 0)
            || (s?.rubricScores && Object.keys(s.rubricScores).length > 0)
            || s?.timerStartedAt;
          return [i.interviewId, (hasProgress ? 'in_progress' : 'not_started') as CandidateStatus] as const;
        } catch {
          return [i.interviewId, 'not_started' as CandidateStatus] as const;
        }
      }));
      if (!cancelled) setStatuses(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return initialInterviews;
    const q = query.trim().toLowerCase();
    return initialInterviews.filter((i) => i.candidateName.toLowerCase().includes(q) || i.role.toLowerCase().includes(q));
  }, [initialInterviews, query]);

  const selected = initialInterviews.find((i) => i.interviewId === selectedId) || null;
  const selectedStatus = selectedId ? (statuses[selectedId] || 'not_started') : 'not_started';
  const selectedRound = useMemo(() => {
    if (!selected) return null;
    const roleLower = selected.role.toLowerCase();
    return roleLower.includes('l2') ? 'L2' : roleLower.includes('l1') ? 'L1' : null;
  }, [selected]);
  const selectedPosition = selected ? selected.role.replace(/^(L1|L2)\s*-\s*/i, '').replace(/^LATERAL - /i, '') : '';

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setPickerOpen(false);
    router.replace(`/recalibrate?interview=${id}`, { scroll: false });
  };

  if (initialInterviews.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', gap: '1rem' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '64px', height: '64px', borderRadius: '18px',
          background: 'linear-gradient(145deg, #a855f7, #7c3aed 70%)', color: '#fff',
        }}>
          <Gauge size={30} />
        </span>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>No lateral hiring interviews assigned yet</h2>
        <p className="text-muted text-sm" style={{ maxWidth: '420px', margin: 0 }}>
          Once a recruiter schedules a lateral hiring interview with you as panelist, it&apos;ll show up here for live scoring.
        </p>
      </div>
    );
  }

  const StatusIcon = STATUS_META[selectedStatus].icon;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {initialInterviews.length > 1 && (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="glass-card"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.75rem', alignSelf: 'flex-start',
            padding: '0.55rem 0.9rem 0.55rem 0.55rem', cursor: 'pointer', border: '1px solid var(--border-glass)',
            transition: 'var(--transition-fast, all 0.15s ease)', maxWidth: '100%',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-card)'; }}
        >
          {selected && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              width: '32px', height: '32px', borderRadius: '9px', fontSize: '0.72rem', fontWeight: 700,
              background: 'linear-gradient(145deg, #a855f7, #7c3aed 70%)', color: '#fff',
            }}>
              {initials(selected.candidateName)}
            </span>
          )}
          <div style={{ textAlign: 'left', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>
                {selected?.candidateName || 'Select a candidate'}
              </span>
              {selectedRound && (
                <span style={{
                  fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', flexShrink: 0,
                  background: selectedRound === 'L1' ? 'var(--badge-l1-bg)' : 'var(--badge-l2-bg)',
                  color: selectedRound === 'L1' ? 'var(--badge-l1-text)' : 'var(--badge-l2-text)',
                  border: selectedRound === 'L1' ? '1px solid var(--badge-l1-border)' : '1px solid var(--badge-l2-border)',
                }}>
                  {selectedRound}
                </span>
              )}
            </div>
            {selected && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: STATUS_META[selectedStatus].color }}>
                <StatusIcon size={10} />
                <span style={{ fontSize: '0.68rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedPosition} · {STATUS_META[selectedStatus].label}
                </span>
              </div>
            )}
          </div>
          <span className="text-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', fontWeight: 600, marginLeft: '0.25rem', flexShrink: 0 }}>
            <span>Switch</span>
            <ChevronDown size={13} />
          </span>
        </button>
      )}

      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="left" className="flex flex-col">
          <SheetHeader>
            <SheetTitle>Select a candidate</SheetTitle>
          </SheetHeader>
          <div style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', flex: 1 }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="form-input"
                style={{ paddingLeft: '2rem' }}
                placeholder="Search candidates…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            <CandidateRail
              interviews={filtered}
              statuses={statuses}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </div>
        </SheetContent>
      </Sheet>

      {selected ? (
        <RecalibrateWorkspace
          key={selected.interviewId}
          interviewId={selected.interviewId}
          candidateName={selected.candidateName}
          positionTitle={selected.role.replace(/^(L1|L2)\s*-\s*/i, '').replace(/^LATERAL - /i, '')}
          panelistName={panelistName}
          round={selectedRound}
          onStatusChange={(status) => setStatuses((prev) => ({ ...prev, [selected.interviewId]: status }))}
        />
      ) : (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <span className="text-muted text-sm">Select a candidate from the list to begin.</span>
        </div>
      )}
    </div>
  );
}
