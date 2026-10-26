'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, PictureInPicture2, Pause, Play } from 'lucide-react';
import { ScoreDial, ORG_SCORE_LABELS, DIFFICULTY_STYLE } from '@/components/recalibrate/primitives';
import type { RecalibrateQuestion, RubricDim } from '@/lib/recalibrate/useRecalibrateSession';

// "Pop out" scoring window: a small always-on-top window (Document Picture-in-Picture,
// Chrome/Edge 116+) that floats over the Teams call, so panelists can score without
// switching windows. It's a React portal into the PiP window's document, so it shares
// the workspace's state directly — scoring here is the same scoreQuestion/scoreRubric
// call as in the main page, and both stay in sync.

interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  window: Window | null;
}

function getPipApi(): DocumentPictureInPicture | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture ?? null;
}

// The PiP window starts as a blank document — copy the app's stylesheets and theme
// attributes across so the shared components render the same as in the main page.
function copyStyles(target: Window) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const style = target.document.createElement('style');
      style.textContent = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n');
      target.document.head.appendChild(style);
    } catch {
      // Cross-origin sheet (e.g. a font CDN): cssRules is unreadable, link it instead.
      if (sheet.href) {
        const link = target.document.createElement('link');
        link.rel = 'stylesheet';
        link.href = sheet.href;
        target.document.head.appendChild(link);
      }
    }
  }
  for (const attr of Array.from(document.documentElement.attributes)) {
    target.document.documentElement.setAttribute(attr.name, attr.value);
  }
  target.document.body.className = document.body.className;
}

const noopSubscribe = () => () => {};

interface ScoringPopoutProps {
  candidateName: string;
  questions: RecalibrateQuestion[];
  questionScores: Record<string, number>;
  onScoreQuestion: (questionId: string, value: number) => void;
  dims: RubricDim[];
  rubricScores: Record<string, number>;
  onScoreRubric: (label: string, value: number) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onNotesSave: () => void;
  elapsedLabel: string;
  isRunning: boolean;
  onToggleTimer: () => void;
}

export default function ScoringPopout(props: ScoringPopoutProps) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  // Browser capability, read on the client only (assumed available during SSR so the
  // button doesn't flash disabled on the many browsers that do support it).
  const supported = useSyncExternalStore(noopSubscribe, () => getPipApi() !== null, () => true);
  // Latest save handler, so closing the window saves the notes as they are now rather
  // than as they were when the window opened.
  const saveNotesRef = useRef(props.onNotesSave);
  useEffect(() => { saveNotesRef.current = props.onNotesSave; });

  // Close the floating window if the workspace unmounts (e.g. switching candidate).
  useEffect(() => () => { pipWindow?.close(); }, [pipWindow]);

  const open = async () => {
    const api = getPipApi();
    if (!api) return;
    if (api.window) { api.window.focus(); return; }
    const win = await api.requestWindow({ width: 380, height: 640 });
    copyStyles(win);
    win.document.title = `Scoring — ${props.candidateName}`;
    win.addEventListener('pagehide', () => {
      saveNotesRef.current();
      setPipWindow(null);
    });
    setPipWindow(win);
  };

  return (
    <>
      <button
        className="btn btn-sm"
        onClick={open}
        disabled={!supported || props.questions.length === 0}
        title={supported
          ? 'Open a small always-on-top scoring window you can keep over the Teams call'
          : 'Pop-out needs Chrome or Edge (version 116 or later)'}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
      >
        <PictureInPicture2 size={13} /> {pipWindow ? 'Scoring window open' : 'Pop out'}
      </button>
      {pipWindow && createPortal(<CompactScoringPanel {...props} />, pipWindow.document.body)}
    </>
  );
}

type Tab = 'questions' | 'rubric' | 'notes';

