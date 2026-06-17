// ============================================================================
//  APP — Eventi Ferrara
//  Stato in memoria + rendering delle 4 sezioni.
//  Dipende da: firebase-config.js (db, auth) e utils.js
// ============================================================================

let EVENTI = [];        // [{id, dataInizio, dataFine, nome, tipologia, previsione, struttura, origine}]
let PRESENZE = {};      // { 2024: {"2024-01-01": 1234, ...}, ... }
let EDIT_ID = null;     // se valorizzato, il form Inserisci aggiorna invece di creare

// ---- Avvio -------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initCatFiltri();
  initInserisci();
  initCalendario();
  initAnalisi();
  initAdmin();

  // default date = oggi
  const oggi = oggiISO();
  ["ev-inizio","ev-fine"].forEach(id => document.getElementById(id).value = oggi);
  document.getElementById("ev-fine").min = oggi;

  // anno corrente nell'hero (così non va aggiornato a mano)
  const annoEl = document.getElementById("hero-anno");
  if (annoEl) annoEl.textContent = "CALENDARIO " + new Date().getFullYear();

  ascoltaEventi();   // carica e tiene aggiornati gli eventi in tempo reale
  caricaPresenze();  // carica i dati presenze (sola lettura, pubblica)
});

// PWA: registra il service worker (sito installabile + fallback offline)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// ---- Navigazione schede ------------------------------------------------------
function initTabs(){
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => { mostraTab(btn.dataset.tab); chiudiMenu(); });
  });
  // voce HOME: torna in cima all'hero e mostra il calendario
  document.getElementById("nav-home").addEventListener("click", () => {
    mostraTab("calendario");
    chiudiMenu();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  // menu hamburger
  document.getElementById("menu-toggle").addEventListener("click", apriMenu);
  document.getElementById("menu-chiudi").addEventListener("click", chiudiMenu);
  document.getElementById("overlay").addEventListener("click", chiudiMenu);
  document.addEventListener("keydown", e => { if (e.key === "Escape") chiudiMenu(); });
}
function apriMenu(){
  document.getElementById("drawer").classList.add("aperto");
  document.getElementById("overlay").classList.add("aperto");
  document.getElementById("menu-toggle").setAttribute("aria-expanded", "true");
}
function chiudiMenu(){
  document.getElementById("drawer").classList.remove("aperto");
  document.getElementById("overlay").classList.remove("aperto");
  document.getElementById("menu-toggle").setAttribute("aria-expanded", "false");
}
function mostraTab(nome){
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("attiva", b.dataset.tab===nome));
  document.querySelectorAll(".pannello").forEach(p => p.classList.remove("attivo"));
  document.getElementById("tab-"+nome).classList.add("attivo");
  // i filtri per tipologia servono solo nella vista calendario (HOME)
  const filtri = document.getElementById("cat-filtri");
  if (filtri) filtri.style.display = (nome === "calendario") ? "" : "none";
}

// ============================================================================
//  CARICAMENTO DATI
// ============================================================================
function ascoltaEventi(){
  db.collection("eventi").onSnapshot(snap => {
    EVENTI = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    EVENTI.sort((a,b) => (a.dataInizio||"").localeCompare(b.dataInizio||""));
    aggiornaDatalistNomi();
    renderCalendario();
    aggiornaTabellaAdmin();
  }, err => console.error("Errore lettura eventi:", err));
}

async function caricaPresenze(){
  try{
    const snap = await db.collection("presenze").get();
    PRESENZE = {};
    snap.forEach(d => { PRESENZE[d.id] = (d.data().giorni)||{}; });
  }catch(e){ console.error("Errore lettura presenze:", e); }
  renderStatoPresenze();
}

// mostra, per ogni anno, fino a quale data le presenze sono caricate
function renderStatoPresenze(){
  const el = document.getElementById("presenze-stato");
  if (!el) return;
  const anni = Object.keys(PRESENZE).sort();
  const parti = anni.map(a => {
    const date = Object.keys(PRESENZE[a]||{}).sort();
    return date.length ? `<b>${a}</b> fino al ${dataNumerica(date[date.length-1])}` : null;
  }).filter(Boolean);
  el.innerHTML = parti.length
    ? "📌 Dati presenze caricati: " + parti.join(" · ")
    : "⚠️ Nessun dato presenze ancora caricato.";
}

function getPresenza(iso){
  const anno = iso.slice(0,4);
  return (PRESENZE[anno] && PRESENZE[anno][iso] != null) ? PRESENZE[anno][iso] : null;
}

// ============================================================================
//  DATO STORICO PRESENZE — quanto erano piene le giornate di un evento passato
//  ----------------------------------------------------------------------------
//  Misura il "lift" delle presenze nei giorni dell'evento rispetto alla baseline
//  degli stessi giorni-settimana nelle ±4 settimane (isola stagione e weekend).
//  Per un evento futuro lo aggancia per nome alle sue edizioni passate e media i
//  loro lift. ATTENZIONE: è correlazione, non causa — presenze alte nei giorni
//  dell'evento non significano che l'evento le abbia causate (può essere
//  stagione/weekend/altri eventi). Solo lettura; affianca la previsione manuale.
// ============================================================================
function liftEvento(dataInizio, dataFine){
  const gg = intervalloDate(dataInizio, dataFine);
  const ggSet = new Set(gg);
  const vals = gg.map(getPresenza).filter(v => v != null);
  if (!vals.length) return null;                    // nessun dato presenze nei giorni evento
  const mediaEv = vals.reduce((a,b)=>a+b,0) / vals.length;

  const basi = [];
  for (const d of gg){
    const vicini = [];
    for (let k=-4; k<=4; k++){
      if (k===0) continue;
      const nd = addGiorni(d, 7*k);                 // stesso giorno-settimana, k settimane prima/dopo
      if (ggSet.has(nd)) continue;                  // escludi i giorni dell'evento stesso
      const p = getPresenza(nd);
      if (p != null) vicini.push(p);
    }
    if (vicini.length) basi.push(vicini.reduce((a,b)=>a+b,0)/vicini.length);
  }
  if (!basi.length) return null;
  const baseline = basi.reduce((a,b)=>a+b,0) / basi.length;
  if (!baseline) return null;
  return { lift: (mediaEv - baseline) / baseline * 100, ngg: vals.length };
}

