import { NextRequest, NextResponse } from 'next/server';
import { getSession, getAnyValidAccessToken } from '@/lib/session';
import { db, dbClient } from '@/lib/db';
import { graph } from '@/lib/graph';
import * as schema from '@/lib/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/interviews/send-feedback-reminder
 * Sends a Teams message to the booked panelist of a SCHEDULED interview
 * with a link to /feedback/[token] so they can submit their decision.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { interviewId } = body as { interviewId: string };

    if (!interviewId) {
      return NextResponse.json({ error: 'Missing interviewId' }, { status: 400 });
    }

    const interview = await db.getInterview(interviewId);
    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    if (interview.status !== 'SCHEDULED') {
      return NextResponse.json(
        { error: 'Feedback reminders can only be sent for SCHEDULED interviews.' },
        { status: 400 }
      );
    }

    // Get Vishnupriya's token/session
    const tokenInfo = await getAnyValidAccessToken();
    if (!tokenInfo) {
      return NextResponse.json({ error: 'No active recruiter session found' }, { status: 401 });
    }

    const { token, email: senderEmail, userId: senderUserId } = tokenInfo;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const skipped: string[] = [];
    const sent: string[] = [];

    const slotEnd = interview.scheduledSlotEnd
      ? new Date(interview.scheduledSlotEnd).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'the scheduled slot';

    // Only send to the panelist who got booked/submitted slots
    const targetPanels = interview.panels.filter((p) => p.status === 'SUBMITTED');
    const finalPanels = targetPanels.length > 0 ? targetPanels : interview.panels;

    for (const panel of finalPanels) {


      const feedbackLink = `${appUrl}/feedback/${panel.token}`;

      try {
        const chat = await graph.createOneOnOneChat(senderUserId, panel.userId, token);

        const isL1 = interview.role.toLowerCase().includes('l1');
        const isL2 = interview.role.toLowerCase().includes('l2');
        const roundLabel = isL1 ? 'L1 Technical Screening' : isL2 ? 'L2 System Design / Management' : interview.role;
        const accentColor = isL1 ? '#60a5fa' : isL2 ? '#a78bfa' : '#6366f1';

        const htmlMessage = `
          <div style="font-family: 'Segoe UI', system-ui, sans-serif; padding: 16px; border-left: 4px solid ${accentColor}; background-color: #0f172a; color: #f8fafc; border-radius: 8px; max-width: 520px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
            <div style="margin-bottom: 12px; font-size: 14px;">
              <div style="background: ${accentColor}22; border: 1px solid ${accentColor}55; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 700; color: ${accentColor}; display: inline-block;">${isL1 ? 'L1' : isL2 ? 'L2' : 'ROUND'}</div>
              <h3 style="margin: 0 0 0 8px; color: #f8fafc; font-size: 15px; font-weight: 600; display: inline-block; vertical-align: middle;">Interview Feedback Required</h3>
            </div>

            <p style="margin: 0 0 8px; font-size: 14px; color: #cbd5e1;">
              Hi <strong style="color: #f8fafc;">${panel.name}</strong>,
            </p>
            <p style="margin: 0 0 14px; font-size: 14px; color: #94a3b8;">
              Your <strong style="color: ${accentColor};">${roundLabel}</strong> interview slot has ended at <strong>${slotEnd}</strong>. Please take a moment to submit your feedback and decision for this candidate.
            </p>

            <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px 14px; margin-bottom: 16px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 50%; padding-right: 10px; vertical-align: top;">
                    <div style="font-size: 11px; color: #94a3b8; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Candidate</div>
                    <div style="font-size: 14px; font-weight: 700; color: #ffffff;">${interview.candidateName}</div>
                  </td>
                  <td style="width: 50%; vertical-align: top;">
                    <div style="font-size: 11px; color: #94a3b8; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Role</div>
                    <div style="font-size: 14px; font-weight: 700; color: #ffffff;">${interview.role}</div>
                  </td>
                </tr>
              </table>
            </div>

            <table border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 14px;">
              <tr>
                <td align="center" style="border-radius: 6px;" bgcolor="${accentColor}">
                  <a href="${feedbackLink}" target="_blank" style="font-size: 14px; font-family: 'Segoe UI', sans-serif; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 6px; border: 1px solid ${accentColor}; display: inline-block; font-weight: 700;">
                    Submit Feedback &rarr;
                  </a>
                </td>
              </tr>
            </table>

            <div style="font-size: 11px; color: #475569; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px;">
              Direct link: <a href="${feedbackLink}" style="color: ${accentColor}; text-decoration: underline;">${feedbackLink}</a>
            </div>
          </div>
        `;

        await graph.sendTeamsMessage(chat.id, htmlMessage, token);
        
        // Update database
        await dbClient
          .update(schema.interviewPanels)
          .set({ feedbackReminderSent: true })
          .where(eq(schema.interviewPanels.id, panel.id));

        sent.push(panel.email);
      } catch (panelErr) {
        console.error(`Failed to send feedback reminder to ${panel.email}:`, panelErr);
        skipped.push(panel.email);
      }
    }

    return NextResponse.json({ success: true, sent, skipped });
  } catch (error) {
    console.error('Failed to send feedback reminders:', error);
    return NextResponse.json({ error: 'Failed to send feedback reminders' }, { status: 500 });
  }
}
