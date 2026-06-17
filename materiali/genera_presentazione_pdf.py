#!/usr/bin/env python3
# Genera il PDF di presentazione del progetto Eventi Ferrara (tema navy/oro + screenshot).
# Stessi contenuti del .docx, reso con reportlab. Rilancia: python3 genera_presentazione_pdf.py
import os
from PIL import Image as PILImage
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Image,
                                ListFlowable, ListItem)

HERE  = os.path.dirname(__file__)
SHOTS = os.path.join(HERE, "screenshots")

NAVY   = HexColor("#122c4a")
ORO    = HexColor("#a8823a")
GRIGIO = HexColor("#6e7c8a")
TESTO  = HexColor("#1f2a37")

PAGE_W, PAGE_H = A4
MARGIN = 2 * cm
CONTENT_W = PAGE_W - 2 * MARGIN

st_title = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=27, textColor=ORO,
                          alignment=TA_CENTER, spaceAfter=8, leading=31)
st_sub   = ParagraphStyle("sub", fontName="Helvetica", fontSize=12.5, textColor=GRIGIO,
                          alignment=TA_CENTER, spaceAfter=3, leading=16)
st_link  = ParagraphStyle("link", fontName="Helvetica-Bold", fontSize=12.5, textColor=ORO,
                          alignment=TA_CENTER, spaceBefore=8, spaceAfter=2)
st_h1    = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=15, textColor=NAVY,
                          spaceBefore=16, spaceAfter=5, leading=18)
st_h3    = ParagraphStyle("h3", fontName="Helvetica-Bold", fontSize=12, textColor=NAVY,
                          spaceBefore=10, spaceAfter=3, leading=15)
st_body  = ParagraphStyle("body", fontName="Helvetica", fontSize=10.5, textColor=TESTO,
                          spaceAfter=5, leading=15)
st_bul   = ParagraphStyle("bul", parent=st_body, spaceAfter=3, leading=14)
st_cap   = ParagraphStyle("cap", fontName="Helvetica-Oblique", fontSize=9, textColor=GRIGIO,
                          alignment=TA_CENTER, spaceBefore=4, spaceAfter=10)
st_kv    = ParagraphStyle("kv", parent=st_body, spaceAfter=2)

story = []

def p(t, style=st_body):  story.append(Paragraph(t, style))
def h1(t):                story.append(Paragraph(t, st_h1))
def h3(t):                story.append(Paragraph(t, st_h3))

def bullets(items):
    li = [ListItem(Paragraph(t, st_bul), leftIndent=10, value=None) for t in items]
    story.append(ListFlowable(li, bulletType="bullet", bulletColor=ORO,
                              bulletFontSize=8, leftIndent=14, spaceAfter=6))

def immagine(nome, larghezza_cm=15.5, didascalia=None):
    path = os.path.join(SHOTS, nome)
    if not os.path.exists(path): return
    iw, ih = PILImage.open(path).size
    w = min(larghezza_cm * cm, CONTENT_W)
    h = w * ih / iw
    img = Image(path, width=w, height=h)
    img.hAlign = "CENTER"
    story.append(Spacer(1, 4))
    story.append(img)
    if didascalia:
        story.append(Paragraph(didascalia, st_cap))
    else:
        story.append(Spacer(1, 10))

# ===== Copertina =====
story.append(Spacer(1, 6))
p("EVENTI FERRARA", st_title)
p("Calendario condiviso degli eventi della città", st_sub)
p("Uno strumento al servizio di albergatori e operatori turistici", st_sub)
p("https://eventiferrara.github.io/", st_link)
p("Canale Telegram: @calendarioeventiferrara", st_sub)
immagine("home.png", 16.0, "La home della web app")

# ===== 1 =====
h1("1. Che cos'è")
p("Eventi Ferrara è una web app pubblica e gratuita che raccoglie in un unico calendario tutti "
  "gli eventi che si svolgono in città — concerti, mostre, fiere, congressi, manifestazioni "
  "sportive — insieme a una previsione delle presenze turistiche attese.")
p("Lo scopo è dare a chi lavora nel turismo (alberghi, B&B, ristoranti, servizi) uno strumento "
  "semplice per sapere in anticipo quando la città sarà più affollata, così da organizzarsi al "
  "meglio su prezzi e personale.")
p("Studiando l'andamento delle presenze negli anni, l'app aiuta inoltre a riconoscere i periodi "
  "e i giorni di maggiore domanda e a predisporre un piano prezzi che la anticipi, invece di "
  "rincorrerla.")

