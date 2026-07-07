package io.github.ankitat.qaforge;

import java.util.List;

/**
 * Public entry point for QA-FORGE.
 *
 * <pre>{@code
 * GenerationResult result = QAForge.generateTestCases(skills,
 *     GenerateOptions.create().preset(Preset.STANDARD));
 * String spec = new OutputFormatter().formatPlaywright(result.testCases());
 * }</pre>
 */
public final class QAForge {

  private QAForge() {}

  /** Generate test cases from a flat list of skills. */
  public static GenerationResult generateTestCases(List<Skill> skills, GenerateOptions options) {
    GenerateOptions opts = options != null ? options : GenerateOptions.create();
    TestCaseGenerator generator =
        new TestCaseGenerator(opts.resolveConfig(), opts.appContext, opts.resolveApiKey());
    return generator.generate(skills);
  }

  /** Generate from a skills-inventory JSON string. */
  public static GenerationResult generateFromInventory(String inventoryJson, GenerateOptions options) {
    SkillParser parser = new SkillParser();
    List<Skill> skills = parser.flatten(parser.parseInventory(inventoryJson));
    return generateTestCases(skills, options);
  }

  /** Result of {@link #generateFromText}: the extracted skills plus the generated cases. */
  public record FromTextResult(
      List<Skill> skills, List<GeneratedTestCase> testCases, List<GenerationError> errors) {}

  /** Extract a skills inventory from requirements text, then generate and score. */
  public static FromTextResult generateFromText(
      RequirementExtractor.Input input, GenerateOptions options) {
    GenerateOptions opts = options != null ? options : GenerateOptions.create();
    GenerationConfig config = opts.resolveConfig();
    String apiKey = opts.resolveApiKey();

    AnthropicClient client = new AnthropicClient(apiKey);
    RequirementExtractor extractor = new RequirementExtractor(client, config.model);
    SkillParser parser = new SkillParser();
    List<Skill> skills = parser.flatten(extractor.extract(input));
    if (skills.isEmpty()) {
      throw new RuntimeException("No testable skills were extracted from the text.");
    }

    TestCaseGenerator generator = new TestCaseGenerator(config, opts.appContext, apiKey);
    GenerationResult result = generator.generate(skills);
    return new FromTextResult(skills, result.testCases(), result.errors());
  }
}
