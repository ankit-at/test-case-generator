package io.github.ankitat.qaforge;

import java.util.List;

/** Structured metadata for a generated test case. */
public record TestMetadata(
    String testName,
    List<String> steps,
    List<String> assertions,
    List<String> tags,
    String priority,
    String expectedResult) {

  public TestMetadata {
    steps = steps == null ? List.of() : steps;
    assertions = assertions == null ? List.of() : assertions;
    tags = tags == null ? List.of() : tags;
    priority = priority == null ? "medium" : priority;
  }
}
