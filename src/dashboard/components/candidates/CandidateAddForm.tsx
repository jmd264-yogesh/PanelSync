/**
 * CandidateAddForm Component
 *
 * Manual single candidate entry form.
 */

'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/common/components/ui/select';
import type { College } from '@server/lib/db';
import type { SingleCandidateFormData } from '@/common/types/candidate';

interface CandidateAddFormProps {
  formData: SingleCandidateFormData;
  collegesList: College[];
  todayStr: string;
  isAdding: boolean;
  error: string | null;
  onFormChange: (field: keyof SingleCandidateFormData, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const CandidateAddForm: React.FC<CandidateAddFormProps> = ({
  formData,
  collegesList,
  todayStr,
  isAdding,
  error,
  onFormChange,
  onSubmit,
}) => {
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h4 style={{ fontSize: '0.85rem', margin: '0 0 0.25rem 0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
        Manual Entry
      </h4>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Name</label>
        <input
          type="text"
          className="form-input"
          placeholder="John Doe"
          value={formData.name}
          onChange={(e) => onFormChange('name', e.target.value)}
          required
          style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}
        />
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Email</label>
        <input
          type="email"
          className="form-input"
          placeholder="john.doe@example.com"
          value={formData.email}
          onChange={(e) => onFormChange('email', e.target.value)}
          required
          style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}
        />
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Drive Date</label>
        <input
          type="date"
          className="form-input"
          value={formData.date}
          onChange={(e) => onFormChange('date', e.target.value)}
          min={todayStr}
          required
          style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}
        />
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Candidate College</label>
        <input
          type="text"
          className="form-input"
          placeholder="e.g. IIT Madras"
          value={formData.college}
          onChange={(e) => onFormChange('college', e.target.value)}
          required
          style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}
        />
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Drive College</label>
        <Select value={formData.collegeDrive} onValueChange={(val) => onFormChange('collegeDrive', val || '')}>
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

      {error && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', color: '#f87171', fontSize: '0.75rem' }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={isAdding || !formData.name.trim() || !formData.email.trim()}
        style={{ width: '100%', marginTop: '0.5rem' }}
      >
        {isAdding ? (
          <><Loader2 size={16} className="animate-spin" style={{ marginRight: '8px' }} /> Adding...</>
        ) : (
          'Add Candidate'
        )}
      </button>
    </form>
  );
};
