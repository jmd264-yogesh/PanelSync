import { Interview, UploadedCandidate, Drive } from "@server/lib/db";

/** True when an interview falls inside the given drive's date window. */
export function interviewInDriveWindow(
  interview: Interview,
  drive: Drive,
  candidates: UploadedCandidate[],
): boolean {
  const candidate = candidates.find(
    (c) => c.email.toLowerCase() === interview.candidateEmail.toLowerCase(),
  );
  if (candidate) {
    if (
      !candidate.collegeDrive ||
      candidate.collegeDrive.toLowerCase() !== drive.collegeName.toLowerCase()
    ) {
      return false;
    }
  } else {
    if (
      !interview.role.toLowerCase().includes(drive.collegeName.toLowerCase())
    ) {
      return false;
    }
  }

  const ds = drive.startDate;
  const de = drive.endDate;
  if (interview.status === "SCHEDULED" && interview.scheduledSlotStart) {
    const d = interview.scheduledSlotStart.split("T")[0];
    return d >= ds && d <= de;
  }
  const iS = interview.startDate.split("T")[0];
  const iE = interview.endDate.split("T")[0];
  return iS <= de && iE >= ds;
}
