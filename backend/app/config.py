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
