import { demo } from './demo.js';

const base = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? '';
export const modoDemo = !base && !import.meta.env.DEV;

export async function peticion(ruta, { metodo = 'GET', cuerpo, sesion } = {}) {
  if (modoDemo) {
    if (ruta.startsWith('/auth/') || !sesion?.perfil) {
      throw new Error('El acceso institucional en línea está pendiente de conexión.');
    }
    return demo(ruta, metodo, cuerpo, sesion.perfil);
  }
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
    throw Object.assign(new Error(datos.mensaje ?? 'La solicitud no pudo completarse.'), { estado: respuesta.status });
  }
  return [202, 204].includes(respuesta.status) || respuesta.headers.get('content-length') === '0'
    ? undefined
    : respuesta.json().catch((error) => {
      if (respuesta.status === 201 && error instanceof SyntaxError) return undefined;
      throw error;
    });
}
