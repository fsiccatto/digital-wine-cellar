# Mi Cava Virtual

Inventario personal de vinos que se carga sacándole una foto a la etiqueta.
Gemini lee la etiqueta, los datos se corrigen en un formulario y todo queda
guardado en una planilla de Google Sheets.

Corre entero dentro del **free tier permanente** de Google Cloud: Cloud Run
escala a cero, la planilla hace de base de datos y las fotos entran en los 5 GB
gratis de Cloud Storage. De noche, un ping cada 10 minutos lo mantiene despierto
para que abrir la app no espere un arranque en frío.

<table>
<tr>
<td width="33%"><img src="docs/img/cava.png" alt="Listado de la cava agrupado por estantes"></td>
<td width="33%"><img src="docs/img/escanear.png" alt="Pantalla de escaneo de una etiqueta"></td>
<td width="33%"><img src="docs/img/ficha.png" alt="Ficha de un vino con su stock"></td>
</tr>
<tr>
<td><b>Mi cava</b> — botellas por estante, con búsqueda y filtro por varietal.</td>
<td><b>Escanear</b> — la foto de la etiqueta completa el formulario sola.</td>
<td><b>Ficha</b> — stock, ubicación, catas anteriores y el botón para descorchar.</td>
</tr>
</table>

## Qué hace

- **Cargar una botella** sacándole una foto a la etiqueta: Gemini completa
  bodega, varietal, añada, región y graduación, y lo que salga mal se corrige
  antes de guardar.
- **Ver la cava** agrupada por estante, con búsqueda y filtro por varietal. Un
  corte aparece bajo cada una de sus uvas, y las botellas agotadas caen al final.
- **Descorchar una botella**: descuenta el stock y registra la cata con
  puntuación, notas y maridaje.
- **Anotar una cata suelta**, de algo abierto ayer o probado afuera, sin tocar
  el stock.
- **Leer el histórico** de catas, agrupado por mes y con búsqueda por vino,
  maridaje o notas.
- **Editar, borrar o ajustar el stock** de un vino sin abrir la planilla. Borrar
  un vino conserva sus catas: son la única memoria de que esas botellas se
  tomaron.

Todo desde el celular, detrás de una clave compartida.

## Cómo funciona

```
Celular  ──foto──>  FastAPI  ──imagen──>  Gemini
                       │                    │
                       │  <──── JSON ───────┘
                       │
                       ├──filas──>  Google Sheets   (inventario y catas)
                       └──jpg────>  Cloud Storage   (fotos, bucket privado)
```

| Capa | Tecnología |
|---|---|
| Backend | Python 3.11, FastAPI, Pydantic |
| Frontend | React 19, TypeScript, Vite, Tailwind 4 |
| IA | Google Gemini (`gemini-3.6-flash`) |
| Datos | Google Sheets vía `gspread` |
| Fotos | Cloud Storage, bucket privado con URLs firmadas |
| Infra | Cloud Run, Secret Manager, Artifact Registry, Cloud Scheduler, Terraform |

## Correrlo localmente

Hace falta `backend/.env` y `backend/credentials.json` (el JSON de una Service
Account de Google). Ninguno de los dos se versiona.

```bash
# backend  ->  http://localhost:8080
cd backend && uvicorn app.main:app --reload --port 8080

# frontend ->  http://localhost:5173  (proxea /api al backend, sin CORS)
cd frontend && npm install && npm run dev

# tests y lint
pytest backend/tests -q && ruff check backend
cd frontend && npm test && npm run lint
```

En local se apunta a la planilla `Mi_Cava_Virtual_DEV` y sin bucket, así que
probar no toca producción.

## Más documentación

| | |
|---|---|
| [Puesta en marcha](docs/despliegue.md) | Desplegar en Cloud Run y GitHub Pages, entornos, acceso y CORS |
| [Infraestructura](infra/terraform/README.md) | Qué crea Terraform y lo que queda a mano |
| [Cómo está hecho](docs/decisiones.md) | Las decisiones de diseño que no se deducen del código |
| [La planilla](docs/planilla.md) | Las dos pestañas y el script que les da formato |

## Estructura

```
backend/
  app/
    warmup.py    prepara la planilla mientras arranca el proceso
    routes/      health, scan, wines
    services/    gemini, sheets, storage, wine
    schemas/     validaciones Pydantic
    utils/       código de vino, validación de imágenes
  scripts/       formato de la planilla
  tests/
frontend/
  src/
    screens/     UnlockScreen, CellarScreen, CatasScreen, ScanScreen, WineScreen
    components/  íconos SVG, campos, hojas, fila de cata, copa de carga
    lib/         api, types, helpers de dominio
infra/
  terraform/     toda la infra, declarativa
design/          artboards del diseño
```
