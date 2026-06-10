import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, and, inArray } from 'drizzle-orm';
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
    await dbClient
      .update(schema.interviews)
      .set({
        status: 'SCHEDULED',
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
};
