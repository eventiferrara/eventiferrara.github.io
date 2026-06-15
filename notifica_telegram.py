#!/usr/bin/env python3
# ============================================================================
#  Eventi Ferrara — snapshot/backup + notifica Telegram dei nuovi eventi
#  ----------------------------------------------------------------------------
#  Gira come GitHub Action (schedulata via cron-job.org, come gli altri progetti).
#  Cosa fa a ogni esecuzione:
#    1) legge Firestore (eventi + presenze) con il Firebase Admin SDK
#    2) salva uno snapshot JSON in data/snapshot.json  (= backup versionato dal
#       commit del workflow -> ogni commit è un punto di ripristino)
#    3) confronta con gli eventi già notificati (data/notificati.json) e manda
#       sul CANALE Telegram un messaggio per ogni evento nuovo
#
#  Variabili d'ambiente (GitHub Secrets):
#    FIREBASE_SERVICE_ACCOUNT  -> contenuto JSON del service account Firebase
#    TELEGRAM_TOKEN            -> token del bot
#    TELEGRAM_CHAT_ID          -> id/username del canale (es. @EVENTIFERRARA)
# ============================================================================

import os, json, sys
import urllib.request, urllib.parse

import firebase_admin
from firebase_admin import credentials, firestore

DATA_DIR   = os.path.join(os.path.dirname(__file__), "data")
SNAPSHOT   = os.path.join(DATA_DIR, "snapshot.json")
NOTIFICATI = os.path.join(DATA_DIR, "notificati.json")

MESI = ["", "gen", "feb", "mar", "apr", "mag", "giu",
        "lug", "ago", "set", "ott", "nov", "dic"]
PREV = {"basso": "🟡 BASSA", "medio": "🟢 MEDIA", "alto": "🔴 ALTA"}
TIPI = {"culturale_musicale": "Culturale/musicale",
        "congressuale_fieristico": "Congressuale/fieristico",
        "sportivo": "Sportivo"}


def data_compatta(iso):
    try:
        a, m, g = iso.split("-")
        return f"{int(g)} {MESI[int(m)]}"
    except Exception:
        return iso


def periodo(ev):
    di, df = ev.get("dataInizio", ""), ev.get("dataFine", "")
    anno = df[:4] if df else ""
    if di == df:
        return f"{data_compatta(di)} {anno}"
    return f"{data_compatta(di)} – {data_compatta(df)} {anno}"


# ---- Firebase ----------------------------------------------------------------
def init_firebase():
    sa = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "").strip()
    if not sa:
        sys.exit("Manca FIREBASE_SERVICE_ACCOUNT")
    cred = credentials.Certificate(json.loads(sa))
    firebase_admin.initialize_app(cred)
    return firestore.client()


def leggi_tutto(db):
    eventi = {}
    for d in db.collection("eventi").stream():
        eventi[d.id] = d.to_dict()
    presenze = {}
    for d in db.collection("presenze").stream():
        presenze[d.id] = d.to_dict()
    return eventi, presenze


# ---- Telegram ----------------------------------------------------------------
def invia_telegram(testo):
    token = os.environ["TELEGRAM_TOKEN"]
    chat  = os.environ["TELEGRAM_CHAT_ID"]
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    body = urllib.parse.urlencode({
        "chat_id": chat, "text": testo,
        "parse_mode": "HTML", "disable_web_page_preview": "true"
    }).encode()
    with urllib.request.urlopen(urllib.request.Request(url, data=body), timeout=30) as r:
        r.read()


def messaggio_evento(ev):
    righe = ["🆕 <b>NUOVO EVENTO A FERRARA</b>", "",
             f"<b>{ev.get('nome','')}</b>",
             f"📅 {periodo(ev)}"]
    if ev.get("tipologia"):
        righe.append(f"🏷️ {TIPI.get(ev['tipologia'], ev['tipologia'])}")
    if ev.get("previsione"):
        righe.append(f"👥 Previsione presenze: {PREV.get(ev['previsione'], ev['previsione'])}")
    if ev.get("struttura"):
        righe.append(f"🏨 segnalato da: {ev['struttura']}")
    return "\n".join(righe)


# ---- IO file di stato --------------------------------------------------------
def carica_json(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def salva_json(path, dati):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(dati, f, ensure_ascii=False, indent=2, default=str)


# ---- Main --------------------------------------------------------------------
def main():
    db = init_firebase()
    eventi, presenze = leggi_tutto(db)

    # 1) snapshot/backup (ordinato per stabilità del diff git)
    salva_json(SNAPSHOT, {
        "eventi": dict(sorted(eventi.items())),
        "presenze": dict(sorted(presenze.items())),
    })

    # 2) notifica eventi nuovi (solo quelli inseriti dagli operatori, non gli import admin)
    notificati = set(carica_json(NOTIFICATI, []))
    nuovi = [eid for eid, ev in eventi.items()
             if eid not in notificati and ev.get("origine") != "admin_import"]

    # primo avvio: se non esiste lo stato, NON inondare il canale con lo storico:
    # marca tutto come già notificato senza inviare.
    primo_avvio = not os.path.exists(NOTIFICATI)
    if primo_avvio:
        salva_json(NOTIFICATI, sorted(eventi.keys()))
        print(f"Primo avvio: marcati {len(eventi)} eventi come già notificati (nessun invio).")
        return

    inviati = 0
    for eid in nuovi:
        try:
            invia_telegram(messaggio_evento(eventi[eid]))
            notificati.add(eid)
            inviati += 1
        except Exception as e:
            print(f"Errore invio {eid}: {e}")

    # tieni nello stato solo gli id ancora esistenti (pulizia)
    notificati &= set(eventi.keys())
    salva_json(NOTIFICATI, sorted(notificati))
    print(f"Eventi nuovi notificati: {inviati}")


if __name__ == "__main__":
    main()
