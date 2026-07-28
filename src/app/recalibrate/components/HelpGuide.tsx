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
        <span>How to use this</span>
      </button>

      <SheetContent side="right" className="flex flex-col" style={{ width: 'min(480px, 92vw)', maxWidth: 'none' }}>
        <SheetHeader>
          <SheetTitle>How to run an interview in Recalibrate</SheetTitle>
        </SheetHeader>
        <div style={{ padding: '0 1rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          <Section title="Before the interview">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <Step n={1} title="Pick the candidate">
                Use the candidate switcher at the top (only shown when you have more than one) to select who you’re interviewing.
              </Step>
              <Step n={2} title="Set Spec Inputs">
                Choose the candidate’s Role Grade, question Style, and how many questions to generate. The role grade determines which organization rubric (SE &amp; SSE / Consultant / Enabler) the candidate is scored against.
              </Step>
              <Step n={3} title="Select tech stacks for this candidate">
                Check only the technical categories actually relevant to them (e.g. just Snowflake + SQL, not every category). This scopes both the generated questions and the Overall Scoring Rubric — you won’t see or need to score categories you didn’t select. At least one is required before you can generate.
              </Step>
              <Step n={4} title="Generate Questions">
                The AI proposes questions plus a model answer and rubric per question. Regenerating replaces the current set — do this before the candidate joins, not mid-interview, since it resets question scores. The interview timer starts automatically the moment questions are ready.
              </Step>
            </div>
          </Section>

          <Section title="During the interview">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <Step n={5} title="Ask each question, then score it 1–4">
                The “Model answer” block under each question is for your reference only — it’s never shown to the candidate. Use it to judge how close the candidate’s actual answer is, then score 1 (Does Not Meet) through 4 (Exceeds Expectation). “Model rubric” gives band-by-band language if you want more detail before scoring.
              </Step>
              <Step n={6} title="Adjust marks if a question deserves more weight">
                The small “Marks” field next to each question’s category/difficulty badges is editable — bump it up if that question should count for more (e.g. it’s the candidate’s specialty).
              </Step>
              <Step n={7} title="Score the Overall Scoring Rubric as you go">
                Separate from per-question scores — this is your holistic 1–4 rating per skill dimension (Technical + Behavioural), reflecting the organization’s actual bar for this role grade, not just this one interview’s questions.
              </Step>
              <Step n={8} title="Watch the Rubric vs question gap">
                In Live Analysis, a gap of 1.0+ between your average question score and average rubric score gets flagged, with the specific dimension(s) driving it listed underneath — that’s your cue to double check whether a rubric score and its matching questions actually agree before you finalize.
              </Step>
              <Step n={9} title="Use the L1 Round Reference if this is an L2 round">
                For L2 interviews, a read-only summary of the candidate’s submitted L1 assessment appears near the top of this column automatically — L1 panelists never see the reverse.
              </Step>
            </div>
          </Section>

          <Section title="Wrapping up">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <Step n={10} title="Add overall notes">
                Recommendation, standout moments, red flags — autosaves when you click away from the field.
              </Step>
              <Step n={11} title="Submit to recruiters">
                Nothing is visible to recruiters until you explicitly submit. You can withdraw and re-submit as many times as needed while the round is still open.
              </Step>
              <Step n={12} title="Download if you need a copy">
                “Candidate” downloads a question-only sheet (safe to hand over); “Panelist” downloads the full report — model answers, rubric, scores, and your notes — for your own records.
              </Step>
            </div>
          </Section>

        </div>
      </SheetContent>
    </Sheet>
  );
}
