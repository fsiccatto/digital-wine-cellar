# Puesta en marcha

## Entornos

Hay dos planillas y el entorno se elige por variable, sin tocar código:

| | Planilla | Fotos |
|---|---|---|
| **Local / DEV** | `Mi_Cava_Virtual_DEV` | sin bucket |
| **Producción** | `Mi_Cava_Virtual` | bucket privado en GCS |

En DEV `GCS_BUCKET_NAME` va vacío: el endpoint de foto responde 503 y todo lo
demás anda igual. Así probar en local no ensucia el bucket real ni el
inventario. Ambas planillas se comparten con la misma Service Account.

## Desplegarlo

`infra/deploy.sh` hace todo el camino: crea el proyecto, vincula facturación,
habilita APIs, arma la Service Account y los secretos, crea el bucket, construye
la imagen con Cloud Build y despliega en Cloud Run.

```bash
PROJECT_ID=tu-proyecto bash infra/deploy.sh
```

Queda **un paso manual** sin el cual el backend no lee la planilla: compartir el
Sheet con el `client_email` del `credentials.json`, con permiso de Editor.

> Son dos identidades distintas y es fácil confundirlas. El Sheet lo lee la
> Service Account del JSON; Cloud Run *corre* con esa misma cuenta, pero
> compartir la planilla con cualquier otra no sirve.

La facturación hay que vincularla aunque todo entre en el free tier: sin una
cuenta asociada, Cloud Storage y Cloud Run devuelven 403 y no se habilitan.
Conviene poner un presupuesto de aviso:

```bash
gcloud billing budgets create \
  --billing-account=TU-BILLING-ID \
  --display-name="Cava - alerta 1 USD" \
  --budget-amount=1USD \
  --threshold-rule=percent=0.5 --threshold-rule=percent=1.0 \
  --filter-projects="projects/$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')"
```

El aviso llega por mail a los administradores de facturación. Notar que
**avisa, no corta**: si se dispara, el servicio sigue andando.

También hay una versión en Terraform en `infra/terraform` que provisiona lo
mismo de forma declarativa.

### Frontend

Se publica solo en **GitHub Pages** con `.github/workflows/deploy-frontend.yml`,
en cada push que toque `frontend/`. El hosting es gratis y no necesita
facturación.

Dos cosas hay que configurar una vez en el repo:

1. **Settings → Pages → Source: GitHub Actions**
2. **Settings → Secrets and variables → Actions → Variables**: crear
   `VITE_API_BASE` con la URL del backend en Cloud Run.

Sin esa variable el build falla a propósito, en vez de publicar un sitio que
no llama a ningún lado.

El workflow fija `base` en `/<repo>/` porque el sitio cuelga de un
subdirectorio, y copia `index.html` a `404.html` para que las rutas resuelvan
del lado del cliente.

Para buildear a mano:

```bash
cd frontend
VITE_API_BASE="https://tu-backend.run.app" BASE_PATH=/digital-wine-cellar/ npm run build
```

### Acceso

La app publicada está protegida con una clave compartida. No hay cuentas: la
app la pide al abrir, la guarda en el navegador y la manda en `X-App-Token`.

```bash
# generar una
python -c "import secrets; print(secrets.token_urlsafe(24))"

# guardarla y publicarla
gcloud secrets create app-token --replication-policy=automatic
printf '%s' "TU_TOKEN" | gcloud secrets versions add app-token --data-file=-
gcloud run deploy digital-wine-cellar-backend \
  --image=... --region=us-central1 \
  --update-secrets="APP_TOKEN=app-token:latest"
```

Sin `APP_TOKEN` la API queda abierta, que es lo cómodo en local. `/health`
siempre queda accesible, porque lo consulta la plataforma.

El chequeo es un middleware, no una dependencia de router: como dependencia,
FastAPI validaba el cuerpo primero y un POST mal formado sin clave devolvía 422
en vez de 401, revelando la forma del esquema. Va por dentro de CORS para que
hasta un 401 lleve sus cabeceras; si no, el navegador esconde la respuesta.

### CORS

El frontend publicado vive en otro dominio que el backend, así que Cloud Run
tiene que permitirlo explícitamente. La lista sale de `CORS_ALLOW_ORIGINS`
(separada por comas):

```bash
gcloud run deploy digital-wine-cellar-backend \
  --image=... --region=us-central1 \
  --update-env-vars="^|^CORS_ALLOW_ORIGINS=https://tu-usuario.github.io,http://localhost:5173"
```

El prefijo `^|^` cambia el separador de gcloud a `|`, porque si no la coma
dentro del valor se interpreta como fin de la variable.

En desarrollo no hace falta: el proxy de Vite hace que el navegador vea un solo
origen.
