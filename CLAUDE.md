# Mi Cava Virtual

Inventario personal de vinos: una PWA que lee la etiqueta con Gemini y guarda
todo en un Google Sheet. Backend FastAPI en Cloud Run, frontend en GitHub Pages.

El README explica qué hace y cómo correrlo; `docs/decisiones.md`, la API y las
reglas de negocio. Esto es lo que conviene saber antes de tocar el backend o la
infra.

## La restricción que decide todo: costo cero

Cada pieza está elegida para entrar en un free tier permanente. Antes de
proponer Redis, Cloud Armor, una base de datos o `min-instances=1`, asumí que la
respuesta es no salvo que el usuario diga lo contrario.

Hay una alerta de facturación de USD 1/mes que **avisa pero no corta**.

## Backend

### Lo lento es el arranque en frío

Con `min-instances=0` el proceso se apaga sin uso, y abrir la app después de un
rato paga el arranque entero: importar librerías, abrir la planilla, leerla.
Con el proceso despierto, listar el inventario es una lectura de ~0,35s.

Tres cosas lo atacan, y conviene no deshacerlas:

- Un job de Cloud Scheduler pide `/health` cada 10 minutos en horas de uso
  (`keep_warm` en Terraform). Es gratis porque con `cpu_idle` la instancia
  ociosa no se factura.
- `app/warmup.py` abre la planilla y baja los contadores de uso en paralelo
  mientras el proceso arranca, antes de que uvicorn abra el puerto.
- **Nada pesado se importa a nivel de módulo** si no lo usa cada pedido.
  Gemini se importa adentro del escaneo: cargarlo al arrancar costaba ~0,3s
  en cada arranque en frío.

### El Sheet es la base de datos

`GOOGLE_SHEET_NAME` elige la planilla: `Mi_Cava_Virtual_DEV` en local,
`Mi_Cava_Virtual` en producción. `GOOGLE_SHEET_ID` es opcional pero conviene:
abrir por id cuesta la mitad que buscar por nombre en Drive.

Quien lee la planilla es el `client_email` del `credentials.json`, **no** la
Service Account con la que corre Cloud Run. Compartir el Sheet con la cuenta
equivocada deja la API levantada pero sin ver un solo vino.

La planilla se edita a mano, así que nada confía en ella: una fila inválida se
descarta sin tumbar el listado, y los números con formato (`"$32.000"`) se
normalizan en vez de rechazarse.

### Cada viaje a Sheets cuesta

Medido: leer una pestaña ~0,35s, escribir una celda ~0,48s. Es latencia de red,
y es de lo único que está hecho el tiempo de respuesta. El código cuenta
viajes, no líneas: quien ya leyó una pestaña le pasa esas celdas a la escritura
en vez de releerla, y las escrituras a pestañas distintas van en paralelo.

Si tocás algo de esto, medí. Es fácil agregar un viaje sin notarlo.

### Las columnas se reconocen por nombre, se escriben por posición

`append_row` escribe **por posición**. Si la fila 1 quedó con un esquema
anterior, cada valor cae corrido. Por eso los `append_` verifican el encabezado
antes de escribir (una lectura la primera vez en el proceso).

Cuando el encabezado cambia, `_ensure_headers` reacomoda **todas las filas** por
nombre de columna, no solo la fila 1. Reescribir solo el encabezado fue lo que
corrió las catas viejas al sumar `codigo_vino`: la puntuación quedó bajo
`fecha_consumo` y el navegador mostraba "3.5" como marzo de 2001.
`_reparar_catas_corridas` endereza las que quedaron así.

### La cata apunta al vino por uuid

En `Historico_Catas`, `vino_id` guarda el **`id` del vino** (uuid), no su
`codigo_vino`: el código se reutiliza si borrás un vino, y las catas viejas
quedarían colgadas del equivocado. Las filas anteriores guardan el código, así
que el join indexa el inventario por las dos claves. No hace falta migrar.

La columna `codigo_vino` de esa hoja es **una copia para leer a ojo**, se
congela al crear la cata y el join la descarta. El frontend navega por el
`codigo_vino` que sale del join.

### Sheets devuelve 503 de vez en cuando

