# FastAPI-only container. Build from repository root; .dockerignore excludes secrets.
FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.txt backend/requirements-container.lock /app/
RUN pip install --no-cache-dir -r requirements.txt -c requirements-container.lock \
    && useradd --create-home --uid 10001 app
COPY backend/*.py /app/backend/
COPY backend/ai /app/backend/ai
USER app
EXPOSE 8000
WORKDIR /app/backend
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log", "--no-proxy-headers"]
