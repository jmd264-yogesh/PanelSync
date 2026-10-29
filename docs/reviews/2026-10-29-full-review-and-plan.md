# PanelSync full review and productionisation plan

**Date:** 29 Oct 2026 · **Scope:** the whole repo as it stands on `feat/rubric-case-study`, including uncommitted work. That work covers the in-person flow, the case study, round parsing, cross-round visibility and the re-run AI evaluation. · **Method:** five parallel read-only reviews (campus flow, lateral and visibility, Recalibrate and AI, security and production, UI/UX), with the highest-severity findings re-checked by hand against the code.

**Verification labels:**
- **✔ verified:** the code path was traced, or re-checked by hand.
- **? suspected:** depends on runtime data, DB constraints or deployment config.

Effort: **S** < ½ day · **M** 1–2 days · **L** 3+ days.

---

## 1. Executive summary

- **Core design is sound, and parts are well built.** AI question generation never regresses: guardrails run, the critic checks, and the best draft is kept. Auto-mapping uses atomic claim-and-release. Cross-round visibility is enforced in one place. Print output is escaped and SQL is parameterised. The L1 → L2 rule holds: **no path lets an L1 panelist see L2 data** (traced across every panelist route).
- **Two problems block normal use right now:**
  - **(C1)** Feedback is rejected as "2-hour edit window expired" whenever it's given more than 2 hours after the slot was booked, which is almost always.
  - **(C2)** The pending `drizzle-kit push` makes Recalibrate fail on every request.
- **Data-loss risks during a live interview:**
  - A failed transcription discards the browser recording.
  - Regenerating questions wipes scores, even after submission.
  - "Apply All AI Scores" replaces the panelist's notes.
  - The interview timer resets on reload.
- **Security needs a focused pass before production:**
  - Panel link tokens leak to co-panelists.
  - Uploaded audio can be served as HTML (stored XSS).
  - Background Graph actions run as a hard-coded or arbitrary signed-in user.
  - Access and refresh tokens are stored in plaintext with no server-side session expiry.
  - Declined panelists keep access.
- **Production operations are thin:**
  - No migrations, only `drizzle-kit push`, and the initdb SQL has drifted.
  - No CI, error boundaries, security headers, rate limits or monitoring.
  - Lint reports 147 errors, mostly `any`.
- **Recalibrate is cluttered:** 3 columns, 2 inner scrollbars, 12+ cards, 3 timers, about 7 primary-styled buttons, 4 different "apply AI" controls, and 4 names for "score with AI".
- **Demo-ready?** Yes, after Phase 0 below (about 3–4 days). Production-ready after Phase 1 (about 2 weeks more).

---

## 2. Findings

### 2.1 Critical: blocks normal use

| ID | Area | Where | What's wrong → failure | Fix | Effort |
|---|---|---|---|---|---|
| C1 ✔ | Flow | `api/panelist/feedback/[panelId]/route.ts:44-53`, `api/feedback/[token]/route.ts:53-61`, `select-slot/route.ts:165-168`, `db.ts:552-555, 1294-1300` | Booking a slot sets the panel to `SUBMITTED` with `submittedAt = now`. The feedback routes treat that as "feedback already given". **Example:** booked Monday, interviewed Wednesday, first feedback rejected with 403. The candidate never reaches PASSED_L1, so L2 never auto-maps. `submitPanelFeedback` also keeps the booking timestamp. | Gate on `decision IS NOT NULL`. Add a `feedback_submitted_at` column and run the 2-hour window from it, in both routes and in the UI `canEdit` check. | S–M |
| C2 ✔ | Data | `schema.ts:277-279`, `docker/initdb/001-schema.sql` | The new `recalibrate_sessions` columns aren't pushed. Every Recalibrate read and write fails (`column "interview_mode" does not exist`, seen in the dev log). The initdb SQL also lacks `interview_audios`. | Run `npx drizzle-kit push` now. Move to `drizzle-kit generate` + `migrate` and regenerate the initdb SQL. | S |
| C3 ✔ | Flow | `useRecalibrateSession.ts` (`handleUploadAudio` swallows errors), `LiveAudioRecorder.tsx:154-156`, `transcript/route.ts` | Any transcription error (Gemini, timeout, 500) still clears the saved clips in the browser. The S3 object exists, but the `interview_audios` row is only written after a successful transcription, so the recording is unrecoverable. | Clear clips only on success. Write the audio row right after the S3 upload. Add "Retry transcription" for saved clips. | S |

