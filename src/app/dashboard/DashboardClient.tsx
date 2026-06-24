'use client';

import React, { useState, useEffect } from 'react';
import { Building2, CalendarDays, ShieldCheck, UserRoundCheck, UsersRound, Compass } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { College, Interview, Panelist, UploadedCandidate, Drive } from '@/lib/db';

import CandidatesTab from './components/CandidatesTab';
import CollegesTab from './components/CollegesTab';
import InterviewsTab from './components/InterviewsTab';
import PanelistsTab from './components/PanelistsTab';
import RecruitersTab from './components/RecruitersTab';
import DrivesTab from './components/DrivesTab';

interface DashboardClientProps {
  initialInterviews: Interview[];
  initialPanelists: Panelist[];
  initialColleges: College[];
}

type DashboardTab = 'interviews' | 'panelists' | 'recruiters' | 'candidates' | 'colleges' | 'drives';

export default function DashboardClient({ initialInterviews, initialPanelists, initialColleges }: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('interviews');
  const [interviews, setInterviews] = useState<Interview[]>(initialInterviews);
  const [panelists, setPanelists] = useState<Panelist[]>(initialPanelists);
  const [collegesList, setCollegesList] = useState<College[]>(initialColleges);
  const [candidates, setCandidates] = useState<UploadedCandidate[]>([]);
  const [drives, setDrives] = useState<Drive[]>([]);
  const [activeDrive, setActiveDrive] = useState<Drive | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchCandidates = async () => {
    try {
      const res = await fetch('/api/candidates');
      if (res.ok) setCandidates(await res.json());
    } catch (err) {
      console.error('Failed to fetch candidates:', err);
    }
  };

  const fetchDrives = async () => {
    try {
      const res = await fetch('/api/drives');
      if (res.ok) {
        const data = await res.json();
        setDrives(data.drives || []);
        setActiveDrive(data.activeDrive || null);
      }
    } catch (err) {
      console.error('Failed to fetch drives:', err);
    }
  };

  const triggerAutoReminders = async () => {
    try {
      await fetch('/api/interviews/check-ended-reminders');
    } catch (err) {
      console.error('Failed to trigger auto feedback reminders:', err);
    }
  };

  useEffect(() => {
    void fetchCandidates();
    void fetchDrives();
    void triggerAutoReminders();
  }, []);

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
    if (tab === 'candidates' || tab === 'interviews') void fetchCandidates();
    void fetchDrives();
  };

  const l1Count = panelists.filter((p) => p.roles.includes('L1')).length;
  const l2Count = panelists.filter((p) => p.roles.includes('L2')).length;
  const l1Scheduled = interviews.filter((i) => i.status === 'SCHEDULED' && i.role.toLowerCase().includes('l1')).length;
  const l2Scheduled = interviews.filter((i) => i.status === 'SCHEDULED' && i.role.toLowerCase().includes('l2')).length;

  const navigation = [
    { id: 'interviews', label: 'Interviews', description: 'Schedule and track', icon: CalendarDays, count: interviews.length },
    { id: 'panelists', label: 'Panelists', description: 'Directory and slots', icon: UsersRound, count: panelists.length },
    { id: 'recruiters', label: 'Recruiters', description: 'Access control', icon: ShieldCheck, count: undefined },
    { id: 'candidates', label: 'Candidates', description: 'Queue and mapping', icon: UserRoundCheck, count: candidates.length },
    { id: 'colleges', label: 'Colleges', description: 'Drive locations', icon: Building2, count: collegesList.length },
    { id: 'drives', label: 'Drives', description: activeDrive ? `Active: ${activeDrive.collegeName}` : 'Recruitment drives', icon: Compass, count: drives.length },
  ] as const;

  const activeNavigation = navigation.find((item) => item.id === activeTab) ?? navigation[0];

  return (
    <div className="dashboard-workspace">
      {/* Sidebar Area */}
      <aside className="workspace-sidebar">
        <nav className="workspace-nav" aria-label="Dashboard sections">
          {navigation.map(({ id, label, description, icon: Icon, count }) => (
            <Button
              key={id}
              variant={activeTab === id ? 'default' : 'ghost'}
              className="workspace-nav-item"
              data-active={activeTab === id}
              onClick={() => handleTabChange(id)}
            >
              <span className="workspace-nav-icon"><Icon /></span>
              <span className="workspace-nav-copy"><strong>{label}</strong><small>{description}</small></span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', marginLeft: 'auto' }}>
                {count !== undefined && <span className="workspace-nav-count">{count}</span>}
              </span>
            </Button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="workspace-main">
        <section className="workspace-content">
          {activeTab === 'interviews' && (
            <InterviewsTab interviews={interviews} setInterviews={setInterviews} panelists={panelists} candidates={candidates} setCandidates={setCandidates} todayStr={todayStr} collegesList={collegesList} drives={drives} activeDrive={activeDrive} />
          )}
          {activeTab === 'panelists' && (
            <PanelistsTab panelists={panelists} setPanelists={setPanelists} interviews={interviews} setInterviews={setInterviews} collegesList={collegesList} todayStr={todayStr} activeDrive={activeDrive} />
          )}
          {activeTab === 'recruiters' && <RecruitersTab />}
          {activeTab === 'candidates' && (
            <CandidatesTab candidates={candidates} setCandidates={setCandidates} fetchCandidates={fetchCandidates} interviews={interviews} setInterviews={setInterviews} collegesList={collegesList} todayStr={todayStr} activeDrive={activeDrive} />
          )}
          {activeTab === 'colleges' && <CollegesTab collegesList={collegesList} setCollegesList={setCollegesList} />}
          {activeTab === 'drives' && (
            <DrivesTab drives={drives} activeDrive={activeDrive} onDrivesChange={fetchDrives} collegesList={collegesList} />
          )}
        </section>
      </main>
    </div>
  );
}

