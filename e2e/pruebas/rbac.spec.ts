import { test, expect } from '@playwright/test';

import { CREDENCIALES } from '../entorno-global.js';

/**
 * RBAC real, no simulado.
 *
 * `apps/api/test/rbac.test.ts` ya prueba las 714 combinaciones de la matriz
 * en memoria, y las pantallas de `apps/web/test/` prueban que cada una
 * refleja el rol con `fetch` mockeado a mano. Lo que falta, y es justo lo
 * que un mock no puede probar, es que un 403 real del servidor real —
 * disparado por `exigirPermiso` contra la sesión real de un usuario
 * `auxiliar`— efectivamente llega al navegador y la pantalla lo muestra tal
 * cual, en vez de romperse o mostrar datos que no debería.
 */
test('auxiliar no tiene acceso al recurso "usuario": ve el 403 real del servidor', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Correo electrónico').fill(CREDENCIALES.auxiliar.email);
  await page.getByLabel('Contraseña').fill(CREDENCIALES.auxiliar.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();

  await expect(page.getByRole('button', { name: 'Seguimiento', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.getByRole('button', { name: 'Equipo', exact: true }).click();

  await expect(page.getByText('No tenés permiso para realizar esta acción.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nuevo usuario' })).not.toBeVisible();
});
