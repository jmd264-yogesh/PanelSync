# DE CoE Interview Console — Redesign Design Contract

Status: **Phase 1 — awaiting approval.** No implementation has started; this document is the
spec Phase 2 will execute against, one step at a time.

Scope: `src/app/recalibrate/**` (the live-scoring screen a panelist uses during a lateral-hiring
interview) and its shared primitives (`src/components/recalibrate/primitives.tsx`). Nothing in
`src/app/dashboard`, `src/app/panelist`, or any API route changes as part of this redesign — see
Global Rules below.

---

## 1.1 Layout blueprint

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ TopBar  [≡] Ada Lovelace · Senior Software Engineer · L2 Round  ●Submitted         │
│              04:12 ⏸        3/10 scored        [Spec] [⌘K] [?] [Theme]            │
├──────────┬────────────────────────────────────────────────┬───────────────────────┤
│          │                                                │                       │
│ Left     │              QuestionCanvas (HERO)             │   RightDrawer          │
│ Rail     │  ┌──────────────────────────────────────────┐  │   ┌─────────────────┐ │
│ (collap  │  │ Q 3 of 10 · medium · Azure Databricks     │  │   │Rubric│Behav│Notes│ │
│  sible,  │  │                                            │  │   ├─────────────────┤ │
│  persist │  │  <question body — 1.375rem/1.6, ≤72ch>    │  │   │                 │ │
│  in      │  │                                            │  │   │  <tab content> │ │
│  local   │  │  ▸ Model rubric (3 bands)                 │  │   │                 │ │
│  Storage)│  └──────────────────────────────────────────┘  │   │  ● Saved 12:03pm│ │
│          │                                                │  │                 │ │
│ Search…  │                                                │  └─────────────────┘ │
│ Ada L.   │                                                │                       │
│ Grace H. │                                                │                       │
├──────────┴────────────────────────────────────────────────┴───────────────────────┤
│ BottomActionBar  [◀ Prev]   SCORE ○1 ○2 ○3 ○4   [Save & Next ▶]     ⌘K · ? help    │
└───────────────────────────────────────────────────────────────────────────────────┘
```

- **Design floor:** 1280px. Above that, the shell never reflows to a single column.
- **Left Rail:** collapsible via the `[≡]` TopBar toggle; collapsed/expanded state persists in
  `localStorage` (`rc.rail.collapsed`). Collapsed state shows only avatars + status dot, full
  candidate list still reachable via `⌘K`.
- **RightDrawer:** docked (part of the grid, own scroll region) at **≥1440px**. At **<1440px**
  it becomes an overlay (shadcn `Sheet`, right-anchored) triggered by a TopBar icon button, so
  the Canvas gets full width on laptop-class screens. This matches Phase 2 Step 2 exactly.
- **<1280px:** not a first-class target (this is an internal panelist tool used on
  laptop/desktop). The shell keeps working — Left Rail collapses to overlay-only, RightDrawer
  stays overlay — rather than crashing or clipping, but pixel-perfection below 1280px is not a
  goal for this pass.
- **Default states:** Drawer opens on the `Rubric` tab. Left Rail starts expanded on first visit
  (no stored preference), collapsed afterwards mirrors whatever the panelist last chose.
  Spec Inputs (role grade / style / question count) render as a **collapsed one-line summary**
  above the Canvas the moment questions exist (same collapse behavior as today), so they never
  compete with question content for space.
- **Collapse behaviours:** `Model rubric` inside the Canvas stays a `<details>` disclosure — it's
  reference material, not something scored, so keeping it low-emphasis and collapsed-by-default
  is correct and unchanged from today.

---

## 1.2 Component inventory

| Component | Purpose | Key props | shadcn primitive | File |
|---|---|---|---|---|
| `TopBar` | Single merged header: rail toggle, candidate/role/round, submitted pill, `Timer`, `ProgressChip`, spec/palette/help/theme actions | `candidateName, positionTitle, round, isSubmitted, elapsedLabel, isRunning, hasStarted, onTimerStart/Pause/Resume/Reset, scoredCount, totalCount, onOpenPalette, onOpenSpec, onOpenShortcuts, railCollapsed, onToggleRail` | none (custom header; `Button` for icon actions) | `src/app/recalibrate/components/TopBar.tsx` |
| `CandidateRail` | Docked candidate list (existing component, reworked): search box + list; no longer owns page routing directly | `interviews, statuses, selectedId, onSelect, collapsed` | `Command` (new, for the ⌘K palette variant only — the docked list stays the existing hand-rolled list) | `src/app/recalibrate/components/CandidateRail.tsx` (existing file, extended) |
| `CommandPalette` | `⌘K` overlay: fuzzy candidate search + "jump to question N" | `open, onOpenChange, interviews, questions, onSelectCandidate, onJumpToQuestion` | `Command` + `Dialog` (shadcn `Command`/`CommandDialog`, new install of the `command` primitive) | `src/app/recalibrate/components/CommandPalette.tsx` (new) |
| `QuestionCanvas` | Single-question hero view: stepper, question body, difficulty/category chips, Model rubric disclosure | `question, index, total, score, onScore` | none (custom; visual language matches existing `.glass-card`) | `src/app/recalibrate/components/QuestionCanvas.tsx` (new) |
| `QuestionStepper` | `Q 3 of 10 · medium · Azure Databricks` strip at the top of the Canvas | `index, total, difficulty, category` | none | `src/components/recalibrate/primitives.tsx` (new export) |
| `RubricDrawer` | RightDrawer body: `Rubric` / `Behavioural` / `Notes` tabs | `technicalDims, behaviouralDims, rubricScores, onScoreRubric, activeTab, onTabChange` | `Tabs` (shadcn `Tabs`, new install) | `src/app/recalibrate/components/RubricDrawer.tsx` (new) |
| `RubricBand` | One score band row (`1 — description`) inside a `RubricDrawer` dimension, current band emphasized, others muted | `bandIndex, description, isSelected, isCurrentScore` | none | `src/components/recalibrate/primitives.tsx` (new export; replaces the `<details>` band list currently inlined in `RubricRow`) |
| `NotesPanel` | `Notes` drawer tab: textarea + `AutosaveIndicator` | `value, onChange, autosaveState, lastSavedAt` | `Textarea`-equivalent (plain, matches existing `.form-input`) | `src/app/recalibrate/components/NotesPanel.tsx` (new) |
| `ScoreBar` | The 1–4 scoring control, used both inline (rubric rows) and large (BottomActionBar) | `value, onScore, size: 'sm' \| 'lg'` | none (`role="radiogroup"`, wraps existing `ScoreDial`) | `src/components/recalibrate/primitives.tsx` (extends existing `ScoreDial`) |
| `BottomActionBar` | Sticky footer: Prev/Next nav + large `ScoreBar` for the current question + shortcut hint | `currentIndex, total, score, onScore, onPrev, onNext, canGoPrev, canGoNext` | `Button` + `Separator` | `src/app/recalibrate/components/BottomActionBar.tsx` (new) |
| `Timer` | Compact TopBar timer control: `mm:ss` + Pause/Resume, Reset tucked in an overflow menu | `elapsedLabel, isRunning, hasStarted, onStart/Pause/Resume/Reset` | `DropdownMenu` (existing primitive, for the overflow Reset action) | `src/app/recalibrate/components/Timer.tsx` (replaces `InterviewStopwatch.tsx`, same prop shape) |
| `ProgressChip` | `3/10 scored` pill, always visible in TopBar | `scored, total` | `Badge` (existing shadcn primitive) | `src/components/recalibrate/primitives.tsx` (new export) |
| `Kbd` | Single keycap glyph, e.g. `⌘K`, `1` | `keys: string[]` | none | `src/components/recalibrate/primitives.tsx` (new export) |
| `KbdHintPopover` | Hover/focus popover pairing an action with its shortcut | `label, keys, children` | `Tooltip` (existing shadcn primitive) | `src/components/recalibrate/primitives.tsx` (new export) |
| `ShortcutsOverlay` | Full `?`-triggered shortcut reference | `open, onOpenChange` | `Dialog` (via shadcn `Sheet`/`Dialog` — reuses whichever the palette pulls in) | `src/app/recalibrate/components/ShortcutsOverlay.tsx` (new) |
| `EmptyState` | "No candidate selected" / "No questions yet" / rail-empty states | `icon, title, description, action?` | none | `src/components/recalibrate/primitives.tsx` (new export; consolidates 2 existing ad hoc empty-state blocks in `RecalibrateWorkspaceClient.tsx` and `CandidateRail.tsx`) |
| `AutosaveIndicator` | `idle / saving / saved / error` dot + timestamp, `aria-live="polite"` | `state, lastSavedAt` | none | `src/components/recalibrate/primitives.tsx` (new export) |
| `SummaryView` | Post-submit analytics (former "Live Analysis"): avg question/rubric, gap banner, per-dimension breakdown | `session, questions, rubricScores, questionScores, allDims` | none (reuses existing `ProgressBar`) | `src/app/recalibrate/components/SummaryView.tsx` (new; body ported near-verbatim from the current `RecalibrateWorkspace.tsx` "Live Analysis" JSX) |
| `L1ReferencePanel` | Unchanged — read-only L1 summary for L2 rounds | *(no prop changes)* | none | `src/app/recalibrate/components/L1ReferencePanel.tsx` (existing, moves into the `Notes`/Rubric drawer as an extra tab or a banner above the Canvas — see open question in §1.7) |

New shadcn primitives to install (all already listed as "preferred if needed" in Global Rules,
so no separate ask): `command` (→ `@/components/ui/command.tsx`), `tabs` (already present —
`src/components/ui/tabs.tsx` exists but is unused by Recalibrate today), `sheet` (already
present, same situation), `dialog` (pulled in transitively by `command`).

`react-hotkeys-hook` is added for the keyboard layer (Step 3). `cmdk` is not added directly —
shadcn's `command` primitive vendors it.

---

## 1.3 Keyboard shortcuts

| Key | Action |
|---|---|
| `←` / `→` | Prev / Next question |
| `1` `2` `3` `4` | Score current question (focus-independent — works whenever the Canvas has focus and no text input is focused) |
| `N` | Focus the Notes textarea (opens the drawer to the Notes tab if closed) |
| `R` | Toggle RightDrawer open/closed (overlay mode) or focus it (docked mode) |
| `B` | Switch drawer to the Behavioural tab |
| `⌘K` / `Ctrl+K` | Open `CommandPalette` (candidate search + jump-to-question) |
| `?` | Open `ShortcutsOverlay` |
| `Esc` | Close whichever overlay/drawer/palette is topmost |

All shortcuts route through a single `useHotkeys` call in `RecalibrateWorkspace.tsx`; every
handler no-ops while a text input/textarea has focus (so typing in Notes never accidentally
scores a question or triggers `?`).

---

## 1.4 Visual system (tokens)

**Reconciliation with the existing app, not a parallel system.** `globals.css` already defines
real, dark-mode-aware semantic tokens: `--success` (`#16A34A`), `--warning` (`#F59E0B`),
`--danger` (`#DC2626`), `--info` (`#0ea5e9`), each with a `-glow` rgba variant, plus
`--bg-main/--bg-card/--bg-card-hover`, `--border-glass`, `--text-muted`, and a `.glass-card`
class already used everywhere in Recalibrate. These are **reused as-is** — no duplicate
`--success-2`-style tokens.

