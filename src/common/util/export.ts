import { Interview } from "@server/lib/db";

/** Generate CSV content from interviews array. */
export function generateInterviewsCSV(interviews: Interview[]): string {
  const headers = [
    "Candidate Name",
    "Candidate Email",
    "Role",
    "Status",
    "Start Date",
    "End Date",
    "Scheduled Time",
  ];

  const rows = interviews.map((i) => [
    i.candidateName,
    i.candidateEmail,
    i.role,
    i.status,
    i.startDate,
    i.endDate,
    i.scheduledSlotStart
      ? `${i.scheduledSlotStart} - ${i.scheduledSlotEnd}`
      : "TBD",
  ]);

  return [
    headers.join(","),
    ...rows.map((row) =>
      row.map((val) => `"${val.replace(/"/g, '""')}"`).join(","),
    ),
  ].join("\n");
}

/** Trigger CSV file download in browser. */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
