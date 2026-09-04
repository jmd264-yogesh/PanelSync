-- PanelSync schema for the local docker-compose Postgres.
-- Generated from src/lib/schema.ts with: npx drizzle-kit generate
-- Postgres runs this once, when the panelsync-db-data volume is first created.

CREATE TYPE "public"."hiring_type" AS ENUM('CAMPUS', 'LATERAL');--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"interview_id" varchar(255) NOT NULL,
	"candidate_id" varchar(255),
	"triggered_by_email" varchar(255) NOT NULL,
	"status" varchar(50) NOT NULL,
	"criteria" jsonb,
	"spec" jsonb,
	"resume_digest" jsonb,
	"questions" jsonb,
	"model" varchar(100),
	"prompt_version" varchar(20),
	"token_usage" jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "allowed_recruiters" (
	"email" varchar(255) PRIMARY KEY NOT NULL,
	"added_by" varchar(255),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"action" varchar(100) NOT NULL,
	"entity" varchar(100) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "colleges" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "colleges_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "drives" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"college_name" varchar(255) NOT NULL,
	"start_date" varchar(255) NOT NULL,
	"end_date" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'OPEN' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "interview_panels" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"interview_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"status" varchar(50) NOT NULL,
	"submitted_at" timestamp,
	"feedback" text,
	"decision" varchar(50),
	"feedback_reminder_sent" boolean DEFAULT false NOT NULL,
	CONSTRAINT "interview_panels_token_unique" UNIQUE("token"),
	CONSTRAINT "unique_interview_email" UNIQUE("interview_id","email")
);
--> statement-breakpoint
CREATE TABLE "interview_transcripts" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"interview_id" varchar(255) NOT NULL,
	"graph_transcript_id" varchar(512) NOT NULL,
	"content_vtt" text,
	"transcript_created_at" timestamp,
	"fetched_at" timestamp DEFAULT now(),
	"fetched_by_email" varchar(255),
	CONSTRAINT "unique_interview_graph_transcript" UNIQUE("interview_id","graph_transcript_id")
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"candidate_name" varchar(255) NOT NULL,
	"candidate_email" varchar(255) NOT NULL,
	"role" varchar(255) NOT NULL,
	"duration" integer NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"status" varchar(50) NOT NULL,
	"hiring_type" "hiring_type" NOT NULL,
	"teams_meeting_url" text,
	"calendar_event_id" varchar(255),
	"organizer_user_id" varchar(255),
	"online_meeting_id" varchar(512),
	"scheduled_slot_start" timestamp,
	"scheduled_slot_end" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "lateral_candidates" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(50),
	"position_title" varchar(255) NOT NULL,
	"experience_years" integer,
	"current_company" varchar(255),
	"current_ctc" varchar(100),
	"expected_ctc" varchar(100),
	"notice_period_days" integer,
	"source" varchar(100),
	"status" varchar(50) DEFAULT 'NEW' NOT NULL,
	"role_grade" varchar(20),
	"resume_file_key" text,
	"resume_sha256" varchar(64),
	"resume_uploaded_at" timestamp,
	"mapped_interview_id" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "panel_availabilities" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"panel_id" varchar(255) NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "panelists" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"roles" text[] NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recalibrate_sessions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"interview_id" varchar(255) NOT NULL,
	"ai_run_id" varchar(255),
	"question_scores" jsonb,
	"rubric_scores" jsonb,
	"notes" text,
	"timer_started_at" timestamp,
	"timer_ended_at" timestamp,
	"submitted_at" timestamp,
	"submitted_by" varchar(255),
	"transcript_text" text,
	"transcript_turns" jsonb,
	"ai_evaluation" jsonb,
	"transcript_fetched_at" timestamp,
	"transcript_source" varchar(50),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "recalibrate_sessions_interview_id_unique" UNIQUE("interview_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"user_display_name" varchar(255) NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "uploaded_candidates" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"status" varchar(50) NOT NULL,
	"mapped_interview_id" varchar(255),
	"preferred_date" timestamp,
	"outcome_status" varchar(50),
	"college" varchar(255),
	"college_drive" varchar(255),
	"resume_file_key" text,
	"resume_sha256" varchar(64),
	"resume_uploaded_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"deleted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_candidate_id_uploaded_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."uploaded_candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_panels" ADD CONSTRAINT "interview_panels_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_transcripts" ADD CONSTRAINT "interview_transcripts_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lateral_candidates" ADD CONSTRAINT "lateral_candidates_mapped_interview_id_interviews_id_fk" FOREIGN KEY ("mapped_interview_id") REFERENCES "public"."interviews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_availabilities" ADD CONSTRAINT "panel_availabilities_panel_id_interview_panels_id_fk" FOREIGN KEY ("panel_id") REFERENCES "public"."interview_panels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recalibrate_sessions" ADD CONSTRAINT "recalibrate_sessions_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recalibrate_sessions" ADD CONSTRAINT "recalibrate_sessions_ai_run_id_ai_runs_id_fk" FOREIGN KEY ("ai_run_id") REFERENCES "public"."ai_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_candidates" ADD CONSTRAINT "uploaded_candidates_mapped_interview_id_interviews_id_fk" FOREIGN KEY ("mapped_interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;