/**
 * InterviewMetadataCard Component
 *
 * Displays interview metadata (candidate, duration, dates, email)
 */

"use client";

import React from "react";
import { Clock } from "lucide-react";
import { Interview, InterviewPanel } from "@server/lib/db";

interface InterviewMetadataCardProps {
  interview: Interview;
  panel: InterviewPanel;
}

export const InterviewMetadataCard = ({
  interview,
  panel,
}: InterviewMetadataCardProps) => {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 grid grid-cols-2 gap-4 mb-6">
      <div className="space-y-0.5">
        <span className="text-slate-500 text-xs font-medium block uppercase tracking-wider">
          Candidate
        </span>
        <span className="font-semibold text-slate-200">
          {interview.candidateName}
        </span>
      </div>
      <div className="space-y-0.5">
        <span className="text-slate-500 text-xs font-medium block uppercase tracking-wider">
          Required Duration
        </span>
        <span className="font-semibold text-slate-200 flex items-center gap-1.5">
          <Clock size={14} className="text-slate-400" /> {interview.duration}{" "}
          minutes
        </span>
      </div>
      <div className="space-y-0.5">
        <span className="text-slate-500 text-xs font-medium block uppercase tracking-wider">
          Date Limits Requested
        </span>
        <span className="text-sm font-medium text-slate-300">
          {new Date(interview.startDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}{" "}
          to{" "}
          {new Date(interview.endDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>
      <div className="space-y-0.5">
        <span className="text-slate-500 text-xs font-medium block uppercase tracking-wider">
          Panel Email
        </span>
        <span className="text-sm text-slate-400 break-all">{panel.email}</span>
      </div>
    </div>
  );
};
