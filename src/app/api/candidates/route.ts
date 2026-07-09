import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken, getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { blob } from '@/lib/blob';
import { validateResumeFile } from '@/lib/file-validate';
import { fetchExternalResume } from '@/lib/fetch-external-resume';

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
    const created = await db.addUploadedCandidates(candidates);

    // 2. Attach any resume links supplied via the "Resume Link" spreadsheet column —
    // downloaded, magic-byte validated, and re-hosted in our own blob storage,
    // same as a manually attached resume (see /api/candidates/[id]/resume).
    const resumeLinkFailures: { name: string; email: string; error: string }[] = [];
    for (const c of candidates) {
      if (!c.resumeLink || !c.resumeLink.trim()) continue;
      const match = created.find((row) => row.email.toLowerCase() === c.email.toLowerCase());
      if (!match) continue;
      try {
        const buffer = await fetchExternalResume(c.resumeLink.trim());
        const { contentType } = validateResumeFile(buffer);
        const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
        const { fileKey } = await blob.uploadResume(match.id, buffer, 'resume', contentType);
        await db.setCandidateResume(match.id, { fileKey, sha256 });
        await db.addAuditLog(session.user.email, 'RESUME_UPLOADED', 'UploadedCandidate', match.id, { sha256, source: 'bulk_link' });
      } catch (err) {
        resumeLinkFailures.push({
          name: c.name,
          email: c.email,
          error: err instanceof Error ? err.message : 'Failed to attach resume link.',
        });
      }
    }

    // 3. Trigger auto-mapping immediately
    const mapRes = await db.autoMapPendingCandidates({ token, email: session.user.email });

    // 4. Fetch updated states
    const updatedCandidates = await db.getUploadedCandidates();
    const updatedInterviews = await db.getInterviews();

    return NextResponse.json({
      success: true,
      candidates: updatedCandidates,
      interviews: updatedInterviews,
      mappedCount: mapRes.mappedCount,
      resumeLinkFailures,
    });
  } catch (error) {
    console.error('Failed to upload candidates:', error);
    return NextResponse.json({ error: 'Failed to upload candidates' }, { status: 500 });
  }
}
