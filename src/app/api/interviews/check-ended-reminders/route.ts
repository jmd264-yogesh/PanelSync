import { NextRequest, NextResponse } from 'next/server';
import { db, dbClient } from '@/lib/db';
import { getAnyValidAccessToken } from '@/lib/session';
import { graph } from '@/lib/graph';
import * as schema from '@/lib/schema';
import { eq, and, lt, isNull } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const now = new Date();

    // 1. Fetch all SCHEDULED interviews where scheduledSlotEnd is in the past
    const endedInterviews = await dbClient
      .select()
      .from(schema.interviews)
      .where(
        and(
          eq(schema.interviews.status, 'SCHEDULED'),
          lt(schema.interviews.scheduledSlotEnd, now)
        )
      );

    if (endedInterviews.length === 0) {
      return NextResponse.json({ success: true, message: 'No ended scheduled interviews found.' });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const processed: { interviewId: string; panelEmail: string; status: string }[] = [];

    // Get Vishnupriya's token/session
    const tokenInfo = await getAnyValidAccessToken();
    if (!tokenInfo) {
      return NextResponse.json({ error: 'No active recruiter session found' }, { status: 401 });
    }
    const { token, email: senderEmail, userId: senderUserId } = tokenInfo;

    for (const interview of endedInterviews) {
      // Fetch panels for this interview that are SUBMITTED (booked) but decision is pending and reminder hasn't been sent yet
      const panelsToRemind = await dbClient
        .select()
        .from(schema.interviewPanels)
        .where(
          and(
            eq(schema.interviewPanels.interviewId, interview.id),
            eq(schema.interviewPanels.status, 'SUBMITTED'),
            isNull(schema.interviewPanels.decision),
            eq(schema.interviewPanels.feedbackReminderSent, false)
          )
        );

      for (const panel of panelsToRemind) {
        if (senderEmail.toLowerCase() === panel.email.toLowerCase()) {
          console.warn(`[AutoReminder] Skipping self-message for ${panel.email}`);
          continue;
        }

        const feedbackLink = `${appUrl}/feedback/${panel.token}`;
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

        try {
          const chat = await graph.createOneOnOneChat(senderUserId, panel.userId, token);

          const isL1 = interview.role.toLowerCase().includes('l1');
          const isL2 = interview.role.toLowerCase().includes('l2');
          const roundLabel = isL1 ? 'L1 Technical Screening' : isL2 ? 'L2 System Design / Management' : interview.role;
          const accentColor = isL1 ? '#60a5fa' : isL2 ? '#a78bfa' : '#6366f1';

          const htmlMessage = `
            <div style="font-family: 'Segoe UI', system-ui, sans-serif; padding: 16px; border-left: 4px solid ${accentColor}; background-color: #0f172a; color: #f8fafc; border-radius: 8px; max-width: 520px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                <div style="background: ${accentColor}22; border: 1px solid ${accentColor}55; border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 700; color: ${accentColor};">${isL1 ? 'L1' : isL2 ? 'L2' : 'ROUND'}</div>
                <h3 style="margin: 0; color: #f8fafc; font-size: 15px; font-weight: 600;">Interview Feedback Required</h3>
              </div>

              <p style="margin: 0 0 8px; font-size: 14px; color: #cbd5e1;">
                Hi <strong style="color: #f8fafc;">${panel.name}</strong>,
              </p>
              <p style="margin: 0 0 14px; font-size: 14px; color: #94a3b8;">
                Your <strong style="color: ${accentColor};">${roundLabel}</strong> interview slot has ended at <strong>${slotEnd}</strong>. Please take a moment to submit your feedback and decision for this candidate.
              </p>

              <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 12px 14px; margin-bottom: 16px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <div>
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.05em;">Candidate</div>
                    <div style="font-size: 14px; font-weight: 700; color: #ffffff;">${interview.candidateName}</div>
                  </div>
                  <div>
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.05em;">Role</div>
                    <div style="font-size: 14px; font-weight: 700; color: #ffffff;">${interview.role}</div>
                  </div>
                </div>
              </div>

              <a href="${feedbackLink}" style="display: inline-block; background: ${accentColor}; color: #ffffff; padding: 10px 22px; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 14px; margin-bottom: 14px;">
                Submit Feedback →
              </a>

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

          processed.push({ interviewId: interview.id, panelEmail: panel.email, status: 'sent' });
        } catch (panelErr) {
          console.error(`[AutoReminder] Failed to send reminder to ${panel.email}:`, panelErr);
          processed.push({ interviewId: interview.id, panelEmail: panel.email, status: `failed: ${String(panelErr)}` });
        }
      }
    }

    return NextResponse.json({ success: true, processed });
  } catch (error: any) {
    console.error('Failed automatically checking and sending feedback reminders:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
