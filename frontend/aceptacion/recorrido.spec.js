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
  const mas = page.getByRole('button', { name: 'Más', exact: true });
  if (await mas.isVisible() && await mas.getAttribute('aria-expanded') === 'false') await mas.click();
  await page.getByRole('link', { name: 'Cuenta', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Iniciar sesión', exact: true })).toBeVisible();
}

async function abrir(page, asunto) {
  await page.getByRole('link', { name: 'Solicitudes', exact: true }).click();
  await page.getByRole('link', { name: new RegExp(asunto) }).click();
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
  await expect(page.getByRole('status')).toContainText('Solicitud registrada');
  await expect(page).toHaveURL(/#solicitudes\/\d+$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: asunto, exact: true })).toBeFocused();
  await page.getByRole('button', { name: /Volver a Solicitudes/ }).click();
  const buscar = page.getByRole('searchbox', { name: /Buscar solicitudes/ });
  await buscar.fill(asunto);
  await page.getByRole('link', { name: new RegExp(asunto) }).click();
  await page.getByRole('button', { name: /Volver a Solicitudes/ }).click();
  await expect(buscar).toHaveValue(asunto);
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(buscar).toHaveValue('');
  await page.getByRole('link', { name: 'Seguimiento', exact: true }).click();
  await page.getByRole('button', { name: 'Ocultar etapas vacías' }).click();
  await expect(page.getByRole('button', { name: 'Ocultar etapas vacías' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: new RegExp(asunto) }).click();
  await page.getByRole('button', { name: /Volver a Seguimiento/ }).click();
  await expect(page).toHaveURL(/#seguimiento$/);
  await page.getByRole('link', { name: 'Indicadores', exact: true }).click();
  await page.getByLabel('Periodo de registro').selectOption('7');
  await expect(page.getByRole('status')).toContainText(/\d+ solicitudes en el periodo/);
  await salir(page);

  await entrar(page, 'SUPERVISOR');
  await abrir(page, asunto);
  await expect(page.getByLabel('Estado', { exact: true })).toHaveValue('REGISTRADA');
  await expect(page.getByRole('button', { name: 'Guardar cambios', exact: true })).toBeDisabled();
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
  await page.getByLabel('Filtrar por rol').selectOption('TECNICO');
  await expect(page.locator('.admin-registros .identidad').first()).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar en usuarios' }).fill('técnico de prueba');
  await expect(page.locator('.admin-registros .identidad')).toHaveCount(1);
  await page.getByRole('button', { name: 'Categorías', exact: true }).click();
  await expect(page.locator('.admin-registros > form').first()).toBeVisible();
  await salir(page);
});

test('el acceso valida el dominio en su campo y ofrece recuperar enlaces', async ({ page }) => {
  await page.goto('/');
  const correo = page.getByLabel('Correo institucional', { exact: true });
  await correo.fill('alumno@example.com');
  await page.locator('#clave').fill('ClaveDeEvaluacion23');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(correo).toHaveAttribute('aria-invalid', 'true');
  await expect(correo).toBeFocused();
  await expect(page.getByRole('alert')).toContainText('unmsm.edu.pe');
  await page.goto('/#cuenta?restablecer=invalido');
  await expect(page.getByRole('heading', { name: 'Nueva contraseña' })).toBeFocused();
  await page.getByRole('link', { name: 'Solicitar otro enlace' }).click();
  await expect(page.getByRole('heading', { name: 'Recuperar contraseña' })).toBeVisible();
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

test.use({ hasTouch: true });

test('la barra móvil es fija y Más muestra las secciones del rol', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 750 });
  await entrar(page, 'ADMIN');
  const menu = page.getByRole('navigation', { name: 'Secciones principales' });
  const area = await menu.boundingBox();
  const cdp = await context.newCDPSession(page);
  const y = Math.round(area.y + 30);
  const inicio = Math.round(area.x + area.width - 28);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: inicio, y }] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: inicio - i * 23, y }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  expect(await menu.evaluate(nav => nav.scrollLeft)).toBe(0);
  await expect(page).toHaveURL(/#inicio$/);
  expect(await page.locator('html').evaluate(html => html.scrollWidth)).toBe(320);

  const mas = menu.getByRole('button', { name: 'Más', exact: true });
  const opciones = menu.getByRole('group', { name: 'Más opciones' });
  await expect(mas).toBeInViewport({ ratio: 0.95 });
  await expect(opciones).toBeHidden();
  await mas.tap();
  await expect(mas).toHaveAttribute('aria-expanded', 'true');
  await expect(opciones.getByRole('link')).toHaveText(['Indicadores', 'Administración', 'Cuenta']);
  await page.keyboard.press('Tab');
  await expect(opciones.getByRole('link', { name: 'Indicadores' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(mas).toBeFocused();
  await expect(opciones).toBeHidden();
  await mas.tap();
  const administracion = opciones.getByRole('link', { name: 'Administración', exact: true });
  await administracion.tap();
  await expect(page.getByRole('heading', { name: 'Administración', exact: true })).toBeVisible();
  await expect(mas).toHaveAttribute('data-activo', 'true');
  await expect(opciones).toBeHidden();
  await mas.tap();
  await page.getByRole('heading', { name: 'Administración', exact: true }).tap();
  await expect(opciones).toBeHidden();
  await salir(page);
  await entrar(page, 'ESTUDIANTE');
  await mas.tap();
  await expect(opciones.getByRole('link')).toHaveText(['Indicadores', 'Cuenta']);
  await salir(page);
});

test('los cambios de pantalla animan el contenido y respetan el movimiento reducido', async ({ page }) => {
  await page.addInitScript(() => {
    window.transicionesDeVista = [];
    const animar = Element.prototype.animate;
    Element.prototype.animate = function (fotogramas, opciones) {
      window.transicionesDeVista.push({ elemento: this.tagName, dentroDeMain: Boolean(this.closest('main')),
        duracion: opciones.duration });
      return animar.call(this, fotogramas, opciones);
    };
  });
  await entrar(page, 'ESTUDIANTE');
  await page.evaluate(() => { window.transicionesDeVista.length = 0; });
  await page.getByRole('link', { name: 'Solicitudes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Solicitudes', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.transicionesDeVista)).toEqual([
    { elemento: 'DIV', dentroDeMain: true, duracion: 250 },
  ]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => { window.transicionesDeVista.length = 0; });
  await page.getByRole('link', { name: 'Seguimiento', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Seguimiento', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.transicionesDeVista)).toEqual([]);
  await salir(page);
});
