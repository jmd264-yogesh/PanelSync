import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, getSession } from "@server/lib/session";
import { db, dbClient } from "@server/lib/db";
import { graph } from "@server/lib/graph";
import { eq } from "drizzle-orm";
import * as schema from "@server/lib/schema";

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
      hiringType,
    } = body;

    const isLateral = hiringType === 'LATERAL';
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
        candidateName: candidateName,
        candidateEmail: candidateEmail,
        role: interviewRole,
        hiringType: hiringType,
        duration: Number(duration),
        startDate: interviewStart,
        endDate: interviewEnd,
        panels: [
          {
            userId: p.id,
            name: p.displayName,
            email: p.email || p.mail,
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
          ? "Lateral Hiring Interview Slot Request"
          : "Campus Hiring Interview Slot Request";

        const greeting = isLateral
          ? `You have been nominated by <strong>${session.user.displayName}</strong> to interview <strong>${candidateName}</strong>.`
          : `You have been requested by <strong>${session.user.displayName}</strong> to conduct an interview.`;

        // const htmlMessage = `
        //   <div style="
        //     font-family: 'Segoe UI', Arial, sans-serif;
        //     max-width:560px;
        //     background:#ffffff;
        //     border:1px solid #e5e7eb;
        //     border-radius:12px;
        //     overflow:hidden;
        //   ">

        //     <!-- Header -->
        //     <div style="
        //       background:#4f46e5;
        //       padding:18px 24px;
        //       color:#ffffff;
        //     ">
        //       <div style="font-size:13px;opacity:.9;">
        //         Interview Management System
        //       </div>

        //       <div style="
        //         font-size:22px;
        //         font-weight:600;
        //         margin-top:6px;
        //       ">
        //         📅 ${requestTitle}
        //       </div>
        //     </div>

        //     <!-- Body -->
        //     <div style="padding:24px;">

        //       <p style="margin:0;font-size:15px;">
        //         Hi <strong>${panel.name}</strong>,
        //       </p>

        //       <p style="
        //         margin-top:14px;
        //         color:#374151;
        //         line-height:1.6;
        //         font-size:14px;
        //       ">
        //         ${
        //           isLateral
        //             ? `
        //         <strong>${session.user.displayName}</strong> has nominated you to interview
        //         <strong>${candidateName}</strong>.
        //         `
        //             : `
        //         <strong>${session.user.displayName}</strong> has requested you to conduct an interview.
        //         `
        //         }
        //       </p>

        //       <!-- Candidate -->
        //       ${
        //         isLateral
        //           ? `
        //       <div style="
        //         margin-top:18px;
        //         background:#f8fafc;
        //         border-left:4px solid #4f46e5;
        //         padding:14px;
        //         border-radius:8px;
        //       ">
        //         <div style="font-size:12px;color:#6b7280;">
        //           Candidate
        //         </div>

        //         <div style="
        //           font-size:18px;
        //           font-weight:600;
        //           color:#111827;
        //           margin-top:2px;
        //         ">
        //           ${candidateName}
        //         </div>

        //         <div style="
        //           color:#6b7280;
        //           margin-top:4px;
        //           font-size:13px;
        //         ">
        //           ${candidateEmail}
        //         </div>
        //       </div>
        //       `
        //           : ""
        //       }

        //       <!-- Details -->
        //       <table
        //         style="
        //           width:100%;
        //           margin-top:22px;
        //           border-collapse:separate;
        //           border-spacing:0 10px;
        //         "
        //       >

        //         <tr>
        //           <td style="
        //             width:40%;
        //             color:#6b7280;
        //             font-size:13px;
        //           ">
        //             Interview Round
        //           </td>

        //           <td style="
        //             font-weight:600;
        //             color:#111827;
        //             font-size:14px;
        //           ">
        //             ${interviewRole}
        //           </td>
        //         </tr>

        //         <tr>
        //           <td style="color:#6b7280;font-size:13px;">
        //             Proposed Window
        //           </td>

        //           <td style="font-weight:600;color:#111827;font-size:14px;">
        //             ${
        //               isLateral
        //                 ? `${new Date(interviewStart).toLocaleDateString("en-US")} •
        //                   ${new Date(interviewStart).toLocaleTimeString(
        //                     "en-US",
        //                     {
        //                       hour: "numeric",
        //                       minute: "2-digit",
        //                     },
        //                   )}
        //                   -
        //                   ${new Date(interviewEnd).toLocaleTimeString("en-US", {
        //                     hour: "numeric",
        //                     minute: "2-digit",
        //                   })}`
        //                 : `${new Date(startDate).toLocaleDateString("en-US")}
        //                   -
        //                   ${new Date(endDate).toLocaleDateString("en-US")}`
        //             }
        //           </td>
        //         </tr>

        //         <tr>
        //           <td style="color:#6b7280;font-size:13px;">
        //             Duration
        //           </td>

        //           <td style="font-weight:600;color:#111827;font-size:14px;">
        //             ${duration} Minutes
        //           </td>
        //         </tr>

        //         <tr>
        //           <td style="color:#6b7280;font-size:13px;">
        //             Assigned Panelist
        //           </td>

        //           <td style="font-weight:600;color:#111827;font-size:14px;">
        //             ${panel.name}
        //           </td>
        //         </tr>

        //       </table>

        //       <!-- Action Required -->
        //       <div style="
        //         margin-top:24px;
        //         padding:16px;
        //         background:#eef2ff;
        //         border-radius:8px;
        //         border:1px solid #c7d2fe;
        //       ">

        //         <div style="
        //           font-weight:600;
        //           color:#3730a3;
        //           margin-bottom:8px;
        //         ">
        //           Action Required
        //         </div>

        //         <div style="
        //           color:#4b5563;
        //           font-size:13px;
        //           line-height:1.6;
        //         ">
        //           Please review the proposed interview schedule and select your available slot.
        //           Once you confirm your availability, the interview can be finalized.
        //         </div>

        //       </div>

        //       <!-- Button -->
        //       <div style="
        //         text-align:center;
        //         margin-top:26px;
        //       ">

        //         <a
        //           href="${availabilityLink}"
        //           target="_blank"
        //           style="
        //             background:#4f46e5;
        //             color:white;
        //             text-decoration:none;
        //             padding:12px 28px;
        //             border-radius:8px;
        //             display:inline-block;
        //             font-weight:600;
        //             font-size:14px;
        //           "
        //         >
        //           Review Availability
        //         </a>

        //       </div>

        //       <!-- Footer -->
        //       <div style="
        //         margin-top:28px;
        //         padding-top:16px;
        //         border-top:1px solid #e5e7eb;
        //         color:#9ca3af;
        //         font-size:12px;
        //         line-height:1.5;
        //       ">
        //         If the button doesn't work, copy and paste the link below into your browser:
        //         <br><br>

        //         <a
        //           href="${availabilityLink}"
        //           style="
        //             color:#4f46e5;
        //             word-break:break-all;
        //           "
        //         >
        //           ${availabilityLink}
        //         </a>

        //       </div>

        //     </div>

        //   </div>
        // `;
        const htmlMessage = `
  <div style="
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    max-width: 500px;
    margin: 4px;
    background-color: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(128, 128, 128, 0.15);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
  ">

    <!-- Accent Top Bar (Standard Teams Brand Indigo) -->
    <div style="
      background-color: #5b5fc7;
      height: 4px;
      width: 100%;
    "></div>

    <!-- Inner Content Wrapper -->
    <div style="padding: 20px;">
      
      <!-- App Context Label -->
      <div style="
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #5b5fc7;
        margin-bottom: 6px;
      ">
        Interview Management System
      </div>

      <!-- Header Title -->
      <div style="
        font-size: 18px;
        font-weight: 700;
        margin-bottom: 16px;
        line-height: 1.3;
      ">
        📅 ${requestTitle}
      </div>

      <!-- Greeting Summary -->
      <div style="font-size: 14px; margin-bottom: 10px;">
        Hi <strong>${panel.name}</strong>,
      </div>

      <!-- Dynamic Greeting String -->
      <div style="
        font-size: 14px;
        line-height: 1.5;
        margin-bottom: 16px;
        opacity: 0.9;
      ">
        ${greeting}
      </div>

      <!-- Candidate Box (Adapts to Light/Dark backgrounds) -->
      ${isLateral
            ? `
      <div style="
        background-color: rgba(128, 128, 128, 0.08);
        border-left: 3px solid #5b5fc7;
        padding: 12px;
        border-radius: 4px;
        margin-bottom: 16px;
      ">
        <div style="font-size: 11px; font-weight: 600; opacity: 0.6; text-transform: uppercase;">
          Candidate Details
        </div>
        <div style="font-size: 15px; font-weight: 600; margin-top: 4px;">
          ${candidateName}
        </div>
        <div style="font-size: 13px; opacity: 0.7; margin-top: 2px;">
          ${candidateEmail}
        </div>
      </div>
      `
            : ""
          }

      <!-- Clean Meta Matrix -->
      <div style="
        background-color: rgba(128, 128, 128, 0.04);
        border: 1px solid rgba(128, 128, 128, 0.1);
        border-radius: 6px;
        padding: 4px 12px;
        margin-bottom: 20px;
      ">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          
          <tr style="border-bottom: 1px solid rgba(128, 128, 128, 0.1);">
            <td style="padding: 10px 0; opacity: 0.7; width: 40%;">Round</td>
            <td style="padding: 10px 0; font-weight: 600; text-align: right;">${interviewRole}</td>
          </tr>

          <tr style="border-bottom: 1px solid rgba(128, 128, 128, 0.1);">
            <td style="padding: 10px 0; opacity: 0.7; vertical-align: top;">Proposed Window</td>
            <td style="padding: 10px 0; font-weight: 600; text-align: right; line-height: 1.4;">
              ${isLateral
            ? `${new Date(interviewStart).toLocaleDateString("en-US")} (${new Date(interviewStart).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - ${new Date(interviewEnd).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })})`
            : `${new Date(startDate).toLocaleDateString("en-US")} - ${new Date(endDate).toLocaleDateString("en-US")}`
          }
            </td>
          </tr>

          <tr>
            <td style="padding: 10px 0; opacity: 0.7;">Duration</td>
            <td style="padding: 10px 0; font-weight: 600; text-align: right;">${duration} Minutes</td>
          </tr>

        </table>
      </div>

      <!-- Action Required Subtle Banner -->
      <div style="
        background-color: rgba(91, 95, 199, 0.1);
        border: 1px dashed rgba(91, 95, 199, 0.3);
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 20px;
        font-size: 13px;
        line-height: 1.4;
      ">
        <span style="font-weight: 700; color: #5b5fc7; display: block; margin-bottom: 2px;">Action Required</span>
        <span style="opacity: 0.9;"> Please review the proposed loop windows and submit your available slots.</span>
      </div>

      <!-- Action Button -->
      <div style="margin-bottom: 4px;">
        <a
          href="${availabilityLink}"
          target="_blank"
          style="
            background-color: #5b5fc7;
            color: #ffffff !important;
            text-decoration: none;
            padding: 10px 24px;
            border-radius: 4px;
            display: inline-block;
            font-weight: 600;
            font-size: 14px;
            text-align: center;
          "
        >
          Review Availability
        </a>
      </div>

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
