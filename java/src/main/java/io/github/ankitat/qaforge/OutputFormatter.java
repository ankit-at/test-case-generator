package io.github.ankitat.qaforge;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Renders generated test cases into Playwright source or JSON metadata. */
public final class OutputFormatter {

  public String formatPlaywright(List<GeneratedTestCase> testCases) {
    StringBuilder sb = new StringBuilder("import { test, expect } from '@playwright/test';\n\n");
    for (GeneratedTestCase tc : testCases) {
      sb.append("// ").append(tc.skillId).append(" - ").append(tc.metadata.testName()).append('\n');
      sb.append(stripFences(tc.code)).append("\n\n");
    }
    return sb.toString();
  }

  public String formatJson(List<GeneratedTestCase> testCases) {
    List<Map<String, Object>> cases = new ArrayList<>();
    for (GeneratedTestCase tc : testCases) {
      Map<String, Object> m = new LinkedHashMap<>();
      m.put("skillId", tc.skillId);
      m.put("testName", tc.metadata.testName());
      m.put("steps", tc.metadata.steps());
      m.put("assertions", tc.metadata.assertions());
      m.put("tags", tc.metadata.tags());
      m.put("priority", tc.metadata.priority());
      m.put("score", tc.evaluation != null ? tc.evaluation.overallScore() : null);
      m.put("code", tc.code);
      cases.add(m);
    }
    Map<String, Object> payload = new LinkedHashMap<>();
    Map<String, Object> meta = new LinkedHashMap<>();
    meta.put("totalTests", testCases.size());
    meta.put("framework", "playwright");
    payload.put("metadata", meta);
    payload.put("testCases", cases);
    return Json.stringify(payload);
  }

  private static String stripFences(String code) {
    return code.replaceAll("```(?:[a-zA-Z]+)?", "").trim();
  }
}
