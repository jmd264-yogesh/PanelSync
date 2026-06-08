'use client';

import React, { useState } from 'react';
import { Interview, InterviewPanel } from '@/lib/db';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  CheckCircle, 
  Loader2, 
  AlertCircle,
  Video,
  ExternalLink
} from 'lucide-react';

interface AvailabilityClientProps {
  interview: Interview;
  panel: InterviewPanel;
}

interface TempSlot {
  date: string;
  startTime: string;
  endTime: string;
}

export default function AvailabilityClient({ interview, panel }: AvailabilityClientProps) {
  // Page state
  const [isSubmitted, setIsSubmitted] = useState(panel.status === 'SUBMITTED');
  const [slots, setSlots] = useState<{ startTime: string; endTime: string }[]>(
    panel.availabilities.map((a) => ({ startTime: a.startTime, endTime: a.endTime }))
  );
  
  // Interactive form states
  const [inputDate, setInputDate] = useState('');
  const [inputStart, setInputStart] = useState('09:00');
  const [inputEnd, setInputEnd] = useState('17:00');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Date limit strings for native calendar inputs (min/max attributes)
  const minDate = new Date(interview.startDate).toISOString().split('T')[0];
  const maxDate = new Date(interview.endDate).toISOString().split('T')[0];

  // Add a slot to the list
  const handleAddSlot = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!inputDate) {
      setErrorMsg('Please select a date.');
      return;
    }

    // Parse times
    const startStr = `${inputDate}T${inputStart}`;
    const endStr = `${inputDate}T${inputEnd}`;
    const startObj = new Date(startStr);
    const endObj = new Date(endStr);

    if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) {
      setErrorMsg('Invalid date or time parameters.');
      return;
    }

    if (endObj.getTime() <= startObj.getTime()) {
      setErrorMsg('End time must be after start time.');
      return;
    }

    const durationMin = (endObj.getTime() - startObj.getTime()) / (60 * 1000);
    if (durationMin < interview.duration) {
      setErrorMsg(`The selected slot duration (${durationMin} mins) is shorter than the required interview duration (${interview.duration} mins).`);
      return;
    }

    // Check if slot falls in requested date range
    const rangeStart = new Date(interview.startDate).getTime();
    const rangeEnd = new Date(interview.endDate).getTime();
    
    // Add margin for date comparisons (start of start date, end of end date)
    const startOfDay = new Date(interview.startDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(interview.endDate);
    endOfDay.setHours(23, 59, 59, 999);

    if (startObj.getTime() < startOfDay.getTime() || endObj.getTime() > endOfDay.getTime()) {
      setErrorMsg(`Slots must be within the recruiter's requested date range (${new Date(interview.startDate).toLocaleDateString()} to ${new Date(interview.endDate).toLocaleDateString()}).`);
      return;
    }

    // Prevent duplicate entries
    const isDuplicate = slots.some(
      (s) => s.startTime === startObj.toISOString() && s.endTime === endObj.toISOString()
    );
    if (isDuplicate) {
      setErrorMsg('This time slot is already added.');
      return;
    }

    setSlots([...slots, { startTime: startObj.toISOString(), endTime: endObj.toISOString() }]);
    setInputDate('');
    setErrorMsg('');
  };

  // Remove slot
  const handleRemoveSlot = (index: number) => {
    setSlots(slots.filter((_, idx) => idx !== index));
  };

  // Submit all slots
  const handleSubmitSlots = async () => {
    if (slots.length === 0) {
      setErrorMsg('Please add at least one available slot.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/availability/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: panel.token,
          slots,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit availability.');
      }

      setIsSubmitted(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error occurred while saving availability.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Submited success screen
  if (isSubmitted) {
    return (
      <div className="glass-card text-center animate-pulse-once" style={{ padding: '3rem 2rem' }}>
        <CheckCircle size={56} style={{ color: 'var(--success)', margin: '0 auto 1.5rem' }} />
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Availability Recorded</h2>
        <p className="text-muted" style={{ fontSize: '0.95rem', marginBottom: '2rem' }}>
          Thank you, <strong>{panel.name}</strong>. Your availability for the <strong>{interview.role}</strong> interview has been successfully saved.
        </p>
        
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', textAlign: 'left', marginBottom: '2rem' }}>
          <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>Submitted Slots:</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {slots.map((s, idx) => {
              const start = new Date(s.startTime);
              const end = new Date(s.endTime);
              return (
                <div key={idx} style={{ fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  <span className="font-semibold">{start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} (UTC)</span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-muted text-xs">
          The recruiter will review the overlapping slots and book the meeting. You will receive a calendar invite automatically. You can close this tab now.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card">
      {/* Title block */}
      <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="badge badge-info" style={{ marginBottom: '0.75rem' }}>
          Interview Panel Availability Request
        </div>
        <h2 style={{ fontSize: '1.6rem', marginBottom: '0.25rem' }}>Nomination for {interview.role} Interview</h2>
        <p className="text-muted text-sm">
          Hi <strong>{panel.name}</strong>, you have been selected to interview a candidate. Please provide your available times.
        </p>
      </div>

      {/* Interview metadata */}
      <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1rem', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-md)', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <span className="text-muted text-xs block">Candidate</span>
          <span className="font-bold">{interview.candidateName}</span>
        </div>
        <div>
          <span className="text-muted text-xs block">Required Duration</span>
          <span className="font-bold flex-gap-2">
            <Clock size={14} className="text-muted" /> {interview.duration} minutes
          </span>
        </div>
        <div>
          <span className="text-muted text-xs block">Date Limits Requested</span>
          <span className="font-semibold text-sm">
            {new Date(interview.startDate).toLocaleDateString()} to {new Date(interview.endDate).toLocaleDateString()}
          </span>
        </div>
        <div>
          <span className="text-muted text-xs block">Panel Email</span>
          <span className="text-sm text-muted">{panel.email}</span>
        </div>
      </div>

      {/* Date builder form */}
      <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Add Your Free Slots</h3>
      
      <form onSubmit={handleAddSlot} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr auto', gap: '1rem', alignItems: 'end', marginBottom: '1.5rem' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Date</label>
          <input 
            type="date" 
            className="form-input" 
            min={minDate} 
            max={maxDate} 
            value={inputDate} 
            onChange={(e) => setInputDate(e.target.value)} 
            required 
          />
        </div>
        
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Start Time</label>
          <input 
            type="time" 
            className="form-input" 
            value={inputStart} 
            onChange={(e) => setInputStart(e.target.value)} 
            required 
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">End Time</label>
          <input 
            type="time" 
            className="form-input" 
            value={inputEnd} 
            onChange={(e) => setInputEnd(e.target.value)} 
            required 
          />
        </div>

        <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem', minWidth: '44px', height: '44px' }}>
          <Plus size={18} />
        </button>
      </form>

      {/* Error displays */}
      {errorMsg && (
        <div style={{ color: 'var(--danger)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.5rem', background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Configured Slots */}
      <div style={{ marginBottom: '2rem' }}>
        <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>Your Added Slots ({slots.length})</h4>
        
        {slots.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', border: '1px dashed var(--border-glass)', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.1)' }}>
            <span className="text-muted text-sm block">No slots added yet.</span>
            <span className="text-muted text-xs">Add one or more slots above matching when you are free.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
            {slots.map((slot, index) => {
              const startObj = new Date(slot.startTime);
              const endObj = new Date(slot.endTime);

              return (
                <div 
                  key={index}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '0.6rem 1rem',
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
                    <span className="font-semibold">
                      {startObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-muted">
                      {startObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - {endObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} (UTC)
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => handleRemoveSlot(index)}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--danger)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = ''}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form Submission */}
      <button 
        className="btn btn-primary" 
        style={{ width: '100%', padding: '1rem' }} 
        disabled={slots.length === 0 || isSubmitting}
        onClick={handleSubmitSlots}
      >
        {isSubmitting ? (
          <>
            <Loader2 size={18} className="animate-spin" /> Saving your availability...
          </>
        ) : (
          'Submit Availability'
        )}
      </button>
    </div>
  );
}
