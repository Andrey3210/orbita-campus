import { appendFile, writeFile } from 'node:fs/promises';

const api = process.env.API_PUBLICA;
if (!api || new URL(api).protocol !== 'https:') throw new Error('Configura API_PUBLICA con una URL HTTPS.');

const portal = process.env.PORTAL_PUBLICO ?? 'https://andrey3210.github.io/orbita-campus/';
const destinos = [
  ['Portal', new URL(portal), async (r) => (await r.text()).includes('Órbita Campus')],
  ['API y base de datos', new URL('/actuator/health', api), async (r) => (await r.json()).status === 'UP'],
];

const resultados = await Promise.all(destinos.map(async ([servicio, url, validar]) => {
  const intentos = [];
  for (let intento = 0; intento < 3; intento++) {
    const inicio = performance.now();
    try {
      const respuesta = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'error' });
      const correcto = respuesta.ok && await validar(respuesta);
      intentos.push({ http: respuesta.status, ms: Math.round(performance.now() - inicio), correcto });
      if (correcto) break;
    } catch (error) {
      intentos.push({ http: null, ms: Math.round(performance.now() - inicio), correcto: false, error: error.name });
    }
    if (intento < 2) await new Promise((resolver) => setTimeout(resolver, 2000));
  }
  return { servicio, url: url.href, intentos, disponible: intentos.at(-1).correcto };
}));

await writeFile('evidencia-monitoreo.json', JSON.stringify({ fecha: new Date().toISOString(), resultados }, null, 2));
const filas = resultados.map((r) =>
  `| ${r.servicio} | ${r.disponible ? 'Disponible' : 'Incidente'} | ${r.intentos.length} | ${r.intentos.at(-1).ms} ms |`);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, [
    '## Disponibilidad', '', '| Servicio | Resultado | Intentos | Última respuesta |',
    '| --- | --- | ---: | ---: |', ...filas, '',
  ].join('\n'));
}
for (const r of resultados) {
  if (!r.disponible) console.error(`::error title=Incidente de disponibilidad::${r.servicio} falló tres comprobaciones consecutivas.`);
  else console.log(`${r.servicio} disponible en ${r.intentos.at(-1).ms} ms.`);
}
if (resultados.some((r) => !r.disponible)) process.exitCode = 1;