### 2.2 High: security

| ID | Where | What's wrong → failure | Fix | Effort |
|---|---|---|---|---|
| S1 ✔ | `api/feedback/[token]` GET, `availability/[token]/page.tsx`, `feedback/[token]/page.tsx`, `panelist/requests` | The full `interview.panels[]` is returned, including **every co-panelist's token**, feedback and decision. Panelist A can submit, pass or decline as B. | Return a DTO that strips tokens and other panels' feedback. | S |
| S2 ✔ | `audios/[audioId]/stream/route.ts:40-45`, `transcript` route stores the client `mimeType` | The audio is served with the client-supplied Content-Type and `Cache-Control: public`. Uploading "audio" as `text/html` runs a script on the app origin for anyone who opens it. | Allow only `audio/*` types. Add `nosniff`, `private, no-store` and Range support. | S |
| S3 ✔ | `session.ts:208-259` `getAnyValidAccessToken` | Unattended actions (public slot booking, auto-map, reminders) use a **hard-coded recruiter's** session, or else the latest session row, which can be a panelist or a removed recruiter. Meetings and chats get sent as the wrong person. Only one session is ever tried. | Use a service mailbox with app-only Graph credentials. Interim fix: filter to allow-listed recruiters and try each session. | M |
| S4 ✔ | `schema.ts:14-22`, `session.ts:17-54` | Graph access and refresh tokens are stored in plaintext. Sessions never expire server-side, so a stolen `sessionId` lives indefinitely. | Encrypt tokens (`SESSION_SECRET` is documented but unused). Add absolute and idle expiry plus a purge job. | M |
| S5 ✔ | `recalibrate/route.ts:85-94`, `transcript/route.ts:45-53` | `aiRunId` from the client isn't checked against the interview. `aiEvaluation` from the client is stored as if it were AI output, so a panelist can forge an "AI evaluation" or link another interview's questions. | Check `run.interviewId === id`. Remove `aiEvaluation` from the PATCH whitelist. | S |
| S6 ✔ | `availability/reject`, `select-slot`, `submit` | `reject` works in any state: it can flip a submitted or scheduled panel and wipe availabilities. `select-slot` accepts unbounded `slots[]` that aren't checked against the proposed ones, and the token is reusable. One request can create N Teams meetings from the recruiter's account. | Allow reject only on PENDING panels. Validate slots with zod (1 slot, must be one of the proposed ones). Claim on panel status `PENDING` before any Graph call. | S–M |
| S7 ✔ | `db.ts:1534-1541` `isPanelistAssignedToInterview`; `isPanelist`, `getPanelistInterviews`, `getPanelistRequests` | The check ignores declined panels and cancelled or deleted interviews. A panelist who declined keeps resume, AI, transcript and submit access. Emails are compared case-sensitively against lowercased session emails, so a `Jane.Doe@` panelist can't log in or sees nothing. | Join on interview status and `deletedAt`; require panel status PENDING or SUBMITTED. Lowercase emails on every write, backfill existing rows, and compare with `LOWER()`. | S |
| S8 ✔/? | `auth/signin:29`, `callback:12,75` | The OAuth `state` is static (login CSRF), the role comes from `state`, and identity is keyed on the mutable `mail` attribute (risk if the app is multi-tenant). | Random `state` and nonce in a signed cookie, plus PKCE. Check `tid`; key identity on `oid`. | S |
| S9 ✔ | `transcript/route.ts`, all public token routes, `ai-runs` POST | No body-size limit on base64 audio (memory DoS). No rate limits anywhere. No per-interview AI budget. | Presigned S3 uploads, size and count caps, a rate limiter, and an AI budget. | M |

