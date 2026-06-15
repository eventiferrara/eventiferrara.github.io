// ============================================================================
//  UTILITY COMUNI — date, festività, colori, ricerca per somiglianza
// ============================================================================

// ---- Costanti dominio --------------------------------------------------------
const TIPOLOGIE = {
  culturale_musicale:      "Culturale / musicale",
  congressuale_fieristico: "Congressuale / fieristico",
  sportivo:                "Sportivo"
};

const PREVISIONI = {
  basso: { label: "Basso", colore: "#f2c200", emoji: "🟡" },
  medio: { label: "Medio", colore: "#2faa3f", emoji: "🟢" },
  alto:  { label: "Alto",  colore: "#e0413a", emoji: "🔴" }
};

const MESI = ["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
const GIORNI = ["dom","lun","mar","mer","gio","ven","sab"];
const GIORNI_FULL = ["domenica","lunedì","martedì","mercoledì","giovedì","venerdì","sabato"];

// ---- Date (lavoriamo con stringhe "YYYY-MM-DD" per evitare problemi di fuso) --
function oggiISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function pad(n){ return String(n).padStart(2,"0"); }

// Da "YYYY-MM-DD" a Date locale (mezzogiorno, per evitare slittamenti di fuso)
function isoADate(iso){
  const [y,m,g] = iso.split("-").map(Number);
  return new Date(y, m-1, g, 12, 0, 0);
}
function dateAIso(d){
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

// Elenco di tutte le date (ISO) da `da` a `a` inclusi
function intervalloDate(daIso, aIso){
  const out = [];
  let d = isoADate(daIso);
  const fine = isoADate(aIso);
  while (d <= fine){
    out.push(dateAIso(d));
    d.setDate(d.getDate()+1);
  }
  return out;
}

// Formattazione leggibile: "lun 12 lug 2026"
function dataLeggibile(iso){
  const d = isoADate(iso);
  return `${GIORNI[d.getDay()]} ${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
}
// Compatta: "12 lug"
function dataCompatta(iso){
  const d = isoADate(iso);
  return `${d.getDate()} ${MESI[d.getMonth()]}`;
}
// Estesa: "lunedì 12/07/2026"
function dataEstesa(iso){
  const d = isoADate(iso);
  return `${GIORNI_FULL[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
}
// Stesso giorno/mese dell'anno precedente (gestisce il 29/02)
function annoPrecedente(iso){
  const [y,m,g] = iso.split("-").map(Number);
  const py = y - 1;
  const bisestile = (py%4===0 && py%100!==0) || py%400===0;
  if (m===2 && g===29 && !bisestile) return `${py}-02-28`;
  return `${py}-${pad(m)}-${pad(g)}`;
}
function isWeekend(iso){
  const g = isoADate(iso).getDay();
  return g === 0 || g === 6;
}

// ---- Festività nazionali italiane (calcolate, dal 2024) ----------------------
// Algoritmo di Gauss/Meeus per la Pasqua (domenica di Pasqua).
function pasqua(anno){
  const a = anno % 19, b = Math.floor(anno/100), c = anno % 100;
  const d = Math.floor(b/4), e = b % 4, f = Math.floor((b+8)/25);
  const g = Math.floor((b-f+1)/3), h = (19*a+b-d-g+15) % 30;
  const i = Math.floor(c/4), k = c % 4, l = (32+2*e+2*i-h-k) % 7;
  const m = Math.floor((a+11*h+22*l)/451);
  const mese = Math.floor((h+l-7*m+114)/31);
  const giorno = ((h+l-7*m+114) % 31) + 1;
  return `${anno}-${pad(mese)}-${pad(giorno)}`;
}
function addGiorni(iso, n){
  const d = isoADate(iso); d.setDate(d.getDate()+n); return dateAIso(d);
}

// Restituisce { "YYYY-MM-DD": "Nome festività" } per un dato anno (>=2024)
function festivitaAnno(anno){
  if (anno < 2024) return {};
  const f = {
    [`${anno}-01-01`]: "Capodanno",
    [`${anno}-01-06`]: "Epifania",
    [`${anno}-04-23`]: "San Giorgio (patrono Ferrara)",
    [`${anno}-04-25`]: "Festa della Liberazione",
    [`${anno}-05-01`]: "Festa del Lavoro",
    [`${anno}-06-02`]: "Festa della Repubblica",
    [`${anno}-08-15`]: "Ferragosto",
    [`${anno}-11-01`]: "Ognissanti",
    [`${anno}-12-08`]: "Immacolata",
    [`${anno}-12-25`]: "Natale",
    [`${anno}-12-26`]: "Santo Stefano"
  };
  const p = pasqua(anno);
  f[p] = "Pasqua";
  f[addGiorni(p,1)] = "Lunedì dell'Angelo (Pasquetta)";
  return f;
}

// Cache festività per anno
const _festCache = {};
function festivitaDi(iso){
  const anno = Number(iso.slice(0,4));
  if (!_festCache[anno]) _festCache[anno] = festivitaAnno(anno);
  return _festCache[anno][iso] || null;
}

// ---- Testo / nomi ------------------------------------------------------------
function maiuscolo(s){ return (s||"").toUpperCase(); }
function normalizza(s){
  return (s||"").toString().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g,"") // togli accenti
    .replace(/\s+/g," ").trim();
}

// ---- HTML escaping (sicurezza, input pubblico) -------------------------------
function esc(s){
  return (s==null?"":String(s))
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
