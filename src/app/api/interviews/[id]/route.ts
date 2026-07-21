import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@server/lib/session';
import { interviewsService } from '@server/services/interviews/interviews.service';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  try {
    const interview = await interviewsService.getInterviewById(id);
    return NextResponse.json({ success: true, interview });
  } catch (error: any) {
    if (error.message === 'INTERVIEW_NOT_FOUND') {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to fetch interview' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  try {
    await interviewsService.deleteInterview(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'INTERVIEW_NOT_FOUND') {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete interview' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json();

    const updatedInterview = await interviewsService.updateInterview(id, body);
    return NextResponse.json({ success: true, interview: updatedInterview });
  } catch (error: any) {
    if (error.message === 'INTERVIEW_NOT_FOUND') {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update interview' }, { status: 500 });
  }
}
