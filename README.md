# 📅 Eventi Ferrara

Webapp **pubblica** per albergatori e operatori turistici di Ferrara: un calendario
**condiviso** degli eventi in città, per organizzarsi su prezzi e personale, più una
sezione di **analisi delle presenze turistiche** in relazione agli eventi.

- **Database server-side** (Firebase Firestore): i dati NON stanno nel browser, sono
  salvati a ogni modifica e ripristinabili.
- **Scrittura pubblica**: ogni operatore aggiunge eventi (compaiono subito).
- **Telegram**: un bot pubblica sul canale ogni nuovo evento.
- **Area amministratore** (solo Zeno): carica i file delle presenze/eventi.

## Struttura del progetto

```
index.html / style.css        webapp (UI, 4 schede)
firebase-config.js            <-- DA COMPILARE con la config del tuo progetto Firebase
utils.js / app.js             logica della webapp
firestore.rules               regole di sicurezza Firestore  (da incollare in console)
storage.rules                 regole di sicurezza Storage     (da incollare in console)
notifica_telegram.py          snapshot/backup + notifica eventi (gira come Action)
requirements.txt              dipendenze Python
.github/workflows/notifica.yml workflow che esegue lo script
data/                         snapshot.json + notificati.json (creati dall'Action)
PIANO.md                      il piano approvato
```

## Le 4 sezioni

1. **Inserisci evento** — data inizio/fine, nome (MAIUSCOLO, con suggerimenti),
   tipologia, previsione presenze (🟡 basso / 🟢 medio / 🔴 alto), struttura che inserisce.
   Controllo anti-duplicato su nome simile + date sovrapposte.
2. **Calendario eventi** — tabella scorrevole (data | eventi, con pallino colorato; eventi
   multi-giorno ripetuti su ogni giorno) + ricerca per data/intervallo (anche anni futuri).
   Festività nazionali mostrate in automatico dal 2024.
3. **Analisi presenze/evento** — (1) confronto giorno-per-giorno tra due periodi o tra un
   periodo e un evento (con ricerca per somiglianza del nome); (2) istogramma di confronto
   presenze tra due periodi.
4. **Amministratore** — login (Firebase Auth), upload `PRESENZE_YYYY` (sovrascrive l'anno),
   upload `EVENTI_YYYY` (Excel o Word), modifica/elimina qualsiasi evento.

---

# 🛠️ Setup (una volta sola)

### 1) Progetto Firebase (gratis, piano Spark)
1. Vai su <https://console.firebase.google.com> → **Aggiungi progetto** (es. `eventi-ferrara`).
2. **Build → Firestore Database → Crea database** (modalità produzione, regione europea es. `eur3`).
3. **Build → Authentication → Inizia → Email/Password** (abilita). Poi scheda **Users →
   Aggiungi utente**: crea il TUO account admin (email + password a scelta, anche `adminZENO`).
   Copia il suo **UID utente**.
4. **Impostazioni progetto (⚙️) → Le tue app → App web (</>)**: registra un'app e copia
   l'oggetto `firebaseConfig`.

> NB: lo **Storage** non serve (richiederebbe il piano a pagamento). I dati delle presenze
> stanno in Firestore e nel backup `data/snapshot.json` su GitHub: restiamo sul piano gratuito.

### 2) Compila i file
- Incolla `firebaseConfig` in **`firebase-config.js`**.
- In **`firestore.rules`** sostituisci `INCOLLA_UID_ADMIN` con il tuo UID, poi incolla il
  contenuto nella scheda **Regole** di Firestore (console Firebase) e **Pubblica**.

### 3) Telegram
1. Crea il **canale** pubblico (es. `@EVENTIFERRARA`) dove usciranno gli avvisi.
2. Crea un **bot** con [@BotFather](https://t.me/BotFather) → ottieni il **token**.
3. Aggiungi il bot come **amministratore del canale** (con permesso di pubblicare).
4. `TELEGRAM_CHAT_ID` = lo username del canale, es. `@EVENTIFERRARA`.

### 4) GitHub
1. Crea il repo (es. `github.com/zenogovoni-art/eventi-ferrara`) e carica questi file.
2. **Settings → Secrets and variables → Actions → New repository secret**, aggiungi:
   - `FIREBASE_SERVICE_ACCOUNT` → contenuto del file JSON del **service account**
     (Firebase → Impostazioni progetto → **Account di servizio** → *Genera nuova chiave privata*;
     incolla TUTTO il JSON).
   - `TELEGRAM_TOKEN` → token del bot.
   - `TELEGRAM_CHAT_ID` → `@EVENTIFERRARA`.
3. **Settings → Pages**: Source = `Deploy from a branch`, branch `main`, cartella `/ (root)`.
   La webapp sarà su `https://zenogovoni-art.github.io/eventi-ferrara/`.

### 5) cron-job.org (come gli altri progetti)
Crea un job che ogni ~15 min chiama l'API di GitHub per lanciare il workflow:
- URL: `https://api.github.com/repos/zenogovoni-art/eventi-ferrara/actions/workflows/notifica.yml/dispatches`
- Metodo: **POST**, body: `{"ref":"main"}`
- Header: `Authorization: Bearer <TOKEN_GITHUB_FINE_GRAINED>` (permesso *Actions: read+write* su questo repo),
  `Accept: application/vnd.github+json`

> C'è anche un cron di riserva dentro il workflow (ogni 30 min), ma lo schedule di GitHub
> è inaffidabile: il driver principale resta cron-job.org.

---

# 📥 Formato dei file Excel (sezione Amministratore)

- **`PRESENZE_YYYY.xlsx`** — due colonne: **data** | **presenze** (un riga per giorno).
  Le date possono essere `gg/mm/aaaa` o formato data Excel. Caricando di nuovo lo stesso
  anno si **sovrascrive**.
- **`EVENTI_YYYY.xlsx`** — due colonne: **data** | **nome evento**.
  In alternativa un **Word `.docx`** con righe contenenti nome dell'evento e le date.

> Quando avrai un file vero della Regione, mandamelo: se il layout è diverso, adatto il
> parser in pochi minuti.

---

# ✅ Test rapido
1. Apri la webapp, inserisci un evento da "due strutture" diverse → compare subito nel
   calendario col pallino giusto; il secondo inserimento simile fa scattare l'anti-duplicato.
2. In **Amministratore** fai login e carica un `PRESENZE_2024.xlsx` → le due analisi mostrano
   numeri e grafico.
3. Lancia il workflow a mano (scheda **Actions → Run workflow**) → vedi comparire
   `data/snapshot.json` nel repo e il messaggio del nuovo evento sul canale Telegram.
