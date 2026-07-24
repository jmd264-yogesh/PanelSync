import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, inArray, desc, isNull, or } from 'drizzle-orm';
import * as schema from './schema';
import type {
  TPanelAvailability,
  TInterviewPanel,
  TInterview,
  THiringType,
  TInterviewStatus,
  TPanelStatus,
  TPanelistInterview,
  TAiRun,
} from '@/interviews/types/model.types.interview';
import type {
  TPanelist,
  TPanelistRole,
} from '@/panelists-directory/types/model.types.panelist';
import type {
  TUploadedCandidate,
  TCandidateStatus,
} from '@/candidates/types/model.types.candidate';
import type {
  TLateralCandidate,
  TLateralCandidateStatus,
} from '@/lateral-hiring/types/model.types.lateral';
import type {
  TCollege,
} from '@/colleges/types/model.types.college';
import type {
  TDrive,
  TDriveStatus,
} from '@/drives/types/model.types.drive';
import type {
  TRecalibrateSession,
} from '@/recalibrate/types/model.types.recalibrate';

// Re-export types with T prefix
export type {
  TPanelAvailability,
  TInterviewPanel,
  TInterview,
  THiringType,
  TInterviewStatus,
  TPanelStatus,
  TPanelistInterview,
  TAiRun,
  TPanelist,
  TPanelistRole,
  TUploadedCandidate,
  TCandidateStatus,
  TLateralCandidate,
  TLateralCandidateStatus,
  TCollege,
  TDrive,
  TDriveStatus,
  TRecalibrateSession,
};

