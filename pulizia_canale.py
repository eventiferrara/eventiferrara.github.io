#!/usr/bin/env python3
"""Svuota il canale Telegram degli eventi: cancella i messaggi del bot.

Si lancia SOLO a mano, dalla scheda Actions, con l'input `pulizia_canale`.

LIMITE DI TELEGRAM, non aggirabile: un bot non puo' cancellare messaggi piu'
vecchi di 48 ore, nemmeno se e' amministratore del canale con il permesso
"Elimina messaggi". Quelli piu' vecchi restano nel canale per sempre. Per lo
stesso motivo si cancella un id alla volta invece di usare deleteMessages, che
e' atomico: un solo id fuori portata farebbe fallire l'intero blocco.

Il numero dell'ultimo messaggio si scopre inviandone uno di servizio (silenzioso)
e leggendone l'id: da li' si scende all'indietro. Gli id gia' cancellati o
inesistenti rispondono con un errore che viene semplicemente ignorato.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

TOKEN = os.environ["TELEGRAM_TOKEN"]
CHAT = os.environ["TELEGRAM_CHAT_ID"]
API = f"https://api.telegram.org/bot{TOKEN}/"

# quanti id scandire all'indietro partendo dall'ultimo
PROFONDITA = int(os.environ.get("PROFONDITA_PULIZIA", "3000"))
PAUSA = 0.05  # ~20 richieste al secondo, sotto il limite di Telegram


def chiama(metodo, **parametri):
    """Chiama l'API. Ritorna (ok, risultato_o_descrizione_errore)."""
    dati = urllib.parse.urlencode({"chat_id": CHAT, **parametri}).encode()
    try:
        with urllib.request.urlopen(API + metodo, data=dati, timeout=30) as r:
            return True, json.load(r).get("result")
    except urllib.error.HTTPError as e:
        try:
            return False, json.load(e).get("description", str(e))
        except Exception:
            return False, str(e)
    except Exception as e:
        return False, str(e)


def main():
    ok, chat = chiama("getChat")
    if not ok:
        print(f"Impossibile leggere il canale: {chat}")
        sys.exit(1)
    # si stampa solo il titolo: l'id del canale e' un secret e il log e' pubblico
    print(f"Canale: {chat.get('title')} ({chat.get('type')})")

    ok, msg = chiama("sendMessage", text="pulizia in corso…", disable_notification="true")
    if not ok:
        print(f"Impossibile inviare il messaggio di servizio: {msg}")
        sys.exit(1)
    ultimo = msg["message_id"]
    print(f"Ultimo messaggio: #{ultimo}. Scendo all'indietro per {PROFONDITA} id.")

    cancellati = 0
    troppo_vecchi = 0
    inesistenti = 0
    primo = max(1, ultimo - PROFONDITA + 1)

    for mid in range(ultimo, primo - 1, -1):
        ok, errore = chiama("deleteMessage", message_id=mid)
        if ok:
            cancellati += 1
        elif "too old" in str(errore) or "can't be deleted" in str(errore):
            troppo_vecchi += 1
        else:
            inesistenti += 1
        time.sleep(PAUSA)

    print(f"Cancellati: {cancellati}")
    print(f"Non cancellabili perche' oltre le 48 ore: {troppo_vecchi}")
    print(f"Id vuoti o gia' cancellati: {inesistenti}")
    if troppo_vecchi:
        print(
            "NB: i messaggi oltre le 48 ore restano nel canale: e' un limite di "
            "Telegram per i bot, non un errore di questo script."
        )


if __name__ == "__main__":
    main()
