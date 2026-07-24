import { useMemo } from "react";
import {
  Interview,
  UploadedCandidate,
  Drive,
  InterviewPanel,
} from "@server/lib/db";
import { getInterviewInfo } from "@common/util/interview-role";
import { interviewInDriveWindow } from "@common/util/interviews/filtering";
import {
  deduplicateCandidates,
  deduplicatePanels,
} from "@common/util/interviews/deduplication";

type PanelWithInterviewData = InterviewPanel & {
  candidateName: string;
  role: string;
  interviewStatus: string | Interview["status"];
  scheduledSlotStart: string | null | undefined;
  scheduledSlotEnd: string | null | undefined;
  interviewDuration: number;
};

interface UseInterviewMetricsProps {
  interviews: Interview[];
  candidates: UploadedCandidate[];
  selectedDrive: Drive | null;
  activeHiringTab: "CAMPUS" | "LATERAL";
  typeFilter: "all" | "L1" | "L2";
  collegeFilter: string;
  dateFilter: string;
}

export interface InterviewMetrics {
  candidateCardTitle: string;
  candidateCardColor: string;
  candidateCardBg: string;
  candidateCardBorder: string;
  driveCandidatesCount: number;
  driveMapped: number;
  drivePending: number;
  drivePanelistsRequested: number;
  drivePanelistsReplied: number;
  drivePanelistsRejected: number;
  drivePanelistsPending: number;
  totalSlotsGiven: number;
  drivePassed: number;
  driveRejected: number;
  uniqueDrivePanels: ReturnType<typeof deduplicatePanels>;
  l1Scheduled: number;
  l1Collected: number;
  l1Pending: number;
  l1CandidatesPending: number;
  l1PanelsRequested: number;
  l1PanelsReplied: number;
  l2Scheduled: number;
  l2Collected: number;
  l2Pending: number;
  l2CandidatesPending: number;
  l2PanelsRequested: number;
  l2PanelsReplied: number;
  drivePanels: PanelWithInterviewData[];
  l1Filtered: Interview[];
  l2Filtered: Interview[];
}