// edizioni passate dello stesso evento: match deterministico sul "nome base"
// (anno/edizione rimossi); fallback fuzzy stretto solo per i refusi.
function trovaEdizioniPassate(nome, annoNuovo, idCorrente){
  const candidati = EVENTI.filter(e =>
    e.id !== idCorrente && Number(e.dataInizio.slice(0,4)) < annoNuovo);
  if (!candidati.length) return [];
  const base = nomeBase(nome);
  let edizioni = candidati.filter(e => nomeBase(e.nome) === base);
  if (!edizioni.length){                                  // nessun match esatto -> refusi
    edizioni = candidati.filter(e => similNome(base, nomeBase(e.nome)) >= 0.88);
  }
  return edizioni;
}

// stima complessiva per un evento {nome, dataInizio, dataFine, id?}
function previsioneStorica(ev){
  const annoNuovo = Number(ev.dataInizio.slice(0,4));
  const edizioni = trovaEdizioniPassate(ev.nome, annoNuovo, ev.id);
  if (!edizioni.length) return { stato:"nessuno-storico" };

  const usate = [];
  for (const e of edizioni){
    const r = liftEvento(e.dataInizio, e.dataFine);
    if (r) usate.push({ ev:e, lift:r.lift, ngg:r.ngg, anno:Number(e.dataInizio.slice(0,4)) });
  }
  if (!usate.length) return { stato:"senza-dati" };

  // media pesata: le edizioni più recenti pesano di più
  let sw=0, swl=0;
  for (const u of usate){ const w = 1/Math.max(1, annoNuovo-u.anno); sw+=w; swl+=w*u.lift; }
  const lift = swl/sw;

  // confidenza: più edizioni e più giorni con dati = stima più affidabile
  const giorniTot = usate.reduce((a,u)=>a+u.ngg, 0);
  let confidenza = "bassa";
  if (usate.length>=3 || giorniTot>=10) confidenza = "alta";
  else if (usate.length>=2 || giorniTot>=4) confidenza = "media";

  const rif = usate.slice().sort((a,b)=>b.anno-a.anno)[0];   // edizione più recente
  return { stato:"ok", lift, livello:classificaLift(lift), confidenza, nEdizioni:usate.length, rif };
}

// aggiorna il riquadro suggerimento sotto il campo "previsione"
function aggiornaPrevisioneStorica(){
  const box = document.getElementById("ev-prev-storica");
  if (!box) return;
  const nome = document.getElementById("ev-nome").value.trim();
  const di   = document.getElementById("ev-inizio").value;
  const df   = document.getElementById("ev-fine").value;
  if (nome.length < 3 || !di || !df){ box.classList.add("nascosto"); box.innerHTML=""; return; }

  const r = previsioneStorica({ nome:maiuscolo(nome), dataInizio:di, dataFine:df, id:EDIT_ID });
  box.classList.remove("nascosto");
  if (r.stato === "nessuno-storico"){
    box.innerHTML = `📈 <b>Dato storico presenze:</b> <span class="ps-na">nessuno storico per questo evento — non calcolabile</span>`;
    return;
  }
  if (r.stato === "senza-dati"){
    box.innerHTML = `📈 <b>Dato storico presenze:</b> <span class="ps-na">edizioni passate trovate, ma senza dati presenze nei loro giorni</span>`;
    return;
  }
  const P = PREVISIONI[r.livello];
  const segno = r.lift>=0 ? "+" : "";
  const annoRif = r.rif.ev.dataInizio.slice(0,4);
  const frase = r.nEdizioni === 1
    ? `Nei giorni dell'edizione ${annoRif} le presenze erano <b>${segno}${r.lift.toFixed(0)}%</b> rispetto alla norma del periodo.`
    : `Nelle ${r.nEdizioni} edizioni passate le presenze erano in media <b>${segno}${r.lift.toFixed(0)}%</b> rispetto alla norma del periodo.`;
  box.innerHTML = `
    📈 <b>Dato storico presenze</b>
    <span class="pallino ${r.livello}"></span> <b>${P.label.toUpperCase()}</b>
    <div class="ps-frase">${frase}</div>
    <div class="ps-rif">Può dipendere da stagione/weekend, non solo dall'evento · confidenza ${r.confidenza} · rif. ${esc(r.rif.ev.nome)} ${annoRif}</div>`;
}

// ============================================================================
//  1) INSERISCI EVENTO
// ============================================================================
function initInserisci(){
  const form = document.getElementById("form-evento");
  const nome = document.getElementById("ev-nome");
  nome.addEventListener("input", () => { nome.value = maiuscolo(nome.value); });

  // il calendario "al" parte dal giorno scelto in "dal" (e non può andare prima)
  document.getElementById("ev-inizio").addEventListener("change", e => {
    const f = document.getElementById("ev-fine");
    f.min = e.target.value;
    if (!f.value || f.value < e.target.value) f.value = e.target.value;
  });

  // previsione storica calcolata: ricalcola al cambio di nome o date
  ["ev-nome","ev-inizio","ev-fine"].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("input", aggiornaPrevisioneStorica);
    el.addEventListener("change", aggiornaPrevisioneStorica);
  });

  form.addEventListener("submit", onSalvaEvento);
}

