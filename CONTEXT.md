# PanelSync — AI Coding Context

> Paste this file at the start of any new AI session. Do NOT include node_modules, .next, or any generated files in context.

---

## 1. What Is This?

**PanelSync** is an internal interview scheduling tool for a Microsoft-org team. It helps engineering managers:
- Track interview pipelines (candidates, roles, panel members)
- Collect panel availability via tokenised links
- Book Teams meetings on confirmed slots
- Manage a pre-approved panelist directory (L1 / L2 roles)
- Send Teams chat messages requesting panelist availability slots

**Stack**: Next.js 16 (App Router) · React 19 · TypeScript · Drizzle ORM · Neon Postgres · Microsoft Graph API

---

## 2. Project Layout

```
src/
├── app/
│   ├── page.tsx                  # Login / landing page (MS OAuth redirect)
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Design system (CSS variables, glass-card, btn classes)
│   ├── dashboard/
│   │   ├── page.tsx              # Server component — fetches initial data, renders DashboardClient
│   │   ├── DashboardClient.tsx   # Thin orchestrator (~110 lines) — shared state + tab routing
│   │   └── components/           # One file per tab (all 'use client')
│   │       ├── InterviewsTab.tsx    # Interviews cockpit, tracker, create form, detail panel
│   │       ├── PanelistsTab.tsx     # Panelist directory, bulk selection, slot request modal
│   │       ├── CandidatesTab.tsx    # Candidate queue, bulk upload, mapping
│   │       ├── RecruitersTab.tsx    # Recruiter access management (self-contained)
│   │       ├── CollegesTab.tsx      # College directory management (self-contained)
│   │       └── DrivesTab.tsx        # Drive schedules management (self-contained)
│   ├── availability/[token]/
│   │   └── AvailabilityClient.tsx  # Public tokenised page for panelist slot submission
│   └── api/
│       ├── auth/                 # /api/auth/callback, /api/auth/signout
│       ├── users/                # /api/users/search  — Graph user search proxy
│       ├── panelists/            # /api/panelists — GET/POST/DELETE panelist directory
│       ├── candidates/           # GET/POST candidates queue & upload
│       │   └── [id]/             # DELETE single candidate
│       ├── colleges/             # /api/colleges — GET/POST/DELETE colleges directory
│       ├── drives/               # /api/drives — GET/POST/DELETE drives management
│       └── interviews/
│           ├── create/           # POST — create interview + panels
│           ├── [id]/             # GET/PATCH/DELETE single interview
│           ├── book/             # POST — book a slot → creates Teams meeting + calendar event
│           ├── cancel-booking/   # POST — removes booked slot, reverts status
│           ├── assign-candidate/ # POST — attach a real candidate to a slot-first interview
│           ├── request-panelist/ # POST — send Teams chat message requesting slots (NEW FLOW)
│           └── resend-invite/    # POST — resend availability link via Teams message
├── lib/
│   ├── schema.ts      # Drizzle table definitions (see §4)
│   ├── db.ts          # All DB helper functions (see §4)
│   ├── graph.ts       # GraphService class — MS Graph API calls (see §5)
│   └── session.ts     # Session cookie helpers (jose JWT, file-backed sessions.json)
```

---

## 3. Authentication

- **Provider**: Microsoft Entra ID (Azure AD) OAuth2  
- **Flow**: Redirect to `/api/auth/callback` → JWT session stored in `sessions.json` (local) + cookie  
- **Session helper**: `src/lib/session.ts` — `getSession(req)` returns `{ accessToken, userId, userDisplayName, userEmail }`
- **Access token** is passed down from server components to Graph API calls; token refresh is handled in `session.ts`

---

## 4. Database (Neon Postgres + Drizzle ORM)

Connection string env var: `DATABASE_URL`

### Tables (defined in `src/lib/schema.ts`)

