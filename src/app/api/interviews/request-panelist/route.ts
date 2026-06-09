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
    const { panelist, duration, startDate, endDate, interviewType, slots } = body;

    if (!panelist || !duration || !startDate || !endDate || !interviewType || !slots || !slots.length) {
      return NextResponse.json({ error: 'Missing required request parameters' }, { status: 400 });
    }

    // 1. Create interview request with "Pending Assignment" details
    const role = `${interviewType} Interview`;
    const interview = await db.createInterview({
      candidateName: 'Pending Assignment',
      candidateEmail: 'pending@assign.com',
      role,
      duration: parseInt(duration, 10),
      startDate,
      endDate,
      panels: [
        {
          userId: panelist.id,
          name: panelist.displayName,
          email: panelist.email,
        },
      ],
    });

    const panel = interview.panels[0];

    // 2. Insert proposed slots into database availabilities
    for (const slot of slots) {
      const avId = crypto.randomUUID();
      await dbClient.insert(schema.panelAvailabilities).values({
        id: avId,
        panelId: panel.id,
        startTime: new Date(slot.startTime),
        endTime: new Date(slot.endTime),
      });
    }

    // 3. Send Teams notification to panelist with custom choice link card
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const availabilityLink = `${appUrl}/availability/${panel.token}`;

    try {
      const chat = await graph.createOneOnOneChat(session.user.id, panel.userId, token);
      
      const htmlMessage = `
        <div style="font-family: 'Segoe UI', system-ui, sans-serif; padding: 16px; border-left: 4px solid #6366f1; background-color: #0f172a; color: #f8fafc; border-radius: 8px; max-width: 480px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          <h3 style="margin-top: 0; color: #6366f1; font-size: 16px; font-weight: 600;">Interview Slot Request</h3>
          <p style="margin: 8px 0; font-size: 14px; color: #cbd5e1;">Hello <strong>${panel.name}</strong>,</p>
          <p style="margin: 8px 0; font-size: 14px; color: #94a3b8;">
            You have been requested by <strong>${session.user.displayName}</strong> to conduct a <strong>${role}</strong>.
          </p>
          <p style="font-size: 14px; color: #94a3b8; margin-bottom: 16px;">
            Please click the button below to view the proposed slots and select **one** to book:
          </p>
          <div style="margin-top: 16px; margin-bottom: 12px;">
            <a href="${availabilityLink}" style="background-color: #6366f1; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block; transition: background-color 0.2s;">
              Select Slot Option
            </a>
          </div>
          <div style="font-size: 11px; color: #64748b; margin-top: 14px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
            Access link: <a href="${availabilityLink}" style="color: #6366f1; text-decoration: underline;">${availabilityLink}</a>
          </div>
        </div>
      `;

      await graph.sendTeamsMessage(chat.id, htmlMessage, token);
    } catch (chatError) {
      console.error('Failed to send Teams message to panel:', chatError);
    }

    return NextResponse.json({ success: true, interview });
  } catch (error) {
    console.error('Failed to request panelist slot:', error);
    return NextResponse.json({ error: 'Failed to request panelist slot' }, { status: 500 });
  }
}
