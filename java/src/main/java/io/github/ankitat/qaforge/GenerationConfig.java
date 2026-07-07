package io.github.ankitat.qaforge;

/** Generation settings. Use {@link #forPreset(Preset)} then override as needed. */
public final class GenerationConfig {
  public String framework = "playwright";
  public String language = "typescript";
  public String style = "page-object-model";
  public String coverage = "comprehensive";
  public boolean includeErrorHandling = true;
  public String model = envOr("TCGEN_MODEL", "claude-sonnet-4-6");
  public double temperature = 0.7;
  public int maxTokens = 2000;
  public boolean evaluate = true;
  public int refineBelowScore = 75;

  public static GenerationConfig forPreset(Preset preset) {
    GenerationConfig c = new GenerationConfig();
    if (preset == null) return c;
    switch (preset) {
      case MINIMAL -> {
        c.coverage = "happy-path";
        c.style = "functional";
        c.includeErrorHandling = false;
        c.evaluate = false;
      }
      case STANDARD -> {
        c.coverage = "comprehensive";
        c.style = "page-object-model";
        c.includeErrorHandling = true;
        c.evaluate = true;
      }
      case COMPREHENSIVE -> {
        c.coverage = "all";
        c.style = "page-object-model";
        c.includeErrorHandling = true;
        c.evaluate = true;
        c.temperature = 0.5;
      }
    }
    return c;
  }

  private static String envOr(String key, String fallback) {
    String v = System.getenv(key);
    return (v == null || v.isBlank()) ? fallback : v;
  }
}
