"""El precalentado no puede romper el arranque ni demorarlo de mas."""

import threading
import time
from unittest.mock import patch

from app import warmup


def test_fuera_de_cloud_run_no_toca_nada(monkeypatch):
    monkeypatch.delenv("K_SERVICE", raising=False)

    with (
        patch.object(warmup.rate_limit, "precargar") as contadores,
        patch.object(warmup.sheets_service, "get_inventory_worksheet") as planilla,
    ):
        warmup.precalentar()

    contadores.assert_not_called()
    planilla.assert_not_called()


def test_en_cloud_run_prepara_las_dos_cosas_en_paralelo(monkeypatch):
    monkeypatch.setenv("K_SERVICE", "cava")
    # Cada tarea espera a la otra: si fueran en fila, esto no terminaria nunca.
    barrera = threading.Barrier(2, timeout=2)

    with (
        patch.object(warmup.rate_limit, "precargar", side_effect=barrera.wait),
        patch.object(
            warmup.sheets_service, "get_inventory_worksheet", side_effect=barrera.wait
        ),
    ):
        warmup.precalentar()

    assert barrera.broken is False


def test_un_error_no_impide_arrancar(monkeypatch):
    monkeypatch.setenv("K_SERVICE", "cava")

    with (
        patch.object(warmup.rate_limit, "precargar"),
        patch.object(
            warmup.sheets_service,
            "get_inventory_worksheet",
            side_effect=RuntimeError("Sheets no responde"),
        ),
    ):
        warmup.precalentar()


def test_si_google_tarda_no_se_lo_espera_para_siempre(monkeypatch):
    monkeypatch.setenv("K_SERVICE", "cava")
    monkeypatch.setattr(warmup, "LIMITE_SEGUNDOS", 0.1)
    liberar = threading.Event()

    with (
        patch.object(warmup.rate_limit, "precargar"),
        patch.object(
            warmup.sheets_service,
            "get_inventory_worksheet",
            side_effect=lambda: liberar.wait(5),
        ),
    ):
        inicio = time.monotonic()
        warmup.precalentar()
        demora = time.monotonic() - inicio
        liberar.set()

    assert demora < 1
