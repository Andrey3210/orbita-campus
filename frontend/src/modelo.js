export const estados = [
  ['REGISTRADA', 'Registrada'], ['EVALUACION', 'En evaluación'], ['ASIGNADA', 'Asignada'],
  ['ATENCION', 'En atención'], ['RESUELTA', 'Resuelta'], ['CERRADA', 'Cerrada'],
];
export const prioridades = [
  ['BAJA', 'Baja', 96], ['MEDIA', 'Media', 72], ['ALTA', 'Alta', 24], ['URGENTE', 'Urgente', 4],
];
export const roles = {
  ESTUDIANTE: 'Estudiante', TECNICO: 'Técnico', SUPERVISOR: 'Supervisor', ADMIN: 'Administrador',
};
export const correoInstitucional = /^[a-z0-9_+%-]+(?:\.[a-z0-9_+%-]+)*@unmsm\.edu\.pe$/i;
export function correoValido(email) {
  const direccion = email.trim();
  return correoInstitucional.test(direccion) && direccion.indexOf('@') <= 64;
}

export function proximo(estado, rol) {
  if (rol === 'ADMIN' || rol === 'SUPERVISOR') {
    return { REGISTRADA: 'EVALUACION', EVALUACION: 'ASIGNADA', RESUELTA: 'CERRADA' }[estado];
  }
  if (rol === 'TECNICO') return { ASIGNADA: 'ATENCION', ATENCION: 'RESUELTA' }[estado];
}

export function vencida(solicitud, ahora) {
  return !solicitud.resuelta && !['RESUELTA', 'CERRADA'].includes(solicitud.estado) && Date.parse(solicitud.vence) < ahora;
}

export function indicadores(solicitudes, ahora = Date.now()) {
  const resueltas = solicitudes.filter((s) => ['RESUELTA', 'CERRADA'].includes(s.estado));
  const tiempos = resueltas.filter((s) => s.resuelta).map((s) => Date.parse(s.resuelta) - Date.parse(s.creada));
  return {
    total: solicitudes.length,
    resueltas: resueltas.length,
    abiertas: solicitudes.length - resueltas.length,
    vencidas: solicitudes.filter((s) => vencida(s, ahora)).length,
    tasa: solicitudes.length ? Math.round(resueltas.length / solicitudes.length * 100) : 0,
    promedio: tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length / 3600000 : null,
  };
}

export function agrupar(solicitudes, campo) {
  const totales = new Map();
  for (const solicitud of solicitudes) {
    const clave = solicitud[campo] || 'Sin asignar';
    totales.set(clave, (totales.get(clave) ?? 0) + 1);
  }
  return [...totales].sort(([a, cantidadA], [b, cantidadB]) => cantidadB - cantidadA || a.localeCompare(b, 'es'));
}

export function normalizar(valor) {
  return valor.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
}
