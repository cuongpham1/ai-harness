# Java Test

Run Java tests using Maven or Gradle.

```bash
if [[ -f ./mvnw ]]; then ./mvnw test; elif [[ -f pom.xml ]]; then mvn test; elif [[ -f ./gradlew ]]; then ./gradlew test; else echo "No Maven/Gradle wrapper found"; fi
```

Report failures with class name and assertion message.
