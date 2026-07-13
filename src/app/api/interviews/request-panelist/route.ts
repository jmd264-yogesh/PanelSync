import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, getSession } from "@/lib/session";
import { db, dbClient } from "@/lib/db";
import { graph } from "@/lib/graph";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/schema";

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  const session = await getSession();

  if (!token || !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      panelist,
      panelists: bodyPanelists,
      duration,
      startDate,
      endDate,
      interviewType,
      slots,
      collegeName,
      startTime,
      endTime,
      candidateName,
      candidateEmail,
      role,
      lateralCandidateId,
    } = body;

    const isLateral = Boolean(lateralCandidateId);
    const targetPanelists = bodyPanelists || (panelist ? [panelist] : []);

    if (!targetPanelists.length)
      return NextResponse.json(
        { error: "No panelists selected." },
        { status: 400 },
      );

    if (!duration)
      return NextResponse.json(
        { error: "Duration is required." },
        { status: 400 },
      );

    let availabilitySlots = slots;

    if (isLateral) {
      availabilitySlots = [];

      const start = new Date(`${startDate}T${startTime}:00`);
      const end = new Date(`${startDate}T${endTime}:00`);
      const durationMinutes = Number(duration);

      if (start >= end) {
        return NextResponse.json(
          { error: "Window end time must be after window start time." },
          { status: 400 },
        );
      }

      let current = new Date(start);

      while (true) {
        const slotEnd = new Date(
          current.getTime() + durationMinutes * 60 * 1000,
        );

        if (slotEnd > end) break;

        availabilitySlots.push({
          startTime: current.toISOString(),
          endTime: slotEnd.toISOString(),
        });

        current = slotEnd;
      }

      if (!availabilitySlots.length) {
        return NextResponse.json(
          {
            error:
              "The selected window is too short for the chosen interview duration.",
          },
          { status: 400 },
        );
      }
    } else {
      if (!slots?.length) {
        return NextResponse.json(
          { error: "Please provide availability slots." },
          { status: 400 },
        );
      }
    }

    if (isLateral) {
      if (
        !startTime ||
        !endTime ||
        !candidateName ||
        !candidateEmail ||
        !role
      ) {
        return NextResponse.json(
          { error: "Missing lateral hiring details." },
          { status: 400 },
        );
      }
    } else {
      if (!startDate || !endDate || !interviewType || !collegeName?.trim()) {
        return NextResponse.json(
          { error: "Missing campus interview details." },
          { status: 400 },
        );
      }
    }

    // 1. Create separate interview requests with "Pending Assignment" details for each targeted panelist
    const interviewRole = isLateral
      ? role
      : `${interviewType} Interview - ${collegeName}`;
    const createdInterviews = [];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    for (const p of targetPanelists) {
      const interviewStart = isLateral
        ? `${startDate}T${startTime}:00`
        : startDate;

      const interviewEnd = isLateral ? `${startDate}T${endTime}:00` : endDate;
      const interview = await db.createInterview({
        candidateName: isLateral ? candidateName : "Pending Assignment",

        candidateEmail: isLateral ? candidateEmail : "pending@assign.com",

        role: interviewRole,

        duration: Number(duration),

        startDate: interviewStart,

        endDate: interviewEnd,

        panels: [
          {
            userId: p.id,
            name: p.displayName,
            email: p.mail,
          },
        ],
      });

      if (isLateral) {
        await dbClient
          .update(schema.lateralCandidates)
          .set({
            mappedInterviewId: interview.id,
            status: "WAITING_FOR_INTERVIEW",
          })
          .where(eq(schema.lateralCandidates.id, lateralCandidateId));
      }

      // 2. Insert proposed slots into database availabilities for this panel member
      const panel = interview.panels[0];
      for (const slot of availabilitySlots) {
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
        const chat = await graph.createOneOnOneChat(
          session.user.id,
          panel.userId,
          token,
        );

        const requestTitle = isLateral
          ? "Lateral Interview Request"
          : "Interview Slot Request";

        const greeting = isLateral
          ? `
          You have been nominated by
          <strong>${session.user.displayName}</strong>
          to interview
          <strong>${candidateName}</strong>.
        `
          : `
          You have been requested by
          <strong>${session.user.displayName}</strong>
          to conduct an interview.
        `;

        const htmlMessage = `
          <div style="font-family: 'Segoe UI', system-ui, sans-serif; padding: 16px; border-left: 4px solid #6366f1; background-color: #0f172a; color: #f8fafc; border-radius: 8px; max-width: 520px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
            <div style="margin-bottom: 12px; font-size: 14px;">
              <div style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 6px; padding: 4px 10px; font-size: 12px; font-weight: 700; color: #818cf8; display: inline-block;">REQUEST</div>
              <h3 style="margin: 0 0 0 8px; color: #f8fafc; font-size: 15px; font-weight: 600; display: inline-block; vertical-align: middle;">${requestTitle}</h3>
            </div>

            <p style="margin: 0 0 8px; font-size: 14px; color: #cbd5e1;">
              Hello <strong style="color: #f8fafc;">${panel.name}</strong>,
            </p>
            <p style="margin: 0 0 14px; font-size: 14px; color: #94a3b8;">
              ${greeting}
            </p>

            <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px 14px; margin-bottom: 16px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 50%; padding-right: 10px; vertical-align: top; padding-bottom: 10px;">
                    <div style="font-size: 11px; color: #94a3b8; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Interview Round</div>
                    <div style="font-size: 13px; font-weight: 700; color: #ffffff;">${interviewRole}</div>
                  </td>
                  <td style="width: 50%; vertical-align: top; padding-bottom: 10px;">
                    <div style="font-size: 11px; color: #94a3b8; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Proposed Dates</div>
                    <div style="font-size: 13px; font-weight: 700; color: #ffffff;">${
                      isLateral
                        ? `${new Date(interviewStart).toLocaleDateString("en-US")}
                          ${new Date(interviewStart).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "numeric",
                              minute: "2-digit",
                            },
                          )}
                          - ${new Date(interviewEnd).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "numeric",
                              minute: "2-digit",
                            },
                          )}`
                        : `${new Date(startDate).toLocaleDateString("en-US")} - ${new Date(endDate).toLocaleDateString("en-US")}`
                    }</div>
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
        console.error(
          "Failed to send Teams message to panel member:",
          chatError,
        );
      }

      createdInterviews.push(interview);
    }

    return NextResponse.json({
      success: true,
      interviews: createdInterviews,
      interview: createdInterviews[0],
    });
  } catch (error) {
    console.error("Failed to request panelist slot:", error);
    return NextResponse.json(
      { error: "Failed to request panelist slot" },
      { status: 500 },
    );
  }
}
