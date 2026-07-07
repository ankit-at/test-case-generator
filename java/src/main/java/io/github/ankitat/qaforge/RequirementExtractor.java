package io.github.ankitat.qaforge;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.List;

/** Requirements text (e.g. a BRD) into a structured skills inventory. */
public final class RequirementExtractor {

  /** Input for extraction. Only {@code text} is required. */
  public record Input(
      String text, String title, String moduleContext, List<String> scopeTypes, String scopeNotes) {}

  private final AnthropicClient client;
  private final String model;

  public RequirementExtractor(AnthropicClient client, String model) {
    this.client = client;
    this.model = model;
  }

  public List<SkillCategory> extract(Input input) {
    String system =
        """
        You are a QA analyst. You read requirements and decompose them into atomic,
        testable skills grouped into categories.

        Return ONLY valid JSON (no markdown) as an array of categories in this shape:
        [
          {
            "categoryId": "SHORT_CODE",
            "categoryName": "Human readable category",
            "categoryDescription": "one line",
            "skills": [
              {
                "skillId": "CODE_001",
                "skillName": "Concise action-oriented name",
                "description": "what this verifies",
                "actionType": "Navigation|Input|Click|Verification|Workflow|API",
                "steps": ["ordered user actions"],
                "expectedResult": "measurable outcome"
              }
            ]
          }
        ]

        Rules: each skill is one atomic, independently testable unit; steps are user
        actions; expectedResult is measurable; only include skills relevant to the
        requested scope; prefer 1-6 skills per category.""";

    String scope =
        (input.scopeTypes() == null || input.scopeTypes().isEmpty())
            ? "functional"
            : String.join(", ", input.scopeTypes());

    StringBuilder user = new StringBuilder();
    if (input.title() != null) user.append("TITLE: ").append(input.title()).append("\n\n");
    user.append("REQUESTED TEST SCOPE: ").append(scope).append('\n');
    if (input.scopeNotes() != null) user.append("SCOPE NOTES: ").append(input.scopeNotes()).append('\n');
    if (input.moduleContext() != null)
      user.append("MODULE CONTEXT:\n").append(input.moduleContext()).append("\n\n");
    user.append("REQUIREMENTS:\n\"\"\"\n").append(truncate(input.text())).append("\n\"\"\"\n\n");
    user.append("Extract the skills inventory now. Return ONLY the JSON array.");

    String text = client.message(system, user.toString(), model, 0.4, 4000);
    String array = Json.extractArray(text);
    try {
      return Json.MAPPER.readValue(array, new TypeReference<List<SkillCategory>>() {});
    } catch (Exception e) {
      throw new RuntimeException("Extractor returned invalid JSON: " + e.getMessage(), e);
    }
  }

  private static String truncate(String text) {
    int max = 24000;
    return text.length() > max ? text.substring(0, max) + "\n...[truncated]" : text;
  }
}
