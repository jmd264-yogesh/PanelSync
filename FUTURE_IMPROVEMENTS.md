# PanelSync — Future Improvements & Roadmap

A living document of planned enhancements, quality-of-life improvements, and longer-term feature ideas for PanelSync.

---

## High Priority

### 1. Email / Teams Notifications for Panelists
- Notify panelists via Teams message when a candidate is assigned to their scheduled interview.
- Notify panelists when their feedback window opens (i.e., interview status becomes SCHEDULED).
- Notify recruiters when a panelist submits feedback or changes a candidate's outcome status.

### 2. Candidate Outcome History / Audit Log
- Track every status change on `uploaded_candidates.outcomeStatus` with timestamp + changed-by (recruiter or panelist email).
- Display a timeline on the recruiter dashboard candidate card.
- Useful for dispute resolution and compliance.

### 3. Panelist Portal — Feedback Edit Window
- Allow panelists to edit submitted feedback within a configurable window (e.g., 24 hours after submission) in case of typos or corrections.
- Lock feedback permanently once the recruiter marks the candidate as SELECTED or after the window expires.

### 4. L2 Interview Auto-Trigger
- When a candidate's `outcomeStatus` is set to `PASSED_L1`, automatically suggest creating an L2 interview slot request for that candidate.
- Recruiter sees a banner: "Candidate X passed L1. Request L2 slot now?" with a one-click flow.

### 5. Recruiter Dashboard — Panel Feedback Viewer
- Surface the full panel feedback (from `interview_panels.feedback`) on the interview detail panel inside the recruiter dashboard.
- Show each panelist's decision (PASSED / REJECTED) alongside their name and submitted feedback text.
- Currently only visible in the panelist portal.

---

## Medium Priority

### 6. Role-Based Interview Assignment Enforcement
- Prevent L1 panelists from being nominated on L2 interviews and vice versa at the slot-request step.
- Show a warning badge next to panel member names when there's a role mismatch.

### 7. Candidate Status Filter on Candidate Queue
- Extend the existing `candidateStatusFilter` (currently WAITING / MAPPED) to also filter by `outcomeStatus` (e.g., show only PASSED_L2 candidates awaiting SELECTED).
- Add a "Ready to Select" quick filter pill.

### 8. Bulk "Mark as Selected" for Recruiters
- Allow recruiters to tick multiple PASSED_L2 candidates and mark them all as SELECTED in one action.
- Useful for batch-hire scenarios across a college drive.

### 9. Interview Panel — Conflict Detection
- Detect when the same panelist is nominated on two overlapping scheduled interviews and surface a warning.
- Optionally block booking if a confirmed conflict exists.

### 10. Panelist Availability Carry-Forward
- When a panelist submits availability for one interview window, allow the recruiter to "reuse" those availability windows for a follow-up interview without requiring a new Teams notification.

### 11. College Drive — Grouped Candidate View
- Group the candidate queue by college/institution (using the `preferredDate` or a future `collegeCode` field).
- Show per-college stats: total uploaded, mapped, passed L1, passed L2, selected, rejected.

---

## Quality of Life

### 12. Panelist Portal — Mobile Responsive Layout
- The current panelist portal uses flex/grid layouts that may not render well on mobile.
- Add responsive breakpoints so panelists can submit feedback from their phones after an interview.

### 13. Feedback Character Limit & Validation
- Enforce a minimum feedback length (e.g., 50 characters) before allowing submission to prevent empty or uninformative feedback.
- Show a live character counter on the textarea.

### 14. Session Expiry — Graceful Redirect
- When a recruiter or panelist's session expires mid-session, show a toast ("Session expired — please sign in again") instead of a blank page or cryptic redirect.

### 15. Pagination for Candidate Queue
- The candidate queue table currently loads all records at once. Add server-side pagination or virtual scrolling for large drives (500+ candidates).

### 16. Slot Booking Confirmation Email
- After a Teams meeting is booked, send a confirmation email (via Graph `sendMail`) to both the candidate and all confirmed panelists with the meeting link.

### 17. Interview Duration Tracking
- Record actual start/end time of interviews (panelist-submitted) vs. the scheduled slot.
- Surface average over-run / under-run stats per panelist for capacity planning.

---

## Longer-Term / Strategic

### 18. Multi-Tenant Support
- Add an `organisation_id` foreign key across all tables to support multiple companies using the same PanelSync deployment.
- Each org's recruiters and panelists are siloed; admins manage their own `allowed_recruiters` and `panelists` pools.

### 19. Analytics Dashboard
- A dedicated "Reports" tab for recruiters with charts:
  - Funnel: Uploaded → Mapped → Passed L1 → Passed L2 → Selected
  - Average time-to-schedule per interview type (L1 / L2)
  - Panelist response rate and average response time
  - Rejection rate per panelist (with privacy controls)

### 20. Candidate Self-Service Portal
- Send candidates a tokenised link (similar to the existing panelist availability link) where they can:
  - Confirm their preferred interview date/time from available slots
  - View their current outcome status
  - Provide consent for data processing

### 21. Calendar Integration — Outlook/Google Sync
- Beyond the existing Teams meeting booking, integrate with the candidate's calendar (if they provide their email) to block the interview slot on their Outlook or Google Calendar.

### 22. Drizzle Migrations (Replace `drizzle-kit push`)
- Move from `drizzle-kit push` (dev-only) to proper versioned migration files (`drizzle-kit generate` + `drizzle-kit migrate`) for safe production deployments.
- Maintain a `migrations/` folder tracked in version control.

### 23. Admin Role
- Introduce a super-admin role (separate from recruiter) who can:
  - View all organisations (multi-tenant)
  - Purge stale interview records
  - Rotate session secrets
  - View system-level audit logs

### 24. Webhook / Integration Support
- Expose outbound webhooks so PanelSync can notify external ATS (Applicant Tracking Systems) like Greenhouse or Lever when a candidate is marked SELECTED or REJECTED.
- Configurable per-organisation via an admin settings panel.
