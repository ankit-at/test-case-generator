package io.github.ankitat.qaforge;

/** A skill that failed to generate, with the reason. */
public record GenerationError(String skillId, String error) {}
