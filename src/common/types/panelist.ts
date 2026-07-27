import { PanelistRole } from '@/common/constants/panelistRoles';

export interface SchedulerDefaults {
  l1TimeStart: string;
  l1TimeEnd: string;
  l2TimeStart: string;
  l2TimeEnd: string;
  defaultStartDate: string;
  defaultEndDate: string;
  collegeName: string;
}

export interface SlotRequest {
  duration: string;
  startDate: string;
  endDate: string;
  interviewType: 'L1' | 'L2' | 'General';
  slots: { startTime: string; endTime: string }[];
  collegeName: string;
}

export interface PanelistSelection {
  l1Ids: string[];
  l2Ids: string[];
}

export interface ProposedSlot {
  startTime: string;
  endTime: string;
  selected: boolean;
}
