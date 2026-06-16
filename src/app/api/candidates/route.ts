import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken, getSession } from '@/lib/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET candidates queue
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const list = await db.getUploadedCandidates();
    return NextResponse.json(list);
  } catch (error) {
    console.error('Failed to fetch candidates:', error);
    return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 });
  }
}

// POST bulk upload candidates
export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  const session = await getSession();

  if (!token || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { candidates } = body;

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json({ error: 'Invalid or empty candidates list' }, { status: 400 });
    }

    // Validate that each candidate has a name, email, preferredDate, college, and collegeDrive
    for (const c of candidates) {
      if (!c.name || !c.name.trim()) {
        return NextResponse.json({ error: 'Candidate name is required for all candidates.' }, { status: 400 });
      }
      if (!c.email || !c.email.trim()) {
        return NextResponse.json({ error: `Candidate email is required for ${c.name || 'all candidates'}.` }, { status: 400 });
      }
      if (!c.preferredDate || !c.preferredDate.trim()) {
        return NextResponse.json({ error: `Drive Date is required for candidate "${c.name}".` }, { status: 400 });
      }
      if (!c.college || !c.college.trim()) {
        c.college = c.collegeDrive;
      }
      if (!c.college || !c.college.trim()) {
        return NextResponse.json({ error: `College Name of Candidate is required for candidate "${c.name}".` }, { status: 400 });
      }
      if (!c.collegeDrive || !c.collegeDrive.trim()) {
        return NextResponse.json({ error: `College Name of Drive is required for candidate "${c.name}".` }, { status: 400 });
      }
    }

    // 1. Add candidates to database
    await db.addUploadedCandidates(candidates);

    // 2. Trigger auto-mapping immediately
    const mapRes = await db.autoMapPendingCandidates({ token, email: session.user.email });

    // 3. Fetch updated states
    const updatedCandidates = await db.getUploadedCandidates();
    const updatedInterviews = await db.getInterviews();

    return NextResponse.json({
      success: true,
      candidates: updatedCandidates,
      interviews: updatedInterviews,
      mappedCount: mapRes.mappedCount,
    });
  } catch (error) {
    console.error('Failed to upload candidates:', error);
    return NextResponse.json({ error: 'Failed to upload candidates' }, { status: 500 });
  }
}
