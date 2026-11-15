"""Ilustraciones del manual que no salen de una captura: el celular con Google Authenticator.

Son dibujos ILUSTRATIVOS (no capturas de la aplicación de Google): muestran qué tocar y qué
completar. Los textos de los campos son los que Daniel vio en su celular el 2026-11-12
(«Nombre de la cuenta», «Tu llave», «Tipo de llave»).
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FUENTES = Path("C:/Windows/Fonts")
MARCA = (114, 38, 87)
GRIS = (110, 110, 118)
CLARO = (238, 236, 240)
AZUL = (26, 115, 232)


def fuente(tam, negrita=False):
    return ImageFont.truetype(str(FUENTES / ("arialbd.ttf" if negrita else "arial.ttf")), tam)


def celular(titulo):
    im = Image.new("RGB", (520, 980), (255, 255, 255))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([10, 10, 510, 970], radius=60, outline=(40, 40, 44), width=12, fill=(255, 255, 255))
    d.rounded_rectangle([200, 34, 320, 50], radius=8, fill=(40, 40, 44))
    d.rectangle([22, 80, 498, 160], fill=(248, 248, 250))
    d.text((50, 102), titulo, font=fuente(30, True), fill=(30, 30, 34))
    return im, d


def pantalla_lista(destino):
    im, d = celular("Google Authenticator")
    d.text((50, 200), "Todavía no hay cuentas.", font=fuente(26), fill=GRIS)
    d.text((50, 240), "Tocá el botón + para agregar una.", font=fuente(26), fill=GRIS)
    # botón +
    d.rounded_rectangle([380, 820, 470, 910], radius=26, fill=AZUL)
    d.text((410, 828), "+", font=fuente(64, True), fill=(255, 255, 255))
    d.ellipse([360, 800, 490, 930], outline=(220, 30, 60), width=6)
    d.text((70, 850), "1. Tocá «+»", font=fuente(34, True), fill=(220, 30, 60))
    im.save(destino)


def pantalla_menu(destino):
    im, d = celular("Agregar una cuenta")
    opciones = ["Escanear un código QR", "Ingresar una clave de configuración"]
    for i, texto in enumerate(opciones):
        y = 230 + i * 120
        d.rounded_rectangle([50, y, 470, y + 90], radius=18, fill=CLARO)
        d.text((80, y + 28), texto, font=fuente(25, i == 1), fill=(30, 30, 34))
    d.rounded_rectangle([40, 340, 480, 440], radius=22, outline=(220, 30, 60), width=6)
    d.text((60, 500), "2. Elegí «Ingresar una", font=fuente(32, True), fill=(220, 30, 60))
    d.text((60, 545), "clave de configuración»", font=fuente(32, True), fill=(220, 30, 60))
    d.text((60, 620), "(no hace falta escanear nada:", font=fuente(25), fill=GRIS)
    d.text((60, 655), "EFFORT 360 te muestra la clave", font=fuente(25), fill=GRIS)
    d.text((60, 690), "en letras)", font=fuente(25), fill=GRIS)
    im.save(destino)


def pantalla_formulario(destino):
    im, d = celular("Ingresar detalles")
    campos = [
        ("Nombre de la cuenta", "tunombre@effort.com.py"),
        ("Tu llave", "J4RR GPLE FYXA EEDF ..."),
    ]
    for i, (etiqueta, valor) in enumerate(campos):
        y = 210 + i * 150
        d.text((50, y), etiqueta, font=fuente(24), fill=GRIS)
        d.line([50, y + 80, 470, y + 80], fill=AZUL, width=4)
        d.text((50, y + 38), valor, font=fuente(28), fill=(30, 30, 34))
    d.text((50, 520), "Tipo de llave", font=fuente(24), fill=GRIS)
    d.rounded_rectangle([50, 555, 470, 625], radius=12, fill=CLARO)
    d.text((70, 572), "Basada en tiempo", font=fuente(28, True), fill=(30, 30, 34))
    d.rounded_rectangle([300, 860, 470, 925], radius=30, fill=AZUL)
    d.text((335, 873), "Agregar", font=fuente(30, True), fill=(255, 255, 255))
    d.text((50, 680), "3. Completá así y", font=fuente(32, True), fill=(220, 30, 60))
    d.text((50, 725), "tocá «Agregar»", font=fuente(32, True), fill=(220, 30, 60))
    im.save(destino)


def pantalla_codigo(destino):
    im, d = celular("Google Authenticator")
    d.text((50, 200), "EFFORT Control 360", font=fuente(26), fill=GRIS)
    d.text((50, 236), "tunombre@effort.com.py", font=fuente(24), fill=GRIS)
    d.text((50, 280), "482 913", font=fuente(84, True), fill=AZUL)
    d.pieslice([400, 300, 460, 360], start=-90, end=150, fill=AZUL)
    d.text((50, 470), "4. Este número de 6 cifras", font=fuente(30, True), fill=(220, 30, 60))
    d.text((50, 512), "cambia cada 30 segundos.", font=fuente(30, True), fill=(220, 30, 60))
    d.text((50, 580), "Escribilo en EFFORT 360 en", font=fuente(26), fill=GRIS)
    d.text((50, 616), "«Código de tu aplicación».", font=fuente(26), fill=GRIS)
    d.text((50, 680), "(el número del dibujo es", font=fuente(24), fill=GRIS)
    d.text((50, 712), "de ejemplo)", font=fuente(24), fill=GRIS)
    im.save(destino)


def generar(carpeta):
    carpeta = Path(carpeta)
    pantalla_lista(carpeta / "g1-authenticator-mas.png")
    pantalla_menu(carpeta / "g2-authenticator-menu.png")
    pantalla_formulario(carpeta / "g3-authenticator-formulario.png")
    pantalla_codigo(carpeta / "g4-authenticator-codigo.png")


if __name__ == "__main__":
    generar(Path(__file__).resolve().parent.parent / "imagenes")
