import { pgTable, varchar, text, integer, timestamp, unique } from 'drizzle-orm/pg-core';

// 1. Sessions Table
export const sessions = pgTable('sessions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at').notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  userDisplayName: varchar('user_display_name', { length: 255 }).notNull(),
  userEmail: varchar('user_email', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Interviews Table
export const interviews = pgTable('interviews', {
  id: varchar('id', { length: 255 }).primaryKey(),
  candidateName: varchar('candidate_name', { length: 255 }).notNull(),
  candidateEmail: varchar('candidate_email', { length: 255 }).notNull(),
  role: varchar('role', { length: 255 }).notNull(),
  duration: integer('duration').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  status: varchar('status', { length: 50 }).notNull(), // PENDING, COLLECTED, SCHEDULED, CANCELLED
  teamsMeetingUrl: text('teams_meeting_url'),
  calendarEventId: varchar('calendar_event_id', { length: 255 }),
  scheduledSlotStart: timestamp('scheduled_slot_start'),
  scheduledSlotEnd: timestamp('scheduled_slot_end'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 3. Interview Nominated Panels Table
export const interviewPanels = pgTable('interview_panels', {
  id: varchar('id', { length: 255 }).primaryKey(),
  interviewId: varchar('interview_id', { length: 255 })
    .references(() => interviews.id, { onDelete: 'cascade' })
    .notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(), // Graph user ID
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).unique().notNull(), // Link token
  status: varchar('status', { length: 50 }).notNull(), // PENDING, SUBMITTED
  submittedAt: timestamp('submitted_at'),
}, (t) => [
  unique('unique_interview_email').on(t.interviewId, t.email)
]);

// 4. Panel Available Slots Table
export const panelAvailabilities = pgTable('panel_availabilities', {
  id: varchar('id', { length: 255 }).primaryKey(),
  panelId: varchar('panel_id', { length: 255 })
    .references(() => interviewPanels.id, { onDelete: 'cascade' })
    .notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
});

// 5. Pre-Approved Panelists Directory
export const panelists = pgTable('panelists', {
  id: varchar('id', { length: 255 }).primaryKey(), // Graph User ID
  displayName: varchar('display_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  roles: text('roles').array().notNull(), // text[] role designations (e.g. L1, L2)
  createdAt: timestamp('created_at').defaultNow(),
});

// 6. Pre-Approved Recruiters
export const allowedRecruiters = pgTable('allowed_recruiters', {
  email: varchar('email', { length: 255 }).primaryKey(), // email serves as the unique primary key
  addedBy: varchar('added_by', { length: 255 }), // email of recruiter who added this recruiter
  createdAt: timestamp('created_at').defaultNow(),
});

// 7. Bulk Uploaded Candidates
export const uploadedCandidates = pgTable('uploaded_candidates', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(), // WAITING, MAPPED
  mappedInterviewId: varchar('mapped_interview_id', { length: 255 })
    .references(() => interviews.id, { onDelete: 'cascade' }),
  preferredDate: timestamp('preferred_date'),
  createdAt: timestamp('created_at').defaultNow(),
});

