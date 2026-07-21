import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@server/lib/session';
import { candidatesService } from '@server/services/candidates/candidates.service';
import { InvalidResumeFileError } from '@server/util/file-validate';

export const dynamic = 'force-dynamic';

// Recruiter uploads a resume file for an uploaded candidate
export async function POST(
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

    const formData = await request.formData();
    const file = formData.get('resume');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No resume file provided.' }, { status: 400 });
    }

    const candidates = await candidatesService.uploadResume(id, file, session.user.email);
    return NextResponse.json({ success: true, candidates });
  } catch (error) {
    console.error('Failed to upload resume:', error);
    if (error instanceof InvalidResumeFileError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to upload resume' }, { status: 500 });
  }
}
