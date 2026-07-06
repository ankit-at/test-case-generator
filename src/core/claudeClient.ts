import Anthropic from "@anthropic-ai/sdk";
import {
  GeneratedTestCase,
  GenerationConfig,
  EvaluationScore,
} from "./types";

/**
 * Thin wrapper around the Anthropic SDK with JSON extraction and retries.
 */
export class ClaudeClient {
  private readonly client: Anthropic;

  constructor(
    private readonly config: GenerationConfig,
    apiKey?: string
  ) {
    const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to your environment or a .env file."
      );
    }
    this.client = new Anthropic({ apiKey: key });
  }

  async generateTestCase(
    systemPrompt: string,
    userMessage: string,
    skillId: string
  ): Promise<GeneratedTestCase> {
    const text = await this.callWithRetry(
      systemPrompt,
      userMessage,
      this.config.temperature,
      this.config.maxTokens
    );
    const parsed = extractJson(text);

    return {
      skillId,
      framework: this.config.framework,
      code: String(parsed.testCode ?? ""),
      metadata: {
        testName: String(parsed.testName ?? skillId),
        steps: toStringArray(parsed.steps),
        assertions: toStringArray(parsed.assertions),
        tags: toStringArray(parsed.tags),
        priority: normalizePriority(parsed.priority),
        expectedResult: parsed.expectedResult
          ? String(parsed.expectedResult)
          : undefined,
      },
      rawResponse: text,
      timestamp: new Date().toISOString(),
    };
  }

  async evaluate(
    systemPrompt: string,
    evaluationPrompt: string
  ): Promise<EvaluationScore> {
    // Lower temperature for consistent scoring.
    const text = await this.callWithRetry(
      systemPrompt,
      evaluationPrompt,
      0.3,
      1000
    );
    const parsed = extractJson(text);
    return {
      skillCoverage: num(parsed.skillCoverage),
      clarity: num(parsed.clarity),
      automationReadiness: num(parsed.automationReadiness),
      completeness: num(parsed.completeness),
      maintainability: num(parsed.maintainability),
      overallScore: num(parsed.overallScore),
      strengths: toStringArray(parsed.strengths),
      improvements: toStringArray(parsed.improvements),
    };
  }

  private async callWithRetry(
    system: string,
    user: string,
    temperature: number,
    maxTokens: number,
    maxRetries = 3
  ): Promise<string> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: this.config.model,
          max_tokens: maxTokens,
          temperature,
          system,
          messages: [{ role: "user", content: user }],
        });
        const block = response.content[0];
        if (!block || block.type !== "text") {
          throw new Error("Unexpected non-text response.");
        }
        return block.text;
      } catch (err) {
        lastError = err as Error;
        if (attempt < maxRetries) {
          const delay = 2 ** (attempt - 1) * 1000;
          await sleep(delay);
        }
      }
    }
    throw lastError ?? new Error("Request failed after retries.");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJson(text: string): Record<string, any> {
  // Strip common markdown fences before matching.
  const cleaned = text.replace(/```(?:json)?/gi, "");
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("No JSON object found in model response.");
  }
  return JSON.parse(match[0]);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v));
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizePriority(
  value: unknown
): "critical" | "high" | "medium" | "low" {
  const v = String(value ?? "medium").toLowerCase();
  if (v === "critical" || v === "high" || v === "medium" || v === "low") {
    return v;
  }
  return "medium";
}