function aggiornaDatalistNomi(){
  const dl = document.getElementById("nomi-esistenti");
  const nomi = [...new Set(EVENTI.map(e => e.nome).filter(Boolean))].sort();
  dl.innerHTML = nomi.map(n => `<option value="${esc(n)}">`).join("");
}

let _confermaDuplicato = false;
async function onSalvaEvento(e){
  e.preventDefault();
  const esito = document.getElementById("esito-inserimento");
  esito.textContent = ""; esito.className = "esito";

  const dato = {
    dataInizio: document.getElementById("ev-inizio").value,
    dataFine:   document.getElementById("ev-fine").value,
    nome:       maiuscolo(document.getElementById("ev-nome").value.trim()),
    tipologia:  document.getElementById("ev-tipologia").value,
    previsione: document.getElementById("ev-previsione").value,
    struttura:  document.getElementById("ev-struttura").value.trim()
  };

  if (dato.dataFine < dato.dataInizio){
    return mostraEsito(esito, "La data di fine non può precedere quella di inizio.", false);
  }

  // --- controllo anti-duplicato (salta in modifica) ---
  if (!EDIT_ID && !_confermaDuplicato){
    const simili = trovaSimili(dato);
    if (simili.length){
      return mostraAvvisoDuplicato(simili);
    }
  }

  try{
    if (EDIT_ID){
      await db.collection("eventi").doc(EDIT_ID).update(dato);
      mostraEsito(esito, "✓ Evento aggiornato.", true);
      annullaModifica();
    } else {
      dato.origine = "operatore";
      dato.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("eventi").add(dato);
      mostraEsito(esito, "✓ Evento salvato! Apparirà nel calendario e verrà segnalato sul canale Telegram.", true);
      resetForm();
    }
  }catch(err){
    console.error(err);
    mostraEsito(esito, "Errore nel salvataggio: " + err.message, false);
  }
  _confermaDuplicato = false;
  document.getElementById("avviso-duplicato").classList.add("nascosto");
}

// eventi con nome simile E date sovrapposte
function trovaSimili(dato){
  const candidati = EVENTI.filter(ev => sovrapposti(ev, dato));
  if (!candidati.length) return [];
  const fuse = new Fuse(candidati, { keys:["nome"], threshold:0.45, ignoreLocation:true });
  return fuse.search(dato.nome).map(r => r.item).slice(0,3);
}
function sovrapposti(a, b){
  return a.dataInizio <= b.dataFine && b.dataInizio <= a.dataFine;
}

function mostraAvvisoDuplicato(simili){
  const box = document.getElementById("avviso-duplicato");
  box.innerHTML =
    "<b>⚠️ Forse questo evento è già stato inserito:</b><ul>" +
    simili.map(s => `<li>${esc(s.nome)} — ${dataCompatta(s.dataInizio)}–${dataCompatta(s.dataFine)} <span class="ev-meta">(${esc(s.struttura||"")})</span></li>`).join("") +
    "</ul>Vuoi salvarlo lo stesso? <button type='button' id='btn-conferma-dup' class='secondario'>Sì, salva comunque</button>";
  box.classList.remove("nascosto");
  document.getElementById("btn-conferma-dup").onclick = () => {
    _confermaDuplicato = true;
    document.getElementById("form-evento").requestSubmit();
  };
}

function resetForm(){
  const f = document.getElementById("form-evento");
  f.reset();
  const oggi = oggiISO();
  document.getElementById("ev-inizio").value = oggi;
  document.getElementById("ev-fine").value = oggi;
  document.getElementById("ev-fine").min = oggi;
  const box = document.getElementById("ev-prev-storica");
  if (box){ box.classList.add("nascosto"); box.innerHTML = ""; }
}
function annullaModifica(){
  EDIT_ID = null;
  document.querySelector("#form-evento button[type=submit]").textContent = "💾 Salva evento";
  document.querySelector("#tab-inserisci h2").textContent = "Inserisci un evento";
  resetForm();
}

function mostraEsito(el, msg, ok){
  el.textContent = msg;
  el.className = "esito " + (ok ? "ok" : "err");
}

// ============================================================================
//  2) CALENDARIO EVENTI
// ============================================================================
let _calDa = null, _calA = null; // range attivo (null = prossimi eventi)
let _calCat = "tutti";           // filtro tipologia attivo dalle pill della hero

// Pill di filtro per tipologia nella hero (Tutti / Culturale / Congressuale / Sportivo)
function initCatFiltri(){
  const pills = document.querySelectorAll("#cat-filtri .cat");
  pills.forEach(p => p.addEventListener("click", () => {
    _calCat = p.dataset.cat || "tutti";
    pills.forEach(x => x.classList.toggle("attiva", x === p));
    mostraTab("calendario");   // mostra il calendario filtrato
    chiudiMenu();
    renderCalendario();
  }));
}

function initCalendario(){
  document.getElementById("cal-cerca").addEventListener("click", () => {
    _calDa = document.getElementById("cal-da").value || null;
    _calA  = document.getElementById("cal-a").value || null;
    if (_calDa && !_calA) _calA = _calDa;
    if (_calA && !_calDa) _calDa = _calA;
    renderCalendario();
  });
  document.getElementById("cal-reset").addEventListener("click", () => {
    _calDa = _calA = null;
    document.getElementById("cal-da").value = "";
    document.getElementById("cal-a").value = "";
    renderCalendario();
  });
}

