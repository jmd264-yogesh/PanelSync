import { NextRequest, NextResponse } from 'next/server';
import { getPanelistSession } from '@/lib/session';
import { dbClient } from '@/lib/db';
import * as schema from '@/lib/schema';
import { eq, and, inArray, isNull, isNotNull, sql } from 'drizzle-orm';
import { parseRound } from '@/lib/interview-role';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getPanelistSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email')?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
  }

  // 1. Authorize: Ensure the logged-in panelist has an L2 round interview assigned for this candidate
  const panelistEmail = session.user.email.trim().toLowerCase();
  
  const assignedInterviews = await dbClient
    .select({
      role: schema.interviews.role,
    })
    .from(schema.interviewPanels)
    .innerJoin(
      schema.interviews,
      eq(schema.interviewPanels.interviewId, schema.interviews.id)
    )
    .where(
      and(
        // Emails are stored as Graph returned them (any case) — compare case-insensitively,
        // otherwise a panelist stored as "Jane.Doe@..." is refused their own candidate's L1 feedback.
        sql`LOWER(TRIM(${schema.interviewPanels.email})) = ${panelistEmail}`,
        sql`LOWER(TRIM(${schema.interviews.candidateEmail})) = ${email}`,
        isNull(schema.interviews.deletedAt)
      )
    );

  const hasL2Access = assignedInterviews.some(i => parseRound(i.role) === 'L2');

  if (!hasL2Access) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // 2. Fetch all L1 interviews (case-insensitive role check) for this candidate email
  const candidateInterviews = await dbClient
    .select()
    .from(schema.interviews)
    .where(
      and(
        sql`LOWER(TRIM(${schema.interviews.candidateEmail})) = ${email}`,
        isNull(schema.interviews.deletedAt)
      )
    );

  const l1Interviews = candidateInterviews.filter(i => parseRound(i.role) === 'L1');

  if (l1Interviews.length === 0) {
    return NextResponse.json({ feedbacks: [] });
  }

  // Find all submitted panel feedbacks for those L1 interviews
  const l1InterviewIds = l1Interviews.map(i => i.id);
  
  const submittedPanels = await dbClient
    .select()
    .from(schema.interviewPanels)
    .where(
      and(
        inArray(schema.interviewPanels.interviewId, l1InterviewIds),
        // A decision means feedback was given; status SUBMITTED alone just means a slot was booked.
        isNotNull(schema.interviewPanels.decision)
      )
    );

  const feedbacks = submittedPanels.map(panel => {
    const matchingInterview = l1Interviews.find(i => i.id === panel.interviewId);
    return {
      panelId: panel.id,
      panelistName: panel.name,
      panelistEmail: panel.email,
      role: matchingInterview?.role ?? 'L1 Interview',
      decision: panel.decision,
      feedback: panel.feedback,
      submittedAt: panel.submittedAt?.toISOString() ?? null
    };
  });

  return NextResponse.json({ feedbacks });
}
