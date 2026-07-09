'use client';

import React, { useState, useEffect } from 'react';
import {
  Users, Plus, Search, Loader2, Trash2, Building2, CheckCircle, X, MessageSquare
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

// Helper to compute L1 & L2 round results for a candidate
function getCandidateRoundResults(candidate: UploadedCandidate, interviewsList: Interview[]) {
  const candidateInterviews = interviewsList.filter(
    (i) => i.candidateEmail.toLowerCase() === candidate.email.toLowerCase()
  );

  const l1Interviews = candidateInterviews.filter((i) =>
    i.role.toLowerCase().includes('l1')
  );
  const l2Interviews = candidateInterviews.filter((i) =>
    i.role.toLowerCase().includes('l2')
  );

  const getRoundStatus = (roundInterviews: Interview[], roundName: 'L1' | 'L2') => {
    if (roundInterviews.length === 0) {
      const os = candidate.outcomeStatus;
      if (roundName === 'L1') {
        if (os === 'PASSED_L1' || os === 'PASSED_L2' || os === 'SELECTED') {
          return 'Passed';
        }
        if (os === 'REJECTED') {
          return 'Rejected';
        }
        return 'Not Started';
      } else {
        if (os === 'PASSED_L2' || os === 'SELECTED') {
          return 'Passed';
        }
        if (os === 'REJECTED' && candidate.outcomeStatus === 'PASSED_L1') {
          return 'Rejected';
        }
        return 'Not Started';
      }
    }

    const latestInterview = [...roundInterviews].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    if (latestInterview.status === 'CANCELLED') {
      return 'Cancelled';
    }

    const panels = latestInterview.panels || [];
    const submittedPanels = panels.filter((p) => p.status === 'SUBMITTED');

    if (submittedPanels.length > 0) {
      const hasRejected = submittedPanels.some((p) => p.decision === 'REJECTED');
      if (hasRejected) {
        return 'Rejected';
      }
      const hasPassed = submittedPanels.some((p) => p.decision === 'PASSED');
      if (hasPassed) {
        return 'Passed';
      }
    }

    if (latestInterview.status === 'SCHEDULED') {
      return 'Pending Feedback';
    }

    return 'Scheduled';
  };

  let l1Result = getRoundStatus(l1Interviews, 'L1');
  let l2Result = getRoundStatus(l2Interviews, 'L2');

  const os = candidate.outcomeStatus;
  if (os === 'PASSED_L1') {
    l1Result = 'Passed';
  } else if (os === 'PASSED_L2' || os === 'SELECTED') {
    l1Result = 'Passed';
    l2Result = 'Passed';
  } else if (os === 'REJECTED') {
    const hasL2Rejected = l2Interviews.some((i) => i.panels.some((p) => p.decision === 'REJECTED'));
    const hasL1Rejected = l1Interviews.some((i) => i.panels.some((p) => p.decision === 'REJECTED'));

    if (hasL2Rejected) {
      l1Result = 'Passed';
      l2Result = 'Rejected';
    } else if (hasL1Rejected) {
      l1Result = 'Rejected';
      l2Result = 'Not Started';
    } else {
      if (l2Interviews.length > 0) {
        l1Result = 'Passed';
        l2Result = 'Rejected';
      } else {
        l1Result = 'Rejected';
        l2Result = 'Not Started';
      }
    }
  }

  return { l1Result, l2Result };
}

function parseFeedbackSafely(rawFeedback: string | null | undefined) {
  if (!rawFeedback) return null;
  if (rawFeedback.trim().startsWith('{')) {
    try {
      return JSON.parse(rawFeedback);
    } catch (e) {
      return null;
    }
  }
  return null;
}

function renderStarsStatic(rating: number) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} style={{ color: star <= rating ? '#fbbf24' : 'rgba(255,255,255,0.12)', fontSize: '1rem', lineHeight: 1 }}>★</span>
      ))}
    </div>
  );
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
  const [singleCandidateCollegeDrive, setSingleCandidateCollegeDrive] = useState('');
  const [isAddingSingleCandidate, setIsAddingSingleCandidate] = useState(false);
  const [singleCandidateError, setSingleCandidateError] = useState<string | null>(null);

  // ── Inline Editing ────────────────────────────────────────────────────────
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [editCandidateName, setEditCandidateName] = useState('');
  const [editCandidateEmail, setEditCandidateEmail] = useState('');
  const [editCandidateCollege, setEditCandidateCollege] = useState('');
  const [editCandidateCollegeDrive, setEditCandidateCollegeDrive] = useState('');
  const [editCandidateDate, setEditCandidateDate] = useState('');
  const [mappingCandidateId, setMappingCandidateId] = useState<string | null>(null);
  const [selectingCandidateId, setSelectingCandidateId] = useState<string | null>(null);
  const [unmappingCandidateId, setUnmappingCandidateId] = useState<string | null>(null);
  const [uploadingResumeId, setUploadingResumeId] = useState<string | null>(null);

  // ── Queue filters ─────────────────────────────────────────────────────────
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('');
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<'all' | 'WAITING' | 'MAPPED'>('all');
  const [candidateCollegeFilter, setCandidateCollegeFilter] = useState<string>('all');
  const [candidateDateFilter, setCandidateDateFilter] = useState<string>('all');
  const [scopeToActiveDrive, setScopeToActiveDrive] = useState<boolean>(!!activeDrive);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [selectedFeedbackCandidate, setSelectedFeedbackCandidate] = useState<UploadedCandidate | null>(null);

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
      setSingleCandidateCollegeDrive(activeDrive.collegeName);
      setScopeToActiveDrive(true);
    } else {
      setScopeToActiveDrive(false);
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
    const isoMatch = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (isoMatch) {
      return formatDateParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    }

    // Sheets are authored day-first (DD/MM/YYYY). Match on the leading triplet only
    // (no trailing `$` anchor) so a trailing time component doesn't fall through to
    // the native Date parser below, which assumes the US MM/DD/YYYY convention.
    const dayFirstMatch = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
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
      .replace(/\([^)]*\)/g, '') // strip a trailing format hint, e.g. "Drive Date (YYYY-MM-DD)"
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const handleDownloadTemplate = () => {
    const headers = ['Name', 'Email', 'College Name of Candidate', 'College Name of Drive', 'Drive Date (YYYY-MM-DD)', 'Resume Link'];
    const rows = [
      ['John Doe', 'john.doe@example.com', 'IIT Madras', 'IIT Bombay', '2026-06-15', 'https://example.com/resumes/john-doe.pdf'],
      ['Jane Smith', 'jane.smith@example.com', 'NIT Trichy', 'NIT Trichy', '2026-06-16', ''],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Lock the Drive Date column to Text format (including blank buffer rows below
    // the examples) so Excel never auto-converts typed dates into its own native
    // date type — that auto-conversion is what silently swaps day/month on ambiguous
    // input like "09-07-2026" depending on the machine's locale.
    const DRIVE_DATE_COL = headers.indexOf('Drive Date (YYYY-MM-DD)');
    const TOTAL_ROWS = 200; // header + examples + generous blank buffer for new rows
    for (let r = 0; r < TOTAL_ROWS; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: DRIVE_DATE_COL });
      const existing = worksheet[addr];
      worksheet[addr] = { t: 's', v: existing ? existing.v : '', z: '@' };
    }
    worksheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: TOTAL_ROWS - 1, c: headers.length - 1 } });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates');
    const arrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    const blob = new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'candidate_template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCandidates(true);
    setUploadError(null);
    setUploadSuccessMessage(null);

    if (!uploadDefaultCollege || uploadDefaultCollege === '_none_placeholder' || uploadDefaultCollege.trim() === '') {
      setUploadError('Please select a default College Name of Drive from the dropdown above before uploading.');
      setIsUploadingCandidates(false);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error('Could not read file data');
        // cellDates is intentionally omitted: it lets SheetJS auto-convert date-looking
        // cells to JS Date objects using its own heuristics, which can resolve an
        // ambiguous "09-07-2026" as Sep 7 instead of the day-first Jul 9 our recruiters
        // enter. Reading raw values instead and parsing them ourselves in parseExcelDate
        // (day-first-first) keeps that interpretation consistent and under our control.
        const workbook = XLSX.read(data, { type: 'binary' });
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

            const driveCollegeKey = keys.find((k) => {
              const val = normalizeHeader(k);
              return val === 'college name of drive' || val === 'drive college' || val === 'college of drive';
            });
            const rawDriveCollege = driveCollegeKey && row[driveCollegeKey] !== undefined ? String(row[driveCollegeKey]).trim() : undefined;
            const collegeDrive = rawDriveCollege || uploadDefaultCollege;

            const candidateCollegeKey = keys.find((k) => {
              const val = normalizeHeader(k);
              return val === 'college name of candidate' || val === 'candidate college' || val === 'college' || val === 'institution' || val === 'university' || val === 'college name';
            });
            const rawCandidateCollege = candidateCollegeKey && row[candidateCollegeKey] !== undefined ? String(row[candidateCollegeKey]).trim() : undefined;
            const college = rawCandidateCollege || collegeDrive;

            const resumeLinkKey = keys.find((k) => {
              const val = normalizeHeader(k);
              return val === 'resume link' || val === 'resume url' || val === 'resume' || val === 'cv link' || val === 'cv url';
            });
            const resumeLink = resumeLinkKey && row[resumeLinkKey] !== undefined ? String(row[resumeLinkKey]).trim() : undefined;

            if (!preferredDate) {
              throw new Error(`Row ${i + 2}: Candidate "${name}" is missing a Drive Date. Please specify a date in the sheet or set a default Drive Date above.`);
            }
            if (!college) {
              throw new Error(`Row ${i + 2}: Candidate "${name}" is missing a Candidate College Name. Please specify a candidate college name in the sheet or select a default College Name of Drive above.`);
            }
            parsedCandidates.push({ name, email, preferredDate, college, collegeDrive, resumeLink });
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
        if (result.resumeLinkFailures?.length) {
          toast.error(
            `${result.resumeLinkFailures.length} resume link(s) could not be attached: ${result.resumeLinkFailures
              .map((f: { name: string; error: string }) => `${f.name} (${f.error})`)
              .join('; ')}`
          );
        }
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
    if (!singleCandidateCollege.trim()) { setSingleCandidateError('Please enter candidate college.'); return; }
    if (!singleCandidateCollegeDrive.trim()) { setSingleCandidateError('Please select drive college.'); return; }

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
            college: singleCandidateCollege.trim(),
            collegeDrive: singleCandidateCollegeDrive.trim(),
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
      setSingleCandidateCollegeDrive('');
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
    if (!editCandidateCollege.trim()) { toast.error('College Name of Candidate is required.'); return; }
    if (!editCandidateCollegeDrive.trim()) { toast.error('College Name of Drive is required.'); return; }
    if (!editCandidateDate.trim()) { toast.error('Drive Date is required.'); return; }
    try {
      const res = await fetch(`/api/candidates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editCandidateName.trim(),
          email: editCandidateEmail.trim(),
          college: editCandidateCollege.trim(),
          collegeDrive: editCandidateCollegeDrive.trim(),
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

  const handleUnmapCandidate = async (id: string) => {
    setUnmappingCandidateId(id);
    try {
      const res = await fetch(`/api/candidates/${id}/unmap`, { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to unmap candidate.');
      setCandidates(result.candidates);
      setInterviews(result.interviews);
      toast.success('Candidate unmapped and returned to the waiting queue.');
    } catch (err: any) {
      console.error('Error unmapping candidate:', err);
      toast.error(err.message || 'Failed to unmap candidate.');
    } finally {
      setUnmappingCandidateId(null);
    }
  };

  const handleResumeUpload = async (candidateId: string, file: File) => {
    setUploadingResumeId(candidateId);
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const res = await fetch(`/api/candidates/${candidateId}/resume`, { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to upload resume.');
      setCandidates(result.candidates);
      toast.success('Resume attached. Panelists on this candidate\'s interview can now use the AI Copilot.');
    } catch (err: any) {
      console.error('Error uploading resume:', err);
      toast.error(err.message || 'Failed to upload resume.');
    } finally {
      setUploadingResumeId(null);
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

  const handleExportCandidates = () => {
    if (filteredCandidates.length === 0) {
      toast.error('No candidates to export.');
      return;
    }

    try {
      const dataToExport = filteredCandidates.map((candidate) => {
        let mappedIntv = candidate.mappedInterviewId
          ? interviews.find((i) => i.id === candidate.mappedInterviewId)
          : null;
        // Fallback by email only applies to candidates the DB already considers
        // MAPPED (a legacy safety net for rows missing mappedInterviewId) — never
        // for WAITING candidates, since email addresses get reused across
        // unrelated drives/uploads and would otherwise falsely match someone else's interview.
        if (!mappedIntv && candidate.email && candidate.status === 'MAPPED') {
          mappedIntv = interviews.find((i) =>
            i.candidateEmail.toLowerCase() === candidate.email.toLowerCase() &&
            i.candidateName !== 'Pending Assignment' &&
            i.candidateEmail !== 'pending@assign.com'
          ) || null;
        }

        const { l1Result, l2Result } = getCandidateRoundResults(candidate, interviews);

        const mappedInterviewStr = mappedIntv 
          ? `${mappedIntv.role} (${mappedIntv.scheduledSlotStart ? new Date(mappedIntv.scheduledSlotStart).toLocaleString() : 'Pending Slot'})`
          : '—';

        return {
          'Candidate Name': candidate.name,
          'Candidate Email': candidate.email,
          'Candidate College': candidate.college || '—',
          'College of Drive': candidate.collegeDrive || '—',
          'Drive Date': candidate.preferredDate ? new Date(candidate.preferredDate).toLocaleDateString('en-US') : '—',
          'Uploaded At': new Date(candidate.createdAt).toLocaleDateString('en-US'),
          'Queue Status': candidate.status === 'MAPPED' || !!mappedIntv ? 'Mapped' : 'Waiting',
          'L1 Result': l1Result,
          'L2 Result': l2Result,
          'Mapped Interview': mappedInterviewStr,
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      
      // Auto-fit column widths
      const colWidths = Object.keys(dataToExport[0]).map((key) => {
        const maxLength = Math.max(
          key.length,
          ...dataToExport.map((row: any) => String(row[key] || '').length)
        );
        return { wch: maxLength + 2 };
      });
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates');
      
      const fileName = activeDrive 
        ? `Candidates_Drive_${activeDrive.collegeName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
        : `Candidate_Queue_${new Date().toISOString().split('T')[0]}.xlsx`;

      XLSX.writeFile(workbook, fileName);
      toast.success('Candidate list exported successfully!');
    } catch (err: any) {
      console.error('Failed to export candidates:', err);
      toast.error('Failed to export candidate list.');
    }
  };

  // ── Filtered List ─────────────────────────────────────────────────────────
  const filteredCandidates = candidates.filter((c) => {
    const matchesQuery =
      c.name.toLowerCase().includes(candidateSearchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(candidateSearchQuery.toLowerCase());
    const matchesStatus = candidateStatusFilter === 'all' || c.status === candidateStatusFilter;
    const matchesCollege = candidateCollegeFilter === 'all' ||
      (c.collegeDrive && c.collegeDrive.toLowerCase() === candidateCollegeFilter.toLowerCase()) ||
      (c.college && c.college.toLowerCase() === candidateCollegeFilter.toLowerCase());
    const matchesDate = candidateDateFilter === 'all' || c.preferredDate === candidateDateFilter;
    const matchesActiveDrive = !scopeToActiveDrive || !activeDrive ||
      (
        ((c.collegeDrive && c.collegeDrive.toLowerCase() === activeDrive.collegeName.toLowerCase()) ||
          (c.college && c.college.toLowerCase() === activeDrive.collegeName.toLowerCase())) &&
        c.preferredDate >= activeDrive.startDate && c.preferredDate <= activeDrive.endDate
      );
    return matchesQuery && matchesStatus && matchesCollege && matchesDate && matchesActiveDrive;
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="candidates-page">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-heading)' }}>Candidates</h1>
          <p className="text-muted text-sm" style={{ margin: '4px 0 0 0' }}>Manage candidate uploads, authorization, and interview mapping.</p>
        </div>
      </div>

      <div className="candidates-layout">
        {/* Left Column: Combined Actions Card */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.15rem', marginBottom: '0.25rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Users size={18} className="text-primary" />
            Candidate Actions
          </h3>
          <p className="text-muted text-xs" style={{ marginBottom: '1.25rem', marginTop: '4px' }}>
            Upload candidates in bulk or add one candidate manually.
          </p>

          {/* Bulk Upload Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ fontSize: '0.85rem', margin: '0.5rem 0 0.25rem 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Bulk Upload</h4>
            
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
                <SelectContent >
                  <SelectItem value="_none_placeholder">Select College...</SelectItem>
                  {collegesList.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="upload-zone" style={{ position: 'relative' }}>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelUpload}
                disabled={isUploadingCandidates}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
              />
              {isUploadingCandidates ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <Loader2 size={24} className="animate-spin text-primary" />
                  <span className="text-xs text-muted">Uploading...</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <Plus size={24} className="text-primary" />
                  <span className="text-xs font-semibold text-main">Click or Drag File</span>
                  <span className="text-xxs text-muted">XLSX, XLS, CSV</span>
                </div>
              )}
            </div>

            <button onClick={handleDownloadTemplate} className="btn btn-secondary" style={{ width: '100%', fontSize: '0.8rem', height: '36px' }}>
              Download Template
            </button>

            {uploadError && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', color: '#f87171', fontSize: '0.75rem' }}>
                {uploadError}
              </div>
            )}
            {uploadSuccessMessage && (
              <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', color: '#34d399', fontSize: '0.75rem' }}>
                {uploadSuccessMessage}
              </div>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-glass)', margin: '1.25rem 0' }} />

          {/* Manual Entry Section */}
          <form onSubmit={handleAddSingleCandidate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4 style={{ fontSize: '0.85rem', margin: '0 0 0.25rem 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Manual Entry</h4>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Name</label>
              <input type="text" className="form-input" placeholder="John Doe" value={singleCandidateName} onChange={(e) => setSingleCandidateName(e.target.value)} required style={{ fontSize: '0.85rem', marginTop: '0.25rem' }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Email</label>
              <input type="email" className="form-input" placeholder="john.doe@example.com" value={singleCandidateEmail} onChange={(e) => setSingleCandidateEmail(e.target.value)} required style={{ fontSize: '0.85rem', marginTop: '0.25rem' }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Drive Date</label>
              <input type="date" className="form-input" value={singleCandidateDate} onChange={(e) => setSingleCandidateDate(e.target.value)} min={todayStr} required style={{ fontSize: '0.85rem', marginTop: '0.25rem' }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Candidate College</label>
              <input type="text" className="form-input" placeholder="e.g. IIT Madras" value={singleCandidateCollege} onChange={(e) => setSingleCandidateCollege(e.target.value)} required style={{ fontSize: '0.85rem', marginTop: '0.25rem' }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Drive College</label>
              <Select value={singleCandidateCollegeDrive} onValueChange={(val) => setSingleCandidateCollegeDrive(val || '')}>
                <SelectTrigger className="w-full text-left" style={{ fontSize: '0.85rem', marginTop: '0.25rem', height: '36px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit' }}>
                  <SelectValue placeholder="Select College..." />
                </SelectTrigger>
                <SelectContent >
                  <SelectItem value="_none_placeholder">Select College...</SelectItem>
                  {collegesList.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {singleCandidateError && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', color: '#f87171', fontSize: '0.75rem' }}>
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

        {/* Right Column: Queue Listing */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem', fontFamily: 'var(--font-heading)', margin: 0 }}>
                Authorized Candidate Queue
              </h3>
              <p className="text-muted text-xs" style={{ margin: '4px 0 0 0' }}>
                Candidates waiting for scheduling or mapped to active drives.
              </p>
            </div>
            <button
              onClick={handleExportCandidates}
              className="btn btn-secondary"
              style={{
                fontSize: '0.75rem',
                height: '32px',
                padding: '0 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              <span>Export to Excel</span>
            </button>
          </div>

          {/* Filter Toolbar */}
          <div className="filter-toolbar">
            {/* Search Input */}
            <div className="search-field" style={{ position: 'relative' }}>
              <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Search</label>
              <div style={{ position: 'relative' }}>
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
            </div>

            {/* Status Filter */}
            <div>
              <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Status</label>
              <Select value={candidateStatusFilter} onValueChange={(val) => setCandidateStatusFilter(val as any)}>
                <SelectTrigger className="text-left w-full" style={{ fontSize: '0.75rem', height: '32px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', color: 'inherit' }}>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent >
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="WAITING">Waiting</SelectItem>
                  <SelectItem value="MAPPED">Mapped</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* College Filter */}
            <div>
              <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>College (Drive)</label>
              <Select value={candidateCollegeFilter} onValueChange={(val) => setCandidateCollegeFilter(val || 'all')}>
                <SelectTrigger className="text-left w-full" style={{ fontSize: '0.75rem', height: '32px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', color: 'inherit' }}>
                  <SelectValue placeholder="All Colleges" />
                </SelectTrigger>
                <SelectContent >
                  <SelectItem value="all">All Colleges</SelectItem>
                  {collegesList.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Filter */}
            <div>
              <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>Drive Date</label>
              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                <input
                  type="date"
                  value={candidateDateFilter === 'all' ? '' : candidateDateFilter}
                  onChange={(e) => setCandidateDateFilter(e.target.value || 'all')}
                  style={{
                    width: '100%',
                    padding: '0.3rem 0.5rem',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'inherit',
                    fontSize: '0.75rem',
                    height: '32px',
                    colorScheme: 'dark',
                    cursor: 'pointer'
                  }}
                />
                {candidateDateFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setCandidateDateFilter('all')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Clear date filter"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Active Drive Scope */}
            <div className="checkbox-field">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', cursor: activeDrive ? 'pointer' : 'not-allowed', color: activeDrive ? 'inherit' : 'var(--text-muted)', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={scopeToActiveDrive && !!activeDrive}
                  disabled={!activeDrive}
                  onChange={(e) => setScopeToActiveDrive(e.target.checked)}
                  style={{ accentColor: 'var(--primary)', cursor: activeDrive ? 'pointer' : 'not-allowed' }}
                />
                <span>Active Drive only</span>
              </label>
            </div>
          </div>

          {/* Queue Summary stats inline */}
          <div className="queue-summary">
            <span>Total Candidates: <strong>{filteredCandidates.length}</strong></span>
            <span>Mapped: <strong>{filteredCandidates.filter(c => c.status === 'MAPPED').length}</strong></span>
            <span>Waiting: <strong>{filteredCandidates.filter(c => c.status === 'WAITING').length}</strong></span>
            {activeDrive && <span>Active Drive: <strong>{activeDrive.collegeName}</strong></span>}
          </div>

          {isLoadingCandidates ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <Loader2 size={32} className="animate-spin text-primary" />
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="queue-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>College / Drive</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Results</th>
                    <th>Interview</th>
                    <th style={{ width: '180px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((candidate) => {
                    let mappedIntv = candidate.mappedInterviewId
                      ? interviews.find((i) => i.id === candidate.mappedInterviewId)
                      : null;
                    // See the export handler above for why this fallback is gated
                    // on status === 'MAPPED' — reused candidate emails across
                    // unrelated drives would otherwise falsely match someone else's interview.
                    if (!mappedIntv && candidate.email && candidate.status === 'MAPPED') {
                      mappedIntv = interviews.find((i) =>
                        i.candidateEmail.toLowerCase() === candidate.email.toLowerCase() &&
                        i.candidateName !== 'Pending Assignment' &&
                        i.candidateEmail !== 'pending@assign.com'
                      ) || null;
                    }
                    const isMapped = candidate.status === 'MAPPED' || !!mappedIntv;
                    return (
                      <tr key={candidate.id}>
                        {editingCandidateId === candidate.id ? (
                          <>
                            <td style={{ padding: '0.5rem 1rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <input
                                  type="text"
                                  className="form-input text-xs"
                                  style={{ padding: '0.2rem 0.4rem', height: '28px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', color: 'var(--text-main)', fontSize: '0.8rem', width: '100%' }}
                                  value={editCandidateName}
                                  onChange={(e) => setEditCandidateName(e.target.value)}
                                  required
                                  placeholder="Name"
                                />
                                <input
                                  type="email"
                                  className="form-input text-xs"
                                  style={{ padding: '0.2rem 0.4rem', height: '28px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', color: 'var(--text-main)', fontSize: '0.8rem', width: '100%' }}
                                  value={editCandidateEmail}
                                  onChange={(e) => setEditCandidateEmail(e.target.value)}
                                  required
                                  placeholder="Email"
                                />
                              </div>
                            </td>
                            <td style={{ padding: '0.5rem 1rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <input
                                  type="text"
                                  className="form-input text-xs"
                                  style={{ padding: '0.2rem 0.4rem', height: '28px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', color: 'var(--text-main)', fontSize: '0.8rem', width: '100%' }}
                                  value={editCandidateCollege}
                                  onChange={(e) => setEditCandidateCollege(e.target.value)}
                                  required
                                  placeholder="College Name"
                                />
                                <Select value={editCandidateCollegeDrive} onValueChange={(val) => setEditCandidateCollegeDrive(val || '')}>
                                  <SelectTrigger className="text-left" style={{ padding: '0.2rem 0.4rem', height: '28px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', color: 'var(--text-main)', fontSize: '0.8rem', width: '100%' }}>
                                    <SelectValue placeholder="Select Drive College..." />
                                  </SelectTrigger>
                                  <SelectContent >
                                    <SelectItem value="_none_placeholder">Select Drive College...</SelectItem>
                                    {collegesList.map((c) => (
                                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </td>
                            <td style={{ padding: '0.5rem 1rem' }}>
                              <input
                                type="date"
                                className="form-input text-xs"
                                style={{ padding: '0.2rem 0.4rem', height: '28px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-glass)', color: 'var(--text-main)', fontSize: '0.8rem', width: '100%' }}
                                value={editCandidateDate}
                                onChange={(e) => setEditCandidateDate(e.target.value)}
                                min={todayStr}
                                required
                              />
                            </td>
                            <td style={{ padding: '0.5rem 1rem' }}>
                              {!isMapped ? (
                                <span className="badge badge-pending" style={{ fontSize: '0.65rem' }}>Waiting</span>
                              ) : (
                                <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Mapped</span>
                              )}
                            </td>
                            <td style={{ padding: '0.5rem 1rem' }}>
                              <span className="text-muted" style={{ fontSize: '12px' }}>—</span>
                            </td>
                            <td style={{ padding: '0.5rem 1rem' }}>
                              <span className="text-muted" style={{ fontSize: '12px' }}>—</span>
                            </td>
                            <td style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                                <button onClick={() => handleSaveCandidateEdit(candidate.id)} className="btn btn-primary btn-sm" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', height: 'auto', whiteSpace: 'nowrap' }}>
                                  Save
                                </button>
                                <button onClick={() => setEditingCandidateId(null)} className="btn btn-secondary btn-sm" style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', height: 'auto', whiteSpace: 'nowrap' }}>
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>
                              <div className="candidate-cell">
                                <button
                                  onClick={() => setSelectedFeedbackCandidate(candidate)}
                                  className="candidate-name"
                                  title="Click to view feedbacks"
                                >
                                  {candidate.name}
                                </button>
                                <span className="candidate-email">{candidate.email}</span>
                              </div>
                            </td>
                            <td>
                              <div className="college-drive-cell">
                                {candidate.college && (
                                  <div>
                                    <span className="cell-label">Cand:</span> <span className="cell-value">{candidate.college}</span>
                                  </div>
                                )}
                                {candidate.collegeDrive && (
                                  <div>
                                    <span className="cell-label">Drive:</span> <span className="cell-value">{candidate.collegeDrive}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px' }}>
                                <span>{candidate.preferredDate ? new Date(candidate.preferredDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                                <span className="text-muted" style={{ fontSize: '11px' }}>Uploaded: {new Date(candidate.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                              </div>
                            </td>
                            <td>
                              {!isMapped ? (
                                <span className="badge badge-pending" style={{ fontSize: '0.65rem' }}>Waiting</span>
                              ) : (
                                <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Mapped</span>
                              )}
                            </td>
                            <td>
                              {(() => {
                                const { l1Result, l2Result } = getCandidateRoundResults(candidate, interviews);
                                const getStatusSpan = (result: string, name: string) => {
                                  if (result === 'Passed') return <span><strong>{name}:</strong> <span className="result-status-success">Passed</span></span>;
                                  if (result === 'Rejected') return <span><strong>{name}:</strong> <span className="text-danger font-semibold">Rejected</span></span>;
                                  if (result === 'Pending Feedback') return <span><strong>{name}:</strong> <span className="result-status-warning">Pending</span></span>;
                                  if (result === 'Scheduled') return <span><strong>{name}:</strong> <span className="text-info font-semibold">Scheduled</span></span>;
                                  if (result === 'Cancelled') return <span><strong>{name}:</strong> <span className="text-muted">Cancelled</span></span>;
                                  return <span><strong>{name}:</strong> <span className="text-muted">Not Started</span></span>;
                                };
                                return (
                                  <div className="result-stack">
                                    {getStatusSpan(l1Result, 'L1')}
                                    {getStatusSpan(l2Result, 'L2')}
                                  </div>
                                );
                              })()}
                            </td>
                            <td>
                              {mappedIntv ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px' }}>
                                  <span style={{ fontWeight: 600 }}>{mappedIntv.role}</span>
                                  <span className="text-muted" style={{ fontSize: '12px' }}>
                                    {mappedIntv.scheduledSlotStart
                                      ? `${new Date(mappedIntv.scheduledSlotStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                                      : 'Pending Slot'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted font-italic">—</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                                {mappingCandidateId === candidate.id ? (
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
                                      <SelectContent >
                                        <SelectItem value="_none_placeholder">Select Available Slot...</SelectItem>
                                        {interviews
                                          .filter((i) => i.candidateName === 'Pending Assignment' && (i.status === 'COLLECTED' || i.status === 'SCHEDULED' || i.status === 'PENDING'))
                                          .map((i) => (
                                            <SelectItem key={i.id} value={i.id}>
                                              {i.role} ({new Date(i.scheduledSlotStart || i.startDate).toLocaleDateString('en-US')} - {i.panels.map(p => p.name).join(', ')})
                                            </SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                    <button onClick={() => setMappingCandidateId(null)} className="row-action-button" style={{ height: '28px' }}>
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    {!isMapped && (
                                      <button
                                        onClick={() => { setMappingCandidateId(candidate.id); setEditingCandidateId(null); }}
                                        className="row-action-button"
                                        style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)', color: 'var(--primary)', height: '28px' }}
                                        title="Map to an available interview slot"
                                      >
                                        Map
                                      </button>
                                    )}
                                    {isMapped && (
                                      <ConfirmDialog
                                        trigger={
                                          <button
                                            disabled={unmappingCandidateId === candidate.id}
                                            className="row-action-button"
                                            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--warning)', height: '28px' }}
                                            title="Unmap and return this candidate to the waiting queue"
                                          />
                                        }
                                        triggerChildren={
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {unmappingCandidateId === candidate.id ? <Loader2 size={10} className="animate-spin" /> : null}
                                            <span>Unmap</span>
                                          </div>
                                        }
                                        title="Unmap this candidate?"
                                        description="This returns the candidate to the waiting queue and reverts their mapped interview slot back to Pending Assignment so it can be re-mapped."
                                        confirmLabel="Yes, Unmap"
                                        onConfirm={() => handleUnmapCandidate(candidate.id)}
                                      />
                                    )}
                                    <button
                                      onClick={() => {
                                        setEditingCandidateId(candidate.id);
                                        setMappingCandidateId(null);
                                        setEditCandidateName(candidate.name);
                                        setEditCandidateEmail(candidate.email);
                                        setEditCandidateCollege(candidate.college || '');
                                        setEditCandidateCollegeDrive(candidate.collegeDrive || '');
                                        setEditCandidateDate(candidate.preferredDate || '');
                                      }}
                                      className="row-action-button"
                                      style={{ height: '28px' }}
                                      title="Edit candidate details"
                                    >
                                      Edit
                                    </button>
                                    <input
                                      type="file"
                                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                      style={{ display: 'none' }}
                                      id={`resume-input-${candidate.id}`}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleResumeUpload(candidate.id, file);
                                        e.target.value = '';
                                      }}
                                    />
                                    <button
                                      onClick={() => document.getElementById(`resume-input-${candidate.id}`)?.click()}
                                      disabled={uploadingResumeId === candidate.id}
                                      className="row-action-button"
                                      style={{
                                        height: '28px',
                                        background: candidate.resumeFileKey ? 'rgba(16,185,129,0.06)' : undefined,
                                        border: candidate.resumeFileKey ? '1px solid rgba(16,185,129,0.2)' : undefined,
                                        color: candidate.resumeFileKey ? 'var(--success)' : undefined,
                                      }}
                                      title={candidate.resumeFileKey ? 'Replace attached resume' : 'Attach a resume (PDF/DOCX) for the AI Copilot'}
                                    >
                                      {uploadingResumeId === candidate.id ? (
                                        <Loader2 size={10} className="animate-spin" />
                                      ) : candidate.resumeFileKey ? 'Resume ✓' : 'Attach Resume'}
                                    </button>
                                    {(candidate as any).outcomeStatus === 'PASSED_L2' && (
                                      <ConfirmDialog
                                        trigger={
                                          <button
                                            disabled={selectingCandidateId === candidate.id}
                                            className="row-action-button"
                                            style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', color: 'var(--success)', height: '28px' }}
                                            title="Mark as Selected (final outcome)"
                                          />
                                        }
                                        triggerChildren={
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            {selectingCandidateId === candidate.id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                                            <span>Select</span>
                                          </div>
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
                                          disabled={isMapped}
                                          style={{
                                            border: 'none', background: 'transparent',
                                            cursor: isMapped ? 'not-allowed' : 'pointer',
                                            color: isMapped ? 'rgba(255,255,255,0.02)' : 'var(--text-muted)',
                                            padding: '0.2rem',
                                            display: 'flex',
                                            alignItems: 'center'
                                          }}
                                          onMouseEnter={(e) => { if (!isMapped) e.currentTarget.style.color = '#ef4444'; }}
                                          onMouseLeave={(e) => { if (!isMapped) e.currentTarget.style.color = ''; }}
                                          title={isMapped ? 'Cannot delete mapped candidate' : 'Remove candidate'}
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
                          </>
                        )}
                      </tr>
                    );
                  })}

                  {filteredCandidates.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        No candidates registered in the queue. Use the actions panel on the left to add candidates.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {/* Candidate Feedbacks Dialog Modal */}
      {selectedFeedbackCandidate && (
        <div style={{
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
          zIndex: 1000
        }}>
          <div style={{
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
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border-glass)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255,255,255,0.01)',
              width: '100%'
            }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  {selectedFeedbackCandidate.name}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0.2rem 0 0 0' }}>
                  {selectedFeedbackCandidate.email} · {selectedFeedbackCandidate.college}
                </p>
              </div>
              <button
                onClick={() => setSelectedFeedbackCandidate(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}>
              {/* Summary Badges */}
              {(() => {
                const { l1Result, l2Result } = getCandidateRoundResults(selectedFeedbackCandidate, interviews);
                
                const getBadge = (result: string) => {
                  if (result === 'Passed') return <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Passed</span>;
                  if (result === 'Rejected') return <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>Rejected</span>;
                  if (result === 'Pending Feedback') return <span className="badge badge-pending" style={{ fontSize: '0.65rem' }}>Pending Feedback</span>;
                  if (result === 'Scheduled') return <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>Scheduled</span>;
                  return <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>Not Started</span>;
                };

                return (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>L1 Stage:</span>
                      {getBadge(l1Result)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>L2 Stage:</span>
                      {getBadge(l2Result)}
                    </div>
                  </div>
                );
              })()}

              {/* L1 & L2 Details */}
              {['L1', 'L2'].map((round) => {
                const roundInterviews = interviews.filter((i) =>
                  i.candidateEmail.toLowerCase() === selectedFeedbackCandidate.email.toLowerCase() &&
                  i.role.toLowerCase().includes(round.toLowerCase())
                );

                const borderStyle = round === 'L1' 
                  ? '3px solid #3b82f6' 
                  : '3px solid #7c3aed';

                return (
                  <div key={round} style={{
                    borderLeft: borderStyle,
                    paddingLeft: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                      {round} Round Details
                    </h4>

                    {roundInterviews.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No {round} interviews scheduled.
                      </p>
                    ) : (
                      roundInterviews.map((interview) => {
                        const isBooked = interview.status === 'SCHEDULED' || interview.status === 'COLLECTED';
                        const submittedPanels = (interview.panels || []).filter(p => p.status === 'SUBMITTED');
                        const pendingPanels = isBooked ? [] : (interview.panels || []).filter(p => p.status === 'PENDING');

                        return (
                          <div key={interview.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              Interview Status: <strong style={{ color: 'var(--text-main)' }}>{interview.status}</strong>
                              {interview.scheduledSlotStart && (
                                <> · Scheduled for: <strong style={{ color: 'var(--text-main)' }}>{new Date(interview.scheduledSlotStart).toLocaleString()}</strong></>
                              )}
                            </div>

                            {/* Panel Feedbacks */}
                            {submittedPanels.length === 0 && pendingPanels.length === 0 && (
                              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                No panel members nominated for this interview slot.
                              </p>
                            )}

                            {submittedPanels.map((panel) => {
                              const parsed = parseFeedbackSafely(panel.feedback);
                              const isPassed = panel.decision === 'PASSED';
                              const badgeColor = isPassed ? 'var(--success)' : 'var(--danger)';
                              const badgeBg = isPassed ? 'var(--success-glow)' : 'var(--danger-glow)';
                              const badgeBorder = isPassed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';

                              return (
                                <div key={panel.id} style={{
                                  padding: '0.75rem 1rem',
                                  background: 'rgba(255,255,255,0.01)',
                                  border: '1px solid var(--border-glass)',
                                  borderRadius: 'var(--radius-sm)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.5rem'
                                }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                                      Panelist: <span style={{ color: 'var(--text-main)' }}>{panel.name}</span>
                                    </div>
                                    <span className="badge" style={{
                                      fontSize: '0.62rem',
                                      background: badgeBg,
                                      border: `1px solid ${badgeBorder}`,
                                      color: badgeColor
                                    }}>
                                      {panel.decision}
                                    </span>
                                  </div>

                                  {/* Star Ratings */}
                                  {parsed && parsed.scores && (
                                    <div style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '0.25rem',
                                      margin: '0.25rem 0',
                                      background: 'rgba(255,255,255,0.01)',
                                      padding: '0.4rem',
                                      borderRadius: '4px'
                                    }}>
                                      {Object.entries(parsed.scores).map(([metric, score]) => {
                                        const displayNames: Record<string, string> = {
                                          coding: 'Coding & Problem Solving',
                                          communication: 'Technical Communication',
                                          fundamentals: 'CS Fundamentals',
                                          systemDesign: 'System Design & Scalability',
                                          technicalDepth: 'Technical Depth & Experience',
                                          leadership: 'Leadership & Ownership',
                                          culturalFit: 'Cultural Fit & MS Values',
                                          technical: 'Technical Depth',
                                          collaboration: 'Collaboration & Teamwork'
                                        };
                                        return (
                                          <div key={metric} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                              {displayNames[metric] || metric}:
                                            </span>
                                            {renderStarsStatic(score as number)}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Comments */}
                                  <div style={{ fontSize: '0.78rem' }}>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>
                                      Comments
                                    </span>
                                    <p style={{ margin: 0, color: 'var(--text-main)', lineHeight: 1.4, whiteSpace: 'pre-wrap', fontSize: '0.78rem' }}>
                                      {parsed ? parsed.comments : (panel.feedback || 'No comments provided.')}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}

                            {pendingPanels.map((panel) => (
                              <div key={panel.id} style={{
                                padding: '0.5rem 0.75rem',
                                border: '1px dashed var(--border-glass)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-muted)',
                                fontSize: '0.78rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}>
                                <span>Panelist: <strong>{panel.name}</strong> ({panel.email})</span>
                                <span className="badge badge-pending" style={{ fontSize: '0.62rem' }}>Feedback Pending</span>
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
            <div style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid var(--border-glass)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'rgba(255,255,255,0.01)'
            }}>
              <button className="btn btn-secondary" onClick={() => setSelectedFeedbackCandidate(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