// Espande ogni evento su tutti i suoi giorni: { iso -> [eventi] }
function eventiPerGiorno(daIso, aIso){
  const mappa = {};
  EVENTI.forEach(ev => {
    if (!ev.dataInizio || !ev.dataFine) return;
    if (_calCat !== "tutti" && ev.tipologia !== _calCat) return;
    const inizio = ev.dataInizio < daIso ? daIso : ev.dataInizio;
    const fine   = ev.dataFine   > aIso  ? aIso  : ev.dataFine;
    if (inizio > fine) return;
    intervalloDate(inizio, fine).forEach(iso => {
      (mappa[iso] = mappa[iso] || []).push(ev);
    });
  });
  return mappa;
}

function renderCalendario(){
  const tbody = document.querySelector("#tabella-calendario tbody");
  let daIso, aIso;

  if (_calDa && _calA){
    daIso = _calDa; aIso = _calA;
  } else {
    // default: da oggi ai prossimi 60 giorni che contengono eventi (almeno 30gg di griglia)
    daIso = oggiISO();
    const ultimo = EVENTI.reduce((m,e) => e.dataFine>m?e.dataFine:m, addGiorni(daIso,30));
    aIso = ultimo;
  }

  const mappa = eventiPerGiorno(daIso, aIso);
  const giorni = intervalloDate(daIso, aIso);

  // le festività compaiono solo col filtro "Tutti", non con una tipologia specifica
  const mostraFest = _calCat === "tutti";

  // riepilogo sopra la tabella: filtro attivo, n. eventi e periodo
  const idEventi = new Set();
  Object.values(mappa).forEach(arr => arr.forEach(ev => idEventi.add(ev.id)));
  const nEventi = idEventi.size;
  aggiornaRiepilogoCal(nEventi, daIso, aIso);

  // in modalità "prossimi" mostro solo i giorni con eventi o festività (per non avere righe vuote infinite)
  const soloPieni = !( _calDa && _calA );
  const righe = giorni.filter(iso => !soloPieni || mappa[iso] || (mostraFest && festivitaDi(iso)));

  if (!righe.length){
    const filtroTxt = _calCat === "tutti" ? "" : ` per la tipologia “${TIPOLOGIE[_calCat]}”`;
    tbody.innerHTML = `<tr><td colspan="2" class="aiuto">Nessun evento${filtroTxt} nel periodo selezionato.</td></tr>`;
    return;
  }

  const ogg = oggiISO();
  tbody.innerHTML = righe.map(iso => {
    const fest = mostraFest ? festivitaDi(iso) : null;
    const evs = (mappa[iso]||[]);
    const cellaEventi = [
      fest ? `<div class="ev-riga">🎉 <span class="ev-nome">${esc(fest)}</span></div>` : "",
      ...evs.map(ev => `
        <div class="ev-riga">
          ${ev.previsione ? `<span class="pallino ${ev.previsione}" title="presenze: ${PREVISIONI[ev.previsione]?.label||""}"></span>` : ""}
          <span class="ev-nome">${esc(ev.nome)}</span>
          <span class="ev-meta">${ev.tipologia?("· "+TIPOLOGIE[ev.tipologia]):""}${ev.struttura?(" · "+esc(ev.struttura)):""}</span>
        </div>`)
    ].join("") || `<span class="ev-meta">—</span>`;

    const cls = [ fest?"festivo":"", isWeekend(iso)?"weekend":"", iso===ogg?"oggi":"" ].join(" ").trim();
    const badge = iso===ogg ? ` <span class="badge-oggi">oggi</span>` : "";
    return `<tr class="${cls}"><td class="col-data">${dataLeggibile(iso)}${badge}</td><td>${cellaEventi}</td></tr>`;
  }).join("");
}

// Riepilogo mostrato sopra la tabella: tipologia filtrata, n. eventi e periodo.
function aggiornaRiepilogoCal(nEventi, daIso, aIso){
  const el = document.getElementById("cal-riepilogo");
  if (!el) return;
  const cat = _calCat === "tutti" ? "Tutte le tipologie" : TIPOLOGIE[_calCat];
  const periodo = (_calDa && _calA)
    ? `dal ${dataCompatta(daIso)} al ${dataCompatta(aIso)}`
    : "prossimi eventi";
  const parolaEv = nEventi === 1 ? "evento" : "eventi";
  el.innerHTML = `<span class="ric-cat">${esc(cat)}</span> · <b>${nEventi}</b> ${parolaEv} · ${periodo}`;
}

// ============================================================================
//  3) ANALISI PRESENZE / EVENTO
// ============================================================================
let _graficoA2 = null;
let _graficoPattern = null;

// Plugin Chart.js: fasce verticali grigio chiaro dietro sabato e domenica.
// Gli slot dell'asse sono weekend quando indice%7 è 5 (Sab) o 6 (Dom).
const fasceWeekend = {
  id: "fasceWeekend",
  beforeDraw(chart){
    const { ctx, chartArea, scales } = chart;
    const x = scales.x; if (!x || !chartArea) return;
    const colori = { 5: "rgba(90,90,90,0.09)", 6: "rgba(90,90,90,0.17)" }; // sab più chiaro, dom più scuro
    const n = chart.data.labels.length;
    ctx.save();
    for (let i=0; i<n; i++){
      const wd = i % 7;
      if (wd !== 5 && wd !== 6) continue;
      const c = x.getPixelForValue(i);
      const prev = i>0   ? x.getPixelForValue(i-1) : 2*c - x.getPixelForValue(i+1);
      const next = i<n-1 ? x.getPixelForValue(i+1) : 2*c - x.getPixelForValue(i-1);
      const left = (prev+c)/2, right = (c+next)/2;
      ctx.fillStyle = colori[wd];
      ctx.fillRect(left, chartArea.top, right-left, chartArea.bottom-chartArea.top);
    }
    ctx.restore();
  }
};

