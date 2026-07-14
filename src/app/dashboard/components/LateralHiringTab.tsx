'use client';

import React, { useState, useEffect } from 'react';
import { Briefcase, Plus, Loader2, Trash2, X, CalendarPlus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { LateralCandidate, Interview, Panelist } from '@/lib/db';
import { GraphUser } from '@/lib/graph';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ROLE_GRADES } from '@/lib/ai/spec-catalog';

interface LateralHiringTabProps {
  candidates: LateralCandidate[];
  setCandidates: React.Dispatch<React.SetStateAction<LateralCandidate[]>>;
  interviews: Interview[];
  setInterviews: React.Dispatch<React.SetStateAction<Interview[]>>;
  panelists: Panelist[];
  todayStr: string;
}

const STATUS_OPTIONS: LateralCandidate['status'][] = ['NEW', 'SCREENING', 'INTERVIEWING', 'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN'];

const STATUS_BADGE_STYLE: Record<LateralCandidate['status'], { bg: string; border: string; color: string }> = {
  NEW: { bg: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.25)', color: '#94a3b8' },
  SCREENING: { bg: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#3b82f6' },
  INTERVIEWING: { bg: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b' },
  OFFERED: { bg: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', color: '#8b5cf6' },
  HIRED: { bg: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' },
  REJECTED: { bg: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' },
  WITHDRAWN: { bg: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.25)', color: '#6b7280' },
};

export default function LateralHiringTab({ candidates, setCandidates, interviews, setInterviews, panelists, todayStr }: LateralHiringTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', positionTitle: '', experienceYears: '',
    currentCompany: '', currentCtc: '', expectedCtc: '', noticePeriodDays: '', source: '', roleGrade: '',
  });

  const [uploadingResumeId, setUploadingResumeId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // ── Schedule Interview modal state ──────────────────────────────────────
  const [schedulingFor, setSchedulingFor] = useState<LateralCandidate | null>(null);
  const [roundLabel, setRoundLabel] = useState('Round 1');
  const [duration, setDuration] = useState('45');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPanels, setSelectedPanels] = useState<GraphUser[]>([]);
  const [panelSearchQuery, setPanelSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GraphUser[]>([]);
  const [isSearchingPanels, setIsSearchingPanels] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  useEffect(() => {
    if (panelSearchQuery.trim().length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setIsSearchingPanels(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(panelSearchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.filter((u: GraphUser) => !selectedPanels.some((sp) => sp.id === u.id)));
        }
      } catch (err) {
        console.error('Error searching panels:', err);
      } finally {
        setIsSearchingPanels(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [panelSearchQuery, selectedPanels]);

  const resetAddForm = () => {
    setForm({ name: '', email: '', phone: '', positionTitle: '', experienceYears: '', currentCompany: '', currentCtc: '', expectedCtc: '', noticePeriodDays: '', source: '', roleGrade: '' });
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!form.name.trim()) { setAddError('Candidate name is required.'); return; }
    if (!form.email.trim()) { setAddError('Candidate email is required.'); return; }
    if (!form.positionTitle.trim()) { setAddError('Position title is required.'); return; }

    setIsAdding(true);
    try {
      const res = await fetch('/api/lateral-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to add candidate.');
      setCandidates(result.candidates);
      resetAddForm();
      setShowAddForm(false);
      toast.success('Lateral candidate added.');
    } catch (err: any) {
      setAddError(err.message || 'Failed to add candidate.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteCandidate = async (id: string) => {
    try {
      const res = await fetch(`/api/lateral-candidates/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to remove candidate.');
      setCandidates(result.candidates);
      toast.success('Candidate removed.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove candidate.');
    }
  };

  const handleStatusChange = async (id: string, status: LateralCandidate['status']) => {
    setUpdatingStatusId(id);
    try {
      const res = await fetch(`/api/lateral-candidates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to update status.');
      setCandidates(result.candidates);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleResumeUpload = async (candidateId: string, file: File) => {
    setUploadingResumeId(candidateId);
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const res = await fetch(`/api/lateral-candidates/${candidateId}/resume`, { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to upload resume.');
      setCandidates(result.candidates);
      toast.success('Resume attached.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload resume.');
    } finally {
      setUploadingResumeId(null);
    }
  };

  const openScheduleModal = (candidate: LateralCandidate) => {
    setSchedulingFor(candidate);
    setRoundLabel('Round 1');
    setDuration('45');
    setStartDate(todayStr);
    setEndDate(todayStr);
    setSelectedPanels([]);
    setPanelSearchQuery('');
    setScheduleError(null);
  };

  const handleScheduleInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedulingFor) return;
    setScheduleError(null);
    if (!roundLabel.trim()) { setScheduleError('Please name this round (e.g. "Technical Round 1").'); return; }
    if (!startDate) { setScheduleError('Please select a proposed range start date.'); return; }
    if (!endDate) { setScheduleError('Please select a proposed range end date.'); return; }
    if (startDate < todayStr) { setScheduleError('Start date cannot be in the past.'); return; }
    if (endDate < startDate) { setScheduleError('End date cannot be before the start date.'); return; }
    if (selectedPanels.length === 0) { setScheduleError('Please select at least one panel member.'); return; }

    setIsScheduling(true);
    try {
      const res = await fetch('/api/interviews/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateName: schedulingFor.name,
          candidateEmail: schedulingFor.email,
          role: `LATERAL - ${roundLabel.trim()} - ${schedulingFor.positionTitle}`,
          duration: parseInt(duration, 10),
          startDate,
          endDate,
          panels: selectedPanels,
          lateralCandidateId: schedulingFor.id,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to schedule interview.');
      setInterviews((prev) => [result.interview, ...prev]);
      setCandidates((prev) => prev.map((c) => c.id === schedulingFor.id ? { ...c, mappedInterviewId: result.interview.id, status: (c.status === 'NEW' || c.status === 'SCREENING') ? 'INTERVIEWING' : c.status } : c));
      toast.success('Interview panel requested.');
      setSchedulingFor(null);
    } catch (err: any) {
      setScheduleError(err.message || 'Failed to schedule interview.');
    } finally {
      setIsScheduling(false);
    }
  };

  const getCandidateInterviews = (email: string) =>
    interviews.filter((i) => i.candidateEmail.toLowerCase() === email.toLowerCase());

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Briefcase size={20} className="text-primary" />
            Lateral Hiring
          </h1>
          <p className="text-muted text-sm">Experienced candidates hired directly against open positions — separate from campus drives.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddForm((v) => !v)}>
          <Plus size={15} style={{ marginRight: '0.35rem' }} />
          Add Candidate
        </button>
      </div>

      {showAddForm && (
        <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <form onSubmit={handleAddCandidate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem' }}>
              <input className="form-input" placeholder="Full name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <input className="form-input" placeholder="Email *" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              <input className="form-input" placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              <input className="form-input" placeholder="Position title *" value={form.positionTitle} onChange={(e) => setForm((f) => ({ ...f, positionTitle: e.target.value }))} />
              <input className="form-input" placeholder="Experience (years)" type="number" min="0" value={form.experienceYears} onChange={(e) => setForm((f) => ({ ...f, experienceYears: e.target.value }))} />
              <input className="form-input" placeholder="Current company" value={form.currentCompany} onChange={(e) => setForm((f) => ({ ...f, currentCompany: e.target.value }))} />
              <input className="form-input" placeholder="Current CTC" value={form.currentCtc} onChange={(e) => setForm((f) => ({ ...f, currentCtc: e.target.value }))} />
              <input className="form-input" placeholder="Expected CTC" value={form.expectedCtc} onChange={(e) => setForm((f) => ({ ...f, expectedCtc: e.target.value }))} />
              <input className="form-input" placeholder="Notice period (days)" type="number" min="0" value={form.noticePeriodDays} onChange={(e) => setForm((f) => ({ ...f, noticePeriodDays: e.target.value }))} />
              <input className="form-input" placeholder="Source (Referral, LinkedIn, ...)" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
              <select className="form-input" value={form.roleGrade} onChange={(e) => setForm((f) => ({ ...f, roleGrade: e.target.value }))}>
                <option value="">Role grade (for Recalibrate)…</option>
                {Object.entries(ROLE_GRADES).map(([key, r]) => (
                  <option key={key} value={key}>{r.label}</option>
                ))}
              </select>
            </div>
            {addError && <div style={{ color: '#ef4444', fontSize: '0.8rem' }}>{addError}</div>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={isAdding}>
                {isAdding ? <Loader2 size={14} className="animate-spin" /> : 'Add Candidate'}
              </button>
              <button type="button" className="btn" onClick={() => { setShowAddForm(false); setAddError(null); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {candidates.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <span className="text-muted text-sm">No lateral candidates yet. Click "Add Candidate" to start tracking one.</span>
        </div>
      ) : (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Position</th>
                <th>Grade</th>
                <th>Experience</th>
                <th>Current Company</th>
                <th>Notice</th>
                <th>Source</th>
                <th>Status</th>
                <th>Interviews</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => {
                const candidateInterviews = getCandidateInterviews(candidate.email);
                const statusStyle = STATUS_BADGE_STYLE[candidate.status] ?? STATUS_BADGE_STYLE.NEW;
                return (
                  <tr key={candidate.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{candidate.name}</div>
                      <div className="text-muted text-xs">{candidate.email}</div>
                    </td>
                    <td>{candidate.positionTitle}</td>
                    <td>
                      {candidate.roleGrade && ROLE_GRADES[candidate.roleGrade as keyof typeof ROLE_GRADES]
                        ? <span className="badge">{ROLE_GRADES[candidate.roleGrade as keyof typeof ROLE_GRADES].label}</span>
                        : <span className="text-muted text-xs">—</span>}
                    </td>
                    <td>{candidate.experienceYears !== undefined ? `${candidate.experienceYears} yrs` : '—'}</td>
                    <td>{candidate.currentCompany || '—'}</td>
                    <td>{candidate.noticePeriodDays !== undefined ? `${candidate.noticePeriodDays}d` : '—'}</td>
                    <td>{candidate.source || '—'}</td>
                    <td>
                      <select
                        className="form-input"
                        style={{ padding: '0.25rem 0.5rem', height: '30px', fontSize: '0.75rem', background: statusStyle.bg, border: statusStyle.border, color: statusStyle.color, fontWeight: 600 }}
                        value={candidate.status}
                        disabled={updatingStatusId === candidate.id}
                        onChange={(e) => handleStatusChange(candidate.id, e.target.value as LateralCandidate['status'])}
                      >
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      {candidateInterviews.length === 0 ? (
                        <span className="text-muted text-xs">—</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {candidateInterviews.map((intv) => (
                            <span key={intv.id} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {intv.role.replace(/^LATERAL - /, '')} <span className="badge" style={{ fontSize: '0.6rem', marginLeft: '4px' }}>{intv.status}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          style={{ display: 'none' }}
                          id={`lateral-resume-input-${candidate.id}`}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleResumeUpload(candidate.id, file);
                            e.target.value = '';
                          }}
                        />
                        <button
                          onClick={() => document.getElementById(`lateral-resume-input-${candidate.id}`)?.click()}
                          disabled={uploadingResumeId === candidate.id}
                          className="row-action-button"
                          style={{
                            height: '28px',
                            background: candidate.resumeFileKey ? 'rgba(16,185,129,0.06)' : undefined,
                            border: candidate.resumeFileKey ? '1px solid rgba(16,185,129,0.2)' : undefined,
                            color: candidate.resumeFileKey ? 'var(--success)' : undefined,
                          }}
                          title={candidate.resumeFileKey ? 'Replace attached resume' : 'Attach resume'}
                        >
                          {uploadingResumeId === candidate.id ? <Loader2 size={10} className="animate-spin" /> : candidate.resumeFileKey ? 'Resume ✓' : 'Attach Resume'}
                        </button>
                        <button
                          onClick={() => openScheduleModal(candidate)}
                          className="row-action-button"
                          style={{ height: '28px', background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="Schedule an interview round"
                        >
                          <CalendarPlus size={11} />
                          Schedule
                        </button>
                        <ConfirmDialog
                          trigger={
                            <button
                              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem', display: 'flex', alignItems: 'center' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={(e) => e.currentTarget.style.color = ''}
                              title="Remove candidate"
                            />
                          }
                          triggerChildren={<Trash2 size={15} />}
                          title="Remove this lateral candidate?"
                          description="This will remove the candidate from the lateral hiring queue. This action cannot be undone."
                          confirmLabel="Yes, Remove"
                          onConfirm={() => handleDeleteCandidate(candidate.id)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {schedulingFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="glass-card" style={{ padding: '1.5rem', width: '480px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Schedule Interview — {schedulingFor.name}</h3>
              <button onClick={() => setSchedulingFor(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleScheduleInterview} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input className="form-input" placeholder="Round name (e.g. Technical Round 1)" value={roundLabel} onChange={(e) => setRoundLabel(e.target.value)} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <input className="form-input" type="number" min="15" placeholder="Duration (min)" value={duration} onChange={(e) => setDuration(e.target.value)} />
                <input className="form-input" type="date" value={startDate} min={todayStr} onChange={(e) => setStartDate(e.target.value)} />
                <input className="form-input" type="date" value={endDate} min={startDate || todayStr} onChange={(e) => setEndDate(e.target.value)} />
              </div>

              <div style={{ position: 'relative' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    className="form-input"
                    style={{ paddingLeft: '2rem' }}
                    placeholder="Search panelists by name or email..."
                    value={panelSearchQuery}
                    onChange={(e) => setPanelSearchQuery(e.target.value)}
                  />
                </div>
                {isSearchingPanels && <div className="text-xs text-muted" style={{ marginTop: '0.3rem' }}>Searching...</div>}
                {searchResults.length > 0 && (
                  <div className="glass-card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: '0.25rem', maxHeight: '160px', overflowY: 'auto' }}>
                    {searchResults.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => { setSelectedPanels((prev) => [...prev, u]); setPanelSearchQuery(''); setSearchResults([]); }}
                        style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover, rgba(255,255,255,0.05))'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ fontWeight: 600 }}>{u.displayName}</div>
                        <div className="text-muted text-xs">{u.mail || u.userPrincipalName}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedPanels.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {selectedPanels.map((p) => (
                    <span key={p.id} className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      {p.displayName}
                      <button
                        type="button"
                        onClick={() => setSelectedPanels((prev) => prev.filter((sp) => sp.id !== p.id))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {panelists.length > 0 && (
                <div>
                  <div className="text-xs text-muted" style={{ marginBottom: '0.3rem' }}>Or pick from the registered panelist directory:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {panelists.map((p) => {
                      const isChosen = selectedPanels.some((sp) => sp.id === p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            if (isChosen) setSelectedPanels((prev) => prev.filter((sp) => sp.id !== p.id));
                            else setSelectedPanels((prev) => [...prev, { id: p.id, displayName: p.displayName, mail: p.email, userPrincipalName: p.email }]);
                          }}
                          className="badge"
                          style={{
                            cursor: 'pointer',
                            background: isChosen ? 'var(--primary-glow)' : undefined,
                            border: isChosen ? '1px solid var(--primary)' : undefined,
                            color: isChosen ? 'var(--primary)' : undefined,
                          }}
                        >
                          {p.displayName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {scheduleError && <div style={{ color: '#ef4444', fontSize: '0.8rem' }}>{scheduleError}</div>}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={isScheduling}>
                  {isScheduling ? <Loader2 size={14} className="animate-spin" /> : 'Send Panel Request'}
                </button>
                <button type="button" className="btn" onClick={() => setSchedulingFor(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
