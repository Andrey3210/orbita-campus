import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const api = new URL(process.env.API_PRUEBAS ?? 'http://127.0.0.1:8080');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(api.hostname)) throw new Error('Usa una API aislada de loopback.');
const resultados = [];
const tipoJson = { 'Content-Type': 'application/json' };
const post = (datos, adicionales = {}) => ({
  method: 'POST', headers: { ...tipoJson, ...adicionales }, body: JSON.stringify(datos),
});

async function comprobar(caso, ruta, estado, opciones = {}, validar = () => {}) {
  try {
    const respuesta = await fetch(new URL(ruta, api), {
      redirect: 'manual', signal: AbortSignal.timeout(8000), ...opciones,
    });
    try {
      assert.equal(respuesta.status, estado);
      await validar(respuesta);
      resultados.push({ caso, esperado: estado, observado: respuesta.status, pasa: true });
    } catch (error) {
      resultados.push({ caso, esperado: estado, observado: respuesta.status, pasa: false, error: error.message });
    } finally {
      await respuesta.body?.cancel().catch(() => {});
    }
  } catch (error) {
    resultados.push({ caso, esperado: estado, observado: null, pasa: false, error: error.name });
  }
}

const destino = '/api/auth/login';
const preflight = (origin) => ({ method: 'OPTIONS', headers: {
  Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type',
} });
await comprobar('Ruta ajena al gateway', '/ruta-oculta', 404);
await comprobar('Solicitud sin JWT', '/api/solicitudes', 401);
await comprobar('Métricas sin sesión', '/actuator/metrics', 401);
await comprobar('JWT manipulado', '/api/auth/perfil', 401, { headers: { Authorization: 'Bearer falso.invalido.invalido' } });
await comprobar('Consulta previa desde Pages', destino, 200, preflight('https://andrey3210.github.io'), (r) => {
  assert.equal(r.headers.get('access-control-allow-origin'), 'https://andrey3210.github.io');
});
await comprobar('Origen externo bloqueado', destino, 403, preflight('https://otro.example.invalid'), (r) => {
  assert.equal(r.headers.get('access-control-allow-origin'), null);
});
await comprobar('Dominio institucional suplantado', destino, 400, post({ correo: 'a@unmsm.edu.pe.example.invalid', clave: 'TextoSintetico123' }));
await comprobar('Inyección SQL en el correo', destino, 400, post({ correo: "a' OR '1'='1@unmsm.edu.pe", clave: 'TextoSintetico123' }));
await comprobar('JSON malformado', destino, 400, { method: 'POST', headers: tipoJson, body: '{' });
await comprobar('Se rechaza cuerpo superior a 64 KB', destino, 413,
  { ...post({ correo: 'nadie@unmsm.edu.pe', clave: 'x'.repeat(70000) }), headers: { ...tipoJson, Connection: 'close' } });
await comprobar('Cabeceras defensivas y referencia en salud', '/actuator/health', 200, {}, async (r) => {
  assert.match(r.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.match(r.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/i);
  assert.equal((await r.json()).status, 'UP');
});

const correo = 'orbita.campus.g7.estudiante@unmsm.edu.pe';
const clave = process.env.PRUEBA_ESTUDIANTE_PASSWORD;
let token;
if (!clave) throw new Error('Configura la contraseña efímera de estudiante.');
await comprobar('Acceso de estudiante verificado', destino, 200, post({ correo, clave }), async (r) => {
  const sesion = await r.json();
  assert.equal(sesion.perfil.rol, 'ESTUDIANTE');
  assert.equal(sesion.perfil.verificado, true);
  assert.ok(sesion.token);
  token = sesion.token;
});
if (token) {
  const headers = { Authorization: 'Bearer ' + token };
  await comprobar('Escalada a administración denegada', '/api/admin', 403, { headers });
  await comprobar('Métricas reservadas a administradores', '/actuator/metrics', 403, { headers });
  await comprobar('Revocación de token', '/api/auth/salir', 204, { method: 'POST', headers });
  await comprobar('Token revocado rechazado', '/api/auth/perfil', 401, { headers });
}

await writeFile(process.env.QA_DAST ?? 'evidencia-dast.json', JSON.stringify({
  fecha: new Date().toISOString(), alcance: 'Caja negra contra Caddy y Spring Boot aislados', resultados,
}, null, 2));
console.table(resultados);
if (resultados.some((r) => !r.pasa)) process.exitCode = 1;
