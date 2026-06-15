'use client';

import React, { useState, useEffect } from 'react';
import { Interview, Panelist, UploadedCandidate, College } from '@/lib/db';
import InterviewsTab from './components/InterviewsTab';
import PanelistsTab from './components/PanelistsTab';
import RecruitersTab from './components/RecruitersTab';
import CandidatesTab from './components/CandidatesTab';
import CollegesTab from './components/CollegesTab';

interface DashboardClientProps {
  initialInterviews: Interview[];
  initialPanelists: Panelist[];
  initialColleges: College[];
}

export default function DashboardClient({ initialInterviews, initialPanelists, initialColleges }: DashboardClientProps) {
  // ── Shared Navigation State ───────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'interviews' | 'panelists' | 'recruiters' | 'candidates' | 'colleges'>('interviews');

  // ── Shared Data States (cross-tab dependencies) ───────────────────────────
  const [interviews, setInterviews] = useState<Interview[]>(initialInterviews);
  const [panelists, setPanelists] = useState<Panelist[]>(initialPanelists);
  const [collegesList, setCollegesList] = useState<College[]>(initialColleges);
  const [candidates, setCandidates] = useState<UploadedCandidate[]>([]);

  const todayStr = new Date().toISOString().split('T')[0];

  // ── Shared candidate fetch (used by multiple tabs) ────────────────────────
  const fetchCandidates = async () => {
    try {
      const res = await fetch('/api/candidates');
      if (res.ok) {
        const data = await res.json();
        setCandidates(data);
      }
    } catch (err) {
      console.error('Failed to fetch candidates:', err);
    }
  };

  // Pre-load candidates when switching to candidates tab
  useEffect(() => {
    if (activeTab === 'candidates') {
      fetchCandidates();
    }
  }, [activeTab]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Navigation Tabs */}
      <div className="nav-tabs-container">
        <button
          onClick={() => setActiveTab('interviews')}
          className={`tab-btn ${activeTab === 'interviews' ? 'active' : ''}`}
        >
          Interviews
        </button>
        <button
          onClick={() => setActiveTab('panelists')}
          className={`tab-btn ${activeTab === 'panelists' ? 'active' : ''}`}
        >
          Panelists
        </button>
        <button
          onClick={() => setActiveTab('recruiters')}
          className={`tab-btn ${activeTab === 'recruiters' ? 'active' : ''}`}
        >
          Recruiters
        </button>
        <button
          onClick={() => setActiveTab('candidates')}
          className={`tab-btn ${activeTab === 'candidates' ? 'active' : ''}`}
        >
          Candidate Queue
        </button>
        <button
          onClick={() => setActiveTab('colleges')}
          className={`tab-btn ${activeTab === 'colleges' ? 'active' : ''}`}
        >
          Colleges
        </button>
      </div>

      {/* VIEW A: INTERVIEWS TAB */}
      {activeTab === 'interviews' && (
        <InterviewsTab
          interviews={interviews}
          setInterviews={setInterviews}
          panelists={panelists}
          candidates={candidates}
          setCandidates={setCandidates}
          todayStr={todayStr}
        />
      )}

      {/* VIEW B: PANELISTS TAB */}
      {activeTab === 'panelists' && (
        <PanelistsTab
          panelists={panelists}
          setPanelists={setPanelists}
          interviews={interviews}
          setInterviews={setInterviews}
          collegesList={collegesList}
          todayStr={todayStr}
        />
      )}

      {/* VIEW C: RECRUITERS TAB */}
      {activeTab === 'recruiters' && (
        <RecruitersTab />
      )}

      {/* VIEW D: CANDIDATE QUEUE TAB */}
      {activeTab === 'candidates' && (
        <CandidatesTab
          candidates={candidates}
          setCandidates={setCandidates}
          fetchCandidates={fetchCandidates}
          interviews={interviews}
          setInterviews={setInterviews}
          collegesList={collegesList}
          todayStr={todayStr}
        />
      )}

      {/* VIEW E: COLLEGES TAB */}
      {activeTab === 'colleges' && (
        <CollegesTab
          collegesList={collegesList}
          setCollegesList={setCollegesList}
        />
      )}
    </div>
  );
}