What's missing, and what this redesign adds to `globals.css`'s existing `:root` / `[data-theme]`
blocks (not a new `tailwind.config.*` — this app is Tailwind v4, CSS-config-only, and tokens are
exposed to Tailwind through the existing `@theme inline` block at `globals.css:624`):

- `--rc-brand: #7c3aed` (violet-600) — the console's own accent, distinct from the app-wide
  `--primary` (blue, `#2563EB`, used by the recruiter Dashboard). Recalibrate has always used a
  violet identity (`linear-gradient(145deg, #a855f7, #7c3aed 70%)`), just as ~15 scattered inline
  hex literals instead of a token. This redesign **retires those literals** in favor of
  `--rc-brand` / `--rc-brand-glow`, and drops the incidental pink/mint/blue pill variety the
  brief flagged — every accent in the console becomes `--rc-brand` or one of the four existing
  semantic tokens above, nothing else.
- `--radius-sm/md/lg/xl: 6px/10px/14px/20px` — formalizes radii that today are ad hoc
  (`10px`, `12px`, `16px`, `18px`, `20px` all appear inline across these files).
- Type scale additions: `--rc-font-body-lg: 1.375rem` (Canvas question body), `--rc-font-kbd:
  0.75rem`. Existing sizes (`0.85rem` section titles, `0.72rem` micro-labels) stay as they are —
  they already sit inside the brief's target scale.

