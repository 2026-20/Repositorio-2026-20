# HU-046 — imagen de despliegue del backend (API REST Spring Boot).
# Build multi-etapa: compila en Maven + Temurin 17, la imagen final solo
# lleva el JRE y el jar, sin las herramientas de desarrollo.

# Etapa 1: compilación
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn --batch-mode dependency:go-offline -Djacoco.skip=true
COPY src ./src
RUN mvn --batch-mode package -DskipTests -Djacoco.skip=true

# Etapa 2: runtime (solo JRE + jar)
FROM eclipse-temurin:17-jre
WORKDIR /app
RUN useradd --system --uid 1001 --create-home appuser \
    && chown appuser:appuser /app
USER appuser
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]