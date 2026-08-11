# AI evals

Regression suite for the Recalibrate question-generation pipeline.

```bash
npm run eval        # offline: guardrails, error classification, retry policy
npm run eval:live   # the above, plus real Gemini calls (costs tokens, needs GEMINI_API_KEY)
```

Exits non-zero on any failure, so `npm run eval` is safe to gate a merge on.

## Why two modes

The offline suite is the one that runs constantly. It's deterministic, free, needs no
network or API key, and finishes in under a second, because it tests the parts of the
pipeline that are *supposed* to be deterministic:

- **Guardrails** — feed known-good and deliberately-defective question sets through
  `inspectQuestionSet` and assert exactly which findings fire.
- **Error classification** — assert that a Gemini 503 is retryable and a bad API key
  isn't, using real error shapes captured from production logs.
- **Retry policy** — exercise backoff, attempt caps, and deadline handling against a
  virtual clock, so the suite never actually sleeps and never flakes.

The live suite is opt-in because it costs money and can fail for reasons that aren't
your fault (provider outage). It generates real question sets across several role
grade / round / tech-stack combinations and asserts the pipeline output is clean,
reporting critic scores, latency, and token spend per scenario.

## Adding a guardrail

Guardrails live in `src/lib/ai/guardrails.ts`, and every one of them should arrive with
**two** cases in `cases.ts`:

1. a defective set that must trigger it, and
2. a legitimate set that must *not*.

The second is the one that matters. A safety rule that fires on
`"how do you manage schema changes?"` because the word "manage" resembles "marital" is
worse than no rule at all — it gets switched off, and then nothing is checked. The
false-positive cases already in the table (`does not flag legitimate use of the words
age/manage/family`, `does not mistake experience ranges for phone numbers`) exist
because those were real risks in the patterns as written.

## Why there's a compile step

The app's `tsconfig.json` targets the Next.js bundler, which resolves extensionless
relative imports (`from './errors'`). Plain Node ESM doesn't. Rather than rewrite app
source to suit the test runner — or add a runtime dependency like `tsx` — `evals/tsconfig.json`
compiles the eval graph to CommonJS in `.evals-dist/` (gitignored) and runs it from
there. Zero new dependencies; app source untouched.

## What is deliberately *not* covered here

- **Prompt wording quality.** Changing a prompt and re-running `eval:live` tells you
  whether output still passes the bar, not whether it got *better*. Judging that needs
  a human reading the questions, or a much larger scored sample than is worth running
  on every change.
- **The critic's own judgement.** It's an LLM; its scores aren't stable enough to assert
  exact values against. The live suite asserts a floor (>= 3/5) and prints the score so
  drift is visible, rather than pretending it's deterministic.