**Correction to the brief:** this app does not use Inter. `globals.css:10-11` defines
`--font-heading: 'Space Grotesk', ...` and `--font-body: 'DM Sans', ...`, both already loaded and
used everywhere (dashboard, panelist portal, the current Recalibrate screen). The redesign keeps
both — `DM Sans` for body/UI text, `Space Grotesk` for the hero candidate name / headings — and
uses `Geist Mono` (or the existing `monospace` stack already used for the timer/scores, if `Geist
Mono` isn't already installed) for `Kbd`/timer/score digits only. No Inter, no new body font.

Rubric section differentiation (Technical vs. Behavioural) **already moved to left-border +
label** in a change made just before this redesign kicked off — the brief's target state for
this specific item is effectively done; Phase 2 only needs to re-home it inside `RubricDrawer`'s
tabs instead of two stacked sub-cards in a sidebar column.

Motion and elevation: adopt the brief's values as specified (120ms hover, 200ms
`cubic-bezier(0.2, 0.8, 0.2, 1)` drawer/slide, 2 shadow levels) — nothing in the current CSS
conflicts with this, it's simply undefined today (transitions are ad hoc / absent on most
elements, e.g. `ScoreDial`'s hover uses inline JS style mutation, not a CSS transition class).

---

## 1.5 State machine

