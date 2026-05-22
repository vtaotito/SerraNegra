#!/usr/bin/env python3
import os
import pandas as pd
import requests

BASE = os.environ.get("PANEL_URL", "https://painel.garrafariaserranegra.com.br")
USER = os.environ.get("PANEL_USER", "vitor.tito")
PASS = os.environ.get("PANEL_PASS", "Admin@2026")
XLSX = os.environ.get(
    "MARKUP_XLSX",
    r"c:\Users\Vitor A. Tito\Documents\GPTO\GSN\Markup_GSN.xlsx",
)


def calc_cmv(v, fr, sc, co, pc, ic, ip):
    denom = 1 - (pc + ic)
    base = v / denom if denom > 0 else v
    return base + base * ip + fr + co + sc


s = requests.Session()
s.post(f"{BASE}/api/auth/login", json={"username": USER, "password": PASS}, timeout=60)
data = s.get(f"{BASE}/api/sap/markup/items", timeout=120).json()

df = pd.read_excel(XLSX, sheet_name="Planilha1", header=None)
sheet = {}
for i in range(10, len(df)):
    r = df.iloc[i]
    cod = r.iloc[7]
    if pd.isna(cod):
        continue

    def num(j):
        v = r.iloc[j]
        return None if pd.isna(v) else float(v)

    sheet[str(cod).strip().upper()] = {"cmv": num(17)}

items = {i["itemCode"].upper(): i for i in data["items"]}
checked = mismatch = 0
for code, sh in sheet.items():
    if code not in items:
        continue
    it = items[code]
    cmv_panel = calc_cmv(
        float(it["v"]), float(it["fr"]), float(it["sc"]), float(it["co"]),
        float(it["pc"]), float(it["ic"]), float(it["ip"]),
    )
    checked += 1
    if sh["cmv"] and abs(cmv_panel - sh["cmv"]) > 0.05:
        mismatch += 1
        print(f"MISMATCH {code}: planilha={sh['cmv']:.2f} painel={cmv_panel:.2f}")

overrides = sum(1 for c in sheet if c in items and items[c].get("hasOverride"))
print(f"Verificados: {checked}")
print(f"Overrides ativos: {overrides}")
print(f"Divergencias: {mismatch}")

for code in ["GN0000022", "PO0000077", "GN0000048"]:
    if code in items:
        it = items[code]
        cmv = calc_cmv(
            float(it["v"]), float(it["fr"]), float(it["sc"]), float(it["co"]),
            float(it["pc"]), float(it["ic"]), float(it["ip"]),
        )
        print(f"Sample {code}: CMV unit R${cmv/1000:.4f} override={it['hasOverride']}")
