import test from 'node:test';
import assert from 'node:assert/strict';
import { agrupar, correoValido, indicadores, normalizar, proximo } from './modelo.js';

test('admite solo direcciones válidas con el dominio exacto de la UNMSM', () => {
  assert.equal(correoValido('Ejemplo@UNMSM.EDU.PE'), true);
  for (const correo of ['ejemplo', 'x@gmail.com', 'x@unmsm.edu.pe.ejemplo.com', 'x@facultad.unmsm.edu.pe', 'x..y@unmsm.edu.pe']) {
    assert.equal(correoValido(correo), false, correo);
  }
});

test('restringe transiciones por rol', () => {
  assert.equal(proximo('EVALUACION','SUPERVISOR'), 'ASIGNADA');
  assert.equal(proximo('ASIGNADA','TECNICO'), 'ATENCION');
  assert.equal(proximo('ASIGNADA','ESTUDIANTE'), undefined);
  assert.equal(proximo('CERRADA','ADMIN'), undefined);
});

test('calcula pendientes, vencimientos y tiempo promedio a partir de datos reales', () => {
  const creada = '2026-11-14T00:00:00Z';
  const vence = '2026-11-14T04:00:00Z';
  const solicitudes = [
    { estado:'ATENCION', creada, vence, prioridad:'ALTA' },
    { estado:'CERRADA', creada, vence, prioridad:'BAJA', resuelta:'2026-11-14T02:00:00Z' },
  ];
  assert.deepEqual(indicadores(solicitudes, Date.parse('2026-11-14T05:00:00Z')),
    { total:2, resueltas:1, abiertas:1, vencidas:1, tasa:50, promedio:2 });
  assert.deepEqual(agrupar(solicitudes,'prioridad'), [['ALTA',1],['BAJA',1]]);
  assert.equal(normalizar(' Evaluación '), 'evaluacion');
});
