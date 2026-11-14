import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { modoDemo, peticion } from './api.js';
import { perfiles } from './demo.js';
import { agrupar, correoValido, indicadores, normalizar, proximo, roles, vencida } from './modelo.js';
import { Administracion } from './administracion.jsx';
import './estilos.css';

const pestañas = [
  ['inicio', 'Inicio', '⌂'], ['solicitudes', 'Solicitudes', '☷'],
  ['seguimiento', 'Seguimiento', '◷'], ['estadisticas', 'Indicadores', '◒'],
  ['admin', 'Administración', '⚙'], ['cuenta', 'Cuenta', '↗'],
];
const f = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
const fecha = (valor) => f.format(new Date(valor));
const recurso = (ruta) => import.meta.env.BASE_URL + ruta;
const claveSesion = 'orbita-campus-sesion';

function leerSesion() {
  try { return JSON.parse(sessionStorage.getItem(claveSesion)); } catch { return null; }
}

function fragmento() {
  return location.hash.slice(1);
}

function Aviso({ error, cargando }) {
  if (error) return <p className="aviso error" role="alert">{error}</p>;
  if (cargando) return <p className="aviso" role="status">Cargando datos…</p>;
  return null;
}

function Cuenta({ sesion, onSesion, avisar }) {
  const [modo, setModo] = useState('login');
  const [ocupado, setOcupado] = useState(false);
  const token = new URLSearchParams(location.hash.split('?')[1]).get('verificar');
  const [confirmado, setConfirmado] = useState(false);

  async function confirmar() {
    setOcupado(true);
    try {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('El enlace de verificación es inválido.');
      await peticion('/auth/verificar', { metodo: 'POST', cuerpo: { token } });
      history.replaceState(null, '', '#cuenta');
      setConfirmado(true);
      avisar('');
    } catch (error) { avisar(error.message); }
    finally { setOcupado(false); }
  }

  async function enviar(evento) {
    evento.preventDefault();
    const datos = Object.fromEntries(new FormData(evento.currentTarget));
    if (!correoValido(datos.correo)) return avisar('Escribe un correo válido como ejemplo@unmsm.edu.pe.');
    datos.correo = datos.correo.trim().toLowerCase();
    if (modo === 'registro' && (!/\p{L}/u.test(datos.clave) || !/\p{N}/u.test(datos.clave)
        || new TextEncoder().encode(datos.clave).length > 72)) {
      return avisar('La contraseña necesita al menos una letra, un número y hasta 72 bytes.');
    }
    setOcupado(true);
    try {
      const respuesta = await peticion('/auth/' + modo, { metodo: 'POST', cuerpo: datos });
      avisar('');
      if (modo === 'login') {
        onSesion(respuesta);
        location.hash = 'inicio';
      } else {
        setModo('login');
        setConfirmado('Si corresponde, recibirás un enlace de verificación en tu correo.');
      }
    } catch (error) { avisar(error.message); }
    finally { setOcupado(false); }
  }

  async function salir() {
    setOcupado(true);
    try {
      await peticion('/auth/salir', { metodo: 'POST', sesion });
      onSesion(null);
      avisar('');
    } catch (error) { avisar(error.message); }
    finally { setOcupado(false); }
  }

  if (modoDemo) return <section className="panel cuenta">
    <h2>Perfiles de demostración</h2>
    <p>Los cambios de esta sesión se guardan en el navegador. El sistema real valida el correo institucional y los permisos en la API.</p>
    <div className="perfiles">{perfiles.map((perfil) => <button className="perfil" key={perfil.id}
      aria-pressed={sesion?.perfil.id === perfil.id} type="button"
      onClick={() => { onSesion({ perfil }); location.hash = 'inicio'; }}>
      <strong>{roles[perfil.rol]}</strong><span>{perfil.nombre}</span>
    </button>)}</div>
    <a className="enlace" href="https://github.com/Andrey3210/orbita-campus#ejecutar-con-mysql">Ejecutar con la API →</a>
  </section>;

  if (token) return <section className="panel cuenta">
    <h2>Verifica tu correo institucional</h2>
    <p>Confirma esta dirección antes de iniciar sesión.</p>
    <button className="primario" disabled={ocupado} onClick={confirmar}>Confirmar correo</button>
  </section>;

  if (sesion) return <section className="panel cuenta">
    <h2>{sesion.perfil.nombre}</h2><p>{sesion.perfil.correo} · {roles[sesion.perfil.rol]}</p>
    <button className="secundario" disabled={ocupado} onClick={salir}>Cerrar sesión</button>
  </section>;

  const titulos = { login: 'Iniciar sesión', registro: 'Crear cuenta', reenviar: 'Reenviar verificación' };
  return <section className="panel cuenta">
    <h2>{titulos[modo]}</h2>
    <p>Usa tu correo institucional de la Universidad Nacional Mayor de San Marcos.</p>
    {confirmado && <p className="aviso" role="status">{confirmado === true ? 'Correo verificado. Ya puedes iniciar sesión.' : confirmado}</p>}
    <form key={modo} className="formulario" onSubmit={enviar}>
      {modo === 'registro' && <label>Nombre completo<input name="nombre" minLength={2} maxLength={100} required autoComplete="name" /></label>}
      <label>Correo institucional<input name="correo" type="email" maxLength={180} required
        placeholder="ejemplo@unmsm.edu.pe" autoComplete="email" onBlur={(e) => {
          const campo = e.currentTarget;
          campo.setCustomValidity(campo.value && !correoValido(campo.value) ? 'Usa un correo válido como ejemplo@unmsm.edu.pe.' : '');
        }} onInput={(e) => e.currentTarget.setCustomValidity('')} /></label>
      {modo !== 'reenviar' && <label>Contraseña<input name="clave" type="password" required maxLength={72}
        minLength={modo === 'registro' ? 12 : undefined} autoComplete={modo === 'registro' ? 'new-password' : 'current-password'} /></label>}
      <button className="primario" disabled={ocupado}>{titulos[modo]}</button>
    </form>
    <div className="acciones">
      {Object.entries(titulos).filter(([clave]) => clave !== modo).map(([clave, texto]) =>
        <button className="enlace" key={clave} onClick={() => { setModo(clave); avisar(''); }}>{texto}</button>)}
    </div>
  </section>;
}

