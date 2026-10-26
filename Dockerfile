# Build from repository root. No environment files or customer data enter the context.
FROM gradle:8.8-jdk21 AS java-build
WORKDIR /build
COPY services/transaction-service/build.gradle ./
COPY services/transaction-service/src ./src
RUN gradle test bootJar --no-daemon

FROM eclipse-temurin:21-jre-jammy AS java-runtime
FROM python:3.12-slim-bookworm
COPY --from=java-runtime /opt/java/openjdk /opt/java/openjdk
ENV JAVA_HOME=/opt/java/openjdk PATH="/opt/java/openjdk/bin:${PATH}" PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.txt backend/requirements-container.lock /app/
RUN pip install --no-cache-dir -r requirements.txt -c requirements-container.lock && useradd --create-home --uid 10001 app
COPY --from=java-build /build/build/libs/*-SNAPSHOT.jar /app/transaction-service.jar
COPY backend/*.py /app/backend/
COPY backend/ai /app/backend/ai
COPY deployment/run_services.py /app/run_services.py
USER app
EXPOSE 8000
CMD ["python", "/app/run_services.py"]
