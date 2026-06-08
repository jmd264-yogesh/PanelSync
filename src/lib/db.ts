import fs from 'fs';
import path from 'path';

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

interface DatabaseSchema {
  interviews: Interview[];
}

const DB_PATH = path.join(process.cwd(), 'db.json');

// Helper to read database
function readDb(): DatabaseSchema {
  try {
    if (!fs.existsSync(DB_PATH)) {
      const initialDb: DatabaseSchema = { interviews: [] };
      fs.writeFileSync(DB_PATH, JSON.stringify(initialDb, null, 2), 'utf-8');
      return initialDb;
    }
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading JSON DB, returning empty schema:', error);
    return { interviews: [] };
  }
}

// Helper to write database
function writeDb(data: DatabaseSchema): void {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing JSON DB:', error);
  }
}

// Database helper operations
export const db = {
  // Get all interviews sorted by newest
  getInterviews: (): Interview[] => {
    const data = readDb();
    return data.interviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  // Get a single interview
  getInterview: (id: string): Interview | null => {
    const data = readDb();
    const interview = data.interviews.find((i) => i.id === id);
    return interview || null;
  },

  // Find panel and interview by token
  getInterviewByPanelToken: (token: string): { interview: Interview; panel: InterviewPanel } | null => {
    const data = readDb();
    for (const interview of data.interviews) {
      const panel = interview.panels.find((p) => p.token === token);
      if (panel) {
        return { interview, panel };
      }
    }
    return null;
  },

  // Create an interview
  createInterview: (params: {
    candidateName: string;
    candidateEmail: string;
    role: string;
    duration: number;
    startDate: string;
    endDate: string;
    panels: { userId: string; name: string; email: string }[];
  }): Interview => {
    const data = readDb();
    const interviewId = crypto.randomUUID();
    const now = new Date().toISOString();

    const panels: InterviewPanel[] = params.panels.map((p) => ({
      id: crypto.randomUUID(),
      interviewId,
      userId: p.userId,
      name: p.name,
      email: p.email,
      token: crypto.randomUUID().replace(/-/g, ''), // Unguessable token
      status: 'PENDING',
      availabilities: [],
    }));

    const newInterview: Interview = {
      id: interviewId,
      candidateName: params.candidateName,
      candidateEmail: params.candidateEmail,
      role: params.role,
      duration: params.duration,
      startDate: params.startDate,
      endDate: params.endDate,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
      panels,
    };

    data.interviews.push(newInterview);
    writeDb(data);
    return newInterview;
  },

  // Submit availability for a panel
  submitAvailability: (panelToken: string, slots: { startTime: string; endTime: string }[]): boolean => {
    const data = readDb();
    
    // Find interview index and panel index
    let interviewIdx = -1;
    let panelIdx = -1;

    for (let i = 0; i < data.interviews.length; i++) {
      const pIdx = data.interviews[i].panels.findIndex((p) => p.token === panelToken);
      if (pIdx !== -1) {
        interviewIdx = i;
        panelIdx = pIdx;
        break;
      }
    }

    if (interviewIdx === -1 || panelIdx === -1) {
      return false;
    }

    const interview = data.interviews[interviewIdx];
    const panel = interview.panels[panelIdx];

    // Map new availabilities
    const availabilities: PanelAvailability[] = slots.map((s) => ({
      id: crypto.randomUUID(),
      panelId: panel.id,
      startTime: s.startTime,
      endTime: s.endTime,
    }));

    panel.availabilities = availabilities;
    panel.status = 'SUBMITTED';
    panel.submittedAt = new Date().toISOString();
    
    // Check if all panels for this interview have submitted availability
    const allSubmitted = interview.panels.every((p) => p.status === 'SUBMITTED');
    if (allSubmitted && interview.status === 'PENDING') {
      interview.status = 'COLLECTED';
    }

    interview.updatedAt = new Date().toISOString();
    writeDb(data);
    return true;
  },

  // Book the interview with a selected slot
  bookInterview: (
    interviewId: string,
    params: {
      scheduledSlotStart: string;
      scheduledSlotEnd: string;
      teamsMeetingUrl: string;
      calendarEventId: string;
    }
  ): boolean => {
    const data = readDb();
    const interview = data.interviews.find((i) => i.id === interviewId);
    
    if (!interview) {
      return false;
    }

    interview.status = 'SCHEDULED';
    interview.scheduledSlotStart = params.scheduledSlotStart;
    interview.scheduledSlotEnd = params.scheduledSlotEnd;
    interview.teamsMeetingUrl = params.teamsMeetingUrl;
    interview.calendarEventId = params.calendarEventId;
    interview.updatedAt = new Date().toISOString();

    writeDb(data);
    return true;
  },

  // Delete an interview record
  deleteInterview: (id: string): boolean => {
    const data = readDb();
    const initialLen = data.interviews.length;
    data.interviews = data.interviews.filter((i) => i.id !== id);
    
    if (data.interviews.length === initialLen) {
      return false;
    }
    
    writeDb(data);
    return true;
  }
};
