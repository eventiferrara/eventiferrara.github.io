# Piano — Calendario Eventi Ferrara (webapp per albergatori/operatori)

## Context

Serve uno strumento pubblico, al servizio degli albergatori e operatori turistici di
Ferrara, per **sapere in anticipo quali eventi ci sono in città** e regolarsi su prezzi
e personale. Il calendario è **collaborativo**: ogni operatore aggiunge gli eventi che
conosce. In più, una sezione di **analisi** mette in relazione le presenze turistiche
giornaliere (dati ufficiali della Regione) con gli eventi, e una sezione **admin** (solo
Zeno) per caricare/aggiornare i file delle presenze e degli eventi storici.

Vincoli chiave dell'utente: il database **non deve stare nel browser**, deve essere
**salvato lato server a ogni modifica** e **facilmente ripristinabile**; interfaccia
**molto semplice**; accesso **pubblico** a tutti gli operatori.

### Decisioni già prese con l'utente
- **Database: Firebase (Google)** — Firestore + Storage. Scelto perché è già nel suo
  ecosistema Google, il free tier non si sospende, e gestisce nativamente la scrittura
  pubblica multi-utente.
- **Pubblicazione eventi immediata** (senza approvazione), con: nome della struttura che
  inserisce + controllo anti-duplicato + poteri admin di modifica/eliminazione.
- **Telegram**: il bot **notifica sul canale ogni nuovo evento** (unico ruolo richiesto).

## Architettura

```
OPERATORI (pubblico)                          ADMIN = Zeno (login)
        |  inserisce/legge eventi                     |  carica Excel presenze/eventi
        v                                             v
   WEBAPP statica (HTML+JS, Firebase JS SDK) <----- stessa webapp, sezione protetta
        |  read/write
        v
   FIREBASE: Firestore (eventi, presenze) + Storage (file Excel) + Auth (solo admin)
        ^
        |  legge via Firebase Admin (service account)
   GITHUB ACTION (Python), schedulata via cron-job.org ogni ~15 min:
     1) snapshot dati -> JSON nel repo (backup + cronologia/ripristino via git)
     2) rileva eventi nuovi vs snapshot precedente -> li pubblica sul CANALE Telegram
```

- **Frontend**: pagina singola `index.html` + `app.js` + `style.css`, vanilla JS in
  italiano (stesso stile dei progetti esistenti). Librerie via CDN: Firebase JS SDK,
  **Chart.js** (grafici), **SheetJS/xlsx** (lettura Excel), **Fuse.js** (ricerca per
  somiglianza nomi evento). UI semplice, mobile-friendly, 4 schede in alto.
- **Codice su GitHub** (repo pubblico, nuova cartella-progetto
  `passione idee e progetti/eventi-ferrara/`), come da sua convenzione. La `apiKey`
  Firebase nel client NON è un segreto: la sicurezza è data dalle Security Rules.
- **Deploy webapp**: GitHub Pages (come scadenze-app) — gratis e già noto. (Firebase
  Hosting resta alternativa equivalente.)

## Modello dati (Firestore)

- **`eventi`** (un documento per evento):
  `{ dataInizio:"YYYY-MM-DD", dataFine:"YYYY-MM-DD", nome:"MAIUSCOLO",
     tipologia:"culturale_musicale|congressuale_fieristico|sportivo",
     previsione:"basso|medio|alto", struttura:"chi lo inserisce",
     origine:"operatore|admin_import", createdAt }`
- **`presenze`** (un documento per anno, id = `"YYYY"`):
  `{ anno:2024, giorni:{ "2024-01-01":1234, ... }, updatedAt }` — 365 voci stanno
  comodamente nel limite di 1 MB del documento; lookup e confronti immediati.
- **Festività nazionali dal 2024**: calcolate **lato client** (Pasqua/Pasquetta con
  algoritmo + date fisse: 1/1, 6/1, 25/4, 1/5, 2/6, 15/8, 1/11, 8/12, 25/12, 26/12;
  opz. patrono S. Giorgio 23/4). Mostrate nel calendario senza scrivere nel DB.

## Le 4 sezioni

### 1) INSERISCI EVENTO (form)
- Data inizio / Data fine con date picker (fine default = inizio).
- Nome evento: input **forzato in MAIUSCOLO**, con placeholder di esempio
  ("FERRARA SUMMER FESTIVAL – nome artista", "PALAZZO DEI DIAMANTI – nome mostra") e
  autocompletamento dai nomi già presenti.
- Tipologia: tendina (culturale/musicale · congressuale/fieristico · sportivo).
- Previsione presenze: tendina **basso=🟡 / medio=🟢 / alto=🔴**.
- Struttura inserente: testo (tracciabilità).
- **Anti-duplicato**: al salvataggio, ricerca con Fuse.js eventi con nome simile e date
  sovrapposte → avviso "forse già presente: X (date)" con conferma.
- Salva su Firestore (la notifica Telegram parte dalla Action, vedi sotto).

### 2) CALENDARIO EVENTI
- **Vista A — tabella scorrevole**: col. Data | col. Eventi di quel giorno, con **pallino
  colorato** per previsione. Gli eventi multi-giorno compaiono **ripetuti in ogni
  giornata** del periodo.
- **Vista B — ricerca per data/intervallo**: salta a una data anche a +2 anni.