**No new state library.** Phase 0 found no Zustand (or Redux/Jotai) anywhere in this codebase —
`useRecalibrateSession` is a plain hook built on `useState`/`useMemo`, and it's already the
correct shape for the API-backed state (scores, notes, timer, submission). Introducing Zustand
here would be a real new dependency for state that's small, single-consumer, and already
React-idiomatic — recommending against it unless you specifically want it (that's a dependency
decision, flagging per Global Rules rather than deciding it silently).

Plan: extend `useRecalibrateSession` with the **new pure-UI state** the redesign needs (none of
it touches the API):

```ts
// added to useRecalibrateSession's returned object — same function, same file
currentQuestionIndex: number          // Canvas position; was implicit (all questions rendered at once)
setCurrentQuestionIndex: (i: number) => void
drawerTab: 'rubric' | 'behavioural' | 'notes'
setDrawerTab: (t: DrawerTab) => void
autosaveState: 'idle' | 'saving' | 'saved' | 'error'   // derived from patchSession's existing fetch lifecycle
lastSavedAt: number | null
```

`autosaveState`/`lastSavedAt` are derived by instrumenting the existing `patchSession` function
(wrap its `try/catch` to flip `saving` → `saved`/`error`) — **no change to the PATCH request
shape, payload, or the `/api/interviews/[id]/recalibrate` contract**, purely local bookkeeping
around a call that already happens.

Selectors, computed the same way `avgQuestionScore`/`gap` already are today:
- `progress = scoredQuestionCount / questions.length`
- `canSubmit = scoredQuestionCount === questions.length && ratedDimCount === allDims.length` (new
  gate — today `handleToggleSubmit` has no precondition at all; confirm in Step 3 whether you
  want submission blocked on completeness or left as-is with just a visual nudge — **flagging as
  a product decision, not deciding it here**)
- `nextUnscoredQuestion = questions.find(q => typeof questionScores[q.id] !== 'number')` — powers
  a "jump to next unscored" affordance in `BottomActionBar`/`CommandPalette`.

Rail-collapsed and drawer-open-on-mobile are pure `localStorage`-backed `useState`, local to
`RecalibrateWorkspaceClient.tsx` / `RecalibrateWorkspace.tsx` respectively — not part of the
session hook, since they're not per-interview state.

---

## 1.6 Before → After diff table

