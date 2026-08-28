# Cómo está hecho

Las decisiones que no se deducen leyendo el código.

## La API

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/health` | Chequeo de vida (siempre abierto) |
| `POST` | `/api/scan-label` | Sube una imagen y devuelve lo que Gemini pudo leer |
| `GET` | `/api/wines` | Lista el inventario |
| `GET` | `/api/wines/{codigo}` | Un vino, con su `foto_url` ya firmada |
| `POST` | `/api/wines` | Crea un vino y le asigna código |
| `PUT` | `/api/wines/{codigo}` | Edita sus datos; el código no cambia |
| `DELETE` | `/api/wines/{codigo}` | Lo saca del inventario; las catas quedan |
| `PATCH` | `/api/wines/{codigo}/stock` | Corrige el stock (`delta`) sin registrar cata |
| `POST` | `/api/wines/{codigo}/foto` | Sube la etiqueta al bucket |
| `POST` | `/api/wines/{codigo}/consume` | Descuenta una botella y registra la cata |
| `GET` | `/api/catas` | El histórico completo |
| `GET` | `/api/wines/{codigo}/catas` | Las catas de un vino |

Una botella se carga en dos pasos: primero se crea el vino (JSON) y después se
le sube la foto. Así el escaneo que alguien abandona no deja fotos huérfanas.

Descorchar y ajustar el stock son cosas distintas a propósito: `consume` baja
una botella **y** escribe la cata; `stock` solo corrige el inventario. Confundir
las dos arruina el histórico.


**Las fotos nunca se sirven públicamente.** El bucket tiene
`public-access-prevention` activo. En la columna `foto_url` del Sheet se guarda
el nombre del objeto, no una URL, y las URLs de lectura se firman on demand y
caducan a la hora. `foto_url` tampoco se acepta en `POST /api/wines`: solo lo
escribe el endpoint de foto, para que un cliente no pueda apuntarlo a una URL
arbitraria.

**Las credenciales no viajan en la imagen.** `.dockerignore` deja afuera `.env`
y `credentials.json`; en Cloud Run se inyectan desde Secret Manager, el JSON
montado como archivo y la API key como variable de entorno.

**Las fechas las pone el servidor.** `fecha_ingreso` y `fecha_consumo` se
generan server-side, nunca se aceptan del cliente.

**Las imágenes se validan de verdad.** No alcanza con el `content_type`
declarado: se abre con Pillow para confirmar que sea una imagen, además del
límite de tamaño.

**La planilla se edita a mano, así que nada confía en ella.** Una fila con datos
inválidos se descarta sin tumbar el listado entero, y en la UI una fecha que no
parsea o una añada menor a 1900 se omiten en vez de mostrarse crudas.

**Los números vienen con el formato puesto.** Una celda con formato de moneda no
llega como `32000` sino como `"$32.000"`, y eso hacía desaparecer el vino entero
del listado. `parse_sheet_number` los normaliza, distinguiendo el punto de miles
del decimal: en `"32.000"` el punto agrupa, en `"32.5"` separa decimales.

**La graduación se guarda como número.** Se acepta la coma al escribirla, porque
es como se teclea en es-AR, pero se guarda con punto y sin el símbolo: `13.5`.
La app le pone la coma y el `%` al mostrarla. Dos grafías del mismo dato no se
ordenan ni se comparan.

**El `codigo_vino` es inmutable.** No se regenera al editar, aunque cambien la
bodega, el varietal o la añada: es la clave que usan las catas, el objeto en el
bucket y las rutas HTTP. Es un identificador, no un dato de negocio.

**Borrar un vino conserva sus catas.** El histórico es la única memoria de que
esas botellas se tomaron; las huérfanas se muestran con el código crudo.

## Código de vino

Cada botella tiene un UUID técnico (`id`) y un código legible que es el que se
usa en la API:

```
TRA-MAL-2020-0001
 │   │    │    └── contador dentro de la combinación
 │   │    └─────── añada
 │   └──────────── 3 letras del varietal
 └──────────────── 3 letras de la bodega
```