### 3) ANALISI PRESENZE/EVENTO (grafici con Chart.js)
- **Analisi 1**: l'utente sceglie un intervallo (inizio–fine) e lo confronta con
  (a) un altro intervallo (stesso anno o anni diversi) **oppure** (b) un **nome evento**
  cercato per somiglianza (Fuse.js) — tendina con nomi simili e relative date. Output:
  **differenza di presenze per ogni giorno**.
- **Analisi 2**: due intervalli a confronto, **istogramma** (x = date, y = presenze,
  barre di colore diverso per intervallo).

### 4) AMMINISTRATORE (solo Zeno)
- Accesso protetto. **Sicurezza**: invece della sola password "adminZENO" scritta nel
  codice (aggirabile da chiunque ispezioni il JS), si usa **Firebase Auth (email/password,
  solo il tuo account)** — più robusto e necessario per proteggere davvero i dati con le
  Security Rules. La password la scegli tu (può essere adminZENO).
- **Upload `PRESENZE_YYYY.xlsx`**: due colonne (data | presenze, tutti i giorni dell'anno).
  Letto con SheetJS, **sovrascrive** `presenze/{YYYY}` e salva il file originale in Storage
  (stesso nome = sovrascrittura) per ripristino.
- **Upload `EVENTI_YYYY.xlsx`**: due colonne (data | nome evento) → import in `eventi`
  (origine `admin_import`). Supporto `.docx` (nome + date) best-effort via mammoth.js.
- Gestione eventi: l'admin può **modificare/eliminare qualsiasi evento**.

## Telegram + Backup/Ripristino (una sola Action Python)
Riusa il tuo schema collaudato (GitHub Actions + Python + Telegram + cron-job.org di
allerta-vento/scadenze). Una Action schedulata ogni ~15 min:
1. legge Firestore via **Firebase Admin SDK** (service account, in GitHub Secrets);
2. scrive uno **snapshot JSON** dei dati nel repo → ogni commit è un **punto di
   ripristino** versionato (git);
3. confronta con lo snapshot precedente, e per ogni **evento nuovo** invia un messaggio
   al **canale Telegram** (es. "🆕 FERRARA SUMMER FESTIVAL · 12–15 lug · previsione 🔴 ALTA").

Nota su "salvato a ogni modifica": Firestore persiste **ogni** modifica all'istante lato
server (il dato non vive nel browser e non si perde). I punti di **ripristino versionati**
sono gli snapshot JSON (frequenti, ~15 min, + possibilità di snapshot manuale on-demand).
Il commit git *letteralmente* a ogni singola modifica richiederebbe le Cloud Functions a
pagamento: l'approccio a polling è l'equivalente gratuito e robusto.

## Security Rules (Firestore/Storage)
- `eventi`: lettura **pubblica**; creazione **pubblica** (con validazione dei campi);
  modifica/eliminazione **solo admin** (uid = tuo).
- `presenze`: lettura **pubblica** (serve all'analisi); scrittura **solo admin**.
- `Storage` (file Excel): lettura/scrittura **solo admin**.

## Cosa dovrai predisporre tu (ti guido passo passo in esecuzione)
1. Progetto **Firebase** (piano Spark gratis): attiva Firestore, Storage, Auth
   (email/password) e crea il tuo account admin.
2. **Telegram**: canale + bot admin del canale → `TELEGRAM_TOKEN` e `CHAT_ID`.
3. **Repo GitHub** per codice + Action + snapshot; **service account** Firebase come secret.
4. **cron-job.org**: job che lancia la Action (come per gli altri progetti).
5. Pubblicazione webapp su **GitHub Pages**.

## Passi di esecuzione (ordine)
1. Scaffold repo/cartella + `index.html`/`app.js`/`style.css` con le 4 schede e config Firebase.
2. Modello dati + Security Rules + utility (festività, colori, Fuse.js, date).
3. Sezione **Inserisci Evento** (form + anti-duplicato + scrittura Firestore).
4. Sezione **Calendario** (vista tabella + ricerca per data).
5. Sezione **Analisi** (analisi 1 differenze + analisi 2 istogramma, Chart.js).
6. Sezione **Admin** (Auth, upload Excel presenze/eventi, gestione eventi).
7. Action Python (snapshot+backup+notifica Telegram) + workflow + secrets + cron-job.org.
8. Deploy GitHub Pages + test end-to-end + popolamento iniziale (presenze storiche).

## Deciso
- **Admin via Firebase Auth** (account email/password, solo Zeno). L'utente ha già un
  accesso Firebase/Google configurato per un'altra app: lo riusiamo.
- Come prima azione, appena creata la cartella-progetto, copiare questo piano dentro come
  `PIANO.md`.

## Assunzioni da confermare in approvazione
- **Formato file presenze/eventi**: assumo Excel a 2 colonne (data | valore). Se la Regione
  li pubblica con un layout diverso, adatto il parser (mi servirà un file di esempio reale).
- Deploy su **GitHub Pages** (come scadenze-app); altrimenti Firebase Hosting.

## Verifica (end-to-end)
- Inserire un evento da due "operatori" diversi → compare subito in calendario col pallino
  giusto; anti-duplicato scatta sul secondo inserimento simile.
- Caricare un `PRESENZE_2024.xlsx` in admin → analisi 1 e 2 mostrano numeri/grafici
  coerenti; ricaricare lo stesso file sovrascrive senza duplicati.
- Far girare la Action manualmente → snapshot JSON committato nel repo + messaggio del
  nuovo evento sul canale Telegram.
- Verificare che un utente non-admin NON possa scrivere su `presenze` (Security Rules).
```
