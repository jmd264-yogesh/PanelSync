import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken, getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { graph } from '@/lib/graph';

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  const session = await getSession();

  if (!token || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { interviewId, panelId } = body;

    if (!interviewId || !panelId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Fetch existing interview
    const interview = await db.getInterview(interviewId);
    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    // 2. Find specific panel nomination
    const panel = interview.panels.find((p) => p.id === panelId);
    if (!panel) {
      return NextResponse.json({ error: 'Panelist nomination not found' }, { status: 404 });
    }

    if (panel.status !== 'PENDING') {
      return NextResponse.json({ error: 'Panelist has already submitted availability' }, { status: 400 });
    }

    // 3. Resend Microsoft Teams chat invitation message
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const availabilityLink = `${appUrl}/availability/${panel.token}`;



    const chat = await graph.createOneOnOneChat(session.user.id, panel.userId, token);

    const htmlMessage = `
      <div style="font-family: 'Segoe UI', system-ui, sans-serif; padding: 16px; border-left: 4px solid #6366f1; background-color: #0f172a; color: #f8fafc; border-radius: 8px; max-width: 480px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
        <h3 style="margin-top: 0; color: #6366f1; font-size: 16px; font-weight: 600;">Reminder: Interview Panel Request</h3>
        <p style="margin: 8px 0; font-size: 14px; color: #cbd5e1;">Hello <strong>${panel.name}</strong>,</p>
        <p style="margin: 8px 0; font-size: 14px; color: #94a3b8;">
          This is a reminder that you have been nominated by <strong>${session.user.displayName}</strong> to conduct an interview. Please provide your available slots when possible.
        </p>
        <div style="background-color: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; margin: 12px 0; border: 1px solid rgba(255,255,255,0.05);">
          <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Candidate</div>
          <div style="font-size: 14px; font-weight: bold; color: #ffffff;">${interview.candidateName}</div>
          <div style="font-size: 13px; color: #94a3b8; margin-top: 6px; margin-bottom: 2px;">Role / Position</div>
          <div style="font-size: 14px; font-weight: bold; color: #ffffff;">${interview.role}</div>
          <div style="font-size: 13px; color: #94a3b8; margin-top: 6px; margin-bottom: 2px;">Duration</div>
          <div style="font-size: 14px; font-weight: bold; color: #ffffff;">${interview.duration} minutes</div>
        </div>
        <p style="font-size: 14px; color: #94a3b8; margin-bottom: 16px;">
          Please click the link below to select **one or more** available slots:
        </p>
        <div style="margin-top: 16px; margin-bottom: 12px;">
          <a href="${availabilityLink}" style="background-color: #6366f1; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
            Select Slots / Provide Availability
          </a>
        </div>
        <div style="font-size: 11px; color: #64748b; margin-top: 14px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
          Access link: <a href="${availabilityLink}" style="color: #6366f1; text-decoration: underline;">${availabilityLink}</a>
        </div>
      </div>
    `;

    await graph.sendTeamsMessage(chat.id, htmlMessage, token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to resend invitation:', error);
    return NextResponse.json({ error: 'Failed to resend invitation' }, { status: 500 });
  }
}
