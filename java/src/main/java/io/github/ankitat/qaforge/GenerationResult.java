package io.github.ankitat.qaforge;

import java.util.List;

/** The outcome of a generation run: successes and per-skill failures. */
public record GenerationResult(
    List<GeneratedTestCase> testCases,
    List<GenerationError> errors) {}
