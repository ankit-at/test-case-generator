package io.github.ankitat.qaforge;

import java.util.List;

/** LLM-as-judge quality scores (0-100 each). */
public record EvaluationScore(
    int skillCoverage,
    int clarity,
    int automationReadiness,
    int completeness,
    int maintainability,
    int overallScore,
    List<String> strengths,
    List<String> improvements) {

  public EvaluationScore {
    strengths = strengths == null ? List.of() : strengths;
    improvements = improvements == null ? List.of() : improvements;
  }
}
