# Mi Cava Virtual

Inventario personal de vinos: una PWA que lee la etiqueta con Gemini y guarda
todo en un Google Sheet. Backend FastAPI en Cloud Run, frontend en GitHub Pages.

El README explica qué hace y cómo correrlo. Esto es lo que conviene saber antes
de tocar el backend o la infra.

## La restricción que decide todo: costo cero

Cada pieza está elegida para entrar en un free tier permanente. Antes de
proponer Redis, Cloud Armor, una base de datos o `min-instances=1`, asumí que la
respuesta es no salvo que el usuario diga lo contrario.

Hay una alerta de facturación de USD 1/mes que **avisa pero no corta**.

## Backend

### El Sheet es la base de datos

`GOOGLE_SHEET_NAME` elige la planilla: `Mi_Cava_Virtual_DEV` en local,
`Mi_Cava_Virtual` en producción. Probar en local no toca producción.

Quien lee la planilla es el `client_email` del `credentials.json`, **no** la
Service Account con la que corre Cloud Run. Son dos identidades distintas y es
el error más fácil de cometer: compartir el Sheet con la cuenta equivocada deja
la API levantada pero sin ver un solo vino.

Una celda con formato de moneda o porcentaje llega como texto y descarta la
fila. Por eso los validadores de `wine_schema.py` aceptan coma decimal y
normalizan a punto en vez de rechazar.

### Auth: token compartido

No hay cuentas. Una clave única que el navegador guarda y manda en
`X-App-Token`. Tres decisiones que parecen detalles y no lo son:

- Es **middleware, no dependencia de router**. Como dependencia, FastAPI valida
  el cuerpo primero y un POST mal formado sin clave devuelve 422 en vez de 401,
  filtrando la forma del esquema a quien no está autenticado.
- Va **por dentro de CORS** para que hasta un 401 lleve sus cabeceras. Si no, el
  navegador esconde la respuesta y no se ve el motivo.
- Sin `APP_TOKEN` la API queda **abierta**, que es cómodo en local. En Cloud Run
  eso sería un desastre silencioso, así que `verify_token_is_configured()`
  aborta el arranque si falta (`K_SERVICE` la define la plataforma sola).

### Límites de uso

`app/rate_limit.py`: 20 escaneos/hora y 10 fallos de token cada 15 min, por IP.
El de scan es el que importa — cada escaneo es una llamada paga a Gemini, y sin
tope un token filtrado quema la cuota en minutos.

Dos cosas del diseño que conviene no romper:

- **Solo los fallos gastan cupo.** Con la clave correcta nunca te bloqueás.
- **El bloqueo se consulta antes de comparar la clave** (`peek=True`). Si no,
  bastaría seguir probando hasta acertar y el límite no serviría.
- De `X-Forwarded-For` se toma **solo la primera IP**; el resto lo inventa quien
  llama.

El estado vive en memoria del proceso. Por eso el servicio corre con
**`max_instances = 1`**: con dos instancias cada una lleva su contador y el tope
real se duplica.

Los contadores se bajan a `estado/rate-limit.json` en el bucket de fotos cada
60 segundos como mucho, y se releen al arrancar. Sin eso, con `min-instances=0`
la app duerme casi todo el día y cada despertar regalaba una ventana limpia. El
espaciado importa: sin ese piso, rotar IPs generaba una escritura por intento.

**Todo lo del bucket falla en silencio a propósito** — si no responde, se sigue
con los contadores en memoria. El costado feo es que una implementación rota se
ve igual que una sana desde afuera, así que si tocás eso, verificá el viaje de
ida y vuelta a mano.

### La salida de Gemini es entrada no confiable

La foto la elige el usuario y el modelo lee lo que diga la etiqueta. Una
etiqueta preparada puede pedirle párrafos enteros, que terminan en el Sheet. La
defensa real es el **truncado a 200 caracteres** en el validador: un modelo
puede desobedecer una instrucción del prompt, no puede escaparse de un `[:200]`.

### Sheets devuelve 503 de vez en cuando

Se reintenta hasta tres veces con backoff, pero **solo lo idempotente**:
lecturas y escrituras que fijan un valor en una dirección concreta. `append_row`
y `delete_rows` quedan afuera a propósito — un 503 puede llegar con la fila ya
escrita, y el reintento cargaría el vino dos veces o borraría la fila de al
lado, que subió un lugar.

## Infra

Todo en `infra/terraform`. No hay scripts de deploy: el que había describía una
infra que no era la que corría.

### El state vive en un bucket

`terraform init` necesita `-backend-config=backend.hcl`, que no está versionado
porque el nombre del bucket lleva el project id. Hay un `.example` al lado.

### Los deploys son automáticos

| Workflow | Se dispara | Hace |
|---|---|---|
| `ci.yml` | push y PR | tests y lint de back y front |
| `deploy-backend.yml` | cuando **CI** termina en verde | build + revisión nueva |
| `deploy-frontend.yml` | push que toque `frontend/**` | build + Pages |

El backend **no** corre sus tests de nuevo: espera a CI vía `workflow_run` y usa
ese mismo SHA para el checkout y para el tag de la imagen, así lo que se
despliega es exactamente lo que se probó. Como `workflow_run` no filtra por rama
ni por path, eso lo hace el job `decidir`.

La autenticación con GCP es **Workload Identity Federation**: no hay ninguna
clave en el repo, y el proveedor sólo acepta este repositorio.

### Terraform y el workflow se reparten el servicio

Terraform define la infra; el workflow define **qué versión corre**. La imagen
está en `ignore_changes` — sin eso, cualquier `terraform apply` revierte el
último deploy a la imagen del tfvars, que siempre es más vieja.

Si `terraform plan` propone tocar la imagen, algo se rompió en ese reparto.

### Trampas conocidas

- **El tráfico se puede quedar clavado.** Un rollback con `--to-revisions` fija
  el tráfico a una revisión y el servicio deja de seguir a la última: los
  deploys siguientes salen "en verde" creando revisiones que no reciben un solo
  pedido. El workflow ahora lo detecta y falla; se arregla con
  `gcloud run services update-traffic ... --to-latest`.
- **El SA del backend no se renombra.** `backend_service_account_id` está
  aparte de `service_name` a propósito: renombrar una Service Account es
  borrarla y crear otra, lo que invalida `credentials.json` y deja el Sheet
  compartido con una cuenta que ya no existe.
- **`gcloud builds submit` sin `--async` falla con la imagen ya construida**, si
  no tiene permiso para leer los logs. Por eso el workflow lanza y consulta el
  estado.

### Lo que queda a mano

Crear el proyecto, vincular facturación, cargar los valores de los secretos y
**compartir la planilla** con la Service Account. Está en
`infra/terraform/README.md`. El último es el que más se olvida.

## Al trabajar acá

- Los comentarios explican **por qué**, no qué hace el código. Varios documentan
  una trampa concreta que costó encontrar; si tocás esa línea, mové el
  comentario con ella.
- El código y los mensajes de commit están en español, sin tildes en los
  comentarios del backend.
- `pytest backend/tests -q` y `ruff check backend`; en `frontend/`, `npm test` y
  `npm run lint`.
- El repo es **público**: nada de project ids, URLs de servicio o cuentas reales
  en archivos versionados. Lo específico de la instalación va en
  `terraform.tfvars`, que está en `.gitignore`.