function initAnalisi(){
  // le due analisi condividono le stesse 3 modalità (anno prec. / altro periodo / evento)
  ["a1","a2"].forEach(p => {
    document.querySelectorAll(`input[name=${p}-modo]`).forEach(r => r.addEventListener("change", () => aggiornaModo(p)));
    aggiornaModo(p);                                  // stato iniziale
    attivaRicercaEvento(p+"-evento-cerca", p+"-evento-lista");
  });
  document.getElementById("a1-confronta").addEventListener("click", analisi1);
  document.getElementById("a2-confronta").addEventListener("click", analisi2);

  // pattern settimanale: riempi il menu mesi (mese corrente preselezionato)
  const sel = document.getElementById("pat-mese");
  sel.innerHTML = MESI_FULL.map((m,i) => `<option value="${i}">${m}</option>`).join("");
  sel.value = new Date().getMonth();
  document.getElementById("pat-mostra").addEventListener("click", patternSettimanale);
}

// mostra/nasconde i box in base alla modalità scelta (annoprec nasconde entrambi)
function aggiornaModo(prefix){
  const modo = document.querySelector(`input[name=${prefix}-modo]:checked`).value;
  document.getElementById(prefix+"-box-evento").classList.toggle("nascosto", modo!=="evento");
  document.getElementById(prefix+"-box-periodo").classList.toggle("nascosto", modo!=="periodo");
}

// collega un campo di ricerca a una select, popolandola con eventi simili (Fuse.js)
function attivaRicercaEvento(inputId, listaId){
  document.getElementById(inputId).addEventListener("input", e => {
    const q = e.target.value.trim();
    const lista = document.getElementById(listaId);
    if (q.length < 2){ lista.innerHTML = ""; return; }
    const fuse = new Fuse(EVENTI, { keys:["nome"], threshold:0.5, ignoreLocation:true });
    lista.innerHTML = fuse.search(q).slice(0,15).map(r => r.item).map(ev =>
      `<option value="${ev.id}">${esc(ev.nome)} — ${dataCompatta(ev.dataInizio)}–${dataCompatta(ev.dataFine)} (${ev.dataInizio.slice(0,4)})</option>`
    ).join("");
  });
}

// ricava il Periodo B in base alla modalità scelta; ritorna {daB,aB,etichetta} o {err}
function risolviPeriodoB(prefix, daA, aA){
  const modo = document.querySelector(`input[name=${prefix}-modo]:checked`).value;
  if (modo === "evento"){
    const ev = EVENTI.find(e => e.id === document.getElementById(prefix+"-evento-lista").value);
    if (!ev) return { err:"Seleziona un evento dalla lista." };
    return { daB:ev.dataInizio, aB:ev.dataFine, etichetta:ev.nome };
  }
  if (modo === "annoprec"){
    const daB = annoPrecedente(daA), aB = annoPrecedente(aA);
    return { daB, aB, etichetta:"anno "+daB.slice(0,4) };
  }
  const daB = document.getElementById(prefix+"b-da").value, aB = document.getElementById(prefix+"b-a").value;
  if (!daB || !aB) return { err:"Imposta il Periodo B." };
  return { daB, aB, etichetta:"Periodo B" };
}

function analisi1(){
  const out = document.getElementById("a1-risultato");
  const daA = document.getElementById("a1-da").value, aA = document.getElementById("a1-a").value;
  if (!daA || !aA) return out.innerHTML = `<span class="esito err">Imposta il Periodo A.</span>`;

  const b = risolviPeriodoB("a1", daA, aA);
  if (b.err) return out.innerHTML = `<span class="esito err">${b.err}</span>`;
  const { daB, aB, etichetta: etichettaB } = b;

  const gA = intervalloDate(daA, aA), gB = intervalloDate(daB, aB);
  const n = Math.max(gA.length, gB.length);
  let totA=0, totB=0, righe="";
  for (let i=0;i<n;i++){
    const dA=gA[i], dB=gB[i];
    const pA = dA?getPresenza(dA):null, pB = dB?getPresenza(dB):null;
    if (pA!=null) totA+=pA; if (pB!=null) totB+=pB;
    const diff = (pA!=null && pB!=null) ? pA-pB : null;
    righe += `<tr>
      <td>${dA?dataEstesa(dA):"—"}</td><td>${fmt(pA)}</td>
      <td>${dB?dataEstesa(dB):"—"}</td><td>${fmt(pB)}</td>
      <td class="${diff>0?'diff-pos':diff<0?'diff-neg':''}">${diff!=null?(diff>0?'+':'')+diff.toLocaleString('it-IT'):'—'}</td>
    </tr>`;
  }
  const diffTot = totA-totB;
  out.innerHTML = `
    <table class="tab-diff">
      <thead><tr>
        <th>Data A</th><th>Presenze A</th>
        <th>Data B (${esc(etichettaB)})</th><th>Presenze B</th>
        <th>Differenza</th>
      </tr></thead>
      <tbody>${righe}</tbody>
      <tfoot><tr>
        <th>Totale</th><th>${totA.toLocaleString('it-IT')}</th>
        <th></th><th>${totB.toLocaleString('it-IT')}</th>
        <th class="${diffTot>0?'diff-pos':diffTot<0?'diff-neg':''}">${(diffTot>0?'+':'')+diffTot.toLocaleString('it-IT')}</th>
      </tr></tfoot>
    </table>
    <p class="aiuto">Le celle "—" indicano date senza dato presenze caricato (vedi sezione Amministratore).</p>`;
}
function fmt(v){ return v==null ? '<span class="ev-meta">—</span>' : v.toLocaleString('it-IT'); }

