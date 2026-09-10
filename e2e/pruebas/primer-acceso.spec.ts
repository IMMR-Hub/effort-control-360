import { test, expect } from '@playwright/test';
import { authenticator } from 'otplib';

import { CREDENCIALES } from '../entorno-global.js';

// Mismas opciones que fija `apps/api/src/seguridad/credenciales.ts`. Este
// archivo corre en un proceso separado del servidor, así que nada las comparte.
authenticator.options = { window: 1, step: 30 };

/**
 * Primer acceso de una cuenta recién creada, de punta a punta.
 *
 * Es el camino que antes no existía: una persona con segundo factor
 * obligatorio y sin configurar quedaba encerrada —el login respondía 403 sin
 * emitir sesión, y sin sesión no había forma de llegar a configurarlo— y la
 * contraseña inicial que le puso dirección no se podía cambiar nunca. Ver
 * `docs/DISCREPANCIAS.md`, punto 16.
 *
 * Lo que solo se puede comprobar acá, con navegador y servidor reales: que el
 * secreto que muestra la pantalla es el mismo que el servidor guardó (un
 * código generado con él tiene que ser aceptado), y que después del cambio de
 * contraseña la sesión queda efectivamente cerrada del lado del servidor.
 */
test('una cuenta nueva configura su segundo factor, cambia su contraseña y recién ahí entra', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByLabel('Correo electrónico').fill(CREDENCIALES.primerAcceso.email);
  await page.getByLabel('Contraseña').fill(CREDENCIALES.primerAcceso.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();

  /* --- Alta del segundo factor -------------------------------------------- */

  await expect(
    page.getByRole('heading', { name: 'Configurá tu verificación en dos pasos' }),
  ).toBeVisible();

  // El secreto se lee de la pantalla, no se hardcodea: así el test comprueba
  // que lo que se le muestra a la persona sirve de verdad contra el servidor.
  const secreto = (await page.locator('code').innerText()).trim();
  expect(secreto).toMatch(/^[A-Z2-7]{16,}$/);

  await page.getByLabel('Código de tu aplicación').fill(authenticator.generate(secreto));
  await page.getByRole('button', { name: 'Confirmar y entrar' }).click();

  /* --- Cambio de contraseña obligatorio ------------------------------------ */

  // Con el segundo factor resuelto la sesión ya es válida, pero
  // `debeCambiarContrasena` sigue en `true`: el servidor rechaza todo lo demás,
  // así que tiene que aparecer esta pantalla y no el panel.
  await expect(page.getByRole('heading', { name: 'Cambiá tu contraseña' })).toBeVisible();

  // `exact` en la primera: sin eso también coincide con "Repetí la contraseña
  // nueva", que la contiene.
  await page.getByLabel('Contraseña actual').fill(CREDENCIALES.primerAcceso.password);
  await page
    .getByLabel('Contraseña nueva', { exact: true })
    .fill(CREDENCIALES.primerAcceso.passwordNueva);
  await page
    .getByLabel('Repetí la contraseña nueva')
    .fill(CREDENCIALES.primerAcceso.passwordNueva);
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

  await expect(page.getByRole('heading', { name: 'Contraseña actualizada' })).toBeVisible();
  await page.getByRole('button', { name: 'Ir a ingresar' }).click();

  /* --- Recién ahora entra de verdad ---------------------------------------- */

  await expect(page.getByLabel('Correo electrónico')).toBeVisible();

  // La contraseña vieja ya no sirve: si sirviera, quien la fijó seguiría
  // teniendo acceso a la cuenta, que es justamente lo que este flujo resuelve.
  await page.getByLabel('Correo electrónico').fill(CREDENCIALES.primerAcceso.email);
  await page.getByLabel('Contraseña').fill(CREDENCIALES.primerAcceso.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('alert')).toBeVisible();

  // Con la nueva sí, y ya no vuelve a pedir el alta del segundo factor: pide
  // el código, como a cualquiera que ya lo tenga configurado.
  await page.getByLabel('Contraseña').fill(CREDENCIALES.primerAcceso.passwordNueva);
  await page.getByRole('button', { name: 'Ingresar' }).click();

  await page.getByLabel('Código de verificación').fill(authenticator.generate(secreto));
  await page.getByRole('button', { name: 'Verificar' }).click();

  await expect(page.getByRole('button', { name: 'Seguimiento', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
});
