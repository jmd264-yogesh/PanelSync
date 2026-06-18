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

export default function AvailabilityClient({ interview, panel }: AvailabilityClientProps) {
  // Common states
  const [errorMsg, setErrorMsg] = useState('');
  const [isRejected, setIsRejected] = useState(panel.status === 'REJECTED');
  const [rejectReason, setRejectReason] = useState(panel.feedback || '');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  // Flow A: Panelist-First Booking (candidateName is "Pending Assignment")
  const isPendingAssignment = interview.candidateName === 'Pending Assignment';

  // State for Flow A
  const [isBooked, setIsBooked] = useState(interview.status === 'SCHEDULED');
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [bookedMeetings, setBookedMeetings] = useState<{ startTime: string; endTime: string; joinUrl: string; candidateName: string }[]>([]);
  const [isBooking, setIsBooking] = useState(false);
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);

  // State for Flow B (Original Availability submission builder)
  const [isSubmitted, setIsSubmitted] = useState(panel.status === 'SUBMITTED');
  const [slots, setSlots] = useState<{ startTime: string; endTime: string }[]>(
    panel.availabilities.map((a) => ({ startTime: a.startTime, endTime: a.endTime }))
  );
  const [inputDate, setInputDate] = useState('');
  const [inputStart, setInputStart] = useState('09:00');
  const [inputEnd, setInputEnd] = useState('17:00');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Date limit strings for Flow B
  const minDate = new Date(interview.startDate).toISOString().split('T')[0];
  const maxDate = new Date(interview.endDate).toISOString().split('T')[0];

  // Flow A actions
  const toggleSlotSelection = (slotId: string) => {
    setSelectedSlots((prev) =>
      prev.includes(slotId)
        ? prev.filter((id) => id !== slotId)
        : [...prev, slotId]
    );
  };

  const handleBookSelectedSlots = async () => {
    if (selectedSlots.length === 0) return;
    setIsBooking(true);
    setErrorMsg('');

    const slotsToBook = panel.availabilities
      .filter((a) => selectedSlots.includes(a.id))
      .map((a) => ({ startTime: a.startTime, endTime: a.endTime }));

    try {
      const res = await fetch('/api/availability/select-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: panel.token,
          slots: slotsToBook,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to book slots.');
      }

      const data = await res.json();
      setBookedMeetings(data.meetings || []);
      setIsBooked(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred while booking selected slots.');
    } finally {
      setIsBooking(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!rejectReason.trim()) return;
    setIsRejecting(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/availability/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: panel.token,
          reason: rejectReason.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to decline request.');
      }

      setIsRejected(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred while declining the request.');
    } finally {
      setIsRejecting(false);
    }
  };

  // Flow B actions
  const handleAddSlot = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!inputDate) {
      setErrorMsg('Please select a date.');
      return;
    }

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

    const startOfDay = new Date(interview.startDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(interview.endDate);
    endOfDay.setHours(23, 59, 59, 999);

    if (startObj.getTime() < startOfDay.getTime() || endObj.getTime() > endOfDay.getTime()) {
      setErrorMsg(`Slots must be within the recruiter's requested date range (${new Date(interview.startDate).toLocaleDateString('en-US')} to ${new Date(interview.endDate).toLocaleDateString('en-US')}).`);
      return;
    }

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

  const handleRemoveSlot = (index: number) => {
    setSlots(slots.filter((_, idx) => idx !== index));
  };

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

  // If the panelist declined the nomination
  if (isRejected) {
    return (
      <div className="glass-card text-center animate-pulse-once" style={{ padding: '3rem 2rem' }}>
        <AlertCircle size={56} style={{ color: '#ef4444', margin: '0 auto 1.5rem' }} />
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Nomination Declined</h2>
        <p className="text-muted" style={{ fontSize: '0.95rem', marginBottom: '2rem' }}>
          Thank you, <strong>{panel.name}</strong>. You have declined the nomination for the <strong>{interview.role}</strong> interview.
        </p>
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', textAlign: 'left', marginBottom: '2rem' }}>
          <span className="text-xs text-muted block" style={{ marginBottom: '0.25rem' }}>Decline Reason</span>
          <span className="text-sm font-semibold">{rejectReason}</span>
        </div>
        <p className="text-muted text-xs">
          The coordinator has been notified of your response. You can safely close this page now.
        </p>
      </div>
    );
  }

  // If the interview is already scheduled, show the scheduled card to any accessing panelist
  if (interview.status === 'SCHEDULED') {
    const start = interview.scheduledSlotStart ? new Date(interview.scheduledSlotStart) : null;
    const end = interview.scheduledSlotEnd ? new Date(interview.scheduledSlotEnd) : null;

    return (
      <div className="glass-card text-center animate-pulse-once" style={{ padding: '3rem 2rem' }}>
        <CheckCircle size={56} style={{ color: 'var(--success)', margin: '0 auto 1.5rem' }} />
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Interview Scheduled</h2>
        <p className="text-muted" style={{ fontSize: '0.95rem', marginBottom: '2rem' }}>
          Thank you, <strong>{panel.name}</strong>. The <strong>{interview.role}</strong> interview is officially scheduled.
        </p>
        
        {start && end && (
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', textAlign: 'left', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <Calendar size={18} className="text-primary" />
              <div>
                <span className="text-xs text-muted block">Date</span>
                <span className="font-semibold text-sm">
                  {start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <Clock size={18} className="text-primary" />
              <div>
                <span className="text-xs text-muted block">Time (IST)</span>
                <span className="font-semibold text-sm">
                  {start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
            {interview.teamsMeetingUrl && (
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <Video size={18} className="text-primary" />
                <div>
                  <span className="text-xs text-muted block">Teams Meeting Link</span>
                  <a href={interview.teamsMeetingUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary flex-gap-1 hover-underline">
                    Join Teams Meeting <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-muted text-xs">
          A calendar invitation has been sent to your Outlook account. You can safely close this page now.
        </p>
      </div>
    );
  }

  // --- RENDER FLOW A: PANEL DELIVERED CHOICE FLOW ---
  if (isPendingAssignment) {
    if (isBooked) {
      return (
        <div className="glass-card text-center animate-pulse-once" style={{ padding: '3rem 2rem' }}>
          <CheckCircle size={56} style={{ color: 'var(--success)', margin: '0 auto 1.5rem' }} />
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Interview Scheduled</h2>
          <p className="text-muted" style={{ fontSize: '0.95rem', marginBottom: '2rem' }}>
            Thank you, <strong>{panel.name}</strong>. The <strong>{interview.role}</strong> interview slot bookings are confirmed.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '350px', overflowY: 'auto', marginBottom: '2rem', paddingRight: '4px' }}>
            {bookedMeetings.map((meeting, idx) => {
              const start = new Date(meeting.startTime);
              const end = new Date(meeting.endTime);
              return (
                <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', textAlign: 'left' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                    Slot Booking #{idx + 1}: {meeting.candidateName}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <Calendar size={16} className="text-primary" />
                    <div>
                      <span className="text-xs text-muted block">Date</span>
                      <span className="font-semibold text-xs">
                        {start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <Clock size={16} className="text-primary" />
                    <div>
                      <span className="text-xs text-muted block">Time (IST)</span>
                      <span className="font-semibold text-xs">
                        {start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  {meeting.joinUrl && (
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <Video size={16} className="text-primary" />
                      <div>
                        <span className="text-xs text-muted block">Teams Meeting Link</span>
                        <a href={meeting.joinUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary flex-gap-1 hover-underline">
                          Join Teams Meeting <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-muted text-xs">
            A calendar invitation has been sent to your Outlook account. You can safely close this page now.
          </p>
        </div>
      );
    }

    return (
      <div className="glass-card">
        {/* Title block */}
        <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="badge badge-info" style={{ marginBottom: '0.75rem' }}>
            Interview Slot Selection
          </div>
          <h2 style={{ fontSize: '1.6rem', marginBottom: '0.25rem' }}>Select Slots for {interview.role}</h2>
          <p className="text-muted text-sm">
            Hi <strong>{panel.name}</strong>, please select **one or more** of the proposed slots below. You can book multiple slots if you are free to conduct multiple interviews.
          </p>
        </div>

        {errorMsg && (
          <div style={{ color: 'var(--danger)', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.5rem', background: 'var(--danger-glow)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Proposed Slots List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
          {panel.availabilities.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', border: '1px dashed var(--border-glass)', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.1)' }}>
              <span className="text-muted text-sm block">No proposed slots found.</span>
              <span className="text-muted text-xs">Please contact the recruiter to propose slots.</span>
            </div>
          ) : (
            panel.availabilities.map((slot) => {
              const start = new Date(slot.startTime);
              const end = new Date(slot.endTime);
              const isSelected = selectedSlots.includes(slot.id);

              return (
                <div
                  key={slot.id}
                  onClick={() => toggleSlotSelection(slot.id)}
                  onMouseEnter={() => setHoveredSlotId(slot.id)}
                  onMouseLeave={() => setHoveredSlotId(null)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1.25rem',
                    background: isSelected ? 'rgba(99, 102, 241, 0.08)' : (hoveredSlotId === slot.id ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)'),
                    border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transform: isSelected ? 'translateY(-2px)' : 'none',
                    boxShadow: isSelected ? '0 4px 20px rgba(99, 102, 241, 0.15)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      border: isSelected ? '2px solid var(--primary)' : '2px solid var(--border-glass)',
                      background: isSelected ? 'var(--primary)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                      flexShrink: 0
                    }}>
                      {isSelected && (
                        <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }}>✓</span>
                      )}
                    </div>
                    <div>
                      <span className="font-semibold block text-sm">
                        {start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span className="text-xs text-muted">
                        {start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} (IST)
                      </span>
                    </div>
                  </div>
                  <span className="text-muted text-xs">
                    {isSelected ? 'Selected' : 'Click to select'}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Action Button */}
        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '1rem' }}
          disabled={selectedSlots.length === 0 || isBooking}
          onClick={handleBookSelectedSlots}
        >
          {isBooking ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Booking selected slots...
            </>
          ) : (
            `Book Selected Slot${selectedSlots.length > 1 ? 's' : ''} (${selectedSlots.length})`
          )}
        </button>

        <p className="text-muted text-xs text-center" style={{ marginTop: '1rem' }}>
          Note: This booking will immediately reserve Teams meeting rooms and coordinate calendar schedules.
        </p>

        {/* Rejection Option */}
        <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1.5rem' }}>
          {!showRejectForm ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-xs text-muted">Unable to take this interview?</span>
              <button
                onClick={() => { setShowRejectForm(true); setErrorMsg(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
              >
                Decline Nomination
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(239, 68, 68, 0.02)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ef4444', margin: 0 }}>Decline Interview Nomination</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Please let us know why you are declining so we can re-assign the candidate.
              </p>
              <textarea
                placeholder="Reason for declining (required)..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'inherit',
                  fontSize: '0.9rem',
                  resize: 'none'
                }}
              />
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setShowRejectForm(false); setRejectReason(''); }}
                  disabled={isRejecting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!rejectReason.trim() || isRejecting}
                  onClick={handleRejectRequest}
                  style={{
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    opacity: (!rejectReason.trim() || isRejecting) ? 0.5 : 1
                  }}
                >
                  {isRejecting ? 'Declining...' : 'Confirm Decline'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- RENDER FLOW B: ORIGINAL MULTI-AVAILABILITY SUBMISSION FLOW ---
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
                  <span>{start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  <span className="font-semibold">{start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} (IST)</span>
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
            {new Date(interview.startDate).toLocaleDateString('en-US')} to {new Date(interview.endDate).toLocaleDateString('en-US')}
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
                      {startObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-muted">
                      {startObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - {endObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} (IST)
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

      {/* Rejection Option */}
      <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1.5rem' }}>
        {!showRejectForm ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-xs text-muted">Unable to take this interview?</span>
            <button
              onClick={() => { setShowRejectForm(true); setErrorMsg(''); }}
              style={{
                background: 'none',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 600,
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ''}
            >
              Decline Nomination
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(239, 68, 68, 0.02)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ef4444', margin: 0 }}>Decline Interview Nomination</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              Please let us know why you are declining so we can re-assign the candidate.
            </p>
            <textarea
              placeholder="Reason for declining (required)..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-sm)',
                color: 'inherit',
                fontSize: '0.9rem',
                resize: 'none'
              }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => { setShowRejectForm(false); setRejectReason(''); }}
                disabled={isRejecting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={!rejectReason.trim() || isRejecting}
                onClick={handleRejectRequest}
                style={{
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  opacity: (!rejectReason.trim() || isRejecting) ? 0.5 : 1
                }}
              >
                {isRejecting ? 'Declining...' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