export function useInterviewMetrics(
  props: UseInterviewMetricsProps,
): InterviewMetrics {
  const {
    interviews,
    candidates,
    selectedDrive,
    activeHiringTab,
    typeFilter,
    collegeFilter,
    dateFilter,
  } = props;

  return useMemo(() => {
    const candidateCardTitle =
      typeFilter === "all" ? "Candidates" : `${typeFilter} Candidates`;

    const candidateCardColor = typeFilter === "L2" ? "#a78bfa" : "#60a5fa";
    const candidateCardBg =
      typeFilter === "L2"
        ? "rgba(167,139,250,0.08)"
        : "rgba(96,165,250,0.08)";
    const candidateCardBorder =
      typeFilter === "L2"
        ? "1px solid rgba(167,139,250,0.2)"
        : "1px solid rgba(96,165,250,0.2)";

    const driveCandidatesRaw = candidates.filter((c) => {
      const matchesDrive = selectedDrive
        ? c.collegeDrive?.toLowerCase() ===
          selectedDrive.collegeName.toLowerCase()
        : true;
      const matchesCollegeFilter =
        collegeFilter !== "all"
          ? c.collegeDrive?.toLowerCase() === collegeFilter.toLowerCase()
          : true;
      const matchesDateFilter =
        dateFilter !== "all" ? c.preferredDate === dateFilter : true;
      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "L1" &&
          (!c.outcomeStatus || c.outcomeStatus === "PENDING")) ||
        (typeFilter === "L2" && c.outcomeStatus === "PASSED_L1");
      return (
        matchesDrive && matchesCollegeFilter && matchesDateFilter && matchesType
      );
    });

    const mappedEmails = new Set(
      interviews
        .filter((i) => {
          const matchesType =
            typeFilter === "all" ||
            i.role.toLowerCase().includes(typeFilter.toLowerCase());
          const isAssigned =
            i.candidateName !== "Pending Assignment" &&
            i.candidateEmail !== "pending@assign.com";
          return matchesType && isAssigned;
        })
        .map((i) => i.candidateEmail.toLowerCase()),
    );

    const uniqueDriveCandidates = deduplicateCandidates(driveCandidatesRaw);

    const driveCandidatesCount = uniqueDriveCandidates.length;
    const driveMapped = uniqueDriveCandidates.filter(
      (c) => c.status === "MAPPED" || mappedEmails.has(c.email.toLowerCase()),
    ).length;
    const drivePending = uniqueDriveCandidates.filter(
      (c) => c.status !== "MAPPED" && !mappedEmails.has(c.email.toLowerCase()),
    ).length;

    const getInterviewsForMetrics = (): Interview[] => {
      let filtered = interviews.filter((i) => {
        const info = getInterviewInfo(i.role);
        return activeHiringTab === "LATERAL" ? info.isLateral : info.isCampus;
      });

      if (selectedDrive && activeHiringTab === "CAMPUS") {
        filtered = filtered.filter((i) =>
          interviewInDriveWindow(i, selectedDrive, candidates),
        );
      }

      if (typeFilter !== "all") {
        filtered = filtered.filter((i) =>
          i.role.toLowerCase().includes(typeFilter.toLowerCase()),
        );
      }

      if (dateFilter !== "all") {
        filtered = filtered.filter((i) => {
          if (i.status === "SCHEDULED" && i.scheduledSlotStart) {
            return i.scheduledSlotStart.split("T")[0] === dateFilter;
          }
          const startD = i.startDate.split("T")[0];
          const endD = i.endDate.split("T")[0];
          return dateFilter >= startD && dateFilter <= endD;
        });
      }

      if (collegeFilter !== "all") {
        filtered = filtered.filter((i) => {
          const candidate = candidates.find(
            (c) => c.email.toLowerCase() === i.candidateEmail.toLowerCase(),
          );
          if (candidate) {
            return (
              candidate.collegeDrive &&
              candidate.collegeDrive.toLowerCase() ===
                collegeFilter.toLowerCase()
            );
          }
          return i.role.toLowerCase().includes(collegeFilter.toLowerCase());
        });
      }

      return filtered;
    };

    const interviewsForMetricsList = getInterviewsForMetrics();

    const drivePanels = interviewsForMetricsList.flatMap((i) =>
      i.panels.map((p) => ({
        ...p,
        candidateName: i.candidateName,
        role: i.role,
        interviewStatus: i.status,
        scheduledSlotStart: i.scheduledSlotStart,
        scheduledSlotEnd: i.scheduledSlotEnd,
        interviewDuration: i.duration,
      })),
    );

    const uniqueDrivePanels = deduplicatePanels(drivePanels);

    const drivePanelistsRequested = uniqueDrivePanels.length;
    const drivePanelistsReplied = uniqueDrivePanels.filter(
      (p) => p.status === "SUBMITTED",
    ).length;
    const drivePanelistsRejected = uniqueDrivePanels.filter(
      (p) => p.status === "REJECTED",
    ).length;
    const drivePanelistsPending = uniqueDrivePanels.filter(
      (p) => p.status === "PENDING",
    ).length;

    const totalSlotsGiven = uniqueDrivePanels
      .filter((p) => p.status === "SUBMITTED")
      .reduce((sum, p) => sum + (p.givenSlots?.length || 0), 0);

    const drivePassed = drivePanels.filter(
      (p) => p.decision === "PASSED",
    ).length;
    const driveRejected = drivePanels.filter(
      (p) => p.decision === "REJECTED",
    ).length;

    const getOverallInterviewsForAnalytics = (): Interview[] => {
      let filtered = interviews.filter((i) => {
        const info = getInterviewInfo(i.role);
        return activeHiringTab === "LATERAL" ? info.isLateral : info.isCampus;
      });

      if (selectedDrive && activeHiringTab === "CAMPUS") {
        filtered = filtered.filter((i) =>
          interviewInDriveWindow(i, selectedDrive, candidates),
        );
      }

      if (dateFilter !== "all") {
        filtered = filtered.filter((i) => {
          if (i.status === "SCHEDULED" && i.scheduledSlotStart) {
            return i.scheduledSlotStart.split("T")[0] === dateFilter;
          }
          const startD = i.startDate.split("T")[0];
          const endD = i.endDate.split("T")[0];
          return dateFilter >= startD && dateFilter <= endD;
        });
      }

      if (collegeFilter !== "all") {
        filtered = filtered.filter((i) => {
          const candidate = candidates.find(
            (c) => c.email.toLowerCase() === i.candidateEmail.toLowerCase(),
          );
          if (candidate) {
            return (
              candidate.collegeDrive &&
              candidate.collegeDrive.toLowerCase() ===
                collegeFilter.toLowerCase()
            );
          }
          return i.role.toLowerCase().includes(collegeFilter.toLowerCase());
        });
      }

      return filtered;
    };

    const overallInterviewsForAnalytics = getOverallInterviewsForAnalytics();

    const l1Filtered = overallInterviewsForAnalytics.filter(
      (i) => getInterviewInfo(i.role).isL1,
    );
    const l2Filtered = overallInterviewsForAnalytics.filter(
      (i) => getInterviewInfo(i.role).isL2,
    );

    const mappedL1Emails = new Set(
      interviews
        .filter(
          (i) =>
            getInterviewInfo(i.role).isL1 &&
            i.candidateName !== "Pending Assignment" &&
            i.candidateEmail !== "pending@assign.com",
        )
        .map((i) => i.candidateEmail.toLowerCase()),
    );

    const mappedL2Emails = new Set(
      interviews
        .filter(
          (i) =>
            i.role.toLowerCase().includes("l2") &&
            i.candidateName !== "Pending Assignment" &&
            i.candidateEmail !== "pending@assign.com",
        )
        .map((i) => i.candidateEmail.toLowerCase()),
    );

    const getCandidatesForBreakdown = (): UploadedCandidate[] => {
      const rawList = candidates.filter((c) => {
        const matchesDrive = selectedDrive
          ? c.collegeDrive?.toLowerCase() ===
            selectedDrive.collegeName.toLowerCase()
          : true;
        const matchesCollegeFilter =
          collegeFilter !== "all"
            ? c.collegeDrive?.toLowerCase() === collegeFilter.toLowerCase()
            : true;
        const matchesDateFilter =
          dateFilter !== "all" ? c.preferredDate === dateFilter : true;
        return matchesDrive && matchesCollegeFilter && matchesDateFilter;
      });

      return deduplicateCandidates(rawList);
    };

    const breakdownCandidates = getCandidatesForBreakdown();

    const l1Scheduled = l1Filtered.filter(
      (i) => i.status === "SCHEDULED",
    ).length;
    const l1Collected = l1Filtered.filter(
      (i) => i.status === "COLLECTED",
    ).length;
    const l1Pending = l1Filtered.filter((i) => i.status === "PENDING").length;
    const l1CandidatesPending = breakdownCandidates.filter((c) => {
      const isWaiting =
        c.status === "WAITING" && !mappedL1Emails.has(c.email.toLowerCase());
      const isL1 = !c.outcomeStatus || c.outcomeStatus === "PENDING";
      return isWaiting && isL1;
    }).length;

    const l2Scheduled = l2Filtered.filter(
      (i) => i.status === "SCHEDULED",
    ).length;
    const l2Collected = l2Filtered.filter(
      (i) => i.status === "COLLECTED",
    ).length;
    const l2Pending = l2Filtered.filter((i) => i.status === "PENDING").length;
    const l2CandidatesPending = breakdownCandidates.filter((c) => {
      const isWaiting =
        c.status === "WAITING" && !mappedL2Emails.has(c.email.toLowerCase());
      const isL2 = c.outcomeStatus === "PASSED_L1";
      return isWaiting && isL2;
    }).length;

    const l1Panels = l1Filtered.flatMap((i) => i.panels);
    const l1PanelsRequested = l1Panels.length;
    const l1PanelsReplied = l1Panels.filter(
      (p) => p.status === "SUBMITTED",
    ).length;

    const l2Panels = l2Filtered.flatMap((i) => i.panels);
    const l2PanelsRequested = l2Panels.length;
    const l2PanelsReplied = l2Panels.filter(
      (p) => p.status === "SUBMITTED",
    ).length;

    return {
      candidateCardTitle,
      candidateCardColor,
      candidateCardBg,
      candidateCardBorder,
      driveCandidatesCount,
      driveMapped,
      drivePending,
      drivePanelistsRequested,
      drivePanelistsReplied,
      drivePanelistsRejected,
      drivePanelistsPending,
      totalSlotsGiven,
      drivePassed,
      driveRejected,
      uniqueDrivePanels,
      l1Scheduled,
      l1Collected,
      l1Pending,
      l1CandidatesPending,
      l1PanelsRequested,
      l1PanelsReplied,
      l2Scheduled,
      l2Collected,
      l2Pending,
      l2CandidatesPending,
      l2PanelsRequested,
      l2PanelsReplied,
      drivePanels,
      l1Filtered,
      l2Filtered,
    };
  }, [
    interviews,
    candidates,
    selectedDrive,
    activeHiringTab,
    typeFilter,
    collegeFilter,
    dateFilter,
  ]);
}
