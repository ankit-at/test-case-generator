package io.github.ankitat.qaforge;

/** Options for the high-level {@link QAForge} helpers. Fluent builder. */
public final class GenerateOptions {
  String apiKey;
  Preset preset = Preset.STANDARD;
  String appContext;
  GenerationConfig config;

  public static GenerateOptions create() {
    return new GenerateOptions();
  }

  public GenerateOptions apiKey(String apiKey) {
    this.apiKey = apiKey;
    return this;
  }

  public GenerateOptions preset(Preset preset) {
    this.preset = preset;
    return this;
  }

  public GenerateOptions appContext(String appContext) {
    this.appContext = appContext;
    return this;
  }

  /** Provide a fully-formed config, bypassing the preset. */
  public GenerateOptions config(GenerationConfig config) {
    this.config = config;
    return this;
  }

  GenerationConfig resolveConfig() {
    return config != null ? config : GenerationConfig.forPreset(preset);
  }

  String resolveApiKey() {
    if (apiKey != null && !apiKey.isBlank()) return apiKey;
    String env = System.getenv("ANTHROPIC_API_KEY");
    if (env == null || env.isBlank()) {
      throw new IllegalStateException("ANTHROPIC_API_KEY is not set.");
    }
    return env;
  }
}
