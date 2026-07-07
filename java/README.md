# QA-FORGE (Java)

A Java port of the QA-FORGE engine: turn a skills inventory or requirements text
into scored, ready-to-run test cases via an LLM. Depends only on Jackson and the
JDK HTTP client.

## Install

Maven:

```xml
<dependency>
  <groupId>io.github.ankit-at</groupId>
  <artifactId>qaforge</artifactId>
  <version>1.0.0</version>
</dependency>
```

Gradle:

```groovy
implementation "io.github.ankit-at:qaforge:1.0.0"
```

## Usage

```java
import io.github.ankitat.qaforge.*;
import java.util.List;

var skills = List.of(new Skill(
    "CART_001", "Add a product to the cart", "Adds one item",
    "Click", List.of("Open a product", "Click Add to Cart", "Verify the cart count"),
    "The cart count increments by one.", null, null));

GenerationResult result = QAForge.generateTestCases(
    skills,
    GenerateOptions.create()
        .apiKey(System.getenv("ANTHROPIC_API_KEY"))
        .preset(Preset.STANDARD));

String spec = new OutputFormatter().formatPlaywright(result.testCases());
System.out.println(spec);
```

From a skills-inventory JSON string:

```java
GenerationResult r = QAForge.generateFromInventory(json,
    GenerateOptions.create().preset(Preset.STANDARD));
```

From requirements text (extracts a skills inventory first, then generates + scores):

```java
var input = new RequirementExtractor.Input(
    brdText, "Checkout", "Angular storefront…", List.of("Functional"), null);
var res = QAForge.generateFromText(input, GenerateOptions.create());
```

## API

| Type | Purpose |
|------|---------|
| `QAForge` | Static entry point: `generateTestCases`, `generateFromInventory`, `generateFromText` |
| `GenerateOptions` | Fluent options: `apiKey`, `preset`, `appContext`, `config` |
| `TestCaseGenerator` | Full control over generation + evaluation |
| `OutputFormatter` | Render Playwright source or JSON |
| `SkillParser`, `RequirementExtractor`, `AnthropicClient` | Building blocks |

The API key is read from `GenerateOptions.apiKey(...)` or the
`ANTHROPIC_API_KEY` environment variable. Generation never throws on a single
failed skill — failures are collected in `GenerationResult.errors()`.

## Build

```bash
cd java
mvn test          # unit tests (no network)
mvn -P release deploy   # signed publish to Maven Central (CI does this on a tag)
```
