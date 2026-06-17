#!/usr/bin/env python3
# Genera gli screenshot del sito (home + sezioni) usati da locandina e presentazione.
# Cattura la pagina reale con Chrome headless: i dati arrivano da Firebase (lettura pubblica).
# Uso: python3 genera_screenshot.py   (richiede Google Chrome installato)
import os, subprocess, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)            # cartella del progetto (dove sta index.html)
OUT  = os.path.join(HERE, "screenshots")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
os.makedirs(OUT, exist_ok=True)

with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as fh:
    BASE = fh.read()

def shot(out_png, w, h, html_path, budget=10000):
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    f"--window-size={w},{h}", f"--screenshot={out_png}",
                    f"--virtual-time-budget={budget}", "--force-device-scale-factor=2",
                    f"file://{html_path}"],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def wrapper(section):
    """Copia di index con hero nascosta e una sezione attiva."""
    inj = f"""
<style id="__shot">.hero{{display:none!important}}.hamburger{{display:none!important}}
main{{padding-top:34px!important;max-width:1040px}}</style>
<script>window.addEventListener('load',function(){{setTimeout(function(){{
  try{{mostraTab('{section}');}}catch(e){{}} window.scrollTo(0,0);
}},3000);}});</script>
"""
    p = os.path.join(ROOT, f"__shot_{section}.html")
    with open(p, "w", encoding="utf-8") as f:
        f.write(BASE.replace("</body>", inj + "\n</body>"))
    return p

# 1) HOME (hero) — viewport pieno
home = os.path.join(ROOT, "__shot_home.html")
shutil.copyfile(os.path.join(ROOT, "index.html"), home)
shot(os.path.join(OUT, "home.png"), 1500, 1000, home)

# 2) sezioni interne
temps = [home]
for sec, w, h in [("calendario", 1200, 1150), ("inserisci", 1200, 1180), ("analisi", 1200, 1250)]:
    p = wrapper(sec); temps.append(p)
    shot(os.path.join(OUT, f"{sec}.png"), w, h, p)

for p in temps:
    try: os.remove(p)
    except OSError: pass

print("Screenshot generati in", OUT)
for f in sorted(os.listdir(OUT)):
    print(" -", f, os.path.getsize(os.path.join(OUT, f)) // 1024, "KB")
