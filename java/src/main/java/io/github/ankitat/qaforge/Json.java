package io.github.ankitat.qaforge;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/** Shared Jackson mapper plus helpers to recover JSON embedded in LLM text. */
final class Json {
  static final ObjectMapper MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  private Json() {}

  static String stringify(Object value) {
    try {
      return MAPPER.writeValueAsString(value);
    } catch (Exception e) {
      throw new RuntimeException("Failed to serialize JSON: " + e.getMessage(), e);
    }
  }

  static JsonNode tree(String json) {
    try {
      return MAPPER.readTree(json);
    } catch (Exception e) {
      throw new RuntimeException("Failed to parse JSON: " + e.getMessage(), e);
    }
  }

  static <T> T parse(String json, Class<T> type) {
    try {
      return MAPPER.readValue(json, type);
    } catch (Exception e) {
      throw new RuntimeException("Failed to parse JSON: " + e.getMessage(), e);
    }
  }

  /** Extract the first {@code { ... }} object from model text (strips ``` fences). */
  static String extractObject(String text) {
    String cleaned = text.replaceAll("```(?:json)?", "");
    int start = cleaned.indexOf('{');
    int end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) {
      throw new RuntimeException("No JSON object found in model response.");
    }
    return cleaned.substring(start, end + 1);
  }

  /** Extract the first {@code [ ... ]} array from model text (strips ``` fences). */
  static String extractArray(String text) {
    String cleaned = text.replaceAll("```(?:json)?", "");
    int start = cleaned.indexOf('[');
    int end = cleaned.lastIndexOf(']');
    if (start < 0 || end <= start) {
      throw new RuntimeException("No JSON array found in model response.");
    }
    return cleaned.substring(start, end + 1);
  }
}
