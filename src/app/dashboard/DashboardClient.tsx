'use client';

import React, { useState, useEffect } from 'react';
import { 
  Interview, 
  InterviewPanel, 
  PanelAvailability 
} from '@/lib/db';
import { GraphUser } from '@/lib/graph';
import { 
  Plus, 
  Calendar, 
  User, 
  Mail, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Search, 
  Loader2, 
  Trash2, 
  Video, 
  Check, 
  Info,
  CalendarCheck,
  ChevronRight
} from 'lucide-react';

interface DashboardClientProps {
  initialInterviews: Interview[];
}

export default function DashboardClient({ initialInterviews }: DashboardClientProps) {
  // DB States
  const [interviews, setInterviews] = useState<Interview[]>(initialInterviews);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);

  // Layout View States
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Create Form Formik-like States
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [role, setRole] = useState('');
  const [duration, setDuration] = useState('45');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Panel Search States
  const [panelSearchQuery, setPanelSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GraphUser[]>([]);
  const [isSearchingPanels, setIsSearchingPanels] = useState(false);
  const [selectedPanels, setSelectedPanels] = useState<GraphUser[]>([]);

  // Booking details States
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [bookingDescription, setBookingDescription] = useState('');
  const [isBooking, setIsBooking] = useState(false);

  // Sync selected interview details if the interviews list updates
  useEffect(() => {
    if (selectedInterview) {
      const updated = interviews.find((i) => i.id === selectedInterview.id);
      setSelectedInterview(updated || null);
    }
  }, [interviews, selectedInterview]);

  // Autocomplete Panel Search Query handler
  useEffect(() => {
    if (panelSearchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearchingPanels(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(panelSearchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          // Filter out users already selected
          const filtered = data.filter(
            (u: GraphUser) => !selectedPanels.some((sp) => sp.id === u.id)
          );
          setSearchResults(filtered);
        }
      } catch (err) {
        console.error('Error searching panels:', err);
      } finally {
        setIsSearchingPanels(false);
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [panelSearchQuery, selectedPanels]);

  // Handle adding panel from search
  const handleAddPanel = (user: GraphUser) => {
    setSelectedPanels([...selectedPanels, user]);
    setPanelSearchQuery('');
    setSearchResults([]);
  };

  // Handle removing panel
  const handleRemovePanel = (userId: string) => {
    setSelectedPanels(selectedPanels.filter((p) => p.id !== userId));
  };

  // Submit new interview create form
  const handleCreateInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPanels.length === 0) {
      alert('Please select at least one panel member.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/interviews/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateName,
          candidateEmail,
          role,
          duration: parseInt(duration, 10),
          startDate,
          endDate,
          panels: selectedPanels,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to submit interview invitation.');
      }

      const result = await res.json();
      setInterviews([result.interview, ...interviews]);
      
      // Reset form fields
      setCandidateName('');
      setCandidateEmail('');
      setRole('');
      setDuration('45');
      setStartDate('');
      setEndDate('');
      setSelectedPanels([]);
      setShowCreateForm(false);
      setSelectedInterview(result.interview);
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Error occurred while saving');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit booked slot
  const handleBookSlot = async () => {
    if (!selectedInterview || !selectedSlot) return;

    setIsBooking(true);
    try {
      const res = await fetch('/api/interviews/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: selectedInterview.id,
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
          description: bookingDescription,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to book meeting');
      }

      // Re-fetch list or update local state
      const updatedList = interviews.map((i) => {
        if (i.id === selectedInterview.id) {
          return {
            ...i,
            status: 'SCHEDULED' as const,
            scheduledSlotStart: selectedSlot.start,
            scheduledSlotEnd: selectedSlot.end,
          };
        }
        return i;
      });
      
      // Force refresh data
      const refreshRes = await fetch(`/api/interviews/create`); // simple page triggers next reload, let's just update local state:
      setInterviews(updatedList);
      setSelectedSlot(null);
      setBookingDescription('');
      
      // Fetch fresh details from server for accuracy
      const detailRes = await fetch('/api/interviews/create'); // We can query database details. For now let's just refresh page
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Error scheduling meeting');
    } finally {
      setIsBooking(false);
    }
  };

  // Delete an interview
  const handleDeleteInterview = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this interview record? This will not delete any already scheduled Teams events, but will remove it from the dashboard.')) {
      return;
    }

    try {
      const res = await fetch(`/api/interviews/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setInterviews(interviews.filter((i) => i.id !== id));
        if (selectedInterview?.id === id) {
          setSelectedInterview(null);
        }
      } else {
        alert('Failed to delete interview');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Overlapping Availability Calculation Logic
  const getOverlappingSlots = (interview: Interview) => {
    const panels = interview.panels;
    if (!panels || panels.length === 0) return [];

    const activePanels = panels.filter((p) => p.status === 'SUBMITTED');
    if (activePanels.length === 0) return [];

    const duration = interview.duration;
    const limitStart = new Date(interview.startDate);
    const limitEnd = new Date(interview.endDate);

    const intervalMin = 15;
    const chunkMs = intervalMin * 60 * 1000;
    const durationMs = duration * 60 * 1000;

    const startMs = limitStart.getTime();
    const endMs = limitEnd.getTime();

    const matches: { start: string; end: string }[] = [];

    // Increment in 15 minute steps
    for (let time = startMs; time + durationMs <= endMs; time += chunkMs) {
      const slotStart = new Date(time);
      const slotEnd = new Date(time + durationMs);

      // Check if ALL active panels are available for this specific block
      const allAvailable = activePanels.every((panel) => {
        return panel.availabilities.some((avail) => {
          const availStart = new Date(avail.startTime).getTime();
          const availEnd = new Date(avail.endTime).getTime();
          return availStart <= slotStart.getTime() && availEnd >= slotEnd.getTime();
        });
      });

      if (allAvailable) {
        matches.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
        });
      }
    }

    // Filter overlapping suggestions: group similar blocks starting within 30 min of each other
    return matches.filter((slot, idx) => {
      if (idx === 0) return true;
      const prev = matches[idx - 1];
      const prevStart = new Date(prev.start).getTime();
      const currentStart = new Date(slot.start).getTime();
      return currentStart - prevStart >= 30 * 60 * 1000;
    });
  };

  const commonSlots = selectedInterview ? getOverlappingSlots(selectedInterview) : [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
      
      {/* Left Column: Active Interview Schedule Requests */}
      <div>
        <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Active Interviews</h2>
          
          <button 
            className="btn btn-primary btn-sm flex-gap-2"
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              setSelectedInterview(null);
            }}
          >
            <Plus size={16} />
            New Interview
          </button>
        </div>

        {interviews.length === 0 ? (
          <div className="glass-card text-center" style={{ padding: '4rem 2rem' }}>
            <CalendarCheck size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
            <h4 style={{ marginBottom: '0.5rem' }}>No Interviews Yet</h4>
            <p className="text-muted text-sm">Create a new interview schedule to nominate panels and book slots.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {interviews.map((interview) => {
              const totalPanels = interview.panels.length;
              const submittedPanels = interview.panels.filter((p) => p.status === 'SUBMITTED').length;
              const isSelected = selectedInterview?.id === interview.id;

              return (
                <div 
                  key={interview.id} 
                  className={`glass-card ${isSelected ? 'selected-interview' : ''}`}
                  style={{ 
                    padding: '1.25rem 1.5rem', 
                    cursor: 'pointer',
                    borderColor: isSelected ? 'var(--primary)' : 'var(--border-glass)',
                    boxShadow: isSelected ? '0 0 15px rgba(99, 102, 241, 0.2)' : 'var(--shadow-card)'
                  }}
                  onClick={() => {
                    setSelectedInterview(interview);
                    setShowCreateForm(false);
                    setSelectedSlot(null);
                  }}
                >
                  <div className="flex-between">
                    <div>
                      <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{interview.candidateName}</h4>
                      <p className="text-muted text-xs flex-gap-2" style={{ marginBottom: '0.75rem' }}>
                        <Mail size={12} /> {interview.candidateEmail}
                      </p>
                    </div>
                    <div>
                      {interview.status === 'PENDING' && (
                        <span className="badge badge-pending">Pending Panel Response</span>
                      )}
                      {interview.status === 'COLLECTED' && (
                        <span className="badge badge-success">Ready to Book</span>
                      )}
                      {interview.status === 'SCHEDULED' && (
                        <span className="badge badge-info">Scheduled</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                    <div>
                      <div className="text-muted text-xs" style={{ marginBottom: '2px' }}>Role / Position</div>
                      <div className="text-sm font-semibold">{interview.role} ({interview.duration} mins)</div>
                    </div>
                    <div>
                      <div className="text-muted text-xs" style={{ marginBottom: '2px' }}>Panel Submissions</div>
                      <div className="text-sm font-semibold flex-gap-2">
                        <span>{submittedPanels} / {totalPanels} Responded</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-between" style={{ marginTop: '0.75rem' }}>
                    <span className="text-muted text-xs flex-gap-2">
                      <Clock size={12} /> Range: {new Date(interview.startDate).toLocaleDateString()} - {new Date(interview.endDate).toLocaleDateString()}
                    </span>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      style={{ padding: '0.25rem', borderRadius: '4px', border: 'none', background: 'transparent' }}
                      onClick={(e) => handleDeleteInterview(interview.id, e)}
                    >
                      <Trash2 size={14} className="text-muted" style={{ transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'} onMouseLeave={(e) => e.currentTarget.style.color = ''} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Column: Dynamic Form / Detail Split workspace */}
      <div>
        {/* State A: Schedule Form */}
        {showCreateForm && (
          <div className="glass-card" style={{ position: 'sticky', top: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Schedule New Interview</h3>
            
            <form onSubmit={handleCreateInterview}>
              <div className="form-group">
                <label className="form-label">Candidate Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={candidateName} 
                  onChange={(e) => setCandidateName(e.target.value)} 
                  placeholder="John Doe"
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Candidate Email</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={candidateEmail} 
                  onChange={(e) => setCandidateEmail(e.target.value)} 
                  placeholder="john.doe@external.com"
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Job Title / Role</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={role} 
                  onChange={(e) => setRole(e.target.value)} 
                  placeholder="Senior Staff Software Engineer"
                  required 
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Duration</label>
                  <select 
                    className="form-input" 
                    value={duration} 
                    onChange={(e) => setDuration(e.target.value)}
                  >
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">60 minutes</option>
                    <option value="90">90 minutes</option>
                  </select>
                </div>
                <div className="form-group">
                  {/* Empty spacer or additional selection */}
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Proposed Range Start</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Proposed Range End</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              {/* Panel Selection Autocomplete */}
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Nominated Panels (M365 Directory)</label>
                <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                  <Search size={16} className="text-muted" style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ paddingLeft: '2.25rem' }}
                    value={panelSearchQuery} 
                    onChange={(e) => setPanelSearchQuery(e.target.value)} 
                    placeholder="Type employee name..." 
                  />
                  {isSearchingPanels && (
                    <Loader2 size={16} className="animate-pulse text-muted" style={{ position: 'absolute', right: '12px' }} />
                  )}
                </div>

                {/* Suggestions List */}
                {searchResults.length > 0 && (
                  <div 
                    style={{ 
                      position: 'absolute', 
                      top: '100%', 
                      left: 0, 
                      right: 0, 
                      zIndex: 10, 
                      background: 'var(--bg-surface)', 
                      border: '1px solid var(--border-glass)', 
                      borderRadius: 'var(--radius-md)', 
                      boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
                      marginTop: '4px',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}
                  >
                    {searchResults.map((user) => (
                      <div 
                        key={user.id}
                        style={{ padding: '0.6rem 1rem', cursor: 'pointer', transition: 'var(--transition-fast)' }}
                        className="search-item-hover"
                        onClick={() => handleAddPanel(user)}
                      >
                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{user.displayName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.mail || user.userPrincipalName}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selected Panels List */}
              {selectedPanels.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem', marginTop: '-0.5rem' }}>
                  {selectedPanels.map((panel) => (
                    <div 
                      key={panel.id} 
                      style={{ 
                        background: 'var(--primary-glow)', 
                        border: '1px solid var(--primary)', 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '100px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.8rem'
                      }}
                    >
                      <span>{panel.displayName}</span>
                      <button 
                        type="button" 
                        onClick={() => handleRemovePanel(panel.id)}
                        style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '1rem' }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Dispatching Invites...
                  </>
                ) : (
                  'Send Teams Invites'
                )}
              </button>
            </form>
          </div>
        )}

        {/* State B: Interview Details Workspace */}
        {selectedInterview && (
          <div className="glass-card" style={{ position: 'sticky', top: '2rem' }}>
            <div className="flex-between" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '1rem' }}>
              <div>
                <span className="text-muted text-xs" style={{ display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Interview Details</span>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>{selectedInterview.candidateName}</h3>
              </div>
              
              <button 
                className="btn btn-secondary btn-sm" 
                style={{ padding: '0.4rem 0.6rem' }}
                onClick={() => setSelectedInterview(null)}
              >
                Close
              </button>
            </div>

            {/* Candidate & Role detail card */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div className="text-muted text-xs">Role</div>
                  <div className="text-sm font-semibold">{selectedInterview.role}</div>
                </div>
                <div>
                  <div className="text-muted text-xs">Interview Duration</div>
                  <div className="text-sm font-semibold">{selectedInterview.duration} minutes</div>
                </div>
                <div>
                  <div className="text-muted text-xs">Candidate Email</div>
                  <div className="text-sm font-semibold" style={{ wordBreak: 'break-all' }}>{selectedInterview.candidateEmail}</div>
                </div>
                <div>
                  <div className="text-muted text-xs">Requested Date Range</div>
                  <div className="text-sm font-semibold">
                    {new Date(selectedInterview.startDate).toLocaleDateString()} - {new Date(selectedInterview.endDate).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Nominations Panel details */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }} className="flex-gap-2">
                <User size={16} /> Panels Status
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedInterview.panels.map((p) => (
                  <div 
                    key={p.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem',
                      background: 'rgba(255,255,255,0.01)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-glass)'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.name}</div>
                      <div className="text-muted text-xs">{p.email}</div>
                    </div>
                    <div>
                      {p.status === 'SUBMITTED' ? (
                        <div className="flex-gap-2 badge badge-success" style={{ fontSize: '0.65rem' }}>
                          <CheckCircle size={10} /> Submitted
                        </div>
                      ) : (
                        <div className="flex-gap-2 badge badge-pending" style={{ fontSize: '0.65rem' }}>
                          <Clock size={10} /> Pending
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* State B1: Already Scheduled Details */}
            {selectedInterview.status === 'SCHEDULED' ? (
              <div style={{ background: 'var(--success-glow)', border: '1px solid var(--success)', padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ color: 'var(--success)', fontSize: '1.05rem', marginBottom: '0.5rem' }} className="flex-gap-2">
                  <CheckCircle size={18} /> Meeting Scheduled!
                </h4>
                
                <div style={{ fontSize: '0.9rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div>
                    <span className="text-muted text-xs block">Date & Time</span>
                    <strong>{new Date(selectedInterview.scheduledSlotStart || '').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                  </div>
                  <div>
                    <span className="text-muted text-xs block">Slot</span>
                    <strong>
                      {new Date(selectedInterview.scheduledSlotStart || '').toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedInterview.scheduledSlotEnd || '').toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} (UTC)
                    </strong>
                  </div>
                </div>

                {selectedInterview.teamsMeetingUrl && (
                  <a 
                    href={selectedInterview.teamsMeetingUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn btn-primary flex-gap-2"
                    style={{ width: '100%', background: 'var(--success)', border: 'none' }}
                  >
                    <Video size={16} /> Join Teams Meeting
                  </a>
                )}
              </div>
            ) : (
              /* State B2: Collect Availability Slots and Book */
              <div>
                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }} className="flex-gap-2">
                  <Calendar size={16} /> Computed Overlapping Free Slots
                </h4>

                {selectedInterview.panels.filter((p) => p.status === 'SUBMITTED').length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', border: '1px dashed var(--border-glass)', borderRadius: 'var(--radius-md)' }}>
                    <Info size={24} className="text-muted" style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>No availability data yet.</div>
                    <p className="text-muted text-xs">We will compute slot options as soon as at least one panel member submits availability.</p>
                  </div>
                ) : commonSlots.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', border: '1px dashed var(--border-glass)', borderRadius: 'var(--radius-md)' }}>
                    <Info size={24} className="text-muted" style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>No overlapping slots found.</div>
                    <p className="text-muted text-xs">There are no common slots of {selectedInterview.duration} mins matching everyone's submission. Coordinate manual booking.</p>
                  </div>
                ) : (
                  <div>
                    {/* Time Slot List */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', marginBottom: '1.25rem', paddingRight: '4px' }}>
                      {commonSlots.map((slot, index) => {
                        const startObj = new Date(slot.start);
                        const endObj = new Date(slot.end);
                        const isSlotSelected = selectedSlot?.start === slot.start;

                        return (
                          <div 
                            key={index}
                            onClick={() => setSelectedSlot(slot)}
                            style={{ 
                              padding: '0.75rem 1rem', 
                              cursor: 'pointer',
                              background: isSlotSelected ? 'var(--primary-glow)' : 'rgba(255,255,255,0.01)',
                              border: isSlotSelected ? '1px solid var(--primary)' : '1px solid var(--border-glass)',
                              borderRadius: 'var(--radius-sm)',
                              transition: 'var(--transition-fast)'
                            }}
                            className={!isSlotSelected ? 'search-item-hover' : ''}
                          >
                            <div className="flex-between">
                              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                {startObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' })}
                              </span>
                              <span style={{ fontSize: '0.8rem', color: isSlotSelected ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                                {startObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} - {endObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} (UTC)
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Booking Form Details */}
                    {selectedSlot && (
                      <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }} className="animate-pulse-once">
                        <div className="form-group">
                          <label className="form-label">Invitation Message / Agenda</label>
                          <textarea 
                            className="form-input"
                            rows={3}
                            style={{ resize: 'none' }}
                            value={bookingDescription}
                            onChange={(e) => setBookingDescription(e.target.value)}
                            placeholder="Provide details about the interview topics, code challenge, or panel focus..."
                          />
                        </div>

                        <button 
                          className="btn btn-primary" 
                          style={{ width: '100%' }}
                          onClick={handleBookSlot}
                          disabled={isBooking}
                        >
                          {isBooking ? (
                            <>
                              <Loader2 size={16} className="animate-spin" /> Scheduling Teams Event...
                            </>
                          ) : (
                            'Confirm Teams Booking'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* State C: Idle workspace state */}
        {!showCreateForm && !selectedInterview && (
          <div className="glass-card text-center" style={{ padding: '6rem 2rem', position: 'sticky', top: '2rem' }}>
            <Calendar size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1.5rem', opacity: 0.3 }} />
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Select an Interview</h3>
            <p className="text-muted text-sm" style={{ maxWidth: '300px', margin: '0 auto' }}>
              Choose an interview card from the left panel to review responses, check overlaps, and book the meeting.
            </p>
          </div>
        )}
      </div>

      <style jsx global>{`
        .selected-interview {
          background: rgba(99, 102, 241, 0.05) !important;
        }
        .search-item-hover:hover {
          background: rgba(255, 255, 255, 0.04) !important;
        }
        .block {
          display: block;
        }
      `}</style>
    </div>
  );
}
