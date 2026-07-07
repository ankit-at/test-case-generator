package io.github.ankitat.qaforge;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.ArrayList;
import java.util.List;

/** Parses a skills-inventory JSON document and flattens it to skills. */
public final class SkillParser {

  public List<SkillCategory> parseInventory(String json) {
    try {
      return Json.MAPPER.readValue(json, new TypeReference<List<SkillCategory>>() {});
    } catch (Exception e) {
      throw new RuntimeException("Skills inventory failed to parse: " + e.getMessage(), e);
    }
  }

  public List<Skill> flatten(List<SkillCategory> categories) {
    List<Skill> skills = new ArrayList<>();
    for (SkillCategory c : categories) {
      if (c.skills() != null) skills.addAll(c.skills());
    }
    return skills;
  }
}
