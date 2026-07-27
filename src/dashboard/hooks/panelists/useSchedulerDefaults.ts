import { useState, useEffect } from 'react';
import { Drive } from '@server/lib/db';
import { SchedulerDefaults } from '@/common/types/panelist';
import { toast } from 'sonner';

const getDefaultDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
};

export function useSchedulerDefaults(activeDrive: Drive | null) {
  const [l1TimeStart, setL1TimeStart] = useState('10:00');
  const [l1TimeEnd, setL1TimeEnd] = useState('13:00');
  const [l2TimeStart, setL2TimeStart] = useState('14:00');
  const [l2TimeEnd, setL2TimeEnd] = useState('17:00');
  const [defaultStartDate, setDefaultStartDate] = useState(getDefaultDate);
  const [defaultEndDate, setDefaultEndDate] = useState(getDefaultDate);
  const [collegeName, setCollegeName] = useState('');

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedL1Start = localStorage.getItem('ps_l1TimeStart');
      const storedL1End = localStorage.getItem('ps_l1TimeEnd');
      const storedL2Start = localStorage.getItem('ps_l2TimeStart');
      const storedL2End = localStorage.getItem('ps_l2TimeEnd');
      const storedCollege = localStorage.getItem('ps_collegeName');

      if (storedL1Start) setL1TimeStart(storedL1Start);
      if (storedL1End) setL1TimeEnd(storedL1End);
      if (storedL2Start) setL2TimeStart(storedL2Start);
      if (storedL2End) setL2TimeEnd(storedL2End);
      if (storedCollege) setCollegeName(storedCollege);
    }
  }, []);

  // Update defaults when active drive changes
  useEffect(() => {
    if (activeDrive) {
      setCollegeName(activeDrive.collegeName);
      setDefaultStartDate(activeDrive.startDate);
      setDefaultEndDate(activeDrive.endDate);
    }
  }, [activeDrive]);

  const saveDefaults = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ps_l1TimeStart', l1TimeStart);
      localStorage.setItem('ps_l1TimeEnd', l1TimeEnd);
      localStorage.setItem('ps_l2TimeStart', l2TimeStart);
      localStorage.setItem('ps_l2TimeEnd', l2TimeEnd);
      localStorage.setItem('ps_collegeName', collegeName);
      toast.success('Scheduler defaults saved successfully!');
    }
  };

  const defaults: SchedulerDefaults = {
    l1TimeStart,
    l1TimeEnd,
    l2TimeStart,
    l2TimeEnd,
    defaultStartDate,
    defaultEndDate,
    collegeName,
  };

  return {
    defaults,
    l1TimeStart,
    l1TimeEnd,
    l2TimeStart,
    l2TimeEnd,
    defaultStartDate,
    defaultEndDate,
    collegeName,
    setL1TimeStart,
    setL1TimeEnd,
    setL2TimeStart,
    setL2TimeEnd,
    setDefaultStartDate,
    setDefaultEndDate,
    setCollegeName,
    saveDefaults,
  };
}
