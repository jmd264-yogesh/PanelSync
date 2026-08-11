// Eval runner.
//
//   npm run eval          offline — guardrails, error classification, retry policy.
//                         No network, no API key, deterministic. Safe for CI.
//   npm run eval:live     also exercises the real generation pipeline against Gemini.
//                         Costs tokens; needs GEMINI_API_KEY.
//
// Exits non-zero on any failure so it can gate a merge.

import { inspectQuestionSet, blockingFindings, summarizeFindings } from '../src/lib/ai/guardrails';
import { classifyProviderError, AiError } from '../src/lib/ai/errors';
import { withRetry, computeDelayMs, type RetryPolicy } from '../src/lib/ai/retry';
import { GUARDRAIL_CASES, ERROR_CASES } from './cases';

interface Result { name: string; passed: boolean; detail?: string }

const results: Result[] = [];
let currentSuite = '';

function suite(name: string) {
  currentSuite = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

function record(name: string, passed: boolean, detail?: string) {
  results.push({ name: `${currentSuite} › ${name}`, passed, detail });
  const mark = passed ? '\x1b[32m  PASS\x1b[0m' : '\x1b[31m  FAIL\x1b[0m';
  console.log(`${mark}  ${name}`);
  if (!passed && detail) console.log(`        \x1b[90m${detail}\x1b[0m`);
}

// ── Suite 1: guardrails ──────────────────────────────────────────────────────

function runGuardrailCases() {
  suite('Guardrails');
  for (const testCase of GUARDRAIL_CASES) {
    const findings = inspectQuestionSet(testCase.questionSet, testCase.context);
    const codes = new Set(findings.map((f) => f.code));
    const blocking = blockingFindings(findings);
    const problems: string[] = [];

    for (const expected of testCase.expectCodes ?? []) {
      if (!codes.has(expected)) problems.push(`expected finding "${expected}" was not raised`);
    }
    for (const forbidden of testCase.forbidCodes ?? []) {
      if (codes.has(forbidden)) problems.push(`finding "${forbidden}" fired but should not have`);
    }
    if (testCase.expectBlocking && blocking.length === 0) {
      problems.push('expected the set to be blocked, but nothing blocking was found');
    }
    if (!testCase.expectBlocking && blocking.length > 0) {
      problems.push(`expected the set to pass, but it was blocked by: ${summarizeFindings(blocking)}`);
    }

    record(
      testCase.name,
      problems.length === 0,
      problems.length ? `${problems.join('; ')}\n        actual: ${summarizeFindings(findings) || 'no findings'}` : undefined,
    );
  }
}

// ── Suite 2: error classification ────────────────────────────────────────────

function runErrorCases() {
  suite('Error classification');
  for (const testCase of ERROR_CASES) {
    const classified = classifyProviderError(testCase.error);
    const problems: string[] = [];
    if (classified.kind !== testCase.expectKind) {
      problems.push(`expected kind ${testCase.expectKind}, got ${classified.kind}`);
    }
    if (classified.retryable !== testCase.expectRetryable) {
      problems.push(`expected retryable=${testCase.expectRetryable}, got ${classified.retryable}`);
    }
    record(testCase.name, problems.length === 0, problems.join('; '));
  }
}

// ── Suite 3: retry policy ────────────────────────────────────────────────────

// Virtual clock: the policy is exercised in full without the suite ever sleeping.
function makeFakeDeps() {
  let clock = 0;
  return {
    deps: {
      sleep: async (ms: number) => { clock += ms; },
      random: () => 1, // worst-case backoff, so delay caps are actually tested
      now: () => clock,
    },
    advance: (ms: number) => { clock += ms; },
    elapsed: () => clock,
  };
}

const TEST_POLICY: RetryPolicy = {
  maxAttempts: 4,
  baseDelayMs: 100,
  maxDelayMs: 1_000,
  deadlineMs: 10_000,
  attemptTimeoutMs: 5_000,
};

async function runRetryCases() {
  suite('Retry policy');

  {
    let calls = 0;
    const { deps } = makeFakeDeps();
    const value = await withRetry(async () => {
      calls += 1;
      if (calls < 3) throw Object.assign(new Error('overloaded'), { status: 503 });
      return 'recovered';
    }, TEST_POLICY, undefined, deps);
    record('retries a transient 503 and eventually succeeds', value === 'recovered' && calls === 3, `calls=${calls}, value=${value}`);
  }

  {
    let calls = 0;
    const { deps } = makeFakeDeps();
    let thrown: AiError | null = null;
    try {
      await withRetry(async () => {
        calls += 1;
        throw Object.assign(new Error('API key not valid'), { status: 401 });
      }, TEST_POLICY, undefined, deps);
    } catch (err) { thrown = err as AiError; }
    record('does not retry a non-retryable auth failure', calls === 1 && thrown?.kind === 'AUTH', `calls=${calls} (expected 1), kind=${thrown?.kind}`);
  }

  {
    let calls = 0;
    const { deps } = makeFakeDeps();
    let thrown: AiError | null = null;
    try {
      await withRetry(async () => {
        calls += 1;
        throw Object.assign(new Error('overloaded'), { status: 503 });
      }, TEST_POLICY, undefined, deps);
    } catch (err) { thrown = err as AiError; }
    record('gives up after maxAttempts on a persistent failure', calls === TEST_POLICY.maxAttempts && thrown?.kind === 'OVERLOADED', `calls=${calls} (expected ${TEST_POLICY.maxAttempts})`);
  }

  {
    // Each attempt burns most of the deadline, so the loop must stop early rather than
    // running the full attempt budget.
    let calls = 0;
    const fake = makeFakeDeps();
    try {
      await withRetry(async () => {
        calls += 1;
        fake.advance(4_000);
        throw Object.assign(new Error('overloaded'), { status: 503 });
      }, { ...TEST_POLICY, deadlineMs: 6_000 }, undefined, fake.deps);
    } catch { /* expected */ }
    record('stops once the overall deadline is exhausted', calls < TEST_POLICY.maxAttempts, `calls=${calls}, expected fewer than ${TEST_POLICY.maxAttempts}`);
  }

  {
    const capped = computeDelayMs(10, TEST_POLICY, () => 1);
    record('caps exponential backoff at maxDelayMs', capped === TEST_POLICY.maxDelayMs, `got ${capped}, expected ${TEST_POLICY.maxDelayMs}`);
  }

  {
    // Full jitter must be able to produce a short delay — that's what desynchronises
    // simultaneous retries after a provider outage.
    const jittered = computeDelayMs(3, TEST_POLICY, () => 0);
    record('applies full jitter to the backoff delay', jittered === 0, `got ${jittered}, expected 0 with random()=0`);
  }
}

// ── Suite 4 (opt-in): live pipeline ──────────────────────────────────────────

async function runLiveCases() {
  suite('Live pipeline (Gemini)');

  if (!process.env.GEMINI_API_KEY) {
    record('GEMINI_API_KEY present', false, 'Set it, or run with: node --env-file=.env ...');
    return;
  }

  const { generateQuestionSetAgentic } = await import('../src/lib/ai/generate');
  const { deriveFocusAreas, BEHAVIOURAL_CATEGORIES, BEHAVIOURAL_CATEGORY_LABEL } = await import('../src/lib/ai/org-rubric');
  const behaviouralCategories = BEHAVIOURAL_CATEGORIES.map((c) => BEHAVIOURAL_CATEGORY_LABEL[c]);

  const scenarios = [
    { name: 'SE / L1 / foundational', roleGrade: 'se' as const, style: 'foundational' as const, questionCount: 5, techStacks: ['sql', 'dataPipeline'] as const, round: 'L1' as const },
    { name: 'Enabler / L2 / practical', roleGrade: 'enabler' as const, style: 'practical' as const, questionCount: 6, techStacks: ['snowflake', 'pyspark', 'dbt'] as const, round: 'L2' as const },
    { name: 'Consultant / L2 / practical', roleGrade: 'ssc' as const, style: 'practical' as const, questionCount: 5, techStacks: ['azureDatabricks', 'sql'] as const, round: 'L2' as const },
  ];

  for (const scenario of scenarios) {
    const spec = {
      roleGrade: scenario.roleGrade,
      style: scenario.style,
      questionCount: scenario.questionCount,
      techStacks: [...scenario.techStacks],
    };
    try {
      const focusAreas = deriveFocusAreas(spec.roleGrade, spec.techStacks);
      const { questionSet, diagnostics } = await generateQuestionSetAgentic({
        spec,
        focusAreas,
        behaviouralCategories,
        round: scenario.round,
      });

      const blocking = blockingFindings(diagnostics.finalFindings);
      const warnings = diagnostics.finalFindings.filter((f) => f.severity === 'warn');
      const detail = [
        `${questionSet.questions.length} questions`,
        `${diagnostics.latencyMs}ms`,
        `${diagnostics.tokenUsage.totalTokens} tokens`,
        `stages=${diagnostics.stages.map((s) => `${s.stage}:${s.blockingCount}`).join('>')}`,
        diagnostics.critique ? `critic=${diagnostics.critique.score}/5 (${diagnostics.critique.verdict})` : 'critic=unavailable',
        diagnostics.revisionApplied ? 'revised' : 'no-revision',
        warnings.length ? `warns=${summarizeFindings(warnings)}` : 'no-warns',
      ].join(' · ');

      record(`${scenario.name} produces a clean set`, blocking.length === 0, detail);
      console.log(`        \x1b[90m${detail}\x1b[0m`);

      if (diagnostics.critique) {
        record(`${scenario.name} scores >= 3/5 from the critic`, diagnostics.critique.score >= 3, `critic said: ${diagnostics.critique.summary}`);
      }
    } catch (err) {
      const aiErr = err instanceof AiError ? err : classifyProviderError(err);
      record(`${scenario.name} produces a clean set`, false, `${aiErr.kind}: ${aiErr.message}`);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const live = process.argv.includes('--live');

  console.log('\x1b[1mRecalibrate AI evals\x1b[0m');
  console.log(`\x1b[90mmode: ${live ? 'offline + live' : 'offline only (pass --live to exercise the real model)'}\x1b[0m`);

  runGuardrailCases();
  runErrorCases();
  await runRetryCases();
  if (live) await runLiveCases();

  const failed = results.filter((r) => !r.passed);
  console.log(`\n\x1b[1m${results.length - failed.length}/${results.length} passed\x1b[0m`);
  if (failed.length > 0) {
    console.log('\n\x1b[31mFailures:\x1b[0m');
    for (const f of failed) console.log(`  - ${f.name}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\x1b[31mEval runner crashed:\x1b[0m', err);
  process.exit(1);
});