function analisi2(){
  const daA=document.getElementById("a2-da").value, aA=document.getElementById("a2-a").value;
  if (!daA||!aA){ alert("Imposta il Periodo A."); return; }
  const b = risolviPeriodoB("a2", daA, aA);
  if (b.err){ alert(b.err); return; }
  const { daB, aB, etichetta: etichettaB } = b;

  const gA=intervalloDate(daA,aA), gB=intervalloDate(daB,aB);
  const n=Math.max(gA.length,gB.length);
  const labels=[], datiA=[], datiB=[], dateA=[], dateB=[];
  for(let i=0;i<n;i++){
    labels.push("g"+(i+1));
    dateA.push(gA[i]?dataCompatta(gA[i]):"—");
    dateB.push(gB[i]?dataCompatta(gB[i]):"—");
    datiA.push(gA[i]?getPresenza(gA[i]):null);
    datiB.push(gB[i]?getPresenza(gB[i]):null);
  }

  if(_graficoA2) _graficoA2.destroy();
  _graficoA2 = new Chart(document.getElementById("a2-grafico"), {
    type:"bar",
    data:{ labels, datasets:[
      { label:`Periodo A (${dataCompatta(daA)}–${dataCompatta(aA)})`, data:datiA, backgroundColor:"#0b6fb8", _date:dateA },
      { label:`${etichettaB} (${dataCompatta(daB)}–${dataCompatta(aB)})`, data:datiB, backgroundColor:"#e0413a", _date:dateB }
    ]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{
        tooltip:{ callbacks:{ title:(items)=>{
          const ds=items[0].dataset; return ds._date[items[0].dataIndex]+" — "+ds.label;
        }}},
        legend:{ position:"top" }
      },
      scales:{ y:{ beginAtZero:true, title:{display:true,text:"Presenze"} },
               x:{ title:{display:true,text:"Giorni del periodo (allineati per posizione)"} } }
    }
  });
}

// ---- Pattern settimanale: una linea per anno + mediana (pattern tipico) ------
// Allinea i giorni per giorno-settimana (lunedì con lunedì) su una griglia a
// calendario: slot X = settimana-del-mese * 7 + giorno-settimana (0=Lun..6=Dom).
function patternSettimanale(){
  const nota = document.getElementById("pat-nota");
  const m = Number(document.getElementById("pat-mese").value);   // 0..11
  const anni = Object.keys(PRESENZE).map(Number).sort();

  // posizione di una data ISO nella griglia settimanale del suo mese
  const slotDi = (iso, off) => {
    const dd = Number(iso.slice(8,10));
    const wd = (isoADate(iso).getDay()+6)%7;                      // Lun=0..Dom=6
    return Math.floor((dd-1+off)/7)*7 + wd;
  };

  // raccogli i valori di ogni anno per slot; tieni traccia della data reale
  const perAnno = {};       // anno -> { slot: {iso, v} }
  let maxSlot = 6;
  anni.forEach(a => {
    const giorni = PRESENZE[a] || {};
    const off = (isoADate(`${a}-${pad(m+1)}-01`).getDay()+6)%7;   // gg-sett. del 1° del mese
    const ndays = new Date(a, m+1, 0).getDate();
    const slots = {};
    for (let dd=1; dd<=ndays; dd++){
      const iso = `${a}-${pad(m+1)}-${pad(dd)}`;
      const x = slotDi(iso, off);
      if (x > maxSlot) maxSlot = x;
      const v = giorni[iso];
      if (v != null) slots[x] = { iso, v };
    }
    if (Object.keys(slots).length) perAnno[a] = slots;
  });

  const annoCorr = new Date().getFullYear();
  const anniConDati = Object.keys(perAnno).map(Number).sort();
  if (!anniConDati.length){
    if (_graficoPattern){ _graficoPattern.destroy(); _graficoPattern = null; }
    nota.innerHTML = `<span class="esito err">Nessun dato presenze per ${MESI_FULL[m]}.</span>`;
    return;
  }

  const nSlot = maxSlot + 1;
  const labels = Array.from({length:nSlot}, (_,x) => `S${Math.floor(x/7)+1}·${GIORNI_LUN[x%7]}`);

  // una linea (sottile) per anno; l'anno corrente evidenziato
  const datasets = anniConDati.map((a,i) => {
    const dati = new Array(nSlot).fill(null);
    const date = new Array(nSlot).fill(null);
    for (const [x,o] of Object.entries(perAnno[a])){ dati[x]=o.v; date[x]=o.iso; }
    const corr = a === annoCorr;
    return {
      label: String(a),
      data: dati, _date: date,
      borderColor: corr ? "#0b6fb8" : `hsl(${Math.round(i/anniConDati.length*300)},55%,68%)`,
      backgroundColor: "transparent",
      borderWidth: corr ? 2.5 : 1,
      pointRadius: 0, pointHoverRadius: 4, tension: 0.3, spanGaps: false
    };
  });

  // mediana per slot (solo se ≥3 anni hanno il dato): la linea "pattern"
  const medi = new Array(nSlot).fill(null);
  for (let x=0; x<nSlot; x++){
    const vals = anniConDati.map(a => perAnno[a][x]?.v).filter(v => v != null);
    if (vals.length >= 3) medi[x] = mediana(vals);
  }
  datasets.push({
    label: "MEDIANA (pattern)",
    data: medi, _date: null,
    borderColor: "#111", backgroundColor: "transparent",
    borderWidth: 4, pointRadius: 0, pointHoverRadius: 5, tension: 0.3, spanGaps: false, order: -1
  });

  if (_graficoPattern) _graficoPattern.destroy();
  _graficoPattern = new Chart(document.getElementById("pat-grafico"), {
    type: "line",
    plugins: [fasceWeekend],
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      plugins: {
        legend: { position: "top", labels: { boxWidth: 12, font: { size: 10 } } },
        tooltip: { callbacks: { label: (it) => {
          const ds = it.dataset, v = it.parsed.y;
          if (v == null) return null;
          if (!ds._date) return `${ds.label}: ${v.toLocaleString('it-IT')}`;
          const iso = ds._date[it.dataIndex];
          return `${ds.label} (${iso?dataCompatta(iso):"—"}): ${v.toLocaleString('it-IT')}`;
        }}}
      },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: "Presenze" } },
        x: { title: { display: true, text: "Settimane del mese · giorno (Lun→Dom)" } }
      }
    }
  });

  const nMed = medi.filter(v => v != null).length;
  nota.innerHTML = `Le fasce grigie evidenziano <b>sabato</b> (chiaro) e <b>domenica</b> (più scuro). `
    + `La linea spessa è la <b>mediana</b> di ${anniConDati.length} anni `
    + `(${anniConDati[0]}–${anniConDati[anniConDati.length-1]}): il pattern "tipico" dei giorni della settimana. `
    + `Festività mobili (Pasqua) ed eventi straordinari (congressi) spostano i singoli anni — la mediana li attenua ma non li annulla.`
    + (nMed < nSlot ? ` <span class="ev-meta">(la mediana è tracciata solo dove almeno 3 anni hanno il dato)</span>` : "");
}

