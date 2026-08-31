import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Webhook endpoint for Microsoft Graph meeting transcript notifications
// Supports:
// 1. Subscription verification handshake (GET/POST validationToken query param)
// 2. Lifecycle & Change notifications for transcripts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const validationToken = searchParams.get('validationToken');

  if (validationToken) {
    // Microsoft Graph subscription verification handshake requires returning the token in plain text
    return new NextResponse(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({ status: 'active', service: 'PanelSync Graph Transcript Webhook' });
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const validationToken = searchParams.get('validationToken');

  // If validation token is passed in POST query
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  try {
    const payload = await request.json().catch(() => ({}));
    console.log('Received Graph Transcript Webhook Notification:', JSON.stringify(payload, null, 2));

    const notifications = payload.value || [];
    for (const notification of notifications) {
      const resource = notification.resource || '';
      console.log(`Processing transcript notification for resource: ${resource}`);
      // Log event into audit logs if helpful
      try {
        await db.addAuditLog(
          'system@microsoft.graph',
          'TRANSCRIPT_NOTIFICATION_RECEIVED',
          'OnlineMeeting',
          resource,
          notification
        );
      } catch (logErr) {
        console.warn('Audit log write failed for transcript notification:', logErr);
      }
    }

    return new NextResponse(null, { status: 202 });
  } catch (error) {
    console.error('Error handling Graph webhook notification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
