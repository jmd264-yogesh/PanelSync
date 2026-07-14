import { z } from 'zod';

export const ResumeDigestSchema = z.object({
  summary: z.string().max(600),
  yearsOfExperience: z.number().nullable(),
  currentRole: z.string().nullable(),
  skills: z.array(z.object({
    name: z.string(),
    evidence: z.string(),
    selfReportedLevel: z.enum(['mentioned', 'used_in_project', 'core_expertise']),
  })).max(30),
  experience: z.array(z.object({
    company: z.string(),
    title: z.string(),
    durationMonths: z.number().nullable(),
    highlights: z.array(z.string()).max(5),
  })).max(15),
  education: z.array(z.object({
    institution: z.string(),
    degree: z.string().nullable(),
  })).max(10),
  redFlags: z.array(z.string()).max(10),
  claimsToVerify: z.array(z.string()).max(10),
});
export type ResumeDigest = z.infer<typeof ResumeDigestSchema>;

export const CriteriaSchema = z.object({
  roleTitle: z.string().min(2).max(120),
  seniority: z.enum(['junior', 'mid', 'senior', 'lead', 'principal']),
  interviewType: z.enum(['technical', 'behavioral', 'system_design', 'mixed']),
  focusAreas: z.array(z.string().max(60)).min(1).max(8),
  difficulty: z.enum(['easy', 'balanced', 'hard']),
  questionCount: z.number().int().min(3).max(15),
  customInstructions: z.string().max(500).optional(),
});
export type Criteria = z.infer<typeof CriteriaSchema>;

// Spec-driven generation: an alternative to Criteria that needs no resume/candidate at
// all — the panelist scopes the question set directly (role grade, tracks, platform,
// topics, style) instead of it being derived from a resume digest.
export const SpecSchema = z.object({
  roleGrade: z.enum(['intern', 'se', 'sse', 'enabler', 'sc', 'ssc', 'architect']),
  tracks: z.array(z.enum(['technical', 'architecture', 'presales', 'comms', 'presentation'])).min(1),
  platforms: z.array(z.enum(['fabric', 'databricks', 'snowflake', 'dbt', 'general'])).default([]),
  topics: z.array(z.enum(['sql', 'modeling', 'pipeline', 'governance', 'streaming', 'archtech', 'codereview'])).default([]),
  style: z.enum(['foundational', 'practical']),
  questionCount: z.number().int().min(3).max(12),
});
export type Spec = z.infer<typeof SpecSchema>;

export const QuestionSchema = z.object({
  id: z.string(),
  category: z.string(),
  question: z.string().max(500),
  intent: z.string().max(300),
  linkedResumeEvidence: z.string().nullable(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  maxMarks: z.number().int().min(1).max(10),
  rubric: z.array(z.object({
    band: z.string(),
    description: z.string().max(300),
    exampleSignals: z.array(z.string()).max(4),
  })).min(3).max(5),
  followUps: z.array(z.string()).max(3),
});
export type Question = z.infer<typeof QuestionSchema>;

export const QuestionSetSchema = z.object({
  questions: z.array(QuestionSchema).min(1),
  totalMarks: z.number().int(),
  coverageNotes: z.string().max(400),
});
export type QuestionSet = z.infer<typeof QuestionSetSchema>;
