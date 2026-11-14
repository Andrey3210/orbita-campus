import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const origen = new URL(process.env.API_PRUEBAS ?? 'http://127.0.0.1:8080');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(origen.hostname)) {
  throw new Error('Ejecuta carga y estrés en una instancia aislada de loopback.');
}
const base = origen.origin;
const correo = process.env.QA_ADMIN_EMAIL;
const clave = process.env.QA_ADMIN_PASSWORD;
if (!correo || !clave) throw new Error('Configura las credenciales efímeras QA_ADMIN_EMAIL y QA_ADMIN_PASSWORD.');
const salida = process.env.QA_RENDIMIENTO ?? 'evidencia-rendimiento.json';
const etapas = [
  { nombre: 'calentamiento', concurrencia: 2, segundos: 3 },
  { nombre: 'carga', concurrencia: 10, segundos: 10 },
  { nombre: 'estrés inicial', concurrencia: 30, segundos: 10 },
  { nombre: 'estrés máximo', concurrencia: 60, segundos: 10 },
  { nombre: 'recuperación', concurrencia: 2, segundos: 5 },
];
const rutas = ['/api/catalogos', '/api/solicitudes', '/actuator/health'];
const inicio = new Date().toISOString();
const id = randomUUID().slice(0, 8);

const login = await fetch(base + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ correo, clave }), signal: AbortSignal.timeout(8000),
});
if (!login.ok) throw new Error(`No se obtuvo la sesión de evaluación: HTTP ${login.status}.`);
const { token } = await login.json();
const headers = { Authorization: 'Bearer ' + token };
const informe = [];

try {
  for (const etapa of etapas) {
    const latencias = [];
    const http = {};
    const comienzo = performance.now();
    const hasta = comienzo + etapa.segundos * 1000;
    await Promise.all(Array.from({ length: etapa.concurrencia }, async (_, trabajador) => {
      let turno = trabajador;
      while (performance.now() < hasta) {
        const t0 = performance.now();
        let resultado;
        try {
          const respuesta = await fetch(base + rutas[turno++ % rutas.length], { headers, signal: AbortSignal.timeout(5000) });
          await respuesta.arrayBuffer();
          resultado = String(respuesta.status);
        } catch {
          resultado = 'sin_respuesta';
        }
        latencias.push(performance.now() - t0);
        http[resultado] = (http[resultado] ?? 0) + 1;
      }
    }));
    const segundos = (performance.now() - comienzo) / 1000;
    latencias.sort((a, b) => a - b);
    const percentil = (fraccion) => Math.round(latencias[Math.ceil(latencias.length * fraccion) - 1]);
    const datos = {
      ...etapa, peticiones: latencias.length, rps: Number((latencias.length / segundos).toFixed(1)),
      p50Ms: percentil(0.5), p95Ms: percentil(0.95), p99Ms: percentil(0.99),
      errorPct: Number(((1 - (http['200'] ?? 0) / latencias.length) * 100).toFixed(2)), http,
    };
    informe.push(datos);
    console.log(JSON.stringify(datos));
  }
} finally {
  await fetch(base + '/api/auth/salir', { method: 'POST', headers, signal: AbortSignal.timeout(8000) })
    .catch(() => console.warn('No se pudo cerrar la sesión efímera.'));
  await writeFile(salida, JSON.stringify({ id, inicio, entorno: 'aislado', rutas, etapas: informe }, null, 2));
}

const carga = informe.find((e) => e.nombre === 'carga');
const recuperacion = informe.at(-1);
if (carga.p95Ms > 750 || carga.errorPct > 1 || recuperacion.p95Ms > 750 || recuperacion.errorPct > 1) {
  console.error('La carga normal o la recuperación excedieron el objetivo de p95 ≤ 750 ms y errores ≤ 1 %.');
  process.exitCode = 1;
}
