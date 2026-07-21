import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@server/lib/session';
import { lateralCandidatesService } from '@server/services/lateral-candidates/lateral-candidates.service';
import { InvalidResumeFileError } from '@server/util/file-validate';

export const dynamic = 'force-dynamic';

// Recruiter uploads a resume file for a lateral hiring candidate
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

    const formData = await request.formData();
    const file = formData.get('resume');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No resume file provided.' }, { status: 400 });
    }

    const candidates = await lateralCandidatesService.uploadResume(id, file, session.user.email);
    return NextResponse.json({ success: true, candidates });
  } catch (error) {
    console.error('Failed to upload resume:', error);
    if (error instanceof InvalidResumeFileError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Failed to upload resume';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