// Legacy interface aliases for backward compatibility
export type PanelAvailability = TPanelAvailability;
export type InterviewPanel = TInterviewPanel;
export type Interview = TInterview;
export type hiringTypeEnum = THiringType;
export type Panelist = TPanelist;
export type UploadedCandidate = TUploadedCandidate;
export type LateralCandidate = TLateralCandidate;
export type RecalibrateSession = TRecalibrateSession;
export type AiRun = TAiRun;
export type College = TCollege;
export type Drive = TDrive;
export type PanelistInterview = TPanelistInterview;


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
    const interviewsRes = await dbClient.select().from(schema.interviews).where(isNull(schema.interviews.deletedAt));

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
          status: p.status as 'PENDING' | 'SUBMITTED' | 'REJECTED',
          submittedAt: p.submittedAt ? p.submittedAt.toISOString() : undefined,
          feedback: p.feedback,
          decision: p.decision,
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
        hiringType: intv.hiringType,
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
    const [intv] = await dbClient.select().from(schema.interviews).where(and(eq(schema.interviews.id, id), isNull(schema.interviews.deletedAt))).limit(1);
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
        status: p.status as 'PENDING' | 'SUBMITTED' | 'REJECTED',
        submittedAt: p.submittedAt ? p.submittedAt.toISOString() : undefined,
        feedback: p.feedback,
        decision: p.decision,
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
      hiringType: intv.hiringType,
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
    hiringType: hiringTypeEnum;
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
      hiringType: params.hiringType,
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
    const now = new Date();
    await dbClient
      .update(schema.interviews)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(schema.interviews.id, id));

    await dbClient
      .update(schema.uploadedCandidates)
      .set({ status: 'WAITING', mappedInterviewId: null })
      .where(eq(schema.uploadedCandidates.mappedInterviewId, id));

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
    const res = await dbClient.select().from(schema.uploadedCandidates).where(isNull(schema.uploadedCandidates.deletedAt)).orderBy(desc(schema.uploadedCandidates.createdAt));
    return res.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      status: row.status as 'WAITING' | 'MAPPED',
      mappedInterviewId: row.mappedInterviewId || undefined,
      preferredDate: row.preferredDate
        ? `${row.preferredDate.getFullYear()}-${String(row.preferredDate.getMonth() + 1).padStart(2, '0')}-${String(row.preferredDate.getDate()).padStart(2, '0')}`
        : '',
      outcomeStatus: row.outcomeStatus || undefined,
      college: row.college || '',
      collegeDrive: row.collegeDrive || '',
      resumeFileKey: row.resumeFileKey || undefined,
      resumeSha256: row.resumeSha256 || undefined,
      resumeUploadedAt: row.resumeUploadedAt ? row.resumeUploadedAt.toISOString() : undefined,
      createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
    }));
  },

  // Add uploaded candidates. Returns the created rows' id/email so callers can
  // attach follow-up data (e.g. a bulk-uploaded resume link) to the right candidate.
  addUploadedCandidates: async (candidates: { name: string; email: string; preferredDate: string; college: string; collegeDrive: string }[]): Promise<{ id: string; email: string }[]> => {
    const created: { id: string; email: string }[] = [];
    for (const c of candidates) {
      const id = crypto.randomUUID();
      await dbClient.insert(schema.uploadedCandidates).values({
        id,
        name: c.name,
        email: c.email,
        status: 'WAITING',
        preferredDate: new Date(c.preferredDate),
        college: c.college,
        collegeDrive: c.collegeDrive,
      });
      created.push({ id, email: c.email });
    }
    return created;
  },

  // Update candidate date
  updateCandidateDate: async (id: string, preferredDate: string): Promise<boolean> => {
    await dbClient
      .update(schema.uploadedCandidates)
      .set({
        preferredDate: new Date(preferredDate),
      })
      .where(eq(schema.uploadedCandidates.id, id));
    return true;
  },

  // Update candidate details (generic)
  updateCandidate: async (
    id: string,
    params: {
      name?: string;
      email?: string;
      preferredDate?: string;
      college?: string;
      collegeDrive?: string;
    }
  ): Promise<boolean> => {
    const updatePayload: any = {};
    if (params.name !== undefined) updatePayload.name = params.name;
    if (params.email !== undefined) updatePayload.email = params.email;
    if (params.preferredDate !== undefined) updatePayload.preferredDate = new Date(params.preferredDate);
    if (params.college !== undefined) updatePayload.college = params.college;
    if (params.collegeDrive !== undefined) updatePayload.collegeDrive = params.collegeDrive;

    await dbClient
      .update(schema.uploadedCandidates)
      .set(updatePayload)
      .where(eq(schema.uploadedCandidates.id, id));
    return true;
  },

  // Unmap a candidate from its interview, reverting it to WAITING and releasing
  // the interview slot back to "Pending Assignment" so it can be re-mapped.
  unmapCandidate: async (id: string): Promise<boolean> => {
    const [candidate] = await dbClient
      .select()
      .from(schema.uploadedCandidates)
      .where(eq(schema.uploadedCandidates.id, id));
    if (!candidate || candidate.status !== 'MAPPED' || !candidate.mappedInterviewId) {
      return false;
    }

    const claimed = await dbClient
      .update(schema.uploadedCandidates)
      .set({ status: 'WAITING', mappedInterviewId: null })
      .where(and(eq(schema.uploadedCandidates.id, id), eq(schema.uploadedCandidates.status, 'MAPPED')))
      .returning({ id: schema.uploadedCandidates.id });
    if (claimed.length === 0) return false;

    const [interview] = await dbClient
      .select()
      .from(schema.interviews)
      .where(eq(schema.interviews.id, candidate.mappedInterviewId));

    if (interview) {
      await dbClient
        .update(schema.interviews)
        .set({
          candidateName: 'Pending Assignment',
          candidateEmail: '',
          status: interview.status === 'SCHEDULED' ? 'COLLECTED' : interview.status,
          updatedAt: new Date(),
        })
        .where(eq(schema.interviews.id, interview.id));
    }

    return true;
  },

  // Delete uploaded candidate
  deleteUploadedCandidate: async (id: string): Promise<boolean> => {
    const now = new Date();
    await dbClient
      .update(schema.uploadedCandidates)
      .set({ deletedAt: now })
      .where(eq(schema.uploadedCandidates.id, id));
    return true;
  },

  autoMapPendingCandidates: async (tokenInfo?: { token: string; email: string }): Promise<{ mappedCount: number }> => {
    let mappedCount = 0;
    try {
      // a. Fetch all WAITING candidates ordered by oldest first
      const waitingCandidates = await dbClient
        .select()
        .from(schema.uploadedCandidates)
        .where(and(eq(schema.uploadedCandidates.status, 'WAITING'), isNull(schema.uploadedCandidates.deletedAt)))
        .orderBy(schema.uploadedCandidates.createdAt);

      if (waitingCandidates.length === 0) {
        return { mappedCount };
      }

      // Separate waiting candidates: fresh vs passed L1 (ready for L2)
      const waitingForL1 = waitingCandidates.filter((c) => !c.outcomeStatus || c.outcomeStatus === 'PENDING');
      const waitingForL2 = waitingCandidates.filter((c) => c.outcomeStatus === 'PASSED_L1');

      // b. Fetch all ready L1 and L2 interviews
      const allInterviews = await db.getInterviews();

      const readyL1Interviews = allInterviews.filter((i) => {
        const isL1 = i.role.toLowerCase().includes('l1');
        const isPending = i.candidateName === 'Pending Assignment';
        const isCollected = i.status === 'COLLECTED';
        const hasSlot = i.scheduledSlotStart && i.scheduledSlotEnd;
        return isL1 && isPending && isCollected && hasSlot;
      });

      const readyL2Interviews = allInterviews.filter((i) => {
        const isL2 = i.role.toLowerCase().includes('l2');
        const isPending = i.candidateName === 'Pending Assignment';
        const isCollected = i.status === 'COLLECTED';
        const hasSlot = i.scheduledSlotStart && i.scheduledSlotEnd;
        return isL2 && isPending && isCollected && hasSlot;
      });

      // Avoid circular dependency by importing session and graph dynamically
      const { getAnyValidAccessToken } = await import('./session');
      const { graph } = await import('./graph');

      let activeToken = tokenInfo?.token;
      let recruiterEmail = tokenInfo?.email;
      let recruiterUserId = '';

      const anyToken = await getAnyValidAccessToken();
      if (anyToken) {
        if (!activeToken) {
          activeToken = anyToken.token;
          recruiterEmail = anyToken.email;
        }
        recruiterUserId = anyToken.userId;
      }

      const ccEmails = recruiterEmail ? await db.getRecruiterCCEmails(recruiterEmail) : [];

      const mapOne = async (candidate: typeof waitingCandidates[0], interview: typeof allInterviews[0]) => {
        const now = new Date();

        // Atomically claim the candidate — only succeeds if no other in-flight
        // mapping (upload, panelist self-booking, L2 requeue, manual map) already took it.
        const claimedCandidate = await dbClient
          .update(schema.uploadedCandidates)
          .set({ status: 'MAPPED', mappedInterviewId: interview.id })
          .where(and(eq(schema.uploadedCandidates.id, candidate.id), eq(schema.uploadedCandidates.status, 'WAITING')))
          .returning({ id: schema.uploadedCandidates.id });
        if (claimedCandidate.length === 0) return;

        // Atomically claim the interview slot — only succeeds if it's still an
        // open "Pending Assignment" slot (not already booked by a concurrent mapping).
        const claimedInterview = await dbClient
          .update(schema.interviews)
          .set({
            candidateName: candidate.name,
            candidateEmail: candidate.email,
            status: 'SCHEDULED',
            updatedAt: now,
          })
          .where(and(
            eq(schema.interviews.id, interview.id),
            eq(schema.interviews.status, 'COLLECTED'),
            eq(schema.interviews.candidateName, 'Pending Assignment')
          ))
          .returning({ id: schema.interviews.id });

        if (claimedInterview.length === 0) {
          // Someone else claimed this interview first — release the candidate back to the queue.
          await dbClient
            .update(schema.uploadedCandidates)
            .set({ status: 'WAITING', mappedInterviewId: null })
            .where(eq(schema.uploadedCandidates.id, candidate.id));
          return;
        }

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
                ccEmails,
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
                      ccEmails,
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

        // 4. Send confirmation Teams message to panel members
        if (activeToken && recruiterUserId && interview.scheduledSlotStart) {
          try {
            const timingString = new Date(interview.scheduledSlotStart).toLocaleString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
            });

            const freshInterview = await db.getInterview(interview.id);
            if (freshInterview) {
              const finalJoinUrl = freshInterview.teamsMeetingUrl || '';

              for (const panel of freshInterview.panels) {
                try {
                  const chat = await graph.createOneOnOneChat(recruiterUserId, panel.userId, activeToken);

                  const htmlMessage = `
                    <div style="font-family: 'Segoe UI', system-ui, sans-serif; padding: 16px; border-left: 4px solid #10b981; background-color: #0f172a; color: #f8fafc; border-radius: 8px; max-width: 480px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                      <h3 style="margin-top: 0; color: #10b981; font-size: 16px; font-weight: 600;">Candidate Assigned to Interview (Auto-Mapped)</h3>
                      <p style="margin: 8px 0; font-size: 14px; color: #cbd5e1;">Hello <strong>${panel.name}</strong>,</p>
                      <p style="margin: 8px 0; font-size: 14px; color: #94a3b8;">
                        A candidate has been automatically mapped to your scheduled interview.
                      </p>
                      <div style="background-color: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; margin: 12px 0; border: 1px solid rgba(255,255,255,0.05);">
                        <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Candidate Name</div>
                        <div style="font-size: 14px; font-weight: bold; color: #ffffff;">${candidate.name}</div>
                        <div style="font-size: 13px; color: #94a3b8; margin-top: 6px; margin-bottom: 2px;">Role / Round</div>
                        <div style="font-size: 14px; font-weight: bold; color: #ffffff;">${interview.role}</div>
                        <div style="font-size: 13px; color: #94a3b8; margin-top: 6px; margin-bottom: 2px;">Scheduled Timing</div>
                        <div style="font-size: 14px; font-weight: bold; color: #ffffff;">${timingString}</div>
                      </div>
                      ${finalJoinUrl ? `
                      <p style="font-size: 14px; color: #94a3b8; margin-bottom: 16px;">
                        You can join the Teams meeting using the button below:
                      </p>
                      <div style="margin-top: 16px; margin-bottom: 12px;">
                        <a href="${finalJoinUrl}" style="background-color: #10b981; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
                          Join Teams Meeting
                        </a>
                      </div>
                      ` : ''}
                    </div>
                  `;

                  await graph.sendTeamsMessage(chat.id, htmlMessage, activeToken);
                } catch (chatErr) {
                  console.error(`Failed to send auto-mapping Teams notification to panelist ${panel.email}:`, chatErr);
                }
              }
            }
          } catch (notifErr) {
            console.error('Failed to process auto-mapping notifications:', notifErr);
          }
        }

        mappedCount++;
      };

      const getCollegeNameFromRole = (role: string) => {
        const parts = role.split(' - ');
        return parts.length > 1 ? parts[1].trim().toLowerCase() : '';
      };

      const getInterviewDate = (i: typeof allInterviews[0]) => {
        if (i.scheduledSlotStart) {
          return i.scheduledSlotStart.split('T')[0];
        }
        return '';
      };

      // Map L1
      for (const interview of readyL1Interviews) {
        const collegeName = getCollegeNameFromRole(interview.role);
        const dateStr = getInterviewDate(interview);

        const candidateIdx = waitingForL1.findIndex((c) => {
          const matchesCollege = collegeName ? c.collegeDrive?.toLowerCase() === collegeName : true;
          const matchesDate = (() => {
            if (!dateStr) return true;
            if (!c.preferredDate) return false;
            const y = c.preferredDate.getFullYear();
            const m = String(c.preferredDate.getMonth() + 1).padStart(2, '0');
            const d = String(c.preferredDate.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}` === dateStr;
          })();
          return matchesCollege && matchesDate;
        });

        if (candidateIdx !== -1) {
          const candidate = waitingForL1[candidateIdx];
          waitingForL1.splice(candidateIdx, 1);
          await mapOne(candidate, interview);
        }
      }

      // Map L2
      for (const interview of readyL2Interviews) {
        const collegeName = getCollegeNameFromRole(interview.role);
        const dateStr = getInterviewDate(interview);

        const candidateIdx = waitingForL2.findIndex((c) => {
          const matchesCollege = collegeName ? c.collegeDrive?.toLowerCase() === collegeName : true;
          const matchesDate = (() => {
            if (!dateStr) return true;
            if (!c.preferredDate) return false;
            const y = c.preferredDate.getFullYear();
            const m = String(c.preferredDate.getMonth() + 1).padStart(2, '0');
            const d = String(c.preferredDate.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}` === dateStr;
          })();
          return matchesCollege && matchesDate;
        });

        if (candidateIdx !== -1) {
          const candidate = waitingForL2[candidateIdx];
          waitingForL2.splice(candidateIdx, 1);
          await mapOne(candidate, interview);
        }
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
      .where(
        and(
          eq(schema.interviewPanels.email, normalizedEmail),
          inArray(schema.interviewPanels.status, ['SUBMITTED', 'PENDING'])
        )
      );

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
        hiringType: interview.hiringType,
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
        panelSubmittedAt: panel.submittedAt ? panel.submittedAt.toISOString() : null,
      });
    }
    return result;
  },

  getPanelistRequests: async (panelistEmail: string): Promise<{ interview: Interview; panel: InterviewPanel }[]> => {
    const normalizedEmail = panelistEmail.trim().toLowerCase();

    // A college can have several drives over time (e.g. an old closed round and a
    // brand-new open one). Only treat a college as closed if NONE of its drives are
    // open — matching purely by "has this college ever had a closed drive" would
    // wrongly hide requests tied to that college's current open drive.
    const allDrives = await dbClient
      .select({ collegeName: schema.drives.collegeName, status: schema.drives.status })
      .from(schema.drives);
    const hasOpenDriveByCollege = new Map<string, boolean>();
    for (const d of allDrives) {
      const key = d.collegeName.trim().toLowerCase();
      hasOpenDriveByCollege.set(key, hasOpenDriveByCollege.get(key) || d.status === 'OPEN');
    }

    const getCollegeNameFromRole = (role: string): string => {
      const parts = role.split(' - ');
      return parts.length > 1 ? parts[1].trim().toLowerCase() : '';
    };

    const panelRows = await dbClient
      .select()
      .from(schema.interviewPanels)
      .where(
        and(
          eq(schema.interviewPanels.email, normalizedEmail),
          eq(schema.interviewPanels.status, 'PENDING')
        )
      );

    const result: { interview: Interview; panel: InterviewPanel }[] = [];
    for (const panelRow of panelRows) {
      const interview = await db.getInterview(panelRow.interviewId);
      if (!interview || interview.status === 'CANCELLED' || interview.status === 'SCHEDULED') continue;

      // Filter out requests only if this college has drives on record and every one is closed.
      const college = getCollegeNameFromRole(interview.role);
      if (hasOpenDriveByCollege.has(college) && !hasOpenDriveByCollege.get(college)) continue;

      const activePanel = interview.panels.find((p) => p.id === panelRow.id);
      if (activePanel) {
        result.push({ interview, panel: activePanel });
      }
    }
    return result;
  },

  submitPanelFeedback: async (panelId: string, feedback: string, decision: 'PASSED' | 'REJECTED'): Promise<boolean> => {
    // Keep the original submission timestamp if it was already submitted (for editing)
    const [existing] = await dbClient
      .select({ submittedAt: schema.interviewPanels.submittedAt })
      .from(schema.interviewPanels)
      .where(eq(schema.interviewPanels.id, panelId))
      .limit(1);

    const submittedAtVal = existing?.submittedAt ? existing.submittedAt : new Date();

    await dbClient
      .update(schema.interviewPanels)
      .set({
        feedback,
        decision,
        status: 'SUBMITTED',
        submittedAt: submittedAtVal,
      } as any)
      .where(eq(schema.interviewPanels.id, panelId));
    return true;
  },

  getRecruiterCCEmails: async (organizerEmail?: string): Promise<string[]> => {
    const dbRecruiters = await db.getAllowedRecruiters();
    const allEmails = new Set<string>();

    // Add initial recruiters
    INITIAL_RECRUITERS.forEach(email => allEmails.add(email.trim().toLowerCase()));

    // Add DB allowed recruiters
    dbRecruiters.forEach(r => allEmails.add(r.email.trim().toLowerCase()));

    // Exclude organizer email
    if (organizerEmail) {
      allEmails.delete(organizerEmail.trim().toLowerCase());
    }

    return Array.from(allEmails);
  },

  updateCandidateOutcome: async (candidateId: string, outcomeStatus: string): Promise<boolean> => {
    await dbClient
      .update(schema.uploadedCandidates)
      .set({ outcomeStatus } as any)
      .where(eq(schema.uploadedCandidates.id, candidateId));
    return true;
  },

  getColleges: async (): Promise<College[]> => {
    const res = await dbClient.select().from(schema.colleges).orderBy(desc(schema.colleges.createdAt));
    return res.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
    }));
  },

  addCollege: async (name: string): Promise<boolean> => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new Error('College name cannot be empty');
    }
    // Case-insensitive duplicate check
    const [existing] = await dbClient
      .select()
      .from(schema.colleges)
      .where(eq(schema.colleges.name, normalizedName))
      .limit(1);

    if (existing) {
      throw new Error('College name already exists');
    }

    const id = crypto.randomUUID();
    await dbClient.insert(schema.colleges).values({
      id,
      name: normalizedName,
      createdAt: new Date(),
    });
    return true;
  },

  deleteCollege: async (id: string): Promise<boolean> => {
    // 1. Resolve college name
    const [college] = await dbClient
      .select()
      .from(schema.colleges)
      .where(eq(schema.colleges.id, id))
      .limit(1);

    if (!college) {
      throw new Error('College not found');
    }

    const collegeName = college.name;

    // 2. Check if college is associated with an active/open recruitment drive
    const [activeOrOpenDrive] = await dbClient
      .select()
      .from(schema.drives)
      .where(
        and(
          eq(schema.drives.collegeName, collegeName),
          or(
            eq(schema.drives.isActive, true),
            eq(schema.drives.status, 'OPEN')
          )
        )
      )
      .limit(1);

    if (activeOrOpenDrive) {
      throw new Error(
        `Cannot delete college "${collegeName}" because it is currently associated with an active or open recruitment drive.`
      );
    }

    // 3. Check if college is associated with any other drive (closed/inactive)
    const [anyDrive] = await dbClient
      .select()
      .from(schema.drives)
      .where(eq(schema.drives.collegeName, collegeName))
      .limit(1);

    if (anyDrive) {
      throw new Error(
        `Cannot delete college "${collegeName}" because it is associated with existing recruitment drives.`
      );
    }

    // 4. Check if college is associated with any candidates (that aren't soft-deleted)
    const [anyCandidate] = await dbClient
      .select()
      .from(schema.uploadedCandidates)
      .where(
        and(
          isNull(schema.uploadedCandidates.deletedAt),
          or(
            eq(schema.uploadedCandidates.college, collegeName),
            eq(schema.uploadedCandidates.collegeDrive, collegeName)
          )
        )
      )
      .limit(1);

    if (anyCandidate) {
      throw new Error(
        `Cannot delete college "${collegeName}" because there are candidates registered under this college.`
      );
    }

    // 5. If all checks pass, delete the college
    await dbClient.delete(schema.colleges).where(eq(schema.colleges.id, id));
    return true;
  },

  getDrives: async (): Promise<Drive[]> => {
    const res = await dbClient.select().from(schema.drives).orderBy(desc(schema.drives.createdAt));
    return res.map((row) => ({
      id: row.id,
      collegeName: row.collegeName,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status as TDriveStatus,
      isActive: row.isActive,
      createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
    }));
  },

  getActiveDrive: async (): Promise<Drive | null> => {
    const [row] = await dbClient
      .select()
      .from(schema.drives)
      .where(eq(schema.drives.isActive, true))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      collegeName: row.collegeName,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status as TDriveStatus,
      isActive: row.isActive,
      createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
    };
  },

  createDrive: async (collegeName: string, startDate: string, endDate: string): Promise<Drive> => {
    const id = crypto.randomUUID();
    const active = await db.getActiveDrive();
    const isActive = active === null;

    const newRow = {
      id,
      collegeName: collegeName.trim(),
      startDate: startDate.trim(),
      endDate: endDate.trim(),
      status: 'OPEN' as TDriveStatus,
      isActive,
      createdAt: new Date(),
    };

    await dbClient.insert(schema.drives).values(newRow);

    return {
      ...newRow,
      createdAt: newRow.createdAt.toISOString(),
    };
  },

  setActiveDrive: async (id: string): Promise<void> => {
    await dbClient
      .update(schema.drives)
      .set({ isActive: false });
    // Only an OPEN drive can become the active drive
    await dbClient
      .update(schema.drives)
      .set({ isActive: true })
      .where(and(eq(schema.drives.id, id), eq(schema.drives.status, 'OPEN')));
  },

  setDriveStatus: async (id: string, status: 'OPEN' | 'CLOSED'): Promise<void> => {
    // Closing a drive also clears its active flag so it stops driving defaults.
    if (status === 'CLOSED') {
      await dbClient
        .update(schema.drives)
        .set({ status: 'CLOSED', isActive: false })
        .where(eq(schema.drives.id, id));
    } else {
      await dbClient
        .update(schema.drives)
        .set({ status: 'OPEN' })
        .where(eq(schema.drives.id, id));
    }
  },

  deleteDrive: async (id: string): Promise<void> => {
    await dbClient.delete(schema.drives).where(eq(schema.drives.id, id));
  },

  // Authorization check reused by every AI-copilot route to prevent an IDOR
  // where a panelist could view/generate against an interview they aren't on.
  isPanelistAssignedToInterview: async (email: string, interviewId: string): Promise<boolean> => {
    const [row] = await dbClient
      .select()
      .from(schema.interviewPanels)
      .where(and(eq(schema.interviewPanels.interviewId, interviewId), eq(schema.interviewPanels.email, email.trim().toLowerCase())))
      .limit(1);
    return !!row;
  },

  // --- AI Interview Copilot helpers ---

  setCandidateResume: async (candidateId: string, params: { fileKey: string; sha256: string }): Promise<boolean> => {
    await dbClient
      .update(schema.uploadedCandidates)
      .set({
        resumeFileKey: params.fileKey,
        resumeSha256: params.sha256,
        resumeUploadedAt: new Date(),
      })
      .where(eq(schema.uploadedCandidates.id, candidateId));
    return true;
  },

  // Resolve the candidate mapped to an interview (the closest thing to a Candidate FK this schema has)
  getCandidateForInterview: async (interviewId: string): Promise<UploadedCandidate | null> => {
    const [row] = await dbClient
      .select()
      .from(schema.uploadedCandidates)
      .where(and(eq(schema.uploadedCandidates.mappedInterviewId, interviewId), isNull(schema.uploadedCandidates.deletedAt)))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      status: row.status as 'WAITING' | 'MAPPED',
      mappedInterviewId: row.mappedInterviewId || undefined,
      preferredDate: row.preferredDate
        ? `${row.preferredDate.getFullYear()}-${String(row.preferredDate.getMonth() + 1).padStart(2, '0')}-${String(row.preferredDate.getDate()).padStart(2, '0')}`
        : '',
      outcomeStatus: row.outcomeStatus || undefined,
      college: row.college || '',
      collegeDrive: row.collegeDrive || '',
      resumeFileKey: row.resumeFileKey || undefined,
      resumeSha256: row.resumeSha256 || undefined,
      resumeUploadedAt: row.resumeUploadedAt ? row.resumeUploadedAt.toISOString() : undefined,
      createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
    };
  },

  // Same lookup as getCandidateForInterview, but for the lateral hiring pipeline
  // (a lateral interview has no row in uploadedCandidates at all).
  getLateralCandidateForInterview: async (interviewId: string): Promise<LateralCandidate | null> => {
    const [row] = await dbClient
      .select()
      .from(schema.lateralCandidates)
      .where(and(eq(schema.lateralCandidates.mappedInterviewId, interviewId), isNull(schema.lateralCandidates.deletedAt)))
      .limit(1);
    return row ? db.mapLateralCandidateRow(row) : null;
  },

  mapAiRunRow: (row: typeof schema.aiRuns.$inferSelect): AiRun => ({
    id: row.id,
    interviewId: row.interviewId,
    candidateId: row.candidateId,
    triggeredByEmail: row.triggeredByEmail,
    status: row.status as AiRun['status'],
    criteria: (row.criteria as Record<string, any>) ?? null,
    spec: (row.spec as Record<string, any>) ?? null,
    resumeDigest: (row.resumeDigest as Record<string, any>) ?? null,
    questions: (row.questions as Record<string, any>) ?? null,
    model: row.model,
    promptVersion: row.promptVersion,
    tokenUsage: (row.tokenUsage as Record<string, any>) ?? null,
    error: row.error,
    createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  }),

  createAiRun: async (params: {
    interviewId: string;
    candidateId: string | null;
    triggeredByEmail: string;
  }): Promise<AiRun> => {
    const id = crypto.randomUUID();
    const now = new Date();
    await dbClient.insert(schema.aiRuns).values({
      id,
      interviewId: params.interviewId,
      candidateId: params.candidateId,
      triggeredByEmail: params.triggeredByEmail,
      status: 'QUEUED',
      createdAt: now,
    });
    const [row] = await dbClient.select().from(schema.aiRuns).where(eq(schema.aiRuns.id, id)).limit(1);
    return db.mapAiRunRow(row);
  },

  updateAiRun: async (id: string, patch: {
    status?: AiRun['status'];
    criteria?: Record<string, any>;
    spec?: Record<string, any>;
    resumeDigest?: Record<string, any>;
    questions?: Record<string, any>;
    model?: string;
    promptVersion?: string;
    tokenUsage?: Record<string, any>;
    error?: string | null;
    completedAt?: Date;
  }): Promise<AiRun> => {
    await dbClient.update(schema.aiRuns).set(patch as any).where(eq(schema.aiRuns.id, id));
    const [row] = await dbClient.select().from(schema.aiRuns).where(eq(schema.aiRuns.id, id)).limit(1);
    return db.mapAiRunRow(row);
  },

  getAiRun: async (id: string): Promise<AiRun | null> => {
    const [row] = await dbClient.select().from(schema.aiRuns).where(eq(schema.aiRuns.id, id)).limit(1);
    return row ? db.mapAiRunRow(row) : null;
  },

  getAiRunsForInterview: async (interviewId: string): Promise<AiRun[]> => {
    const rows = await dbClient
      .select()
      .from(schema.aiRuns)
      .where(eq(schema.aiRuns.interviewId, interviewId))
      .orderBy(desc(schema.aiRuns.createdAt));
    return rows.map(db.mapAiRunRow);
  },

  // Find the most recent completed digest for this candidate whose source resume
  // hash still matches, so a criteria-only regenerate can skip re-parsing/re-extraction.
  // The digest JSON carries a `_sourceSha256` tag (set by our own code, not the LLM) for this comparison.
  getLatestCompletedDigest: async (candidateId: string, resumeSha256: string): Promise<Record<string, any> | null> => {
    const rows = await dbClient
      .select()
      .from(schema.aiRuns)
      .where(and(eq(schema.aiRuns.candidateId, candidateId), eq(schema.aiRuns.status, 'COMPLETED')))
      .orderBy(desc(schema.aiRuns.createdAt));
    const match = rows.find((r) => r.resumeDigest && (r.resumeDigest as any)._sourceSha256 === resumeSha256);
    return match ? (match.resumeDigest as Record<string, any>) : null;
  },

  addAuditLog: async (userEmail: string, action: string, entity: string, entityId: string, metadata?: Record<string, any>): Promise<void> => {
    await dbClient.insert(schema.auditLogs).values({
      id: crypto.randomUUID(),
      userEmail: userEmail.trim().toLowerCase(),
      action,
      entity,
      entityId,
      metadata: metadata ?? null,
      createdAt: new Date(),
    });
  },

  // --- Lateral Hiring helpers ---

  mapLateralCandidateRow: (row: typeof schema.lateralCandidates.$inferSelect): LateralCandidate => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || undefined,
    positionTitle: row.positionTitle,
    experienceYears: row.experienceYears ?? undefined,
    currentCompany: row.currentCompany || undefined,
    currentCtc: row.currentCtc || undefined,
    expectedCtc: row.expectedCtc || undefined,
    noticePeriodDays: row.noticePeriodDays ?? undefined,
    source: row.source || undefined,
    status: row.status as LateralCandidate['status'],
    roleGrade: row.roleGrade || undefined,
    resumeFileKey: row.resumeFileKey || undefined,
    resumeSha256: row.resumeSha256 || undefined,
    resumeUploadedAt: row.resumeUploadedAt ? row.resumeUploadedAt.toISOString() : undefined,
    mappedInterviewId: row.mappedInterviewId || undefined,
    createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
  }),

  getLateralCandidates: async (): Promise<LateralCandidate[]> => {
    const rows = await dbClient
      .select()
      .from(schema.lateralCandidates)
      .where(isNull(schema.lateralCandidates.deletedAt))
      .orderBy(desc(schema.lateralCandidates.createdAt));
    return rows.map(db.mapLateralCandidateRow);
  },

  getLateralCandidate: async (id: string): Promise<LateralCandidate | null> => {
    const [row] = await dbClient
      .select()
      .from(schema.lateralCandidates)
      .where(and(eq(schema.lateralCandidates.id, id), isNull(schema.lateralCandidates.deletedAt)))
      .limit(1);
    return row ? db.mapLateralCandidateRow(row) : null;
  },

  addLateralCandidate: async (params: {
    name: string;
    email: string;
    phone?: string;
    positionTitle: string;
    experienceYears?: number;
    currentCompany?: string;
    currentCtc?: string;
    expectedCtc?: string;
    noticePeriodDays?: number;
    source?: string;
    roleGrade?: string;
  }): Promise<LateralCandidate> => {
    const id = crypto.randomUUID();
    await dbClient.insert(schema.lateralCandidates).values({
      id,
      name: params.name,
      email: params.email,
      phone: params.phone,
      positionTitle: params.positionTitle,
      experienceYears: params.experienceYears,
      currentCompany: params.currentCompany,
      currentCtc: params.currentCtc,
      expectedCtc: params.expectedCtc,
      noticePeriodDays: params.noticePeriodDays,
      source: params.source,
      roleGrade: params.roleGrade,
      status: 'NEW',
      createdAt: new Date(),
    });
    const created = await db.getLateralCandidate(id);
    if (!created) throw new Error('Failed to retrieve created lateral candidate');
    return created;
  },

  updateLateralCandidate: async (id: string, params: Partial<{
    name: string;
    email: string;
    phone: string;
    positionTitle: string;
    experienceYears: number;
    currentCompany: string;
    currentCtc: string;
    expectedCtc: string;
    noticePeriodDays: number;
    source: string;
    roleGrade: string;
    status: LateralCandidate['status'];
  }>): Promise<boolean> => {
    await dbClient.update(schema.lateralCandidates).set(params as any).where(eq(schema.lateralCandidates.id, id));
    return true;
  },

  deleteLateralCandidate: async (id: string): Promise<boolean> => {
    await dbClient.update(schema.lateralCandidates).set({ deletedAt: new Date() }).where(eq(schema.lateralCandidates.id, id));
    return true;
  },

  setLateralCandidateResume: async (id: string, params: { fileKey: string; sha256: string }): Promise<boolean> => {
    await dbClient
      .update(schema.lateralCandidates)
      .set({ resumeFileKey: params.fileKey, resumeSha256: params.sha256, resumeUploadedAt: new Date() })
      .where(eq(schema.lateralCandidates.id, id));
    return true;
  },

  // Links a newly scheduled interview to the lateral candidate and advances their
  // pipeline status out of NEW/SCREENING, without clobbering a status the
  // recruiter already moved forward manually (e.g. OFFERED).
  setLateralCandidateInterview: async (id: string, interviewId: string): Promise<boolean> => {
    const candidate = await db.getLateralCandidate(id);
    if (!candidate) return false;
    const nextStatus = (candidate.status === 'NEW' || candidate.status === 'SCREENING') ? 'INTERVIEWING' : candidate.status;
    await dbClient
      .update(schema.lateralCandidates)
      .set({ mappedInterviewId: interviewId, status: nextStatus })
      .where(eq(schema.lateralCandidates.id, id));
    return true;
  },

  // All interview rounds tied to a lateral candidate by email (same denormalized-email
  // matching pattern already used for campus candidates in CandidatesTab).
  getInterviewsForEmail: async (email: string): Promise<Interview[]> => {
    const normalizedEmail = email.trim().toLowerCase();
    const all = await db.getInterviews();
    return all.filter((i) => i.candidateEmail.toLowerCase() === normalizedEmail);
  },

  // --- Recalibrate (live spec-driven scoring session) helpers ---

  mapRecalibrateSessionRow: (row: typeof schema.recalibrateSessions.$inferSelect): RecalibrateSession => ({
    id: row.id,
    interviewId: row.interviewId,
    aiRunId: row.aiRunId,
    questionScores: (row.questionScores as Record<string, number>) ?? {},
    rubricScores: (row.rubricScores as Record<string, number>) ?? {},
    notes: row.notes,
    timerStartedAt: row.timerStartedAt ? row.timerStartedAt.toISOString() : null,
    timerEndedAt: row.timerEndedAt ? row.timerEndedAt.toISOString() : null,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    submittedBy: row.submittedBy ?? null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : new Date().toISOString(),
  }),

  // Read-only lookup (no auto-create) — used by the recruiter-facing report view so an
  // unopened Recalibrate tab doesn't spuriously create a session row.
  getRecalibrateSession: async (interviewId: string): Promise<RecalibrateSession | null> => {
    const [row] = await dbClient
      .select()
      .from(schema.recalibrateSessions)
      .where(eq(schema.recalibrateSessions.interviewId, interviewId))
      .limit(1);
    return row ? db.mapRecalibrateSessionRow(row) : null;
  },

  getOrCreateRecalibrateSession: async (interviewId: string): Promise<RecalibrateSession> => {
    const [existing] = await dbClient
      .select()
      .from(schema.recalibrateSessions)
      .where(eq(schema.recalibrateSessions.interviewId, interviewId))
      .limit(1);
    if (existing) return db.mapRecalibrateSessionRow(existing);

    const id = crypto.randomUUID();
    const now = new Date();
    await dbClient.insert(schema.recalibrateSessions).values({
      id,
      interviewId,
      questionScores: {},
      rubricScores: {},
      createdAt: now,
      updatedAt: now,
    });
    const [row] = await dbClient
      .select()
      .from(schema.recalibrateSessions)
      .where(eq(schema.recalibrateSessions.id, id))
      .limit(1);
    return db.mapRecalibrateSessionRow(row);
  },

  updateRecalibrateSession: async (interviewId: string, patch: Partial<{
    aiRunId: string | null;
    questionScores: Record<string, number>;
    rubricScores: Record<string, number>;
    notes: string | null;
    timerStartedAt: Date | null;
    timerEndedAt: Date | null;
    submittedAt: Date | null;
    submittedBy: string | null;
  }>): Promise<RecalibrateSession> => {
    await db.getOrCreateRecalibrateSession(interviewId); // ensure a row exists first
    await dbClient
      .update(schema.recalibrateSessions)
      .set({ ...patch, updatedAt: new Date() } as any)
      .where(eq(schema.recalibrateSessions.interviewId, interviewId));
    const [row] = await dbClient
      .select()
      .from(schema.recalibrateSessions)
      .where(eq(schema.recalibrateSessions.interviewId, interviewId))
      .limit(1);
    return db.mapRecalibrateSessionRow(row);
  },
};
