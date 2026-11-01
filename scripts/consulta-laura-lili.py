# Consulta para Laura y Lili (Daniel, 2026-11-01: «hazme la consulta exacta para pasarla mañana mismo a Laura y Lili, a primera
# hora»). Junta en un Word, en palabras simples, todo lo que el sistema necesita que EFFORT confirme para empezar a usarlo.
# Solo lee: la planilla de empleados que mandó Daniel (ya cruzada con las carpetas), las carpetas de clientes y el plan de
# rutas largas. Uso: python -I scripts/consulta-laura-lili.py <asignaciones.json> <salida.docx>
import json, sys, os, re, unicodedata
from docx import Document
from docx.shared import Pt

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
filas = json.load(open(sys.argv[1], encoding='utf-8'))
carp = json.load(open(os.path.join(RAIZ, 'docs/analisis-onedrive-2026-10/datos/carpetas-de-clientes.json'), encoding='utf-8'))
carp = carp if isinstance(carp, list) else carp.get('carpetas', list(carp.values()))
nombres = {(c.get('codigo') or c.get('cod')): (c.get('nombre') or c.get('carpeta') or '') for c in carp}
acortar = json.load(open('C:/Users/Daniel/DATOS ORDENAMIENTO EFFORT 2026-10/onedrive/plan-acortar.json', encoding='utf-8'))

# Correcciones de número: la planilla trae un número que no es el de la carpeta; el nombre identifica la carpeta sin duda.
CORRECCION = {'QUIMECO E.A.S.': '116', 'R3J E.A.S': '084', 'NG EAS': '083', 'NR GANADERA  - NICODEMUS': '088', 'ALMA BENITEZ OVIEDO': '105',
              'GESTION AGROPECUARIA SRL': '085', 'ANALIA BAEZ JOHANNSEN': '104', 'AM Y ASOCIADOS - TADEO': '107', 'MBV E.A.S. - DIEGO': '118',
              'ASOCIACION PY CRIADORES DE PAMPA': '128', 'DIEGO BECONI IRP': '023', 'BOU ASSI NAJI BAHIJ': '086', 'LILCY S.A': '067',
              'ECOAGRO S.A': '068', 'EDWIN SETRINI': '069'}
SIN_CARPETA = {'AF Y RM ASOCIACIONES - ALISON', 'DIEGO SOSA'}
asign = {}
for f in filas:
    cod = CORRECCION.get(f['cliente'], f['cod'] if f['coincide'] else None)
    if f['cliente'] in SIN_CARPETA or not cod: continue
    asign.setdefault(cod, f['empleado'])
porEmp = {}
for cod, e in asign.items(): porEmp.setdefault(e, []).append(cod)
sin_asignar = sorted(c for c in nombres if c not in asign)

doc = Document(); doc.styles['Normal'].font.name = 'Calibri'; doc.styles['Normal'].font.size = Pt(11)
doc.add_heading('Consulta para Laura y Lili — EFFORT Control 360', 0)
doc.add_paragraph('Lunes 2 de noviembre de 2026. Para empezar a usar el sistema con todos los clientes necesitamos que nos confirmen '
                  'lo siguiente. Pueden contestar al lado de cada punto. Lo más urgente está primero.')
def tabla(cab, filas_):
    t = doc.add_table(rows=1, cols=len(cab)); t.style = 'Light Grid Accent 1'
    for i, c in enumerate(cab): t.rows[0].cells[i].text = c
    for r in filas_:
        cs = t.add_row().cells
        for i, v in enumerate(r): cs[i].text = str(v)
    doc.add_paragraph()
def lista(cods): return [[c, nombres.get(c, '')] for c in sorted(cods)]

doc.add_heading('1. Un archivo abierto (urgente, 1 minuto)', 1)
doc.add_paragraph('Alguien tiene abierto en Excel desde el viernes este archivo, y por eso es el único que no se pudo ordenar: '
                  '«021 COPESA / PERIODO 2026 / VARIOS / FLUJO DE CAJA COPESA A JUNIO 2027 (1).xlsx». Quien lo tenga abierto, que lo '
                  'cierre y avise a Daniel: se ubica en 3 minutos.')

doc.add_heading('2. ¿Qué Karina es «KARI»?', 1)
doc.add_paragraph('En el sistema hay dos usuarias Karina: una con correo kbae…@effort.com.py y otra con kmed…@effort.com.py. '
                  f'La planilla asigna a «KARI» estos {len(porEmp.get("KARI", []))} clientes:')
tabla(['Número', 'Cliente'], lista(porEmp.get('KARI', [])))
doc.add_paragraph('Respuesta: KARI es  ☐ Karina (kbae…)   ☐ Karina (kmed…)')

doc.add_heading('3. ¿Quién es «BEA»?', 1)
doc.add_paragraph(f'La planilla asigna a «BEA» estos {len(porEmp.get("BEA", []))} clientes, pero no hay ninguna usuaria Bea en el sistema. '
                  'Por ahora quedan sin responsable. ¿Quién es Bea? ¿Hay que darla de alta como usuaria (con qué correo) o esos clientes los lleva otra persona?')
tabla(['Número', 'Cliente'], lista(porEmp.get('BEA', [])))

doc.add_paragraph('Importante: mientras no se sepa cuál Karina es, ninguna de las dos tiene clientes asignados, y un responsable sin clientes '
                  'asignados entra al sistema y no ve ninguno. Lo mismo pasa con Jorge y Melany, que no figuran en la planilla: ¿qué clientes llevan?')

