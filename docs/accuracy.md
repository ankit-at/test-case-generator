# Measuring test-case accuracy

A common question: *"How accurate are the generated test cases?"* This doc
explains what QA-FORGE measures today, the difference between a **quality score**
and a **true accuracy score**, and the layered approach to getting there.

## Quality score vs. accuracy score

QA-FORGE gives every generated case a **quality score** from an LLM-as-judge
pass. That's a strong confidence signal, but a model judging a model is *not the
same* as measured accuracy. Real accuracy needs an external reference — either a
known-correct answer, actual execution, or human acceptance.

We split this into layers, from cheapest/weakest to most rigorous.

## Layer 1 — LLM-as-judge rubric (implemented)

`src/evaluation/evaluator.ts`. A second model call scores each test 0–100 on
five weighted criteria:

| Criterion | Weight |
|---|---|
| Skill coverage | 25% |
| Automation readiness | 25% |
| Clarity | 20% |
| Completeness | 20% |
| Maintainability | 10% |

The score drives the UI, the run average, and the **auto-refine loop** (anything
below the threshold, default 75, is regenerated once and the better version
kept). It answers *"does this look like a good test?"* — a proxy, not a
guarantee.

## Layer 2 — Executability check (implemented)

`src/evaluation/executionValidator.ts` → `validateSpec(code)`. Deterministic,
no network, no browser. Attached to every generated case as `execution`:

- **compiles** — the spec is parsed by the TypeScript compiler (syntax valid).
- **testCount / hasAssertions** — is it actually a test that asserts something?
- **hardWaitCount** — flags `waitForTimeout` (flakiness).
- **unawaitedActions** — async Playwright actions missing `await`.
- **executabilityScore** (0–100) derived from the above.

This catches the failure mode where a test *scores 95 on the rubric but wouldn't
run*. A case that doesn't compile or has no assertions can't be accurate,
whatever the LLM thinks.

```ts
import { validateSpec } from "@ankit-at/qaforge";
const v = validateSpec(generatedCode);
// { compiles: true, hasAssertions: true, hardWaitCount: 0, executabilityScore: 100, issues: [] }
```

## Layer 3 — Execution accuracy (implemented, opt-in)

`runPlaywrightSpecs({ projectDir })`. Actually runs the generated specs through
Playwright and summarises **pass / fail / flaky / skipped** and a **pass rate**
from the JSON reporter. This is the strongest single signal — a test that
executes and passes against the real app is demonstrably accurate.

It's opt-in because it needs a runnable target app and installed browsers:

```ts
import { runPlaywrightSpecs } from "@ankit-at/qaforge";
const result = await runPlaywrightSpecs({ projectDir: "./e2e" });
// { total, passed, failed, flaky, skipped, passRate, durationMs }
```

Typical wiring: generate → write specs into a Playwright project → point
`runPlaywrightSpecs` at it in CI → record the pass rate per run.

## Layer 4 — Requirement coverage (roadmap)

Trace each BRD requirement/step to a generated assertion and report **% of
requirements with a verifying assertion** (a traceability matrix). Answers *"did
we test everything the requirement asked for?"* rather than *"is each test
good?"*.

## Layer 5 — Human acceptance (roadmap, the real ground truth)

In the web app, let reviewers **Accept / Edit / Reject** each case and store the
verdict. Over time, **acceptance rate** (and average edit distance) becomes your
real-world accuracy number — the metric to report to stakeholders — and can feed
back into the golden dataset and prompts.

## How the scores combine

| Signal | Question it answers | Cost |
|---|---|---|
| Rubric score (L1) | Does it look like a good test? | 1 LLM call |
| Executability (L2) | Would it even run? | free, instant |
| Execution pass rate (L3) | Does it pass against the app? | a test run |
| Coverage (L4) | Did we cover the requirement? | cheap |
| Acceptance rate (L5) | Do humans keep it? | ongoing |

Recommended reporting: show **L1 + L2 per case**, **L3 pass rate per run**, and
track **L5 acceptance** as the headline accuracy trend.