### 2.3 High: flow and data integrity

| ID | Where | What's wrong → failure | Fix | Effort |
|---|---|---|---|---|
| F1 ✔ | `select-slot` 105-139, `submit` 80-161 | The candidate is claimed **before** `createTeamsMeeting`. If Graph fails, the candidate is stuck MAPPED, and a retry claims a *different* candidate. `submit` returns `success` and leaves an invisible COLLECTED interview. | Create the meeting first, then claim the candidate, with compensation on failure. | M |
| F2 ✔/? | `select-slot/route.ts:82,105-109,196` | For slot 2 and later, the candidate is mapped to a new UUID before that interview row exists. That's an FK violation, so the request returns 500 after slot 1 is already booked. A retry duplicates meetings. | Insert the interview row first. | S |
| F3 ✔ | `availability/submit/route.ts:70-76` | No round-eligibility check: a candidate who passed L1 can be put into an L1 slot, or a new candidate into an L2 slot. `select-slot` and auto-map already check this. | One shared matcher (round + college + date) in `db.ts`. | S |
| F4 ✔ | `graph.ts` `/me/events` + mixed token sources | Meetings are created as user A (`getAnyValidAccessToken`) but patched or cancelled as recruiter B, which returns 404. Cancel leaves live invites, assign creates duplicates, and the transcript organiser is wrong. | Store the organiser on the interview; use `/users/{organizer}` with an app token. | M–L |
| F5 ✔ | `assign-candidate:47-57`, `interviews/create:50-63` | Candidates are mapped **by email onto every matching row**: deleted rows, rejected rows, other drives, even lateral. The previous candidate is never released, so two candidates can point at one interview. | Assign by `candidateId` with a conditional claim; release the old candidate; check the round. | M |
| F6 ✔ | `useRecalibrateSession.ts:251-260` | Regenerate wipes every score and the AI evaluation with no confirmation, **even after submission**. | Confirm when scores exist; block while submitted. | S |
| F7 ✔ | `useRecalibrateSession.ts:806-864`, `RecalibrateWorkspace.tsx:123-190`, `primitives.tsx:153` | "Apply All AI Scores & Notes" **replaces notes** and overwrites the panelist's own scores without confirmation. The rubric suggestion is computed twice with different logic: the badge shows "AI 0/4" while Apply sets 3. Clicking a 0 badge clears a manual score. | One shared `resolveSuggestedScores()`. Confirm dialog with "fill unscored only" as the default. Append the summary to notes; add Undo. | S–M |
| F8 ✔ | hook `:363-405`, `recalibrate/route.ts:116-118` | The timer stores elapsed **seconds as a timestamp**: `new Date("125")` becomes year 0124. The timer resets on reload, and the recruiter's duration shows 00:00. | Add an `elapsed_seconds` integer column. | S |
| F9 ✔ | hook `patchSession` `:215-224` | Failed saves (scores, notes, mode, timer) are silently ignored, so the UI and the DB disagree. Out-of-order PATCHes can overwrite newer data. | A "not saved" indicator with retry; roll back optimistic state; queue saves. | S–M |
| F10 ✔ | `transcript/route.ts:403-437, 506-513` | "Append clip" is implemented on the server but **never sent by the client**, so recording part 2 replaces part 1 (and its evaluation and speaker map). A silent re-record overwrites a good transcript with empty. | "Add to transcript / Replace" choice; never overwrite with an empty transcript. | M |
| F11 ✔/? | `transcript-evaluator.ts:188`, `audioCompressor.ts`, `provider.ts:166-203` | Long interviews: the evaluator keeps only the first 45k characters (Teams VTT is worse), so late questions score 0 silently. Uploads are re-encoded to WAV, which is about 4× larger and hits Gemini's inline limit after about 8–10 minutes. Gemini calls run one after another with no timeout or retry. | Send compact turns and a `truncated` flag; encode Opus or use the Files API; add timeouts and retries; move work to a background job. | M |
| F12 ✔ | my new `l1-reference` route, `l1-feedback` | The "L1 panel feedback" lists include panels that only booked a slot (status SUBMITTED, no decision), so empty cards appear. | Filter on `decision IS NOT NULL`. | S |
| F13 ✔ | `schema.ts:262-265` | One Recalibrate session per interview. Two panelists on the same interview overwrite each other, and `submittedBy` is whoever clicked last. | Product decision (Q2). Probably one session per interview and panelist. | L |

