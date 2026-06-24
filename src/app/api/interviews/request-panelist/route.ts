import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken, getSession } from '@/lib/session';
import { db, dbClient } from '@/lib/db';
import { graph } from '@/lib/graph';
import * as schema from '@/lib/schema';

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  const session = await getSession();

  if (!token || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { panelist, panelists: bodyPanelists, duration, startDate, endDate, interviewType, slots, collegeName } = body;

    const targetPanelists = bodyPanelists || (panelist ? [panelist] : []);

    if (!targetPanelists.length || !duration || !startDate || !endDate || !interviewType || !slots || !slots.length || !collegeName || !collegeName.trim()) {
      return NextResponse.json({ error: 'Missing required request parameters (including College Name)' }, { status: 400 });
    }

    // 1. Create separate interview requests with "Pending Assignment" details for each targeted panelist
    const role = collegeName ? `${interviewType} Interview - ${collegeName}` : `${interviewType} Interview`;
    const createdInterviews = [];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    for (const p of targetPanelists) {
      const interview = await db.createInterview({
        candidateName: 'Pending Assignment',
        candidateEmail: 'pending@assign.com',
        role,
        duration: parseInt(duration, 10),
        startDate,
        endDate,
        panels: [{
          userId: p.id,
          name: p.displayName,
          email: p.email,
        }],
      });

      // 2. Insert proposed slots into database availabilities for this panel member
      const panel = interview.panels[0];
      for (const slot of slots) {
        const avId = crypto.randomUUID();
        await dbClient.insert(schema.panelAvailabilities).values({
          id: avId,
          panelId: panel.id,
          startTime: new Date(slot.startTime),
          endTime: new Date(slot.endTime),
        });
      }

      // 3. Send Teams notification to this panelist
      const availabilityLink = `${appUrl}/availability/${panel.token}`;
      try {
        const chat = await graph.createOneOnOneChat(session.user.id, panel.userId, token);
        
        const htmlMessage = `
          <div style="font-family: 'Segoe UI', system-ui, sans-serif; padding: 16px; border-left: 4px solid #6366f1; background-color: #0f172a; color: #f8fafc; border-radius: 8px; max-width: 520px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
            <div style="margin-bottom: 12px; font-size: 14px;">
              <div style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 700; color: #818cf8; display: inline-block;">REQUEST</div>
              <h3 style="margin: 0 0 0 8px; color: #f8fafc; font-size: 15px; font-weight: 600; display: inline-block; vertical-align: middle;">Interview Slot Request</h3>
            </div>

            <p style="margin: 0 0 8px; font-size: 14px; color: #cbd5e1;">
              Hello <strong style="color: #f8fafc;">${panel.name}</strong>,
            </p>
            <p style="margin: 0 0 14px; font-size: 14px; color: #94a3b8;">
              You have been requested by <strong style="color: #ffffff;">${session.user.displayName}</strong> to conduct an interview.
            </p>

            <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px 14px; margin-bottom: 16px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 50%; padding-right: 10px; vertical-align: top; padding-bottom: 10px;">
                    <div style="font-size: 11px; color: #94a3b8; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Interview Round</div>
                    <div style="font-size: 13px; font-weight: 700; color: #ffffff;">${role}</div>
                  </td>
                  <td style="width: 50%; vertical-align: top; padding-bottom: 10px;">
                    <div style="font-size: 11px; color: #94a3b8; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Proposed Dates</div>
                    <div style="font-size: 13px; font-weight: 700; color: #ffffff;">${new Date(startDate).toLocaleDateString('en-US')} - ${new Date(endDate).toLocaleDateString('en-US')}</div>
                  </td>
                </tr>
                <tr>
                  <td style="width: 50%; padding-right: 10px; vertical-align: top;">
                    <div style="font-size: 11px; color: #94a3b8; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Duration</div>
                    <div style="font-size: 13px; font-weight: 700; color: #ffffff;">${duration} minutes</div>
                  </td>
                  <td style="width: 50%; vertical-align: top;">
                    <div style="font-size: 11px; color: #94a3b8; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Nominated Panelist</div>
                    <div style="font-size: 13px; font-weight: 700; color: #ffffff;">${panel.name}</div>
                  </td>
                </tr>
              </table>
            </div>

            <p style="font-size: 13px; color: #94a3b8; margin-bottom: 12px;">
              Please click the button below to view the proposed slots and select slots to book instantly:
            </p>

            <table border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 14px;">
              <tr>
                <td align="center" style="border-radius: 6px;" bgcolor="#6366f1">
                  <a href="${availabilityLink}" target="_blank" style="font-size: 14px; font-family: 'Segoe UI', sans-serif; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 6px; border: 1px solid #6366f1; display: inline-block; font-weight: 700;">
                    Select Slots / Provide Availability
                  </a>
                </td>
              </tr>
            </table>

            <div style="font-size: 11px; color: #475569; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px;">
              Access link: <a href="${availabilityLink}" style="color: #6366f1; text-decoration: underline;">${availabilityLink}</a>
            </div>
          </div>
        `;

        await graph.sendTeamsMessage(chat.id, htmlMessage, token);
      } catch (chatError) {
        console.error('Failed to send Teams message to panel member:', chatError);
      }

      createdInterviews.push(interview);
    }

    return NextResponse.json({ success: true, interviews: createdInterviews, interview: createdInterviews[0] });
  } catch (error) {
    console.error('Failed to request panelist slot:', error);
    return NextResponse.json({ error: 'Failed to request panelist slot' }, { status: 500 });
  }
}
