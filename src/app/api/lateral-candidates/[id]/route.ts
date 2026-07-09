import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['NEW', 'SCREENING', 'INTERVIEWING', 'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN'];

// PATCH edit a lateral candidate / advance their pipeline status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing candidate ID' }, { status: 400 });
    }

    const body = await request.json();
    const updateParams: any = {};

    if (body.name !== undefined) {
      if (!body.name.trim()) return NextResponse.json({ error: 'Candidate name is required.' }, { status: 400 });
      updateParams.name = body.name.trim();
    }
    if (body.email !== undefined) {
      if (!body.email.trim()) return NextResponse.json({ error: 'Candidate email is required.' }, { status: 400 });
      updateParams.email = body.email.trim();
    }
    if (body.positionTitle !== undefined) {
      if (!body.positionTitle.trim()) return NextResponse.json({ error: 'Position title is required.' }, { status: 400 });
      updateParams.positionTitle = body.positionTitle.trim();
    }
    if (body.phone !== undefined) updateParams.phone = body.phone?.trim() || null;
    if (body.experienceYears !== undefined) updateParams.experienceYears = body.experienceYears === '' ? null : Number(body.experienceYears);
    if (body.currentCompany !== undefined) updateParams.currentCompany = body.currentCompany?.trim() || null;
    if (body.currentCtc !== undefined) updateParams.currentCtc = body.currentCtc?.trim() || null;
    if (body.expectedCtc !== undefined) updateParams.expectedCtc = body.expectedCtc?.trim() || null;
    if (body.noticePeriodDays !== undefined) updateParams.noticePeriodDays = body.noticePeriodDays === '' ? null : Number(body.noticePeriodDays);
    if (body.source !== undefined) updateParams.source = body.source?.trim() || null;
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
      }
      updateParams.status = body.status;
    }

    await db.updateLateralCandidate(id, updateParams);
    const list = await db.getLateralCandidates();
    return NextResponse.json({ success: true, candidates: list });
  } catch (error) {
    console.error('Failed to update lateral candidate:', error);
    return NextResponse.json({ error: 'Failed to update lateral candidate' }, { status: 500 });
  }
}

// DELETE (soft) a lateral candidate
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing candidate ID' }, { status: 400 });
    }

    await db.deleteLateralCandidate(id);
    const list = await db.getLateralCandidates();
    return NextResponse.json({ success: true, candidates: list });
  } catch (error) {
    console.error('Failed to delete lateral candidate:', error);
    return NextResponse.json({ error: 'Failed to delete lateral candidate' }, { status: 500 });
  }
}