Se reintenta con backoff **solo lo idempotente**: lecturas y escrituras a una
dirección fija. `append_row` y `delete_rows` quedan afuera a propósito: un 503
puede llegar con la fila ya escrita, y el reintento la duplicaría o borraría la
de al lado.

### Auth: token compartido

No hay cuentas: una clave única que el navegador manda en `X-App-Token`.

- Es **middleware, no dependencia de router**: como dependencia, un POST mal
  formado sin clave devuelve 422 en vez de 401 y filtra el esquema.
- Va **por dentro de CORS**, para que hasta un 401 lleve sus cabeceras.
- Sin `APP_TOKEN` la API queda abierta (cómodo en local).
  `verify_token_is_configured()` aborta el arranque si falta en Cloud Run.

### Límites de uso

`app/rate_limit.py`: 20 escaneos/hora (cada uno es una llamada paga a Gemini) y
10 fallos de token cada 15 min, por IP.

- **Solo los fallos gastan cupo**, y el bloqueo se consulta **antes** de
  comparar la clave (`peek=True`). Si no, bastaría probar hasta acertar.
- De `X-Forwarded-For` se toma la **última** entrada: lo de la izquierda lo
  escribe quien llama. Tomar la primera dejaba rotar IPs inventadas, y era
  explotable en producción.
- El estado vive en memoria, por eso **`max_instances = 1`**: con dos
  instancias el tope se duplica. Se baja a `estado/rate-limit.json` en el
  bucket cada 60s como mucho, y el intento que agota el cupo fuerza la
  escritura.

**Todo lo del bucket falla en silencio a propósito.** Una implementación rota se
ve igual que una sana desde afuera: si tocás eso, verificá el viaje de ida y
vuelta a mano.

### La salida de Gemini es entrada no confiable

Una etiqueta preparada puede pedirle al modelo párrafos enteros, que terminan en
el Sheet. La defensa real es el **truncado a 200 caracteres** en el validador:
el modelo puede desobedecer el prompt, no un `[:200]`.

## Infra

Todo en `infra/terraform`. `terraform init` necesita
`-backend-config=backend.hcl` (no versionado; hay un `.example`).

| Workflow | Se dispara | Hace |
|---|---|---|
| `ci.yml` | push y PR | tests y lint de back y front |
| `deploy-backend.yml` | cuando **CI** termina en verde | build + revisión nueva |
| `deploy-frontend.yml` | push que toque `frontend/**` | build + Pages |

El backend no corre sus tests de nuevo: espera a CI vía `workflow_run` y usa
ese mismo SHA, así se despliega exactamente lo que se probó. Como
`workflow_run` no filtra por rama, eso lo hace el job `decidir`. La
autenticación con GCP es Workload Identity Federation: no hay claves en el repo.

Terraform define la infra; el workflow define **qué versión corre**. La imagen
está en `ignore_changes`: si `terraform plan` propone tocarla, algo se rompió.

### Trampas conocidas

- **El tráfico se puede quedar clavado.** Un rollback con `--to-revisions` deja
  de seguir a la última revisión y los deploys siguientes salen en verde sin
  recibir pedidos. El workflow lo detecta; se arregla con
  `gcloud run services update-traffic ... --to-latest`.
- **El SA del backend no se renombra.** Renombrarlo es borrarlo y crear otro,
  lo que invalida `credentials.json` y el Sheet compartido. Por eso
  `backend_service_account_id` está aparte de `service_name`.
- **`gcloud builds submit` sin `--async` falla** con la imagen ya construida si
  no puede leer los logs. Por eso el workflow lanza y consulta el estado.

Lo que queda a mano está en `infra/terraform/README.md`. Lo que más se olvida
es **compartir la planilla** con la Service Account.

## Al trabajar acá

- Los comentarios explican **por qué**, no qué hace el código. Varios documentan
  una trampa que costó encontrar: si tocás esa línea, mové el comentario con
  ella.
- Código y commits en español, sin tildes en los comentarios del backend.
- `pytest backend/tests -q` y `ruff check backend`, con las versiones de
  `requirements.txt`: un ruff más nuevo marca cosas que CI no. En
  `frontend/`, `npm test` y `npm run lint`.
- El repo es **público**: nada de project ids, URLs de servicio o cuentas reales
  en archivos versionados. Lo de la instalación va en `terraform.tfvars`.
