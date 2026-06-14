import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, inArray, desc } from 'drizzle-orm';
import * as schema from './schema';

export interface PanelAvailability {
  id: string;
  panelId: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
}

export interface InterviewPanel {
  id: string;
  interviewId: string;
  userId: string;       // MS Graph user ID
  name: string;
  email: string;
  token: string;        // Secure unique token for URL access
  status: 'PENDING' | 'SUBMITTED';
  submittedAt?: string; // ISO string
  availabilities: PanelAvailability[];
}

export interface Interview {
  id: string;
  candidateName: string;
  candidateEmail: string;
  role: string;
  duration: number;        // minutes
  startDate: string;       // ISO string
  endDate: string;         // ISO string
  status: 'PENDING' | 'COLLECTED' | 'SCHEDULED' | 'CANCELLED';
  teamsMeetingUrl?: string;
  calendarEventId?: string;
  scheduledSlotStart?: string; // ISO string
  scheduledSlotEnd?: string;   // ISO string
  createdAt: string;       // ISO string
  updatedAt: string;       // ISO string
  panels: InterviewPanel[];
}

export interface Panelist {
  id: string;            // Microsoft Graph User ID
  displayName: string;
  email: string;
  roles: ('L1' | 'L2')[]; // L1 or L2 panel capabilities
  createdAt: string;
}

export interface UploadedCandidate {
  id: string;
  name: string;
  email: string;
  status: 'WAITING' | 'MAPPED';
  mappedInterviewId?: string;
  preferredDate?: string;
  outcomeStatus?: string;
  createdAt: string;
}

export interface PanelistInterview {
  interviewId: string;
  role: string;
  duration: number;
  scheduledSlotStart: string;
  scheduledSlotEnd: string;
  teamsMeetingUrl: string | null;
  candidateName: string;
  candidateEmail: string;
  candidateId: string | null;
  outcomeStatus: string | null;
  panelId: string;
  panelDecision: string | null;
  panelFeedback: string | null;
  panelistRoles: string[];
}


// 1. Initialize Drizzle Neon HTTP Serverless client
const connectionString = process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder';
const sql = neon(connectionString);
export const dbClient = drizzle(sql, { schema });

// Helper to clean up default mock panelists and ensure database starts clean
async function ensureSeeded() {
  try {
    // Clean up mock panelists if they were previously seeded
    await dbClient.delete(schema.panelists).where(
      inArray(schema.panelists.id, ['mock-panelist-1', 'mock-panelist-2', 'mock-panelist-3'])
    );
  } catch (error) {
    // Ignore error if database table isn't migrated/ready
  }
}

export const INITIAL_RECRUITERS = [
  'yogeshwarang@jmangroup.com',
  'jeffringoldwin@jmangroup.com',
  'vishnuprriya@jmangroup.com'
];