function Estado({ dato, catalogos }) {
  return <span className={'estado ' + dato.toLowerCase()}>{catalogos.estados.find((e) => e.clave === dato)?.nombre ?? dato}</span>;
}

function Filas({ solicitudes, catalogos, seleccionar, vacio }) {
  if (!solicitudes.length) return <p className="vacio">{vacio}</p>;
  return <ul className="filas">{solicitudes.map((s) =>
    <li key={s.id}><button type="button" onClick={() => seleccionar(s.id)}>
      <span className="insignia" aria-hidden="true">↗</span>
      <span className="fila-titulo"><strong>{s.titulo}</strong><small>{s.codigo} · {s.categoria}</small></span>
      <Estado dato={s.estado} catalogos={catalogos} />
    </button></li>)}</ul>;
}

function Barras({ datos, catalogos, titulo }) {
  const maximo = Math.max(1, ...datos.map(([, cantidad]) => cantidad));
  return <section className="panel distribucion"><h2>{titulo}</h2>
    {datos.length ? <ul>{datos.map(([nombre, cantidad], i) => <li key={nombre}>
      <span>{catalogos.prioridades.find((p) => p.clave === nombre)?.nombre ?? nombre}</span>
      <span className="barra-dato"><i className={'tono-' + (i % 4)} style={{ width: (cantidad / maximo * 100) + '%' }} /></span>
      <strong>{cantidad}</strong>
    </li>)}</ul> : <p className="vacio">Todavía no hay solicitudes en este alcance.</p>}
  </section>;
}

