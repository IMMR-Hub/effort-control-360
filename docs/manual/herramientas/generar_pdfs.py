"""Genera los dos PDF del manual de EFFORT Control 360.

- `Guía de primer ingreso - EFFORT Control 360.pdf`: para mandarle a cada persona antes de que entre.
- `Manual de uso - EFFORT Control 360.pdf`: qué hace cada pantalla, qué significa cada alerta, glosario.

Las capturas salen del ENTORNO DE PRUEBA con datos ficticios (clientes «DEMO»), nunca de producción
(`capturas.spec.ts` y `pantallas.spec.ts`). Los textos de la interfaz que se citan entre «» salen del
código de `apps/web/src/pantallas/` (relevado el 2026-11-15). Uso: `python -I generar_pdfs.py`.
"""

from pathlib import Path

from PIL import Image as Imagen
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

AQUI = Path(__file__).resolve().parent
IMG = AQUI.parent / "imagenes"
TMP = AQUI.parent / "imagenes" / "_recortes"
SALIDA = AQUI.parent

pdfmetrics.registerFont(TTFont("Arial", "C:/Windows/Fonts/arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Negrita", "C:/Windows/Fonts/arialbd.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Cursiva", "C:/Windows/Fonts/ariali.ttf"))
pdfmetrics.registerFontFamily("Arial", normal="Arial", bold="Arial-Negrita", italic="Arial-Cursiva")

MARCA = colors.HexColor("#722657")
TINTA = colors.HexColor("#222226")
SUAVE = colors.HexColor("#5b5b63")
FONDO = colors.HexColor("#f3eef2")
AVISO = colors.HexColor("#fff4e5")

E = {
    "titulo": ParagraphStyle("titulo", fontName="Arial-Negrita", fontSize=24, leading=29, textColor=MARCA, spaceAfter=6),
    "subtitulo": ParagraphStyle("subtitulo", fontName="Arial", fontSize=12.5, leading=17, textColor=SUAVE, spaceAfter=14),
    "h1": ParagraphStyle("h1", fontName="Arial-Negrita", fontSize=17, leading=22, textColor=MARCA, spaceBefore=6, spaceAfter=8),
    "h2": ParagraphStyle("h2", fontName="Arial-Negrita", fontSize=13, leading=17, textColor=TINTA, spaceBefore=10, spaceAfter=5),
    "texto": ParagraphStyle("texto", fontName="Arial", fontSize=10.5, leading=15, textColor=TINTA, spaceAfter=6),
    "punto": ParagraphStyle("punto", fontName="Arial", fontSize=10.5, leading=15, textColor=TINTA, leftIndent=14, bulletIndent=2, spaceAfter=3),
    "chico": ParagraphStyle("chico", fontName="Arial", fontSize=9, leading=12.5, textColor=SUAVE, spaceAfter=4),
    "celda": ParagraphStyle("celda", fontName="Arial", fontSize=9.3, leading=12.5, textColor=TINTA),
    "celdaN": ParagraphStyle("celdaN", fontName="Arial-Negrita", fontSize=9.3, leading=12.5, textColor=TINTA),
    "celdaC": ParagraphStyle("celdaC", fontName="Arial", fontSize=8.8, leading=11.4, textColor=TINTA),
    "celdaCN": ParagraphStyle("celdaCN", fontName="Arial-Negrita", fontSize=8.8, leading=11.4, textColor=TINTA),
    "pie": ParagraphStyle("pie", fontName="Arial", fontSize=8.5, leading=11, textColor=SUAVE, alignment=TA_CENTER),
    "paso": ParagraphStyle("paso", fontName="Arial-Negrita", fontSize=15, leading=19, textColor=colors.white),
}

ANCHO = A4[0] - 3.6 * cm


def P(texto, estilo="texto"):
    return Paragraph(texto, E[estilo])


def puntos(lista):
    return [Paragraph(t, E["punto"], bulletText="•") for t in lista]


def recuadro(contenido, fondo=FONDO, borde=MARCA):
    celdas = [[c] for c in contenido]
    t = Table(celdas, colWidths=[ANCHO])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), fondo),
        ("LINEBEFORE", (0, 0), (0, -1), 3, borde),
        ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def banda_de_paso(numero, texto):
    t = Table([[P(f"Paso {numero}", "paso"), P(texto, "paso")]], colWidths=[2.6 * cm, ANCHO - 2.6 * cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), MARCA), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7), ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


def recorte(nombre, caja=None, alto_max=None):
    """Recorta una captura (caja = izq, arriba, der, abajo en píxeles) y la deja en _recortes/."""
    TMP.mkdir(exist_ok=True)
    im = Imagen.open(IMG / nombre)
    if caja:
        im = im.crop(caja)
    if alto_max and im.height > alto_max:
        im = im.crop((0, 0, im.width, alto_max))
    destino = TMP / nombre
    im.save(destino)
    return destino, im.width, im.height


def imagen(nombre, ancho_cm, caja=None, alto_max=None, borde=True):
    ruta, w, h = recorte(nombre, caja, alto_max)
    ancho = ancho_cm * cm
    img = Image(str(ruta), width=ancho, height=ancho * h / w)
    if not borde:
        return img
    t = Table([[img]], colWidths=[ancho + 4])
    t.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#c9c4cc")),
                           ("LEFTPADDING", (0, 0), (-1, -1), 1), ("RIGHTPADDING", (0, 0), (-1, -1), 1),
                           ("TOPPADDING", (0, 0), (-1, -1), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 1)]))
    return t


