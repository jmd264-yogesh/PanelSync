'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Gauge, Search } from 'lucide-react';
import type { PanelistInterview } from '@/lib/db';
import CandidateRail, { CandidateStatus } from './components/CandidateRail';
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

  const urlInterviewId = searchParams.get('interview');
  const [selectedId, setSelectedId] = useState<string | null>(urlInterviewId || initialInterviews[0]?.interviewId || null);

  // Lightweight parallel status fetch so the rail can show Not started / In progress /
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

  const handleSelect = (id: string) => {
    setSelectedId(id);
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
          Once a recruiter schedules a lateral hiring interview with you as panelist, it'll show up here for live scoring.
        </p>
      </div>
    );
  }

  return (
    <div className="rc-client-grid" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
      <style>{`
        @media (max-width: 800px) {
          .rc-client-grid { flex-direction: column; }
          .rc-client-grid .rc-rail { width: 100% !important; }
        }
      `}</style>
      <div className="rc-rail" style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: '2rem' }}
            placeholder="Search candidates…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <CandidateRail
          interviews={filtered}
          statuses={statuses}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {selected ? (
          <RecalibrateWorkspace
            key={selected.interviewId}
            interviewId={selected.interviewId}
            candidateName={selected.candidateName}
            positionTitle={selected.role.replace(/^LATERAL - /i, '')}
            panelistName={panelistName}
            onStatusChange={(status) => setStatuses((prev) => ({ ...prev, [selected.interviewId]: status }))}
          />
        ) : (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
            <span className="text-muted text-sm">Select a candidate from the left to begin.</span>
          </div>
        )}
      </div>
    </div>
  );
}
