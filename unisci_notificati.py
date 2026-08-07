#!/usr/bin/env python3
"""Unisce la lista degli eventi gia' notificati con quella pubblicata sul repo.

Serve al workflow quando il push viene rifiutato perche' un altro run ha
pubblicato nel frattempo: si riparte da origin e si ri-applicano i nostri file,
ma notificati.json non puo' essere semplicemente sovrascritto, altrimenti gli
eventi segnati dall'altro run tornerebbero "nuovi" e la notifica partirebbe due
volte. Si fa quindi l'unione dei due elenchi, tenendo solo gli id ancora
presenti nello snapshot (la stessa potatura di notifica_telegram.py).

Uso: unisci_notificati.py <nostro_notificati.json> <nostro_snapshot.json> <destinazione.json>
"""
import json
import os
import sys


def carica(path, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def main():
    nostri_path, snapshot_path, destinazione = sys.argv[1:4]

    nostri = set(carica(nostri_path, []))
    remoti = set(carica(destinazione, []))
    snapshot = carica(snapshot_path, {})

    notificati = sorted((nostri | remoti) & set(snapshot))

    os.makedirs(os.path.dirname(destinazione) or ".", exist_ok=True)
    with open(destinazione, "w", encoding="utf-8") as f:
        json.dump(notificati, f, ensure_ascii=False, indent=2, default=str)

    print(
        f"notificati.json: {len(nostri)} locali + {len(remoti)} remoti "
        f"-> {len(notificati)} dopo unione e potatura"
    )


if __name__ == "__main__":
    main()
