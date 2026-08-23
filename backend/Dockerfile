FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Cloud Run inyecta PORT; 8080 es el default de la plataforma.
ENV PORT=8080
EXPOSE 8080

# Un solo worker: el free tier da 1 vCPU y el trabajo real es I/O contra
# Sheets y Gemini, no CPU. Cloud Run escala por instancias, no por workers.
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1
