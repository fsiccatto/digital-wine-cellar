import json

import google.generativeai as genai

from app.config import GEMINI_API_KEY

MODEL_NAME = "gemini-1.5-flash"

PROMPT = """
Extrae la información de la etiqueta del vino.
Devuelve únicamente JSON válido con este esquema:
{
  "bodega": "string",
  "nombre_vino": "string",
  "varietal": "string",
  "anada": 2020,
  "region": "string",
  "alcohol": "14%"
}

Reglas:
- Si un valor no se puede leer, devolvé null.
- No agregues texto fuera del JSON.
- No inventes datos.
"""


def extract_wine_data_from_image_bytes(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    if not GEMINI_API_KEY:
        raise RuntimeError("Falta GEMINI_API_KEY en el entorno. Configural el archivo .env.")

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(MODEL_NAME)

    response = model.generate_content(
        contents=[
            {"text": PROMPT},
            {"inline_data": {"mime_type": mime_type, "data": image_bytes}},
        ],
        generation_config={
            "response_mime_type": "application/json",
            "temperature": 0.1,
        },
    )

    text = (response.text or "").strip()
    if not text:
        raise ValueError("Gemini no devolvió contenido para la etiqueta del vino.")

    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Gemini devolvió JSON inválido: {text[:200]}") from exc

    return {
        "bodega": payload.get("bodega"),
        "nombre_vino": payload.get("nombre_vino"),
        "varietal": payload.get("varietal"),
        "anada": payload.get("anada"),
        "region": payload.get("region"),
        "alcohol": payload.get("alcohol"),
    }