function Inicio({ solicitudes, catalogos, seleccionar, sesion }) {
  const datos = indicadores(solicitudes);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const dia = new Date();
    dia.setDate(dia.getDate() - 6 + i);
    const ids = solicitudes.filter((s) => new Date(s.creada).toDateString() === dia.toDateString());
    return { letra: new Intl.DateTimeFormat('es-PE', { weekday: 'short' }).format(dia), total: ids.length };
  });
  const maximo = Math.max(1, ...dias.map((dia) => dia.total));
  const segmentos = agrupar(solicitudes, 'categoria');
  let angulo = 0;
  const tonos = ['#b57454', '#759a83', '#c6a349', '#9f7893'];
  const paradas = segmentos.map(([, cantidad], i) => {
    const anterior = angulo;
    angulo += cantidad / datos.total * 180;
    return tonos[i % tonos.length] + ' ' + anterior + 'deg ' + angulo + 'deg';
  });
  return <>
    <div className="titular"><div><h1>Hola{sesion ? ', ' + sesion.perfil.nombre.split(' ')[0] : ''}</h1>
      <p>Solicitudes y servicios de San Marcos</p></div><a className="primario" href={sesion ? '#solicitudes' : '#cuenta'}>
        {sesion ? 'Ver solicitudes' : 'Iniciar sesión'} <span aria-hidden="true">↗</span></a></div>
    {!sesion && <p className="aviso">Inicia sesión con tu correo institucional para consultar y registrar solicitudes.</p>}
    <div className="tablero">
      <div className="pila">
        <section className="resumen-principal"><div><strong>Solicitudes registradas</strong>
          <div className="cifra">{datos.total}</div><p>{datos.abiertas} abiertas · {datos.resueltas} atendidas</p></div>
          <img src={recurso('mascota.webp')} alt="" /></section>
        <div className="mini-grid">
          <div className="panel mini"><span className="insignia verde" aria-hidden="true">↗</span><div><small>Resolución</small><strong>{datos.tasa}%</strong></div></div>
          <div className="panel mini"><span className="insignia terracota" aria-hidden="true">◷</span><div><small>Vencidas</small><strong>{datos.vencidas}</strong></div></div>
        </div>
      </div>
      <section className="panel categorias"><h2>Por categoría</h2><div className="categorias-contenido">
        <div className="medidor" style={{ background: paradas.length
          ? 'conic-gradient(from -90deg, ' + paradas.join(',') + ', transparent 180deg 360deg)' : undefined }}>
          <span>{datos.total}</span>
        </div>
        <ul>{segmentos.slice(0, 4).map(([nombre, cantidad], i) => <li key={nombre}>
          <i style={{ background: tonos[i % tonos.length] }} /><span>{nombre}</span><strong>{cantidad}</strong>
        </li>)}</ul>
      </div><a className="enlace" href="#estadisticas">Ver indicadores →</a></section>
      <section className="panel serie"><h2>Solicitudes por día</h2><p>Últimos siete días</p>
        <div className="grafico">{dias.map((dia, i) => <div key={i} aria-label={dia.letra + ': ' + dia.total}>
          <strong>{dia.total}</strong><i style={{ height: Math.max(3, dia.total / maximo * 100) + '%' }} /><span>{dia.letra}</span>
        </div>)}</div>
      </section>
      <section className="panel recientes"><h2>Actividad reciente</h2>
        <Filas solicitudes={solicitudes.slice(0, 4)} catalogos={catalogos} seleccionar={seleccionar} vacio="Las solicitudes recientes aparecerán aquí." />
      </section>
      <section className="panel guia"><h2>Cómo funciona</h2>
        <p>Registra un pedido, sigue su atención y revisa el historial de cambios desde la misma ficha.</p>
        <a className="enlace" href="#seguimiento">Ver el flujo de atención →</a></section>
    </div>
  </>;
}

