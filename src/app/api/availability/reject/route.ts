import { NextRequest, NextResponse } from 'next/server';
import { availabilityService } from '@server/services/availability/availability.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, reason } = body;

    const result = await availabilityService.rejectRequest(token, reason);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to reject panel request:', error);
    const message = error instanceof Error ? error.message : 'Failed to reject request';
    const status = message.includes('not found') ? 404 :
                   message.includes('Missing') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
