import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { blob } from '@/lib/blob';
import { validateResumeFile, InvalidResumeFileError } from '@/lib/file-validate';

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
    if (!id) {
      return NextResponse.json({ error: 'Missing candidate ID' }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('resume');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No resume file provided.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let contentType: string;
    try {
      ({ contentType } = validateResumeFile(buffer));
    } catch (err) {
      if (err instanceof InvalidResumeFileError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const { fileKey } = await blob.uploadResume(id, buffer, file.name, contentType);

    await db.setLateralCandidateResume(id, { fileKey, sha256 });
    await db.addAuditLog(session.user.email, 'RESUME_UPLOADED', 'LateralCandidate', id, { sha256 });

    const candidates = await db.getLateralCandidates();
    return NextResponse.json({ success: true, candidates });
  } catch (error) {
    console.error('Failed to upload resume:', error);
    return NextResponse.json({ error: 'Failed to upload resume' }, { status: 500 });
  }
}
