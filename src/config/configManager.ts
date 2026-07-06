import { GenerationConfig } from "../core/types";

export const DEFAULT_CONFIG: GenerationConfig = {
  framework: "playwright",
  language: "typescript",
  style: "page-object-model",
  coverage: "comprehensive",
  includeErrorHandling: true,
  useFixtures: true,
  mockStrategy: "none",
  outputFormat: "all",
  model: process.env.TCGEN_MODEL || "claude-sonnet-4-6",
  temperature: envNum("TCGEN_TEMPERATURE", 0.7),
  maxTokens: envNum("TCGEN_MAX_TOKENS", 2000),
  parallelRequests: 5,
  evaluate: true,
  refineBelowScore: 75,
};

export const PRESETS: Record<string, Partial<GenerationConfig>> = {
  minimal: {
    coverage: "happy-path",
    style: "functional",
    includeErrorHandling: false,
    outputFormat: "json",
    evaluate: false,
  },
  standard: {
    coverage: "comprehensive",
    style: "page-object-model",
    includeErrorHandling: true,
    outputFormat: "all",
    evaluate: true,
  },
  comprehensive: {
    coverage: "all",
    style: "page-object-model",
    includeErrorHandling: true,
    outputFormat: "all",
    evaluate: true,
    temperature: 0.5,
  },
};

export class ConfigManager {
  static getConfig(
    preset?: string,
    overrides?: Partial<GenerationConfig>
  ): GenerationConfig {
    let config: GenerationConfig = { ...DEFAULT_CONFIG };
    if (preset && PRESETS[preset]) {
      config = { ...config, ...PRESETS[preset] };
    }
    if (overrides) {
      config = { ...config, ...overrides };
    }
    return config;
  }

  static presetNames(): string[] {
    return Object.keys(PRESETS);
  }
}

function envNum(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