### 2.4 Medium

| ID | Area | Where | Issue → fix | Effort |
|---|---|---|---|---|
| M1 | Flow | `db.cancelBooking`, `interviews/[id]` PATCH | Cancelling or re-dating doesn't delete the Teams event or release the candidate. `CANCELLED` is never written. **Fix:** unmap, delete the event, reset panel decisions. | M |
| M2 | Flow | `db.ts:1092-1095`, `select-slot`, `submit` | College is parsed with `role.split(' - ')[1]`, so "Anna University - CEG" never matches. **Fix:** store `driveId` or `college` on the interview. | S–M |
| M3 | Data | `api/candidates` POST | Bulk upload has no email normalisation, format check or duplicate check. Uploading the same sheet twice books students twice. A bad date fails halfway through the batch. **Fix:** validate, normalise and dedupe in one insert. | S–M |
| M4 | Data | `deleteUploadedCandidate`, `deleteInterview` | Deleting a mapped candidate leaves a live scheduled interview. Deleting an interview keeps `outcomeStatus` (a REJECTED candidate goes back to WAITING). **Fix:** release and reset consistently. | S |
| M5 | Flow | feedback routes | After an L1 PASS the candidate link is cleared, so the L1 panelist sees "Pending" and loses the resume and copilot. **Fix:** a candidate↔interview history, or `candidate_id` on interviews. | M |
| M6 | Flow | feedback routes | Multi-panel decisions: any PASS wins, and a later REJECT is silently ignored. Needs a consensus rule (Q1). | M |
| M7 | Data | `db.setActiveDrive`, `deleteDrive` | Activation isn't atomic, a CLOSED id leaves no active drive, and drives with dependents can be deleted. **Fix:** a single UPDATE plus a partial unique index. | S |
| M8 | Lateral | `lateral-candidates/[id]` PATCH, POST | Editing the email orphans that candidate's interviews and the L1 reference. Duplicate emails are allowed. The lateral stage never reflects outcomes, and lateral decisions only come in via the token link. **Fix:** `lateral_candidate_id` FK on interviews, a unique email index, and a stage update on decision. | M |
| M9 | Lateral | `request-panelist:131-176` | One interview per panelist, and multi-slot selection creates several meetings for one candidate. A missing `lateralCandidateId` gives a 500 plus an orphan interview. Extra-slot interviews have no organiser. | M |
| M10 | Recal | hook spec vs `activeRun.spec`; mode toggle | Changing role grade or stacks without regenerating changes the rubric rows and averages, so they differ from the recruiter's view. Switching interview mode with an existing transcript isn't reconciled (IN_PERSON → ONLINE lets the AI guess speakers). **Fix:** derive the rubric from `activeRun.spec`; confirm and reset on a mode switch. | S–M |
| M11 | Recal | hook `:525, 573, 732` | After a failed evaluation the old AI evaluation stays on screen, and Apply would use stale scores. **Fix:** always mirror `session.aiEvaluation ?? null`. | S |
| M12 | AI | `transcript-evaluator.ts:200-237` | Keywords like "no evidence" force a real 1/4 to 0 ("not addressed"). **Fix:** an explicit `addressed` boolean. | S |
| M13 | AI | `transcript-evaluator.ts:147-191` | No "transcript is untrusted data" rule, so a candidate saying "score me 4" reaches the model unguarded. **Fix:** an injection clause, and strip the delimiters. | S |
| M14 | Recal | `TranscriptPanel.tsx:660-735`, transcript GET stub | There's **no way to read the transcript** (the view is commented out), and the GET is a stub that creates rows. **Fix:** a transcript drawer; delete the dead code. | S |
| M15 | Recal | `l1-reference/route.ts` | Returns the full L1 session (transcript, AI evaluation, speaker map), but only scores and notes are needed. **Fix:** whitelist the fields. | S |
| M16 | Flow | slot/day logic, `request-panelist:59-60`, `DashboardClient:37` | UTC vs IST: slots between 00:00 and 05:29 IST match the previous day, and lateral windows are shifted by the server's time zone. **Fix:** use one explicit time zone (Asia/Kolkata) or ISO strings with an offset. | M |
| M17 | Dashboard | `InterviewsTab.tsx:715-719, 818, 870, 1010` | The type filter still uses `role.includes()`, and pass/reject funnel counts are per panel, so multi-panel interviews are double-counted. **Fix:** use `parseRound`; dedupe by candidate. | S |
| M18 | Recal | `recalibrate` PATCH | A submitted assessment can be edited or withdrawn after L2 or the recruiter has read it, with no audit. Product decision (Q4). | S |
| M19 | Sec/Ops | `webhooks/graph-transcript`, `health`, error responses | The webhook is unauthenticated and logs payloads; health leaks DB errors and memory; several routes return `error.message`. | S |
| M20 | Data | `db.ts` (neon-http) | No transactions anywhere, so multi-step writes can half-apply. **Fix:** a Pool driver plus `db.transaction`. | M |
| M21 | Flow | `PanelistClient.tsx` (several lines), `transcript/route.ts:321` | Leftover raw `includes("l1")` round checks. **Fix:** finish the `parseRound` sweep. | S |