| # | Problem (current) | Fix |
|---|---|---|
| 1 | 3-column grid renders Questions + Rubric + Interview simultaneously, all scrollable independently — everything visible at once, no focus | Single-question `QuestionCanvas` (hero) + `RightDrawer` (Rubric/Behavioural/Notes tabs) + `BottomActionBar` — one thing scored at a time |
| 2 | `.rc-rubric-col` and `.rc-interview-col` are each independently `position: sticky` with their own `overflow-y: auto` (`RecalibrateWorkspace.tsx`) — two competing scroll regions fighting the main page scroll | RightDrawer is the only secondary scroll region; Canvas and BottomActionBar don't scroll independently |
| 3 | Redundant headers: hero header + 5 separate `SectionHeader`s ("Spec Inputs", "Questions", "Overall Scoring Rubric", "Live Analysis", "Notes") each with their own icon+title row | One `TopBar`; in-canvas/drawer content uses lighter, contextual headers only where genuinely needed |
| 4 | "Live Analysis" (avg scores, gap banner) updates and is visible throughout the live interview — partial averages are visible and potentially distracting/misleading before scoring is complete | Renamed `SummaryView`, hidden during active scoring, surfaced after submission (or via an explicit "Preview summary" action) |
| 5 | ~15 scattered inline hex literals (`#a855f7`, `#7c3aed`, `#22c55e`, `#f59e0b`, `#6b7280`) across `RecalibrateWorkspace.tsx`, `CandidateRail.tsx`, `InterviewStopwatch.tsx`, `L1ReferencePanel.tsx` | Single `--rc-brand` token + the 4 existing semantic tokens; no other colors permitted in new components |
| 6 | Rubric band descriptions: current score inline (recent change), other 3 bands behind a `<details>` "View all bands" click | `RubricBand` renders the full 4-band ladder compactly by default in the drawer — no click needed to see all bands for the dimension currently in view |
| 7 | `ScoreDial` (`primitives.tsx`) is `onClick`-only; hover state is imperative inline JS (`onMouseEnter`/`onMouseLeave` mutating `style` directly), zero keyboard path exists today | `ScoreBar` is a real `role="radiogroup"` with `aria-checked`, CSS `:focus-visible` ring, and `1`–`4` keyboard scoring via `useHotkeys` |
| 8 | `InterviewStopwatch` is its own `.glass-card` box stacked in the sticky Interview column, competing with Live Analysis/Notes/Submit for the same vertical space | `Timer` folds into `TopBar`; Reset moves into a `DropdownMenu` overflow (Start/Pause/Resume stay one click) |
| 9 | Candidate switching is scan-a-static-list-plus-search-box only; no fast keyboard jump | `⌘K` `CommandPalette` (candidate search + "jump to question N") alongside the existing docked rail |
| 10 | Progress is only visible via the Questions card's small `ProgressBar` or a text line inside Live Analysis — invisible once you scroll past either | `ProgressChip` lives in `TopBar`, always visible regardless of scroll or drawer tab |
| 11 | Spec Inputs (role grade/style/count + Generate) permanently occupies the top of the single scrolling column, even collapsed, ahead of the actual question content | Same collapse-to-one-line behavior, but relocated off the Canvas's primary scroll path (compact disclosure above the Canvas, not competing with question real estate) |
| 12 | No end-to-end keyboard path exists for scoring an interview — mouse required for question nav, scoring, and drawer switching | Full `←/→ 1-4 N R B ⌘K ?` shortcut set, discoverable via `?` and per-control `KbdHintPopover`s |
| 13 | Notes autosave fires only on `onBlur` (`handleNotesBlur`) — no debounce, no visible save confirmation, and anything typed is unsaved until the field loses focus | 800ms debounced autosave + `AutosaveIndicator` live region (`idle/saving/saved/error` + timestamp) |
| 14 | 12 independent `<details>` disclosures (7 Technical + 4 Behavioural dimensions, one each) must be opened one at a time to review full rubric text | `RubricDrawer` shows one dimension's full band ladder at a time via `RubricBand`, reachable by tab + list, not 12 simultaneous toggles |

---

## 1.7 Accessibility contract