| Table | Key Fields |
|---|---|
| `sessions` | `id`, `access_token`, `refresh_token`, `expires_at`, `user_id`, `user_display_name`, `user_email` |
| `interviews` | `id`, `candidate_name`, `candidate_email`, `role`, `duration` (mins), `start_date`, `end_date`, `status`, `teams_meeting_url`, `calendar_event_id`, `scheduled_slot_start`, `scheduled_slot_end` |
| `interview_panels` | `id`, `interview_id` (FK→interviews cascade), `user_id` (Graph ID), `name`, `email`, `token` (unique URL token), `status` (PENDING/SUBMITTED), `submitted_at` |
| `panel_availabilities` | `id`, `panel_id` (FK→interview_panels cascade), `start_time`, `end_time` |
| `panelists` | `id` (Graph user ID), `display_name`, `email`, `roles` (text[] e.g. ['L1','L2']), `created_at` |
| `uploaded_candidates` | `id`, `name`, `email`, `status` (WAITING/MAPPED), `mapped_interview_id` (FK→interviews cascade), `college`, `created_at` |
| `colleges` | `id`, `name` (unique), `created_at` |
| `drives` | `id`, `college_name`, `start_date`, `end_date` (drive window range), `status` (OPEN/CLOSED), `is_active` (boolean), `created_at` |
| `lateral_candidates` | `id`, `name`, `email`, `phone`, `position_title`, `experience_years`, `current_company`, `current_ctc`, `expected_ctc`, `notice_period_days`, `source`, `status` (NEW/SCREENING/WAITING_FOR_INTERVIEW/INTERVIEW_SCHEDULED/INTERVIEW_COMPLETED/OFFERED/HIRED/REJECTED/WITHDRAWN), `role_grade` (intern/se/sse/enabler/sc/ssc/architect — Recalibrate difficulty default), `resume_file_key`, `resume_sha256`, `mapped_interview_id` (FK→interviews, set null) |
| `ai_runs` | `id`, `interview_id` (FK→interviews cascade), `candidate_id` (FK→uploaded_candidates, set null), `triggered_by_email`, `status` (QUEUED/PARSING/EXTRACTING/GENERATING/COMPLETED/FAILED), `criteria` (jsonb, resume-driven flow), `spec` (jsonb, spec-driven flow), `resume_digest` (jsonb), `questions` (jsonb — `QuestionSet`), `model`, `prompt_version`, `token_usage` (jsonb), `error` — one immutable row per "Generate" click |
| `recalibrate_sessions` | `id`, `interview_id` (FK→interviews cascade, unique), `ai_run_id` (FK→ai_runs, set null — which run's questions are being scored), `question_scores` (jsonb, `{questionId: 1-5}`), `rubric_scores` (jsonb, `{dimensionLabel: 1-5}`), `notes`, `timer_started_at`, `timer_ended_at`, `submitted_at`, `submitted_by` (panelist email, set server-side) |
| `audit_logs` | `id`, `user_email`, `action`, `entity`, `entity_id`, `metadata` (jsonb), `created_at` — currently only written for `QUESTIONS_EDITED` on an AI run |

### Interview Status Flow
```
PENDING  →  COLLECTED  →  SCHEDULED
                ↑               ↓
         (cancel booking)  CANCELLED
```
- `PENDING` — waiting for all panels to submit availability
- `COLLECTED` — all panels submitted; ready to book
- `SCHEDULED` — Teams meeting booked
- `CANCELLED` — manually cancelled

### DB Helper (`src/lib/db.ts` → `export const db`)
All methods are async. Key ones:
- `db.getInterviews()` — all interviews with nested panels + availabilities
- `db.getInterview(id)` — single interview
- `db.getInterviewByPanelToken(token)` — look up by panel URL token
- `db.createInterview(params)` — creates interview + panel rows
- `db.submitAvailability(token, slots)` — saves slots, auto-transitions to COLLECTED
- `db.bookInterview(id, params)` — sets scheduled slot + Teams meeting
- `db.cancelBooking(id)` — reverts booking, recalculates status
- `db.deleteInterview(id)`
- `db.getPanelists()` — panelist directory
- `db.addPanelist(user, roles)` — upsert
- `db.removePanelist(id)`
- `db.getUploadedCandidates()` — get all candidates in queue
- `db.addUploadedCandidates(candidates)` — bulk insert candidates
- `db.deleteUploadedCandidate(id)` — delete candidate from queue
- `db.autoMapPendingCandidates(tokenInfo)` — map waiting candidates to ready L1 panels
- `db.getColleges()` — get all registered colleges
- `db.addCollege(name)` — register a new college with a generated UUID
- `db.deleteCollege(id)` — remove college by ID
- `db.getDrives()` — get all scheduled drives
- `db.getActiveDrive()` — get the single active drive or null
- `db.createDrive(collegeName, startDate, endDate)` — schedule a new drive spanning a date range
- `db.setActiveDrive(id)` — set the active drive (toggling all others inactive); only an OPEN drive can be made active
- `db.setDriveStatus(id, 'OPEN' | 'CLOSED')` — open/close a drive; closing also clears its active flag
- `db.deleteDrive(id)` — delete a drive record

---

## 5. Microsoft Graph Integration (`src/lib/graph.ts`)

`GraphService` class (singleton export: `graphService`).  
All methods accept `accessToken: string` from the current session.

| Method | What it does |
|---|---|
| `searchUsers(query, token)` | Search org users by name/email |
| `createTeamsMeeting(...)` | Creates an online Teams meeting via `/me/onlineMeetings` |
| `createCalendarEvent(...)` | Creates a calendar event on the user's calendar |
| `deleteCalendarEvent(id, token)` | Deletes a calendar event |
| `sendTeamsMessage(targetUserId, htmlContent, token)` | Creates a 1:1 Teams chat and sends an HTML message |
| `getTeamsChat(targetUserId, token)` | Gets or creates a 1:1 chat |

---

## 6. Main Dashboard Architecture

`DashboardClient.tsx` is now a **thin orchestrator** (~110 lines) that owns only cross-tab shared state and renders the appropriate tab component.

### Shared State in DashboardClient
```ts
activeTab: 'interviews' | 'panelists' | 'recruiters' | 'candidates' | 'colleges' | 'drives'
interviews: Interview[]           // shared between Interviews and Panelists tabs
panelists: Panelist[]             // shared between Interviews and Panelists tabs
collegesList: College[]           // shared between Interviews, Panelists, Candidates, Colleges, and Drives tabs
candidates: UploadedCandidate[]   // shared between Interviews and Candidates tabs
drives: Drive[]                   // shared drives list
activeDrive: Drive | null         // single active drive pre-filled across tabs
todayStr: string                  // ISO date string for today, passed to children
```

### Tab Components (`src/app/dashboard/components/`)

#### `InterviewsTab.tsx` — self-manages UI state
```ts
// UI States (local)
statusFilter, cockpitView, selectedInterview, showCreateForm, detailTab
candidateName, candidateEmail, role, duration, startDate, endDate
interviewType: 'L1' | 'L2' | 'General'
selectedPanels: GraphUser[]
selectedSlot, bookingDescription
isEditingDates, editStartDate, editEndDate
selectedDriveId: string  // which drive the dashboard scopes to (in-tab selector)
drives: Drive[] (passed prop)  // populates the "Viewing Drive" selector
activeDrive: Drive | null (passed prop) // only used to seed the initial selected drive
// Handlers: handleCreateInterview, handleDeleteInterview, handleBookSlot,
//           handleCancelBooking, handleResendInvite, handleUpdateDates
```
The dashboard scopes all metrics and lists to the **selected drive** (a "Viewing Drive" dropdown at the top), not the global active drive. It seeds to the active drive on first load, then the recruiter can switch to any drive (including closed ones) without changing the global active drive. Selecting a drive filters interviews to that drive's college **and** date window (start → end); "All Drives" shows everything.

#### `PanelistsTab.tsx` — self-manages UI state
```ts
// Key state (local)
reqPanelists: Panelist[]         // panelists selected for slot request
reqDuration, reqStartDate, reqEndDate, reqInterviewType
reqSlots: { startTime, endTime, selected }[]
bulkSelectedL1Ids: string[]      // IDs selected in L1 column only
bulkSelectedL2Ids: string[]      // IDs selected in L2 column only
l1TimeStart, l1TimeEnd           // default '10:00' – '13:00'
l2TimeStart, l2TimeEnd           // default '14:00' – '17:00'
defaultStartDate, defaultEndDate
collegeName: string
activeDrive: Drive | null (passed prop, updates default timing configs)
```

#### `CandidatesTab.tsx` — self-manages UI state  
Handles bulk upload (xlsx), single candidate add, inline editing, and mapping candidates to interviews.
- **Scoping & Filters**: Integrates `activeDrive` to default filter scoping to the active drive on load (matching candidate's college or drive college). Allows filtering by status, college (drive), and drive date.
- **Split L1/L2 Results**: Displays candidate outcomes under separate **L1 Result** and **L2 Result** columns, calculated dynamically from actual interview panel decisions and `outcomeStatus` values.
- **Excel Export**: Features an **Export to Excel** button to download the filtered candidate list as a formatted `.xlsx` spreadsheet with auto-fitted columns.

#### `RecruitersTab.tsx` — fully self-contained (no props)  
Manages the recruiter access list, add/delete recruiters.

#### `CollegesTab.tsx` — accepts `collegesList` + `setCollegesList` props  
Manages college directory; owns its own `fetchColleges` internally.

#### `DrivesTab.tsx` — accepts drives and activeDrive props  
Manages drive schedule, creates new drives spanning a **start/end date range**, switches the active drive (synchronized across all tabs), **closes/reopens drives** (a closed drive can't be active; reopen restores it), and deletes drives. Each drive shows its date window and an OPEN/CLOSED/Active status badge.

### Interviews Tab
- List view + tracker/cockpit view toggle
- Drive Metrics Dashboard at the top:
  - **Candidates Mapped Card**: Displays the mapped / total candidates ratio, pending candidates count, and a sleek progress bar indicating mapping progress.
  - **Panel Requests Card (Interactive)**: Combines total requests sent, accepted requests, rejected requests, and requests yet to respond. Clicking this card opens a detailed status dialog listing panel members prioritized by status:
    1. **Yet to Respond** (status `PENDING`)
    2. **Rejected** (status `REJECTED`, showing rejection reason)
    3. **Accepted** (status `SUBMITTED`)
  - **Interview Results Card (Interactive)**: Displays total passed and rejected counts for the cohort. Clicking this card opens a detailed feedback dialog showing panelist names, ratings, and feedback text for each candidate.
- Cards show: status badge, candidate, role, duration, date range, panel list with their submission status
- Status badges: `PENDING` (orange), `COLLECTED` (blue), `SCHEDULED` (green), `CANCELLED` (red)
- Click a card → side panel with slot overlap matrix, book button, Teams link
- Booking flow: picks an overlapping slot → calls `/api/interviews/book` → creates Teams meeting + calendar event

### Panelists Tab
- Panelist directory split into two columns: **L1 Screening Panels** and **L2 System/Mgmt Panels**
- Each column has its own "Select All" checkbox
- Per-panelist checkboxes use SEPARATE state arrays (`bulkSelectedL1Ids` / `bulkSelectedL2Ids`) so the same person appearing in both L1 and L2 lists has independent checked state
- Sticky floating action bar when any selection → "Request L1 Slots" / "Request L2 Slots" buttons
- Slot request modal: date range picker, time windows, generates per-day slots, sends Teams message via `/api/interviews/request-panelist`
- Admin add: search org users → assign L1/L2 roles → save
- **Interview Scheduler Defaults** card (renamed from "Auto-Scheduler Timing Configurations"): 4-column configuration panel with:
  - L1 Timing Period (start/end time for L1 scheduling window)
  - L2 Timing Period (start/end time for L2 scheduling window)
  - Default Proposed Date Range (start/end date pre-filled in slot request modals)
  - College / Institution dropdown — default college selected from the central colleges directory

### Colleges Tab
- Central directory to view, register, and delete colleges we will be going for interviews.
- Single source of truth: adding colleges here populates dropdowns across scheduler settings, slot request modals, and candidate bulk uploads.

---

## 7. Panelist Slot Request Flow (New Flow)

> This is the "Panelist-first" scheduling flow — collect slots before assigning a candidate.

1. Manager selects panelists from the directory (bulk or individual)
2. Opens slot request modal: sets duration and interview type. The **date window and college are taken automatically from the Active Drive** (shown read-only in the modal) — the recruiter is not asked for start/end dates. If no active drive is set, the modal falls back to a manual college dropdown + date-range inputs and warns the user to set an active drive.
3. App generates proposed time slots across the active drive's date window (respecting L1/L2 time windows)
4. Manager selects which slots to include
5. Clicks send → `POST /api/interviews/request-panelist`
6. API creates an interview record with `candidateName = 'Pending Assignment'` and appends the college name to the role (e.g. `L1 Interview - IIT Bombay`)
7. Inserts a panel row for each panelist, generates unique token
8. Sends a Teams 1:1 message (HTML card) with availability link, showing the college name in the request card description

Later, candidate is attached via `POST /api/interviews/assign-candidate`.

---

## 8. Candidate Bulk Upload and Automated Mapping Flow (New Flow)

> This flow handles bulk uploads of candidates and their automatic pairing to L1 interview slots.

1. Recruiter selects a college under "College Name of Drive (Optional)" from the dropdown and/or specifies a drive date under "Drive Date (Optional)" and uploads an Excel (.xlsx, .xls) or CSV template in the **Candidate Queue** dashboard tab.
2. The candidates are parsed, pulling from the spreadsheet columns such as "Name", "Email", "College Name of Drive" (or "College", "Institution", "University", "College Name"), and "Drive Date" (or "Date", "Preferred Date", "Interview Date", "Date of Drive") with fallback to the default selections in the upload card. The parsed records are saved into the `uploaded_candidates` table with status `WAITING`.
3. The system immediately checks for any "ready" L1 interviews (which have `candidateName = 'Pending Assignment'`, status is `COLLECTED`, and have a confirmed/booked slot).
4. If found, it automatically maps the oldest waiting candidates to these L1 interviews:
   - Updates the interview's candidate details.
   - Sets the interview status to `SCHEDULED`.
   - Patches the Microsoft Teams calendar event with candidate name and email.
   - Marks the candidate as `MAPPED` in the database.
5. If no ready panels are available, candidates wait in the queue (`WAITING`).
6. Once a panelist accepts/books a slot for a pending assignment L1 interview (calling `/api/availability/select-slot`), the system checks for waiting candidates and automatically maps the oldest waiting candidate to that interview immediately.

---

## 9. Availability Submission (`src/app/availability/[token]`)

- Public page, no auth required
- Token in URL → `db.getInterviewByPanelToken(token)` → shows interview details
- Panelist picks their available time slots from a calendar-style picker
- Submits → `db.submitAvailability(token, slots)`
- When all panels submit, interview auto-transitions to `COLLECTED`

---

## 10. Environment Variables

```env
DATABASE_URL=                    # Neon Postgres connection string
AZURE_AD_CLIENT_ID=              # App registration client ID
AZURE_AD_CLIENT_SECRET=          # App registration client secret
AZURE_AD_TENANT_ID=              # Azure AD tenant ID
NEXTAUTH_URL=                    # Public base URL (e.g. http://localhost:3000)
SESSION_SECRET=                  # JWT signing secret (for session cookies)
GEMINI_API_KEY=                  # Google Gemini API key — powers the AI Interview Copilot / Recalibrate question generation
GEMINI_MODEL=                    # Optional model override (defaults to gemini-3.1-flash-lite in src/lib/ai/provider.ts)
BLOB_READ_WRITE_TOKEN=           # Vercel Blob token — used by src/lib/blob.ts to store/fetch uploaded resumes
```

---

## 11. Key Conventions & Gotchas

- **Next.js 16 App Router** — all server components in `page.tsx`, client logic in `*Client.tsx` files
- **No Tailwind** — vanilla CSS only; design tokens live in `globals.css` as CSS custom properties (`--primary`, `--border-glass`, `--radius-md`, etc.)
- **Drizzle migrations** via `drizzle-kit` — run `npx drizzle-kit migrate` to apply schema changes
- **`sessions.json`** is a local file cache for session data (not for production use)
- **`db.json`** is a legacy/scratch file — not in active use
- **Graph token** is the logged-in user's delegated access token (not app-only); all Graph calls act as the current user
- **Panelist ID** = Microsoft Graph User ID (`string`)  
- **Interview Panel** (`interview_panels`) is the join between an interview and a panelist — distinct from the `panelists` directory table
- **Bulk selection collision fix**: `bulkSelectedL1Ids` and `bulkSelectedL2Ids` are fully separate arrays — never merge them; a panelist in both L1 and L2 columns must be toggled independently per column

---

## 12. Running Locally

```bash
npm run dev        # Start dev server (Next.js on port 3000)
npx tsc --noEmit   # Type-check without building
npx drizzle-kit migrate  # Apply DB migrations
```

---

## 13. Feedback Segregation & Panelist Portal Tabs (New Feature)

- **L1/L2 Feedback Visibility Rules**:
  - **L2 Panelists** can view submitted L1 round feedback (ratings and comments) for reference, lazy-loaded on L2 card accordion expansion.
  - **L1 Panelists** cannot view L2 feedback under any circumstances.
  - **Access Authorization**: The backend `/api/panelist/l1-feedback` route secures this by verifying that the requesting panelist is explicitly assigned to an **L2** interview for the candidate before returning the L1 feedback data.
- **Panelist Dashboard Round-based Tabs**:
  - Added horizontal tabs (**All Panels**, **L1 Round**, **L2 Round**) at the top of the panelist dashboard `/panelist`.
  - The tabs dynamically filter both **Pending Action / Slot Requests** and **Scheduled Assignments** sections.
  - Each tab includes real-time counters representing the total item matches under current filters (e.g. active drive scope and date constraints).
- **Scheduled Assignment Fetching**:
  - Modified `db.getPanelistInterviews` to select panels with both `PENDING` and `SUBMITTED` statuses for scheduled interviews, resolving a bug where scheduled interviews pending feedback were omitted from the panelist's "My Interviews" view.
- **Hydration Workaround**:
  - Intercepted and suppressed the false-positive React 19 / Next.js warning (`Encountered a script tag while rendering React component`) caused by the unmaintained `next-themes` script injection during local development in `ThemeProvider`.

---

## 14. Past Slot Prevention & Expired Slots Validation

- **Frontend Prevention**: In `AvailabilityClient.tsx`, slot selections from nominations (Flow A) whose start time is in the past compared to `Date.now()` are disabled, greyed out, and visually styled as `Expired` with a red badge tag. Proposing slots in the past (Flow B) is also blocked in the slot adding function with a warning.
- **Backend Validation**:
  - **Booking Endpoint** (`/api/availability/select-slot`): Added validation to reject booking requests if any of the selected slots have start times in the past.
  - **Availability Submission Endpoint** (`/api/availability/submit`): Added validation to check proposed availability lists, rejecting requests that contain past/expired slots.

---

## 15. Lateral Hiring Pipeline (New Feature)

> A second, independent candidate pipeline for experienced ("lateral") hires — parallel to the campus/drive pipeline, not layered on top of it.

- **Table**: `lateral_candidates` (see §4) — soft-deleted via `deleted_at`, not hard-deleted.
- **Recruiter flow** (`src/app/dashboard/components/LateralHiringTab.tsx`, wired into `DashboardClient.tsx` as the `lateral` tab):
  1. **Add Candidate** — name/email/phone/position/experience/current & expected CTC/notice period/source, plus a **Role Grade** dropdown (`intern`→`architect`, from `ROLE_GRADES` in `src/lib/ai/spec-catalog.ts`) that seeds the Recalibrate difficulty default. `POST /api/lateral-candidates`.
  2. **Attach/replace resume** — `POST /api/lateral-candidates/[id]/resume` (multipart).
  3. **Status dropdown** — `PATCH /api/lateral-candidates/[id]` — `NEW → SCREENING → WAITING_FOR_INTERVIEW → INTERVIEW_SCHEDULED → INTERVIEW_COMPLETED → OFFERED/HIRED/REJECTED/WITHDRAWN`.
  4. **Schedule Interview** — a self-contained modal (search-or-pick panelists, no slot-availability round-trip) that calls the *same* `POST /api/interviews/create` used elsewhere, with `role: "LATERAL - <round label> - <position>"` and `lateralCandidateId`. This is how a lateral interview links back to its candidate.
- **Convention, not a schema link**: downstream code detects a lateral interview by **string-matching** `interview.role.toLowerCase().includes('lateral')` — there is no enum/FK marking an interview as "lateral" beyond that role-string prefix.
- `db.getLateralCandidateForInterview(interviewId)` is the lateral-pipeline equivalent of `db.getCandidateForInterview` (which only looks at `uploaded_candidates`) — **a lateral interview has no row in `uploaded_candidates` at all**, so anything that resolves candidates via `getCandidateForInterview` (e.g. the resume-digest AI flow) will not find a lateral candidate's resume. This is a known gap, not yet fixed.
- **Panelist side**: lateral interviews show up in the existing round-tab filters (`ALL | L1 | L2 | LATERAL`) on `/panelist` (`PanelistClient.tsx`), and feedback submission branches on the same role-substring convention to build a `{type:'LATERAL', scores:{technical, communication, collaboration}, ...}` JSON blob stored in `interview_panels.feedback` (a free-text column, not schema-validated).

---

## 16. AI Interview Copilot (New Feature)

> Generates interview questions + scoring rubrics for a panelist, either from a candidate's resume or from a direct role-grade spec — panelists remain the decision-makers and can edit everything the AI proposes.

**Core files** (`src/lib/ai/`):
- `provider.ts` — `getAiProvider()` returns a `StructuredAiProvider` (currently `GeminiProvider`, via `@google/genai`). This is the **single seam** between the app and whichever LLM backs the copilot — swap this file to change providers later. `generateStructured({systemPrompt, userPrompt, zodSchema})`:
  - Passes `zodSchema`'s JSON Schema (via Zod v4's `z.toJSONSchema()`) as `config.responseJsonSchema` to **constrain Gemini's decoding to the actual shape** — critical, because relying on prose alone let the model produce structurally-wrong output (e.g. rubric bands as plain strings instead of `{band, description, exampleSignals}` objects).
  - One repair round-trip on validation failure (shows the model its own output + the Zod errors, asks for corrected JSON) as a second line of defense.
- `schemas.ts` — Zod schemas/types: `ResumeDigestSchema`, `CriteriaSchema` (resume-driven), `SpecSchema` (spec-driven — just `{roleGrade, style, questionCount}`; role grade alone determines the question/rubric category set via `org-rubric.ts`, below), `QuestionSchema` (incl. `rubric: {band, description, exampleSignals}[]` — **`band` must match `/^\d+\s*-\s*\d+$/`**, e.g. `"0-2"`, not a descriptive label — this is enforced by regex precisely because the model will otherwise write "Competent"/"Basic" if not constrained), `QuestionSetSchema`.
- `spec-catalog.ts` — `ROLE_GRADES` (grade→tier, for difficulty calibration), `CALIBRATION` (per-tier grading guidance text), `STYLES` (foundational vs practical), `sortByDifficulty(questions)` (easy→hard ordering).
- `org-rubric.ts` — **the organization's actual interview rubric**, transcribed from its official rubric sheets (Technical Skill Rubric × SE & SSE / Consultant & Sr Consultant / Enabler, plus a shared Behavioural Competency Rubric). This is the real category taxonomy and scoring language for every generated question and every Overall Scoring Rubric row — see §17 for the full shape. Superseded the old generic `TRACKS`/`PLATFORMS`/`TOPICS` chip taxonomy entirely.
- `prompts.ts` — `buildDigestPrompt`, `buildQuestionPrompt` (resume-driven), `buildSpecQuestionPrompt` (spec-driven). The spec-driven prompt embeds each valid category's **actual 1-4 band descriptions** from `org-rubric.ts` so the model can write a question whose answer would actually reveal where a candidate sits on the org's own scale — not just a question about a generic topic label. All prompts treat resume text and panelist `customInstructions` as untrusted **data**, not instructions (explicit prompt-injection defenses).
- `verify.ts` — `verifyQuestionSet(questionSet, focusAreas)`: deterministically re-derives `totalMarks` and rejects mismatches, rejects any question `category` outside `focusAreas`, and re-parses every rubric band's `"N-M"` label to confirm bands fully cover `0..maxMarks` with no gaps/overlaps. **Never trust the model's arithmetic** — this runs after every generation, resume-driven or spec-driven.
- `extract-text.ts` / `redact.ts` — resume text extraction (`ResumeUnreadableError`) and PII redaction before anything is sent to the model.
- `src/lib/blob.ts` — `blob.uploadResume(...)` / `blob.fetchResume(fileKey)`, Vercel Blob-backed.

**API** (`src/app/api/interviews/[id]/ai-runs/`):
- `GET` / `POST route.ts` — panelist-auth gated (`isPanelistAssignedToInterview`). `POST` body is one of:
  - `{ spec }` — no resume needed; builds a fresh `ai_runs` row, generates via `buildSpecQuestionPrompt`, verifies, orders by difficulty.
  - `{ criteria }` or `{}` — resume-driven; requires the candidate (via `db.getCandidateForInterview` — **campus candidates only**, see §15's gap) to have a resume on file; reuses a cached digest if the resume hash hasn't changed, else re-extracts + re-digests.
- `[runId]/route.ts` — `PATCH` persists panelist edits to a run's `questions` (re-verifies against the run's original `focusAreas`, writes an `audit_logs` row `QUESTIONS_EDITED`). The AI's original proposal stays recoverable via run history — this overwrites only the "in-use" copy.

**UI**: `src/app/panelist/components/AiCopilotPanel.tsx` — collapsible card embedded per-interview-row on `/panelist` (only renders when `interview.candidateId` is set, i.e. **not** for lateral interviews today). Two modes (`From Resume` / `From Spec`) — the spec mode is just a Role Grade + Style + question count picker now (see §17 for why the old tracks/platforms/topics chips are gone).

---

## 17. Recalibrate — Live Interview Scoring & Recruiter Review (New Feature)

> Brings the "live interview" half of the `Calibrate_DE_CoE_Interview_Kit.html` prototype (timer, per-question scoring, rubric grid, score/rubric gap analysis, PDF export) into the app as a panelist-facing tab for **Lateral Hiring interviews**, scored against the **organization's actual interview rubric** rather than a generic AI-catalog taxonomy.

**The org rubric** (`src/lib/ai/org-rubric.ts`) — transcribed verbatim from the organization's rubric sheets:
- **Technical Skill Rubric** — three tables, one per seniority tier (`OrgRubricTier`: `'se_sse' | 'consultant' | 'enabler'`), each with its own 1-4 band language ("bar" tagline + per-category descriptions) for the same 7 categories (Azure Databricks, Microsoft Fabric, Snowflake, PySpark, SQL, Data Pipeline & ETL/ELT, AWS/GCP) — Enabler adds an 8th, dbt. `ROLE_GRADE_TO_ORG_TIER` maps every `RoleGrade` onto one of the three tiers (`se`/`sse`/`intern` → `se_sse`; `sc`/`ssc`/`architect` → `consultant`; `enabler` → `enabler` — Intern and Data Architect reuse the closest tier's table since the org hasn't published dedicated ones for those two grades yet).
- **Behavioural Competency Rubric** — one shared 1-4 scale across every role (Business Understanding, Logical Thinking & Problem Solving, People Management, Assertiveness & Comms) — the same band text everywhere; `BEHAVIOURAL_EXPECTED_BAND` records which score range counts as "the bar" for a given tier (e.g. Consultant & above is expected around 3-4; the scale reflects seniority, not "good vs bad" in isolation).
- `deriveFocusAreas(roleGrade)` — the tier's technical category labels + the 4 behavioural labels; this is the AI prompt's allowed "category" list **and** `verifyQuestionSet`'s `focusAreas`.
- `rubricDimensionsWithBands(roleGrade)` — the same combined list, each with its `[score1, score2, score3, score4]` description array, for the Overall Scoring Rubric grid.
- Score scale is 1-4 everywhere in Recalibrate now (Does Not Meet / Partially Meets / Meets Expectation / Exceeds Expectation) — both the per-question scores and the Overall Scoring Rubric grid, so the whole tool reads against one consistent scale (previously per-question was a separate free 1-5).

- **Table**: `recalibrate_sessions` (see §4) — one row per interview, created lazily (`db.getOrCreateRecalibrateSession`) the first time a panelist opens the tab. `db.getRecalibrateSession(interviewId)` is a read-only lookup (no auto-create) used by the recruiter-facing report so an unopened tab doesn't spuriously create a row.
- **API**: `src/app/api/interviews/[id]/recalibrate/route.ts` (panelist-auth gated, same `isPanelistAssignedToInterview` guard as AI Copilot):
  - `GET` — returns the session plus the candidate's `roleGrade` default (from `lateral_candidates`).
  - `PATCH` — partial patch of `{aiRunId, questionScores, rubricScores, notes, timerStartedAt, timerEndedAt}` (all score values integers 1-4), plus a trusted `{submitted: boolean}` flag — the server sets `submittedBy`/`submittedAt` from the session, **never** trusts client-supplied values for those two fields.
- **Panelist UI**: `src/app/panelist/components/RecalibratePanel.tsx`, mounted under a third primary tab (`RECALIBRATE`, alongside `PANELS`/`FEEDBACK`) in `PanelistClient.tsx`, one card per assigned lateral interview (same `role.toLowerCase().includes('lateral')` filter as §15/§16):
  1. Spec inputs — just Role Grade / Style / question count, prefilled from the candidate's role grade — reusing `POST /api/interviews/[id]/ai-runs {spec}` unchanged. Regenerating resets `questionScores`/`rubricScores` for the new run.
  2. Per-question 1-4 scoring + an Overall Scoring Rubric grid split into "Technical Skill Rubric" and "Behavioural Competency Rubric" subsections (dimensions + band text from `rubricDimensionsWithBands`), both using a shared `ScoreDial` control (color-coded by the org's 4 bands). Each rubric row has an expandable "View rubric" showing all 4 band descriptions with the selected one highlighted — the org's own language surfaced as an inline feedback reference while scoring.
  3. Live analysis: avg question score, avg rubric score, and the gap between them, flagged if `|gap| >= 1.0`.
  4. Interview timer (start/stop), notes textarea.
  5. **Submit to recruiters** — sets `submittedAt`/`submittedBy`; a "Withdraw submission" toggle clears them.
  6. Two PDF downloads via `src/lib/pdf/recalibrate-print.ts` (`buildCandidateSheetHtml`/`buildPanelistReportHtml` + `printHtmlDocument` — print-to-PDF via a hidden iframe, no PDF library dependency): a **candidate sheet** (questions only, no answers/rubric/scores) and a **panelist report** (full: model answers, rubric, scores, analysis, notes).
- **Recruiter UI**: a **Recalibrate** button per candidate row in `LateralHiringTab.tsx` (shown once an interview is scheduled) opens `RecalibrateReportModal.tsx`, which calls `GET /api/lateral-candidates/[id]/recalibrate` (recruiter-auth gated via `getSession()`) — **this route only ever returns a submitted session** (`submittedAt` not null); an in-progress/draft session returns 404, so recruiters can never see a panelist's unfinished scoring.
- **Standalone workspace** — `/recalibrate` (`src/app/recalibrate/`) is a dedicated full-page console for the same feature, built for actually running a live interview rather than fitting into a dashboard tab: a left rail lists every assigned lateral candidate with a live-fetched status pill (Not started/In progress/Submitted) and name/role search; selecting one opens a two-pane workspace — a hero header (big live timer), a scrollable question list, and a **sticky right-hand "scorecard"** (live analysis stats + the full Technical/Behavioural rubric grid + notes + submit/download) that stays in view while scrolling questions. The selected candidate is reflected in the URL (`?interview=<id>`). All Recalibrate state/logic lives in the shared hook `src/lib/recalibrate/useRecalibrateSession.ts`, and the score-dial/rubric-row/progress-bar controls in `src/components/recalibrate/primitives.tsx` — both the dashboard-tab `RecalibratePanel.tsx` and the `/recalibrate` workspace render from the exact same hook/primitives, so they can never drift out of sync; only page layout differs between the two.
- **Design note**: all Recalibrate UI is built from the app's existing design tokens (`glass-card`, `badge`, `--success`/`--warning`/`--danger`, `.btn`) — no new ad hoc styles or a separate theme.

