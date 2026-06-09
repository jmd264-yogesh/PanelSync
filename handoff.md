# Project Handoff: Teams Interview Scheduler

This document details the goals, current codebase state, resolved issues, and next steps for the Microsoft Teams Interview Scheduler application.

---

## 1. The Goal We're Working Toward
We are building a recruiter-first scheduling portal integrated with Microsoft Graph API and Neon DB (via Drizzle ORM).
* **Panelist-First Flow**: Recruiters propose slot ranges and request panelist availability via Teams.
* **Self-Scheduling**: Panelists choose a preferred slot anonymously via a tokenized guest link, instantly scheduling the meeting.
* **Candidate Mapping & Synchronization**: Recruiters map candidates to the scheduled slot from the **Panelist Mapping Tracker**.
* **Teams Invites**: Mapping updates the existing Outlook calendar event with the candidate's details and ensures the calendar invite is sent as a Microsoft Teams online meeting.

---

## 2. Current State of Edited Files

### [DashboardClient.tsx](file:///c:/Projects/microsfot%20mcp/src/app/dashboard/DashboardClient.tsx)
* **Status**: fully updated and verified.
* **Changes**:
  * Added `isEditingMapping` and `sendAsTeamsMeeting` states.
  * Added a dynamic toggle switch for Teams meetings to both the Cockpit details assignment form and the quick mapping tracker row form.
  * Added an **Edit Candidate** button on assigned cards that re-opens the mapping form with pre-populated values.

### [assign-candidate/route.ts](file:///c:/Projects/microsfot%20mcp/src/app/api/interviews/assign-candidate/route.ts)
* **Status**: fully updated and verified.
* **Changes**:
  * Captures the `sendAsTeamsMeeting` boolean flag from requests.
  * Passes the flag to the Microsoft Graph calendar patching method.

### [graph.ts](file:///c:/Projects/microsfot%20mcp/src/lib/graph.ts)
* **Status**: fully updated and verified.
* **Changes**:
  * Extended `updateTeamsMeeting` to accept `sendAsTeamsMeeting?: boolean`.
  * Conditionally sets `isOnlineMeeting` and `onlineMeetingProvider: "teamsForBusiness"` in the Microsoft Graph PATCH payload to ensure invite delivery behaves as an online meeting.

### [globals.css](file:///c:/Projects/microsfot%20mcp/src/app/globals.css)
* **Status**: updated.
* **Changes**:
  * Added custom switch CSS rules (`.switch-container`, `.switch-input`, `.switch-toggle`, `.switch-label`) to match the purple pill slider switch design.

---

## 3. Everything Tried That Failed
* **Multi-Replace Chunk Clashes**: In earlier updates, replacing non-contiguous blocks on the large `DashboardClient.tsx` file caused line index drift and regex mismatch conflicts because of overlapping comment headers. 
  * *Resolution*: Resolved by overwriting the file layout cleanly and running validation builds.
* **Missing Teams Flag on PATCH**: Initial tests showed candidate mapping successfully updated the subject and attendees in Outlook but didn't ensure the calendar link stayed attached as an online Teams invitation.
  * *Resolution*: Added explicit `isOnlineMeeting` and `onlineMeetingProvider` fields during PATCH requests.

---

## 4. Next Steps to Take
1. **Interactive Integration Testing**:
   * Create a test slot proposal for an active panelist.
   * Open the anonymous guest selection link `/availability/[token]` in a browser window.
   * Confirm selecting a slot successfully creates a Teams Event on the Outlook calendar.
2. **Calendar Attendee Verification**:
   * Navigate to the **Panelist Mapping Tracker** and map a candidate to the scheduled slot with the **Teams meeting** switch toggled on.
   * Verify that the Microsoft Graph API successfully patch-updates the event, adds the candidate as a required attendee, and delivers the Teams join invite to their mailbox.
3. **Toggle Cancellation Validation**:
   * Verify that assigning a candidate with the **Teams meeting** toggle switch off removes/suppresses Teams meeting join properties on the calendar event.
