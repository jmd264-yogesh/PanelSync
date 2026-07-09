import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET lateral hiring queue
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const list = await db.getLateralCandidates();
    return NextResponse.json(list);
  } catch (error) {
    console.error('Failed to fetch lateral candidates:', error);
    return NextResponse.json({ error: 'Failed to fetch lateral candidates' }, { status: 500 });
  }
}

// POST add a lateral candidate
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, email, phone, positionTitle, experienceYears, currentCompany, currentCtc, expectedCtc, noticePeriodDays, source } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Candidate name is required.' }, { status: 400 });
    }
    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Candidate email is required.' }, { status: 400 });
    }
    if (!positionTitle || !positionTitle.trim()) {
      return NextResponse.json({ error: 'Position title is required.' }, { status: 400 });
    }

    await db.addLateralCandidate({
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() || undefined,
      positionTitle: positionTitle.trim(),
      experienceYears: experienceYears !== undefined && experienceYears !== '' ? Number(experienceYears) : undefined,
      currentCompany: currentCompany?.trim() || undefined,
      currentCtc: currentCtc?.trim() || undefined,
      expectedCtc: expectedCtc?.trim() || undefined,
      noticePeriodDays: noticePeriodDays !== undefined && noticePeriodDays !== '' ? Number(noticePeriodDays) : undefined,
      source: source?.trim() || undefined,
    });

    const list = await db.getLateralCandidates();
    return NextResponse.json({ success: true, candidates: list });
  } catch (error) {
    console.error('Failed to add lateral candidate:', error);
    return NextResponse.json({ error: 'Failed to add lateral candidate' }, { status: 500 });
  }
}
