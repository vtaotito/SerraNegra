#!/usr/bin/env python3
"""Importa custos de CMV da planilha Markup_GSN.xlsx para markup_overrides via API do painel."""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import pandas as pd
import requests

BASE_URL = os.environ.get("PANEL_URL", "https://painel.garrafariaserranegra.com.br")
USERNAME = os.environ.get("PANEL_USER", "vitor.tito")
PASSWORD = os.environ.get("PANEL_PASS", "Admin@2026")
XLSX_PATH = os.environ.get(
    "MARKUP_XLSX",
    r"c:\Users\Vitor A. Tito\Documents\GPTO\GSN\Markup_GSN.xlsx",
)
DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"


def load_spreadsheet(path: str) -> list[dict]:
    df = pd.read_excel(path, sheet_name="Planilha1", header=None)
    rows: list[dict] = []

    for i in range(10, len(df)):
        r = df.iloc[i]
        cod = r.iloc[7]
        if pd.isna(cod) or str(cod).strip() == "":
            continue

        def num(j: int, default=None):
            v = r.iloc[j]
            if pd.isna(v):
                return default
            try:
                return float(v)
            except (TypeError, ValueError):
                return default

        v = num(10)
        if v is None:
            continue

        rows.append(
            {
                "itemCode": str(cod).strip().upper(),
                "precoSemImp": round(v, 2),
                "frete": round(num(11, 0) or 0, 2),
                "embalagem": round(num(12, 0) or 0, 2),
                "comissao": round(num(13, 0) or 0, 2),
                "pisCofins": num(14),
                "icmsCompra": num(15),
                "ipi": num(16),
                "qtdPallet": int(num(5)) if num(5) is not None else None,
                "qtdSaco": int(num(6)) if num(6) is not None else None,
                "updatedBy": "import-markup-cmv",
            }
        )

    return rows


def login(session: requests.Session) -> None:
    res = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": USERNAME, "password": PASSWORD},
        timeout=60,
    )
    if res.status_code != 200:
        raise RuntimeError(f"Login falhou: HTTP {res.status_code} — {res.text[:200]}")
    data = res.json()
    if not data.get("success"):
        raise RuntimeError(f"Login falhou: {data.get('error', data)}")


def fetch_panel_items(session: requests.Session) -> set[str]:
    res = session.get(f"{BASE_URL}/api/sap/markup/items", timeout=120)
    if res.status_code != 200:
        raise RuntimeError(f"GET markup/items falhou: HTTP {res.status_code}")
    data = res.json()
    if not data.get("ok"):
        raise RuntimeError(f"GET markup/items erro: {data}")
    return {str(i["itemCode"]).upper() for i in data.get("items", [])}


def save_override(session: requests.Session, payload: dict) -> None:
    res = session.post(
        f"{BASE_URL}/api/sap/markup/overrides",
        json=payload,
        timeout=60,
    )
    if res.status_code != 200:
        raise RuntimeError(f"POST override {payload['itemCode']}: HTTP {res.status_code} — {res.text[:200]}")


def main() -> int:
    if not Path(XLSX_PATH).exists():
        print(f"Planilha não encontrada: {XLSX_PATH}", file=sys.stderr)
        return 1

    sheet_rows = load_spreadsheet(XLSX_PATH)
    print(f"Planilha: {len(sheet_rows)} produtos com custos")

    session = requests.Session()
    session.headers.update({"User-Agent": "GSN-markup-import/1.0"})

    print(f"Login em {BASE_URL} como {USERNAME}...")
    login(session)
    print("Login OK")

    panel_codes = fetch_panel_items(session)
    print(f"Painel: {len(panel_codes)} produtos SAP ativos")

    matched = [r for r in sheet_rows if r["itemCode"] in panel_codes]
    missing = [r["itemCode"] for r in sheet_rows if r["itemCode"] not in panel_codes]
    print(f"Match: {len(matched)} | Não encontrados no painel: {len(missing)}")

    if missing:
        print("Códigos SAP ausentes no painel (primeiros 20):")
        for code in missing[:20]:
            print(f"  - {code}")
        if len(missing) > 20:
            print(f"  ... e mais {len(missing) - 20}")

    if DRY_RUN:
        print("\n[DRY_RUN] Nenhum dado gravado.")
        print(json.dumps(matched[:3], indent=2, ensure_ascii=False))
        return 0

    ok = 0
    errors: list[str] = []
    for i, row in enumerate(matched, 1):
        try:
            save_override(session, row)
            ok += 1
            if i % 25 == 0 or i == len(matched):
                print(f"  Progresso: {i}/{len(matched)}")
            time.sleep(0.05)
        except Exception as exc:
            errors.append(f"{row['itemCode']}: {exc}")

    print(f"\nImportação concluída: {ok}/{len(matched)} salvos")
    if errors:
        print(f"Erros ({len(errors)}):")
        for err in errors[:15]:
            print(f"  - {err}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
