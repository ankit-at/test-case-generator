import Ajv from "ajv";
import {
  Skill,
  SkillCategory,
  EnrichedSkill,
  Complexity,
} from "./types";

const skillSchema = {
  type: "object",
  required: ["skillId", "skillName", "actionType", "steps", "expectedResult"],
  additionalProperties: true,
  properties: {
    skillId: { type: "string" },
    skillName: { type: "string" },
    description: { type: "string", nullable: true },
    actionType: { type: "string" },
    steps: { type: "array", items: { type: "string" } },
    expectedResult: { type: "string" },
    testData: { type: "object", nullable: true },
    elementSelectors: { type: "object", nullable: true },
  },
} as const;

const categorySchema = {
  type: "array",
  items: {
    type: "object",
    required: ["categoryId", "categoryName", "skills"],
    additionalProperties: true,
    properties: {
      categoryId: { type: "string" },
      categoryName: { type: "string" },
      categoryDescription: { type: "string", nullable: true },
      skills: { type: "array", items: skillSchema },
    },
  },
} as any;

/**
 * Parses, validates and enriches a skills inventory document.
 */
export class SkillParser {
  private readonly ajv = new Ajv({ allErrors: true });
  private readonly validate = this.ajv.compile(categorySchema);

  parseSkillInventory(json: string): SkillCategory[] {
    let data: unknown;
    try {
      data = JSON.parse(json);
    } catch (err) {
      throw new Error(
        `Skills inventory is not valid JSON: ${(err as Error).message}`
      );
    }

    if (!Array.isArray(data)) {
      throw new Error("Skills inventory must be an array of categories.");
    }

    if (!this.validate(data)) {
      const detail = (this.validate.errors || [])
        .map((e) => `${e.instancePath || "(root)"} ${e.message}`)
        .join("; ");
      throw new Error(`Skills inventory failed validation: ${detail}`);
    }

    return data as SkillCategory[];
  }

  flatten(categories: SkillCategory[]): Skill[] {
    return categories.flatMap((c) => c.skills);
  }

  enrichSkills(skills: Skill[]): EnrichedSkill[] {
    return skills.map((skill) => ({
      ...skill,
      tags: this.computeTags(skill),
      complexity: this.computeComplexity(skill),
      automationScore: this.computeAutomationScore(skill),
      dependencies: this.findDependencies(skill, skills),
      estimatedTime: this.estimateTime(skill),
    }));
  }

  private computeTags(skill: Skill): string[] {
    const tags = new Set<string>();
    tags.add(skill.actionType.toLowerCase());
    if (skill.steps.length > 5) tags.add("multi-step");
    if (skill.testData) tags.add("data-driven");
    if (skill.expectedResult.toLowerCase().includes("error")) {
      tags.add("error-handling");
    }
    if (skill.steps.some((s) => s.toLowerCase().includes("wait"))) {
      tags.add("async-handling");
    }
    return [...tags];
  }

  private computeComplexity(skill: Skill): Complexity {
    let score = Math.ceil(skill.steps.length / 2);
    if (
      skill.elementSelectors &&
      Object.keys(skill.elementSelectors).length > 3
    ) {
      score += 1;
    }
    if (skill.testData && Object.keys(skill.testData).length > 5) {
      score += 1;
    }
    if (score <= 2) return "simple";
    if (score <= 4) return "medium";
    return "complex";
  }

  private computeAutomationScore(skill: Skill): number {
    let score = 50;
    if (
      skill.elementSelectors &&
      Object.keys(skill.elementSelectors).length > 0
    ) {
      score += 20;
    }
    if (skill.testData) score += 10;
    if (skill.expectedResult.length > 50) score += 15;
    if (["Click", "Input", "Verification"].includes(skill.actionType)) {
      score += 5;
    }
    return Math.min(score, 100);
  }

  private findDependencies(skill: Skill, all: Skill[]): string[] {
    const deps: string[] = [];
    const name = skill.skillName.toLowerCase();

    if (name.includes("navigate")) {
      const auth = all.find(
        (s) =>
          s.skillName.toLowerCase().includes("sign in") ||
          s.skillName.toLowerCase().includes("login")
      );
      if (auth && auth.skillId !== skill.skillId) deps.push(auth.skillId);
    }

    if (name.includes("cart")) {
      const addProduct = all.find(
        (s) =>
          s.skillName.toLowerCase().includes("add") &&
          s.skillName.toLowerCase().includes("cart") &&
          s.skillId !== skill.skillId
      );
      if (addProduct) deps.push(addProduct.skillId);
    }

    return deps;
  }

  private estimateTime(skill: Skill): number {
    let time = skill.steps.length;
    time += skill.steps.filter((s) => s.toLowerCase().includes("wait")).length * 2;
    if (skill.expectedResult.length > 100) time += 1;
    return Math.max(time, 1);
  }
}
