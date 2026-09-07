import { test, expect } from '@playwright/test';
import { authenticator } from 'otplib';

import { CLIENTE_SEMBRADO, CREDENCIALES } from '../entorno-global.js';

// Mismas opciones que fija `apps/api/src/seguridad/credenciales.ts` — no son
// las que trae `otplib` por defecto, y este archivo corre en un proceso
// completamente separado del servidor, así que nada las comparte solo.
authenticator.options = { window: 1, step: 30 };

/**
 * Camino principal, de punta a punta, contra el sistema real.
 *
 * Lo que esto prueba y los tests con `fetch` mockeado de `apps/web/test/`
 * no pueden probar: que la cookie de sesión y el token CSRF funcionan de
 * verdad entre dos orígenes distintos, que el login real emite y acepta la
 * cookie, y que el servidor real (Fastify + Prisma + PostgreSQL) devuelve
 * datos que la pantalla puede efectivamente renderizar.
 */
test('dirección inicia sesión, navega, ve datos reales, y cierra sesión', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Correo electrónico').fill(CREDENCIALES.direccion.email);
  await page.getByLabel('Contraseña').fill(CREDENCIALES.direccion.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();

  // `direccion` exige segundo factor (`ROLES_CON_SEGUNDO_FACTOR_OBLIGATORIO`
  // en `apps/api/src/seguridad/rbac.ts`) — el código se calcula con el mismo
  // secreto que se sembró en la base, no se hardcodea ninguno.
  await page
    .getByLabel('Código de verificación')
    .fill(authenticator.generate(CREDENCIALES.direccion.secretoTotp));
  await page.getByRole('button', { name: 'Verificar' }).click();

  await expect(page.getByRole('button', { name: 'Seguimiento', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.getByRole('button', { name: 'Clientes', exact: true }).click();
  await expect(page.getByText(CLIENTE_SEMBRADO.nombre)).toBeVisible();
  await expect(page.getByText(CLIENTE_SEMBRADO.ruc)).toBeVisible();

  await page.getByRole('button', { name: 'Panel general', exact: true }).click();
  await expect(page.getByText('Clientes activos')).toBeVisible();
  // El indicador "Clientes activos" tiene que reflejar el cliente sembrado,
  // no quedar en blanco ni en un placeholder — es la prueba de que el
  // Promise.all contra los cinco endpoints reales resolvió bien.
  const tarjetaClientesActivos = page.getByText('Clientes activos').locator('xpath=..');
  await expect(tarjetaClientesActivos).toContainText('1');

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
});