def tabla(filas, anchos, encabezado=True, chica=False):
    normal, negrita = ("celdaC", "celdaCN") if chica else ("celda", "celdaN")
    datos = [[P(c, negrita if (encabezado and i == 0) else normal) for c in fila] for i, fila in enumerate(filas)]
    t = Table(datos, colWidths=[a * cm for a in anchos], repeatRows=1 if encabezado else 0)
    estilo = [
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d6d1d8")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    if encabezado:
        estilo.append(("BACKGROUND", (0, 0), (-1, 0), FONDO))
    t.setStyle(TableStyle(estilo))
    return t


def pie_de_pagina(titulo):
    def dibujar(lienzo, doc):
        lienzo.saveState()
        lienzo.setFont("Arial", 8.5)
        lienzo.setFillColor(SUAVE)
        lienzo.drawString(1.8 * cm, 1.1 * cm, titulo)
        lienzo.drawRightString(A4[0] - 1.8 * cm, 1.1 * cm, f"Página {doc.page}")
        lienzo.setStrokeColor(MARCA)
        lienzo.setLineWidth(2)
        lienzo.line(1.8 * cm, A4[1] - 1.2 * cm, A4[0] - 1.8 * cm, A4[1] - 1.2 * cm)
        lienzo.restoreState()
    return dibujar


def documento(nombre, titulo):
    return SimpleDocTemplate(
        str(SALIDA / nombre), pagesize=A4, leftMargin=1.8 * cm, rightMargin=1.8 * cm,
        topMargin=1.7 * cm, bottomMargin=1.7 * cm, title=titulo, author="EFFORT Control 360",
    )


LOGIN = (380, 70, 900, 660)  # recuadro central de las pantallas de ingreso (1280×720)

# ---------------------------------------------------------------------------------------------
# GUÍA DE PRIMER INGRESO
# ---------------------------------------------------------------------------------------------


def guia():
    h = []
    h.append(P("EFFORT Control 360", "titulo"))
    h.append(P("Tu primer ingreso, paso a paso. Hacelo antes de la reunión: tarda unos 10 minutos.", "subtitulo"))

    h.append(P("Qué necesitás", "h2"))
    h += puntos([
        "Una <b>computadora</b> con internet (Chrome o Edge).",
        "Tu <b>celular</b>.",
        "Tu <b>correo de EFFORT</b> (por ejemplo, aalvarenga@effort.com.py).",
        "La <b>contraseña provisoria</b> que te pasó Daniel por WhatsApp.",
    ])
    h.append(Spacer(1, 4))
    h.append(recuadro([
        P("<b>Hacelo el mismo día en que recibís la contraseña provisoria.</b> Mientras no la cambies, esa contraseña "
          "sirve para entrar a tu cuenta. En cuanto elegís la tuya (paso 4), la provisoria deja de funcionar."),
    ], fondo=AVISO, borde=colors.HexColor("#e08a00")))
    h.append(Spacer(1, 10))

    h.append(banda_de_paso(1, "Instalá Google Authenticator en tu celular"))
    h.append(Spacer(1, 6))
    h += puntos([
        "<b>Android:</b> abrí <b>Play Store</b>. <b>iPhone:</b> abrí <b>App Store</b>.",
        "Buscá <b>Google Authenticator</b> (de Google LLC) e instalala. Es gratis.",
        "Esta aplicación genera un número de 6 cifras que cambia cada 30 segundos. EFFORT Control 360 te lo va a "
        "pedir cada vez que entres: así, aunque alguien sepa tu contraseña, no puede entrar sin tu celular.",
    ])
    h.append(Spacer(1, 8))

    h.append(banda_de_paso(2, "Entrá al sistema con la contraseña provisoria"))
    h.append(Spacer(1, 6))
    h += puntos([
        "En la computadora, abrí <b>effort360.disaak.com</b>.",
        "Escribí tu <b>correo</b> y la <b>contraseña provisoria</b>, y tocá <b>«Ingresar»</b>.",
    ])
    h.append(imagen("02-ingresar-completo.png", 8.5, LOGIN))
    h.append(PageBreak())

    h.append(banda_de_paso(3, "Conectá tu celular (verificación en dos pasos)"))
    h.append(Spacer(1, 6))
    h.append(P("Aparece la pantalla «Configurá tu verificación en dos pasos», con un recuadro <b>«Tu clave»</b> "
               "(letras y números en mayúscula). <b>Dejala abierta</b> y agarrá el celular:"))
    h.append(imagen("03-configurar-dos-pasos.png", 6.6, LOGIN))
    h.append(Spacer(1, 6))
    fila = [imagen(n, 3.2, borde=False) for n in
            ["g1-authenticator-mas.png", "g2-authenticator-menu.png", "g3-authenticator-formulario.png", "g4-authenticator-codigo.png"]]
    t = Table([fila], colWidths=[ANCHO / 4] * 4)
    t.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    h.append(t)
    h.append(P("Dibujos ilustrativos: en tu celular los textos pueden variar un poco.", "chico"))
    h += puntos([
        "En Google Authenticator tocá <b>«+»</b> y elegí <b>«Ingresar una clave de configuración»</b> "
        "(en algunos celulares dice «Introducir clave de configuración»). No hace falta escanear nada.",
        "<b>Nombre de la cuenta:</b> tu correo de EFFORT.",
        "<b>Tu llave:</b> copiá exactamente las letras y números del recuadro «Tu clave» de la computadora.",
        "<b>Tipo de llave:</b> <b>Basada en tiempo</b>. Tocá <b>«Agregar»</b>.",
        "Aparece un número de 6 cifras. Escribilo en la computadora, en <b>«Código de tu aplicación»</b>, y tocá "
        "<b>«Confirmar y entrar»</b>.",
    ])
    h.append(recuadro([
        P("<b>Anotá la clave en un papel y guardalo bien.</b> El sistema no la vuelve a mostrar, y te sirve si "
          "cambiás de celular."),
        P("<b>Si el código no funciona:</b> esperá a que cambie y escribí el nuevo. Revisá que la hora del celular "
          "esté en automático: si el reloj del celular está corrido, los códigos no coinciden."),
    ]))
    h.append(PageBreak())

    h.append(banda_de_paso(4, "Elegí tu propia contraseña"))
    h.append(Spacer(1, 6))
    h += puntos([
        "<b>Contraseña actual:</b> la provisoria.",
        "<b>Contraseña nueva</b> y <b>Repetí la contraseña nueva:</b> la tuya, de <b>al menos 12 caracteres</b>. "
        "Lo más fácil es una frase que solo vos sepas, por ejemplo «mi perro se llama toby 2026».",
        "Tocá <b>«Cambiar contraseña»</b>. Aparece «Contraseña actualizada»: tocá <b>«Ir a ingresar»</b>.",
    ])
    t = Table([[imagen("06-cambia-tu-contrasena-completo.png", 7.6, LOGIN), imagen("07-contrasena-actualizada.png", 7.6, LOGIN)]],
              colWidths=[ANCHO / 2, ANCHO / 2])
    h.append(t)
    h.append(Spacer(1, 8))

    h.append(banda_de_paso(5, "Entrá con tu contraseña nueva"))
    h.append(Spacer(1, 6))
    h += puntos([
        "Escribí tu correo y tu <b>contraseña nueva</b> y tocá «Ingresar».",
        "Te pide el <b>«Código de verificación»</b>: abrí Google Authenticator, escribí el número que aparece y tocá "
        "<b>«Verificar»</b>.",
        "Se abre el <b>Panel general</b>. <b>¡Listo!</b> Ya está todo hecho para la reunión.",
    ])
    h.append(imagen("08-codigo-de-verificacion.png", 7.6, LOGIN))
    h.append(PageBreak())

    h.append(P("De ahora en más, cada vez que entres", "h1"))
    h.append(P("Correo + tu contraseña + el número de 6 cifras que muestra Google Authenticator en ese momento."))
    h.append(Spacer(1, 6))
    h.append(P("Si algo no funciona", "h2"))
    h.append(tabla([
        ["Lo que pasa", "Qué hacer"],
        ["«Código incorrecto»", "Usá el número que aparece en ese momento (cambia cada 30 segundos). Revisá que la hora del "
                                 "celular esté en automático."],
        ["No me acepta el correo o la contraseña", "Revisá que el correo esté bien escrito y las mayúsculas de la contraseña. "
                                                    "Después de varios intentos fallidos, el sistema hace esperar un rato."],
        ["Me olvidé la contraseña, cambié de celular o borré la aplicación", "Avisale a Daniel. No se puede resolver desde tu lado."],
        ["Dice «Tenés que cambiar tu contraseña antes de continuar»", "Todavía no hiciste el paso 4: completalo."],
    ], [6, 11.4]))
    h.append(Spacer(1, 10))
    h.append(recuadro([
        P("<b>Nunca compartas tu contraseña ni el código del celular.</b> Nadie de EFFORT te los va a pedir: ni por "
          "teléfono, ni por WhatsApp, ni por correo."),
    ]))

    doc = documento("Guía de primer ingreso - EFFORT Control 360.pdf", "EFFORT Control 360 — Guía de primer ingreso")
    doc.build(h, onFirstPage=pie_de_pagina("EFFORT Control 360 — Guía de primer ingreso"),
              onLaterPages=pie_de_pagina("EFFORT Control 360 — Guía de primer ingreso"))


# ---------------------------------------------------------------------------------------------
# MANUAL DE USO
# ---------------------------------------------------------------------------------------------

PANTALLA = dict(ancho=17.2, alto_max=1100)


def seccion_pantalla(h, titulo, captura, para_que, que_ves, que_podes, consejo=None, alto_max=1100):
    h.append(P(titulo, "h1"))
    h.append(P(f"<b>Para qué sirve.</b> {para_que}"))
    h.append(imagen(captura, 17.2, alto_max=alto_max))
    h.append(Spacer(1, 6))
    if que_ves:
        h.append(P("Qué ves", "h2"))
        h += puntos(que_ves)
    if que_podes:
        h.append(P("Qué podés hacer", "h2"))
        h += puntos(que_podes)
    if consejo:
        h.append(Spacer(1, 4))
        h.append(recuadro([P(consejo)]))
    h.append(PageBreak())


def manual():
    h = []
    h.append(P("EFFORT Control 360", "titulo"))
    h.append(P("Manual de uso: qué hace cada pantalla, cómo buscar, qué significa cada alerta, y un glosario.", "subtitulo"))
    h.append(recuadro([P("Las imágenes de este manual son del <b>entorno de prueba</b>: los clientes, las fechas y los "
                         "números son <b>de ejemplo</b> («DEMO COMERCIAL S.A.», «EJEMPLO AGRO E.A.S.», etc.). En el sistema "
                         "real vas a ver tus clientes.")]))
    h.append(Spacer(1, 10))
    h.append(P("Contenido", "h2"))
    h += puntos([
        "1. Qué es EFFORT Control 360 y de dónde salen los datos",
        "2. Quién ve qué y quién puede cambiar qué",
        "3. Lo que se repite en todas las pantallas: menú, filtros, Excel y colores",
        "4. Cada pantalla, una por una",
        "5. Vencimientos y alertas: el diccionario",
        "6. Clientes sin movimiento: pausar y reactivar",
        "7. Glosario de la A a la Z",
        "8. Preguntas frecuentes",
    ])
    h.append(PageBreak())

    # 1
    h.append(P("1. Qué es EFFORT Control 360", "h1"))
    h.append(P("Es la capa de control de EFFORT sobre lo que ya se usa todos los días: el <b>OneDrive</b> de EFFORT, "
               "las <b>planillas</b> y <b>SIGA</b>. No reemplaza a ninguno: los mira, los ordena y avisa lo que falta "
               "o lo que está por vencer."))
    h.append(P("De dónde salen los datos", "h2"))
    h += puntos([
        "<b>Documentos:</b> del OneDrive de EFFORT, carpeta <b>CLIENTES</b>. El sistema copia lo nuevo a su propia "
        "carpeta y <b>nunca borra ni cambia nada</b> en las carpetas de EFFORT.",
        "<b>Cada 15 minutos</b> trae lo que cambió en OneDrive. <b>A la medianoche</b> (de lunes a sábado) hace "
        "además una revisión completa, por si algo se escapó.",
        "<b>Vencimientos:</b> los calcula solo, una vez por hora, con el calendario de la DNIT y la terminación del "
        "RUC de cada cliente, para el mes anterior y el actual.",
        "<b>Presentaciones:</b> cuando encuentra en OneDrive la declaración de la DNIT de un vencimiento (formularios "
        "120 IVA, 500 IRE, 158 estados financieros, 241 RG 90), lo marca como presentado solo.",
        "<b>Alertas:</b> las levanta el sistema, nunca una persona a mano, y las cierra solo cuando el problema "
        "desaparece.",
        "Los archivos de <b>más de 25 MB</b> no se copian (quedan en OneDrive, donde siempre estuvieron).",
    ])
    h.append(recuadro([P("<b>Por ahora el sistema no le manda nada a los clientes.</b> Los avisos y recordatorios "
                         "automáticos están apagados hasta que dirección decida encenderlos.")]))

    # 2
    h.append(P("2. Quién ve qué", "h1"))
    h.append(tabla([
        ["Rol", "Qué ve", "Qué puede cambiar"],
        ["<b>Dirección</b> (Laura, Lili, Daniel)", "Todos los clientes.", "Todo: clientes, vencimientos, alertas, "
         "usuarios, reglas. Es el único rol que hace cambios."],
        ["<b>Responsable</b> (Analía, Ara, Ari, Sandra, Bea, Pedro)", "Solo los clientes de su cartera.",
         "Solo dos cosas: cargar <b>sus propias horas</b> y apretar <b>«Actualizar ahora»</b> (en Faltantes), que "
         "trae lo nuevo de OneDrive y recalcula. Todo lo demás es de lectura."],
    ], [4.4, 4.4, 8.6]))
    h.append(Spacer(1, 6))
    h.append(P("La <b>cartera</b> es la lista de clientes que lleva cada persona, según la planilla de clientes de EFFORT. "
               "Si un cliente tuyo no aparece, avisale a dirección para que lo asigne."))
    h.append(PageBreak())

    # 3
    h.append(P("3. Lo que se repite en todas las pantallas", "h1"))
    h.append(P("El menú", "h2"))
    h.append(P("Está a la izquierda: Panel general, Seguimiento, Clientes, Documentos / IVA, Vencimientos, Faltantes, "
               "Balances, SIGA / Conciliación, Liquidaciones, IVA, Alertas, Horas, Equipo, Reglas y (solo dirección) "
               "Eventos. Abajo de todo, <b>«Cerrar sesión»</b>."))
    h.append(P("Los filtros: cómo buscar", "h2"))
    h += puntos([
        "<b>«Mostrar»</b> (fechas): «Todas las fechas», «Por mes», «Fecha exacta», «Desde – hasta», «Últimos 15 / "
        "30 / 60 / 90 días». Según lo que elijas aparece el campo «Mes», «Fecha» o «Desde» y «Hasta».",
        "<b>«Cliente»</b>: «Todos los clientes» o uno solo. Solo muestra clientes activos de tu cartera.",
        "En <b>Clientes</b> hay además un buscador: <b>«Buscar por nombre, código o RUC»</b> (no importan mayúsculas "
        "ni tildes).",
        "En <b>Vencimientos</b>, <b>«Nivel de alerta»</b>: Todos, Vencidos, Próximos (15 días o menos), Solo "
        "críticos, Solo altos, Medios, Informativos, Sin alerta.",
    ])
    h.append(P("«Descargar Excel»", "h2"))
    h.append(P("Está en casi todas las pantallas y baja <b>exactamente lo que estás viendo</b>, con los filtros puestos. "
               "Si la pantalla todavía está cargando, avisa que esperes un momento."))
    h.append(P("Los colores", "h2"))
    h.append(tabla([
        ["Color", "Qué quiere decir", "Ejemplos"],
        ["<font color='#1e7a3c'><b>Verde</b></font>", "Está bien, completo o a tiempo.", "Completo, A tiempo, Activo, Aprobado"],
        ["<font color='#b26a00'><b>Ámbar</b></font>", "Atención: algo está a medias o se acerca.", "Alta, Parcial, RUC pendiente, Incompleto"],
        ["<font color='#c0262d'><b>Rojo</b></font>", "Urgente o con problema.", "Vencido, Crítica, Sin entregar, Rechazado"],
        ["<font color='#1a5fb4'><b>Azul</b></font>", "En proceso o solo informativo.", "Informativa, En preparación, Recibido"],
        ["<font color='#6b6b73'><b>Gris</b></font>", "Pendiente, sin datos o no aplica.", "Media, Pendiente, Inactivo, No aplica"],
    ], [2.6, 6.4, 8.4]))
    h.append(PageBreak())

    # 4 — pantallas
    h.append(P("4. Cada pantalla, una por una", "h1"))
    h.append(P("En el orden del menú. Los textos entre «» son los que vas a ver en la pantalla."))
    h.append(Spacer(1, 4))

    seccion_pantalla(h, "Panel general", "p01-panel-general.png",
        "Es lo primero que ves al entrar: el resumen de toda tu cartera. Desde acá no se cambia nada; cada tarjeta "
        "te lleva a la pantalla con el detalle.",
        [
            "<b>«Clientes activos»</b>, <b>«Vencimientos vencidos»</b>, <b>«Vencimientos próximos»</b> (vencen en 15 "
            "días o menos) y <b>«Alertas críticas»</b> (críticas o altas: vencen en 7 días o menos, o ya vencieron).",
            "<b>«Documentación pendiente»</b>, <b>«Balances sin aprobar»</b> y <b>«Liquidaciones sin enviar»</b>, del "
            "período.",
            "<b>«Presentadas con atraso»</b>: cuántas presentaciones salieron tarde y cuántos días suman.",
            "<b>«Alertas más urgentes»</b> y <b>«Vencimientos más urgentes»</b>: las 5 más cercanas a hoy.",
        ],
        ["Tocá cualquier tarjeta para ir al detalle (por ejemplo, «Vencimientos vencidos» abre Vencimientos ya "
         "filtrado en «Vencidos»).",
         "Elegí un cliente en «Cliente» para ver el resumen de uno solo."],
        "Empezá el día por acá: si «Vencimientos vencidos» o «Alertas críticas» no están en cero, ahí está lo urgente.")

    seccion_pantalla(h, "Seguimiento", "p02-seguimiento.png",
        "Controlar qué clientes no entregaron la documentación del mes, qué se les reclamó y con qué respaldo.",
        [
            "Tarjetas: «Sin entregar», «Escalados a dirección», «Nunca respondieron», «Recordatorios agotados».",
            "Tabla «Estado de entrega por cliente»: estado, «Venció», «Avisos», «Último contacto», «Días sin respuesta» "
            "(en rojo si pasa de 3) y «Próxima acción».",
            "Al tocar un cliente: su «Bitácora de contactos» (cada llamada, mensaje o correo) y la «Constancia de "
            "gestión», que es lo que se le muestra al cliente que reclama.",
        ],
        ["Dirección abre el seguimiento del mes y registra los contactos («Registrar contacto»: vía, quién inició, "
         "cuándo, quién atendió, si respondió y qué se habló)."],
        "Los recordatorios automáticos a clientes están apagados por ahora: los contactos se registran a mano.")

    seccion_pantalla(h, "Clientes", "p03-clientes.png",
        "Ver la cartera y qué datos le faltan a cada cliente.",
        [
            "Tarjetas: «Clientes», «Activos», «Inactivos» e «Incompletos» (activos a los que les falta algún dato).",
            "Tabla «Cartera»: «Código», «Nombre», «RUC» («RUC pendiente» en ámbar si falta), «Tipo», «Canal preferido», "
            "«Estado» y <b>«Datos»</b>: «Completo» o «Incompleto» con lo que falta (RUC, responsable, o la regla de "
            "vencimiento de alguna obligación).",
        ],
        ["Buscá por nombre, código o RUC.",
         "Destildá «Solo activos» para ver también los inactivos.",
         "Dirección: «Nuevo cliente» y «Editar» (ver la sección 6 para pausar un cliente)."],
        "Un cliente con «RUC pendiente» no tiene vencimientos calculados: sin la terminación del RUC no hay fecha.")

    seccion_pantalla(h, "Documentos / IVA", "p04-documentos-iva.png",
        "Ver mes a mes el avance de cada cliente y los documentos que llegaron de OneDrive.",
        [
            "Arranca en el <b>mes anterior</b>, que es el que se está trabajando.",
            "Tabla «Proceso mensual»: «Estado», «Riesgo», «Recibidos» (los cuenta el sistema), «Faltantes» (en rojo si "
            "hay), «SIGA C/V» (compras / ventas cargadas), «IVA» (a pagar o a favor) y «Próxima acción».",
            "Al tocar un cliente: la tarjeta «Documentos» con cada archivo (se abre con un clic), tipo, comprobante, "
            "total, tasa y estado. Si un archivo tiene varias versiones, muestra la última; «Ver versiones anteriores» "
            "muestra todas.",
        ],
        ["Dirección: con un cliente elegido en el filtro, el botón dice <b>«Sincronizar este cliente»</b> y trae "
         "solo su carpeta de OneDrive en el momento; sin cliente, «Sincronizar OneDrive» trae lo que cambió de todos.",
         "Dirección: editar el proceso mensual del cliente y marcar documentos («SIGA», «Observar», «Rechazar»)."],
        "Si acabás de subir algo a OneDrive y no lo ves, esperá unos minutos (se sincroniza cada 15) o pedile a "
        "dirección que sincronice ese cliente.")

    seccion_pantalla(h, "Vencimientos", "p05-vencimientos.png",
        "Todo lo que vence, ordenado por urgencia, y lo que ya se presentó con sus días de atraso.",
        [
            "Tarjetas por nivel: «Vencidos», «Críticos», «Altos», «Medios», «Informativos», «Sin alerta».",
            "«Radar de vencimientos»: «Cliente», «Tipo» (IVA, IRE, IRP…), «Descripción», «Entidad», «Vence», "
            "«Días» (negativo si ya venció; en rojo si quedan 2 o menos), «Alerta» y «Riesgo».",
            "«Presentados»: «Vencía», «Presentado», «Días de atraso» («A tiempo» en verde o «N días» en ámbar) y "
            "«Prueba» («Ver declaración» abre el PDF de la DNIT, o «Cargada a mano»).",
        ],
        ["Filtrá por «Nivel de alerta» para ver solo lo vencido o lo próximo.",
         "Dirección: «Presentar», «Prórroga» y «No aplica» (qué hace cada una está en la sección 5), «Generar del "
         "calendario» y «Nuevo vencimiento»."],
        "Si en «Presentados» dice «hasta N días», la prueba es un aviso impreso de Marangatú: el atraso real puede ser menor.")

    seccion_pantalla(h, "Faltantes", "p06-faltantes.png",
        "La lista de lo que hay que subir a OneDrive: por cliente y período, qué comprobante de presentación falta y "
        "si las planillas RG 90 están completas. Lo que no aparece acá está al día.",
        [
            "Tarjetas: «Cliente y período con algo pendiente», «Comprobantes sin presentar», «Con planilla RG 90 incompleta».",
            "Tabla «Lo que falta subir»: «Comprobantes sin presentar» (con sus días de atraso) y «Planilla RG 90»: "
            "«Completa», «Falta compras», «Falta ventas» (puede ser legítimo si el cliente no facturó ese mes), "
            "«Faltan las dos», «Sin ninguna planilla» o «No aplica».",
        ],
        ["<b>«Actualizar ahora»</b> (todos menos solo lectura): trae lo nuevo de OneDrive, recalcula el IVA, detecta "
         "presentaciones y evalúa las alertas. Suele tardar menos de un minuto.",
         "«Exportar CSV» y «Descargar Excel»."],
        "Subiste un comprobante y querés que desaparezca de la lista: subilo a la carpeta correcta del cliente en "
        "OneDrive y apretá «Actualizar ahora».")

    seccion_pantalla(h, "Balances", "p07-balances.png",
        "Cargar las cifras del balance, ver qué inconsistencias encuentra el sistema y aprobarlo. El sistema prepara "
        "la revisión; aprobar lo hace siempre una persona.",
        [
            "«Ver por»: «Mes» o «Ejercicio (anual)».",
            "Tabla «Balances por cliente»: «Estado», «Activo», «Pasivo», «Patrimonio neto», «Resultado» y «Bloqueantes».",
            "«Checklist de revisión»: puntos «Bloqueante» (rojo: por ejemplo, la ecuación patrimonial no cierra, falta "
            "el extracto bancario) o «Advertencia» (ámbar: conciliación bancaria pendiente).",
        ],
        ["Dirección: cargar cifras («Guardar y revisar») y «Aprobar balance», que solo se habilita en «Listo para "
         "revisión» y sin bloqueantes. La aprobación queda registrada con nombre y fecha."],
        None)

    seccion_pantalla(h, "SIGA / Conciliación", "p08-siga-conciliacion.png",
        "Comparar los documentos recibidos con las exportaciones de SIGA: qué se recibió y no está cargado en SIGA, y "
        "qué hay en SIGA sin respaldo. Solo compara y señala; no corrige nada.",
        [
            "Se elige un cliente y un período.",
            "Tarjetas: «Recibidos», «En SIGA», «Coincidentes», «Sin identificación» y «Conciliado» (Sí / No / Sin datos).",
            "Listas: «Falta cargar en SIGA», «Sin respaldo documental» y «Diferencias de monto».",
        ],
        ["Dirección: «Importar exportación» de SIGA (Excel o CSV). Primero «Simular (no guarda nada)», después "
         "«Confirmar importación»."],
        "El sistema nunca toca SIGA: trabaja sobre las exportaciones que bajan ustedes.")

    seccion_pantalla(h, "Liquidaciones", "p09-liquidaciones.png",
        "Registrar el ciclo de la liquidación mensual: se genera, se envía y el cliente responde. Son tres estados "
        "distintos, y la diferencia importa si un cliente reclama que nunca le llegó nada.",
        [
            "Tarjetas: «Total», «Enviadas», «Respondidas», «Reclamadas».",
            "Tabla: «Tipo», «Estado» (Pendiente, Generada, Enviada, Reclamada, Respondida, Confirmada), «Envío» "
            "(fecha, canal y destinatario) y «Respuesta».",
        ],
        ["Dirección: «Nueva liquidación», «Enviar» (canal, destinatario y fecha) y «Respuesta» (qué respondió el "
         "cliente y cuándo)."],
        None)

    seccion_pantalla(h, "IVA", "p10-iva.png",
        "Ver el IVA de cada cliente calculado desde las planillas RG 90 presentadas ante la DNIT (ninguna cifra se "
        "carga a mano), y revisar las diferencias antes de presentar.",
        [
            "«Qué revisar antes de presentar»: cada comprobante cuyo IVA no cierra, con su riesgo: «Crédito fiscal de "
            "más» o «IVA ingresado de menos» (rojo: riesgo de multa), «En contra del cliente» (ámbar) o «El comprobante "
            "no cierra» (gris).",
            "«IVA por período»: compras, crédito fiscal, ventas, débito fiscal, «A pagar», «A favor» y «A favor "
            "(declarado DNIT)», que sale en rojo si no coincide con el cálculo.",
        ],
        ["Dirección: «Recalcular desde los libros» y decidir cada diferencia («Aceptar» con motivo, o «Revisar»)."],
        "Toda diferencia de IVA de más de 20 guaraníes levanta un aviso: puede derivar en una multa. Hasta 20 se toma como redondeo del proveedor.")

    seccion_pantalla(h, "Alertas", "p11-alertas.png",
        "Todos los avisos abiertos que levantó el sistema, en un solo lugar y ordenados por criticidad.",
        [
            "Tarjetas: «Críticas», «Altas», «Medias», «Informativas».",
            "«Radar de alertas»: «Criticidad», «Título», «Detalle», «Origen» (Vencimiento, Documentación faltante, "
            "Presentado con atraso, Libro RG 90, Declaración de otro contribuyente) y «Vence».",
        ],
        ["Dirección: «Registrar presentación» (marca el vencimiento como presentado y cierra la alerta), «Cerrar» "
         "(con motivo obligatorio) y «Evaluar ahora»."],
        "Qué significa cada tipo de alerta y cómo se cierra está en la sección 5.")

    seccion_pantalla(h, "Horas", "p12-horas.png",
        "Que cada persona cargue cuánto tiempo le dedicó a cada cliente. Solo vos ves lo que cargás.",
        [
            "«Cargar horas»: «Día» (no deja días futuros), «Cliente» (o «Tiempo interno (sin cliente)»), «Horas» (acepta "
            "coma: 2,5) y «Qué hiciste (opcional)». Botón «Guardar horas».",
            "«Mis horas»: lo que cargaste en el período, con «Corregir».",
            "Dirección ve además el «Resumen del equipo», solo con totales por cliente y por persona.",
        ],
        ["Un solo registro por cliente y día: si cargás de nuevo el mismo día y cliente, se corrige el anterior."],
        "Las horas se autoreportan: el sistema no las adivina por la actividad en pantalla.")

    seccion_pantalla(h, "Equipo", "p13-equipo.png",
        "Usuarios, roles y la cartera de cada uno.",
        ["Tabla: «Nombre», «Correo», «Cargo», «Rol», «Cartera» (completa o acotada) y «Estado»."],
        ["Dirección: «Nuevo usuario» y «Editar» (rol, cartera asignada, «Usuario activo», costo por hora)."],
        None)

    seccion_pantalla(h, "Reglas", "p14-reglas.png",
        "Tasas de IVA y reglas de recordatorio automático.",
        ["«Reglas impositivas» (tasas vigentes) y «Reglas de notificación» (plazos, horarios y reintentos de los "
         "recordatorios a clientes)."],
        ["Dirección: crear y editar reglas."],
        "Por ahora editar una tasa no cambia ningún cálculo, y los recordatorios a clientes están apagados.")

    seccion_pantalla(h, "Eventos (solo dirección)", "p15-eventos.png",
        "Auditoría: quién hizo cada cambio y cuándo, con el valor de antes y el de después.",
        ["Filtros por entidad, usuario, cliente y fechas. Trae 50 eventos por vez («Cargar más»)."],
        [],
        None)

    # 5 — diccionario de alertas
    h.append(P("5. Vencimientos y alertas: el diccionario", "h1"))
    h.append(P("Niveles de un vencimiento", "h2"))
    h.append(P("Se cuentan días corridos (no hábiles), en hora de Paraguay. «0 días» quiere decir que vence hoy."))
    h.append(tabla([
        ["Días que faltan", "Nivel", "Color", "¿Levanta una alerta?"],
        ["Ya pasó (negativo)", "<b>Vencido</b>", "Rojo", "Sí, crítica"],
        ["0 a 2", "<b>Crítica</b>", "Rojo", "Sí, crítica"],
        ["3 a 7", "<b>Alta</b>", "Ámbar", "Sí, alta"],
        ["8 a 15", "<b>Media</b>", "Gris", "Sí, media"],
        ["16 a 30", "<b>Informativa</b>", "Azul", "No"],
        ["Más de 30", "<b>Sin alerta</b>", "Verde", "No"],
    ], [3.8, 3.4, 2.6, 7.6]))
    h.append(P("«Próximos» no es un nivel: es la suma de Crítica, Alta y Media (15 días o menos).", "chico"))

    h.append(P("Tipos de alerta", "h2"))
    h.append(tabla([
        ["Origen", "Cuándo aparece", "Cómo se va"],
        ["<b>Vencimiento</b>", "Un vencimiento no presentado entra en Vencido, Crítica, Alta o Media. Título: «Vence en N "
         "días: …» o «Vencido sin comprobante de presentación: …».", "Sola, cuando aparece la declaración en OneDrive o "
         "se registra la presentación."],
        ["<b>Presentado con atraso</b>", "Se presentó después del vencimiento. Siempre informativa; habla de días, nunca de "
         "multas.", "La cierra una persona; no vuelve a aparecer."],
        ["<b>Documentación faltante</b>", "El proceso mensual tiene documentos faltantes. Alta si faltan más de 5, media si "
         "faltan 5 o menos.", "Sola, cuando ya no faltan."],
        ["<b>Libro RG 90</b>", "Hay comprobantes cuyo IVA declarado no coincide con la regla (desde 2025-01). Crítica.",
         "Sola, cuando todas las diferencias están aceptadas en la pantalla IVA."],
        ["<b>Declaración de otro contribuyente</b>", "En la carpeta de un cliente hay un PDF con el RUC de otra persona o "
         "empresa. Alta.", "Sola, cuando el archivo ya no está en esa carpeta."],
        ["<b>Recordatorio fallido</b>", "Un recordatorio falló 3 veces seguidas. Alta.", "La cierra una persona."],
    ], [3.6, 8.2, 5.6]))
    h.append(P("A los clientes inactivos no se les levantan alertas, y las que tenían dejan de mostrarse.", "chico"))

    h.append(P("Las tres acciones sobre un vencimiento (solo dirección)", "h2"))
    h.append(tabla([
        ["Acción", "Cuándo se usa", "Qué hace"],
        ["<b>Presentar</b>", "Se presentó y el sistema no lo detectó solo.", "Pide la fecha de presentación y lo pasa a "
         "«Presentados» con sus días de atraso."],
        ["<b>Prórroga</b>", "La DNIT corrió la fecha por resolución (por ejemplo, RG 50/2026).", "Pide la nueva fecha y "
         "la resolución (obligatoria). Se puede aplicar a todos los de esa obligación y período. Guarda la fecha original."],
        ["<b>No aplica</b>", "A ese cliente no le corresponde (por ejemplo, un anticipo de IRE cuando el IRE no dejó "
         "impuesto).", "Pide el motivo, lo saca de Vencimientos y de las alertas, y deja registrado quién y cuándo. Si "
         "ya se presentó, se usa «Presentar», no esto."],
    ], [2.8, 6, 8.6]))
    h.append(PageBreak())

    h.append(P("Obligaciones y calendario de la DNIT", "h2"))
    h.append(tabla([
        ["En la columna «Tipo»", "Qué es", "Cuándo vence"],
        ["<b>IVA</b>", "IVA General, formulario 120.", "Todos los meses (el del mes anterior)."],
        ["<b>RG 90</b>", "Planilla RG 90: libro de compras y ventas, formulario 241.", "Todos los meses."],
        ["<b>IRE</b>", "Impuesto a la Renta Empresarial, régimen general, formulario 500.", "Una vez por año."],
        ["<b>IRE SIMPLE</b>", "IRE régimen simple.", "Marzo."],
        ["<b>IRP</b>", "Impuesto a la Renta Personal.", "Marzo."],
        ["<b>Estados financieros</b>", "Formulario 158.", "Una vez por año, con el calendario de las informativas."],
        ["<b>IDU (informativa)</b>", "Declaración informativa del IDU.", "Junio."],
        ["<b>Anticipo de IRE</b>", "Cuotas de anticipo del IRE.", "Mayo, julio, setiembre y noviembre."],
    ], [3.6, 8, 5.8]))
    h.append(Spacer(1, 6))
    h.append(P("El <b>día</b> depende de la <b>terminación del RUC</b>: la última cifra antes del guion (en 80007729-6 es "
               "el <b>9</b>, no el 6). Hay dos calendarios:"))
    h.append(tabla([
        ["Terminación del RUC", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
        ["Determinativas (IVA, IRE, IRP, anticipos)", "7", "9", "11", "13", "15", "17", "19", "21", "23", "25"],
        ["Informativas (RG 90, estados financieros, IDU)", "8", "10", "12", "14", "16", "18", "20", "22", "24", "26"],
    ], [6.4] + [1.1] * 10))
    h.append(P("Si el día cae en feriado o fin de semana, la DNIT lo corre al siguiente día hábil; el sistema ya lo tiene en cuenta.", "chico"))
    h.append(PageBreak())

    # 6
    h.append(P("6. Clientes sin movimiento: pausar y reactivar", "h1"))
    h.append(P("Si un cliente queda <b>sin movimiento por un tiempo</b> (por ejemplo, unos meses del año), no hace falta "
               "eliminarlo: se lo <b>pausa</b> y después se lo reactiva. Lo hace dirección."))
    h += puntos([
        "En <b>Clientes</b>, tocá <b>«Editar»</b> en la fila del cliente.",
        "<b>Destildá «Cliente activo»</b> y escribí el motivo en «Observaciones» (por ejemplo, «Sin movimiento desde "
        "marzo»). Tocá «Guardar cambios».",
        "Desde ese momento: deja de aparecer en las pantallas, <b>no genera vencimientos ni alertas</b> y su carpeta de "
        "OneDrive deja de sincronizarse. <b>No se borra nada</b>: sus documentos y su historia quedan guardados.",
        "Para <b>reactivarlo</b>: en Clientes destildá «Solo activos», buscalo, «Editar», tildá «Cliente activo» y "
        "guardá. Vuelve con todo lo que tenía.",
    ])
    h.append(imagen("d01-cliente-editar.png", 12))
    h.append(PageBreak())

    # 7
    h.append(P("7. Glosario de la A a la Z", "h1"))
    glosario = [
        ("Actualizar ahora", "Botón de Faltantes: trae lo nuevo de OneDrive, recalcula el IVA, detecta presentaciones y evalúa las alertas."),
        ("Alerta", "Aviso que levanta el sistema cuando algo vence, falta o no cierra. Tiene criticidad: crítica, alta, media o informativa."),
        ("Anticipo de IRE", "Cuota que se paga a cuenta del IRE, calculada sobre el impuesto del ejercicio anterior. Si el IRE no dejó impuesto, no corresponde: se marca «No aplica»."),
        ("Cartera", "Los clientes que lleva cada persona. Un responsable solo ve los de su cartera."),
        ("Criticidad", "Qué tan urgente es una alerta: crítica (rojo), alta (ámbar), media (gris), informativa (azul)."),
        ("Determinativa / informativa", "Los dos calendarios de la DNIT: las determinativas (IVA, IRE, IRP) vencen los días impares 7 a 25; las informativas (RG 90, estados financieros, IDU) los pares 8 a 26."),
        ("DNIT", "Dirección Nacional de Ingresos Tributarios (ex SET)."),
        ("EEFF", "Estados financieros (formulario 158)."),
        ("Faltante", "Comprobante de presentación o planilla RG 90 que todavía no está en OneDrive."),
        ("IDU", "Impuesto a los Dividendos y Utilidades. En el sistema se controla su declaración informativa de junio."),
        ("Inactivo", "Cliente pausado: no aparece, no genera alertas ni vencimientos y no se sincroniza. Se reactiva cuando se quiera."),
        ("IRE / IRE SIMPLE", "Impuesto a la Renta Empresarial: régimen general (formulario 500) o régimen simple."),
        ("IRP", "Impuesto a la Renta Personal."),
        ("IVA", "Impuesto al Valor Agregado. El IVA General se declara todos los meses (formulario 120)."),
        ("Marangatú", "El sistema de la DNIT donde se presentan las declaraciones."),
        ("No aplica", "Acción para un vencimiento que a ese cliente no le corresponde. Requiere motivo y queda registrado."),
        ("OneDrive", "Donde EFFORT guarda los archivos de cada cliente (carpeta CLIENTES). El sistema solo lee de ahí."),
        ("Período", "El mes al que corresponde algo, en formato AAAA-MM (por ejemplo, 2026-10)."),
        ("Presentado con atraso", "Se presentó después del vencimiento. El sistema cuenta los días; no calcula multas."),
        ("Prórroga", "La DNIT corre la fecha de un vencimiento por resolución. Se carga con la resolución y la fecha nueva."),
        ("RG 90", "Planilla de compras y ventas que se presenta ante la DNIT (formulario 241). Es de donde el sistema saca los importes del IVA."),
        ("RUC pendiente", "Cliente sin RUC cargado: sin la terminación del RUC no se le calculan los vencimientos."),
        ("SIGA", "El sistema contable de EFFORT. EFFORT Control 360 no lo toca: trabaja con sus exportaciones."),
        ("Sincronizar", "Traer de OneDrive lo nuevo. Lo hace solo cada 15 minutos; dirección puede adelantarlo para un cliente."),
        ("Terminación del RUC", "La última cifra antes del guion. Decide el día de vencimiento."),
        ("Vencimiento", "Una obligación con fecha: qué hay que presentar, de qué cliente y cuándo vence."),
        ("Verificación en dos pasos", "Además de la contraseña, el número de 6 cifras de Google Authenticator. Lo pide en cada ingreso."),
    ]
    h.append(tabla([["Palabra", "Qué quiere decir"]] + [[f"<b>{a}</b>", b] for a, b in glosario], [4.4, 13], chica=True))
    h.append(PageBreak())

    # 8
    h.append(P("8. Preguntas frecuentes", "h1"))
    faq = [
        ("Subí un archivo a OneDrive y no aparece.", "Se sincroniza cada 15 minutos. Si lo necesitás ya, en Faltantes apretá «Actualizar ahora», o pedile a dirección «Sincronizar este cliente» en Documentos. Si pesa más de 25 MB, no se copia."),
        ("Un vencimiento figura vencido pero ya se presentó.", "Falta la declaración en la carpeta del cliente en OneDrive. Subila (el PDF de la DNIT) y apretá «Actualizar ahora»: el sistema lo marca como presentado solo. Si no hay PDF, dirección puede usar «Presentar»."),
        ("A un cliente le aparece algo que no le corresponde.", "Avisale a dirección: puede marcarlo «No aplica» con el motivo."),
        ("No veo un cliente que llevo.", "No está en tu cartera o está inactivo. Avisale a dirección."),
        ("¿Puedo romper algo?", "No. Los responsables solo leen (salvo sus horas y «Actualizar ahora»), y el sistema nunca borra ni cambia nada en el OneDrive de EFFORT."),
        ("¿El sistema le manda correos a los clientes?", "Por ahora no: los avisos automáticos están apagados."),
        ("Me olvidé la contraseña o cambié de celular.", "Avisale a Daniel."),
    ]
    for pregunta, respuesta in faq:
        h.append(KeepTogether([P(f"<b>{pregunta}</b>", "texto"), P(respuesta, "texto"), Spacer(1, 4)]))

    doc = documento("Manual de uso - EFFORT Control 360.pdf", "EFFORT Control 360 — Manual de uso")
    doc.build(h, onFirstPage=pie_de_pagina("EFFORT Control 360 — Manual de uso"),
              onLaterPages=pie_de_pagina("EFFORT Control 360 — Manual de uso"))


if __name__ == "__main__":
    guia()
    manual()
    print("ok")
