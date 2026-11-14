const configurada = import.meta.env.VITE_API_URL?.trim() ?? '';
const base = configurada.replace(/\/$/, '');
export const accesoDisponible = Boolean(configurada || import.meta.env.DEV);

export async function peticion(ruta, { metodo = 'GET', cuerpo, sesion } = {}) {
  if (!accesoDisponible) throw new Error('El servicio de acceso aún no está conectado a esta página.');
  let respuesta;
  try {
    respuesta = await fetch(base + '/api' + ruta, {
      method: metodo,
      headers: {
        ...(sesion?.token && { Authorization: 'Bearer ' + sesion.token }),
        ...(cuerpo && { 'Content-Type': 'application/json' }),
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new Error('No se pudo conectar con el servicio. Vuelve a intentar.');
  }
  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => ({}));
    const referencia = respuesta.headers.get('X-Request-Id');
    const mensaje = datos.mensaje ?? 'La solicitud no pudo completarse.';
    const detalle = respuesta.status >= 500 && referencia ? mensaje + ' Referencia para soporte: ' + referencia : mensaje;
    throw Object.assign(new Error(detalle), { estado: respuesta.status });
  }
  return [202, 204].includes(respuesta.status) || respuesta.headers.get('content-length') === '0'
    ? undefined
    : respuesta.json().catch((error) => {
      if (respuesta.status === 201 && error instanceof SyntaxError) return undefined;
      throw error;
    });
}
