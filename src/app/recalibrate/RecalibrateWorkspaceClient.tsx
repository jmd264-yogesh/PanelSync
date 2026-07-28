'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Gauge } from 'lucide-react';
import type { PanelistInterview } from '@/lib/db';
import CandidateOverview from './components/CandidateOverview';
import { CandidateStatus, deriveRound, positionLabel } from './components/CandidateGrid';
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
  const [statuses, setStatuses] = useState<Record<string, CandidateStatus>>({});

  // No `?interview=` means "show the overview" — selecting a candidate is a deliberate
  // step, not an automatic default, so panelists always land on their full candidate list
  // (with the L1/L2 breakdown) first.
  const urlInterviewId = searchParams.get('interview');
  const [selectedId, setSelectedId] = useState<string | null>(urlInterviewId);

  // Lightweight parallel status fetch so the overview can show Not started / In progress /
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

  const selected = initialInterviews.find((i) => i.interviewId === selectedId) || null;
  const selectedRound = selected ? deriveRound(selected.role) : null;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    router.replace(`/recalibrate?interview=${id}`, { scroll: false });
  };

  const handleBack = () => {
    setSelectedId(null);
    router.replace('/recalibrate', { scroll: false });
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

  if (!selected) {
    return (
      <CandidateOverview
        interviews={initialInterviews}
        statuses={statuses}
        onSelect={handleSelect}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <button
        type="button"
        onClick={handleBack}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem', alignSelf: 'flex-start',
          border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
          color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--rc-brand, #7c3aed)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        <ArrowLeft size={14} />
        <span>All candidates</span>
      </button>

      <RecalibrateWorkspace
        key={selected.interviewId}
        interviewId={selected.interviewId}
        candidateName={selected.candidateName}
        positionTitle={positionLabel(selected.role)}
        panelistName={panelistName}
        round={selectedRound}
        onStatusChange={(status) => setStatuses((prev) => ({ ...prev, [selected.interviewId]: status }))}
      />
    </div>
  );
}