- **Hit targets:** every interactive element ≥44×44px. Concretely: `ScoreDial`'s current `size`
  prop defaults to 26–32px depending on context (`primitives.tsx`) — the new `ScoreBar`'s `lg`
  variant (used in `BottomActionBar`) must render at ≥44px even though the existing small/inline
  variant (used inside `RubricBand` rows) can stay visually compact as long as its *click target*
  (via padding, not just the visible dial) still meets 44px.
- **Focus rings:** 2px `--rc-brand` outline + 2px offset on every interactive element. This is a
  real gap today, not a hypothetical one — `ScoreDial` only defines hover behavior via inline
  `onMouseEnter`/`onMouseLeave` JS and has **no `:focus` or `:focus-visible` styling at all**, so
  keyboard users currently get no visible indication of which dial is focused. Fixing this is
  part of Step 3/Step 7, not optional polish.
- **Score buttons:** `ScoreBar` renders as `role="radiogroup"` with each dial as
  `role="radio" aria-checked`, wired to arrow-key navigation within the group per WAI-ARIA
  radiogroup pattern, in addition to the global `1`-`4` shortcuts.
- **Drawer:** `role="dialog"` + focus trap only when it's in overlay mode (<1440px or explicitly
  toggled via `R`/TopBar). Docked mode (≥1440px) is not a dialog — it's part of the page, so no
  trap, just normal tab order.
- **Live regions:** `AutosaveIndicator` and the "question scored" confirmation both use
  `aria-live="polite"` — confirmed via screen-reader spot check in Step 7, not just visual state.
- **Contrast:** the app's existing tokens are close to AA but not verified pair-by-pair. Two
  specific pairs to check first in Step 7's `axe` pass, since they're used constantly in this
  screen: `--text-muted` (`#64748B`) on `--bg-card` (`#ffffff`) — Slate-500-on-white sits right
  at the AA boundary (~4.6:1) for normal text; anything beyond a short label rendered in
  `--text-muted` should probably use `--text-main` instead. Second: the new `--rc-brand`
  (`#7c3aed`) as a *text* color on `--bg-card`/`--bg-main` in both themes — violet-600 on white
  is comfortably AA, but hasn't been checked against the dark-theme `--bg-card` (`#12151c`).
  Every other pair gets the same `axe-core` sweep before Step 7 is considered done — no pair is
  assumed to pass without the tool confirming it.
- **Dark mode mechanism, corrected:** Phase 0 found that `globals.css` has ~40
  `[data-theme="dark"] .foo {...}` rules that are **dead** — `next-themes` here is configured
  `attribute="class"`, so it only ever sets a `dark` class on `<html>`, never a `data-theme`
  attribute. All new accessibility/contrast work must target the mechanism that's actually live
  (`.dark &`/Tailwind `dark:` variant), not `[data-theme]`. This redesign does not attempt to
  clean up the dead `[data-theme]` rules elsewhere in the app — out of scope — but no new CSS
  for the console should be written against them.

---

## Open questions before Step 3

1. **Submission gating** (§1.5, `canSubmit`): should "Submit to recruiters" require all questions
   scored + all rubric dimensions rated, or stay ungated like today (just a nudge)? This changes
   real panelist-facing behavior, not just layout — needs your call before `BottomActionBar`
   wires it up.
2. **L1ReferencePanel placement**: today it's a full card at the top of the Interview column,
   always visible for L2 rounds. In the new shell it doesn't obviously belong in the Canvas
   (not something being scored) or a `RubricDrawer` tab (it's read-only reference, not input).
   Leaning toward a dismissible banner above the Canvas, collapsed by default with an "L1
   Reference" pill to reopen it — but this is a judgment call I'd rather confirm than assume.

---

## Global Rules acknowledgement

No files outside `src/app/recalibrate/**`, `src/components/recalibrate/**`, and the token
additions to `src/app/globals.css` are touched by this plan. No API route, DB schema, or
`useRecalibrateSession` request/response shape changes. `command`/`tabs`/`sheet`/`dialog` (shadcn)
and `react-hotkeys-hook` are the only new additions, both pre-approved in your brief. Each Phase 2
step lands as its own conventional-commit-style commit, gated on `tsc`/lint/build passing, with a
report of what to visually verify before the next step starts.
