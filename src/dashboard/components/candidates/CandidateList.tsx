/**
 * CandidateList Component
 *
 * Complete candidate table with inline editing, mapping, resume upload, and all actions.
 * Preserves 100% of original CandidatesTab table functionality.
 */

'use client';

import React, { useState } from 'react';
import { Loader2, Trash2, CheckCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/common/components/ui/select';
import { ConfirmDialog } from '@/common/components/ConfirmDialog';
import { getCandidateRoundResults } from '@/common/util/candidates/roundResultCalculation';
import { CandidateFeedbackModal } from './CandidateFeedbackModal';
import type { UploadedCandidate, Interview, College } from '@server/lib/db';

interface CandidateListProps {
  filteredCandidates: UploadedCandidate[];
  interviews: Interview[];
  collegesList: College[];
  todayStr: string;
  isLoading: boolean;
  // From useCandidateActions hook
  mappingCandidateId: string | null;
  setMappingCandidateId: (id: string | null) => void;
  unmappingCandidateId: string | null;
  selectingCandidateId: string | null;
  uploadingResumeId: string | null;
  onSaveEdit: (
    id: string,
    updates: {
      name: string;
      email: string;
      college: string;
      collegeDrive: string;
      preferredDate: string;
    }
  ) => Promise<void>;
  onMapToSlot: (candidate: UploadedCandidate, interviewId: string) => Promise<void>;
  onUnmap: (id: string) => Promise<void>;
  onMarkAsSelected: (id: string) => Promise<void>;
  onResumeUpload: (candidateId: string, file: File) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const CandidateList: React.FC<CandidateListProps> = ({
  filteredCandidates,
  interviews,
  collegesList,
  todayStr,
  isLoading,
  mappingCandidateId,
  setMappingCandidateId,
  unmappingCandidateId,
  selectingCandidateId,
  uploadingResumeId,
  onSaveEdit,
  onMapToSlot,
  onUnmap,
  onMarkAsSelected,
  onResumeUpload,
  onDelete,
}) => {
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [editCandidateName, setEditCandidateName] = useState('');
  const [editCandidateEmail, setEditCandidateEmail] = useState('');
  const [editCandidateCollege, setEditCandidateCollege] = useState('');
  const [editCandidateCollegeDrive, setEditCandidateCollegeDrive] = useState('');
  const [editCandidateDate, setEditCandidateDate] = useState('');
  const [selectedFeedbackCandidate, setSelectedFeedbackCandidate] = useState<UploadedCandidate | null>(null);

  const handleSaveEdit = async (id: string) => {
    await onSaveEdit(id, {
      name: editCandidateName,
      email: editCandidateEmail,
      college: editCandidateCollege,
      collegeDrive: editCandidateCollegeDrive,
      preferredDate: editCandidateDate,
    });
    setEditingCandidateId(null);
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
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
              if (!mappedIntv && candidate.email && candidate.status === 'MAPPED') {
                mappedIntv =
                  interviews.find(
                    (i) =>
                      i.candidateEmail.toLowerCase() === candidate.email.toLowerCase() &&
                      i.candidateName !== 'Pending Assignment' &&
                      i.candidateEmail !== 'pending@assign.com'
                  ) || null;
              }
              const isMapped = candidate.status === 'MAPPED' || !!mappedIntv;

              return (
                <tr key={candidate.id}>
                  {editingCandidateId === candidate.id ? (
                    // EDITING MODE
                    <>
                      <td style={{ padding: '0.5rem 1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <input
                            type="text"
                            className="form-input text-xs"
                            style={{
                              padding: '0.2rem 0.4rem',
                              height: '28px',
                              background: 'rgba(0,0,0,0.3)',
                              border: '1px solid var(--border-glass)',
                              color: 'var(--text-main)',
                              fontSize: '0.8rem',
                              width: '100%',
                            }}
                            value={editCandidateName}
                            onChange={(e) => setEditCandidateName(e.target.value)}
                            required
                            placeholder="Name"
                          />
                          <input
                            type="email"
                            className="form-input text-xs"
                            style={{
                              padding: '0.2rem 0.4rem',
                              height: '28px',
                              background: 'rgba(0,0,0,0.3)',
                              border: '1px solid var(--border-glass)',
                              color: 'var(--text-main)',
                              fontSize: '0.8rem',
                              width: '100%',
                            }}
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
                            style={{
                              padding: '0.2rem 0.4rem',
                              height: '28px',
                              background: 'rgba(0,0,0,0.3)',
                              border: '1px solid var(--border-glass)',
                              color: 'var(--text-main)',
                              fontSize: '0.8rem',
                              width: '100%',
                            }}
                            value={editCandidateCollege}
                            onChange={(e) => setEditCandidateCollege(e.target.value)}
                            required
                            placeholder="College Name"
                          />
                          <Select
                            value={editCandidateCollegeDrive}
                            onValueChange={(val) => setEditCandidateCollegeDrive(val || '')}
                          >
                            <SelectTrigger
                              className="text-left"
                              style={{
                                padding: '0.2rem 0.4rem',
                                height: '28px',
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid var(--border-glass)',
                                color: 'var(--text-main)',
                                fontSize: '0.8rem',
                                width: '100%',
                              }}
                            >
                              <SelectValue placeholder="Select Drive College..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none_placeholder">
                                Select Drive College...
                              </SelectItem>
                              {collegesList.map((c) => (
                                <SelectItem key={c.id} value={c.name}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                      <td style={{ padding: '0.5rem 1rem' }}>
                        <input
                          type="date"
                          className="form-input text-xs"
                          style={{
                            padding: '0.2rem 0.4rem',
                            height: '28px',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid var(--border-glass)',
                            color: 'var(--text-main)',
                            fontSize: '0.8rem',
                            width: '100%',
                          }}
                          value={editCandidateDate}
                          onChange={(e) => setEditCandidateDate(e.target.value)}
                          min={todayStr}
                          required
                        />
                      </td>
                      <td style={{ padding: '0.5rem 1rem' }}>
                        {!isMapped ? (
                          <span className="badge badge-pending" style={{ fontSize: '0.65rem' }}>
                            Waiting
                          </span>
                        ) : (
                          <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                            Mapped
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.5rem 1rem' }}>
                        <span className="text-muted" style={{ fontSize: '12px' }}>
                          —
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem 1rem' }}>
                        <span className="text-muted" style={{ fontSize: '12px' }}>
                          —
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '0.4rem',
                          }}
                        >
                          <button
                            onClick={() => handleSaveEdit(candidate.id)}
                            className="btn btn-primary btn-sm"
                            style={{
                              fontSize: '0.65rem',
                              padding: '0.2rem 0.5rem',
                              height: 'auto',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingCandidateId(null)}
                            className="btn btn-secondary btn-sm"
                            style={{
                              fontSize: '0.65rem',
                              padding: '0.2rem 0.5rem',
                              height: 'auto',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    // DISPLAY MODE
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
                              <span className="cell-label">Cand:</span>{' '}
                              <span className="cell-value">{candidate.college}</span>
                            </div>
                          )}
                          {candidate.collegeDrive && (
                            <div>
                              <span className="cell-label">Drive:</span>{' '}
                              <span className="cell-value">{candidate.collegeDrive}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div
                          style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px' }}
                        >
                          <span>
                            {candidate.preferredDate
                              ? new Date(candidate.preferredDate).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '—'}
                          </span>
                          <span className="text-muted" style={{ fontSize: '11px' }}>
                            Uploaded:{' '}
                            {new Date(candidate.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </td>
                      <td>
                        {!isMapped ? (
                          <span className="badge badge-pending" style={{ fontSize: '0.65rem' }}>
                            Waiting
                          </span>
                        ) : (
                          <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                            Mapped
                          </span>
                        )}
                      </td>
                      <td>
                        {(() => {
                          const { l1Result, l2Result } = getCandidateRoundResults(
                            candidate,
                            interviews
                          );
                          const getStatusSpan = (result: string, name: string) => {
                            if (result === 'Passed')
                              return (
                                <span>
                                  <strong>{name}:</strong>{' '}
                                  <span className="result-status-success">Passed</span>
                                </span>
                              );
                            if (result === 'Rejected')
                              return (
                                <span>
                                  <strong>{name}:</strong>{' '}
                                  <span className="text-danger font-semibold">Rejected</span>
                                </span>
                              );
                            if (result === 'Pending Feedback')
                              return (
                                <span>
                                  <strong>{name}:</strong>{' '}
                                  <span className="result-status-warning">Pending</span>
                                </span>
                              );
                            if (result === 'Scheduled')
                              return (
                                <span>
                                  <strong>{name}:</strong>{' '}
                                  <span className="text-info font-semibold">Scheduled</span>
                                </span>
                              );
                            if (result === 'Cancelled')
                              return (
                                <span>
                                  <strong>{name}:</strong>{' '}
                                  <span className="text-muted">Cancelled</span>
                                </span>
                              );
                            return (
                              <span>
                                <strong>{name}:</strong>{' '}
                                <span className="text-muted">Not Started</span>
                              </span>
                            );
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
                          <div
                            style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '13px' }}
                          >
                            <span style={{ fontWeight: 600 }}>{mappedIntv.role}</span>
                            <span className="text-muted" style={{ fontSize: '12px' }}>
                              {mappedIntv.scheduledSlotStart
                                ? `${new Date(mappedIntv.scheduledSlotStart).toLocaleDateString(
                                    'en-US',
                                    { month: 'short', day: 'numeric' }
                                  )}`
                                : 'Pending Slot'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted font-italic">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '0.4rem',
                          }}
                        >
                          {mappingCandidateId === candidate.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Select
                                onValueChange={async (val: any) => {
                                  if (val && val !== '_none_placeholder') {
                                    await onMapToSlot(candidate, val);
                                    setMappingCandidateId(null);
                                  }
                                }}
                              >
                                <SelectTrigger
                                  className="text-left"
                                  style={{
                                    padding: '0.2rem 0.4rem',
                                    height: '28px',
                                    fontSize: '0.75rem',
                                    width: '180px',
                                    background: 'rgba(0, 0, 0, 0.3)',
                                    border: '1px solid var(--border-glass)',
                                    color: 'var(--text-main)',
                                    borderRadius: 'var(--radius-sm)',
                                  }}
                                >
                                  <SelectValue placeholder="Select Available Slot..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="_none_placeholder">
                                    Select Available Slot...
                                  </SelectItem>
                                  {interviews
                                    .filter(
                                      (i) =>
                                        i.candidateName === 'Pending Assignment' &&
                                        (i.status === 'COLLECTED' ||
                                          i.status === 'SCHEDULED' ||
                                          i.status === 'PENDING')
                                    )
                                    .map((i) => (
                                      <SelectItem key={i.id} value={i.id}>
                                        {i.role} (
                                        {new Date(
                                          i.scheduledSlotStart || i.startDate
                                        ).toLocaleDateString('en-US')}{' '}
                                        - {i.panels.map((p) => p.name).join(', ')})
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              <button
                                onClick={() => setMappingCandidateId(null)}
                                className="row-action-button"
                                style={{ height: '28px' }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              {!isMapped && (
                                <button
                                  onClick={() => {
                                    setMappingCandidateId(candidate.id);
                                    setEditingCandidateId(null);
                                  }}
                                  className="row-action-button"
                                  style={{
                                    background: 'rgba(37,99,235,0.06)',
                                    border: '1px solid rgba(37,99,235,0.2)',
                                    color: 'var(--primary)',
                                    height: '28px',
                                  }}
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
                                      style={{
                                        background: 'rgba(245,158,11,0.06)',
                                        border: '1px solid rgba(245,158,11,0.25)',
                                        color: 'var(--warning)',
                                        height: '28px',
                                      }}
                                      title="Unmap and return this candidate to the waiting queue"
                                    />
                                  }
                                  triggerChildren={
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      {unmappingCandidateId === candidate.id ? (
                                        <Loader2 size={10} className="animate-spin" />
                                      ) : null}
                                      <span>Unmap</span>
                                    </div>
                                  }
                                  title="Unmap this candidate?"
                                  description="This returns the candidate to the waiting queue and reverts their mapped interview slot back to Pending Assignment so it can be re-mapped."
                                  confirmLabel="Yes, Unmap"
                                  onConfirm={() => onUnmap(candidate.id)}
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
                                  if (file) onResumeUpload(candidate.id, file);
                                  e.target.value = '';
                                }}
                              />
                              <button
                                onClick={() =>
                                  document.getElementById(`resume-input-${candidate.id}`)?.click()
                                }
                                disabled={uploadingResumeId === candidate.id}
                                className="row-action-button"
                                style={{
                                  height: '28px',
                                  background: candidate.resumeFileKey
                                    ? 'rgba(16,185,129,0.06)'
                                    : undefined,
                                  border: candidate.resumeFileKey
                                    ? '1px solid rgba(16,185,129,0.2)'
                                    : undefined,
                                  color: candidate.resumeFileKey ? 'var(--success)' : undefined,
                                }}
                                title={
                                  candidate.resumeFileKey
                                    ? 'Replace attached resume'
                                    : 'Attach a resume (PDF/DOCX) for the AI Copilot'
                                }
                              >
                                {uploadingResumeId === candidate.id ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : candidate.resumeFileKey ? (
                                  'Resume ✓'
                                ) : (
                                  'Attach Resume'
                                )}
                              </button>
                              {(candidate as any).outcomeStatus === 'PASSED_L2' && (
                                <ConfirmDialog
                                  trigger={
                                    <button
                                      disabled={selectingCandidateId === candidate.id}
                                      className="row-action-button"
                                      style={{
                                        background: 'rgba(16,185,129,0.06)',
                                        border: '1px solid rgba(16,185,129,0.2)',
                                        color: 'var(--success)',
                                        height: '28px',
                                      }}
                                      title="Mark as Selected (final outcome)"
                                    />
                                  }
                                  triggerChildren={
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      {selectingCandidateId === candidate.id ? (
                                        <Loader2 size={10} className="animate-spin" />
                                      ) : (
                                        <CheckCircle size={10} />
                                      )}
                                      <span>Select</span>
                                    </div>
                                  }
                                  title="Mark candidate as Selected?"
                                  description="This is the final outcome and cannot be changed by panelists."
                                  confirmLabel="Yes, Select"
                                  destructive={false}
                                  onConfirm={() => onMarkAsSelected(candidate.id)}
                                />
                              )}
                              <ConfirmDialog
                                trigger={
                                  <button
                                    disabled={isMapped}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      cursor: isMapped ? 'not-allowed' : 'pointer',
                                      color: isMapped
                                        ? 'rgba(255,255,255,0.02)'
                                        : 'var(--text-muted)',
                                      padding: '0.2rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!isMapped) e.currentTarget.style.color = '#ef4444';
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!isMapped) e.currentTarget.style.color = '';
                                    }}
                                    title={
                                      isMapped
                                        ? 'Cannot delete mapped candidate'
                                        : 'Remove candidate'
                                    }
                                  />
                                }
                                triggerChildren={<Trash2 size={15} />}
                                title="Remove this candidate?"
                                description="This will remove the candidate from the queue. This action cannot be undone."
                                confirmLabel="Yes, Remove"
                                onConfirm={() => onDelete(candidate.id)}
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
                <td
                  colSpan={7}
                  style={{
                    padding: '2.5rem',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                  }}
                >
                  No candidates registered in the queue. Use the actions panel on the left to add
                  candidates.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Feedback Modal */}
      {selectedFeedbackCandidate && (
        <CandidateFeedbackModal
          candidate={selectedFeedbackCandidate}
          interviews={interviews}
          onClose={() => setSelectedFeedbackCandidate(null)}
        />
      )}
    </>
  );
};
