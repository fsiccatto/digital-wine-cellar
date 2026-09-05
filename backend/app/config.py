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

# --- Limites de uso ------------------------------------------------------
# Topes por IP en una ventana deslizante. El de scan protege la cuota de
# Gemini (que cuesta plata); el de auth evita que se prueben claves de a
# miles. Ambos son holgados para el uso real de una persona.
SCAN_RATE_LIMIT = int(os.getenv("SCAN_RATE_LIMIT", "20"))
SCAN_RATE_WINDOW_SECONDS = int(os.getenv("SCAN_RATE_WINDOW_SECONDS", str(60 * 60)))

AUTH_FAIL_LIMIT = int(os.getenv("AUTH_FAIL_LIMIT", "10"))
AUTH_FAIL_WINDOW_SECONDS = int(os.getenv("AUTH_FAIL_WINDOW_SECONDS", str(15 * 60)))

# Documentacion interactiva. Ya vive detras del token, pero en produccion no
# hay motivo para publicar el mapa de la API.
ENABLE_DOCS = os.getenv("ENABLE_DOCS", "").lower() in {"1", "true", "yes"} or not os.getenv("K_SERVICE")