# ===== 2 =====
h1("2. La logica del progetto")
p("Il progetto si fonda su tre idee:")
bullets([
    "<b>Calendario collaborativo:</b> nessuno conosce tutti gli eventi della città. Per questo "
    "ogni operatore può inserire gli eventi che conosce, arricchendo un calendario comune da cui "
    "tutti traggono beneficio.",
    "<b>Dato condiviso e sempre disponibile:</b> le informazioni non restano sul singolo computer "
    "ma vivono su un database online, accessibile a tutti e salvato in modo sicuro.",
    "<b>Dall'informazione alla decisione:</b> incrociando gli eventi con le presenze turistiche "
    "giornaliere ufficiali, l'app aiuta a capire l'impatto reale di un evento e a fare previsioni "
    "confrontando periodi e anni diversi.",
])

# ===== 3 =====
h1("3. Come funziona — per gli operatori")
p("La web app si apre nel browser (telefono o computer), senza installare nulla, ed è organizzata "
  "in quattro sezioni.")

h3("Calendario eventi")
bullets([
    "Una tabella scorrevole mostra, giorno per giorno, gli eventi in programma, con un pallino "
    "colorato che indica il livello di presenze atteso (giallo = basso, verde = medio, rosso = alto).",
    "Le pill in alto filtrano gli eventi per tipologia; le festività compaiono con il filtro “Tutti”.",
    "Si può anche cercare una data specifica, anche a distanza di mesi o anni.",
])
immagine("calendario.png", 15.5, "Calendario eventi con previsione delle presenze")

h3("Inserisci evento")
bullets([
    "Si indicano date di inizio e fine, nome dell'evento, tipologia (culturale/musicale, "
    "congressuale/fieristico, sportivo) e la previsione di presenze: bassa, media o alta.",
    "Un controllo automatico segnala se un evento simile è già stato inserito, per evitare doppioni.",
])
immagine("inserisci.png", 15.5, "Form di inserimento di un nuovo evento")

h3("Analisi presenze / evento")
bullets([
    "<b>Confronto giorno per giorno:</b> si sceglie un periodo e lo si confronta con lo stesso "
    "periodo dell'anno precedente, con un altro periodo a scelta oppure con un evento specifico.",
    "<b>Istogramma:</b> un grafico a barre confronta le presenze di due periodi.",
    "<b>Pattern settimanale:</b> scelto un mese, l'app mostra una linea per ogni anno (allineata "
    "per giorno della settimana) e una linea più spessa con la mediana, cioè il pattern “tipico”. "
    "Si vede così quali giorni sono storicamente i più pieni, base ideale per un piano prezzi che "
    "anticipa la domanda.",
])
immagine("analisi.png", 15.5, "Strumenti di analisi e confronto delle presenze")

h3("Amministratore")
bullets([
    "Sezione riservata, protetta da accesso personale, da cui si caricano i file ufficiali delle "
    "presenze turistiche giornaliere (un file per anno) e, volendo, gli eventi storici passati.",
    "Da qui è anche possibile correggere o eliminare qualsiasi evento.",
])

# ===== 4 =====
h1("4. Avvisi automatici su Telegram")
p("Il sistema controlla ogni 30 minuti se sono stati inseriti nuovi eventi e, in tal caso, li "
  "pubblica automaticamente sul canale Telegram del progetto. In questo modo un nuovo evento viene "
  "segnalato sul canale entro circa mezz'ora dall'inserimento. Gli operatori che si iscrivono al "
  "canale restano così aggiornati senza dover controllare di continuo la web app.")

# ===== 5 =====
h1("5. Come è fatto (in breve)")
p("La soluzione usa servizi affidabili e gratuiti:")
bullets([
    "Web app pubblicata su GitHub Pages (l'indirizzo del sito).",
    "Database online su Google Firebase: i dati sono salvati lato server a ogni modifica, non sul "
    "dispositivo dell'utente.",
    "Un processo automatico salva periodicamente una copia di sicurezza dei dati (ripristinabile in "
    "qualsiasi momento) e invia gli avvisi sul canale Telegram.",
])
p("<b>Sicurezza:</b> chiunque può consultare il calendario e aggiungere eventi, ma solo "
  "l'amministratore può caricare i dati delle presenze e modificare o eliminare gli eventi.")

# ===== 6 =====
h1("6. Come accedere")
p("<b>Sito web:</b> https://eventiferrara.github.io/", st_kv)
p("<b>Canale Telegram:</b> @calendarioeventiferrara", st_kv)
p("Per iniziare basta aprire il sito, consultare il calendario e inserire gli eventi che si "
  "conoscono. Più operatori partecipano, più il calendario diventa utile per tutti.")

doc = SimpleDocTemplate(os.path.join(HERE, "PRESENTAZIONE_Eventi_Ferrara.pdf"),
                        pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
                        topMargin=1.6*cm, bottomMargin=1.6*cm,
                        title="Eventi Ferrara — Presentazione")
doc.build(story)
print("Creato PRESENTAZIONE_Eventi_Ferrara.pdf")
