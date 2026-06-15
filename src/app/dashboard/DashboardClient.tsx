'use client';

import React, { useState } from 'react';
import { Building2, CalendarDays, ShieldCheck, UserRoundCheck, UsersRound } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { College, Interview, Panelist, UploadedCandidate } from '@/lib/db';

import CandidatesTab from './components/CandidatesTab';
import CollegesTab from './components/CollegesTab';
import InterviewsTab from './components/InterviewsTab';
import PanelistsTab from './components/PanelistsTab';
import RecruitersTab from './components/RecruitersTab';

interface DashboardClientProps {
  initialInterviews: Interview[];
  initialPanelists: Panelist[];
  initialColleges: College[];
}

type DashboardTab = 'interviews' | 'panelists' | 'recruiters' | 'candidates' | 'colleges';

export default function DashboardClient({ initialInterviews, initialPanelists, initialColleges }: DashboardClientProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('interviews');
  const [interviews, setInterviews] = useState<Interview[]>(initialInterviews);
  const [panelists, setPanelists] = useState<Panelist[]>(initialPanelists);
  const [collegesList, setCollegesList] = useState<College[]>(initialColleges);
  const [candidates, setCandidates] = useState<UploadedCandidate[]>([]);

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchCandidates = async () => {
    try {
      const res = await fetch('/api/candidates');
      if (res.ok) setCandidates(await res.json());
    } catch (err) {
      console.error('Failed to fetch candidates:', err);
    }
  };

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
    if (tab === 'candidates') void fetchCandidates();
  };

  const navigation = [
    { id: 'interviews', label: 'Interviews', description: 'Schedule and track', icon: CalendarDays, count: interviews.length },
    { id: 'panelists', label: 'Panelists', description: 'Directory and slots', icon: UsersRound, count: panelists.length },
    { id: 'recruiters', label: 'Recruiters', description: 'Access control', icon: ShieldCheck, count: undefined },
    { id: 'candidates', label: 'Candidates', description: 'Queue and mapping', icon: UserRoundCheck, count: candidates.length },
    { id: 'colleges', label: 'Colleges', description: 'Drive locations', icon: Building2, count: collegesList.length },
  ] as const;

  const activeNavigation = navigation.find((item) => item.id === activeTab) ?? navigation[0];

  return (
    <div className="dashboard-workspace">
      <div className="workspace-heading">
        <div>
          <Badge variant="secondary" className="mb-2">Recruiter portal</Badge>
          <h1>{activeNavigation.label}</h1>
          <p>{activeNavigation.description}. Manage the interview workflow from one place.</p>
        </div>
        <div className="workspace-health"><span /> Microsoft services connected</div>
      </div>

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
            {count !== undefined && <span className="workspace-nav-count">{count}</span>}
          </Button>
        ))}
      </nav>

      <section className="workspace-content">
        {activeTab === 'interviews' && (
          <InterviewsTab interviews={interviews} setInterviews={setInterviews} panelists={panelists} candidates={candidates} setCandidates={setCandidates} todayStr={todayStr} />
        )}
        {activeTab === 'panelists' && (
          <PanelistsTab panelists={panelists} setPanelists={setPanelists} interviews={interviews} setInterviews={setInterviews} collegesList={collegesList} todayStr={todayStr} />
        )}
        {activeTab === 'recruiters' && <RecruitersTab />}
        {activeTab === 'candidates' && (
          <CandidatesTab candidates={candidates} setCandidates={setCandidates} fetchCandidates={fetchCandidates} interviews={interviews} setInterviews={setInterviews} collegesList={collegesList} todayStr={todayStr} />
        )}
        {activeTab === 'colleges' && <CollegesTab collegesList={collegesList} setCollegesList={setCollegesList} />}
      </section>
    </div>
  );
}
