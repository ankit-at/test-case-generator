import { ClaudeClient } from "../core/claudeClient";
import { PromptBuilder } from "../core/promptBuilder";
import {
  GeneratedTestCase,
  Skill,
  EvaluationScore,
  QualityReport,
} from "../core/types";

/**
 * Scores generated tests with an LLM-as-judge and aggregates a quality report.
 */
export class EvaluationEngine {
  constructor(
    private readonly client: ClaudeClient,
    private readonly prompts: PromptBuilder
  ) {}

  async scoreTestCase(
    testCase: GeneratedTestCase,
    skill: Skill
  ): Promise<EvaluationScore> {
    const system = this.prompts.buildEvaluationSystemPrompt();
    const prompt = this.prompts.buildEvaluationPrompt(testCase, skill);
    return this.client.evaluate(system, prompt);
  }

  buildReport(testCases: GeneratedTestCase[]): QualityReport {
    const scored = testCases.filter((t) => t.evaluation);
    const total = scored.length;
    const avg =
      total === 0
        ? 0
        : Math.round(
            scored.reduce((s, t) => s + (t.evaluation!.overallScore || 0), 0) /
              total
          );

    const low = scored
      .filter((t) => (t.evaluation!.overallScore || 0) < 70)
      .map((t) => t.skillId);

    const recommendations: string[] = [];
    if (total === 0) {
      recommendations.push("Evaluation was disabled; no quality scores collected.");
    }
    if (avg > 0 && avg < 75) {
      recommendations.push(
        "Average score below 75 - strengthen the system prompt or golden examples."
      );
    }
    if (low.length > 0) {
      recommendations.push(`Review ${low.length} test(s) scoring below 70.`);
    }

    return {
      totalTests: testCases.length,
      averageScore: avg,
      lowScoringTests: low,
      recommendations,
      generatedAt: new Date().toISOString(),
    };
  }
}
