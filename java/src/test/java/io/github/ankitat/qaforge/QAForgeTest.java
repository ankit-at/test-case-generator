package io.github.ankitat.qaforge;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class QAForgeTest {

  @Test
  void parsesAndFlattensInventory() {
    String json =
        """
        [
          {
            "categoryId": "NAV001",
            "categoryName": "Navigation",
            "skills": [
              {
                "skillId": "NAV_001",
                "skillName": "Open dashboard",
                "actionType": "Navigation",
                "steps": ["Go to /dashboard", "Verify header"],
                "expectedResult": "Dashboard loads."
              }
            ]
          }
        ]""";
    SkillParser parser = new SkillParser();
    List<Skill> skills = parser.flatten(parser.parseInventory(json));
    assertEquals(1, skills.size());
    assertEquals("NAV_001", skills.get(0).skillId());
    assertEquals(2, skills.get(0).steps().size());
  }

  @Test
  void formatsPlaywrightAndJson() {
    GeneratedTestCase tc =
        new GeneratedTestCase(
            "NAV_001",
            "playwright",
            "test('opens dashboard', async ({ page }) => { await page.goto('/'); });",
            new TestMetadata(
                "opens dashboard", List.of("go to /"), List.of(), List.of("smoke"), "high", null));
    OutputFormatter fmt = new OutputFormatter();

    String spec = fmt.formatPlaywright(List.of(tc));
    assertTrue(spec.contains("@playwright/test"));
    assertTrue(spec.contains("opens dashboard"));

    String json = fmt.formatJson(List.of(tc));
    assertTrue(json.contains("\"NAV_001\""));
    assertTrue(json.contains("\"priority\":\"high\""));
  }

  @Test
  void presetsControlEvaluation() {
    assertTrue(GenerationConfig.forPreset(Preset.STANDARD).evaluate);
    assertTrue(!GenerationConfig.forPreset(Preset.MINIMAL).evaluate);
  }
}
