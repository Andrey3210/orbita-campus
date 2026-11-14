import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

async function entrar(page, rol) {
  await page.goto('/');
  await page.getByLabel('Correo institucional', { exact: true }).fill(`orbita.campus.g7.${rol.toLowerCase()}@unmsm.edu.pe`);
  await page.locator('#clave').fill(process.env[`PRUEBA_${rol}_PASSWORD`]);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Servicios universitarios', exact: true })).toBeVisible();
}

async function salir(page) {
  await page.getByRole('link', { name: 'Cuenta', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Iniciar sesión', exact: true })).toBeVisible();
}

async function abrir(page, asunto) {
  await page.getByRole('link', { name: 'Solicitudes', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(asunto) }).click();
  await expect(page.getByRole('heading', { name: asunto, exact: true })).toBeVisible();
}

async function cambiarEstado(page, clave, nombre, preparar) {
  const estado = page.getByLabel('Estado', { exact: true });
  await estado.selectOption(clave);
  if (preparar) await preparar();
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  const ficha = page.locator('.titular.detalle');
  await expect(ficha.getByText(nombre, { exact: true })).toBeVisible();
}

test('aceptación de los cuatro perfiles y los seis estados', async ({ page }) => {
  const asunto = 'Prueba de atención ' + randomUUID().slice(0, 8);
  const comentario = 'Se restableció el proyector y se verificó su funcionamiento.';
  await entrar(page, 'ESTUDIANTE');
  await expect(page.getByRole('link', { name: 'Administración', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Solicitudes', exact: true }).click();
  await page.getByRole('button', { name: 'Nueva solicitud' }).click();
  await page.getByLabel('Asunto', { exact: true }).fill(asunto);
  await page.getByLabel('Categoría', { exact: true }).selectOption({ label: 'Soporte informático' });
  await page.getByLabel('Ubicación', { exact: true }).fill('Aula de pruebas, 203');
  await page.getByLabel('Descripción', { exact: true }).fill('El proyector dejó de recibir señal durante una práctica.');
  await page.getByRole('button', { name: 'Registrar solicitud', exact: true }).click();
  await expect(page.getByRole('heading', { name: asunto, exact: true })).toBeVisible();
  await expect(page.locator('.titular.detalle').getByText('Registrada', { exact: true })).toBeVisible();
  await salir(page);

  await entrar(page, 'SUPERVISOR');
  await abrir(page, asunto);
  await cambiarEstado(page, 'EVALUACION', 'En evaluación');
  await cambiarEstado(page, 'ASIGNADA', 'Asignada', async () => {
    const tecnico = page.getByLabel('Técnico responsable', { exact: true });
    await tecnico.selectOption({ label: 'Técnico de prueba' });
  });
  await salir(page);

  await entrar(page, 'TECNICO');
  await abrir(page, asunto);
  await cambiarEstado(page, 'ATENCION', 'En atención');
  await page.getByLabel('Comentario', { exact: true }).fill(comentario);
  await page.getByRole('button', { name: 'Añadir comentario', exact: true }).click();
  await expect(page.getByText(comentario, { exact: true })).toBeVisible();
  await cambiarEstado(page, 'RESUELTA', 'Resuelta');
  await salir(page);

  await entrar(page, 'SUPERVISOR');
  await abrir(page, asunto);
  await cambiarEstado(page, 'CERRADA', 'Cerrada');
  await expect(page.locator('.historial li')).toHaveCount(8);
  await expect(page.getByText(comentario, { exact: true })).toBeVisible();
  await salir(page);

  await entrar(page, 'ADMIN');
  await page.getByRole('link', { name: 'Administración', exact: true }).click();
  await page.getByRole('button', { name: 'Categorías', exact: true }).click();
  await expect(page.locator('.admin-registros form').first()).toBeVisible();
  await salir(page);
});

test('acceso y navegación con teclado en vista móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await entrar(page, 'ESTUDIANTE');
  expect(await page.locator('html').evaluate((html) => html.scrollWidth)).toBe(390);
  const solicitudes = page.getByRole('link', { name: 'Solicitudes', exact: true });
  await solicitudes.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Solicitudes', exact: true })).toBeVisible();
  const filtro = page.getByLabel('Filtrar por categoría');
  await filtro.selectOption({ label: 'Soporte informático' });
  await page.reload();
  await expect(filtro.locator('option:checked')).toHaveText('Soporte informático');
  await salir(page);
});
