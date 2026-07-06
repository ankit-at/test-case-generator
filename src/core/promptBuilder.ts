import { Skill, GenerationConfig, PromptContext, GeneratedTestCase } from "./types";

/**
 * Constructs system and user prompts for generation and evaluation.
 */
export class PromptBuilder {
  buildSystemPrompt(config: GenerationConfig): string {
    const lang =
      config.language === "typescript" ? "TypeScript" : "JavaScript";
    return `You are an expert QA automation engineer specializing in ${config.framework}.

You generate production-ready test cases that are:
1. Reliable - proper wait strategies, correct handling of async operations, no hard sleeps.
2. Maintainable - ${config.style} architecture, reusable helpers, DRY.
3. Comprehensive - cover the happy path${
      config.coverage === "happy-path" ? "" : ", edge cases and error scenarios"
    }.
4. Well documented - descriptive names and comments for non-obvious logic.

Constraints:
- Framework: ${config.framework}
- Language: ${lang}
- Style: ${config.style}
- Error handling: ${config.includeErrorHandling ? "included" : "not required"}
- External APIs: ${
      config.mockStrategy === "none" ? "use real calls" : "mock via " + config.mockStrategy
    }

Extract selectors from the provided elementSelectors. Add meaningful assertions
that verify the skill's expected result.

Return ONLY valid JSON. No markdown fences, no commentary. Shape:
{
  "testName": "should ... and verify ...",
  "testCode": "complete runnable test",
  "steps": ["ordered test steps"],
  "expectedResult": "what should happen",
  "assertions": ["assertion statements"],
  "tags": ["relevant tags"],
  "priority": "critical|high|medium|low"
}`;
  }

  buildUserMessage(
    skill: Skill,
    config: GenerationConfig,
    context?: PromptContext
  ): string {
    let msg = "Generate a test case for the following skill:\n\n";
    msg += this.formatSkill(skill);

    const app = context?.appContext ?? config.appContext;
    if (app) {
      msg += "\nAPPLICATION CONTEXT:\n";
      if (app.applicationName) msg += `  Name: ${app.applicationName}\n`;
      if (app.applicationURL) msg += `  URL: ${app.applicationURL}\n`;
      if (app.applicationType) msg += `  Type: ${app.applicationType}\n`;
      if (app.description) msg += `  Notes: ${app.description}\n`;
    }

    const golden = context?.goldenDataset ?? [];
    if (golden.length > 0) {
      msg += "\nREFERENCE EXAMPLES (match this quality):\n\n";
      for (const ex of golden.slice(0, 2)) {
        msg += `Example: ${ex.skillName}\n`;
        if (ex.keyStrengths?.length) {
          msg += `Strengths: ${ex.keyStrengths.join(", ")}\n`;
        }
        msg += "```\n" + ex.testCode + "\n```\n\n";
      }
    }

    msg += "\nREQUIREMENTS:\n";
    msg += `- Framework: ${config.framework}\n`;
    msg += `- Language: ${config.language}\n`;
    msg += `- Style: ${config.style}\n`;
    msg += `- Coverage: ${config.coverage}\n`;
    msg += `- ${config.includeErrorHandling ? "Include" : "Skip"} error handling\n`;
    msg += "\nGenerate the test now. Return ONLY the JSON object.";
    return msg;
  }

  buildEvaluationSystemPrompt(): string {
    return `You are a senior QA reviewer scoring the quality of a generated test case.
Score each criterion independently from 0-100 and be strict.
Return ONLY valid JSON, no markdown.`;
  }

  buildEvaluationPrompt(testCase: GeneratedTestCase, skill: Skill): string {
    return `Evaluate this generated test case.

SKILL:
${JSON.stringify(this.skillForEval(skill), null, 2)}

GENERATED TEST:
\`\`\`
${testCase.code}
\`\`\`

Score (0-100) on:
1. skillCoverage (25%): verifies all steps and the expected result.
2. clarity (20%): clear name, logical steps, comments where needed.
3. automationReadiness (25%): reliable in CI, proper waits, no hard sleeps.
4. completeness (20%): happy path plus edge/error scenarios where relevant.
5. maintainability (10%): reusable structure, DRY.

Return ONLY this JSON:
{
  "skillCoverage": 0,
  "clarity": 0,
  "automationReadiness": 0,
  "completeness": 0,
  "maintainability": 0,
  "overallScore": 0,
  "strengths": ["..."],
  "improvements": ["..."]
}`;
  }

  buildRefinementPrompt(
    testCase: GeneratedTestCase,
    improvements: string[]
  ): string {
    return `Improve the following test case.

CURRENT TEST:
\`\`\`
${testCase.code}
\`\`\`

ISSUES TO FIX:
${improvements.map((i) => `- ${i}`).join("\n")}

Keep the overall structure and test name intent. Address every issue.
Return ONLY the JSON object in the same shape as before.`;
  }

  private formatSkill(skill: Skill): string {
    let out = `ID: ${skill.skillId}\n`;
    out += `Name: ${skill.skillName}\n`;
    if (skill.description) out += `Description: ${skill.description}\n`;
    out += `Action Type: ${skill.actionType}\n\nSTEPS:\n`;
    skill.steps.forEach((s, i) => (out += `${i + 1}. ${s}\n`));
    out += `\nEXPECTED RESULT:\n${skill.expectedResult}\n`;

    if (skill.elementSelectors && Object.keys(skill.elementSelectors).length) {
      out += "\nELEMENT SELECTORS:\n";
      for (const [k, v] of Object.entries(skill.elementSelectors)) {
        out += `  ${k}: ${v}\n`;
      }
    }
    if (skill.testData && Object.keys(skill.testData).length) {
      out += "\nTEST DATA:\n" + JSON.stringify(skill.testData, null, 2) + "\n";
    }
    return out;
  }

  private skillForEval(skill: Skill) {
    return {
      skillId: skill.skillId,
      skillName: skill.skillName,
      steps: skill.steps,
      expectedResult: skill.expectedResult,
    };
  }
}
