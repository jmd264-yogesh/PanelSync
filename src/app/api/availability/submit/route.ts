import { NextRequest, NextResponse } from 'next/server';
import { getAnyValidAccessToken } from '@server/lib/session';
import { availabilityService } from '@server/services/availability/availability.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, slots } = body;

    const tokenInfo = await getAnyValidAccessToken();
    const result = await availabilityService.submitAvailability(token, slots, tokenInfo);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to submit availability:', error);
    const message = error instanceof Error ? error.message : 'Failed to submit availability';
    const status = message.includes('Invalid token') || message.includes('not found') ? 404 :
                   message.includes('invalid slots') || message.includes('in the past') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
