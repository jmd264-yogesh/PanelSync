-- Interview transcripts (Teams → Recalibrate)
--
-- Additive only: two nullable columns and one new table. Nothing is dropped or
-- rewritten, so this is safe to run against live data and safe to run twice.
--
-- Run this, or `npx drizzle-kit push` if you prefer — but review push's plan first,
-- since it diffs the entire schema and may pick up unrelated drift.

ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS organizer_user_id varchar(255);

ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS online_meeting_id varchar(512);

CREATE TABLE IF NOT EXISTS interview_transcripts (
  id                    varchar(255) PRIMARY KEY,
  interview_id          varchar(255) NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  graph_transcript_id   varchar(512) NOT NULL,
  content_vtt           text,
  transcript_created_at timestamp,
  fetched_at            timestamp DEFAULT now(),
  fetched_by_email      varchar(255),
  CONSTRAINT unique_interview_graph_transcript UNIQUE (interview_id, graph_transcript_id)
);

-- Transcripts are always read by interview, never scanned globally.
CREATE INDEX IF NOT EXISTS idx_interview_transcripts_interview
  ON interview_transcripts (interview_id);