function CompactScoringPanel({
  candidateName, questions, questionScores, onScoreQuestion, dims, rubricScores, onScoreRubric,
  notes, onNotesChange, onNotesSave, elapsedLabel, isRunning, onToggleTimer,
}: ScoringPopoutProps) {
  const [tab, setTab] = useState<Tab>('questions');
  const [index, setIndex] = useState(0);
  const q = questions[Math.min(index, questions.length - 1)];
  const scored = questions.filter((x) => typeof questionScores[x.id] === 'number').length;
  const rated = dims.filter((d) => typeof rubricScores[d.label] === 'number').length;

  const tabButton = (id: Tab, label: string) => (
    <button
      key={id}
      className={`btn btn-sm ${tab === id ? 'btn-primary' : ''}`}
      onClick={() => setTab(id)}
      style={{ flex: 1, justifyContent: 'center' }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '0.75rem', minHeight: '100vh', boxSizing: 'border-box', position: 'relative', zIndex: 1 }}>
      {/* Header: candidate, timer, progress */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{candidateName}</div>
          <div className="text-xs text-muted">{scored}/{questions.length} questions · {rated}/{dims.length} rubric</div>
        </div>
        <button
          className="btn btn-sm"
          onClick={onToggleTimer}
          title={isRunning ? 'Pause timer' : 'Start / resume timer'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontFamily: 'monospace', flexShrink: 0 }}
        >
          {isRunning ? <Pause size={12} /> : <Play size={12} />} {elapsedLabel}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.35rem' }}>
        {tabButton('questions', 'Questions')}
        {tabButton('rubric', 'Rubric')}
        {tabButton('notes', 'Notes')}
      </div>

      {tab === 'questions' && q && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {/* Jump strip: filled = scored */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {questions.map((x, i) => {
              const isScored = typeof questionScores[x.id] === 'number';
              return (
                <button
                  key={x.id}
                  onClick={() => setIndex(i)}
                  title={x.category}
                  style={{
                    width: '24px', height: '24px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                    border: i === index ? '2px solid var(--primary)' : '1px solid var(--border-glass)',
                    background: isScored ? 'var(--success, #10b981)' : 'transparent',
                    color: isScored ? '#fff' : 'var(--text-muted)',
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <div className="glass-card" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              <span className="badge badge-info" style={{ fontSize: '0.62rem' }}>{q.category}</span>
              <span className="badge" style={{ fontSize: '0.62rem', background: DIFFICULTY_STYLE[q.difficulty].bg, color: DIFFICULTY_STYLE[q.difficulty].color, border: 'none' }}>{q.difficulty}</span>
            </div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: '0.88rem', lineHeight: 1.5 }}>Q{index + 1}. {q.question}</p>

            {q.caseStudy && (
              <details open>
                <summary className="text-xs" style={{ fontWeight: 700, cursor: 'pointer' }}>Case study — {q.caseStudy.title}</summary>
                <p style={{ fontSize: '0.8rem', margin: '0.35rem 0', lineHeight: 1.5 }}>{q.caseStudy.scenario}</p>
                <ol style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', lineHeight: 1.5 }}>
                  {q.caseStudy.followUps.map((f, fi) => <li key={fi}>{f}</li>)}
                </ol>
              </details>
            )}

            <details>
              <summary className="text-xs" style={{ fontWeight: 700, cursor: 'pointer' }}>Model answer &amp; bands</summary>
              <p style={{ fontSize: '0.78rem', margin: '0.35rem 0', lineHeight: 1.5 }}>{q.modelAnswer}</p>
              {q.rubric.map((b, bi) => (
                <div key={bi} style={{ fontSize: '0.74rem', display: 'flex', gap: '0.4rem', lineHeight: 1.45 }}>
                  <strong style={{ minWidth: '1rem' }}>{b.band}</strong>
                  <span className="text-muted">{b.description}</span>
                </div>
              ))}
            </details>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.2rem' }}>
              {[1, 2, 3, 4].map((n) => (
                <ScoreDial key={n} value={n} selected={questionScores[q.id] === n} onSelect={() => onScoreQuestion(q.id, n)} size={34} />
              ))}
              <span className="text-xs text-muted" style={{ marginLeft: '0.2rem' }}>
                {questionScores[q.id] ? ORG_SCORE_LABELS[questionScores[q.id]] : 'Not scored'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-sm" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
              <ChevronLeft size={13} /> Prev
            </button>
            <button className="btn btn-sm" disabled={index >= questions.length - 1} onClick={() => setIndex((i) => i + 1)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}

      {tab === 'rubric' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {dims.map((d) => (
            <div key={d.label} className="glass-card" style={{ padding: '0.55rem 0.65rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{d.label}</span>
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                {[1, 2, 3, 4].map((n) => (
                  <ScoreDial key={n} value={n} selected={rubricScores[d.label] === n} onSelect={() => onScoreRubric(d.label, n)} size={28} />
                ))}
              </div>
              {typeof rubricScores[d.label] === 'number' && (
                <span className="text-xs text-muted" style={{ lineHeight: 1.4 }}>{d.bands[rubricScores[d.label] - 1]}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'notes' && (
        <textarea
          className="form-input"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          onBlur={onNotesSave}
          placeholder="Evidence for your scores — what the candidate actually said or did."
          style={{ flex: 1, minHeight: '300px', resize: 'vertical', fontSize: '0.85rem', lineHeight: 1.5 }}
        />
      )}
    </div>
  );
}
