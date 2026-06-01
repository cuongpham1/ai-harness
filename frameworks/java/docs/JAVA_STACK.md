# Java Stack

## Commands

| Build tool | Test | Run |
|------------|------|-----|
| Maven | `./mvnw test` or `mvn test` | `./mvnw spring-boot:run` |
| Gradle | `./gradlew test` | `./gradlew bootRun` |

## Structure (typical)

```
src/main/java/     # application code
src/test/java/     # tests
pom.xml or build.gradle.kts
```

## Validation before done

Run project test command and static analysis (checkstyle/spotbugs if configured).
