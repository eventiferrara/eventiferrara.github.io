#!/usr/bin/env python3
# Genera la locandina A4 (PNG) di Eventi Ferrara — tema editoriale notturno (navy/oro),
# coerente con la grafica del sito. Rilancia con `python3 genera_locandina.py`.

from PIL import Image, ImageDraw, ImageFont

# --- formato A4 a 150 dpi ---
W, H = 1240, 1754

# palette coerente col sito
NAVY      = (13, 23, 38)
NAVY_2    = (16, 29, 48)
CARD      = (21, 36, 58)
BORDO     = (54, 70, 92)
ORO       = (216, 184, 118)
ORO_CHIARO= (236, 220, 180)
TESTO     = (234, 240, 247)
SOFT      = (159, 176, 195)
GIALLO    = (232, 195, 74)
VERDE     = (76, 198, 106)
ROSSO     = (224, 98, 90)

# Font: serif con grazie (Georgia) per i titoli display + Avenir Condensed per il testo
SERIF      = "/System/Library/Fonts/Supplemental/Georgia.ttf"
SERIF_B    = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
SERIF_BI   = "/System/Library/Fonts/Supplemental/Georgia Bold Italic.ttf"
SANS_TTC   = "/System/Library/Fonts/Avenir Next Condensed.ttc"
def serif(size, bold=False, italic=False):
    return ImageFont.truetype(SERIF_BI if (bold and italic) else SERIF_B if bold else SERIF, size)
def sans(size, bold=False):
    return ImageFont.truetype(SANS_TTC, size, index=0 if bold else 7)

img = Image.new("RGB", (W, H), NAVY)
d = ImageDraw.Draw(img)

def testo(x, y, s, font, fill, anchor="la", tracking=0):
    if tracking and anchor[0] != "m":
        for ch in s:
            d.text((x, y), ch, font=font, fill=fill, anchor=anchor)
            x += d.textlength(ch, font=font) + tracking
    else:
        d.text((x, y), s, font=font, fill=fill, anchor=anchor)

def wrap(s, font, maxw):
    parole, righe, cur = s.split(), [], ""
    for p in parole:
        prova = (cur + " " + p).strip()
        if d.textlength(prova, font=font) <= maxw: cur = prova
        else: righe.append(cur); cur = p
    if cur: righe.append(cur)
    return righe

# ===== BANNER: screenshot dell'homepage =====
BANNER_H = 690
hero = Image.open("screenshots/home.png").convert("RGB")
# resize a larghezza pagina, poi ritaglio dal basso (mantiene titolo + pill)
nw = W
nh = round(hero.height * W / hero.width)
hero = hero.resize((nw, nh))
top = max(0, nh - BANNER_H)
hero = hero.crop((0, top, W, top + BANNER_H))
img.paste(hero, (0, 0))
# sfumatura inferiore del banner verso il navy + linea oro
sfuma = Image.new("L", (1, BANNER_H), 0)
for i in range(BANNER_H):
    t = max(0, (i - (BANNER_H - 150)) / 150)
    sfuma.putpixel((0, i), int(255 * min(1, t)))
overlay = Image.new("RGB", (W, BANNER_H), NAVY)
img.paste(overlay, (0, 0), sfuma.resize((W, BANNER_H)))
d.rectangle([0, BANNER_H - 4, W, BANNER_H], fill=ORO)

# ===== A COSA SERVE =====
y = BANNER_H + 46
testo(80, y, "COSA OFFRE", sans(30, True), ORO, tracking=8); y += 50
testo(80, y, "A cosa serve", serif(58, bold=True), TESTO); y += 96

def feature(y, titolo, desc, dot=None):
    cy = y + 20
    if isinstance(dot, list):
        for k, c in enumerate(dot):
            d.ellipse([80+k*30, cy-13, 106+k*30, cy+13], fill=c)
        xt = 80 + len(dot)*30 + 24
    else:
        d.ellipse([80, cy-13, 106, cy+13], fill=ORO)
        xt = 132
    testo(xt, y, titolo, sans(40, True), TESTO)
    yy = y + 50
    for r in wrap(desc, sans(33), W - xt - 80):
        testo(xt, yy, r, sans(33), SOFT); yy += 42
    return yy + 22

y = feature(y, "Tutti gli eventi in un colpo d'occhio",
            "Concerti, mostre, fiere, congressi ed eventi sportivi: un unico calendario condiviso e sempre aggiornato.")
y = feature(y, "Previsione delle presenze turistiche",
            "Ogni evento riporta il livello di presenze atteso: basso, medio o alto.", dot=[GIALLO, VERDE, ROSSO])
y = feature(y, "Analisi e pattern delle presenze",
            "Confronta i periodi e studia il pattern settimanale negli anni: scopri i giorni di maggiore domanda e anticipa il piano prezzi.")
y = feature(y, "Avvisi automatici su Telegram",
            "Ogni 30 minuti il canale segnala i nuovi eventi inseriti.")

# ===== CTA =====
y += 8
cta_h = 196
d.rounded_rectangle([70, y, W-70, y+cta_h], radius=22, fill=CARD, outline=BORDO, width=1)
d.rounded_rectangle([70, y, 78, y+cta_h], radius=0, fill=ORO)
testo(110, y+30, "Partecipa anche tu", serif(44, bold=True), ORO_CHIARO)
yy = y + 96
for r in wrap("Inserisci gli eventi che conosci: aiuti tutti gli operatori a organizzarsi su prezzi e personale.", sans(34), W-260):
    testo(110, yy, r, sans(34), TESTO); yy += 44

# ===== FOOTER con QR =====
fy = H - 300
d.rectangle([0, fy, W, H], fill=NAVY_2)
d.rectangle([0, fy, W, fy+3], fill=ORO)
qr = Image.open("qr_sito.png").convert("RGB").resize((220, 220))
cornice = Image.new("RGB", (252, 252), (255, 255, 255))
cornice.paste(qr, (16, 16))
img.paste(cornice, (90, fy + 40))
xt = 392
testo(xt, fy + 52,  "Vai al sito e inserisci un evento", sans(32), SOFT)
testo(xt, fy + 96,  "eventiferrara.github.io", serif(46, bold=True), TESTO)
testo(xt, fy + 172, "Canale Telegram", sans(32), SOFT)
testo(xt, fy + 214, "@calendarioeventiferrara", serif(40, bold=True), ORO_CHIARO)

img.save("Locandina_Eventi_Ferrara.png", "PNG")
print("Creata Locandina_Eventi_Ferrara.png", img.size)
