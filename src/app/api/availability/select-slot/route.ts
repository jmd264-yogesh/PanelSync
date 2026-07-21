import { NextRequest, NextResponse } from 'next/server';
import { getAnyValidAccessToken } from '@server/lib/session';
import { availabilityService } from '@server/services/availability/availability.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, startTime, endTime } = body;
    let slots = body.slots;

    if (!slots && startTime && endTime) {
      slots = [{ startTime, endTime }];
    }

    const tokenInfo = await getAnyValidAccessToken();
    if (!tokenInfo) {
      return NextResponse.json({ error: 'Recruiter session is expired or not logged in' }, { status: 401 });
    }

    const result = await availabilityService.selectSlot(token, slots, tokenInfo);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to select slot and schedule meeting:', error);
    const message = error instanceof Error ? error.message : 'Failed to schedule meeting';
    const status = message.includes('not found') || message.includes('expired') ? 404 :
                   message.includes('already scheduled') || message.includes('Missing') || message.includes('in the past') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
