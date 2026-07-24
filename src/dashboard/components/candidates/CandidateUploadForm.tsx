/**
 * CandidateUploadForm Component
 *
 * Bulk candidate upload via Excel/CSV with template download.
 */

'use client';

import React, { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/common/components/ui/select';
import { generateCandidateTemplate } from '@/common/util/candidates/excelParser';
import type { College } from '@server/lib/db';

interface CandidateUploadFormProps {
  uploadDefaultDate: string;
  uploadDefaultCollege: string;
  collegesList: College[];
  todayStr: string;
  isUploading: boolean;
  uploadError: string | null;
  uploadSuccessMessage: string | null;
  onDefaultDateChange: (date: string) => void;
  onDefaultCollegeChange: (college: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const CandidateUploadForm: React.FC<CandidateUploadFormProps> = ({
  uploadDefaultDate,
  uploadDefaultCollege,
  collegesList,
  todayStr,
  isUploading,
  uploadError,
  uploadSuccessMessage,
  onDefaultDateChange,
  onDefaultCollegeChange,
  onFileUpload,
}) => {
  const handleDownloadTemplate = () => {
    const blob = generateCandidateTemplate();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'candidate_template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h4 style={{ fontSize: '0.85rem', margin: '0.5rem 0 0.25rem 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
        Bulk Upload
      </h4>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Drive Date (Fallback Default)</label>
        <input
          type="date"
          className="form-input"
          value={uploadDefaultDate}
          onChange={(e) => onDefaultDateChange(e.target.value)}
          min={todayStr}
          style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}
        />
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>College Name of Drive (Fallback Default)</label>
        <Select value={uploadDefaultCollege} onValueChange={(val) => onDefaultCollegeChange(val || '')}>
          <SelectTrigger className="w-full text-left" style={{ fontSize: '0.85rem', marginTop: '0.25rem', height: '36px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)', color: 'inherit' }}>
            <SelectValue placeholder="Select College..." />
          </SelectTrigger>
          <SelectContent>
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
          onChange={onFileUpload}
          disabled={isUploading}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
        />
        {isUploading ? (
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
  );
};
