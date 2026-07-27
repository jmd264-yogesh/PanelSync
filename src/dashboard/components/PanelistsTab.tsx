'use client';

import React, { useState, useEffect } from 'react';
import { Download, Upload } from 'lucide-react';
import { Panelist, Interview, College, Drive } from '@server/lib/db';
import { toast } from 'sonner';
import { usePanelistSelection } from '@/dashboard/hooks/panelists/usePanelistSelection';
import { useSlotGenerator } from '@/dashboard/hooks/panelists/useSlotGenerator';
import { useSchedulerDefaults } from '@/dashboard/hooks/panelists/useSchedulerDefaults';
import { usePanelistActions } from '@/dashboard/hooks/panelists/usePanelistActions';
import { SchedulerDefaultsCard } from './panelists/SchedulerDefaultsCard';
import { AdminPanelistForm } from './panelists/AdminPanelistForm';
import { PanelistDirectory } from './panelists/PanelistDirectory';
import { BulkSelectionBar } from './panelists/BulkSelectionBar';
import { SlotRequestModal } from './panelists/SlotRequestModal';

interface PanelistsTabProps {
  panelists: Panelist[];
  setPanelists: React.Dispatch<React.SetStateAction<Panelist[]>>;
  interviews: Interview[];
  setInterviews: React.Dispatch<React.SetStateAction<Interview[]>>;
  collegesList: College[];
  todayStr: string;
  activeDrive: Drive | null;
}

