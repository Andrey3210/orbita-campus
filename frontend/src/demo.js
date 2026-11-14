import { estados, prioridades, proximo } from './modelo.js';

const clave = 'orbita-campus-demo-v1';
export const perfiles = [
  ['ESTUDIANTE', 'Alex Demo'], ['TECNICO', 'Sofía Demo'], ['SUPERVISOR', 'Marco Demo'], ['ADMIN', 'Valeria Demo'],
].map(([rol, nombre], i) => ({ rol, nombre, id: i + 1, correo: 'demo.' + rol.toLowerCase() + '@unmsm.edu.pe', activo: true, verificado: true }));

const categorias = [
  [1, 'Mantenimiento', 'Infraestructura'], [2, 'Soporte informático', 'Soporte TI'],
  [3, 'Trámite administrativo', 'Secretaría académica'], [4, 'Reserva de ambientes', 'Servicios generales'],
].map(([id, nombre, area]) => ({ id, nombre, areaId: id, area, activo: true }));

function inicial() {
  const hora = 3600000;
  const ahora = Date.now();
  const ejemplos = [
    ['Proyector sin señal en el aula 301', 2, 'ATENCION', 'ALTA', 14],
    ['Reserva del laboratorio para práctica', 4, 'EVALUACION', 'MEDIA', 25],
    ['Luminaria del pasillo intermitente', 1, 'ASIGNADA', 'MEDIA', 43],
    ['Constancia para trámite académico', 3, 'REGISTRADA', 'MEDIA', 50],
    ['Red inalámbrica en la biblioteca', 2, 'RESUELTA', 'URGENTE', 67],
    ['Revisión del tomacorriente del aula 204', 1, 'CERRADA', 'BAJA', 94],
    ['Cambio de turno en laboratorio', 3, 'REGISTRADA', 'MEDIA', 79],
    ['Apoyo con el equipo de videollamada', 2, 'RESUELTA', 'ALTA', 130],
    ['Mesa inestable en sala de estudio', 1, 'CERRADA', 'BAJA', 145],
  ];
  return {
    usuarios: perfiles, categorias,
    areas: categorias.map(({ id, area }) => ({ id, nombre: area })),
    estados: estados.map(([clave, nombre]) => ({ clave, nombre })),
    prioridades: prioridades.map(([clave, nombre, horas]) => ({ clave, nombre, horas })),
    solicitudes: ejemplos.map(([titulo, categoriaId, estado, prioridad, antiguedad], i) => {
      const id = 109 - i;
      const creada = new Date(ahora - antiguedad * hora).toISOString();
      const tieneResponsable = !['REGISTRADA', 'EVALUACION'].includes(estado);
      return {
        id, codigo: 'SOL-' + String(id).padStart(4, '0'), titulo, usuarioId: 1,
        usuario: perfiles[0].nombre, categoriaId, categoria: categorias[categoriaId - 1].nombre,
        responsableId: tieneResponsable ? 2 : null, responsable: tieneResponsable ? perfiles[1].nombre : null,
        descripcion: 'Solicitud de ejemplo para recorrer el flujo de atención de servicios universitarios.',
        ubicacion: 'Ciudad Universitaria', evidencia: null, estado, prioridad, creada,
        vence: new Date(Date.parse(creada) + prioridades.find(([clave]) => clave === prioridad)[2] * hora).toISOString(),
        resuelta: ['RESUELTA', 'CERRADA'].includes(estado) ? new Date(Date.parse(creada) + 3 * hora).toISOString() : null,
        version: 0, actividad: [{ autor: perfiles[0].nombre, tipo: 'ESTADO', mensaje: 'Se registró la solicitud.', fecha: creada }],
      };
    }),
    siguiente: 110,
  };
}

function leer() {
  const guardado = localStorage.getItem(clave);
  if (guardado) return JSON.parse(guardado);
  const datos = inicial();
  localStorage.setItem(clave, JSON.stringify(datos));
  return datos;
}

function error(mensaje, estado = 400) {
  throw Object.assign(new Error(mensaje), { estado });
}

