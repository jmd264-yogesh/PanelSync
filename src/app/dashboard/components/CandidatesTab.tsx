'use client';

import React, { useState, useEffect } from 'react';
import {
  Users, Plus, Search, Loader2, Trash2, Building2, CheckCircle
} from 'lucide-react';
import { UploadedCandidate, Interview, College, Drive } from '@/lib/db';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CandidatesTabProps {
  candidates: UploadedCandidate[];
  setCandidates: React.Dispatch<React.SetStateAction<UploadedCandidate[]>>;
  fetchCandidates: () => Promise<void>;
  interviews: Interview[];
  setInterviews: React.Dispatch<React.SetStateAction<Interview[]>>;
  collegesList: College[];
  todayStr: string;
  activeDrive: Drive | null;
}

export default function CandidatesTab({
  candidates,
  setCandidates,
  fetchCandidates,
  interviews,
  setInterviews,
  collegesList,
  todayStr,
  activeDrive,
}: CandidatesTabProps) {
  // ── Upload States ──────────────────────────────────────────────────────────
  const [isUploadingCandidates, setIsUploadingCandidates] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const [uploadDefaultDate, setUploadDefaultDate] = useState('');
  const [uploadDefaultCollege, setUploadDefaultCollege] = useState('');

  // ── Single Candidate Form ─────────────────────────────────────────────────
  const [singleCandidateName, setSingleCandidateName] = useState('');
  const [singleCandidateEmail, setSingleCandidateEmail] = useState('');
  const [singleCandidateDate, setSingleCandidateDate] = useState('');
  const [singleCandidateCollege, setSingleCandidateCollege] = useState('');
  const [isAddingSingleCandidate, setIsAddingSingleCandidate] = useState(false);
  const [singleCandidateError, setSingleCandidateError] = useState<string | null>(null);

  // ── Inline Editing ────────────────────────────────────────────────────────
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [editCandidateName, setEditCandidateName] = useState('');
  const [editCandidateEmail, setEditCandidateEmail] = useState('');
  const [editCandidateCollege, setEditCandidateCollege] = useState('');
  const [editCandidateDate, setEditCandidateDate] = useState('');
  const [mappingCandidateId, setMappingCandidateId] = useState<string | null>(null);
  const [selectingCandidateId, setSelectingCandidateId] = useState<string | null>(null);

  // ── Queue filters ─────────────────────────────────────────────────────────
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<'all' | 'WAITING' | 'MAPPED'>('all');
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);

  // ── Load on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setIsLoadingCandidates(true);
      try {
        const res = await fetch('/api/candidates');
        if (res.ok) {
          const data = await res.json();
          setCandidates(data);
        }
      } catch (err) {
        console.error('Failed to fetch candidates:', err);
      } finally {
        setIsLoadingCandidates(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (activeDrive) {
      // Candidates carry a single preferred date; default to the drive's start date.
      setUploadDefaultDate(activeDrive.startDate);
      setUploadDefaultCollege(activeDrive.collegeName);
      setSingleCandidateDate(activeDrive.startDate);
      setSingleCandidateCollege(activeDrive.collegeName);
    }
  }, [activeDrive]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatDateParts = (year: number, month: number, day: number): string | undefined => {
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return undefined;
    }

    return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  };

  const parseExcelDate = (value: unknown): string | undefined => {
    if (value === null || value === undefined || value === '') return undefined;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return formatDateParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
    }

    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);
      return parsed ? formatDateParts(parsed.y, parsed.m, parsed.d) : undefined;
    }

    const text = String(value).trim();
    const isoMatch = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (isoMatch) {
      return formatDateParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    }

    const dayFirstMatch = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dayFirstMatch) {
      return formatDateParts(Number(dayFirstMatch[3]), Number(dayFirstMatch[2]), Number(dayFirstMatch[1]));
    }

    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
    }

    return undefined;
  };

  const normalizeHeader = (value: string) =>
    value
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ');

  const handleDownloadTemplate = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,Name,Email,College Name of Drive,Drive Date\nJohn Doe,john.doe@example.com,IIT Bombay,2026-06-15\nJane Smith,jane.smith@example.com,NIT Trichy,';
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'candidate_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCandidates(true);
    setUploadError(null);
    setUploadSuccessMessage(null);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error('Could not read file data');
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(sheet);
        if (json.length === 0) throw new Error('The spreadsheet is empty.');

        const parsedCandidates = [];
        for (let i = 0; i < json.length; i++) {
          const row = json[i];
          const keys = Object.keys(row);
          const nameKey = keys.find((k) => normalizeHeader(k) === 'name');
          const emailKey = keys.find((k) => normalizeHeader(k) === 'email');
          if (nameKey && emailKey) {
            const name = String(row[nameKey]).trim();
            const email = String(row[emailKey]).trim();
            if (name === '' || email === '') continue;

            const dateKey = keys.find((k) => {
              const val = normalizeHeader(k);
              return val === 'date' || val === 'preferred date' || val === 'interview date' || val === 'drive date' || val === 'date of drive';
            });
            const rawDate = dateKey ? row[dateKey] : undefined;
            const preferredDate = parseExcelDate(rawDate) || (uploadDefaultDate ? uploadDefaultDate : undefined);

            const collegeKey = keys.find((k) => {
              const val = normalizeHeader(k);
              return val === 'college' || val === 'institution' || val === 'university' || val === 'college name' || val === 'college name of drive';
            });
            const rawCollege = collegeKey ? String(row[collegeKey]).trim() : undefined;
            const college = rawCollege || (uploadDefaultCollege ? uploadDefaultCollege : undefined);

            if (!preferredDate) {
              throw new Error(`Row ${i + 2}: Candidate "${name}" is missing a Drive Date. Please specify a date in the sheet or set a default Drive Date above.`);
            }
            if (!college) {
              throw new Error(`Row ${i + 2}: Candidate "${name}" is missing a College Name. Please specify a college name in the sheet or select a default College Name of Drive above.`);
            }
            parsedCandidates.push({ name, email, preferredDate, college });
          }
        }
        if (parsedCandidates.length === 0) {
          throw new Error("Could not find any candidates with valid 'Name' and 'Email' columns in the uploaded file.");
        }

        const res = await fetch('/api/candidates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidates: parsedCandidates }),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to upload candidates');
        }
        const result = await res.json();
        setCandidates(result.candidates);
        setInterviews(result.interviews);
        setUploadSuccessMessage(
          `Successfully uploaded ${parsedCandidates.length} candidate(s). ${result.mappedCount} candidate(s) were automatically mapped to L1 panels.`
        );
      } catch (err: any) {
        console.error(err);
        setUploadError(err.message || 'An error occurred during file parsing or upload.');
      } finally {
        setIsUploadingCandidates(false);
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read file.');
      setIsUploadingCandidates(false);
    };
    reader.readAsBinaryString(file);
  };

  const handleAddSingleCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSingleCandidateError(null);
    if (!singleCandidateName.trim()) { setSingleCandidateError('Please enter candidate name.'); return; }
    if (!singleCandidateEmail.trim()) { setSingleCandidateError('Please enter candidate email.'); return; }
    if (!singleCandidateDate.trim()) { setSingleCandidateError('Please select a drive date.'); return; }
    if (!singleCandidateCollege.trim()) { setSingleCandidateError('Please select a college.'); return; }

    setIsAddingSingleCandidate(true);
    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates: [{
            name: singleCandidateName.trim(),
            email: singleCandidateEmail.trim(),
            preferredDate: singleCandidateDate,
            college: singleCandidateCollege,
          }]
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to add candidate');
      }
      const result = await res.json();
      setCandidates(result.candidates);
      setInterviews(result.interviews);
      setSingleCandidateName('');
      setSingleCandidateEmail('');
      setSingleCandidateDate('');
      setSingleCandidateCollege('');
      toast.success(`Candidate ${singleCandidateName} successfully added to the queue!`);
    } catch (err: any) {
      console.error(err);
      setSingleCandidateError(err.message || 'An error occurred adding candidate.');
    } finally {
      setIsAddingSingleCandidate(false);
    }
  };

  const handleSaveCandidateEdit = async (id: string) => {
    if (!editCandidateName.trim()) { toast.error('Name is required.'); return; }
    if (!editCandidateEmail.trim()) { toast.error('Email is required.'); return; }
    if (!editCandidateCollege.trim()) { toast.error('College Name of Drive is required.'); return; }
    if (!editCandidateDate.trim()) { toast.error('Drive Date is required.'); return; }
    try {
      const res = await fetch(`/api/candidates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editCandidateName.trim(),
          email: editCandidateEmail.trim(),
          college: editCandidateCollege.trim(),
          preferredDate: editCandidateDate.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update candidate details');
      }
      const result = await res.json();
      setCandidates(result.candidates);
      setEditingCandidateId(null);
      toast.success('Candidate details updated successfully.');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error updating candidate details');
    }
  };

  const handleMapCandidateToSlot = async (candidate: UploadedCandidate, interviewId: string) => {
    try {
      const res = await fetch('/api/interviews/assign-candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId,
          candidateName: candidate.name,
          candidateEmail: candidate.email,
          sendAsTeamsMeeting: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to assign candidate');
      }
      const data = await res.json();
      setInterviews(interviews.map((i) => i.id === interviewId ? data.interview : i));
      await fetchCandidates();
      toast.success(`Candidate "${candidate.name}" successfully mapped to the interview!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error occurred while mapping candidate');
    }
  };

  const handleMarkAsSelected = async (id: string) => {
    setSelectingCandidateId(id);
    try {
      const res = await fetch(`/api/candidates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcomeStatus: 'SELECTED' }),
      });
      if (!res.ok) throw new Error('Failed to mark as selected');
      const result = await res.json();
      setCandidates(result.candidates);
      toast.success('Candidate marked as Selected.');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error marking candidate as selected');
    } finally {
      setSelectingCandidateId(null);
    }
  };

  const handleDeleteCandidate = async (id: string) => {
    try {
      const res = await fetch(`/api/candidates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const result = await res.json();
        setCandidates(result.candidates);
        toast.success('Candidate removed from the queue.');
      } else {
        toast.error('Failed to delete candidate.');
      }
    } catch (err) {
      console.error('Error deleting candidate:', err);
    }
  };

  // ── Filtered List ─────────────────────────────────────────────────────────
  const filteredCandidates = candidates.filter((c) => {
    const matchesQuery =
      c.name.toLowerCase().includes(candidateSearchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(candidateSearchQuery.toLowerCase());
    const matchesStatus = candidateStatusFilter === 'all' || c.status === candidateStatusFilter;
    return matchesQuery && matchesStatus;
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="dashboard-two-column dashboard-two-column-wide" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>

        {/* Left Column: Upload area and Single Add */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* Bulk Upload Card */}
          <div className="glass-card" style={{ height: 'fit-content', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={18} className="text-primary" />
              Candidate Bulk Upload
            </h3>
            <p className="text-muted text-xs" style={{ marginBottom: '1.25rem' }}>
              Upload an Excel template or CSV containing candidate <strong>Name</strong>, <strong>Email</strong>, <strong>College Name of Drive</strong>, and <strong>Drive Date</strong> to add them to the queue.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Drive Date (Fallback Default)</label>
                <input
                  type="date"
                  className="form-input"
                  value={uploadDefaultDate}
                  onChange={(e) => setUploadDefaultDate(e.target.value)}
                  min={todayStr}
                  style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>College Name of Drive (Fallback Default)</label>
                <Select value={uploadDefaultCollege} onValueChange={(val) => setUploadDefaultCollege(val || '')}>
                  <SelectTrigger className="w-full text-left" style={{ fontSize: '0.85rem', marginTop: '0.25rem', height: '36px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit' }}>
                    <SelectValue placeholder="Select College..." />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-[#0e131f] dark:text-white border dark:border-zinc-800">
                    <SelectItem value="_none_placeholder">Select College...</SelectItem>
                    {collegesList.map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div
                style={{
                  border: '2px dashed var(--border-glass)', borderRadius: 'var(--radius-md)',
                  padding: '2.5rem 1.5rem', textAlign: 'center',
                  background: 'rgba(0, 0, 0, 0.15)', cursor: 'pointer',
                  position: 'relative', transition: 'var(--transition-fast)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelUpload}
                  disabled={isUploadingCandidates}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                />
                {isUploadingCandidates ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    <Loader2 size={32} className="animate-spin text-primary" />
                    <span className="text-xs text-muted">Parsing &amp; Uploading File...</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    <Plus size={32} className="text-muted" />
                    <span className="text-xs font-semibold text-main">Click or Drag File Here</span>
                    <span className="text-xxs text-muted">Supports XLSX, XLS, CSV</span>
                  </div>
                )}
              </div>

              <button onClick={handleDownloadTemplate} className="btn btn-secondary" style={{ width: '100%' }}>
                Download CSV Template
              </button>

              {uploadError && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', color: '#f87171', fontSize: '0.8rem' }}>
                  {uploadError}
                </div>
              )}
              {uploadSuccessMessage && (
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', color: '#34d399', fontSize: '0.8rem' }}>
                  {uploadSuccessMessage}
                </div>
              )}
            </div>
          </div>

          {/* Add Single Candidate Card */}
          <div className="glass-card" style={{ height: 'fit-content', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={18} className="text-primary" />
              Add Single Candidate
            </h3>
            <p className="text-muted text-xs" style={{ marginBottom: '1.25rem' }}>
              Manually register a single candidate to the WAITING queue.
            </p>
            <form onSubmit={handleAddSingleCandidate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Candidate Name</label>
                <input type="text" className="form-input" placeholder="John Doe" value={singleCandidateName} onChange={(e) => setSingleCandidateName(e.target.value)} required style={{ fontSize: '0.85rem', marginTop: '0.25rem' }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Candidate Email</label>
                <input type="email" className="form-input" placeholder="john.doe@example.com" value={singleCandidateEmail} onChange={(e) => setSingleCandidateEmail(e.target.value)} required style={{ fontSize: '0.85rem', marginTop: '0.25rem' }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Drive Date</label>
                <input type="date" className="form-input" value={singleCandidateDate} onChange={(e) => setSingleCandidateDate(e.target.value)} min={todayStr} required style={{ fontSize: '0.85rem', marginTop: '0.25rem' }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>College Name of Drive</label>
                <Select value={singleCandidateCollege} onValueChange={(val) => setSingleCandidateCollege(val || '')}>
                  <SelectTrigger className="w-full text-left" style={{ fontSize: '0.85rem', marginTop: '0.25rem', height: '36px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit' }}>
                    <SelectValue placeholder="Select College..." />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-[#0e131f] dark:text-white border dark:border-zinc-800">
                    <SelectItem value="_none_placeholder">Select College...</SelectItem>
                    {collegesList.map((c) => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {singleCandidateError && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', color: '#f87171', fontSize: '0.8rem' }}>
                  {singleCandidateError}
                </div>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isAddingSingleCandidate || !singleCandidateName.trim() || !singleCandidateEmail.trim()}
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                {isAddingSingleCandidate ? (
                  <><Loader2 size={16} className="animate-spin" style={{ marginRight: '8px' }} /> Adding...</>
                ) : (
                  'Add Candidate'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Queue Listing */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem', fontFamily: 'var(--font-heading)' }}>
                Authorized Candidate Queue
              </h3>
              <p className="text-muted text-xs">
                List of candidates uploaded and waiting for/mapped to L1 interviews.
              </p>
            </div>
            <div className="flex-gap-2">
              <div style={{ position: 'relative', width: '180px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search candidate..."
                  className="form-input"
                  value={candidateSearchQuery}
                  onChange={(e) => setCandidateSearchQuery(e.target.value)}
                  style={{ paddingLeft: '28px', fontSize: '0.75rem', height: '32px', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
              <Select value={candidateStatusFilter} onValueChange={(val) => setCandidateStatusFilter(val as any)}>
                <SelectTrigger className="text-left" style={{ fontSize: '0.75rem', height: '32px', width: '120px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', color: 'inherit' }}>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="dark:bg-[#0e131f] dark:text-white border dark:border-zinc-800">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="WAITING">Waiting</SelectItem>
                  <SelectItem value="MAPPED">Mapped</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoadingCandidates ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Name</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Email</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>College</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Drive Date</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Uploaded At</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Queue Status</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Outcome</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>Mapped Interview</th>
                    <th style={{ padding: '0.75rem 1rem', width: '220px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((candidate) => {
                    const mappedIntv = candidate.mappedInterviewId
                      ? interviews.find((i) => i.id === candidate.mappedInterviewId)
                      : null;
                    return (
                      <tr key={candidate.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }} className="search-item-hover">
                        {editingCandidateId === candidate.id ? (
                          <>
                            <td style={{ padding: '0.5rem 1rem' }}>
                              <input
                                type="text"
                                className="form-input text-xs"
                                style={{ padding: '0.2rem 0.4rem', height: '28px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', color: 'var(--text-main)', fontSize: '0.8rem', width: '120px' }}
                                value={editCandidateName}
                                onChange={(e) => setEditCandidateName(e.target.value)}
                                required
                              />
                            </td>
                            <td style={{ padding: '0.5rem 1rem' }}>
                              <input
                                type="email"
                                className="form-input text-xs"
                                style={{ padding: '0.2rem 0.4rem', height: '28px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', color: 'var(--text-main)', fontSize: '0.8rem', width: '150px' }}
                                value={editCandidateEmail}
                                onChange={(e) => setEditCandidateEmail(e.target.value)}
                                required
                              />
                            </td>
                            <td style={{ padding: '0.5rem 1rem' }}>
                              <Select value={editCandidateCollege} onValueChange={(val) => setEditCandidateCollege(val || '')}>
                                <SelectTrigger className="text-left" style={{ padding: '0.2rem 0.4rem', height: '28px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', color: 'var(--text-main)', fontSize: '0.8rem', width: '130px' }}>
                                  <SelectValue placeholder="Select College..." />
                                </SelectTrigger>
                                <SelectContent className="dark:bg-[#0e131f] dark:text-white border dark:border-zinc-800">
                                  <SelectItem value="_none_placeholder">Select College...</SelectItem>
                                  {collegesList.map((c) => (
                                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td style={{ padding: '0.5rem 1rem' }}>
                              <input
                                type="date"
                                className="form-input text-xs"
                                style={{ padding: '0.2rem 0.4rem', height: '28px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', color: 'var(--text-main)', fontSize: '0.8rem', width: '120px' }}
                                value={editCandidateDate}
                                onChange={(e) => setEditCandidateDate(e.target.value)}
                                min={todayStr}
                                required
                              />
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: '1rem', color: 'var(--text-main)', fontWeight: 600 }}>{candidate.name}</td>
                            <td style={{ padding: '1rem', color: 'var(--text-main)' }}>{candidate.email}</td>
                            <td style={{ padding: '1rem', color: 'var(--text-main)' }}>
                              {candidate.college ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem', color: '#fb923c' }}>
                                  <Building2 size={12} /> {candidate.college}
                                </span>
                              ) : (
                                <span className="text-muted font-italic" style={{ fontSize: '0.8rem' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '1rem' }}>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                                {candidate.preferredDate ? new Date(candidate.preferredDate).toLocaleDateString() : '—'}
                              </span>
                            </td>
                          </>
                        )}
                        <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {new Date(candidate.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {candidate.status === 'WAITING' ? (
                            <span className="badge badge-pending">Waiting</span>
                          ) : (
                            <span className="badge badge-success">Mapped</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {(() => {
                            const os = (candidate as any).outcomeStatus;
                            if (!os || os === 'PENDING') return <span className="badge badge-pending" style={{ fontSize: '0.62rem' }}>Pending</span>;
                            if (os === 'PASSED_L1') return <span className="badge badge-info" style={{ fontSize: '0.62rem' }}>Passed L1</span>;
                            if (os === 'PASSED_L2') return <span className="badge badge-info" style={{ fontSize: '0.62rem', background: 'rgba(124,58,237,0.12)', borderColor: 'rgba(124,58,237,0.3)', color: '#a78bfa' }}>Passed L2</span>;
                            if (os === 'SELECTED') return <span className="badge badge-success" style={{ fontSize: '0.62rem' }}>Selected</span>;
                            if (os === 'REJECTED') return <span className="badge badge-danger" style={{ fontSize: '0.62rem' }}>Rejected</span>;
                            return <span className="badge" style={{ fontSize: '0.62rem' }}>{os}</span>;
                          })()}
                        </td>
                        <td style={{ padding: '1rem', fontSize: '0.8rem' }}>
                          {mappedIntv ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontWeight: 600 }}>{mappedIntv.role}</span>
                              <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                                {mappedIntv.scheduledSlotStart
                                  ? new Date(mappedIntv.scheduledSlotStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                                  : 'Pending Slot'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted font-italic">—</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                            {editingCandidateId === candidate.id ? (
                              <>
                                <button onClick={() => handleSaveCandidateEdit(candidate.id)} className="btn btn-primary btn-sm animate-pulse-once" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', height: 'auto', whiteSpace: 'nowrap' }}>
                                  Save
                                </button>
                                <button onClick={() => setEditingCandidateId(null)} className="btn btn-secondary btn-sm" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', height: 'auto', whiteSpace: 'nowrap' }}>
                                  Cancel
                                </button>
                              </>
                            ) : mappingCandidateId === candidate.id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Select onValueChange={async (val: any) => {
                                  if (val && val !== '_none_placeholder') {
                                    await handleMapCandidateToSlot(candidate, val);
                                    setMappingCandidateId(null);
                                  }
                                }}>
                                  <SelectTrigger className="text-left" style={{ padding: '0.2rem 0.4rem', height: '28px', fontSize: '0.75rem', width: '180px', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid var(--border-glass)', color: 'var(--text-main)', borderRadius: 'var(--radius-sm)' }}>
                                    <SelectValue placeholder="Select Available Slot..." />
                                  </SelectTrigger>
                                  <SelectContent className="dark:bg-[#0e131f] dark:text-white border dark:border-zinc-800">
                                    <SelectItem value="_none_placeholder">Select Available Slot...</SelectItem>
                                    {interviews
                                      .filter((i) => i.candidateName === 'Pending Assignment' && (i.status === 'COLLECTED' || i.status === 'SCHEDULED' || i.status === 'PENDING'))
                                      .map((i) => (
                                        <SelectItem key={i.id} value={i.id}>
                                          {i.role} ({new Date(i.scheduledSlotStart || i.startDate).toLocaleDateString()} - {i.panels.map(p => p.name).join(', ')})
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                                <button onClick={() => setMappingCandidateId(null)} className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.4rem', fontSize: '0.68rem', height: '28px', whiteSpace: 'nowrap' }}>
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                {candidate.status === 'WAITING' && (
                                  <button
                                    onClick={() => { setMappingCandidateId(candidate.id); setEditingCandidateId(null); }}
                                    className="btn btn-sm"
                                    style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', height: 'auto', whiteSpace: 'nowrap' }}
                                    title="Map to an available interview slot"
                                  >
                                    Map to Slot
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    setEditingCandidateId(candidate.id);
                                    setMappingCandidateId(null);
                                    setEditCandidateName(candidate.name);
                                    setEditCandidateEmail(candidate.email);
                                    setEditCandidateCollege(candidate.college || '');
                                    setEditCandidateDate(candidate.preferredDate || '');
                                  }}
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', height: 'auto', whiteSpace: 'nowrap' }}
                                  title="Edit candidate details"
                                >
                                  Edit
                                </button>
                                {(candidate as any).outcomeStatus === 'PASSED_L2' && (
                                  <ConfirmDialog
                                    trigger={
                                      <button
                                        disabled={selectingCandidateId === candidate.id}
                                        className="btn btn-sm"
                                        style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', height: 'auto', whiteSpace: 'nowrap' }}
                                        title="Mark as Selected (final outcome)"
                                      />
                                    }
                                    triggerChildren={
                                      <>
                                        {selectingCandidateId === candidate.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                                        Select
                                      </>
                                    }
                                    title="Mark candidate as Selected?"
                                    description="This is the final outcome and cannot be changed by panelists."
                                    confirmLabel="Yes, Select"
                                    destructive={false}
                                    onConfirm={() => handleMarkAsSelected(candidate.id)}
                                  />
                                )}
                                <ConfirmDialog
                                  trigger={
                                    <button
                                      disabled={candidate.status === 'MAPPED'}
                                      style={{
                                        border: 'none', background: 'transparent',
                                        cursor: candidate.status === 'MAPPED' ? 'not-allowed' : 'pointer',
                                        color: candidate.status === 'MAPPED' ? 'rgba(255,255,255,0.02)' : 'var(--text-muted)',
                                        padding: '0.2rem'
                                      }}
                                      onMouseEnter={(e) => { if (candidate.status !== 'MAPPED') e.currentTarget.style.color = '#ef4444'; }}
                                      onMouseLeave={(e) => { if (candidate.status !== 'MAPPED') e.currentTarget.style.color = ''; }}
                                      title={candidate.status === 'MAPPED' ? 'Cannot delete mapped candidate' : 'Remove candidate'}
                                    />
                                  }
                                  triggerChildren={<Trash2 size={15} />}
                                  title="Remove this candidate?"
                                  description="This will remove the candidate from the queue. This action cannot be undone."
                                  confirmLabel="Yes, Remove"
                                  onConfirm={() => handleDeleteCandidate(candidate.id)}
                                />
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {candidates.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        No candidates registered in the queue. Download the template on the left and upload candidates.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
