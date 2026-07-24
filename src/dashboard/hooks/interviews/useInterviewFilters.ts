import { useState, useEffect, useRef } from "react";
import {
  Interview,
  UploadedCandidate,
  Drive,
  TInterviewStatus,
} from "@server/lib/db";
import { getInterviewInfo } from "@common/util/interview-role";
import { interviewInDriveWindow } from "@common/util/interviews/filtering";

interface UseInterviewFiltersProps {
  interviews: Interview[];
  candidates: UploadedCandidate[];
  drives: Drive[];
  activeDrive: Drive | null;
  activeHiringTab: "CAMPUS" | "LATERAL";
}

interface UseInterviewFiltersReturn {
  statusFilter: "all" | TInterviewStatus;
  setStatusFilter: React.Dispatch<
    React.SetStateAction<"all" | TInterviewStatus>
  >;
  typeFilter: "all" | "L1" | "L2";
  setTypeFilter: React.Dispatch<React.SetStateAction<"all" | "L1" | "L2">>;
  collegeFilter: string;
  setCollegeFilter: React.Dispatch<React.SetStateAction<string>>;
  dateFilter: string;
  setDateFilter: React.Dispatch<React.SetStateAction<string>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  filterThisWeek: boolean;
  setFilterThisWeek: React.Dispatch<React.SetStateAction<boolean>>;
  selectedDriveId: string;
  setSelectedDriveId: React.Dispatch<React.SetStateAction<string>>;
  selectedDrive: Drive | null;
  filteredInterviews: Interview[];
  resetFilters: () => void;
}

export function useInterviewFilters(
  props: UseInterviewFiltersProps,
): UseInterviewFiltersReturn {
  const { interviews, candidates, drives, activeDrive, activeHiringTab } =
    props;

  const [statusFilter, setStatusFilter] = useState<
    "all" | TInterviewStatus
  >("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "L1" | "L2">("all");
  const [collegeFilter, setCollegeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterThisWeek, setFilterThisWeek] = useState(false);
  const [selectedDriveId, setSelectedDriveId] = useState<string>(
    activeDrive?.id ?? "all",
  );

  const didInitDrive = useRef(false);

  useEffect(() => {
    if (!didInitDrive.current && activeDrive) {
      setSelectedDriveId(activeDrive.id);
      didInitDrive.current = true;
    }
  }, [activeDrive]);

  useEffect(() => {
    const drive = drives.find((d) => d.id === selectedDriveId) ?? null;
    if (drive) {
      setCollegeFilter(drive.collegeName);
      setDateFilter(drive.startDate);
    } else {
      setCollegeFilter("all");
      setDateFilter("all");
    }
  }, [selectedDriveId, drives]);

  const selectedDrive =
    selectedDriveId === "all"
      ? null
      : (drives.find((d) => d.id === selectedDriveId) ?? null);

  const getFilteredInterviews = (): Interview[] => {
    let filtered = interviews.filter((i) => {
      const info = getInterviewInfo(i.role);
      return activeHiringTab === "LATERAL" ? info.isLateral : info.isCampus;
    });
    if (selectedDrive && activeHiringTab === "CAMPUS") {
      filtered = filtered.filter((i) =>
        interviewInDriveWindow(i, selectedDrive, candidates),
      );
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter((i) => i.status === statusFilter);
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

    if (activeHiringTab === "CAMPUS" && collegeFilter !== "all") {
      filtered = filtered.filter((i) => {
        const candidate = candidates.find(
          (c) => c.email.toLowerCase() === i.candidateEmail.toLowerCase(),
        );

        if (candidate) {
          return (
            candidate.collegeDrive &&
            candidate.collegeDrive.toLowerCase() === collegeFilter.toLowerCase()
          );
        }

        return i.role.toLowerCase().includes(collegeFilter.toLowerCase());
      });
    }

    if (filterThisWeek) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      nextWeek.setHours(23, 59, 59, 999);

      filtered = filtered.filter((i) => {
        if (i.status === "SCHEDULED" && i.scheduledSlotStart) {
          const d = new Date(i.scheduledSlotStart);
          return d >= today && d <= nextWeek;
        }
        const startD = new Date(i.startDate);
        const endD = new Date(i.endDate);
        return startD <= nextWeek && endD >= today;
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (i) =>
          i.candidateName.toLowerCase().includes(query) ||
          i.candidateEmail.toLowerCase().includes(query) ||
          i.role.toLowerCase().includes(query),
      );
    }
    return filtered;
  };

  const filteredInterviews = getFilteredInterviews();

  const resetFilters = () => {
    setStatusFilter("all");
    setTypeFilter("all");
    setCollegeFilter("all");
    setDateFilter("all");
    setSearchQuery("");
    setFilterThisWeek(false);
  };

  return {
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    collegeFilter,
    setCollegeFilter,
    dateFilter,
    setDateFilter,
    searchQuery,
    setSearchQuery,
    filterThisWeek,
    setFilterThisWeek,
    selectedDriveId,
    setSelectedDriveId,
    selectedDrive,
    filteredInterviews,
    resetFilters,
  };
}
