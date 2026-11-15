// Captura del formulario «Editar» de un cliente, con la casilla «Cliente activo», para la
// sección «Clientes sin movimiento» del manual. Entorno de prueba; nada toca producción.
// Se corre copiándolo a e2e/pruebas/ (ver docs/manual/herramientas/LEEME.md).
import { test, expect } from '@playwright/test';
import { authenticator } from 'otplib';

import { CREDENCIALES } from '../entorno-global.js';

authenticator.options = { window: 1, step: 30 };
const SALIDA = 'C:/Users/Daniel/NexusFlow AI/effort-control-360/docs/manual/imagenes';

test('formulario de editar cliente', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const d = CREDENCIALES.direccion;
  await page.goto('/');
  await page.getByLabel('Correo electrónico').fill(d.email);
  await page.getByLabel('Contraseña').fill(d.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.getByLabel('Código de verificación').fill(authenticator.generate(d.secretoTotp));
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.getByRole('button', { name: 'Panel general', exact: true })).toBeVisible();

  // Un cliente ficticio, para no mostrar uno real en el manual.
  await page.evaluate(async () => {
    const api = 'http://localhost:3901';
    const { csrfToken } = await (await fetch(`${api}/api/v1/csrf`, { credentials: 'include' })).json();
    const r = await fetch(`${api}/api/v1/clientes`, {
      method: 'POST', credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify({
        codigo: '201', nombre: 'DEMO COMERCIAL S.A.', ruc: null, tipoPersona: 'JURIDICA', canalPreferido: 'WHATSAPP',
        observaciones: 'Cliente de ejemplo para el manual.',
      }),
    });
    if (!r.ok) throw new Error(`alta del cliente de ejemplo: ${r.status}`);
  });
  await page.reload();
  await page.getByRole('button', { name: 'Clientes', exact: true }).click();
  await page.getByRole('row').filter({ hasText: 'DEMO COMERCIAL S.A.' }).getByRole('button', { name: 'Editar' }).click();
  const casilla = page.getByText('Cliente activo', { exact: true });
  await casilla.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  const formulario = page.locator('form').filter({ has: casilla });
  await formulario.screenshot({ path: `${SALIDA}/d01-cliente-editar.png` });
});
