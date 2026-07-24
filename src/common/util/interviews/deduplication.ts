import { UploadedCandidate, InterviewPanel } from "@server/lib/db";

/** Deduplicate candidates by email, prioritizing MAPPED status. */
export function deduplicateCandidates(
  candidates: UploadedCandidate[],
): UploadedCandidate[] {
  const map = new Map<string, UploadedCandidate>();
  for (const c of candidates) {
    const emailKey = c.email.toLowerCase();
    const existing = map.get(emailKey);
    if (!existing || c.status === "MAPPED") {
      map.set(emailKey, c);
    }
  }
  return Array.from(map.values());
}

type PanelWithInterviewData = InterviewPanel & {
  candidateName: string;
  role: string;
  interviewStatus: string;
  scheduledSlotStart: string | null | undefined;
  scheduledSlotEnd: string | null | undefined;
  interviewDuration: number;
};

type DedupedPanel = PanelWithInterviewData & {
  candidateNames: string[];
  roles: string[];
  givenSlots: { startTime: string; endTime: string }[];
};

/** Deduplicate panels by email, accumulating candidate names, roles, and slots. Status priority: SUBMITTED > REJECTED > PENDING. */
export function deduplicatePanels(
  panels: PanelWithInterviewData[],
): DedupedPanel[] {
  const panelsMap = new Map<string, DedupedPanel>();

  for (const p of panels) {
    const emailKey = p.email.toLowerCase();
    const slots =
      p.status === "SUBMITTED"
        ? p.scheduledSlotStart
          ? [
              {
                startTime: p.scheduledSlotStart,
                endTime: p.scheduledSlotEnd || "",
              },
            ]
          : (p.availabilities || []).map((av) => ({
              startTime: av.startTime,
              endTime: av.endTime,
            }))
        : [];

    const existing = panelsMap.get(emailKey);
    if (!existing) {
      panelsMap.set(emailKey, {
        ...p,
        candidateNames: [p.candidateName],
        roles: [p.role],
        givenSlots: slots,
      });
    } else {
      if (!existing.candidateNames.includes(p.candidateName)) {
        existing.candidateNames.push(p.candidateName);
      }
      if (!existing.roles.includes(p.role)) {
        existing.roles.push(p.role);
      }

      for (const s of slots) {
        const isDup = existing.givenSlots.some(
          (existSlot) =>
            existSlot.startTime === s.startTime &&
            existSlot.endTime === s.endTime,
        );
        if (!isDup) {
          existing.givenSlots.push(s);
        }
      }

      if (p.status === "SUBMITTED") {
        existing.status = "SUBMITTED";
        existing.submittedAt = p.submittedAt;
        existing.feedback = p.feedback;
        existing.decision = p.decision;
      } else if (p.status === "REJECTED" && existing.status === "PENDING") {
        existing.status = "REJECTED";
        existing.submittedAt = p.submittedAt;
        existing.feedback = p.feedback;
        existing.decision = p.decision;
      }
    }
  }
  return Array.from(panelsMap.values());
}
