# Mi Cava Virtual

Proyecto para gestionar el inventario personal de vinos con extracción automática de etiquetas mediante Gemini y almacenamiento en Google Sheets.

## Objetivo
- registrar vinos y stock;
- extraer datos desde fotos de etiquetas;
- guardar todo en Google Sheets;
- registrar catas y consumo;
- mantener la lógica en backend.

## Stack propuesto
- Python 3.11 LTS + FastAPI
- Google Gemini 1.5 Flash
- Google Sheets API
- Service Account para acceso seguro

## Requisito de entorno
Este proyecto está configurado para trabajar con Python 3.11 porque es la versión más compatible con la stack de FastAPI + Pydantic + Google SDKs.

No recomendamos usar Python 3.14 para esta etapa inicial, ya que la dependencia `pydantic-core` puede intentar compilar desde origen y fallar por falta de compatibilidad o herramientas del sistema.

## Estado actual
- plan técnico documentado
- estructura base del repositorio inicializada
- CI base configurada para validar backend en GitHub Actions
