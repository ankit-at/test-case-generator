package io.github.ankitat.qaforge;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;

/** Orchestrates generation (and optional evaluation) for a set of skills. */
public final class TestCaseGenerator {
  private final GenerationConfig config;
  private final String appContext;
  private final AnthropicClient client;
  private final PromptBuilder prompts = new PromptBuilder();
  private final Evaluator evaluator;

  public TestCaseGenerator(GenerationConfig config, String appContext, String apiKey) {
    this.config = config;
    this.appContext = appContext;
    this.client = new AnthropicClient(apiKey);
    this.evaluator = new Evaluator(client, prompts, config.model);
  }

  public GeneratedTestCase generateForSkill(Skill skill) {
    String system = prompts.systemPrompt(config);
    String user = prompts.userMessage(skill, config, appContext);
    String text = client.message(system, user, config.model, config.temperature, config.maxTokens);
    GeneratedTestCase tc = parse(skill.skillId(), text);
    if (config.evaluate) {
      tc.evaluation = evaluator.score(tc, skill);
    }
    return tc;
  }

  public GenerationResult generate(List<Skill> skills) {
    List<GeneratedTestCase> ok = new ArrayList<>();
    List<GenerationError> errors = new ArrayList<>();
    for (Skill skill : skills) {
      try {
        ok.add(generateForSkill(skill));
      } catch (RuntimeException e) {
        errors.add(new GenerationError(skill.skillId(), e.getMessage()));
      }
    }
    return new GenerationResult(ok, errors);
  }

  private GeneratedTestCase parse(String skillId, String text) {
    JsonNode n = Json.tree(Json.extractObject(text));
    TestMetadata meta =
        new TestMetadata(
            n.path("testName").asText(skillId),
            asList(n.path("steps")),
            asList(n.path("assertions")),
            asList(n.path("tags")),
            n.path("priority").asText("medium"),
            n.hasNonNull("expectedResult") ? n.get("expectedResult").asText() : null);
    return new GeneratedTestCase(skillId, config.framework, n.path("testCode").asText(""), meta);
  }

  private static List<String> asList(JsonNode node) {
    List<String> out = new ArrayList<>();
    if (node != null && node.isArray()) {
      node.forEach(e -> out.add(e.asText()));
    }
    return out;
  }
}
