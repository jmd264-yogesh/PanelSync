'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { Panelist, Drive, College } from '@server/lib/db';
import { ProposedSlot } from '@/common/types/panelist';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/common/components/ui/select';
import { SlotChecklist } from './SlotChecklist';
import { TeamsMessagePreview } from './TeamsMessagePreview';
import { DriveInfoSection } from './DriveInfoSection';

interface SlotRequestModalProps {
  isOpen: boolean;
  panelists: Panelist[];
  interviewType: 'L1' | 'L2' | 'General';
  duration: string;
  startDate: string;
  endDate: string;
  collegeName: string;
  activeDrive: Drive | null;
  slots: ProposedSlot[];
  collegesList: College[];
  todayStr: string;
  isRequestingSlot: boolean;
  onClose: () => void;
  onInterviewTypeChange: (value: 'L1' | 'L2' | 'General') => void;
  onDurationChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onCollegeNameChange: (value: string) => void;
  onToggleSlot: (index: number) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const SlotRequestModal = ({
  isOpen,
  panelists,
  interviewType,
  duration,
  startDate,
  endDate,
  collegeName,
  activeDrive,
  slots,
  collegesList,
  todayStr,
  isRequestingSlot,
  onClose,
  onInterviewTypeChange,
  onDurationChange,
  onStartDateChange,
  onEndDateChange,
  onCollegeNameChange,
  onToggleSlot,
  onSubmit,
}: SlotRequestModalProps) => {
  if (!isOpen || panelists.length === 0) {
    return null;
  }

  const selectedSlots = slots.filter((s) => s.selected);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        className="glass-card animate-pulse-once"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '520px',
          width: '100%',
          padding: '2rem',
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid var(--border-glass)',
        }}
      >
        <h3
          style={{
            fontSize: '1.25rem',
            marginBottom: '1rem',
            borderBottom: '1px solid var(--border-glass)',
            paddingBottom: '0.75rem',
            color: 'var(--fg)',
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
          }}
        >
          Request Slots from{' '}
          {panelists.length === 1 ? panelists[0].displayName : `${panelists.length} Panelists`}
        </h3>

        {panelists.length > 1 && (
          <div
            style={{
              background: 'var(--surface-soft)',
              padding: '0.6rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              marginBottom: '1rem',
              fontSize: '0.75rem',
            }}
          >
            <span
              className="text-muted block font-semibold"
              style={{ marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Invited Panel Members:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
              {panelists.map((p) => (
                <span
                  key={p.id}
                  style={{
                    background: 'var(--l1-soft)',
                    border: '1px solid var(--l1-border)',
                    color: 'var(--l1)',
                    padding: '0.1rem 0.35rem',
                    borderRadius: '4px',
                    fontWeight: 650,
                  }}
                >
                  {p.displayName}
                </span>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={onSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Interview Stage</label>
              <Select value={interviewType} onValueChange={(val) => onInterviewTypeChange(val as any)}>
                <SelectTrigger className="select-control" style={{ color: 'inherit' }}>
                  <SelectValue placeholder="Select Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L1">L1 Interview</SelectItem>
                  <SelectItem value="L2">L2 Interview</SelectItem>
                  <SelectItem value="General">General / Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="form-group">
              <label className="form-label">Duration</label>
              <Select value={duration} onValueChange={(val) => onDurationChange(val || '')}>
                <SelectTrigger className="select-control" style={{ color: 'inherit' }}>
                  <SelectValue placeholder="Select Duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 mins</SelectItem>
                  <SelectItem value="45">45 mins</SelectItem>
                  <SelectItem value="60">60 mins</SelectItem>
                  <SelectItem value="90">90 mins</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DriveInfoSection
            activeDrive={activeDrive}
            collegeName={collegeName}
            startDate={startDate}
            endDate={endDate}
            collegesList={collegesList}
            todayStr={todayStr}
            onCollegeNameChange={onCollegeNameChange}
            onStartDateChange={onStartDateChange}
            onEndDateChange={onEndDateChange}
          />

          <SlotChecklist slots={slots} onToggleSlot={onToggleSlot} />

          <TeamsMessagePreview
            panelists={panelists}
            interviewType={interviewType}
            collegeName={collegeName}
            startDate={startDate}
            endDate={endDate}
            duration={duration}
            selectedSlots={selectedSlots}
            todayStr={todayStr}
          />

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1 }}
              disabled={selectedSlots.length === 0 || isRequestingSlot}
            >
              {isRequestingSlot ? <Loader2 size={16} className="animate-spin" /> : 'Send Slot Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