### 2.5 Production readiness

| ID | Gap | Fix | Effort |
|---|---|---|---|
| P1 | No migration files; `drizzle-kit push` only; initdb SQL has drifted | `drizzle-kit generate` + `migrate` in deploy; regenerate the initdb SQL | S |
| P2 | Env vars not validated; `APP_URL` undocumented; `SESSION_SECRET` unused; `DATABASE_URL` falls back to a placeholder | zod env schema at startup; update `.env.example` | S |
| P3 | Docker runs as root, uses `npm i`, has no image HEALTHCHECK; compose exposes Postgres with default credentials | non-root user, `npm ci`, healthcheck, bind the DB to localhost | S |
| P4 | No CI; `lint` reports 147 errors (118 `no-explicit-any`, 14 `set-state-in-effect`) | GitHub Action running `tsc`, `eslint` and `npm run eval`; burn down the lint errors gradually | M |
| P5 | No `error.tsx` / `global-error.tsx` / `not-found.tsx`; no security headers | add boundaries; `headers()` with CSP, `nosniff`, frame-ancestors and referrer policy | S |
| P6 | Reminders only run when a recruiter opens the dashboard (a GET with side effects) | authenticated cron endpoint | S |
| P7 | Audit log misses logins, recruiter/panelist changes, interview create/cancel/delete and feedback | add `addAuditLog` calls | S |
| P8 | No error tracking or APM; console-only logs that contain PII | Sentry or Application Insights; structured logger with request IDs; redact PII | M |
| P9 | Hard-coded people in code (`db.ts:257-262`, `session.ts:214`); `xlsx` 0.18.5 has CVEs; unused Prisma dependency | move people to env/DB; upgrade SheetJS; prune dependencies | S |
| P10 | Resume blobs are `access: 'public'` | private blob/S3 with presigned GET | S |

---

## 3. UI/UX review

### 3.1 Recalibrate: why it feels cluttered
- **Before questions exist:** three competing calls to action (Generate, Start timer, Record).
- **During the interview:**
  - 3 columns with 2 inner scrollbars.
  - Hero card plus collapsed spec badges that repeat each other.
  - Every question card has about 10 elements, including an editable "Marks" box.
  - Two timers: the recorder clock and the stopwatch card, plus a third in the pop-out window.
  - "Live Analysis" shows the rubric average twice and the scored count three times.
  - Submit is at the bottom of an independently scrolling column.