function Nueva({ catalogos, ejecutar, cerrar, ocupado }) {
  async function guardar(evento) {
    evento.preventDefault();
    const datos = Object.fromEntries(new FormData(evento.currentTarget));
    if ([['titulo', 5], ['descripcion', 10], ['ubicacion', 3]].some(([campo, minimo]) => datos[campo].trim().length < minimo)) {
      return ejecutar(() => Promise.reject(new Error('Revisa la longitud del asunto, la descripción y la ubicación.')));
    }
    if (datos.evidencia) {
      try { const url = new URL(datos.evidencia); if (url.protocol !== 'https:' || url.username || url.password) throw new Error(); }
      catch { return ejecutar(() => Promise.reject(new Error('La evidencia debe ser un enlace HTTPS válido.'))); }
    }
    if (!catalogos.categorias.some((c) => c.id === Number(datos.categoriaId))) {
      return ejecutar(() => Promise.reject(new Error('Selecciona una categoría activa.')));
    }
    const resultado = await ejecutar('/solicitudes', { metodo: 'POST',
      cuerpo: { ...datos, categoriaId: Number(datos.categoriaId), evidencia: datos.evidencia || null } });
    if (resultado) cerrar(resultado.solicitud.id);
  }
  return <section className="panel">
    <h2>Nueva solicitud</h2>
    <form className="formulario" onSubmit={guardar}>
      <label>Asunto<input required name="titulo" minLength={5} maxLength={120} placeholder="Describe el problema en una línea" /></label>
      <label>Categoría<select name="categoriaId" required defaultValue=""><option value="" disabled>Elige una categoría</option>
        {catalogos.categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
      <label>Ubicación<input name="ubicacion" required minLength={3} maxLength={150} placeholder="Facultad, pabellón o aula" /></label>
      <label>Descripción<textarea name="descripcion" required minLength={10} maxLength={2000} rows={4} /></label>
      <label>Evidencia (enlace HTTPS opcional)<input type="url" name="evidencia" maxLength={500} placeholder="https://" /></label>
      <div className="acciones"><button className="primario" disabled={ocupado}>Registrar solicitud</button>
        <button className="secundario" type="button" onClick={() => cerrar()}>Cancelar</button></div>
    </form>
  </section>;
}

function Listado({ solicitudes, catalogos, seleccionar, abrir, estudiante }) {
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState('');
  const [categoria, setCategoria] = useState('');
  const visibles = solicitudes.filter((s) => (!estado || estado === s.estado) && (!categoria || Number(categoria) === s.categoriaId)
    && normalizar(s.titulo + ' ' + s.codigo + ' ' + s.ubicacion).includes(normalizar(texto)));
  return <>
    <div className="titular"><div><h1>Solicitudes</h1><p>Consulta el estado, el responsable y el historial de cada pedido.</p></div>
      {estudiante && <button className="primario" onClick={abrir}>+ Nueva solicitud</button>}</div>
    <section className="panel">
      <div className="filtros">
        <input aria-label="Buscar solicitudes" type="search" placeholder="Buscar por asunto, código o ubicación" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <select aria-label="Filtrar por estado" value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos los estados</option>
          {catalogos.estados.map((e) => <option key={e.clave} value={e.clave}>{e.nombre}</option>)}</select>
        <select aria-label="Filtrar por categoría" value={categoria} onChange={(e) => setCategoria(e.target.value)}><option value="">Todas las categorías</option>
          {catalogos.categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
      </div>
      <p className="cantidad">{visibles.length} de {solicitudes.length} solicitudes</p>
      <Filas solicitudes={visibles} catalogos={catalogos} seleccionar={seleccionar} vacio={solicitudes.length ? 'No hay coincidencias con esos filtros.' : 'Aún no hay solicitudes para este perfil.'} />
    </section>
  </>;
}

function Detalle({ detalle, catalogos, tecnicos, sesion, ocupado, ejecutar, cambiar, cerrar }) {
  const { solicitud: s, actividad } = detalle;
  const rol = sesion.perfil.rol;
  const supervisor = ['ADMIN', 'SUPERVISOR'].includes(rol);
  const siguiente = proximo(s.estado, rol);
  const abierta = !['RESUELTA', 'CERRADA'].includes(s.estado);
  const [destino, setDestino] = useState(siguiente ?? s.estado);
  const asignar = supervisor && ['ASIGNADA', 'ATENCION'].includes(destino);
  const nombrePrioridad = catalogos.prioridades.find((p) => p.clave === s.prioridad)?.nombre ?? s.prioridad;
  async function actualizar(evento) {
    evento.preventDefault();
    const valores = Object.fromEntries(new FormData(evento.currentTarget));
    const cuerpo = { estado: destino, version: s.version };
    if (valores.prioridad) cuerpo.prioridad = valores.prioridad;
    if (valores.responsableId) cuerpo.responsableId = Number(valores.responsableId);
    const resultado = await ejecutar('/solicitudes/' + s.id, { metodo: 'PUT', cuerpo });
    if (resultado) cambiar(resultado);
  }
  async function comentar(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const mensaje = new FormData(formulario).get('mensaje').trim();
    if (mensaje.length < 2) return ejecutar(() => Promise.reject(new Error('Escribe un comentario de al menos dos caracteres.')));
    const resultado = await ejecutar('/solicitudes/' + s.id + '/comentarios', { metodo: 'POST', cuerpo: { mensaje } });
    if (resultado) { formulario.reset(); cambiar(resultado); }
  }
  return <div className="pila">
    <button className="enlace volver" onClick={cerrar}>‹ Volver a solicitudes</button>
    <section className="panel">
      <div className="titular detalle"><div><p>{s.codigo} · {s.categoria}</p><h1>{s.titulo}</h1></div>
        <Estado dato={s.estado} catalogos={catalogos} /></div>
      <dl className="ficha"><div><dt>Solicitante</dt><dd>{s.usuario}</dd></div><div><dt>Responsable</dt><dd>{s.responsable ?? 'Sin asignar'}</dd></div>
        <div><dt>Prioridad</dt><dd>{nombrePrioridad}</dd></div><div><dt>Ubicación</dt><dd>{s.ubicacion}</dd></div>
        <div><dt>Fecha de registro</dt><dd>{fecha(s.creada)}</dd></div><div><dt>Plazo de atención</dt><dd>{fecha(s.vence)}{vencida(s, Date.now()) && ' · Vencida'}</dd></div></dl>
      <p className="descripcion">{s.descripcion}</p>
      {s.evidencia && <a className="enlace" href={s.evidencia} target="_blank" rel="noopener noreferrer">Abrir evidencia ↗</a>}
      {rol === 'ESTUDIANTE' && s.estado === 'REGISTRADA' && <details className="retirar"><summary>Retirar solicitud</summary>
        <p>Se eliminará este registro y su actividad.</p><button className="peligro" disabled={ocupado}
          onClick={async () => { if (await ejecutar('/solicitudes/' + s.id, { metodo: 'DELETE' }, true)) cerrar(); }}>Confirmar retiro</button></details>}
    </section>
    {(siguiente || supervisor && abierta) && <section className="panel"><h2>Gestionar atención</h2>
      <form className="formulario" onSubmit={actualizar}>
        <label>Estado<select value={destino} onChange={(e) => setDestino(e.target.value)}>
          {catalogos.estados.filter((e) => e.clave === siguiente || (supervisor && abierta && e.clave === s.estado))
            .map((e) => <option key={e.clave} value={e.clave}>{e.nombre}</option>)}
        </select></label>
        {supervisor && abierta && <label>Prioridad<select name="prioridad" defaultValue={s.prioridad}>
          {catalogos.prioridades.map((p) => <option key={p.clave} value={p.clave}>{p.nombre} · {p.horas} h</option>)}
        </select></label>}
        {asignar && <label>Técnico responsable<select name="responsableId" required defaultValue={s.responsableId ?? ''}>
          <option value="" disabled>Selecciona un técnico</option>{tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label>}
        <button className="primario" disabled={ocupado}>Guardar cambios</button>
      </form></section>}
    <section className="panel"><h2>Historial y comentarios</h2><ol className="historial">
      {actividad.map((evento, i) => <li key={i}><strong>{evento.autor}</strong><time>{fecha(evento.fecha)}</time><p>{evento.mensaje}</p></li>)}
    </ol>
    {s.estado !== 'CERRADA' && <form className="formulario" onSubmit={comentar}>
      <label>Comentario<textarea name="mensaje" required minLength={2} maxLength={1000} rows={2} /></label>
      <button className="secundario" disabled={ocupado}>Añadir comentario</button>
    </form>}</section>
  </div>;
}

function Seguimiento({ catalogos, solicitudes, seleccionar }) {
  const porEstado = new Map(agrupar(solicitudes, 'estado'));
  return <><div className="titular"><div><h1>Seguimiento</h1><p>Consulta las solicitudes por etapa de atención.</p></div></div>
    <div className="etapas">{catalogos.estados.map((e) => <section className="panel" key={e.clave}>
      <div className="etapa-titulo"><Estado dato={e.clave} catalogos={catalogos} /><strong>{porEstado.get(e.clave) ?? 0}</strong></div>
      <Filas solicitudes={solicitudes.filter((s) => s.estado === e.clave)} catalogos={catalogos}
        seleccionar={seleccionar} vacio="Sin solicitudes en esta etapa." />
    </section>)}</div></>;
}

function Estadisticas({ solicitudes, catalogos }) {
  const datos = indicadores(solicitudes);
  return <><div className="titular"><div><h1>Indicadores</h1><p>Datos del conjunto de solicitudes visible para tu perfil.</p></div></div>
    <div className="metricas">{[['Registradas', datos.total], ['Pendientes', datos.abiertas], ['Atendidas', datos.resueltas],
      ['Vencidas', datos.vencidas], ['Tasa de resolución', datos.tasa + '%'],
      ['Atención promedio', datos.promedio === null ? '—' : datos.promedio.toLocaleString('es-PE', { maximumFractionDigits: 1 }) + ' h']]
      .map(([nombre, cantidad]) => <section className="panel mini" key={nombre}><div><small>{nombre}</small><strong>{cantidad}</strong></div></section>)}</div>
    <div className="metricas graficos">
      <Barras datos={agrupar(solicitudes, 'categoria')} catalogos={catalogos} titulo="Por categoría" />
      <Barras datos={agrupar(solicitudes, 'prioridad')} catalogos={catalogos} titulo="Por prioridad" />
      <Barras datos={agrupar(solicitudes, 'responsable')} catalogos={catalogos} titulo="Por responsable" />
    </div></>;
}

const catalogoVacio = { estados: [], prioridades: [], categorias: [] };
function App() {
  const [ruta, setRuta] = useState(fragmento);
  const [sesion, setSesion] = useState(() => leerSesion() ?? (modoDemo ? { perfil: perfiles[0] } : null));
  const [catalogos, setCatalogos] = useState(catalogoVacio);
  const [solicitudes, setSolicitudes] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [listaAdmin, setListaAdmin] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [nueva, setNueva] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(Boolean(sesion));
  const [ocupado, setOcupado] = useState(false);
  const seccion = ruta.split('?')[0];
  const pagina = pestañas.some(([id]) => seccion === id) ? seccion : 'inicio';
  const admin = sesion?.perfil.rol === 'ADMIN';
  const gestor = admin || sesion?.perfil.rol === 'SUPERVISOR';

  function cambiarSesion(valor) {
    if (valor) sessionStorage.setItem(claveSesion, JSON.stringify(valor));
    else sessionStorage.removeItem(claveSesion);
    setDetalle(null); setNueva(false); setError(''); setCatalogos(catalogoVacio);
    setSolicitudes([]); setTecnicos([]); setListaAdmin(null); setSesion(valor);
  }

  useEffect(() => {
    const cambiarRuta = () => { setRuta(fragmento()); setError(''); setDetalle(null); setNueva(false); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', cambiarRuta);
    return () => window.removeEventListener('hashchange', cambiarRuta);
  }, []);

  async function obtener() {
    const [items, catalogo, responsables, administracion] = await Promise.all([
      peticion('/solicitudes', { sesion }), peticion('/catalogos', { sesion }),
      gestor ? peticion('/tecnicos', { sesion }) : [], admin ? peticion('/admin', { sesion }) : null,
    ]);
    const orden = ['REGISTRADA', 'EVALUACION', 'ASIGNADA', 'ATENCION', 'RESUELTA', 'CERRADA'];
    catalogo.estados.sort((a, b) => orden.indexOf(a.clave) - orden.indexOf(b.clave));
    return { items, catalogo, responsables, administracion };
  }

  function aplicar({ items, catalogo, responsables, administracion }) {
    setSolicitudes(items); setCatalogos(catalogo); setTecnicos(responsables); setListaAdmin(administracion);
  }

  useEffect(() => {
    if (!sesion) { setCargando(false); return; }
    let vigente = true;
    setCargando(true);
    obtener().then((datos) => { if (vigente) aplicar(datos); }).catch((fallo) => {
      if (!vigente) return;
      if (fallo.estado === 401) cambiarSesion(null);
      setError(fallo.message);
    }).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [sesion]);

  async function ejecutar(rutaApi, opciones = {}, sinRespuesta = false) {
    setError(''); setOcupado(true);
    try {
      const resultado = typeof rutaApi === 'function' ? await rutaApi() : await peticion(rutaApi, { ...opciones, sesion });
      if (opciones.metodo && opciones.metodo !== 'GET') {
        try { aplicar(await obtener()); }
        catch { setError('Se guardó el cambio. Actualiza los datos para ver el listado al día.'); }
      }
      return sinRespuesta ? true : resultado;
    } catch (fallo) {
      if (fallo.estado === 401) cambiarSesion(null);
      setError(fallo.message);
    } finally { setOcupado(false); }
  }

  async function seleccionar(id) {
    const resultado = await ejecutar('/solicitudes/' + id);
    if (resultado) { setDetalle(resultado); setNueva(false); window.scrollTo(0, 0); }
  }

  const nombre = sesion?.perfil.nombre;
  return <>
    <a className="salto" href="#contenido" onClick={(evento) => {
      evento.preventDefault();
      document.getElementById('contenido').focus();
    }}>Saltar al contenido</a>
    <aside className="navegacion" aria-label="Barra principal">
      <a className="marca" href="#inicio"><img src={recurso('icono.png')} width="38" height="38" alt="" />Órbita Campus</a>
      <nav aria-label="Secciones principales">{pestañas.filter(([id]) => id !== 'admin' || admin).map(([id, texto, icono]) =>
        <a key={id} href={'#' + id} aria-current={pagina === id ? 'page' : undefined}><span aria-hidden="true">{icono}</span>{texto}</a>)}</nav>
      <small>UNMSM · Taller de Software Web</small>
    </aside>
    <div className="espacio">
      <header className="cabecera">
        <a className="marca marca-movil" href="#inicio"><img src={recurso('icono.png')} width="32" height="32" alt="" />Órbita Campus</a>
        <span className={'modo ' + (modoDemo ? 'etiqueta-demo' : '')}>{modoDemo ? 'Demo interactiva' : 'Servicios UNMSM'}</span>
        <a className="secundario" href="#cuenta">{nombre ? roles[sesion.perfil.rol] + ' · ' + nombre.split(' ')[0] : 'Mi cuenta'}</a>
      </header>
      <main id="contenido" tabIndex="-1">
        <Aviso error={error} cargando={cargando || ocupado} />
        {error && !cargando && !ocupado && sesion && <button className="enlace reintentar" onClick={() => ejecutar(async () => aplicar(await obtener()))}>Actualizar datos</button>}
        {pagina === 'cuenta'
          ? <><div className="titular"><div><h1>Cuenta</h1><p>Acceso al sistema de servicios universitarios</p></div></div><Cuenta sesion={sesion} onSesion={cambiarSesion} avisar={setError} /></>
          : detalle ? <Detalle key={detalle.solicitud.id + ':' + detalle.solicitud.version} detalle={detalle} catalogos={catalogos} tecnicos={tecnicos}
            sesion={sesion} ocupado={ocupado} ejecutar={ejecutar} cambiar={setDetalle} cerrar={() => { setDetalle(null); location.hash = 'solicitudes'; }} />
          : pagina === 'inicio' ? <Inicio solicitudes={solicitudes} catalogos={catalogos} seleccionar={seleccionar} sesion={sesion} />
          : !sesion ? <section className="panel cuenta"><h1>Inicia sesión</h1><p>Entra con tu correo UNMSM para consultar esta sección.</p><a className="primario" href="#cuenta">Abrir cuenta</a></section>
          : pagina === 'solicitudes' && nueva ? <Nueva catalogos={catalogos} ocupado={ocupado} ejecutar={ejecutar} cerrar={(id) => { setNueva(false); if (id) void seleccionar(id); }} />
          : pagina === 'solicitudes' ? <Listado solicitudes={solicitudes} catalogos={catalogos} seleccionar={seleccionar}
            estudiante={sesion.perfil.rol === 'ESTUDIANTE'} abrir={() => setNueva(true)} />
          : pagina === 'seguimiento' ? <Seguimiento solicitudes={solicitudes} catalogos={catalogos} seleccionar={seleccionar} />
          : pagina === 'estadisticas' ? <Estadisticas solicitudes={solicitudes} catalogos={catalogos} />
          : <Administracion datos={listaAdmin} ocupado={ocupado} ejecutar={ejecutar} perfil={sesion.perfil} />}
      </main>
      <footer><span>Órbita Campus · Segundo entregable</span><div className="acciones">
        <a href={recurso('Informe-segundo-entregable.pdf')}>Informe PDF</a>
        <a href="https://github.com/Andrey3210/orbita-campus">Código y documentación</a>
      </div></footer>
    </div>
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
