import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, getSession } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET(_request: NextRequest) {
  const token = await getValidAccessToken();
  const session = await getSession();

  if (!token || !session) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const interviews = await db.getInterviews();

    return NextResponse.json({
      success: true,
      interviews,
    });
  } catch (error) {
    console.error("Failed to fetch interviews:", error);

    return NextResponse.json(
      { error: "Failed to fetch interviews" },
      { status: 500 }
    );
  }
}