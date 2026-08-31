# Interview transcripts (Teams → Recalibrate)

Pulls the Teams meeting transcript for an interview and shows it in the Recalibrate
workspace, attributed to candidate vs panel, with a talk-time split.

**Recording is not required.** Teams treats transcription and recording as separate
features, and this uses transcription only — so no candidate video or audio is stored
anywhere, only text. That is deliberate: it is a materially better privacy position for a
hiring tool, and it keeps you out of OneDrive/SharePoint retention entirely.

---

## Before it will work: two Azure AD permissions

This is the part that gates everything, and it needs a tenant admin.

In the Azure portal → **App registrations** → your app → **API permissions** → *Add a
permission* → *Microsoft Graph* → **Application permissions**:

| Permission | Why |
|---|---|
| `OnlineMeetings.Read.All` | Resolve a Teams meeting from its join URL |
| `OnlineMeetingTranscript.Read.All` | List and download that meeting's transcripts |

Then click **Grant admin consent for \<tenant\>**. Without that click the permissions are
listed but inert.

### Why application permissions and not delegated

Two reasons, both practical:

1. **Graph exposes a meeting's transcripts only under its organizer.** The organizer is
   the recruiter who created the calendar event; the person who wants the transcript is
   the panelist who ran the interview. A delegated call would need the organizer signed
   in at that moment, which they generally are not.

2. **Adding a delegated scope to sign-in is a live hazard in this tenant.** There is
   already a comment in `src/app/api/auth/signin/route.ts` recording that requesting
   `Files.Read` before consent *blocked login entirely* with a "Need admin approval"
   screen. App-only auth keeps the sign-in request untouched: if consent is missing here,
   transcript sync fails with a clear message and nothing else regresses.

No new environment variables are needed — this reuses the `AZURE_TENANT_ID`,
`AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET` you already have for the OAuth flow.

### Licensing / metering — verify this

Microsoft has moved some Teams call-records and transcript APIs to a metered billing
model that requires a linked Azure subscription. I have not verified whether that applies
to your tenant or to this specific access pattern. **Check current Graph docs before
relying on this in production** — it could change the cost picture, and it is the one
thing here I would not take on trust.

---

## Database migration

Adds two nullable columns to `interviews` and one new table. All additive, nothing
destructive:

```bash
npx drizzle-kit push
```

| Change | Purpose |
|---|---|
| `interviews.organizer_user_id` | Graph id of whoever created the meeting — transcripts live under the organizer |
| `interviews.online_meeting_id` | Cached Graph meeting id, resolved lazily on first sync |
| `interview_transcripts` | One row per Graph transcript, unique on `(interview_id, graph_transcript_id)` so re-syncing overwrites rather than duplicating |

---

## Transcription has to actually be started

Teams does not transcribe by default, and this is the failure mode you are most likely to
hit in testing. Either:

- the panelist clicks **More → Record and transcribe → Start transcription** during the
  call, or
- an admin enables it by Teams meeting policy.

If nobody starts it, Graph returns no transcript and the panel says so explicitly rather
than failing silently.

One caveat worth confirming with whoever administers your Teams policies: I am not
certain the current policy surface offers a clean *auto-transcribe only* toggle
independent of auto-recording. If auto-recording turns out to be the only reliable
auto-start in your tenant, then guaranteeing a transcript would mean enabling recording
after all — which gives back the privacy advantage above. Worth checking before you
design a process around it.

---

## Testing it

1. Run the migration.
2. Get the two permissions consented.
3. **Schedule a fresh lateral interview.** This matters: interviews created before this
   change have no `organizer_user_id`, so their transcript cannot be located. The panel
   will tell you this rather than failing obscurely.
4. Join the Teams call, **start transcription**, talk for a minute as both parties, end
   the call.
5. Open the interview in `/recalibrate` → **Interview Transcript** → *Fetch from Teams*.

Teams takes a little while to finalise a transcript after a call ends, so if the first
attempt reports none available, wait a few minutes and re-sync.

### Expected failures and what they mean

| Message | Cause |
|---|---|
| "…missing admin consent for OnlineMeetings.Read.All and OnlineMeetingTranscript.Read.All" | Step 2 not done, or not consented |
| "no recorded meeting organizer" | Interview predates this feature — reschedule |
| "Teams has no transcript for this meeting" | Transcription was never started, or is still finalising |
| "Could not find this Teams meeting in Graph" | Meeting created outside the app, or the join URL no longer resolves |

---

## How it fits together

```
src/lib/graph-transcript.ts    app-only token, meeting lookup, transcript download
src/lib/transcript.ts          WebVTT parsing, speaker attribution, talk-time analysis
api/interviews/[id]/transcript GET = read stored (cheap) · POST = sync from Graph (slow)
recalibrate/components/TranscriptPanel.tsx   the UI
evals/transcript-cases.ts      18 parser/attribution cases — `npm run eval`
```

`GET` and `POST` are split deliberately: reading the stored transcript is cheap enough to
load with the workspace, while syncing costs a round trip to Microsoft and should only
happen when someone asks.

### Attribution

Teams puts the speaker inline in each cue (`<v Priya Sharma>…</v>`), which is the whole
reason to prefer this over recording the call and running STT — attribution is
authoritative rather than a diarizer guessing which anonymous voice is the candidate.

Matching is on display name, with the local part of the candidate's email as a fallback,
and known panelist names are matched too. A speaker is only labelled `candidate` when
they match the candidate *and* are not a panelist — mislabelling the panel would inflate
the candidate's talk share, which is the number a reviewer would actually act on. When
nobody matches, the split reports as unavailable instead of guessing.