export async function demo(ruta, metodo, cuerpo, perfil) {
  if (ruta === '/auth/salir') return;
  const datos = leer();
  perfil = datos.usuarios.find((u) => u.id === perfil?.id && u.activo);
  if (!perfil) error('Selecciona un perfil de la demostración.', 401);
  const guardar = () => localStorage.setItem(clave, JSON.stringify(datos));
  const supervisor = ['ADMIN', 'SUPERVISOR'].includes(perfil.rol);
  const acceso = (s) => supervisor || (perfil.rol === 'ESTUDIANTE' ? s.usuarioId === perfil.id : s.responsableId === perfil.id);
  const catalogo = { categorias: datos.categorias.filter((c) => c.activo), estados: datos.estados, prioridades: datos.prioridades };
  if (ruta === '/auth/perfil') return perfil;
  if (ruta === '/catalogos') return catalogo;
  if (ruta === '/tecnicos' && supervisor) return datos.usuarios.filter((u) => u.activo && u.rol === 'TECNICO');
  if (ruta.startsWith('/admin')) {
    if (perfil.rol !== 'ADMIN') error('Tu rol no permite esta acción.', 403);
    if (ruta === '/admin') return { ...datos, roles: perfiles.map((p) => p.rol) };
    const [, , recurso, id] = ruta.split('/');
    const lista = datos[recurso];
    const fila = lista.find((a) => String(a.id ?? a.clave) === id);
    if (metodo === 'PUT' && !fila) error('El registro no existe.', 404);
    if (recurso === 'usuarios') {
      if (fila.id === perfil.id) error('Tu cuenta administradora no se puede modificar aquí.');
      if (fila.rol === 'TECNICO' && (cuerpo.rol !== 'TECNICO' || !cuerpo.activo)
          && datos.solicitudes.some((s) => s.responsableId === fila.id && ['ASIGNADA', 'ATENCION'].includes(s.estado))) {
        error('Reasigna primero las solicitudes activas del técnico.', 409);
      }
    }
    if (['areas', 'categorias'].includes(recurso) && lista.some((item) => item !== fila && item.nombre.toLowerCase() === cuerpo.nombre.toLowerCase())) {
      error('El nombre ya existe.', 409);
    }
    if (recurso === 'categorias') cuerpo.area = datos.areas.find((a) => a.id === cuerpo.areaId).nombre;
    if (fila) Object.assign(fila, cuerpo);
    else lista.push({ ...cuerpo, id: Math.max(0, ...lista.map((a) => a.id)) + 1 });
    if (recurso === 'categorias' && fila) datos.solicitudes.filter((s) => s.categoriaId === fila.id).forEach((s) => { s.categoria = fila.nombre; });
    if (recurso === 'areas' && fila) datos.categorias.filter((c) => c.areaId === fila.id).forEach((c) => { c.area = fila.nombre; });
    guardar();
    return;
  }
  if (ruta === '/solicitudes' && metodo === 'GET') return datos.solicitudes.filter(acceso);
  const ahora = new Date();
  const evento = (tipo, mensaje) => ({ tipo, mensaje, autor: perfil.nombre, fecha: ahora.toISOString() });
  if (ruta === '/solicitudes' && metodo === 'POST') {
    if (perfil.rol !== 'ESTUDIANTE') error('El registro corresponde al perfil estudiante.', 403);
    const categoria = catalogo.categorias.find((c) => c.id === cuerpo.categoriaId);
    if (!categoria) error('Selecciona una categoría activa.');
    const id = datos.siguiente++;
    const solicitud = {
      ...cuerpo, id, codigo: 'SOL-' + String(id).padStart(4, '0'), usuarioId: perfil.id, usuario: perfil.nombre,
      categoria: categoria.nombre, estado: 'REGISTRADA', prioridad: 'MEDIA', creada: ahora.toISOString(),
      vence: new Date(+ahora + datos.prioridades.find((p) => p.clave === 'MEDIA').horas * 3600000).toISOString(),
      resuelta: null, responsableId: null, responsable: null, version: 0,
      actividad: [evento('ESTADO', 'Se registró la solicitud.')],
    };
    datos.solicitudes.unshift(solicitud);
    guardar();
    return { solicitud, actividad: solicitud.actividad };
  }
  const [, recurso, id, accion] = ruta.split('/');
  if (recurso !== 'solicitudes') error('Ruta no disponible.', 404);
  const solicitud = datos.solicitudes.find((s) => s.id === Number(id) && acceso(s));
  if (!solicitud) error('La solicitud no existe.', 404);
  if (metodo === 'DELETE') {
    if (perfil.rol !== 'ESTUDIANTE' || solicitud.estado !== 'REGISTRADA') error('Solo puedes retirar solicitudes recién registradas.', 409);
    datos.solicitudes = datos.solicitudes.filter((s) => s !== solicitud);
    guardar();
    return;
  }
  if (accion === 'comentarios' && metodo === 'POST') {
    if (solicitud.estado === 'CERRADA') error('La solicitud está cerrada.', 409);
    solicitud.actividad.push(evento('COMENTARIO', cuerpo.mensaje));
    solicitud.version++;
    guardar();
  }
  if (metodo === 'PUT') {
    if (cuerpo.version !== solicitud.version) error('La solicitud cambió. Actualiza la pantalla.', 409);
    if (cuerpo.estado === solicitud.estado ? !supervisor || ['RESUELTA', 'CERRADA'].includes(solicitud.estado)
      : proximo(solicitud.estado, perfil.rol) !== cuerpo.estado) error('Tu rol no permite ese cambio.', 403);
    const persona = datos.usuarios.find((u) => u.id === (cuerpo.responsableId ?? solicitud.responsableId) && u.activo && u.rol === 'TECNICO');
    if (['ASIGNADA', 'ATENCION', 'RESUELTA'].includes(cuerpo.estado) && !persona) error('Selecciona un técnico activo.');
    if (cuerpo.prioridad && cuerpo.prioridad !== solicitud.prioridad) {
      solicitud.prioridad = cuerpo.prioridad;
      const horas = datos.prioridades.find((p) => p.clave === cuerpo.prioridad).horas;
      solicitud.vence = new Date(Date.parse(solicitud.creada) + horas * 3600000).toISOString();
    }
    solicitud.estado = cuerpo.estado;
    solicitud.responsableId = persona?.id ?? solicitud.responsableId;
    solicitud.responsable = persona?.nombre ?? solicitud.responsable;
    if (cuerpo.estado === 'RESUELTA') solicitud.resuelta = ahora.toISOString();
    solicitud.actividad.push(evento('ESTADO', 'Estado: ' + datos.estados.find((e) => e.clave === cuerpo.estado).nombre + '.'));
    solicitud.version++;
    guardar();
  }
  return { solicitud, actividad: solicitud.actividad };
}
