FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Sin usuario propio el proceso corre como root, con las credenciales del
# Service Account montadas en /secrets/. Nada de lo que hace la app necesita
# root: solo lee su propio codigo y escribe contra APIs de Google.
RUN useradd --create-home --uid 1000 cava && chown -R cava:cava /app
USER cava

# Cloud Run inyecta PORT; 8080 es el default de la plataforma.
ENV PORT=8080
EXPOSE 8080

# Un solo worker: el free tier da 1 vCPU y el trabajo real es I/O contra
# Sheets y Gemini, no CPU. Cloud Run escala por instancias, no por workers.
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1