function mediana(arr){
  const s = [...arr].sort((a,b) => a-b), n = s.length;
  return n % 2 ? s[(n-1)/2] : (s[n/2-1] + s[n/2]) / 2;
}

// ============================================================================
//  4) AMMINISTRATORE
// ============================================================================
function initAdmin(){
  document.getElementById("form-login").addEventListener("submit", async e => {
    e.preventDefault();
    const esito=document.getElementById("esito-login");
    try{
      await auth.signInWithEmailAndPassword(
        document.getElementById("adm-email").value,
        document.getElementById("adm-password").value
      );
    }catch(err){ mostraEsito(esito,"Accesso negato: "+err.message,false); }
  });

  document.getElementById("admin-logout").addEventListener("click", ()=>auth.signOut());

  auth.onAuthStateChanged(user => {
    const logged = !!user;
    document.getElementById("admin-login").classList.toggle("nascosto", logged);
    document.getElementById("admin-pannello").classList.toggle("nascosto", !logged);
    if (logged){
      document.getElementById("admin-chi").textContent = "Connesso come " + user.email;
      aggiornaTabellaAdmin();
    }
  });

  document.getElementById("carica-presenze").addEventListener("click", caricaFilePresenze);
  document.getElementById("carica-eventi").addEventListener("click", caricaFileEventi);
  document.getElementById("adm-filtro-eventi").addEventListener("input", aggiornaTabellaAdmin);
}