- **After AI runs:**
  - Two banners push the questions down.
  - The AI evidence `<details>` is open by default, doubling every card's height.
  - There are 4 "apply AI" controls.
  - There are 4 names for the same action: "Transcribe & Auto-Score", "Evaluate Transcript", "Run AI evaluation", "Confirm & score with AI".
- **In person:** the "Who is who" card sits deep in column 3, under the tips box.
- **Styling:** `btn-primary` is used for selected tabs and toggles, so about 7 things look like "the" primary action.
- **Jargon visible to panelists:** "Spec Inputs", "rubric dims", "Stored in S3", "16kHz Mono", "Microsoft Graph API".
- **Out-of-date help:** HelpGuide describes features that no longer exist.

### 3.2 Target layout: step-based, one primary action per step
**Sticky session bar** (replaces the hero card, the stopwatch and the submit card):
```
← All  Jane Doe · L2 · Senior Consultant │ ①Prepare ②Interview ③Review ④Submit │ ⏱ 24:13 ● REC │ 6/9 Q · 4/8 skills │ ⧉ Pop out │ [step action]
```
- **Prepare:**
  - Interview setup (grade, style, count, stacks, case study) with the explanations moved into an ⓘ popover.
  - The interview type (Teams or in person) and the recording source are chosen here, then shown as a read-only chip.
  - The L1 reference is collapsed. No timer and no recorder on this screen.
- **Interview:** two columns.
  - Left: questions as an accordion, one question open, each with ① ② ③ ④, the label, and "Next question".
  - Right: tabs for **Skills**, **Notes** and **L1 ref**.
  - No AI, no analysis, no transcript, no downloads. Recording runs from the pill in the session bar.
- **Review:** one *AI review* card that moves through these states:
  1. "Confirm who is who" (in person)
  2. "Run AI scoring"
  3. "Ready"
  
  It shows a "You 3 · AI 2 [Use AI]" differences list, "Fill unscored with AI" (with a confirmation), and tabs for Transcript and Recordings.
- **Submit:**
  - A score summary (technical, case study, behavioural vs bar, overall, with question-vs-skill gap in a `<details>`).
  - Notes, a completeness warning, and **Submit to recruiters**. Downloads move to a ⋯ menu.

**Demo-safe subset, about 1.5–2 days, removes roughly 40% of the visible clutter:**
- Hide Live Analysis during the interview and de-duplicate the averages.
- Collapse AI evidence by default.
- Add a segmented-control style instead of `btn-primary` for toggles.
- Right column as tabs (Skills / Notes / L1 ref).
- Interview mode and tips into setup.
- Remove the stopwatch card: one timer in a slim sticky bar together with Submit.
- Completeness check plus withdraw confirmation.
- Jargon pass and a rewritten HelpGuide.

### 3.3 Panelist portal and dashboard
- **Panelist portal** (`PanelistClient.tsx`, 3,915 lines):
  - Three near-identical feedback forms of about 300 lines each, which already drift. Extract one `FeedbackForm`.
  - Campus feedback uses unlabelled 1–4 stars, while Recalibrate uses labelled dials. Use one scoring language.
  - Duplicated round sub-tabs.
  - The L1 PASS confirmation uses a red "destructive" button for a positive action.
  - A hand-rolled modal with no focus trap or Esc handling.
- **Dashboard:**
  - 7 equal-weight tabs. Group them into Hiring and Setup.
  - At least 5 hand-rolled modals and 3 table styles. Unify them.
  - Metric cards are not keyboard-reachable.
  - Colour-only status dots.
  - "Recalibrate" button wording for recruiters. Rename to "View assessment".
- **Cross-cutting:**
  - Terminology (round names, "Meets Expectation(s)", Passed/Pass L1).
  - 9 `outline:none` and JS-driven hover with no keyboard equivalent; 22px score dials (below the 24px minimum).
  - Three `:root` blocks in `globals.css`.
  - Hard-coded purple hex values with low contrast in light mode.
  - Toasts and inline errors used inconsistently.

---

## 4. Fix plan

