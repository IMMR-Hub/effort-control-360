// Capturas del primer ingreso para la guía del equipo, contra el entorno de prueba
// (esquema aislado, cuenta de prueba «primer acceso»). Nada toca producción.
import { test, expect } from '@playwright/test';
import { authenticator } from 'otplib';

import { CREDENCIALES } from '../entorno-global.js';

authenticator.options = { window: 1, step: 30 };
const SALIDA = 'C:/Users/Daniel/NexusFlow AI/effort-control-360/docs/manual/imagenes';

test('capturas del primer ingreso', async ({ page }) => {
  const cuenta = CREDENCIALES.primerAcceso;
  await page.goto('/');
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
  await page.screenshot({ path: `${SALIDA}/01-ingresar-vacio.png` });

  await page.getByLabel('Correo electrónico').fill('aalvarenga@effort.com.py');
  await page.getByLabel('Contraseña').fill('xxxxxxxxxxxxxxxxxx');
  await page.screenshot({ path: `${SALIDA}/02-ingresar-completo.png` });

  await page.getByLabel('Correo electrónico').fill(cuenta.email);
  await page.getByLabel('Contraseña').fill(cuenta.password);
  await page.getByRole('button', { name: 'Ingresar' }).click();

  await expect(page.getByRole('heading', { name: 'Configurá tu verificación en dos pasos' })).toBeVisible();
  const secreto = (await page.locator('code').innerText()).trim();
  await page.screenshot({ path: `${SALIDA}/03-configurar-dos-pasos.png` });

  await page.getByLabel('Código de tu aplicación').fill(authenticator.generate(secreto));
  await page.screenshot({ path: `${SALIDA}/04-codigo-de-la-aplicacion.png` });
  await page.getByRole('button', { name: 'Confirmar y entrar' }).click();

  await expect(page.getByRole('heading', { name: 'Cambiá tu contraseña' })).toBeVisible();
  await page.screenshot({ path: `${SALIDA}/05-cambia-tu-contrasena.png` });
  await page.getByLabel('Contraseña actual').fill(cuenta.password);
  await page.getByLabel('Contraseña nueva', { exact: true }).fill(cuenta.passwordNueva);
  await page.getByLabel('Repetí la contraseña nueva').fill(cuenta.passwordNueva);
  await page.screenshot({ path: `${SALIDA}/06-cambia-tu-contrasena-completo.png` });
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

  await expect(page.getByRole('heading', { name: 'Contraseña actualizada' })).toBeVisible();
  await page.screenshot({ path: `${SALIDA}/07-contrasena-actualizada.png` });
  await page.getByRole('button', { name: 'Ir a ingresar' }).click();

  await page.getByLabel('Correo electrónico').fill(cuenta.email);
  await page.getByLabel('Contraseña').fill(cuenta.passwordNueva);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByLabel('Código de verificación')).toBeVisible();
  await page.getByLabel('Código de verificación').fill('123456');
  await page.screenshot({ path: `${SALIDA}/08-codigo-de-verificacion.png` });
  await page.getByLabel('Código de verificación').fill(authenticator.generate(secreto));
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.getByRole('button', { name: 'Panel general', exact: true })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SALIDA}/09-adentro-panel.png` });
});
