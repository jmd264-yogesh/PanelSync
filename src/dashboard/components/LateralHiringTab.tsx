"use client";

import React, { useState } from "react";
import { LateralCandidate, Interview, Panelist } from "@server/lib/db";
import { useLateralCandidates } from "@/dashboard/hooks/lateral/useLateralCandidates";
import { useResumeUpload } from "@/dashboard/hooks/lateral/useResumeUpload";
import { LateralHiringHeader } from "./lateral/LateralHiringHeader";
import { AddLateralCandidateForm } from "./lateral/AddLateralCandidateForm";
import { LateralCandidateEmptyState } from "./lateral/LateralCandidateEmptyState";
import { LateralCandidateTable } from "./lateral/LateralCandidateTable";
import { ScheduleInterviewModal } from "./lateral/ScheduleInterviewModal";
import { RecalibrateReportModal } from "./RecalibrateReportModal";

interface LateralHiringTabProps {
  candidates: LateralCandidate[];
  setCandidates: React.Dispatch<React.SetStateAction<LateralCandidate[]>>;
  interviews: Interview[];
  setInterviews: React.Dispatch<React.SetStateAction<Interview[]>>;
  panelists: Panelist[];
  todayStr: string;
}

export const LateralHiringTab = ({
  candidates,
  setCandidates,
  interviews,
  setInterviews,
  panelists,
  todayStr,
}: LateralHiringTabProps) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewingRecalibrateFor, setViewingRecalibrateFor] = useState<LateralCandidate | null>(null);
  const [schedulingFor, setSchedulingFor] = useState<LateralCandidate | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", email: "", phone: "", positionTitle: "", experienceYears: "",
    currentCompany: "", currentCtc: "", expectedCtc: "", noticePeriodDays: "", source: "", roleGrade: "",
  });

  const { addCandidate, updateCandidateStatus, deleteCandidate, updatingStatusId } =
    useLateralCandidates(candidates, setCandidates);

  const { uploadingId, uploadResume } = useResumeUpload(setCandidates);

  const resetAddForm = () => {
    setForm({
      name: "", email: "", phone: "", positionTitle: "", experienceYears: "",
      currentCompany: "", currentCtc: "", expectedCtc: "", noticePeriodDays: "", source: "", roleGrade: "",
    });
  };

  const handleFormChange = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!form.name.trim() || !form.email.trim() || !form.positionTitle.trim()) {
      setAddError("Name, email, and position are required.");
      return;
    }

    try {
      const candidateData = {
        ...form,
        experienceYears: form.experienceYears ? parseInt(form.experienceYears, 10) : undefined,
        noticePeriodDays: form.noticePeriodDays ? parseInt(form.noticePeriodDays, 10) : undefined,
      };
      await addCandidate(candidateData);
      resetAddForm();
      setShowAddForm(false);
    } catch (err) {
      setAddError((err as Error).message);
    }
  };

  const handleScheduleInterview = async (params: {
    roundLabel: string;
    duration: string;
    startDate: string;
    startTime: string;
    endTime: string;
    selectedPanels: any[];
  }) => {
    if (!schedulingFor) return;

    const res = await fetch("/api/interviews/request-panelist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateName: schedulingFor.name,
        candidateEmail: schedulingFor.email,
        role: `${params.roundLabel.trim()} - ${schedulingFor.positionTitle}`,
        duration: parseInt(params.duration, 10),
        startDate: params.startDate,
        startTime: params.startTime,
        endTime: params.endTime,
        panelists: params.selectedPanels,
        lateralCandidateId: schedulingFor.id,
        hiringType: "LATERAL",
      }),
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Failed to request panel.");

    setCandidates((prev) =>
      prev.map((c) =>
        c.id === schedulingFor.id
          ? { ...c, mappedInterviewId: result.interview.id, status: "WAITING_FOR_INTERVIEW" }
          : c
      )
    );
  };

  return (
    <div>
      <LateralHiringHeader onAddClick={() => setShowAddForm((v) => !v)} />

      {showAddForm && (
        <AddLateralCandidateForm
          form={form}
          isAdding={false}
          addError={addError}
          onFormChange={handleFormChange}
          onSubmit={handleAddCandidate}
          onCancel={() => {
            setShowAddForm(false);
            setAddError(null);
          }}
        />
      )}

      {candidates.length === 0 ? (
        <LateralCandidateEmptyState />
      ) : (
        <LateralCandidateTable
          candidates={candidates}
          interviews={interviews}
          updatingStatusId={updatingStatusId}
          uploadingResumeId={uploadingId}
          onStatusChange={updateCandidateStatus}
          onResumeUpload={uploadResume}
          onScheduleInterview={setSchedulingFor}
          onViewRecalibrate={setViewingRecalibrateFor}
          onDelete={deleteCandidate}
        />
      )}

      {schedulingFor && (
        <ScheduleInterviewModal
          candidate={schedulingFor}
          panelists={panelists}
          todayStr={todayStr}
          onSchedule={handleScheduleInterview}
          onClose={() => setSchedulingFor(null)}
        />
      )}

      {viewingRecalibrateFor && (
        <RecalibrateReportModal
          candidateId={viewingRecalibrateFor.id}
          onClose={() => setViewingRecalibrateFor(null)}
        />
      )}
    </div>
  );
};
