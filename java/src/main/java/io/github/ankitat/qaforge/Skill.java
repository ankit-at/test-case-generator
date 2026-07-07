package io.github.ankitat.qaforge;

import java.util.List;
import java.util.Map;

/** An atomic, testable unit of behaviour. */
public record Skill(
    String skillId,
    String skillName,
    String description,
    String actionType,
    List<String> steps,
    String expectedResult,
    Map<String, Object> testData,
    Map<String, String> elementSelectors) {

  public Skill {
    steps = steps == null ? List.of() : steps;
  }
}
