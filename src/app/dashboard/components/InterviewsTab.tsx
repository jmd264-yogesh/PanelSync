"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  Calendar,
  User,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Loader2,
  Trash2,
  Video,
  Check,
  Info,
  CalendarCheck,
  ListFilter,
  MessageSquare,
  Bell,
  Send,
  X,
  TrendingUp,
  AlertCircle,
  Compass,
} from "lucide-react";
import {
  Interview,
  Panelist,
  UploadedCandidate,
  InterviewPanel,
  College,
  Drive,
} from "@/lib/db";
import { GraphUser } from "@/lib/graph";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getInterviewInfo } from "@/lib/interview-role";

interface InterviewsTabProps {
  interviews: Interview[];
  setInterviews: React.Dispatch<React.SetStateAction<Interview[]>>;
  panelists: Panelist[];
  candidates: UploadedCandidate[];
  setCandidates: React.Dispatch<React.SetStateAction<UploadedCandidate[]>>;
  todayStr: string;
  collegesList: College[];
  drives: Drive[];
  activeDrive: Drive | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function renderStarsStatic(rating: number) {
  return (
    <div style={{ display: "flex", gap: "2px" }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          style={{
            color: star <= rating ? "#fbbf24" : "rgba(255,255,255,0.12)",
            fontSize: "1rem",
            lineHeight: 1,
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function parseFeedbackSafely(rawFeedback: string | null | undefined) {
  if (!rawFeedback) return null;
  if (rawFeedback.trim().startsWith("{")) {
    try {
      return JSON.parse(rawFeedback);
    } catch (e) {
      return null;
    }
  }
  return null;
}

function getOverlappingSlots(
  interview: Interview,
): { start: string; end: string }[] {
  const panels = interview.panels;
  if (!panels || panels.length === 0) return [];
  const activePanels = panels.filter((p) => p.status === "SUBMITTED");
  if (activePanels.length === 0) return [];

  const duration = interview.duration;
  const limitStart = new Date(interview.startDate);
  const limitEnd = new Date(interview.endDate);
  const intervalMin = 15;
  const chunkMs = intervalMin * 60 * 1000;
  const durationMs = duration * 60 * 1000;
  const startMs = limitStart.getTime();
  const endMs = limitEnd.getTime();
  const matches: { start: string; end: string }[] = [];

  for (let time = startMs; time + durationMs <= endMs; time += chunkMs) {
    const slotStart = new Date(time);
    const slotEnd = new Date(time + durationMs);
    const allAvailable = activePanels.every((panel) =>
      panel.availabilities.some((avail) => {
        const aS = new Date(avail.startTime).getTime();
        const aE = new Date(avail.endTime).getTime();
        return aS <= slotStart.getTime() && aE >= slotEnd.getTime();
      }),
    );
    if (allAvailable)
      matches.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
      });
  }

  return matches.filter((slot, idx) => {
    if (idx === 0) return true;
    const prev = matches[idx - 1];
    return (
      new Date(slot.start).getTime() - new Date(prev.start).getTime() >=
      30 * 60 * 1000
    );
  });
}

export default function InterviewsTab({
  interviews,
  setInterviews,
  panelists,
  candidates,
  setCandidates,
  todayStr,
  collegesList,
  drives,
  activeDrive,
}: InterviewsTabProps) {
  // ── UI States ─────────────────────────────────────────────────────────────
  const [activeHiringTab, setActiveHiringTab] = useState<"CAMPUS" | "LATERAL">("CAMPUS");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "PENDING" | "COLLECTED" | "SCHEDULED"
  >("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "L1" | "L2">("all");
  const [collegeFilter, setCollegeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterThisWeek, setFilterThisWeek] = useState(false);
  // Drive the dashboard scopes to. Defaults to the active drive, but the recruiter
  // can switch to any other drive here without changing the global active drive.
  const [selectedDriveId, setSelectedDriveId] = useState<string>(
    activeDrive?.id ?? "all",
  );
  const didInitDrive = useRef(false);
  const [showRepliedModal, setShowRepliedModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(
    null,
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInterviewModal, setShowInterviewModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<
    "overview" | "panels" | "booking" | "feedback"
  >("overview");

  // ── Create Interview Form States ───────────────────────────────────────────
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [role, setRole] = useState("");
  const [duration, setDuration] = useState("45");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [interviewType, setInterviewType] = useState<"L1" | "L2" | "General">(
    "L1",
  );
  const [selectedPanels, setSelectedPanels] = useState<GraphUser[]>([]);
  const [panelSearchQuery, setPanelSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GraphUser[]>([]);
  const [isSearchingPanels, setIsSearchingPanels] = useState(false);

  // ── Booking States ─────────────────────────────────────────────────────────
  const [selectedSlot, setSelectedSlot] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [bookingDescription, setBookingDescription] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);
  const [resendingPanelId, setResendingPanelId] = useState<string | null>(null);
  const [sendingFeedbackReminderId, setSendingFeedbackReminderId] = useState<
    string | null
  >(null);

  // ── Date Edit States ───────────────────────────────────────────────────────
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [isUpdatingDates, setIsUpdatingDates] = useState(false);
  const [selectedInterviewForConfig, setSelectedInterviewForConfig] =
    useState<Interview | null>(null);

  // ── Derived Values ────────────────────────────────────────────────────────

  const allNominations = interviews.flatMap((interview) =>
    interview.panels.map((p) => ({ ...p, interview })),
  );
  const respondedNominations = allNominations.filter(
    (n) => n.status === "SUBMITTED",
  );
  const pendingInterviews = interviews.filter((i) => i.status === "PENDING");

  const recommendedPanelists = panelists.filter((p) => {
    if (interviewType === "General") return true;
    return p.roles.includes(interviewType as "L1" | "L2");
  });

  const activePanelistInterviewCount = (panelistId: string) =>
    interviews.filter(
      (i) =>
        (i.status === "PENDING" || i.status === "COLLECTED") &&
        i.panels.some((p) => p.userId === panelistId),
    ).length;

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedInterview) {
      const updated = interviews.find((i) => i.id === selectedInterview.id);
      setSelectedInterview(updated || null);
    }
    if (selectedInterviewForConfig) {
      const updated = interviews.find(
        (i) => i.id === selectedInterviewForConfig.id,
      );
      setSelectedInterviewForConfig(updated || null);
    }
  }, [interviews]);

  // On first load, default the dashboard's selected drive to the active drive.
  useEffect(() => {
    if (!didInitDrive.current && activeDrive) {
      setSelectedDriveId(activeDrive.id);
      didInitDrive.current = true;
    }
  }, [activeDrive]);

  // When the selected drive changes, scope the college filter and create-form
  // default dates to that drive (a range spanning start → end).
  useEffect(() => {
    const drive = drives.find((d) => d.id === selectedDriveId) ?? null;
    if (drive) {
      setCollegeFilter(drive.collegeName);
      setStartDate(drive.startDate);
      setEndDate(drive.endDate);
      setDateFilter(drive.startDate);
    } else {
      setCollegeFilter("all");
      setDateFilter("all");
    }
  }, [selectedDriveId, drives]);

  useEffect(() => {
    if (panelSearchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingPanels(true);
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(panelSearchQuery)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(
            data.filter(
              (u: GraphUser) => !selectedPanels.some((sp) => sp.id === u.id),
            ),
          );
        }
      } catch (err) {
        console.error("Error searching panels:", err);
      } finally {
        setIsSearchingPanels(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [panelSearchQuery, selectedPanels]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddPanel = (user: GraphUser) => {
    if (!selectedPanels.some((p) => p.id === user.id)) {
      setSelectedPanels([...selectedPanels, user]);
    }
    setPanelSearchQuery("");
    setSearchResults([]);
  };

  const handleToggleRecommendedPanelist = (p: Panelist) => {
    const isChosen = selectedPanels.some((sp) => sp.id === p.id);
    if (isChosen) {
      setSelectedPanels(selectedPanels.filter((sp) => sp.id !== p.id));
    } else {
      setSelectedPanels([
        ...selectedPanels,
        {
          id: p.id,
          displayName: p.displayName,
          mail: p.email,
          userPrincipalName: p.email,
        },
      ]);
    }
  };

  const handleRemovePanel = (userId: string) => {
    setSelectedPanels(selectedPanels.filter((p) => p.id !== userId));
  };

  const handleCreateInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!candidateName.trim()) {
      setCreateError("Please select a candidate from the queue.");
      return;
    }
    if (!role.trim()) {
      setCreateError("Please enter the job title / focus area.");
      return;
    }
    if (!startDate) {
      setCreateError("Please select a proposed range start date.");
      return;
    }
    if (!endDate) {
      setCreateError("Please select a proposed range end date.");
      return;
    }
    if (startDate < todayStr) {
      setCreateError("Start date cannot be in the past.");
      return;
    }
    if (endDate < startDate) {
      setCreateError("End date cannot be before the start date.");
      return;
    }
    if (selectedPanels.length === 0) {
      setCreateError("Please select at least one panel member.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/interviews/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName,
          candidateEmail,
          role: `${interviewType} - ${role}`,
          duration: parseInt(duration, 10),
          startDate,
          endDate,
          panels: selectedPanels,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(
          errData.error || "Failed to submit interview invitation.",
        );
      }
      const result = await res.json();
      setInterviews([result.interview, ...interviews]);
      setCandidateName("");
      setCandidateEmail("");
      setRole("");
      setDuration("45");
      setStartDate("");
      setEndDate("");
      setSelectedPanels([]);
      setInterviewType("L1");
      setShowCreateForm(false);
      setCreateError(null);
      setSelectedInterview(result.interview);
      setShowInterviewModal(true);
      setDetailTab("overview");
    } catch (error: any) {
      console.error(error);
      setCreateError(error.message || "An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteInterview = async (id: string) => {
    try {
      const res = await fetch(`/api/interviews/${id}`, { method: "DELETE" });
      if (res.ok) {
        setInterviews(interviews.filter((i) => i.id !== id));
        if (selectedInterview?.id === id) setSelectedInterview(null);
        toast.success("Interview record deleted.");
      } else {
        toast.error("Failed to delete interview");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBookSlot = async () => {
    if (!selectedInterview || !selectedSlot) return;
    setIsBooking(true);
    try {
      const res = await fetch("/api/interviews/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId: selectedInterview.id,
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
          description: bookingDescription,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to book meeting");
      }
      setInterviews(
        interviews.map((i) =>
          i.id === selectedInterview.id
            ? {
                ...i,
                status: "SCHEDULED" as const,
                scheduledSlotStart: selectedSlot.start,
                scheduledSlotEnd: selectedSlot.end,
              }
            : i,
        ),
      );
      setSelectedSlot(null);
      setBookingDescription("");
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error scheduling meeting");
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!selectedInterview) return;
    setIsCancellingBooking(true);
    try {
      const res = await fetch("/api/interviews/cancel-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId: selectedInterview.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to cancel booking");
      }
      const data = await res.json();
      setInterviews(
        interviews.map((i) =>
          i.id === selectedInterview.id ? data.interview : i,
        ),
      );
      setSelectedInterview(data.interview);
      toast.success(
        "Successfully cancelled meeting and removed scheduled slot.",
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error cancelling meeting");
    } finally {
      setIsCancellingBooking(false);
    }
  };

  const handleResendInvite = async (interviewId: string, panelId: string) => {
    setResendingPanelId(panelId);
    try {
      const res = await fetch("/api/interviews/resend-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId, panelId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to resend invitation");
      }
      toast.success("Successfully resent Teams notification reminder!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error resending invitation");
    } finally {
      setResendingPanelId(null);
    }
  };

  const handleUpdateDates = async (
    e: React.FormEvent,
    targetInterviewOverride?: Interview,
  ) => {
    if (e) e.preventDefault();
    const target = targetInterviewOverride || selectedInterview;
    if (!target) return;
    if (editStartDate < todayStr) {
      toast.error("Start date cannot be in the past.");
      return;
    }
    if (editEndDate < editStartDate) {
      toast.error("End date cannot be before the start date.");
      return;
    }
    setIsUpdatingDates(true);
    try {
      const info = getInterviewInfo(target.role);

      let type: "L1" | "L2" | "General" = "General";

      if (info.isL1) {
        type = "L1";
      } else if (info.isL2) {
        type = "L2";
      }
      const [startH, startM] = (type === "L2" ? "14:00" : "10:00")
        .split(":")
        .map(Number);
      const [endH, endM] = (type === "L2" ? "17:00" : "13:00")
        .split(":")
        .map(Number);
      const generatedSlots: { startTime: string; endTime: string }[] = [];
      const currentDay = new Date(editStartDate);
      const endDay = new Date(editEndDate);
      while (currentDay <= endDay) {
        const year = currentDay.getFullYear();
        const month = currentDay.getMonth();
        const date = currentDay.getDate();
        const dayStart = new Date(year, month, date, startH, startM, 0);
        const dayEnd = new Date(year, month, date, endH, endM, 0);
        let time = dayStart.getTime();
        while (time + 30 * 60 * 1000 <= dayEnd.getTime()) {
          generatedSlots.push({
            startTime: new Date(time).toISOString(),
            endTime: new Date(time + 30 * 60 * 1000).toISOString(),
          });
          time += 30 * 60 * 1000;
        }
        currentDay.setDate(currentDay.getDate() + 1);
      }
      const res = await fetch(`/api/interviews/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: editStartDate,
          endDate: editEndDate,
          slots: generatedSlots,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update interview dates.");
      }
      const data = await res.json();
      setInterviews(
        interviews.map((i) => (i.id === target.id ? data.interview : i)),
      );
      if (targetInterviewOverride) {
        setSelectedInterviewForConfig(data.interview);
      } else {
        setSelectedInterview(data.interview);
        setIsEditingDates(false);
      }
      toast.success(
        "Successfully updated interview date range and reset proposed availability slots.",
      );
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error updating dates");
    } finally {
      setIsUpdatingDates(false);
    }
  };

  const handleSendFeedbackReminder = async (
    interviewId: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setSendingFeedbackReminderId(interviewId);
    try {
      const res = await fetch("/api/interviews/send-feedback-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reminder");
      const sentCount = data.sent?.length ?? 0;
      const skippedCount = data.skipped?.length ?? 0;
      toast.success(
        `Feedback reminder sent to ${sentCount} panelist${sentCount !== 1 ? "s" : ""}${skippedCount > 0 ? ` (${skippedCount} skipped — same user)` : ""}.`,
      );
    } catch (err: any) {
      toast.error(`Failed to send reminder: ${err.message}`);
    } finally {
      setSendingFeedbackReminderId(null);
    }
  };

  const handleExportCSV = () => {
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
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((val) => `"${val.replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `interviews_export_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Interviews exported successfully.");
  };

  // ── Filtering Logic ───────────────────────────────────────────────────────
  const selectedDrive =
    selectedDriveId === "all"
      ? null
      : (drives.find((d) => d.id === selectedDriveId) ?? null);

  /** True when an interview falls inside the selected drive's date window. */
  const interviewInDriveWindow = (i: Interview, drive: Drive) => {
    // Verify college matches
    const candidate = candidates.find(
      (c) => c.email.toLowerCase() === i.candidateEmail.toLowerCase(),
    );
    if (candidate) {
      if (
        !candidate.collegeDrive ||
        candidate.collegeDrive.toLowerCase() !== drive.collegeName.toLowerCase()
      ) {
        return false;
      }
    } else {
      // For Pending Assignment: check if the college name is in the role
      if (!i.role.toLowerCase().includes(drive.collegeName.toLowerCase())) {
        return false;
      }
    }

    const ds = drive.startDate;
    const de = drive.endDate;
    if (i.status === "SCHEDULED" && i.scheduledSlotStart) {
      const d = i.scheduledSlotStart.split("T")[0];
      return d >= ds && d <= de;
    }
    // Otherwise treat the interview's proposed window as overlapping the drive window.
    const iS = i.startDate.split("T")[0];
    const iE = i.endDate.split("T")[0];
    return iS <= de && iE >= ds;
  };

  const getFilteredInterviews = () => {
    let filtered = interviews.filter((i) => {
      const info = getInterviewInfo(i.role);
      return activeHiringTab === "LATERAL" ? info.isLateral : info.isCampus;
    });
    if (selectedDrive && activeHiringTab === "CAMPUS") {
      filtered = filtered.filter((i) =>
        interviewInDriveWindow(i, selectedDrive),
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

    if (
      activeHiringTab === "CAMPUS" &&
      collegeFilter !== "all"
    ) {
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

  const filteredInterviewsList = getFilteredInterviews();

  // ── Drive Metrics ─────────────────────────────────────────────────────────
  const candidateCardTitle =
    typeFilter === "all" ? "Candidates" : `${typeFilter} Candidates`;

  // Filter candidates matching the current dashboard scopes (drive, college, date, type)
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

  // Dynamic set of candidate emails mapped to active interviews of the current role/type
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

  // Deduplicate candidates by email to avoid counting duplicates in metrics, prioritizing keeping 'MAPPED' status
  const uniqueDriveCandidatesMap = new Map<string, UploadedCandidate>();
  for (const c of driveCandidatesRaw) {
    const emailKey = c.email.toLowerCase();
    const existing = uniqueDriveCandidatesMap.get(emailKey);
    if (!existing || c.status === "MAPPED") {
      uniqueDriveCandidatesMap.set(emailKey, c);
    }
  }
  const uniqueDriveCandidates = Array.from(uniqueDriveCandidatesMap.values());

  const driveCandidatesCount = uniqueDriveCandidates.length;
  const driveMapped = uniqueDriveCandidates.filter(
    (c) => c.status === "MAPPED" || mappedEmails.has(c.email.toLowerCase()),
  ).length;
  const drivePending = uniqueDriveCandidates.filter(
    (c) => c.status !== "MAPPED" && !mappedEmails.has(c.email.toLowerCase()),
  ).length;

  const candidateCardColor = typeFilter === "L2" ? "#a78bfa" : "#60a5fa";
  const candidateCardBg =
    typeFilter === "L2" ? "rgba(167,139,250,0.08)" : "rgba(96,165,250,0.08)";
  const candidateCardBorder =
    typeFilter === "L2"
      ? "1px solid rgba(167,139,250,0.2)"
      : "1px solid rgba(96,165,250,0.2)";

  // Filter interviews matching current dashboard scopes (drive, type, date, college), independent of statusFilter
  const getInterviewsForMetrics = () => {
    let filtered = interviews.filter((i) => {
      const info = getInterviewInfo(i.role);

      return activeHiringTab === "CAMPUS" ? info.isCampus : info.isLateral;
    });

    if (selectedDrive && activeHiringTab === "CAMPUS") {
      filtered = filtered.filter((i) =>
        interviewInDriveWindow(i, selectedDrive),
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
            candidate.collegeDrive.toLowerCase() === collegeFilter.toLowerCase()
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

  // Deduplicate drive panels by panelist email for requested/replied/rejected/pending slot request metrics,
  // accumulating candidate names, roles, and given slot timings for clear display.
  const getUniqueDrivePanels = (panelsList: typeof drivePanels) => {
    const panelsMap = new Map<
      string,
      (typeof drivePanels)[0] & {
        candidateNames: string[];
        roles: string[];
        givenSlots: { startTime: string; endTime: string }[];
      }
    >();

    for (const p of panelsList) {
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

        // Accumulate given slots (avoiding duplicates)
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

        // Resolve status: prioritize SUBMITTED, then REJECTED, then PENDING
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
  };

  const uniqueDrivePanels = getUniqueDrivePanels(drivePanels);

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

  const drivePassed = drivePanels.filter((p) => p.decision === "PASSED").length;
  const driveRejected = drivePanels.filter(
    (p) => p.decision === "REJECTED",
  ).length;

  // ── Cohort Analytics (L1 & L2 breakdown, reacting to the selected drive + college/date filters) ──────────────
  const getOverallInterviewsForAnalytics = () => {
    let filtered = interviews.filter((i) => {
      const info = getInterviewInfo(i.role);

      return activeHiringTab === "CAMPUS" ? info.isCampus : info.isLateral;
    });

    if (selectedDrive && activeHiringTab === "CAMPUS") {
      filtered = filtered.filter((i) =>
        interviewInDriveWindow(i, selectedDrive),
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
            candidate.collegeDrive.toLowerCase() === collegeFilter.toLowerCase()
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

  // Find mapped emails for L1 and L2 separately
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

  const getCandidatesForBreakdown = () => {
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

    const map = new Map<string, UploadedCandidate>();
    for (const c of rawList) {
      const emailKey = c.email.toLowerCase();
      const existing = map.get(emailKey);
      if (!existing || c.status === "MAPPED") {
        map.set(emailKey, c);
      }
    }
    return Array.from(map.values());
  };

  const breakdownCandidates = getCandidatesForBreakdown();

  const l1Scheduled = l1Filtered.filter((i) => i.status === "SCHEDULED").length;
  const l1Collected = l1Filtered.filter((i) => i.status === "COLLECTED").length;
  const l1Pending = l1Filtered.filter((i) => i.status === "PENDING").length;
  const l1CandidatesPending = breakdownCandidates.filter((c) => {
    const isWaiting =
      c.status === "WAITING" && !mappedL1Emails.has(c.email.toLowerCase());
    const isL1 = !c.outcomeStatus || c.outcomeStatus === "PENDING";
    return isWaiting && isL1;
  }).length;

  const l2Scheduled = l2Filtered.filter((i) => i.status === "SCHEDULED").length;
  const l2Collected = l2Filtered.filter((i) => i.status === "COLLECTED").length;
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

  // console.log("STATS_DEBUG:", {
  //   typeFilter,
  //   statusFilter,
  //   dateFilter,
  //   collegeFilter,
  //   overallLength: overallInterviewsForAnalytics.length,
  //   filteredLength: filteredInterviewsList.length,
  //   l1Scheduled,
  //   l2Scheduled,
  //   l1Pending,
  //   l2Pending,
  // });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header section */}
      <header
        className="dashboard-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <button
              type="button"
              className={`btn ${activeHiringTab === "CAMPUS" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveHiringTab("CAMPUS")}
            >
              Campus Hiring
            </button>
            <button
              type="button"
              className={`btn ${activeHiringTab === "LATERAL" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveHiringTab("LATERAL")}
            >
              Lateral Hiring
            </button>
          </div>
          <h1 className="page-title">Interview Dashboard</h1>
          <p className="page-subtitle">
            Overview of L1 and L2 interviews, panelist responses, and scheduling
            status.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCSV}
          >
            Export
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setShowCreateForm(!showCreateForm);
              setSelectedInterview(null);
            }}
          >
            <Plus size={16} /> Schedule Interview
          </button>
        </div>
      </header>

      {/* Drive Selector Banner */}
      {activeHiringTab === "CAMPUS" && (
        <section className="drive-banner">
          <span className="drive-banner-label">
            <Compass size={16} /> Viewing Drive
          </span>
          <select
            className="drive-select"
            value={selectedDriveId}
            onChange={(e) => setSelectedDriveId(e.target.value || "all")}
          >
            <option value="all">All Drives</option>
            {drives.map((d) => (
              <option key={d.id} value={d.id}>
                {d.collegeName}
                {d.status === "CLOSED" ? " (Closed)" : ""}
              </option>
            ))}
          </select>
          {selectedDrive ? (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
              }}
            >
              <Clock size={13} style={{ color: "var(--info)" }} />
              <span>
                {selectedDrive.startDate === selectedDrive.endDate
                  ? new Date(selectedDrive.startDate).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" },
                    )
                  : `${new Date(selectedDrive.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(selectedDrive.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
              </span>
              {selectedDrive.status === "CLOSED" && (
                <span
                  className="badge badge-danger"
                  style={{ fontSize: "10px" }}
                >
                  Closed
                </span>
              )}
              {activeDrive?.id === selectedDrive.id && (
                <span
                  className="badge badge-success"
                  style={{ fontSize: "10px" }}
                >
                  Active
                </span>
              )}
            </span>
          ) : (
            <span style={{ fontSize: "13px" }}>
              Showing interviews across all drives.
            </span>
          )}
        </section>
      )}

      {/* Filter Toolbar */}
      <section className="filter-toolbar">
        <div className="filter-chip-group">
          <button
            type="button"
            className={`filter-chip ${typeFilter === "all" && statusFilter === "all" && !filterThisWeek ? "active" : ""}`}
            onClick={() => {
              setTypeFilter("all");
              setStatusFilter("all");
              setFilterThisWeek(false);
            }}
          >
            All
          </button>
          <button
            type="button"
            className={`filter-chip ${typeFilter === "L1" ? "active" : ""}`}
            onClick={() => setTypeFilter(typeFilter === "L1" ? "all" : "L1")}
          >
            L1 Round
          </button>
          <button
            type="button"
            className={`filter-chip ${typeFilter === "L2" ? "active" : ""}`}
            onClick={() => setTypeFilter(typeFilter === "L2" ? "all" : "L2")}
          >
            L2 Round
          </button>
          <button
            type="button"
            className={`filter-chip ${statusFilter === "PENDING" ? "active" : ""}`}
            onClick={() =>
              setStatusFilter(statusFilter === "PENDING" ? "all" : "PENDING")
            }
          >
            Pending
          </button>
          <button
            type="button"
            className={`filter-chip ${statusFilter === "SCHEDULED" ? "active" : ""}`}
            onClick={() =>
              setStatusFilter(
                statusFilter === "SCHEDULED" ? "all" : "SCHEDULED",
              )
            }
          >
            Completed
          </button>
          <button
            type="button"
            className={`filter-chip ${filterThisWeek ? "active" : ""}`}
            onClick={() => setFilterThisWeek(!filterThisWeek)}
          >
            This Week
          </button>
        </div>

        <div className="filter-control-group">
          {activeHiringTab === "CAMPUS" && (
            <select
              className="filter-select"
              value={collegeFilter}
              onChange={(e) => setCollegeFilter(e.target.value || "all")}
            >
              <option value="all">All Colleges</option>
              {collegesList.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <input
            className="filter-date"
            type="date"
            value={dateFilter === "all" ? "" : dateFilter}
            onChange={(e) => setDateFilter(e.target.value || "all")}
            style={{ colorScheme: "dark" }}
          />

          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--fg-muted)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Search size={14} />
            </span>
            <input
              className="search-input"
              type="search"
              placeholder="Search candidates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: "32px" }}
            />
          </div>
        </div>
      </section>

      {/* Metric Cards Grid */}
      <section className="metric-grid">
        {/* Card 1: Candidates Mapped */}
        <article className="metric-card">
          <div>
            <div className="metric-card-header">
              <div className="metric-label">Candidates Mapped</div>
              <div className="metric-icon success">👥</div>
            </div>
            <div className="metric-value">
              {driveMapped} / {driveCandidatesCount}
            </div>
            <div className="metric-subtext">
              {drivePending === 0
                ? "All candidates assigned"
                : `${drivePending} pending`}
            </div>
          </div>
          <div className="progress">
            <div
              className="progress-fill success"
              style={{
                width:
                  driveCandidatesCount > 0
                    ? `${(driveMapped / driveCandidatesCount) * 100}%`
                    : "0%",
              }}
            />
          </div>
        </article>

        {/* Card 2: Panel Requests */}
        <article
          className="metric-card"
          style={{ cursor: "pointer" }}
          onClick={() => setShowRepliedModal(true)}
        >
          <div>
            <div className="metric-card-header">
              <div className="metric-label">Panel Requests</div>
              <div className="metric-icon info">✉</div>
            </div>
            <div className="metric-value">{drivePanelistsRequested}</div>
            <div className="metric-subtext">
              {drivePanelistsReplied} accepted &bull; {drivePanelistsPending}{" "}
              pending &bull; {drivePanelistsRejected} declined
            </div>
          </div>
          <div className="progress">
            <div
              className="progress-fill info"
              style={{
                width:
                  drivePanelistsRequested > 0
                    ? `${(drivePanelistsReplied / drivePanelistsRequested) * 100}%`
                    : "0%",
              }}
            />
          </div>
        </article>

        {/* Card 3: L1/L2 Results */}
        <article
          className="metric-card active"
          style={{ cursor: "pointer" }}
          onClick={() => setShowFeedbackModal(true)}
        >
          <div>
            <div className="metric-card-header">
              <div className="metric-label">
                {typeFilter === "all"
                  ? "Interview Results"
                  : `${typeFilter} Results`}
              </div>
              <div className="metric-icon success">✓</div>
            </div>
            <div className="metric-value">{drivePassed} Passed</div>
            <div className="metric-subtext">
              {driveRejected} rejected &bull;{" "}
              {
                drivePanels.filter(
                  (p) => p.status === "SUBMITTED" && !p.decision,
                ).length
              }{" "}
              pending
            </div>
          </div>
          {/* Segmented progress bar */}
          {(() => {
            const resultsPending = drivePanels.filter(
              (p) => p.status === "SUBMITTED" && !p.decision,
            ).length;
            const total = drivePassed + driveRejected + resultsPending;
            const passedPct = total > 0 ? (drivePassed / total) * 100 : 0;
            const rejectedPct = total > 0 ? (driveRejected / total) * 100 : 0;
            const pendingPct = total > 0 ? (resultsPending / total) * 100 : 0;

            return (
              <div className="segmented-progress">
                <span
                  className="segment success"
                  style={{ width: `${passedPct}%` }}
                />
                <span
                  className="segment danger"
                  style={{ width: `${rejectedPct}%` }}
                />
                <span
                  className="segment warning"
                  style={{ width: `${pendingPct}%` }}
                />
              </div>
            );
          })()}
        </article>
      </section>

      {/* Main Content Grid Layout */}
      <div className="dashboard-content-grid">
        {/* Left Column: Interview Cards List */}
        <section>
          <div className="section-header">
            <h2 className="section-title">Upcoming Interviews</h2>
            <span className="count-badge">{filteredInterviewsList.length}</span>
          </div>

          <div className="interview-list">
            {(() => {
              const panelRequestsList = filteredInterviewsList.flatMap<{
                key: string;
                interview: Interview;
                panel: InterviewPanel | null;
              }>((interview) => {
                if (interview.candidateName !== "Pending Assignment") {
                  return [
                    {
                      key: `${interview.id}-mapped`,
                      interview,
                      panel: null,
                    },
                  ];
                }
                if (interview.panels.length === 0) {
                  return [
                    {
                      key: `${interview.id}-unassigned`,
                      interview,
                      panel: null,
                    },
                  ];
                }
                return interview.panels.map((p) => ({
                  key: `${interview.id}-${p.id}`,
                  interview,
                  panel: p,
                }));
              });

              if (panelRequestsList.length === 0) {
                return (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "3rem 2rem",
                      background: "var(--bg-elevated)",
                      borderRadius: "18px",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <CalendarCheck
                      size={48}
                      style={{
                        color: "var(--fg-muted)",
                        margin: "0 auto 1rem",
                        opacity: 0.5,
                      }}
                    />
                    <h4 style={{ marginBottom: "0.5rem", color: "var(--fg)" }}>
                      No Interviews Found
                    </h4>
                    <p
                      style={{
                        color: "var(--fg-secondary)",
                        fontSize: "0.85rem",
                      }}
                    >
                      Create a new interview or adjust your filters.
                    </p>
                  </div>
                );
              }

              return panelRequestsList.map(({ key, interview, panel }) => {
                const isSelected = selectedInterview?.id === interview.id;
                const { isLateral, isL1, isL2 } = getInterviewInfo(
                  interview.role,
                );
                const initials =
                  interview.candidateName === "Pending Assignment"
                    ? "?"
                    : interview.candidateName
                        .split(" ")
                        .map((w: string) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase();

                let statusClass = "pending";
                if (interview.status === "SCHEDULED") {
                  statusClass = "confirmed";
                } else if (interview.status === "COLLECTED") {
                  statusClass = "confirmed";
                }

                let timeStr = "TBD";
                let dateStr = "No range set";
                if (interview.scheduledSlotStart) {
                  const start = new Date(interview.scheduledSlotStart);
                  timeStr = start.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  dateStr = start.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                } else {
                  const start = new Date(interview.startDate);
                  const end = new Date(interview.endDate);
                  dateStr = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
                }

                return (
                  <article
                    key={key}
                    className={`interview-card ${isSelected ? "active" : ""}`}
                    onClick={() => {
                      setSelectedInterview(interview);
                      setShowInterviewModal(true);
                    }}
                    style={
                      isSelected
                        ? {
                            borderColor: "var(--accent)",
                            boxShadow: "var(--shadow-sm)",
                          }
                        : {}
                    }
                  >
                    <div className="candidate-avatar">{initials}</div>

                    <div>
                      <div className="candidate-name">
                        {interview.candidateName}
                      </div>
                      <div className="candidate-meta">
                        {interview.role.split("-").pop()?.trim()}
                        <span className="round-badge">
                          {isL2 ? "L2 Round" : "L1 Round"}
                        </span>
                      </div>

                      <div
                        className="panelist-line"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                          marginTop: "4px",
                        }}
                      >
                        {interview.candidateName !== "Pending Assignment" ? (
                          (() => {
                            const activePanels =
                              interview.status === "SCHEDULED" ||
                              interview.status === "COLLECTED"
                                ? interview.panels.filter(
                                    (p) => p.status === "SUBMITTED",
                                  )
                                : interview.panels;
                            const panelsToRender =
                              activePanels.length > 0
                                ? activePanels
                                : interview.panels;
                            if (panelsToRender.length === 0)
                              return <span>Awaiting assignment</span>;
                            return panelsToRender.map((p) => {
                              const feedbackText = p.decision
                                ? `Feedback: ${p.decision}`
                                : "Feedback: Pending";
                              const badgeStyle =
                                p.decision === "PASSED"
                                  ? {
                                      background: "var(--accent-light)",
                                      color: "var(--accent)",
                                    }
                                  : p.decision === "REJECTED"
                                    ? {
                                        background: "var(--danger-light)",
                                        color: "var(--danger)",
                                      }
                                    : {
                                        background: "var(--warning-light)",
                                        color: "var(--warning)",
                                      };

                              return (
                                <div
                                  key={p.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <span style={{ fontWeight: 500 }}>
                                    {p.name}
                                  </span>
                                  {interview.status === "SCHEDULED" && (
                                    <span
                                      className="round-badge"
                                      style={{
                                        ...badgeStyle,
                                        fontSize: "10px",
                                        padding: "1px 6px",
                                        lineHeight: 1,
                                      }}
                                    >
                                      {feedbackText}
                                    </span>
                                  )}
                                </div>
                              );
                            });
                          })()
                        ) : panel ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <span style={{ fontWeight: 500 }}>
                              {panel.name}
                            </span>
                            {interview.status === "SCHEDULED" && (
                              <span
                                className="round-badge"
                                style={{
                                  background:
                                    panel.decision === "PASSED"
                                      ? "var(--accent-light)"
                                      : panel.decision === "REJECTED"
                                        ? "var(--danger-light)"
                                        : "var(--warning-light)",
                                  color:
                                    panel.decision === "PASSED"
                                      ? "var(--accent)"
                                      : panel.decision === "REJECTED"
                                        ? "var(--danger)"
                                        : "var(--warning)",
                                  fontSize: "10px",
                                  padding: "1px 6px",
                                  lineHeight: 1,
                                }}
                              >
                                {panel.decision
                                  ? `Feedback: ${panel.decision}`
                                  : "Feedback: Pending"}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span>Awaiting assignment</span>
                        )}
                      </div>
                    </div>

                    <div className="interview-time">
                      <span className={`status-dot ${statusClass}`} />
                      {timeStr}
                      <br />
                      <span>{dateStr}</span>
                    </div>
                  </article>
                );
              });
            })()}
          </div>
        </section>

        {/* Right Column: Analytics Card & Details Panel */}
        <section
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          {/* Analytics Cohort breakdown */}
          <aside className="analytics-card">
            <div className="analytics-header">
              <div className="analytics-title">
                <TrendingUp size={18} /> Analytics Overview
              </div>
              <button type="button" className="analytics-period">
                Last 7 days
              </button>
            </div>

            {(() => {
              const l1Passed = l1Filtered.filter((i) =>
                i.panels.some((p) => p.decision === "PASSED"),
              ).length;
              const l1Rejected = l1Filtered.filter((i) =>
                i.panels.some((p) => p.decision === "REJECTED"),
              ).length;
              const l1FeedbackPending = l1Filtered.filter((i) =>
                i.panels.some((p) => p.status === "SUBMITTED" && !p.decision),
              ).length;
              const l1SchedulingPending = l1Filtered.filter(
                (i) => i.status !== "SCHEDULED",
              ).length;
              const l1PendingTotal = l1FeedbackPending + l1SchedulingPending;
              const l1TotalResults = l1Passed + l1Rejected + l1PendingTotal;

              const l1PassedPct =
                l1TotalResults > 0
                  ? Math.round((l1Passed / l1TotalResults) * 100)
                  : 0;
              const l1RejectedPct =
                l1TotalResults > 0
                  ? Math.round((l1Rejected / l1TotalResults) * 100)
                  : 0;
              const l1PendingPct =
                l1TotalResults > 0
                  ? Math.round((l1PendingTotal / l1TotalResults) * 100)
                  : 0;

              const l2Passed = l2Filtered.filter((i) =>
                i.panels.some((p) => p.decision === "PASSED"),
              ).length;
              const l2Rejected = l2Filtered.filter((i) =>
                i.panels.some((p) => p.decision === "REJECTED"),
              ).length;
              const l2FeedbackPending = l2Filtered.filter((i) =>
                i.panels.some((p) => p.status === "SUBMITTED" && !p.decision),
              ).length;
              const l2SchedulingPending = l2Filtered.filter(
                (i) => i.status !== "SCHEDULED",
              ).length;
              const l2PendingTotal = l2FeedbackPending + l2SchedulingPending;
              const l2TotalResults = l2Passed + l2Rejected + l2PendingTotal;

              const l2PassedPct =
                l2TotalResults > 0
                  ? Math.round((l2Passed / l2TotalResults) * 100)
                  : 0;
              const l2RejectedPct =
                l2TotalResults > 0
                  ? Math.round((l2Rejected / l2TotalResults) * 100)
                  : 0;
              const l2PendingPct =
                l2TotalResults > 0
                  ? Math.round((l2PendingTotal / l2TotalResults) * 100)
                  : 0;

              return (
                <>
                  {/* L1 Cohort */}
                  <div className="cohort-group">
                    <div
                      className="cohort-title"
                      style={{ color: "var(--info)" }}
                    >
                      L1 Cohort
                    </div>

                    <div className="analytics-row">
                      <div className="analytics-row-header">
                        <span className="analytics-row-label">Passed</span>
                        <span className="analytics-row-value">
                          {l1PassedPct}% &bull; {l1Passed}
                        </span>
                      </div>
                      <div className="analytics-bar">
                        <div
                          className="analytics-bar-fill success"
                          style={{ width: `${l1PassedPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="analytics-row">
                      <div className="analytics-row-header">
                        <span className="analytics-row-label">Rejected</span>
                        <span className="analytics-row-value">
                          {l1RejectedPct}% &bull; {l1Rejected}
                        </span>
                      </div>
                      <div className="analytics-bar">
                        <div
                          className="analytics-bar-fill danger"
                          style={{ width: `${l1RejectedPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="analytics-row">
                      <div className="analytics-row-header">
                        <span className="analytics-row-label">Pending</span>
                        <span className="analytics-row-value">
                          {l1PendingPct}% &bull; {l1PendingTotal}
                        </span>
                      </div>
                      <div className="analytics-bar">
                        <div
                          className="analytics-bar-fill warning"
                          style={{ width: `${l1PendingPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* L2 Cohort */}
                  <div className="cohort-group">
                    <div
                      className="cohort-title"
                      style={{ color: "var(--accent)" }}
                    >
                      L2 Cohort
                    </div>

                    <div className="analytics-row">
                      <div className="analytics-row-header">
                        <span className="analytics-row-label">Passed</span>
                        <span className="analytics-row-value">
                          {l2PassedPct}% &bull; {l2Passed}
                        </span>
                      </div>
                      <div className="analytics-bar">
                        <div
                          className="analytics-bar-fill success"
                          style={{ width: `${l2PassedPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="analytics-row">
                      <div className="analytics-row-header">
                        <span className="analytics-row-label">Rejected</span>
                        <span className="analytics-row-value">
                          {l2RejectedPct}% &bull; {l2Rejected}
                        </span>
                      </div>
                      <div className="analytics-bar">
                        <div
                          className="analytics-bar-fill danger"
                          style={{ width: `${l2RejectedPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="analytics-row">
                      <div className="analytics-row-header">
                        <span className="analytics-row-label">Pending</span>
                        <span className="analytics-row-value">
                          {l2PendingPct}% &bull; {l2PendingTotal}
                        </span>
                      </div>
                      <div className="analytics-bar">
                        <div
                          className="analytics-bar-fill warning"
                          style={{ width: `${l2PendingPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </aside>

          {/* Form or Info Block details */}
          {showCreateForm ? (
            <div
              style={{
                padding: "16px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "18px",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    margin: 0,
                    color: "var(--fg)",
                  }}
                >
                  Create New Interview
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--fg-secondary)",
                    cursor: "pointer",
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <form
                onSubmit={handleCreateInterview}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <input
                  className="filter-select"
                  type="text"
                  placeholder="Candidate Name"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  style={{
                    borderRadius: "10px",
                    height: "40px",
                    width: "100%",
                  }}
                />
                <input
                  className="filter-select"
                  type="email"
                  placeholder="Email"
                  value={candidateEmail}
                  onChange={(e) => setCandidateEmail(e.target.value)}
                  style={{
                    borderRadius: "10px",
                    height: "40px",
                    width: "100%",
                  }}
                />
                <input
                  className="filter-select"
                  type="text"
                  placeholder="Job Title / Focus Area"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={{
                    borderRadius: "10px",
                    height: "40px",
                    width: "100%",
                  }}
                />

                <Select
                  value={interviewType}
                  onValueChange={(val) => setInterviewType(val as any)}
                >
                  <SelectTrigger
                    className="w-full text-left"
                    style={{
                      background: "var(--input-bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                      color: "inherit",
                      fontSize: "13px",
                      height: "40px",
                    }}
                  >
                    <SelectValue placeholder="Select Interview Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L1">L1 Interview</SelectItem>
                    <SelectItem value="L2">L2 Interview</SelectItem>
                    <SelectItem value="General">General Interview</SelectItem>
                  </SelectContent>
                </Select>

                <input
                  className="filter-select"
                  type="number"
                  min="15"
                  max="180"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  style={{
                    borderRadius: "10px",
                    height: "40px",
                    width: "100%",
                  }}
                  placeholder="Duration (mins)"
                />

                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    className="filter-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{
                      flex: 1,
                      height: "40px",
                      borderRadius: "10px",
                      width: "100%",
                    }}
                  />
                  <input
                    className="filter-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      flex: 1,
                      height: "40px",
                      borderRadius: "10px",
                      width: "100%",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--fg-secondary)",
                    }}
                  >
                    Panel Members
                  </label>

                  {selectedPanels.length > 0 && (
                    <div
                      style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}
                    >
                      {selectedPanels.map((p) => (
                        <span
                          key={p.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            background: "var(--surface-muted)",
                            border: "1px solid var(--border)",
                            borderRadius: "999px",
                            padding: "4px 10px",
                            fontSize: "12px",
                            color: "var(--fg)",
                          }}
                        >
                          {p.displayName}
                          <button
                            type="button"
                            onClick={() => handleRemovePanel(p.id)}
                            aria-label={`Remove ${p.displayName}`}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--fg-secondary)",
                              cursor: "pointer",
                              display: "flex",
                              padding: 0,
                            }}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ position: "relative" }}>
                    <input
                      className="filter-select"
                      type="text"
                      placeholder="Search directory by name or email..."
                      value={panelSearchQuery}
                      onChange={(e) => setPanelSearchQuery(e.target.value)}
                      style={{
                        borderRadius: "10px",
                        height: "40px",
                        width: "100%",
                      }}
                    />
                    {panelSearchQuery.trim().length >= 2 && (
                      <div
                        style={{
                          position: "absolute",
                          top: "44px",
                          left: 0,
                          right: 0,
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border)",
                          borderRadius: "10px",
                          maxHeight: "160px",
                          overflowY: "auto",
                          zIndex: 10,
                          boxShadow: "var(--shadow-sm)",
                        }}
                      >
                        {isSearchingPanels ? (
                          <div
                            style={{
                              padding: "10px",
                              fontSize: "12px",
                              color: "var(--fg-secondary)",
                            }}
                          >
                            Searching...
                          </div>
                        ) : searchResults.length === 0 ? (
                          <div
                            style={{
                              padding: "10px",
                              fontSize: "12px",
                              color: "var(--fg-secondary)",
                            }}
                          >
                            No matches found.
                          </div>
                        ) : (
                          searchResults.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => handleAddPanel(u)}
                              style={{
                                display: "block",
                                width: "100%",
                                textAlign: "left",
                                padding: "8px 12px",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "13px",
                                color: "var(--fg)",
                              }}
                            >
                              {u.displayName}{" "}
                              <span
                                style={{
                                  color: "var(--fg-secondary)",
                                  fontSize: "11px",
                                }}
                              >
                                ({u.mail || u.userPrincipalName})
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {recommendedPanelists.length > 0 && (
                    <div
                      style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}
                    >
                      {recommendedPanelists.map((p) => {
                        const isChosen = selectedPanels.some(
                          (sp) => sp.id === p.id,
                        );
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleToggleRecommendedPanelist(p)}
                            aria-pressed={isChosen}
                            style={{
                              fontSize: "11px",
                              padding: "4px 10px",
                              borderRadius: "999px",
                              border: isChosen
                                ? "1px solid var(--accent)"
                                : "1px solid var(--border)",
                              background: isChosen
                                ? "var(--accent-light)"
                                : "var(--surface-muted)",
                              color: isChosen
                                ? "var(--accent)"
                                : "var(--fg-secondary)",
                              cursor: "pointer",
                            }}
                          >
                            {p.displayName}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {createError && (
                  <p
                    style={{
                      color: "var(--danger)",
                      fontSize: "12px",
                      margin: 0,
                    }}
                  >
                    {createError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn btn-primary"
                  style={{ width: "100%", marginTop: "8px" }}
                >
                  {isLoading ? "Creating..." : "Create Interview"}
                </button>
              </form>
            </div>
          ) : selectedInterview ? (
            <div
              style={{
                padding: "16px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "18px",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--fg)",
                  marginBottom: "14px",
                }}
              >
                Selected Interview
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  marginBottom: "18px",
                }}
              >
                <div>
                  <strong
                    style={{
                      display: "block",
                      fontSize: "11px",
                      color: "var(--fg-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Candidate
                  </strong>
                  <span
                    style={{
                      fontSize: "15px",
                      color: "var(--fg)",
                      fontWeight: 600,
                    }}
                  >
                    {selectedInterview.candidateName}
                  </span>
                </div>
                <div>
                  <strong
                    style={{
                      display: "block",
                      fontSize: "11px",
                      color: "var(--fg-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Role
                  </strong>
                  <span
                    style={{ fontSize: "14px", color: "var(--fg-secondary)" }}
                  >
                    {selectedInterview.role}
                  </span>
                </div>
                <div>
                  <strong
                    style={{
                      display: "block",
                      fontSize: "11px",
                      color: "var(--fg-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Status
                  </strong>
                  <span style={{ fontSize: "14px", color: "var(--fg)" }}>
                    {selectedInterview.status}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: "100%" }}
                onClick={() => setShowInterviewModal(true)}
              >
                View Interview Details
              </button>
            </div>
          ) : (
            <div
              style={{
                padding: "32px 24px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "18px",
                textAlign: "center",
                color: "var(--fg-secondary)",
              }}
            >
              <Calendar
                size={32}
                style={{
                  color: "var(--fg-muted)",
                  margin: "0 auto 12px",
                  opacity: 0.5,
                }}
              />
              <p style={{ fontSize: "13px", margin: 0 }}>
                Select an interview from the list to view details
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Interview Detail Modal */}
      {showInterviewModal && selectedInterview && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "18px",
              width: "90%",
              maxWidth: "900px",
              maxHeight: "90vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "var(--shadow-md)",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  margin: 0,
                  color: "var(--fg)",
                }}
              >
                {selectedInterview.candidateName}
              </h2>
              <button
                type="button"
                onClick={() => setShowInterviewModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--fg-secondary)",
                  cursor: "pointer",
                }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "20px",
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "var(--fg-secondary)",
                      textTransform: "uppercase",
                      margin: "0 0 4px 0",
                    }}
                  >
                    Role
                  </p>
                  <p
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      margin: 0,
                      color: "var(--fg)",
                    }}
                  >
                    {selectedInterview.role}
                  </p>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "var(--fg-secondary)",
                      textTransform: "uppercase",
                      margin: "0 0 4px 0",
                    }}
                  >
                    Status
                  </p>
                  <div>
                    {selectedInterview.status === "PENDING" && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "4px 8px",
                          background: "var(--warning-light)",
                          border: "1px solid var(--warning)",
                          borderRadius: "4px",
                          color: "var(--warning)",
                        }}
                      >
                        Awaiting Panels
                      </span>
                    )}
                    {selectedInterview.status === "COLLECTED" && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "4px 8px",
                          background: "var(--info-light)",
                          border: "1px solid var(--info)",
                          borderRadius: "4px",
                          color: "var(--info)",
                        }}
                      >
                        Ready to Book
                      </span>
                    )}
                    {selectedInterview.status === "SCHEDULED" && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "4px 8px",
                          background: "var(--accent-light)",
                          border: "1px solid var(--accent)",
                          borderRadius: "4px",
                          color: "var(--accent)",
                        }}
                      >
                        Scheduled
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "var(--fg-secondary)",
                      textTransform: "uppercase",
                      margin: "0 0 4px 0",
                    }}
                  >
                    Feedback Outcome
                  </p>
                  <div>
                    {(() => {
                      const passedCount = selectedInterview.panels.filter(
                        (p) => p.decision === "PASSED",
                      ).length;
                      const rejectedCount = selectedInterview.panels.filter(
                        (p) => p.decision === "REJECTED",
                      ).length;
                      const pendingCount = selectedInterview.panels.filter(
                        (p) => !p.decision,
                      ).length;

                      if (selectedInterview.status !== "SCHEDULED") {
                        return (
                          <span
                            style={{
                              color: "var(--fg-secondary)",
                              fontSize: "13px",
                            }}
                          >
                            Not scheduled
                          </span>
                        );
                      }

                      if (pendingCount === 0) {
                        return (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "4px 8px",
                              background:
                                rejectedCount > 0
                                  ? "var(--danger-light)"
                                  : "var(--accent-light)",
                              border:
                                rejectedCount > 0
                                  ? "1px solid var(--danger)"
                                  : "1px solid var(--accent)",
                              borderRadius: "4px",
                              color:
                                rejectedCount > 0
                                  ? "var(--danger)"
                                  : "var(--accent)",
                            }}
                          >
                            {rejectedCount > 0 ? "REJECTED" : "PASSED"} (
                            {passedCount} Passed, {rejectedCount} Rejected)
                          </span>
                        );
                      }

                      return (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "4px 8px",
                            background: "var(--warning-light)",
                            border: "1px solid var(--warning)",
                            borderRadius: "4px",
                            color: "var(--warning)",
                          }}
                        >
                          PENDING ({passedCount} P, {rejectedCount} R,{" "}
                          {pendingCount} Pending)
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Panels Section */}
              <div
                style={{
                  padding: "16px",
                  background: "var(--surface-muted)",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                }}
              >
                <h3
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    margin: "0 0 12px 0",
                    color: "var(--fg)",
                  }}
                >
                  {selectedInterview.status === "SCHEDULED"
                    ? "Panelist"
                    : "Panel Members"}
                </h3>
                {(() => {
                  const panelsToDisplay =
                    selectedInterview.status === "SCHEDULED" ||
                    selectedInterview.status === "COLLECTED"
                      ? selectedInterview.panels.filter(
                          (p) => p.status === "SUBMITTED",
                        )
                      : selectedInterview.panels;
                  const finalPanels =
                    panelsToDisplay.length > 0
                      ? panelsToDisplay
                      : selectedInterview.panels;

                  if (finalPanels.length === 0) {
                    return (
                      <p
                        style={{
                          fontSize: "13px",
                          color: "var(--fg-secondary)",
                          margin: 0,
                        }}
                      >
                        No panels assigned
                      </p>
                    );
                  }

                  return (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      {finalPanels.map((p) => (
                        <div
                          key={p.id}
                          style={{
                            padding: "12px",
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border)",
                            borderRadius: "10px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              width: "100%",
                            }}
                          >
                            <div>
                              <p
                                style={{
                                  fontSize: "14px",
                                  fontWeight: 600,
                                  margin: "0 0 2px 0",
                                  color: "var(--fg)",
                                }}
                              >
                                {p.name}
                              </p>
                              <p
                                style={{
                                  fontSize: "12px",
                                  color: "var(--fg-secondary)",
                                  margin: 0,
                                }}
                              >
                                Status:{" "}
                                {p.status === "SUBMITTED"
                                  ? "✓ Responded"
                                  : "Pending"}
                              </p>
                            </div>

                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                alignItems: "center",
                              }}
                            >
                              {selectedInterview.status === "SCHEDULED" &&
                                p.status === "SUBMITTED" &&
                                !p.decision && (
                                  <button
                                    type="button"
                                    onClick={(e) =>
                                      handleSendFeedbackReminder(
                                        selectedInterview.id,
                                        e,
                                      )
                                    }
                                    disabled={
                                      sendingFeedbackReminderId ===
                                      selectedInterview.id
                                    }
                                    className="btn btn-secondary"
                                    style={{
                                      height: "32px",
                                      fontSize: "12px",
                                      padding: "0 12px",
                                    }}
                                  >
                                    {sendingFeedbackReminderId ===
                                    selectedInterview.id
                                      ? "Sending..."
                                      : "Send Reminder"}
                                  </button>
                                )}

                              {p.status === "PENDING" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleResendInvite(
                                      selectedInterview.id,
                                      p.id,
                                    )
                                  }
                                  disabled={resendingPanelId === p.id}
                                  className="btn btn-secondary"
                                  style={{
                                    height: "32px",
                                    fontSize: "12px",
                                    padding: "0 12px",
                                  }}
                                >
                                  {resendingPanelId === p.id
                                    ? "Resending..."
                                    : "Resend"}
                                </button>
                              )}
                            </div>
                          </div>

                          {selectedInterview.status === "SCHEDULED" && (
                            <div
                              style={{
                                marginTop: "4px",
                                paddingTop: "8px",
                                borderTop: "1px solid var(--border)",
                                width: "100%",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  gap: "8px",
                                  alignItems: "center",
                                  marginBottom: p.decision ? "8px" : "0",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "12px",
                                    color: "var(--fg-secondary)",
                                    fontWeight: 600,
                                  }}
                                >
                                  Decision:
                                </span>
                                <span
                                  style={{
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                    background:
                                      p.decision === "PASSED"
                                        ? "var(--accent-light)"
                                        : p.decision === "REJECTED"
                                          ? "var(--danger-light)"
                                          : "var(--warning-light)",
                                    border:
                                      p.decision === "PASSED"
                                        ? "1px solid var(--accent)"
                                        : p.decision === "REJECTED"
                                          ? "1px solid var(--danger)"
                                          : "1px solid var(--warning)",
                                    borderRadius: "4px",
                                    color:
                                      p.decision === "PASSED"
                                        ? "var(--accent)"
                                        : p.decision === "REJECTED"
                                          ? "var(--danger)"
                                          : "var(--warning)",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  {p.decision || "PENDING"}
                                </span>
                              </div>

                              {p.feedback &&
                                (() => {
                                  try {
                                    const parsed = JSON.parse(p.feedback);
                                    const scores = parsed.scores || {};
                                    const notes = parsed.notes || {};

                                    return (
                                      <div
                                        style={{
                                          fontSize: "13px",
                                          color: "var(--fg)",
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "8px",
                                        }}
                                      >
                                        {Object.keys(scores).length > 0 && (
                                          <div
                                            style={{
                                              display: "grid",
                                              gridTemplateColumns:
                                                "repeat(auto-fit, minmax(120px, 1fr))",
                                              gap: "8px",
                                              background:
                                                "var(--surface-muted)",
                                              padding: "8px",
                                              borderRadius: "8px",
                                              border: "1px solid var(--border)",
                                            }}
                                          >
                                            {Object.entries(scores).map(
                                              ([metric, score]) => (
                                                <div
                                                  key={metric}
                                                  style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                  }}
                                                >
                                                  <span
                                                    style={{
                                                      fontSize: "11px",
                                                      color:
                                                        "var(--fg-secondary)",
                                                      textTransform:
                                                        "capitalize",
                                                    }}
                                                  >
                                                    {metric}
                                                  </span>
                                                  <span
                                                    style={{
                                                      fontSize: "13px",
                                                      fontWeight: 700,
                                                      color: "var(--info)",
                                                    }}
                                                  >
                                                    {String(score)} / 5
                                                  </span>
                                                </div>
                                              ),
                                            )}
                                          </div>
                                        )}

                                        <div
                                          style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "6px",
                                            background: "var(--surface-muted)",
                                            padding: "10px",
                                            borderRadius: "8px",
                                          }}
                                        >
                                          {Object.entries(notes).map(
                                            ([key, val]) => {
                                              if (!val) return null;
                                              const label = key
                                                .replace(/([A-Z])/g, " $1")
                                                .replace(/^./, (str) =>
                                                  str.toUpperCase(),
                                                );
                                              return (
                                                <div
                                                  key={key}
                                                  style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    gap: "2px",
                                                  }}
                                                >
                                                  <span
                                                    style={{
                                                      fontSize: "11px",
                                                      color:
                                                        "var(--fg-secondary)",
                                                      fontWeight: 600,
                                                    }}
                                                  >
                                                    {label}:
                                                  </span>
                                                  <span
                                                    style={{
                                                      fontSize: "13px",
                                                      whiteSpace: "pre-wrap",
                                                    }}
                                                  >
                                                    {String(val)}
                                                  </span>
                                                </div>
                                              );
                                            },
                                          )}

                                          {Object.keys(notes).length === 0 &&
                                            parsed.comments && (
                                              <div
                                                style={{
                                                  display: "flex",
                                                  flexDirection: "column",
                                                  gap: "2px",
                                                }}
                                              >
                                                <span
                                                  style={{
                                                    fontSize: "11px",
                                                    color:
                                                      "var(--fg-secondary)",
                                                    fontWeight: 600,
                                                  }}
                                                >
                                                  Comments:
                                                </span>
                                                <span
                                                  style={{
                                                    fontSize: "13px",
                                                    whiteSpace: "pre-wrap",
                                                  }}
                                                >
                                                  {String(parsed.comments)}
                                                </span>
                                              </div>
                                            )}
                                        </div>
                                      </div>
                                    );
                                  } catch (e) {
                                    return (
                                      <p
                                        style={{
                                          fontSize: "13px",
                                          color: "var(--fg)",
                                          margin: 0,
                                          whiteSpace: "pre-wrap",
                                          background: "var(--surface-muted)",
                                          padding: "10px",
                                          borderRadius: "8px",
                                          border: "1px solid var(--border)",
                                        }}
                                      >
                                        {p.feedback}
                                      </p>
                                    );
                                  }
                                })()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Actions */}
              {selectedInterview.status === "COLLECTED" &&
                detailTab !== "booking" && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSlot(null);
                      setBookingDescription("");
                      setDetailTab("booking");
                    }}
                    className="btn btn-primary"
                    style={{ width: "100%", height: "42px" }}
                  >
                    Book Meeting
                  </button>
                )}

              {selectedInterview.status === "COLLECTED" &&
                detailTab === "booking" &&
                (() => {
                  const overlaps = getOverlappingSlots(selectedInterview);
                  return (
                    <div
                      style={{
                        padding: "16px",
                        background: "var(--surface-muted)",
                        borderRadius: "12px",
                        border: "1px solid var(--border)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <h3
                          style={{
                            fontSize: "14px",
                            fontWeight: 700,
                            margin: 0,
                            color: "var(--fg)",
                          }}
                        >
                          Pick a Slot to Book
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            setDetailTab("overview");
                            setSelectedSlot(null);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--fg-secondary)",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          Cancel
                        </button>
                      </div>

                      {overlaps.length === 0 ? (
                        <p
                          style={{
                            fontSize: "13px",
                            color: "var(--fg-secondary)",
                            margin: 0,
                          }}
                        >
                          No overlapping availability found across the submitted
                          panels for this interview&apos;s date window.
                        </p>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            maxHeight: "220px",
                            overflowY: "auto",
                          }}
                        >
                          {overlaps.map((slot, idx) => {
                            const isSelected =
                              selectedSlot?.start === slot.start &&
                              selectedSlot?.end === slot.end;
                            const start = new Date(slot.start);
                            const end = new Date(slot.end);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedSlot(slot)}
                                aria-pressed={isSelected}
                                style={{
                                  textAlign: "left",
                                  padding: "10px 12px",
                                  borderRadius: "8px",
                                  border: isSelected
                                    ? "2px solid var(--accent)"
                                    : "1px solid var(--border)",
                                  background: isSelected
                                    ? "var(--accent-light)"
                                    : "var(--bg-elevated)",
                                  color: "var(--fg)",
                                  cursor: "pointer",
                                  fontSize: "13px",
                                }}
                              >
                                {start.toLocaleDateString("en-US", {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}{" "}
                                @{" "}
                                {start.toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                -{" "}
                                {end.toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                (IST)
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <input
                        className="filter-select"
                        type="text"
                        placeholder="Meeting description (optional)"
                        value={bookingDescription}
                        onChange={(e) => setBookingDescription(e.target.value)}
                        style={{
                          borderRadius: "10px",
                          height: "40px",
                          width: "100%",
                        }}
                      />

                      <button
                        type="button"
                        onClick={handleBookSlot}
                        disabled={!selectedSlot || isBooking}
                        className="btn btn-primary"
                        style={{ width: "100%", height: "42px" }}
                      >
                        {isBooking ? "Booking..." : "Confirm Booking"}
                      </button>
                    </div>
                  );
                })()}

              {selectedInterview.status === "SCHEDULED" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", gap: "10px" }}>
                    {selectedInterview.teamsMeetingUrl && (
                      <a
                        href={selectedInterview.teamsMeetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                        style={{
                          flex: 1,
                          textDecoration: "none",
                          height: "42px",
                        }}
                      >
                        <Video size={16} /> Join Meeting
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditStartDate(
                          selectedInterview.startDate.split("T")[0],
                        );
                        setEditEndDate(selectedInterview.endDate.split("T")[0]);
                        setIsEditingDates(!isEditingDates);
                      }}
                      className="btn btn-secondary"
                      style={{ flex: 1, height: "42px" }}
                    >
                      {isEditingDates ? "Close Edit" : "Edit Dates"}
                    </button>
                  </div>

                  {isEditingDates && (
                    <form
                      onSubmit={handleUpdateDates}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        padding: "12px",
                        background: "var(--surface-muted)",
                        borderRadius: "10px",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "12px",
                          color: "var(--fg-secondary)",
                          margin: 0,
                        }}
                      >
                        Changing the date range resets all proposed availability
                        slots — panels will need to resubmit.
                      </p>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <input
                          className="filter-date"
                          type="date"
                          value={editStartDate}
                          min={todayStr}
                          onChange={(e) => setEditStartDate(e.target.value)}
                          style={{
                            flex: 1,
                            height: "40px",
                            borderRadius: "10px",
                          }}
                        />
                        <input
                          className="filter-date"
                          type="date"
                          value={editEndDate}
                          min={editStartDate || todayStr}
                          onChange={(e) => setEditEndDate(e.target.value)}
                          style={{
                            flex: 1,
                            height: "40px",
                            borderRadius: "10px",
                          }}
                        />
                      </div>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isUpdatingDates}
                        style={{ height: "40px" }}
                      >
                        {isUpdatingDates
                          ? "Updating..."
                          : "Update Dates & Reset Availability"}
                      </button>
                    </form>
                  )}

                  <ConfirmDialog
                    trigger={
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{
                          width: "100%",
                          height: "42px",
                          color: "var(--danger)",
                          borderColor: "rgba(196, 69, 60, 0.2)",
                        }}
                      >
                        Cancel Booking
                      </button>
                    }
                    title="Cancel this booking?"
                    description="This removes the scheduled Teams meeting and calendar event, and reverts the interview back to Collected so it can be rebooked."
                    confirmLabel="Yes, Cancel Booking"
                    onConfirm={handleCancelBooking}
                  />
                </div>
              )}

              <div
                style={{
                  marginTop: "8px",
                  borderTop: "1px solid var(--border)",
                  paddingTop: "16px",
                }}
              >
                <ConfirmDialog
                  trigger={
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        width: "100%",
                        color: "var(--danger)",
                        borderColor: "rgba(196, 69, 60, 0.2)",
                      }}
                    >
                      <Trash2 size={16} /> Delete Interview
                    </button>
                  }
                  title="Delete this interview?"
                  description="This will soft-delete the interview record and release any mapped candidates. If a Teams meeting was scheduled, the calendar event will also be removed."
                  confirmLabel="Yes, Delete"
                  onConfirm={() => {
                    handleDeleteInterview(selectedInterview.id);
                    setShowInterviewModal(false);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Panelist Availability Status Dialog Box */}
      {showRepliedModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "18px",
              width: "90%",
              maxWidth: "550px",
              maxHeight: "80vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "var(--shadow-md)",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    margin: 0,
                    color: "var(--fg)",
                  }}
                >
                  Panelist Availability Status
                </h3>
                <p
                  style={{
                    color: "var(--fg-secondary)",
                    fontSize: "12px",
                    margin: "4px 0 0 0",
                  }}
                >
                  Detailed response status for the filtered interviews cohort
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRepliedModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--fg-secondary)",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              {/* 1st Priority: Yet to Respond Section */}
              <div>
                <h4
                  style={{
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "var(--warning)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    margin: "0 0 12px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Clock size={14} /> Yet to Respond (
                  {
                    uniqueDrivePanels.filter((p) => p.status === "PENDING")
                      .length
                  }
                  )
                </h4>
                {uniqueDrivePanels.filter((p) => p.status === "PENDING")
                  .length === 0 ? (
                  <p
                    style={{
                      fontSize: "13px",
                      color: "var(--fg-secondary)",
                      margin: 0,
                      paddingLeft: "20px",
                    }}
                  >
                    All panel members have responded.
                  </p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {uniqueDrivePanels
                      .filter((p) => p.status === "PENDING")
                      .map((panel, idx) => (
                        <div
                          key={`${panel.id}-${idx}`}
                          style={{
                            padding: "10px 14px",
                            background: "var(--warning-light)",
                            border: "1px solid rgba(230, 169, 59, 0.2)",
                            borderRadius: "10px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "13px",
                                fontWeight: 600,
                                color: "var(--fg)",
                              }}
                            >
                              {panel.name}
                            </span>
                            <span
                              style={{
                                fontSize: "12px",
                                color: "var(--fg-secondary)",
                              }}
                            >
                              {panel.email}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "var(--fg-secondary)",
                              display: "flex",
                              flexDirection: "column",
                              gap: "2px",
                            }}
                          >
                            <div>
                              Candidate: {panel.candidateNames.join(", ")}
                            </div>
                            <div>Role: {panel.roles.join(", ")}</div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* 2nd Priority: Rejected Section */}
              <div>
                <h4
                  style={{
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "var(--danger)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    margin: "0 0 12px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <XCircle size={14} /> Rejected (
                  {
                    uniqueDrivePanels.filter((p) => p.status === "REJECTED")
                      .length
                  }
                  )
                </h4>
                {uniqueDrivePanels.filter((p) => p.status === "REJECTED")
                  .length === 0 ? (
                  <p
                    style={{
                      fontSize: "13px",
                      color: "var(--fg-secondary)",
                      margin: 0,
                      paddingLeft: "20px",
                    }}
                  >
                    No rejected nominations.
                  </p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {uniqueDrivePanels
                      .filter((p) => p.status === "REJECTED")
                      .map((panel, idx) => (
                        <div
                          key={`${panel.id}-${idx}`}
                          style={{
                            padding: "10px 14px",
                            background: "var(--danger-light)",
                            border: "1px solid rgba(239, 106, 97, 0.2)",
                            borderRadius: "10px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "13px",
                                fontWeight: 600,
                                color: "var(--fg)",
                              }}
                            >
                              {panel.name}
                            </span>
                            <span
                              style={{
                                fontSize: "12px",
                                color: "var(--fg-secondary)",
                              }}
                            >
                              {panel.email}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "var(--fg-secondary)",
                              display: "flex",
                              flexDirection: "column",
                              gap: "2px",
                            }}
                          >
                            <div>
                              Candidate: {panel.candidateNames.join(", ")}
                            </div>
                            <div>Role: {panel.roles.join(", ")}</div>
                          </div>
                          {panel.feedback && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: "var(--danger)",
                                marginTop: "4px",
                                padding: "6px 10px",
                                background: "var(--danger-light)",
                                borderRadius: "4px",
                                borderLeft: "2px solid var(--danger)",
                              }}
                            >
                              <strong>Reason:</strong> {panel.feedback}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* 3rd Priority: Accepted Section */}
              <div>
                <h4
                  style={{
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "var(--accent)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    margin: "0 0 12px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <CheckCircle size={14} /> Accepted (
                  {
                    uniqueDrivePanels.filter((p) => p.status === "SUBMITTED")
                      .length
                  }
                  )
                </h4>
                {uniqueDrivePanels.filter((p) => p.status === "SUBMITTED")
                  .length === 0 ? (
                  <p
                    style={{
                      fontSize: "13px",
                      color: "var(--fg-secondary)",
                      margin: 0,
                      paddingLeft: "20px",
                    }}
                  >
                    No responses yet.
                  </p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {uniqueDrivePanels
                      .filter((p) => p.status === "SUBMITTED")
                      .map((panel, idx) => (
                        <div
                          key={`${panel.id}-${idx}`}
                          style={{
                            padding: "10px 14px",
                            background: "var(--accent-light)",
                            border: "1px solid rgba(32, 185, 151, 0.2)",
                            borderRadius: "10px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "13px",
                                fontWeight: 600,
                                color: "var(--fg)",
                              }}
                            >
                              {panel.name}
                            </span>
                            <span
                              style={{
                                fontSize: "12px",
                                color: "var(--fg-secondary)",
                              }}
                            >
                              {panel.email}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "var(--fg-secondary)",
                              display: "flex",
                              flexDirection: "column",
                              gap: "2px",
                            }}
                          >
                            <div>
                              Candidate: {panel.candidateNames.join(", ")}
                            </div>
                            <div>Role: {panel.roles.join(", ")}</div>
                          </div>
                          {panel.givenSlots && panel.givenSlots.length > 0 && (
                            <div
                              style={{
                                marginTop: "6px",
                                paddingTop: "6px",
                                borderTop: "1px dashed var(--border)",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  color: "var(--accent)",
                                  marginBottom: "4px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                              >
                                <Clock size={11} />
                                Slots Provided ({panel.givenSlots.length}):
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "4px",
                                  paddingLeft: "12px",
                                }}
                              >
                                {panel.givenSlots.map((slot, sIdx) => {
                                  const start = new Date(slot.startTime);
                                  const end = new Date(slot.endTime);
                                  return (
                                    <div
                                      key={sIdx}
                                      style={{
                                        fontSize: "12px",
                                        color: "var(--fg-secondary)",
                                      }}
                                    >
                                      {start.toLocaleDateString("en-US", {
                                        weekday: "short",
                                        month: "short",
                                        day: "numeric",
                                      })}{" "}
                                      &bull;{" "}
                                      <span
                                        style={{
                                          fontWeight: 600,
                                          color: "var(--fg)",
                                        }}
                                      >
                                        {start.toLocaleTimeString("en-US", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}{" "}
                                        -{" "}
                                        {end.toLocaleTimeString("en-US", {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "flex-end",
                background: "var(--surface-muted)",
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowRepliedModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Evaluation Feedback Dialog Box */}
      {showFeedbackModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border)",
              borderRadius: "18px",
              width: "90%",
              maxWidth: "650px",
              maxHeight: "80vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "var(--shadow-md)",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    margin: 0,
                    color: "var(--fg)",
                  }}
                >
                  Candidate Evaluation Feedback
                </h3>
                <p
                  style={{
                    color: "var(--fg-secondary)",
                    fontSize: "12px",
                    margin: "4px 0 0 0",
                  }}
                >
                  Detailed feedback and outcomes from panelists for this cohort
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--fg-secondary)",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              {drivePanels.filter(
                (p) => p.decision === "PASSED" || p.decision === "REJECTED",
              ).length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 16px",
                    color: "var(--fg-secondary)",
                  }}
                >
                  <MessageSquare
                    size={36}
                    style={{ opacity: 0.3, margin: "0 auto 12px" }}
                  />
                  <p style={{ fontSize: "13px", margin: 0 }}>
                    No panelist evaluation feedback has been submitted for this
                    cohort yet.
                  </p>
                </div>
              ) : (
                drivePanels
                  .filter(
                    (p) => p.decision === "PASSED" || p.decision === "REJECTED",
                  )
                  .map((panel, idx) => {
                    const parsed = parseFeedbackSafely(panel.feedback);
                    const isPassed = panel.decision === "PASSED";
                    const outcomeColor = isPassed
                      ? "var(--accent)"
                      : "var(--danger)";
                    const outcomeBg = isPassed
                      ? "var(--accent-light)"
                      : "var(--danger-light)";
                    const outcomeBorder = isPassed
                      ? "1px solid var(--accent)"
                      : "1px solid var(--danger)";

                    return (
                      <div
                        key={`${panel.id}-${idx}`}
                        style={{
                          padding: "16px",
                          background: outcomeBg,
                          border: outcomeBorder,
                          borderRadius: "14px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                            gap: "8px",
                          }}
                        >
                          <div>
                            <h4
                              style={{
                                fontSize: "15px",
                                fontWeight: 700,
                                margin: 0,
                                color: "var(--fg)",
                              }}
                            >
                              {panel.candidateName}
                            </h4>
                            <span
                              style={{
                                fontSize: "12px",
                                color: "var(--fg-secondary)",
                              }}
                            >
                              {panel.role}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 800,
                              padding: "2px 6px",
                              background: `${outcomeColor}15`,
                              border: `1px solid ${outcomeColor}30`,
                              borderRadius: "4px",
                              color: outcomeColor,
                            }}
                          >
                            {isPassed ? "PASSED" : "REJECTED"}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: "13px",
                            borderTop: "1px solid var(--border)",
                            paddingTop: "10px",
                            marginTop: "4px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              color: "var(--fg-secondary)",
                              marginBottom: "8px",
                              fontSize: "12px",
                            }}
                          >
                            <span>
                              Evaluated by: <strong>{panel.name}</strong> (
                              {panel.email})
                            </span>
                          </div>

                          {parsed && parsed.scores && (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                                margin: "8px 0",
                                background: "var(--surface-muted)",
                                padding: "8px",
                                borderRadius: "6px",
                              }}
                            >
                              {Object.entries(parsed.scores).map(
                                ([metric, score]) => {
                                  const displayNames: Record<string, string> = {
                                    coding: "Coding & Problem Solving",
                                    communication: "Technical Communication",
                                    fundamentals: "CS Fundamentals",
                                    systemDesign: "System Design & Scalability",
                                    technicalDepth:
                                      "Technical Depth & Experience",
                                    leadership: "Leadership & Ownership",
                                    culturalFit: "Cultural Fit & MS Values",
                                    technical: "Technical Depth",
                                    collaboration: "Collaboration & Teamwork",
                                  };
                                  return (
                                    <div
                                      key={metric}
                                      style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: "12px",
                                          color: "var(--fg-secondary)",
                                        }}
                                      >
                                        {displayNames[metric] || metric}:
                                      </span>
                                      {renderStarsStatic(score as number)}
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          )}

                          <div style={{ marginTop: "8px" }}>
                            <span
                              style={{
                                fontSize: "11px",
                                color: "var(--fg-secondary)",
                                textTransform: "uppercase",
                                fontWeight: 700,
                                display: "block",
                                marginBottom: "4px",
                              }}
                            >
                              Evaluation Comments
                            </span>
                            <p
                              style={{
                                margin: 0,
                                color: "var(--fg)",
                                fontSize: "13px",
                                lineHeight: 1.45,
                                whiteSpace: "pre-wrap",
                              }}
                            >
                              {parsed
                                ? parsed.comments
                                : panel.feedback || "No comments provided."}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "flex-end",
                background: "var(--surface-muted)",
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowFeedbackModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
