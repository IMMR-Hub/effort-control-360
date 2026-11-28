// Capturas de cada pantalla del menú para el manual, contra el ENTORNO DE PRUEBA
// (esquema aislado que se crea y se destruye en cada corrida, usuario de prueba de
// dirección). Antes de capturar carga datos FICTICIOS por la API (clientes «DEMO»,
// vencimientos con distintos niveles de urgencia, una presentación con atraso, horas)
// para que las tablas no salgan vacías. Nada toca producción.
// Se corre copiándolo a e2e/pruebas/ (ver docs/manual/herramientas/LEEME.md).
import { test, expect, type Page } from '@playwright/test';
import { authenticator } from 'otplib';

import { CREDENCIALES } from '../entorno-global.js';

authenticator.options = { window: 1, step: 30 };
const SALIDA = 'C:/Users/Daniel/NexusFlow AI/effort-control-360/docs/manual/imagenes';

const MENU = [
  'Panel general', 'Seguimiento', 'Clientes', 'Documentos / IVA', 'Vencimientos', 'Faltantes', 'Balances',
  'SIGA / Conciliación', 'Liquidaciones', 'IVA', 'Alertas', 'Horas', 'Equipo', 'Reglas', 'Eventos',
];

const archivo = (nombre: string) =>
  `${SALIDA}/${nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')}.png`;

