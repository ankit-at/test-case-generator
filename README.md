# Test Case Generator

A command-line agent that turns a structured **skills inventory** (JSON) into
production-ready test cases. It parses and enriches each skill, builds a focused
prompt, generates a test through an LLM, optionally scores the result with an
LLM-as-judge pass, and writes the output as Playwright specs, JSON metadata and
an XLSX export.

```
Skills JSON ──▶ Parser ──▶ Prompt Builder ──▶ LLM ──▶ Evaluator ──▶ Formatter ──▶ Files
                 enrich       system+user      gen      score/refine    spec / json / xlsx
```

## Why

QA teams already describe what a feature should do as a list of discrete,
testable skills. This tool consumes that description directly and produces the
first draft of the automation, so the manual step becomes *review* instead of
*author from scratch*.

## Install

```bash
git clone https://github.com/<your-account>/test-case-generator.git
cd test-case-generator
npm install
cp .env.example .env   # then add your ANTHROPIC_API_KEY
```

## Usage

```bash
# Run against the bundled example
npm run dev -- --source examples/skills-inventory.json --preset standard

# With few-shot golden examples
npm run dev -- --source examples/skills-inventory.json --golden examples/golden-dataset.json

# Skip evaluation for a fast pass
npm run dev -- --preset minimal --no-eval

# Build and run the compiled CLI
npm run build
node dist/index.js --source examples/skills-inventory.json
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--source` | `examples/skills-inventory.json` | Skills inventory JSON |
| `--preset` | `standard` | `minimal` \| `standard` \| `comprehensive` |
| `--out` | `output` | Output directory |
| `--golden` | – | Golden dataset JSON for few-shot prompting |
| `--no-eval` | off | Skip the scoring/refinement pass |

Environment: `ANTHROPIC_API_KEY` (required), `TCGEN_MODEL`, `TCGEN_MAX_TOKENS`,
`TCGEN_TEMPERATURE` (optional overrides).

## Input format

A skills inventory is an array of categories, each holding atomic skills:

```json
[
  {
    "categoryId": "NAV001",
    "categoryName": "Navigation & Authentication",
    "skills": [
      {
        "skillId": "NAV_001_001",
        "skillName": "Navigate to Home Dashboard",
        "actionType": "Navigation",
        "steps": ["Navigate to ...", "Verify ... is visible"],
        "expectedResult": "Dashboard loads with all regions visible.",
        "elementSelectors": { "homeButton": "button[aria-label='HOME']" }
      }
    ]
  }
]
```

Each skill is an atomic, testable unit: `steps` are user actions,
`expectedResult` is a measurable outcome, and `elementSelectors` / `testData`
are optional but improve output quality.

## Output

Written to the `--out` directory:

- `generated.spec.ts` — Playwright test file
- `test-cases.json` — structured metadata (steps, assertions, tags, priority, score)
- `test-cases.xlsx` — spreadsheet export for review
- `quality-report.json` — aggregate scores and recommendations

## Architecture

| Module | Responsibility |
|--------|----------------|
| `core/skillParser.ts` | Validate JSON, enrich skills (complexity, tags, dependencies) |
| `core/promptBuilder.ts` | Build generation, evaluation and refinement prompts |
| `core/claudeClient.ts` | LLM calls, JSON extraction, retry with backoff |
| `generation/generator.ts` | Orchestrate batches, evaluate, refine low scorers |
| `generation/outputFormatter.ts` | Render Playwright / JSON / XLSX |
| `evaluation/evaluator.ts` | LLM-as-judge scoring and quality report |
| `config/configManager.ts` | Presets and defaults |

## Presets

- **minimal** — happy-path only, functional style, no evaluation. Fastest.
- **standard** — comprehensive coverage, page-object style, evaluation on.
- **comprehensive** — all scenarios, lower temperature for consistency.

Low-scoring tests (below the configured threshold, default 75) are automatically
refined once using the evaluator's feedback, and the higher-scoring version is kept.

## License

MIT
