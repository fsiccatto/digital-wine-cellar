# La planilla

`backend/scripts/format_sheet.py` le da formato: encabezado fijo en color vino,
filtros, franjas alternadas, desplegables de varietal y puntuación, formato de
moneda en el precio, y reglas que apagan las filas sin stock y resaltan la
última botella. Es idempotente, se puede correr las veces que haga falta.

```bash
cd backend
../.venv/Scripts/python scripts/format_sheet.py                  # la de DEV
../.venv/Scripts/python scripts/format_sheet.py Mi_Cava_Virtual  # la de producción
```

| Pestaña | Contenido |
|---|---|
| `Inventario` | Una fila por vino: bodega, nombre, varietal, añada, región, alcohol, stock, ubicación, precio y código |
| `Historico_Catas` | Una fila por botella consumida: puntuación 1–5, notas y maridaje |
