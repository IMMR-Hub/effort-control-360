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
});
