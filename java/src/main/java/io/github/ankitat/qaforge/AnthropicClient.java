package io.github.ankitat.qaforge;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/** Minimal Anthropic Messages API client using the JDK HTTP client. */
public final class AnthropicClient {
  private static final String ENDPOINT = "https://api.anthropic.com/v1/messages";
  private static final String API_VERSION = "2023-06-01";

  private final String apiKey;
  private final HttpClient http;

  public AnthropicClient(String apiKey) {
    if (apiKey == null || apiKey.isBlank()) {
      throw new IllegalStateException("ANTHROPIC_API_KEY is not set.");
    }
    this.apiKey = apiKey;
    this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();
  }

  /** Send one system+user turn and return the assistant's text, with retries. */
  public String message(String system, String user, String model, double temperature, int maxTokens) {
    String body =
        Json.stringify(
            Map.of(
                "model", model,
                "max_tokens", maxTokens,
                "temperature", temperature,
                "system", system,
                "messages", List.of(Map.of("role", "user", "content", user))));

    RuntimeException last = null;
    for (int attempt = 1; attempt <= 3; attempt++) {
      try {
        HttpRequest request =
            HttpRequest.newBuilder(URI.create(ENDPOINT))
                .timeout(Duration.ofSeconds(120))
                .header("x-api-key", apiKey)
                .header("anthropic-version", API_VERSION)
                .header("content-type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() / 100 != 2) {
          throw new RuntimeException(response.statusCode() + " " + response.body());
        }
        JsonNode root = Json.tree(response.body());
        JsonNode content = root.path("content");
        if (!content.isArray() || content.isEmpty() || !content.get(0).has("text")) {
          throw new RuntimeException("Unexpected response shape from Anthropic.");
        }
        return content.get(0).get("text").asText();
      } catch (RuntimeException e) {
        last = e;
      } catch (Exception e) {
        last = new RuntimeException(e.getMessage(), e);
      }
      sleep(attempt);
    }
    throw last != null ? last : new RuntimeException("Request failed after retries.");
  }

  private static void sleep(int attempt) {
    try {
      Thread.sleep((long) Math.pow(2, attempt - 1) * 500L);
    } catch (InterruptedException ignored) {
      Thread.currentThread().interrupt();
    }
  }
}