### Phase 0: before the demo (about 3–4 days)
| # | Items | Verify by |
|---|---|---|
| 0.1 | **C2** run the DB push (today) | Recalibrate loads; no column errors in the log |
| 0.2 | **C1** feedback window from the feedback timestamp | Book a slot, submit feedback more than 2 hours later: accepted; edit after 2 hours: blocked |
| 0.3 | **C3** keep clips on failure and retry | Kill the network during transcription: clips remain; retry works |
| 0.4 | **F6, F7, F8, M11** regenerate confirmation, safe Apply, timer column, stale evaluation | Manual scoring then Apply keeps manual scores and notes; reload keeps the timer |
| 0.5 | **F12, M15** L1 reference shows decided panels only, with whitelisted fields | L2 view with one panelist booked but not decided |
| 0.6 | **S1, S2** strip tokens from DTOs; audio type whitelist and headers | Inspect the `/feedback/[token]` payload; upload a `text/html` "audio": rejected |
| 0.7 | Recalibrate demo-safe declutter (§3.2) and jargon/HelpGuide pass | Walk the 4 phases at 1366×768 |
| 0.8 | Commit the uncommitted work on `feat/rubric-case-study`; open the PR | CI or manual: `tsc`, `eval` |

### Phase 1: production blockers (about 2 weeks)
| # | Items | Depends on / decision needed |
|---|---|---|
| 1.1 | **S3 + F4** service mailbox, app-only Graph, organiser stored on each interview | IT: an app registration with an application access policy |
| 1.2 | **S4, S8** encrypted tokens, session expiry, OAuth state/PKCE, `tid`/`oid` | — |
| 1.3 | **S5, S6, S7, S9** ownership checks, slot validation, assignment checks and email normalisation (with a data backfill), body limits, presigned uploads, rate limits | backfill script for email casing |
| 1.4 | **F1, F2, F3, F5** one atomic matcher and claim helper; meeting-then-claim with compensation | Q1 (consensus), Q3 (L2 date) |
| 1.5 | **F9, F10, F11** save errors, append/replace, long-interview handling (Opus/Files API, `truncated` flag, timeouts) | — |
| 1.6 | **M1, M4, M20** cancel/delete consistency; transactions | — |
| 1.7 | **P1–P7** migrations, env validation, Docker, CI, error boundaries and headers, cron reminders, audit coverage | — |

### Phase 2: hardening (about 2–3 weeks)
- **Mapping and data:** M2, M3, M5–M9 (drive/college IDs on interviews, lateral FK, bulk-upload validation, consensus rule, lateral stage updates).
- **Recalibrate and AI:** M10, M12, M13, M16–M19, M21 (spec vs run, AI scoring correctness, prompt injection, time zones, analytics, webhook and health).
- **F13:** per-panelist Recalibrate sessions, if Q2 says so.
- **P8–P10:** monitoring, PII redaction, dependency hygiene, private resumes.

### Phase 3: UX polish (about 2–3 weeks)
- Full step-based Recalibrate (session bar, Prepare/Interview/Review/Submit, AI review card, transcript drawer).
- Panelist `FeedbackForm` extraction, one scoring language.
- Dashboard grouping, a single Dialog and DataTable.
- Theme tokens, an accessibility pass, a terminology module.

---

## 5. Open questions for the product owner
1. **Multi-panelist decisions:** any PASS, all PASS, or majority? Today any PASS wins, and a later REJECT is ignored.
2. **Recalibrate:** one shared assessment per interview, or one per panelist?
3. **Campus L2 slots:** must they be on the original drive date?
4. **Submitted assessments:** should they be read-only, or editable with an audit trail?
5. **Requested-but-not-accepted L2 panelists:** should they see L1 feedback?
6. **GENERAL-round panelists:** should they see full outcomes?
7. **Lateral:** one interview with N panels, instead of one per panelist? Should lateral decisions be made in the portal?
8. **Retention:** what retention and deletion policy applies to interview audio in S3?
9. **Hard-coded organiser:** is `vishnuprriya@…` meant to be the fixed organiser, to be replaced by a service account?