// 2. Database Helper Operations
export const db = {
  // Get all interviews sorted by newest
  getInterviews: async (): Promise<Interview[]> => {
    const interviewsRes = await dbClient.select().from(schema.interviews);
    
    const result: Interview[] = [];
    for (const intv of interviewsRes) {
      const panelsRes = await dbClient
        .select()
        .from(schema.interviewPanels)
        .where(eq(schema.interviewPanels.interviewId, intv.id));
        
      const panels: InterviewPanel[] = [];
      for (const p of panelsRes) {
        const avRes = await dbClient
          .select()
          .from(schema.panelAvailabilities)
          .where(eq(schema.panelAvailabilities.panelId, p.id));
          
        panels.push({
          id: p.id,
          interviewId: p.interviewId,
          userId: p.userId,
          name: p.name,
          email: p.email,
          token: p.token,
          status: p.status as 'PENDING' | 'SUBMITTED',
          submittedAt: p.submittedAt ? p.submittedAt.toISOString() : undefined,
          availabilities: avRes.map((av) => ({
            id: av.id,
            panelId: av.panelId,
            startTime: av.startTime.toISOString(),
            endTime: av.endTime.toISOString(),
          })),
        });
      }
      
      result.push({
        id: intv.id,
        candidateName: intv.candidateName,
        candidateEmail: intv.candidateEmail,
        role: intv.role,
        duration: intv.duration,
        startDate: intv.startDate.toISOString(),
        endDate: intv.endDate.toISOString(),
        status: intv.status as any,
        teamsMeetingUrl: intv.teamsMeetingUrl || undefined,
        calendarEventId: intv.calendarEventId || undefined,
        scheduledSlotStart: intv.scheduledSlotStart ? intv.scheduledSlotStart.toISOString() : undefined,
        scheduledSlotEnd: intv.scheduledSlotEnd ? intv.scheduledSlotEnd.toISOString() : undefined,
        createdAt: intv.createdAt ? intv.createdAt.toISOString() : new Date().toISOString(),
        updatedAt: intv.updatedAt ? intv.updatedAt.toISOString() : new Date().toISOString(),
        panels,
      });
    }
    
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  // Get a single interview
  getInterview: async (id: string): Promise<Interview | null> => {
    const [intv] = await dbClient.select().from(schema.interviews).where(eq(schema.interviews.id, id)).limit(1);
    if (!intv) return null;
    
    const panelsRes = await dbClient
      .select()
      .from(schema.interviewPanels)
      .where(eq(schema.interviewPanels.interviewId, intv.id));
      
    const panels: InterviewPanel[] = [];
    for (const p of panelsRes) {
      const avRes = await dbClient
        .select()
        .from(schema.panelAvailabilities)
        .where(eq(schema.panelAvailabilities.panelId, p.id));
        
      panels.push({
        id: p.id,
        interviewId: p.interviewId,
        userId: p.userId,
        name: p.name,
        email: p.email,
        token: p.token,
        status: p.status as 'PENDING' | 'SUBMITTED',
        submittedAt: p.submittedAt ? p.submittedAt.toISOString() : undefined,
        availabilities: avRes.map((av) => ({
          id: av.id,
          panelId: av.panelId,
          startTime: av.startTime.toISOString(),
          endTime: av.endTime.toISOString(),
        })),
      });
    }
    
    return {
      id: intv.id,
      candidateName: intv.candidateName,
      candidateEmail: intv.candidateEmail,
      role: intv.role,
      duration: intv.duration,
      startDate: intv.startDate.toISOString(),
      endDate: intv.endDate.toISOString(),
      status: intv.status as any,
      teamsMeetingUrl: intv.teamsMeetingUrl || undefined,
      calendarEventId: intv.calendarEventId || undefined,
      scheduledSlotStart: intv.scheduledSlotStart ? intv.scheduledSlotStart.toISOString() : undefined,
      scheduledSlotEnd: intv.scheduledSlotEnd ? intv.scheduledSlotEnd.toISOString() : undefined,
      createdAt: intv.createdAt ? intv.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: intv.updatedAt ? intv.updatedAt.toISOString() : new Date().toISOString(),
      panels,
    };
  },

  // Find panel and interview by token
  getInterviewByPanelToken: async (token: string): Promise<{ interview: Interview; panel: InterviewPanel } | null> => {
    const [panelRow] = await dbClient.select().from(schema.interviewPanels).where(eq(schema.interviewPanels.token, token)).limit(1);
    if (!panelRow) return null;
    
    const interview = await db.getInterview(panelRow.interviewId);
    if (!interview) return null;
    
    const activePanel = interview.panels.find((p) => p.id === panelRow.id);
    if (!activePanel) return null;
    
    return { interview, panel: activePanel };
  },

  // Create an interview
  createInterview: async (params: {
    candidateName: string;
    candidateEmail: string;
    role: string;
    duration: number;
    startDate: string;
    endDate: string;
    panels: { userId: string; name: string; email: string }[];
  }): Promise<Interview> => {
    const interviewId = crypto.randomUUID();
    const now = new Date();
    
    await dbClient.insert(schema.interviews).values({
      id: interviewId,
      candidateName: params.candidateName,
      candidateEmail: params.candidateEmail,
      role: params.role,
      duration: params.duration,
      startDate: new Date(params.startDate),
      endDate: new Date(params.endDate),
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    });
    
    for (const p of params.panels) {
      const panelId = crypto.randomUUID();
      const token = crypto.randomUUID().replace(/-/g, '');
      await dbClient.insert(schema.interviewPanels).values({
        id: panelId,
        interviewId,
        userId: p.userId,
        name: p.name,
        email: p.email,
        token,
        status: 'PENDING',
      });
    }
    
    const created = await db.getInterview(interviewId);
    if (!created) throw new Error('Failed to retrieve created interview');
    return created;
  },

  // Submit availability for a panel
  submitAvailability: async (panelToken: string, slots: { startTime: string; endTime: string }[]): Promise<boolean> => {
    const [panelRow] = await dbClient.select().from(schema.interviewPanels).where(eq(schema.interviewPanels.token, panelToken)).limit(1);
    if (!panelRow) return false;
    
    // 1. Wipe previous availability slots
    await dbClient.delete(schema.panelAvailabilities).where(eq(schema.panelAvailabilities.panelId, panelRow.id));
    
    // 2. Insert new slots
    for (const slot of slots) {
      const avId = crypto.randomUUID();
      await dbClient.insert(schema.panelAvailabilities).values({
        id: avId,
        panelId: panelRow.id,
        startTime: new Date(slot.startTime),
        endTime: new Date(slot.endTime),
      });
    }
    
    // 3. Update panel status to SUBMITTED
    const now = new Date();
    await dbClient
      .update(schema.interviewPanels)
      .set({ status: 'SUBMITTED', submittedAt: now })
      .where(eq(schema.interviewPanels.id, panelRow.id));
      
    // 4. Check if all panels submitted and transition status
    const interview = await db.getInterview(panelRow.interviewId);
    if (interview) {
      const allSubmitted = interview.panels.every((p) => p.status === 'SUBMITTED');
      if (allSubmitted && interview.status === 'PENDING') {
        await dbClient
          .update(schema.interviews)
          .set({ status: 'COLLECTED', updatedAt: now })
          .where(eq(schema.interviews.id, interview.id));
      } else {
        await dbClient
          .update(schema.interviews)
          .set({ updatedAt: now })
          .where(eq(schema.interviews.id, interview.id));
      }
    }
    return true;
  },

  // Book the interview with a selected slot
  bookInterview: async (
    interviewId: string,
    params: {
      scheduledSlotStart: string;
      scheduledSlotEnd: string;
      teamsMeetingUrl: string;
      calendarEventId: string;
    }
  ): Promise<boolean> => {
    const now = new Date();
    const interview = await db.getInterview(interviewId);
    const nextStatus = (interview && interview.candidateName === 'Pending Assignment') ? 'COLLECTED' : 'SCHEDULED';

    await dbClient
      .update(schema.interviews)
      .set({
        status: nextStatus,
        scheduledSlotStart: new Date(params.scheduledSlotStart),
        scheduledSlotEnd: new Date(params.scheduledSlotEnd),
        teamsMeetingUrl: params.teamsMeetingUrl,
        calendarEventId: params.calendarEventId,
        updatedAt: now,
      })
      .where(eq(schema.interviews.id, interviewId));
      
    return true;
  },

  // Cancel/remove booked slot from the interview
  cancelBooking: async (interviewId: string): Promise<boolean> => {
    const now = new Date();
    const interview = await db.getInterview(interviewId);
    if (!interview) return false;

    const allSubmitted = interview.panels.every((p) => p.status === 'SUBMITTED');
    const nextStatus = allSubmitted ? 'COLLECTED' : 'PENDING';

    await dbClient
      .update(schema.interviews)
      .set({
        status: nextStatus,
        scheduledSlotStart: null,
        scheduledSlotEnd: null,
        teamsMeetingUrl: null,
        calendarEventId: null,
        updatedAt: now,
      })
      .where(eq(schema.interviews.id, interviewId));

    return true;
  },

  // Delete an interview record (cascading foreign keys handled at SQL level)
  deleteInterview: async (id: string): Promise<boolean> => {
    await dbClient.delete(schema.interviews).where(eq(schema.interviews.id, id));
    return true;
  },

  // Get all registered panelists
  getPanelists: async (): Promise<Panelist[]> => {
    await ensureSeeded();
    const res = await dbClient.select().from(schema.panelists);
    return res.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      email: row.email,
      roles: row.roles as ('L1' | 'L2')[],
      createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
    }));
  },

  // Add or update a panelist
  addPanelist: async (
    user: { id: string; displayName: string; email: string },
    roles: ('L1' | 'L2')[]
  ): Promise<Panelist> => {
    const [existing] = await dbClient.select().from(schema.panelists).where(eq(schema.panelists.id, user.id)).limit(1);
    const now = new Date();
    
    if (existing) {
      await dbClient.update(schema.panelists).set({ roles }).where(eq(schema.panelists.id, user.id));
    } else {
      await dbClient.insert(schema.panelists).values({
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        roles,
        createdAt: now,
      });
    }
    
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      roles,
      createdAt: now.toISOString(),
    };
  },

  // Delete a panelist record
  removePanelist: async (id: string): Promise<boolean> => {
    await dbClient.delete(schema.panelists).where(eq(schema.panelists.id, id));
    return true;
  },

  // Check if email is allowed to sign in
  isEmailAllowed: async (email: string): Promise<boolean> => {
    const normalizedEmail = email.trim().toLowerCase();
    if (INITIAL_RECRUITERS.includes(normalizedEmail)) {
      return true;
    }
    const [allowed] = await dbClient
      .select()
      .from(schema.allowedRecruiters)
      .where(eq(schema.allowedRecruiters.email, normalizedEmail))
      .limit(1);
    return !!allowed;
  },

  // Get all allowed recruiters from DB
  getAllowedRecruiters: async (): Promise<{ email: string; addedBy: string | null; createdAt: string }[]> => {
    const res = await dbClient.select().from(schema.allowedRecruiters);
    return res.map((row) => ({
      email: row.email,
      addedBy: row.addedBy,
      createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
    }));
  },

  // Add a recruiter email
  addAllowedRecruiter: async (email: string, addedBy: string): Promise<boolean> => {
    const normalizedEmail = email.trim().toLowerCase();
    if (INITIAL_RECRUITERS.includes(normalizedEmail)) {
      return false; // Already allowed by default
    }
    const [existing] = await dbClient
      .select()
      .from(schema.allowedRecruiters)
      .where(eq(schema.allowedRecruiters.email, normalizedEmail))
      .limit(1);
    if (existing) {
      return false; // Already exists
    }
    await dbClient.insert(schema.allowedRecruiters).values({
      email: normalizedEmail,
      addedBy: addedBy.toLowerCase(),
      createdAt: new Date(),
    });
    return true;
  },

  // Remove a recruiter email
  removeAllowedRecruiter: async (email: string): Promise<boolean> => {
    const normalizedEmail = email.trim().toLowerCase();
    if (INITIAL_RECRUITERS.includes(normalizedEmail)) {
      throw new Error('Cannot remove initial system pre-approved recruiters');
    }
    await dbClient.delete(schema.allowedRecruiters).where(eq(schema.allowedRecruiters.email, normalizedEmail));
    return true;
  },

  // Get uploaded candidates
  getUploadedCandidates: async (): Promise<UploadedCandidate[]> => {
    const res = await dbClient.select().from(schema.uploadedCandidates).orderBy(desc(schema.uploadedCandidates.createdAt));
    return res.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      status: row.status as 'WAITING' | 'MAPPED',
      mappedInterviewId: row.mappedInterviewId || undefined,
      preferredDate: row.preferredDate ? row.preferredDate.toISOString().split('T')[0] : undefined,
      outcomeStatus: row.outcomeStatus || undefined,
      createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
    }));
  },

  // Add uploaded candidates
  addUploadedCandidates: async (candidates: { name: string; email: string; preferredDate?: string }[]): Promise<boolean> => {
    for (const c of candidates) {
      const id = crypto.randomUUID();
      await dbClient.insert(schema.uploadedCandidates).values({
        id,
        name: c.name,
        email: c.email,
        status: 'WAITING',
        preferredDate: c.preferredDate ? new Date(c.preferredDate) : null,
      });
    }
    return true;
  },

  // Update candidate date
  updateCandidateDate: async (id: string, preferredDate: string | null): Promise<boolean> => {
    await dbClient
      .update(schema.uploadedCandidates)
      .set({
        preferredDate: preferredDate ? new Date(preferredDate) : null,
      })
      .where(eq(schema.uploadedCandidates.id, id));
    return true;
  },

  // Delete uploaded candidate
  deleteUploadedCandidate: async (id: string): Promise<boolean> => {
    await dbClient.delete(schema.uploadedCandidates).where(eq(schema.uploadedCandidates.id, id));
    return true;
  },

  // Auto-map pending candidates to L1 interviews
  autoMapPendingCandidates: async (tokenInfo?: { token: string; email: string }): Promise<{ mappedCount: number }> => {
    let mappedCount = 0;
    try {
      // a. Fetch all WAITING candidates ordered by oldest first
      const waitingCandidates = await dbClient
        .select()
        .from(schema.uploadedCandidates)
        .where(eq(schema.uploadedCandidates.status, 'WAITING'))
        .orderBy(schema.uploadedCandidates.createdAt);
        
      if (waitingCandidates.length === 0) {
        return { mappedCount };
      }
      
      // b. Fetch all L1 interviews that have candidateName = 'Pending Assignment' and status = 'COLLECTED'
      const allInterviews = await db.getInterviews();
      const readyL1Interviews = allInterviews.filter((i) => {
        const isL1 = i.role.toLowerCase().includes('l1');
        const isPending = i.candidateName === 'Pending Assignment';
        const isCollected = i.status === 'COLLECTED';
        const hasSlot = i.scheduledSlotStart && i.scheduledSlotEnd;
        return isL1 && isPending && isCollected && hasSlot;
      });
      
      if (readyL1Interviews.length === 0) {
        return { mappedCount };
      }
      
      const limit = Math.min(waitingCandidates.length, readyL1Interviews.length);
      
      // Avoid circular dependency by importing session and graph dynamically
      const { getAnyValidAccessToken } = await import('./session');
      const { graph } = await import('./graph');
      
      let activeToken = tokenInfo?.token;
      let recruiterEmail = tokenInfo?.email;
      if (!activeToken || !recruiterEmail) {
        const anyToken = await getAnyValidAccessToken();
        if (anyToken) {
          activeToken = anyToken.token;
          recruiterEmail = anyToken.email;
        }
      }
      
      for (let i = 0; i < limit; i++) {
        const candidate = waitingCandidates[i];
        const interview = readyL1Interviews[i];
        const now = new Date();
        
        // 1. Update database interview record
        await dbClient
          .update(schema.interviews)
          .set({
            candidateName: candidate.name,
            candidateEmail: candidate.email,
            status: 'SCHEDULED',
            updatedAt: now,
          })
          .where(eq(schema.interviews.id, interview.id));
          
        // 2. Update candidate record in queue
        await dbClient
          .update(schema.uploadedCandidates)
          .set({
            status: 'MAPPED',
            mappedInterviewId: interview.id,
          })
          .where(eq(schema.uploadedCandidates.id, candidate.id));
          
        // 3. Update Microsoft Graph calendar event
        if (activeToken && interview.calendarEventId) {
          try {
            const panelEmails = interview.panels.map((p) => p.email);
            const description = `Interview scheduled via Microsoft Teams Scheduler. Candidate automatically mapped from bulk upload queue.`;
            
            await graph.updateTeamsMeeting(
              interview.calendarEventId,
              {
                candidateName: candidate.name,
                candidateEmail: candidate.email,
                role: interview.role,
                description,
                panelEmails,
                sendAsTeamsMeeting: true,
                teamsMeetingUrl: interview.teamsMeetingUrl || undefined,
              },
              activeToken
            );
          } catch (graphError: any) {
            console.error(`Failed to update MS Graph event ${interview.calendarEventId} for auto-mapped candidate ${candidate.email}:`, graphError);
            
            const errMsg = graphError instanceof Error ? graphError.message : String(graphError);
            if (errMsg.includes('404') || errMsg.includes('ErrorItemNotFound')) {
              console.log('Calendar event not found in Outlook store during auto-mapping. Re-creating calendar event on the fly...');
              try {
                if (interview.scheduledSlotStart && interview.scheduledSlotEnd && recruiterEmail) {
                  const panelEmails = interview.panels.map((p) => p.email);
                  const description = `Interview scheduled via Microsoft Teams Scheduler. Re-created after original event was not found during auto-mapping.`;
                  
                  const meeting = await graph.createTeamsMeeting(
                    recruiterEmail,
                    {
                      candidateName: candidate.name,
                      candidateEmail: candidate.email,
                      role: interview.role,
                      description,
                      startTime: interview.scheduledSlotStart,
                      endTime: interview.scheduledSlotEnd,
                      panelEmails,
                    },
                    activeToken
                  );
                  
                  // Update database record with new calendar details
                  await dbClient
                    .update(schema.interviews)
                    .set({
                      teamsMeetingUrl: meeting.joinUrl || meeting.webLink || '',
                      calendarEventId: meeting.id || '',
                      updatedAt: new Date(),
                    })
                    .where(eq(schema.interviews.id, interview.id));
                    
                  console.log('Successfully re-created calendar event:', meeting.id);
                }
              } catch (recreateError) {
                console.error('Failed to re-create calendar event during auto-mapping:', recreateError);
              }
            }
          }
        }
        
        mappedCount++;
      }
    } catch (err) {
      console.error('Error in autoMapPendingCandidates:', err);
    }
    return { mappedCount };
  },

  // --- Panelist helpers ---

  isPanelist: async (email: string): Promise<boolean> => {
    const normalizedEmail = email.trim().toLowerCase();
    const [row] = await dbClient
      .select()
      .from(schema.panelists)
      .where(eq(schema.panelists.email, normalizedEmail))
      .limit(1);
    return !!row;
  },

  getPanelistByEmail: async (email: string): Promise<{ id: string; displayName: string; email: string; roles: string[] } | null> => {
    const [row] = await dbClient
      .select()
      .from(schema.panelists)
      .where(eq(schema.panelists.email, email.trim().toLowerCase()))
      .limit(1);
    if (!row) return null;
    return { id: row.id, displayName: row.displayName, email: row.email, roles: row.roles };
  },

  getPanelistInterviews: async (panelistEmail: string): Promise<PanelistInterview[]> => {
    const normalizedEmail = panelistEmail.trim().toLowerCase();

    const panelRows = await dbClient
      .select()
      .from(schema.interviewPanels)
      .where(eq(schema.interviewPanels.email, normalizedEmail));

    const panelistRow = await db.getPanelistByEmail(normalizedEmail);
    const panelistRoles = panelistRow?.roles ?? [];

    const result: PanelistInterview[] = [];
    for (const panel of panelRows) {
      const [interview] = await dbClient
        .select()
        .from(schema.interviews)
        .where(and(eq(schema.interviews.id, panel.interviewId), eq(schema.interviews.status, 'SCHEDULED')))
        .limit(1);
      if (!interview) continue;

      const [candidate] = await dbClient
        .select()
        .from(schema.uploadedCandidates)
        .where(eq(schema.uploadedCandidates.mappedInterviewId, interview.id))
        .limit(1);

      result.push({
        interviewId: interview.id,
        role: interview.role,
        duration: interview.duration,
        scheduledSlotStart: interview.scheduledSlotStart!.toISOString(),
        scheduledSlotEnd: interview.scheduledSlotEnd!.toISOString(),
        teamsMeetingUrl: interview.teamsMeetingUrl,
        candidateName: interview.candidateName,
        candidateEmail: interview.candidateEmail,
        candidateId: candidate?.id ?? null,
        outcomeStatus: candidate?.outcomeStatus ?? null,
        panelId: panel.id,
        panelDecision: (panel as any).decision ?? null,
        panelFeedback: (panel as any).feedback ?? null,
        panelistRoles,
      });
    }
    return result;
  },

  submitPanelFeedback: async (panelId: string, feedback: string, decision: 'PASSED' | 'REJECTED'): Promise<boolean> => {
    await dbClient
      .update(schema.interviewPanels)
      .set({ feedback, decision } as any)
      .where(eq(schema.interviewPanels.id, panelId));
    return true;
  },

  updateCandidateOutcome: async (candidateId: string, outcomeStatus: string): Promise<boolean> => {
    await dbClient
      .update(schema.uploadedCandidates)
      .set({ outcomeStatus } as any)
      .where(eq(schema.uploadedCandidates.id, candidateId));
    return true;
  },
};
