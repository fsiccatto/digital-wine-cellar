import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GOOGLE_SHEETS_CREDENTIALS_FILE = os.getenv("GOOGLE_SHEETS_CREDENTIALS_FILE", "credentials.json")
GOOGLE_SHEET_NAME = os.getenv("GOOGLE_SHEET_NAME", "Mi_Cava_Virtual")
MAX_IMAGE_SIZE_BYTES = int(os.getenv("MAX_IMAGE_SIZE_BYTES", str(10 * 1024 * 1024)))

# Fotos de etiqueta. Sin GCS_BUCKET_NAME la app funciona igual, sin fotos.
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "")
GCS_SIGNED_URL_TTL_SECONDS = int(os.getenv("GCS_SIGNED_URL_TTL_SECONDS", str(3600)))

# Origenes del frontend, separados por coma. En desarrollo el proxy de Vite
# evita CORS, pero el frontend publicado vive en otro dominio y sin esto el
# navegador bloquea cada llamada.
_origins = os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:5173")
CORS_ALLOW_ORIGINS = [o.strip() for o in _origins.split(",") if o.strip()]

# Clave compartida para entrar a la app. Vacia: la API queda abierta, comodo
# en local. En produccion se define y el frontend la manda en X-App-Token.
APP_TOKEN = os.getenv("APP_TOKEN", "")
