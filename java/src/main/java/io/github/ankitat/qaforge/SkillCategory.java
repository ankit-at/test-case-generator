package io.github.ankitat.qaforge;

import java.util.List;

/** A named group of related skills. */
public record SkillCategory(
    String categoryId,
    String categoryName,
    String categoryDescription,
    List<Skill> skills) {

  public SkillCategory {
    skills = skills == null ? List.of() : skills;
  }
}