/** Carga datos ficticios por la API, con la sesión y el token CSRF del navegador. */
async function sembrarDemo(page: Page): Promise<void> {
  const resultado = await page.evaluate(async () => {
    const api = (window as unknown as { __API__?: string }).__API__ ?? 'http://localhost:3901';
    const { csrfToken } = await (await fetch(`${api}/api/v1/csrf`, { credentials: 'include' })).json();
    const post = async (ruta: string, cuerpo: unknown) => {
      const r = await fetch(`${api}${ruta}`, {
        method: 'POST', credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
        body: JSON.stringify(cuerpo),
      });
      const datos = await r.json().catch(() => null);
      if (!r.ok) throw new Error(`${ruta} → ${r.status} ${JSON.stringify(datos).slice(0, 200)}`);
      return datos;
    };
    const dv = (base: string) => {
      let suma = 0;
      [...base].reverse().forEach((d, i) => { suma += Number(d) * (i + 2); });
      const resto = suma % 11;
      return resto > 1 ? 11 - resto : 0;
    };
    const ruc = (base: string) => `${base}-${dv(base)}`;
    const dia = (desplazamiento: number) => {
      const f = new Date();
      f.setDate(f.getDate() + desplazamiento);
      return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
    };

    const clientes = [
      { codigo: '201', nombre: 'DEMO COMERCIAL S.A.', ruc: ruc('80900011'), tipoPersona: 'JURIDICA', canalPreferido: 'WHATSAPP' },
      { codigo: '202', nombre: 'EJEMPLO AGRO E.A.S.', ruc: ruc('80900022'), tipoPersona: 'JURIDICA', canalPreferido: 'EMAIL' },
      { codigo: '203', nombre: 'MUESTRA SERVICIOS S.R.L.', ruc: ruc('80900033'), tipoPersona: 'JURIDICA', canalPreferido: 'ONEDRIVE' },
      { codigo: '204', nombre: 'MARÍA EJEMPLO', ruc: ruc('4900044'), tipoPersona: 'FISICA', canalPreferido: 'WHATSAPP' },
      { codigo: '205', nombre: 'CONSTRUCTORA DEMO S.A.', ruc: null, tipoPersona: 'JURIDICA', canalPreferido: 'EMAIL' },
    ];
    const creados: { id: string; nombre: string }[] = [];
    for (const c of clientes) {
      const r = await post('/api/v1/clientes', c);
      creados.push({ id: r.cliente?.id ?? r.id, nombre: c.nombre });
    }

    const vencimientos = [
      { c: 0, desc: 'IVA General — período 2026-10', dias: -6, riesgo: 'ALTO' },
      { c: 1, desc: 'IVA General — período 2026-10', dias: 1, riesgo: 'ALTO' },
      { c: 2, desc: 'Anticipo de IRE — cuota 4', dias: 5, riesgo: 'MEDIO' },
      { c: 3, desc: 'IRP — ejercicio 2025', dias: 12, riesgo: 'MEDIO' },
      { c: 0, desc: 'Planilla RG 90 — libro de compras y ventas — período 2026-10', dias: 25, riesgo: 'BAJO' },
      { c: 1, desc: 'Estados financieros — ejercicio 2025', dias: 60, riesgo: 'MEDIO' },
      { c: 2, desc: 'IVA General — período 2026-09', dias: -30, riesgo: 'ALTO', presentado: -27 },
      { c: 3, desc: 'IVA General — período 2026-09', dias: -32, riesgo: 'MEDIO', presentado: -33 },
    ];
    for (const v of vencimientos) {
      const r = await post(`/api/v1/clientes/${creados[v.c]!.id}/vencimientos`, {
        tipoDocumento: 'CONSTANCIA', descripcion: v.desc, entidad: 'DNIT', fechaVencimiento: dia(v.dias), riesgo: v.riesgo,
      });
      const id = r.vencimiento?.id ?? r.id;
      if (v.presentado !== undefined) await post(`/api/v1/vencimientos/${id}/presentar`, { fechaPresentacion: dia(v.presentado) });
    }
    await post('/api/v1/alertas/evaluar', { periodo: dia(0).slice(0, 7) });
    await post('/api/v1/horas', { clienteId: creados[0]!.id, fecha: dia(0), minutos: 150, tarea: 'Carga de facturas de compras' });
    await post('/api/v1/horas', { clienteId: creados[1]!.id, fecha: dia(0), minutos: 90, tarea: 'Revisión del IVA del mes' });

    // Seguimiento (2026-11-27): colaboradores de ejemplo, pedidos del equipo con su conversación
    // (una nota interna incluida) y un pedido de documentación a un cliente, para que las
    // pestañas Pendientes y Equipo no salgan vacías.
    const get = async (ruta: string) => {
      const r = await fetch(`${api}${ruta}`, { credentials: 'include' });
      if (!r.ok) throw new Error(`${ruta} → ${r.status}`);
      return r.json();
    };
    const colaborador = async (nombre: string, apellido: string, email: string) => {
      const r = await post('/api/v1/usuarios', {
        nombre, apellido, email, rol: 'responsable', contrasenaInicial: 'clave-de-ejemplo-para-el-manual-2026',
      });
      return (r.usuario?.id ?? r.id) as string;
    };
    const ana = await colaborador('Ana', 'Ejemplo', 'ana.ejemplo@effort.com.py');
    const bruno = await colaborador('Bruno', 'Muestra', 'bruno.muestra@effort.com.py');
    const { usuarios } = await get('/api/v1/usuarios');
    const direccion = (usuarios as { id: string; nombre: string; rol: string }[])
      .find((u) => u.rol === 'direccion' && u.nombre === 'Dirección')!.id;
    const ahora = new Date().toISOString();
    const pedido = async (cuerpo: Record<string, unknown>) =>
      ((await post('/api/v1/seguimiento/pedidos-equipo', {
        destinatarioUsuarioIds: [direccion], ocurridoEn: ahora, ...cuerpo,
      })).pedido.id) as string;

    await pedido({
      solicitanteUsuarioId: ana, clienteId: null, canal: 'WHATSAPP', prioridad: 'ALTA', recordarEl: dia(-1),
      asunto: 'No me aparece el cliente nuevo en el Panel',
      texto: 'Cargué el cliente ayer y hoy no lo veo en el Panel ni en Vencimientos.',
    });
    const iva = await pedido({
      solicitanteUsuarioId: bruno, clienteId: creados[0]!.id, canal: 'CORREO', prioridad: 'CRITICA', recordarEl: dia(1),
      asunto: '¿Se presenta el IVA con la factura que llegó tarde?',
      texto: 'DEMO COMERCIAL mandó hoy una factura de octubre. ¿La incluyo en el IVA que vence esta semana?',
    });
    await post(`/api/v1/seguimiento/pedidos-equipo/${iva}/mensajes`, {
      autorUsuarioId: direccion, canal: 'WHATSAPP', ocurridoEn: ahora, notaInterna: false,
      texto: 'Sí, incluila. Si el cliente no manda el resto hoy, avisame.',
    });
    await post(`/api/v1/seguimiento/pedidos-equipo/${iva}/mensajes`, {
      autorUsuarioId: direccion, canal: 'PRESENCIAL', ocurridoEn: ahora, notaInterna: true,
      texto: 'Ojo: este cliente ya presentó tarde en septiembre. Revisar antes de enviar.',
    });
    await pedido({
      solicitanteUsuarioId: ana, clienteId: creados[1]!.id, canal: 'LLAMADA', prioridad: 'MEDIA', recordarEl: null,
      asunto: 'Pedir a EJEMPLO AGRO los extractos bancarios',
      texto: 'El cliente dice que los manda la semana que viene.',
    });
    const mesPasado = (() => { const f = new Date(); f.setDate(1); f.setMonth(f.getMonth() - 1);
      return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`; })();
    await post(`/api/v1/clientes/${creados[2]!.id}/solicitudes-documentacion`, {
      periodo: mesPasado, cuentaDesde: dia(-10), reglaId: null,
    });
    return creados.length;
  });
  expect(resultado).toBe(5);
}

test('capturas de cada pantalla', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1366, height: 820 });
  const d = CREDENCIALES.direccion;
  await page.goto('/');
  await page.getByLabel('Correo electrónico').fill(d.email);
  await page.getByLabel('Contraseña').fill(d.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.getByLabel('Código de verificación').fill(authenticator.generate(d.secretoTotp));
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.getByRole('button', { name: 'Panel general', exact: true })).toBeVisible();

  await sembrarDemo(page);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Panel general', exact: true })).toBeVisible();

  for (const [i, nombre] of MENU.entries()) {
    await page.getByRole('button', { name: nombre, exact: true }).click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: archivo(`p${String(i + 1).padStart(2, '0')}-${nombre}`), fullPage: true });
  }

  // Detalles que el manual explica.
  await page.getByRole('button', { name: 'Clientes', exact: true }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Editar' }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: archivo('d01-cliente-editar'), fullPage: true });
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Panel general', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Vencimientos', exact: true }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'No aplica' }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: archivo('d02-no-aplica'), fullPage: false });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Panel general', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Vencimientos', exact: true }).click();
  await page.waitForTimeout(1500);
  const prorroga = page.getByRole('button', { name: /Pr[oó]rroga/ }).first();
  if (await prorroga.count()) {
    await prorroga.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: archivo('d03-prorroga'), fullPage: false });
  }
  await page.reload();
  await expect(page.getByRole('button', { name: 'Panel general', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Documentos / IVA', exact: true }).click();
  await page.waitForTimeout(1500);
  await page.getByLabel('Cliente').first().selectOption({ label: 'DEMO COMERCIAL S.A.' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: archivo('d04-documentos-un-cliente'), fullPage: false });

  // Seguimiento: pestañas Equipo y Clientes, el formulario de pedido y las acciones rápidas.
  await page.getByRole('button', { name: 'Seguimiento', exact: true }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Reagendar' }).first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: archivo('d07-seguimiento-reagendar'), fullPage: false });
  await page.getByRole('tab', { name: 'Equipo' }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /IVA con la factura/ }).first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: archivo('d05-seguimiento-equipo'), fullPage: true });
  // La pantalla se desplaza por dentro: la conversación (con la nota interna) va en su propia captura.
  await page.getByText('Ojo: este cliente ya presentó tarde').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: archivo('d05b-seguimiento-conversacion'), fullPage: false });
  await page.getByRole('button', { name: 'Nuevo pedido' }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: archivo('d06-seguimiento-nuevo-pedido'), fullPage: false });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Panel general', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Seguimiento', exact: true }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('tab', { name: 'Clientes' }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: archivo('d08-seguimiento-clientes'), fullPage: true });
});
