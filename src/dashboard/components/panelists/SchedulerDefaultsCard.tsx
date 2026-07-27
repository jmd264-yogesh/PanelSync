'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import { College } from '@server/lib/db';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/common/components/ui/select';

interface SchedulerDefaultsCardProps {
  l1TimeStart: string;
  l1TimeEnd: string;
  l2TimeStart: string;
  l2TimeEnd: string;
  defaultStartDate: string;
  defaultEndDate: string;
  collegeName: string;
  collegesList: College[];
  todayStr: string;
  onL1TimeStartChange: (value: string) => void;
  onL1TimeEndChange: (value: string) => void;
  onL2TimeStartChange: (value: string) => void;
  onL2TimeEndChange: (value: string) => void;
  onDefaultStartDateChange: (value: string) => void;
  onDefaultEndDateChange: (value: string) => void;
  onCollegeNameChange: (value: string) => void;
  onSave: () => void;
}

export const SchedulerDefaultsCard = ({
  l1TimeStart,
  l1TimeEnd,
  l2TimeStart,
  l2TimeEnd,
  defaultStartDate,
  defaultEndDate,
  collegeName,
  collegesList,
  todayStr,
  onL1TimeStartChange,
  onL1TimeEndChange,
  onL2TimeStartChange,
  onL2TimeEndChange,
  onDefaultStartDateChange,
  onDefaultEndDateChange,
  onCollegeNameChange,
  onSave,
}: SchedulerDefaultsCardProps) => {
  return (
    <section className="scheduler-card">
      <div className="section-heading-row">
        <div>
          <h2 className="section-title">
            <Clock size={16} /> Scheduler Defaults
          </h2>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={onSave}>
          Save
        </button>
      </div>

      <div className="scheduler-grid neutral">
        {/* L1 timing window settings group */}
        <div className="scheduler-group">
          <div className="scheduler-group-title">L1 Timing</div>
          <div className="scheduler-field-row">
            <label>
              <input
                type="time"
                className="input-control"
                value={l1TimeStart}
                onChange={(e) => onL1TimeStartChange(e.target.value)}
              />
            </label>
            <label>
              <input
                type="time"
                className="input-control"
                value={l1TimeEnd}
                onChange={(e) => onL1TimeEndChange(e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* L2 timing window settings group */}
        <div className="scheduler-group">
          <div className="scheduler-group-title">L2 Timing</div>
          <div className="scheduler-field-row">
            <label>
              <input
                type="time"
                className="input-control"
                value={l2TimeStart}
                onChange={(e) => onL2TimeStartChange(e.target.value)}
              />
            </label>
            <label>
              <input
                type="time"
                className="input-control"
                value={l2TimeEnd}
                onChange={(e) => onL2TimeEndChange(e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* Date range settings group */}
        <div className="scheduler-group">
          <div className="scheduler-group-title">Date Range</div>
          <div className="scheduler-field-row">
            <label>
              <input
                type="date"
                className="input-control"
                value={defaultStartDate}
                min={todayStr}
                onChange={(e) => onDefaultStartDateChange(e.target.value)}
              />
            </label>
            <label>
              <input
                type="date"
                className="input-control"
                value={defaultEndDate}
                min={defaultStartDate || todayStr}
                onChange={(e) => onDefaultEndDateChange(e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* Institution details settings group */}
        <div className="scheduler-group">
          <div className="scheduler-group-title">Institution</div>
          <label>
            <Select value={collegeName} onValueChange={(val) => onCollegeNameChange(val || '')}>
              <SelectTrigger className="select-control">
                <SelectValue placeholder="College..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none_placeholder">Select...</SelectItem>
                {collegesList.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
      </div>
    </section>
  );
};
