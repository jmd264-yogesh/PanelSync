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
│   │   └── DashboardClient.tsx   # MAIN UI (~2872 lines, 'use client')
│   ├── availability/[token]/
│   │   └── AvailabilityClient.tsx  # Public tokenised page for panelist slot submission
│   └── api/
│       ├── auth/                 # /api/auth/callback, /api/auth/signout
│       ├── users/                # /api/users/search  — Graph user search proxy
│       ├── panelists/            # /api/panelists — GET/POST/DELETE panelist directory
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

## 6. Main Dashboard (`src/app/dashboard/DashboardClient.tsx`)

2800+ line `'use client'` component. Two tabs: **Interviews** and **Panelists**.

### Key State Variables
```ts
activeTab: 'interviews' | 'panelists'
interviews: Interview[]
panelists: Panelist[]
selectedInterview: Interview | null

// Create interview form
candidateName, candidateEmail, role, duration, startDate, endDate
interviewType: 'L1' | 'L2' | 'General'
selectedPanels: GraphUser[]

// Panelist-first slot request (new flow)
reqPanelists: Panelist[]         // panelists selected for request
reqDuration, reqStartDate, reqEndDate, reqInterviewType
reqSlots: { startTime, endTime, selected }[]

// Bulk multi-select (SEPARATE per column to avoid collision)
bulkSelectedL1Ids: string[]      // IDs selected in L1 column only
bulkSelectedL2Ids: string[]      // IDs selected in L2 column only

// L1/L2 interview time config
l1TimeStart, l1TimeEnd           // default '10:00' – '13:00'
l2TimeStart, l2TimeEnd           // default '14:00' – '17:00'
```

### Interviews Tab
- List view + tracker/cockpit view toggle
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

---

## 7. Panelist Slot Request Flow (New Flow)

> This is the "Panelist-first" scheduling flow — collect slots before assigning a candidate.

1. Manager selects panelists from the directory (bulk or individual)
2. Opens slot request modal: sets date range, duration, interview type
3. App generates proposed time slots (respecting L1/L2 time windows)
4. Manager selects which slots to include
5. Clicks send → `POST /api/interviews/request-panelist`
6. API creates an interview record with `candidateName = 'Pending Assignment'`
7. Inserts a panel row for each panelist, generates unique token
8. Sends a Teams 1:1 message (HTML card) with availability link

Later, candidate is attached via `POST /api/interviews/assign-candidate`.

---

## 8. Availability Submission (`src/app/availability/[token]`)

- Public page, no auth required
- Token in URL → `db.getInterviewByPanelToken(token)` → shows interview details
- Panelist picks their available time slots from a calendar-style picker
- Submits → `db.submitAvailability(token, slots)`
- When all panels submit, interview auto-transitions to `COLLECTED`

---

## 9. Environment Variables

```env
DATABASE_URL=                    # Neon Postgres connection string
AZURE_AD_CLIENT_ID=              # App registration client ID
AZURE_AD_CLIENT_SECRET=          # App registration client secret
AZURE_AD_TENANT_ID=              # Azure AD tenant ID
NEXTAUTH_URL=                    # Public base URL (e.g. http://localhost:3000)
SESSION_SECRET=                  # JWT signing secret (for session cookies)
```

---

## 10. Key Conventions & Gotchas

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

## 11. Running Locally

```bash
npm run dev        # Start dev server (Next.js on port 3000)
npx tsc --noEmit   # Type-check without building
npx drizzle-kit migrate  # Apply DB migrations
```
