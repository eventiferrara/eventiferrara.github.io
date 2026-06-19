# Selezione eventi a richiamo turistico — Calendario Ferrara 2026

Fonte: Delibera Giunta Comunale n. 73 del 03/03/2026 — Calendario generale eventi 2026 (424 voci).

## Obiettivo
Estrarre dal calendario solo gli eventi che possono dare un **vero contributo alle presenze turistiche** (pernottamenti / domanda alberghiera), distinguendoli dall'**animazione locale** pensata per i residenti.

## Criterio di inclusione
Un evento entra in lista se soddisfa almeno uno di questi:
1. Richiamo **nazionale o internazionale** (visitatori da fuori provincia che possono pernottare).
2. **Festival/fiere pluri-giorno** che sono di per sé destinazione di viaggio.
3. **Grandi concerti** e festival musicali di richiamo (Vasco, Sotto le Stelle, Buskers, Summer Festival).
4. **Fiere professionali** alla Fiera di Ferrara con bacino espositori/visitatori extra-locale.
5. **Campionati/finali nazionali ed europei** e **raduni nazionali** (atleti + accompagnatori che soggiornano).
6. **Eventi identitari storici** di forte attrattività (Palio, Carnevale Estense, Autunno Ducale).

## Criterio di esclusione (animazione locale → NON in lista)
- Mercati ricorrenti: Mercato Contadino, Opere d'Ingegno, Fiera di Cose d'Altri Tempi, ANVA Artigianato e Natura, Fiera dell'Artigianato CNA, Markettino, Baule in Piazza.
- Celebrazioni istituzionali/civiche (Memoria, Foibe, Liberazione, Repubblica, Forze Armate, Eccidi…).
- Eventi di frazione/parrocchia (Cona, Viconovo, Pontelagoscuro, Codrea…).
- Sport locale (camminate della salute, piccoli trofei e tornei cittadini).
- Attività di circoli locali (tango/milonghe, aperitivi culturali, convegni locali).

## Risultato
- Eventi totali in delibera: **424**
- Eventi selezionati a valenza turistica: **88**
- File operativo: [eventi_turistici_2026.csv](eventi_turistici_2026.csv)

## Etichette assegnate
Ogni evento ha due etichette, coerenti con lo schema della webapp:

- **tipologia** (le 3 categorie già usate dal calendario):
  - `culturale_musicale` — festival, concerti, eventi culturali/storici, enogastronomici tematici, mercatini di Natale, carnevali, cinema.
  - `congressuale_fieristico` — fiere ed expo alla Fiera di Ferrara, convention, congressi.
  - `sportivo` — gare, campionati, raduni motoristici e sportivi.
- **previsione** (stima del contributo alle presenze): `alto` / `medio` / `basso`.
  - In questa selezione non compaiono eventi `basso`: la soglia di ingresso è già il `medio`.
  - `alto` = eventi che storicamente saturano o spingono fortemente la ricettività (es. Vasco, Buskers, Internazionale, Sotto le Stelle, 1000 Miglia, AEHT, Restauro, Remtech, Palio).

## Note di metodo
- Alcuni eventi gastronomici "di piazza" (es. Pizza Street, MangiaFExpo, Ferragosto in Darsena, Art&Ciocc) sono stati **esclusi** come animazione prevalentemente locale, pur potendo correlare con le presenze (cfr. nota progetto sul lift = correlazione, non causa).
- Le date seguono quanto indicato in delibera; dove la delibera riporta "da definire" l'evento è stato incluso solo se la finestra temporale era comunque ricavabile, altrimenti escluso in attesa di conferma.
- Eventi con doppia occorrenza nello stesso periodo (es. due tornei di karate concomitanti) sono stati accorpati in una voce.

## Come caricarli nel calendario
Il file `eventi_turistici_2026.csv` ha colonne: `dataInizio, dataFine, nome, tipologia, previsione, note`.
L'importer admin attuale (`caricaFileEventi`) legge solo data + nome e ignora `tipologia`/`previsione`.
Per caricare anche le etichette serve una piccola estensione dell'importer (lettura colonne 3 e 4), oppure un caricamento diretto. Da concordare prima di scrivere su Firebase.
