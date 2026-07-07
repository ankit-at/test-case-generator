package io.github.ankitat.qaforge;

/** LLM-as-judge scoring for a generated test case. */
final class Evaluator {
  private final AnthropicClient client;
  private final PromptBuilder prompts;
  private final String model;

  Evaluator(AnthropicClient client, PromptBuilder prompts, String model) {
    this.client = client;
    this.prompts = prompts;
    this.model = model;
  }

  EvaluationScore score(GeneratedTestCase tc, Skill skill) {
    String text =
        client.message(
            prompts.evaluationSystemPrompt(), prompts.evaluationPrompt(tc, skill), model, 0.3, 1000);
    return Json.parse(Json.extractObject(text), EvaluationScore.class);
  }
}