doc.add_heading('4. Clientes sin responsable en la planilla', 1)
doc.add_paragraph(f'Estos {len(sin_asignar)} clientes tienen carpeta en CLIENTES pero no figuran en la planilla de empleados. ¿Quién lleva cada uno? '
                  '(Si alguno ya no es cliente, indicarlo.)')
tabla(['Número', 'Cliente', 'Responsable'], [[c, nombres.get(c, ''), ''] for c in sin_asignar])

doc.add_heading('5. Números de la planilla que no coinciden con la carpeta', 1)
doc.add_paragraph('En la planilla de empleados estos clientes tienen otro número. Los vamos a tomar con el número de su carpeta (columna «Carpeta»). '
                  'Confirmar que está bien:')
tabla(['Planilla', 'Cliente', 'Carpeta'], [[f['cod'] or '—', f['cliente'], f"{CORRECCION[f['cliente']]} {nombres.get(CORRECCION[f['cliente']], '')}"] for f in filas if f['cliente'] in CORRECCION])
doc.add_paragraph('Y estos dos no tienen carpeta en CLIENTES: «AF Y RM ASOCIACIONES - ALISON» (121) y «DIEGO SOSA». ¿Son clientes? '
                  'Si lo son, hay que crearles su carpeta con el número que corresponda.')

doc.add_heading('6. Datos de los clientes: RUC, régimen y obligaciones', 1)
doc.add_paragraph('Va adjunta la planilla «DATOS PENDIENTES DE CLIENTES - 01-11-2026.xlsx». Hoy 39 clientes no tienen RUC cargado y a 123 les faltan '
                  'el régimen y las obligaciones. Sin obligaciones, el sistema no les calcula vencimientos ni avisa: por ahora solo los 5 clientes del '
                  'piloto (FUMIPRO, COPESA, DIBEC, SIPAR, ECOAGRO) tienen vencimientos. La planilla de empleados ya trae las obligaciones de muchos '
                  '(«IVA, IRE GRAL», «SOLO IRP», etc.): ¿podemos tomarlas de ahí? ¿Desde qué mes rigen?')
doc.add_paragraph('Dudas puntuales: el RUC propuesto para el 056 FACUNDO CARRASCOSA es el de David Romero (045); el 113 CASA VIVA declara como '
                  '«PAVISA SOCIEDAD ANONIMA» (¿es el mismo?); ¿qué clientes son el 045, el 070 y el 099?')

doc.add_heading('7. Rutas demasiado largas', 1)
doc.add_paragraph(f'Windows y Excel no abren un archivo cuya ruta completa es muy larga. Ya se acortaron 52 carpetas y 256 nombres (ver el '
                  f'«DICCIONARIO DE ABREVIATURAS - EFFORT»). Quedan {len(acortar["quedanLargos"])} que no se pudieron acortar sin que el nombre pierda '
                  'sentido: están en la hoja «Rutas largas para decidir» de la bitácora. Mientras tanto, si alguno no abre desde la computadora, '
                  'se abre desde OneDrive en el navegador. ¿Los acortamos a mano o se quedan así?')
doc.add_paragraph('En el diccionario quedan para definir: «FC / F.C.», «IDU» e «ISC». ¿Qué significa cada uno?')

doc.add_heading('8. Dos Excel con vínculos', 1)
doc.add_paragraph('Dos Excel tienen fórmulas que leen otros archivos que cambiaron de lugar: «094 … CIERRE 2024 / LIQ IRP LARA 2024.xlsx» y '
                  '«021 … PEDIDO AUDIT / PRESTAMOS BANCARIOS / DEVENGAMIENTO DE PRESTAMOS 2025.xlsx». Los valores no se pierden. Si al abrirlos piden '
                  'actualizar vínculos: Datos → Editar vínculos → Cambiar origen (la ruta nueva está en «VINCULOS DE EXCEL A ACTUALIZAR»).')

doc.add_heading('9. Para empezar el lunes', 1)
for t in ['Al prender la computadora, esperar a que el ícono de OneDrive diga «Al día» antes de abrir archivos (tiene que recibir los cambios del ordenamiento).',
          'Para encontrar un archivo que cambió de lugar o de nombre: «BITACORA DEL ORDENAMIENTO DEL ONEDRIVE - 01-11-2026.xlsx», hoja «Buscar archivo» (Ctrl+B con parte del nombre viejo).',
          'Las copias repetidas están en la papelera de OneDrive y se pueden recuperar hasta 93 días.',
          'EFFORT Control 360 ya tiene los 128 clientes. Está leyendo sus archivos de a poco (unos 400 cada 40 minutos); termina en 1 a 2 días. '
          'Mientras tanto, un cliente puede verse con pocos documentos: no es un error, todavía no llegó su turno.',
          'Dos PDF de BOU ASSI (Contrato compra venta, 63 MB; FACTURAS, 39 MB) pasan el tamaño máximo automático: si hacen falta en el sistema, subirlos a mano.']:
    doc.add_paragraph(t, style='List Bullet')
doc.save(sys.argv[2])
print(f'LISTO · KARI {len(porEmp.get("KARI", []))} · BEA {len(porEmp.get("BEA", []))} · sin responsable {len(sin_asignar)} · asignables ya {sum(len(v) for k, v in porEmp.items() if k in ("ANALIA", "ARA", "ARI", "SANDRA"))} · {sys.argv[2]}')
