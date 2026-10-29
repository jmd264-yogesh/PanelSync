'use client';

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        width: '24px', height: '24px', borderRadius: '50%', fontSize: '0.75rem', fontWeight: 700,
        background: 'var(--rc-brand-glow, rgba(124,58,237,0.12))', color: 'var(--rc-brand, #7c3aed)',
      }}>
        {n}
      </span>
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.2rem' }}>{title}</div>
        <div className="text-muted" style={{ fontSize: '0.8rem', lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--rc-brand, #7c3aed)' }}>{title}</div>
      {children}
    </div>
  );
}

export default function HelpGuide() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="How to use Recalibrate"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem', height: '36px', padding: '0 0.75rem',
          border: '1px solid var(--border-glass)', borderRadius: '10px', color: 'var(--text-muted)',
          fontSize: '0.76rem', fontWeight: 650, background: 'transparent', cursor: 'pointer',
          transition: 'var(--transition-fast, all 0.15s ease)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--rc-brand, #7c3aed)';
          e.currentTarget.style.color = 'var(--rc-brand, #7c3aed)';
          e.currentTarget.style.background = 'var(--rc-brand-glow, rgba(124,58,237,0.08))';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-glass)';
          e.currentTarget.style.color = 'var(--text-muted)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <HelpCircle size={14} />
        <span>How it works</span>
      </button>

      <SheetContent side="right" className="flex flex-col" style={{ width: 'min(480px, 92vw)', maxWidth: 'none' }}>
        <SheetHeader>
          <SheetTitle>How to run an interview in Recalibrate</SheetTitle>
        </SheetHeader>
        <div style={{ padding: '0 1rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          <Section title="1 · Prepare">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <Step n={1} title="Set up the interview">
                Pick the candidate&apos;s role grade and the tech stacks that apply to them, then generate the questions. The number of questions can&apos;t go below one per area you selected, so every area can be scored. Consultant-level roles always include one case study from the panel deck.
              </Step>
              <Step n={2} title="Choose how it is being held">
                <strong>Online (Teams)</strong> pulls the speakers from the meeting transcript. <strong>In person</strong> records the room: afterwards you confirm who is the candidate and who is on the panel before the AI scores anything.
              </Step>
              <Step n={3} title="Starting over">
                Regenerating replaces all questions and clears the scores you entered, so it asks first. It is blocked once you have submitted.
              </Step>
            </div>
          </Section>

          <Section title="2 · Interview">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <Step n={4} title="Keep the scoring window open">
                &ldquo;Pop out&rdquo; opens a small window that stays on top of your Teams call, with the current question, the 1–4 buttons, your notes and the timer. Chrome or Edge only.
              </Step>
              <Step n={5} title="Score each question 1–4">
                1 Does Not Meet · 2 Partially Meets · 3 Meets Expectation · 4 Exceeds Expectation. The model answer and scoring guide under each question are for you only — the candidate never sees them.
              </Step>
              <Step n={6} title="Rate each skill">
                The skill ratings are your overall view per area (technical, case study, behavioural), against the bar for this role. They are separate from the individual question scores.
              </Step>
              <Step n={7} title="Recording">
                Record in the browser, upload a recording, or pull the Teams transcript. A recording is only cleared from the page after it has been transcribed, so a failed attempt can be retried.
              </Step>
            </div>
          </Section>

          <Section title="3 · Review with AI">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <Step n={8} title="Score with AI">
                Once there is a transcript the AI suggests a score for each question and skill, with the evidence it used. If it hasn&apos;t run, or failed, a banner says why and lets you run it again. In person, you must confirm who is who first.
              </Step>
              <Step n={9} title="Apply AI scores">
                &ldquo;Apply&rdquo; fills the scores you haven&apos;t set. If the AI disagrees with a score you already entered, it asks before replacing it, and your notes are never overwritten — the AI summary is added underneath.
              </Step>
              <Step n={10} title="L2 interviews">
                You can read the L1 panel&apos;s feedback and assessment for the same candidate. L1 panelists never see any L2 information.
              </Step>
            </div>
          </Section>

          <Section title="4 · Submit">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <Step n={11} title="Submit to recruiters">
                Use the button in the bar at the top. You&apos;ll be warned if anything is still unscored. Recruiters see nothing until you submit, and you can withdraw it while the round is open.
              </Step>
              <Step n={12} title="Download a copy">
                &ldquo;Question sheet&rdquo; is safe to hand over. &ldquo;Assessment report&rdquo; has the model answers, scores and your notes, for your own records.
              </Step>
            </div>
          </Section>

        </div>
      </SheetContent>
    </Sheet>
  );
}