export const PanelistsTab = ({
  panelists,
  setPanelists,
  interviews,
  setInterviews,
  collegesList,
  todayStr,
  activeDrive,
}: PanelistsTabProps) => {
  // ── Hooks ────────────────────────────────────────────────────────────────
  const schedulerDefaults = useSchedulerDefaults(activeDrive);
  const panelistSelection = usePanelistSelection(panelists);
  const panelistActions = usePanelistActions({
    panelists,
    setPanelists,
    setInterviews,
    interviews,
  });

  // ── Slot Request Modal State ──────────────────────────────────────────────
  const [reqPanelists, setReqPanelists] = useState<Panelist[]>([]);
  const [reqDuration, setReqDuration] = useState('30');
  const [reqStartDate, setReqStartDate] = useState('');
  const [reqEndDate, setReqEndDate] = useState('');
  const [reqInterviewType, setReqInterviewType] = useState<'L1' | 'L2' | 'General'>('L1');
  const [reqCollegeName, setReqCollegeName] = useState('');

  // Slot generator hook
  const slotGenerator = useSlotGenerator({
    startDate: reqStartDate,
    endDate: reqEndDate,
    interviewType: reqInterviewType,
    l1TimeStart: schedulerDefaults.l1TimeStart,
    l1TimeEnd: schedulerDefaults.l1TimeEnd,
    l2TimeStart: schedulerDefaults.l2TimeStart,
    l2TimeEnd: schedulerDefaults.l2TimeEnd,
    isActive: reqPanelists.length > 0,
  });

  // ── Matching Filters State ────────────────────────────────────────────────
  const [filterCollege, setFilterCollege] = useState(activeDrive ? activeDrive.collegeName : '');
  const [filterDate, setFilterDate] = useState(activeDrive ? activeDrive.startDate : '');

  // Update filters when active drive changes
  useEffect(() => {
    if (activeDrive) {
      setFilterCollege(activeDrive.collegeName);
      setFilterDate(activeDrive.startDate);
    }
  }, [activeDrive]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleOpenSlotRequest = (p: Panelist | Panelist[], stage: 'L1' | 'L2') => {
    const arr = Array.isArray(p) ? p : [p];
    setReqPanelists(arr);
    setReqInterviewType(stage);
    setReqDuration('30');
    setReqStartDate(activeDrive ? activeDrive.startDate : schedulerDefaults.defaultStartDate);
    setReqEndDate(activeDrive ? activeDrive.endDate : schedulerDefaults.defaultEndDate);
    setReqCollegeName(activeDrive ? activeDrive.collegeName : schedulerDefaults.collegeName);
  };

  const handleSendSlotRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    // Past-date guard only applies to manual entry; active-drive dates are trusted
    if (!activeDrive && reqStartDate < todayStr) {
      toast.error('Start date cannot be in the past.');
      return;
    }

    const success = await panelistActions.sendSlotRequest(reqPanelists, {
      duration: reqDuration,
      startDate: reqStartDate,
      endDate: reqEndDate,
      interviewType: reqInterviewType,
      slots: slotGenerator.selectedSlots.map((s) => ({
        startTime: s.startTime,
        endTime: s.endTime,
      })),
      collegeName: reqCollegeName,
      hiringType: 'CAMPUS',
      candidateName: 'Pending Assignment',
      candidateEmail: 'pending@assignement.com',
    });

    if (success) {
      setReqPanelists([]);
      panelistSelection.clearSelection();
    }
  };

  const handleRequestL1Slots = () => {
    handleOpenSlotRequest(panelistSelection.selectedL1Panelists, 'L1');
  };

  const handleRequestL2Slots = () => {
    handleOpenSlotRequest(panelistSelection.selectedL2Panelists, 'L2');
  };

  const handleResetFilters = () => {
    setFilterCollege(activeDrive ? activeDrive.collegeName : '');
    setFilterDate(activeDrive ? activeDrive.startDate : '');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="panelists-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">Panelists</h1>
          <p className="page-subtitle">
            Manage interview panelists, capability levels, slot requests, and scheduling availability.
          </p>
        </div>

        <div className="page-actions">
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => toast.info('Import panelists functionality is placeholder-only')}
          >
            <Upload size={14} /> Import
          </button>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => toast.info('Export directory functionality is placeholder-only')}
          >
            <Download size={14} /> Export
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
              const el = document.getElementById('search-colleague-input');
              if (el) {
                el.focus();
                el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            Add Panelist
          </button>
        </div>
      </header>

      {/* Scheduler Defaults Card */}
      <SchedulerDefaultsCard
        l1TimeStart={schedulerDefaults.l1TimeStart}
        l1TimeEnd={schedulerDefaults.l1TimeEnd}
        l2TimeStart={schedulerDefaults.l2TimeStart}
        l2TimeEnd={schedulerDefaults.l2TimeEnd}
        defaultStartDate={schedulerDefaults.defaultStartDate}
        defaultEndDate={schedulerDefaults.defaultEndDate}
        collegeName={schedulerDefaults.collegeName}
        collegesList={collegesList}
        todayStr={todayStr}
        onL1TimeStartChange={schedulerDefaults.setL1TimeStart}
        onL1TimeEndChange={schedulerDefaults.setL1TimeEnd}
        onL2TimeStartChange={schedulerDefaults.setL2TimeStart}
        onL2TimeEndChange={schedulerDefaults.setL2TimeEnd}
        onDefaultStartDateChange={schedulerDefaults.setDefaultStartDate}
        onDefaultEndDateChange={schedulerDefaults.setDefaultEndDate}
        onCollegeNameChange={schedulerDefaults.setCollegeName}
        onSave={schedulerDefaults.saveDefaults}
      />

      {/* Main two-column workspace */}
      <section className="panelists-content-grid">
        {/* Left column: Register New Panelist */}
        <AdminPanelistForm
          panelists={panelists}
          onAdd={panelistActions.addPanelist}
          isAdminSaving={panelistActions.isAdminSaving}
        />

        {/* Right column: Panelist Pool Directory */}
        <PanelistDirectory
          panelists={panelists}
          interviews={interviews}
          collegesList={collegesList}
          filterCollege={filterCollege}
          filterDate={filterDate}
          bulkSelectedL1Ids={panelistSelection.bulkSelectedL1Ids}
          bulkSelectedL2Ids={panelistSelection.bulkSelectedL2Ids}
          onFilterCollegeChange={setFilterCollege}
          onFilterDateChange={setFilterDate}
          onResetFilters={handleResetFilters}
          onToggleL1={panelistSelection.toggleL1}
          onToggleL2={panelistSelection.toggleL2}
          onToggleAllL1={panelistSelection.toggleAllL1}
          onToggleAllL2={panelistSelection.toggleAllL2}
          onDeletePanelist={panelistActions.deletePanelist}
          onRequestSlot={handleOpenSlotRequest}
        />
      </section>

      {/* Floating Bulk Action Bar */}
      <BulkSelectionBar
        l1Count={panelistSelection.bulkSelectedL1Ids.length}
        l2Count={panelistSelection.bulkSelectedL2Ids.length}
        onRequestL1Slots={handleRequestL1Slots}
        onRequestL2Slots={handleRequestL2Slots}
        onClearSelection={panelistSelection.clearSelection}
      />

      {/* Request Slot Overlay Modal */}
      <SlotRequestModal
        isOpen={reqPanelists.length > 0}
        panelists={reqPanelists}
        interviewType={reqInterviewType}
        duration={reqDuration}
        startDate={reqStartDate}
        endDate={reqEndDate}
        collegeName={reqCollegeName}
        activeDrive={activeDrive}
        slots={slotGenerator.generatedSlots}
        collegesList={collegesList}
        todayStr={todayStr}
        isRequestingSlot={panelistActions.isRequestingSlot}
        onClose={() => setReqPanelists([])}
        onInterviewTypeChange={setReqInterviewType}
        onDurationChange={setReqDuration}
        onStartDateChange={setReqStartDate}
        onEndDateChange={setReqEndDate}
        onCollegeNameChange={setReqCollegeName}
        onToggleSlot={slotGenerator.toggleSlot}
        onSubmit={handleSendSlotRequest}
      />
    </main>
  );
};
