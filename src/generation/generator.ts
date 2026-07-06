import { SkillParser } from "../core/skillParser";
import { PromptBuilder } from "../core/promptBuilder";
import { ClaudeClient } from "../core/claudeClient";
import { EvaluationEngine } from "../evaluation/evaluator";
import {
  GenerationConfig,
  GeneratedTestCase,
  GenerationError,
  Skill,
  PromptContext,
} from "../core/types";

export interface GenerationResult {
  testCases: GeneratedTestCase[];
  errors: GenerationError[];
}

/**
 * Orchestrates parse -> prompt -> generate -> (evaluate/refine) for a skill set.
 */
export class TestCaseGenerator {
  private readonly prompts = new PromptBuilder();
  private readonly client: ClaudeClient;
  private readonly evaluator: EvaluationEngine;

  constructor(
    private readonly config: GenerationConfig,
    private readonly context: PromptContext = {},
    apiKey?: string
  ) {
    this.client = new ClaudeClient(config, apiKey);
    this.evaluator = new EvaluationEngine(this.client, this.prompts);
  }

  async generateForSkill(skill: Skill): Promise<GeneratedTestCase> {
    const system = this.prompts.buildSystemPrompt(this.config);
    const user = this.prompts.buildUserMessage(skill, this.config, this.context);
    let testCase = await this.client.generateTestCase(system, user, skill.skillId);

    if (this.config.evaluate) {
      testCase.evaluation = await this.evaluator.scoreTestCase(testCase, skill);

      if (
        testCase.evaluation.overallScore < this.config.refineBelowScore &&
        testCase.evaluation.improvements.length > 0
      ) {
        testCase = await this.refine(testCase, skill);
      }
    }

    return testCase;
  }

  async generate(skills: Skill[]): Promise<GenerationResult> {
    const testCases: GeneratedTestCase[] = [];
    const errors: GenerationError[] = [];
    const batchSize = Math.max(1, this.config.parallelRequests);

    for (let i = 0; i < skills.length; i += batchSize) {
      const batch = skills.slice(i, i + batchSize);
      const batchNo = Math.floor(i / batchSize) + 1;
      console.log(
        `Batch ${batchNo}: generating ${batch.length} test case(s)...`
      );

      const settled = await Promise.allSettled(
        batch.map((skill) => this.generateForSkill(skill))
      );

      settled.forEach((result, idx) => {
        if (result.status === "fulfilled") {
          const tc = result.value;
          const score = tc.evaluation
            ? ` (score ${tc.evaluation.overallScore})`
            : "";
          console.log(`  ok  ${tc.skillId}${score}`);
          testCases.push(tc);
        } else {
          const skillId = batch[idx].skillId;
          console.log(`  err ${skillId}: ${result.reason?.message ?? result.reason}`);
          errors.push({
            skillId,
            error: String(result.reason?.message ?? result.reason),
            timestamp: new Date().toISOString(),
          });
        }
      });
    }

    return { testCases, errors };
  }

  private async refine(
    testCase: GeneratedTestCase,
    skill: Skill
  ): Promise<GeneratedTestCase> {
    const system = this.prompts.buildSystemPrompt(this.config);
    const refinePrompt = this.prompts.buildRefinementPrompt(
      testCase,
      testCase.evaluation!.improvements
    );
    const improved = await this.client.generateTestCase(
      system,
      refinePrompt,
      skill.skillId
    );
    improved.evaluation = await this.evaluator.scoreTestCase(improved, skill);

    // Keep whichever scored higher.
    return improved.evaluation.overallScore >=
      (testCase.evaluation?.overallScore ?? 0)
      ? improved
      : testCase;
  }

  static parse(json: string): { parser: SkillParser; skills: Skill[] } {
    const parser = new SkillParser();
    const categories = parser.parseSkillInventory(json);
    return { parser, skills: parser.flatten(categories) };
  }
}