// ---- Import PRESENZE_YYYY (Excel/CSV) ----------------------------------------
async function caricaFilePresenze(){
  const esito=document.getElementById("esito-presenze");
  const file=document.getElementById("file-presenze").files[0];
  if(!file) return mostraEsito(esito,"Seleziona un file.",false);

  try{
    const righe = await leggiFoglio(file);
    // attese: colonna 0 = data, colonna 1 = presenze
    const perAnno = {};
    let validi=0;
    righe.forEach(r => {
      const iso = parseDataCella(r[0]);
      // celle presenze vuote => giorno SENZA dato: si salta (non si salva 0)
      const pulito = (r[1]===null||r[1]===undefined ? "" : String(r[1])).replace(/[^\d.-]/g,"");
      if (iso && pulito !== "" && !isNaN(Number(pulito))){
        const anno = iso.slice(0,4);
        (perAnno[anno]=perAnno[anno]||{})[iso]=Number(pulito);
        validi++;
      }
    });
    if(!validi) throw new Error("Nessuna riga valida (attese colonne: data | presenze).");

    for (const anno of Object.keys(perAnno)){
      await db.collection("presenze").doc(anno).set({
        anno: Number(anno),
        giorni: perAnno[anno],
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      PRESENZE[anno] = perAnno[anno];
    }
    renderStatoPresenze();
    mostraEsito(esito, `✓ Importate ${validi} giornate per gli anni: ${Object.keys(perAnno).join(", ")}.`, true);
  }catch(err){ console.error(err); mostraEsito(esito,"Errore: "+err.message,false); }
}

// ---- Import EVENTI_YYYY (Excel/CSV o Word) -----------------------------------
async function caricaFileEventi(){
  const esito=document.getElementById("esito-eventi");
  const file=document.getElementById("file-eventi").files[0];
  if(!file) return mostraEsito(esito,"Seleziona un file.",false);

  try{
    let nuovi=[];
    if (file.name.toLowerCase().endsWith(".docx")){
      nuovi = await parseEventiWord(file);
    } else {
      const righe = await leggiFoglio(file);
      righe.forEach(r => {
        const iso = parseDataCella(r[0]);
        const nome = maiuscolo(String(r[1]||"").trim());
        if (iso && nome) nuovi.push({ dataInizio:iso, dataFine:iso, nome });
      });
    }
    if(!nuovi.length) throw new Error("Nessun evento riconosciuto nel file.");

    const batch = db.batch();
    nuovi.forEach(ev => {
      const ref = db.collection("eventi").doc();
      batch.set(ref, {
        dataInizio:ev.dataInizio, dataFine:ev.dataFine, nome:ev.nome,
        tipologia: ev.tipologia||"", previsione: ev.previsione||"",
        struttura:"(import admin)", origine:"admin_import",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    await batch.commit();
    mostraEsito(esito, `✓ Importati ${nuovi.length} eventi.`, true);
  }catch(err){ console.error(err); mostraEsito(esito,"Errore: "+err.message,false); }
}

// legge un foglio Excel/CSV -> array di righe (array di celle), saltando l'intestazione
async function leggiFoglio(file){
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type:"array", cellDates:true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const righe = XLSX.utils.sheet_to_json(ws, { header:1, raw:true, defval:"" });
  // se la prima riga sembra un'intestazione (seconda cella non numerica), scartala
  if (righe.length && isNaN(Number(righe[0][1])) && !(righe[0][0] instanceof Date)) righe.shift();
  return righe.filter(r => r.length && (r[0]!==""));
}

async function parseEventiWord(file){
  const buf = await file.arrayBuffer();
  const res = await mammoth.extractRawText({ arrayBuffer: buf });
  const out=[];
  res.value.split(/\r?\n/).forEach(linea => {
    const date = [...linea.matchAll(/(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/g)]
      .map(m => normData(m[1],m[2],m[3])).filter(Boolean);
    const nome = maiuscolo(linea.replace(/(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/g,"")
      .replace(/[–\-:]+/g," ").replace(/\s+/g," ").trim());
    if (nome && date.length){
      out.push({ nome, dataInizio: date[0], dataFine: date[date.length-1] });
    }
  });
  return out;
}

// ---- Parsing date robusto ----------------------------------------------------
function parseDataCella(v){
  if (v instanceof Date && !isNaN(v)) return dateAIso(v);
  if (typeof v === "number"){ // seriale Excel
    const d = XLSX.SSF ? XLSX.SSF.parse_date_code(v) : null;
    if (d) return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);          // ISO
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})/); // gg/mm/aaaa
  if (m) return normData(m[1],m[2],m[3]);
  return null;
}
function normData(g,m,a){
  g=+g; m=+m; a=+a; if (a<100) a+=2000;
  if (g<1||g>31||m<1||m>12) return null;
  return `${a}-${pad(m)}-${pad(g)}`;
}
function estensione(nome){ const p=nome.split("."); return p.length>1?p.pop().toLowerCase():"xlsx"; }

// ---- Tabella gestione eventi (admin) ----------------------------------------
function aggiornaTabellaAdmin(){
  const tbody = document.querySelector("#tabella-admin-eventi tbody");
  if (!tbody || document.getElementById("admin-pannello").classList.contains("nascosto")) return;
  const filtro = normalizza(document.getElementById("adm-filtro-eventi").value);
  const lista = EVENTI.filter(e => !filtro || normalizza(e.nome).includes(filtro));

  tbody.innerHTML = lista.map(ev => `
    <tr>
      <td>${dataCompatta(ev.dataInizio)}–${dataCompatta(ev.dataFine)}</td>
      <td>${esc(ev.nome)}</td>
      <td>${ev.tipologia?TIPOLOGIE[ev.tipologia]:"—"}</td>
      <td>${ev.previsione?(PREVISIONI[ev.previsione].emoji):"—"}</td>
      <td>${esc(ev.struttura||"")}</td>
      <td>
        <button class="modifica" data-id="${ev.id}">✏️</button>
        <button class="elimina" data-id="${ev.id}">🗑️</button>
      </td>
    </tr>`).join("") || `<tr><td colspan="6" class="aiuto">Nessun evento.</td></tr>`;

  tbody.querySelectorAll(".elimina").forEach(b => b.onclick = () => eliminaEvento(b.dataset.id));
  tbody.querySelectorAll(".modifica").forEach(b => b.onclick = () => modificaEvento(b.dataset.id));
}

async function eliminaEvento(id){
  const ev = EVENTI.find(e=>e.id===id);
  if (!confirm(`Eliminare l'evento "${ev?.nome}"?`)) return;
  try{ await db.collection("eventi").doc(id).delete(); }
  catch(e){ alert("Errore: "+e.message); }
}

function modificaEvento(id){
  const ev = EVENTI.find(e=>e.id===id);
  if(!ev) return;
  EDIT_ID = id;
  document.getElementById("ev-inizio").value = ev.dataInizio;
  document.getElementById("ev-fine").value   = ev.dataFine;
  document.getElementById("ev-fine").min     = ev.dataInizio;
  document.getElementById("ev-nome").value   = ev.nome;
  document.getElementById("ev-tipologia").value = ev.tipologia||"";
  document.getElementById("ev-previsione").value = ev.previsione||"";
  document.getElementById("ev-struttura").value = ev.struttura||"";
  document.querySelector("#form-evento button[type=submit]").textContent = "✏️ Aggiorna evento";
  document.querySelector("#tab-inserisci h2").textContent = "Modifica evento";
  aggiornaPrevisioneStorica();
  mostraTab("inserisci");
  window.scrollTo(0,0);
}
