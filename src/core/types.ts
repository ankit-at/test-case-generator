// Shared domain types for the test case generator.

export interface Skill {
  skillId: string;
  skillName: string;
  description?: string;
  actionType: string;
  steps: string[];
  expectedResult: string;
  testData?: Record<string, unknown>;
  elementSelectors?: Record<string, string>;
}

export interface SkillCategory {
  categoryId: string;
  categoryName: string;
  categoryDescription?: string;
  skills: Skill[];
}

export type Complexity = "simple" | "medium" | "complex";

export interface EnrichedSkill extends Skill {
  tags: string[];
  complexity: Complexity;
  dependencies: string[];
  estimatedTime: number;
  automationScore: number;
}

export interface AppMetadata {
  applicationName?: string;
  applicationURL?: string;
  applicationType?: string;
  description?: string;
}

export interface GenerationConfig {
  framework: "playwright" | "cypress";
  language: "javascript" | "typescript";
  style: "page-object-model" | "functional";
  coverage: "happy-path" | "comprehensive" | "all";
  includeErrorHandling: boolean;
  useFixtures: boolean;
  mockStrategy: "none" | "api-mocks" | "fixtures";
  outputFormat: "playwright" | "json" | "xlsx" | "all";
  model: string;
  temperature: number;
  maxTokens: number;
  parallelRequests: number;
  evaluate: boolean;
  refineBelowScore: number;
  appContext?: AppMetadata;
}

export interface GoldenTestCase {
  skillId: string;
  skillName: string;
  testCode: string;
  keyStrengths?: string[];
}

export interface PromptContext {
  goldenDataset?: GoldenTestCase[];
  appContext?: AppMetadata;
}

export interface TestMetadata {
  testName: string;
  steps: string[];
  assertions: string[];
  tags: string[];
  priority: "critical" | "high" | "medium" | "low";
  expectedResult?: string;
}

export interface GeneratedTestCase {
  skillId: string;
  framework: string;
  code: string;
  metadata: TestMetadata;
  rawResponse: string;
  timestamp: string;
  evaluation?: EvaluationScore;
}

export interface GenerationError {
  skillId: string;
  error: string;
  timestamp: string;
}

export interface EvaluationScore {
  skillCoverage: number;
  clarity: number;
  automationReadiness: number;
  completeness: number;
  maintainability: number;
  overallScore: number;
  strengths: string[];
  improvements: string[];
}

export interface QualityReport {
  totalTests: number;
  averageScore: number;
  lowScoringTests: string[];
  recommendations: string[];
  generatedAt: string;
}

export function isGenerationError(
  value: GeneratedTestCase | GenerationError
): value is GenerationError {
  return (value as GenerationError).error !== undefined;
}
