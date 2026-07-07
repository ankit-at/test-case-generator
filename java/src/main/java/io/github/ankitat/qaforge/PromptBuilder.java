package io.github.ankitat.qaforge;

import java.util.Map;

/** Builds generation and evaluation prompts. */
final class PromptBuilder {

  String systemPrompt(GenerationConfig c) {
    String lang = "typescript".equals(c.language) ? "TypeScript" : "JavaScript";
    return """
        You are an expert QA automation engineer specializing in %s.

        You generate production-ready test cases that are reliable (proper waits, no
        hard sleeps), maintainable (%s), and cover the happy path%s.

        Constraints:
        - Framework: %s
        - Language: %s
        - Error handling: %s

        Extract selectors from the provided elementSelectors and add meaningful
        assertions verifying the expected result.

        Return ONLY valid JSON. No markdown fences, no commentary. Shape:
        {
          "testName": "should ... and verify ...",
          "testCode": "complete runnable test",
          "steps": ["ordered test steps"],
          "expectedResult": "what should happen",
          "assertions": ["assertion statements"],
          "tags": ["relevant tags"],
          "priority": "critical|high|medium|low"
        }"""
        .formatted(
            c.framework,
            c.style,
            "happy-path".equals(c.coverage) ? "" : ", edge cases and error scenarios",
            c.framework,
            lang,
            c.includeErrorHandling ? "included" : "not required");
  }

  String userMessage(Skill skill, GenerationConfig c, String appContext) {
    StringBuilder sb = new StringBuilder("Generate a test case for the following skill:\n\n");
    sb.append("ID: ").append(skill.skillId()).append('\n');
    sb.append("Name: ").append(skill.skillName()).append('\n');
    if (skill.description() != null) sb.append("Description: ").append(skill.description()).append('\n');
    sb.append("Action Type: ").append(skill.actionType()).append("\n\nSTEPS:\n");
    int i = 1;
    for (String step : skill.steps()) sb.append(i++).append(". ").append(step).append('\n');
    sb.append("\nEXPECTED RESULT:\n").append(skill.expectedResult()).append('\n');

    if (skill.elementSelectors() != null && !skill.elementSelectors().isEmpty()) {
      sb.append("\nELEMENT SELECTORS:\n");
      for (Map.Entry<String, String> e : skill.elementSelectors().entrySet()) {
        sb.append("  ").append(e.getKey()).append(": ").append(e.getValue()).append('\n');
      }
    }
    if (skill.testData() != null && !skill.testData().isEmpty()) {
      sb.append("\nTEST DATA:\n").append(Json.stringify(skill.testData())).append('\n');
    }
    if (appContext != null && !appContext.isBlank()) {
      sb.append("\nAPPLICATION CONTEXT:\n").append(appContext).append('\n');
    }

    sb.append("\nREQUIREMENTS:\n");
    sb.append("- Framework: ").append(c.framework).append('\n');
    sb.append("- Language: ").append(c.language).append('\n');
    sb.append("- Style: ").append(c.style).append('\n');
    sb.append("- Coverage: ").append(c.coverage).append('\n');
    sb.append(c.includeErrorHandling ? "- Include error handling\n" : "- Skip error handling\n");
    sb.append("\nGenerate the test now. Return ONLY the JSON object.");
    return sb.toString();
  }

  String evaluationSystemPrompt() {
    return "You are a senior QA reviewer scoring a generated test case. Score each"
        + " criterion 0-100 and be strict. Return ONLY valid JSON, no markdown.";
  }

  String evaluationPrompt(GeneratedTestCase tc, Skill skill) {
    return """
        Evaluate this generated test case.

        SKILL:
        %s

        GENERATED TEST:
        %s

        Score (0-100) on: skillCoverage (25%%), clarity (20%%), automationReadiness (25%%),
        completeness (20%%), maintainability (10%%).

        Return ONLY this JSON:
        {
          "skillCoverage": 0, "clarity": 0, "automationReadiness": 0,
          "completeness": 0, "maintainability": 0, "overallScore": 0,
          "strengths": ["..."], "improvements": ["..."]
        }"""
        .formatted(
            Json.stringify(
                Map.of(
                    "skillId", skill.skillId(),
                    "skillName", skill.skillName(),
                    "steps", skill.steps(),
                    "expectedResult", skill.expectedResult())),
            tc.code);
  }
}
