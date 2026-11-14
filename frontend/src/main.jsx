import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { accesoDisponible, peticion } from './api.js';
import { agrupar, indicadores, normalizar, proximo, roles, vencida } from './modelo.js';
import { Administracion } from './administracion.jsx';
import { Acceso, Marca, MiCuenta } from './cuenta.jsx';
import { informeFinal } from './enlaces.js';
import './estilos.css';

const pestañas = [
  ['inicio', 'Inicio', '⌂'], ['solicitudes', 'Solicitudes', '☷'],
  ['seguimiento', 'Seguimiento', '◷'], ['estadisticas', 'Indicadores', '◒'],
  ['admin', 'Administración', '⚙'], ['cuenta', 'Cuenta', '↗'],
];
const f = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
const fecha = (valor) => f.format(new Date(valor));
const recurso = (ruta) => import.meta.env.BASE_URL + ruta;
const claveSesion = 'orbita-campus-sesion-v2';

function Navegacion({ pagina, admin }) {
  const barra = useRef(null);

  useEffect(() => {
    const menu = barra.current;
    const activa = menu.querySelector('[aria-current="page"]');
    if (!activa || menu.scrollWidth <= menu.clientWidth) return;

    const visible = menu.getBoundingClientRect();
    const enlace = activa.getBoundingClientRect();
    if (enlace.left < visible.left || enlace.right > visible.right) {
      menu.scrollTo({ left: menu.scrollLeft + enlace.left - visible.left - (visible.width - enlace.width) / 2 });
    }
  }, [pagina, admin]);

  return <aside className="navegacion" aria-label="Barra principal">
    <Marca />
    <nav ref={barra} aria-label="Secciones principales">
      {pestañas.filter(([id]) => id !== 'admin' || admin).map(([id, texto, icono]) =>
        <a key={id} href={'#' + id} aria-current={pagina === id ? 'page' : undefined}>
          <span aria-hidden="true">{icono}</span>{texto}
        </a>)}
    </nav>
    <small>UNMSM · Taller de Software Web</small>
  </aside>;
}

function leerSesion() {
  try {
    const sesion = JSON.parse(sessionStorage.getItem(claveSesion));
    if (!sesion?.perfil?.nombre || !Object.hasOwn(roles, sesion.perfil.rol)) return null;
    return accesoDisponible && typeof sesion.token === 'string' && sesion.token ? sesion : null;
  } catch { return null; }
}

function fragmento() {
  return location.hash.slice(1);
}

function Aviso({ error, cargando }) {
  if (error) return <p className="aviso error" role="alert">{error}</p>;
  if (cargando) return <p className="aviso" role="status">Cargando datos…</p>;
  return null;
}

function Estado({ dato, catalogos }) {
  return <span className={'estado ' + dato.toLowerCase()}>{catalogos.estados.find((e) => e.clave === dato)?.nombre ?? dato}</span>;
}

function Filas({ solicitudes, catalogos, origen = 'solicitudes', vacio, repetirEstado = true }) {
  if (!solicitudes.length) return <p className="vacio">{vacio}</p>;
  return <ul className="filas">{solicitudes.map((s) =>
    <li key={s.id}><a href={'#' + origen + '/' + s.id}>
      <span className="fila-titulo"><strong>{s.titulo}</strong><small>{s.codigo} · {s.categoria}</small>
        {vencida(s, Date.now()) && <small className="plazo-vencido">Plazo vencido</small>}</span>
      {repetirEstado && <Estado dato={s.estado} catalogos={catalogos} />}
      <span className="flecha-fila" aria-hidden="true">›</span>
    </a></li>)}</ul>;
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

function Inicio({ solicitudes, catalogos, rol }) {
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
  const tonos = ['#38619b', '#468979', '#aa7d3d', '#777eaa'];
  const categorias = segmentos.length > 4
    ? [...segmentos.slice(0, 3), ['Otras categorías', segmentos.slice(3).reduce((total, [, cantidad]) => total + cantidad, 0)]]
    : segmentos;
  const paradas = categorias.map(([, cantidad], i) => {
    const anterior = angulo;
    angulo += cantidad / datos.total * 180;
    return tonos[i % tonos.length] + ' ' + anterior + 'deg ' + angulo + 'deg';
  });
  const alcance = { ESTUDIANTE: 'El estado de tus solicitudes', TECNICO: 'Solicitudes asignadas a tu cuenta',
    SUPERVISOR: 'Carga y avance de las solicitudes del campus', ADMIN: 'Carga y avance de las solicitudes del campus' }[rol];
  return <>
    <div className="titular"><div><h1>Servicios universitarios</h1>
      <p>{alcance}</p></div><a className="primario" href={rol === 'ESTUDIANTE' ? '#solicitudes/nueva' : '#solicitudes'}>
        {rol === 'ESTUDIANTE' ? 'Nueva solicitud' : 'Ver solicitudes'} <span aria-hidden="true">↗</span></a></div>
    <div className="tablero">
      <div className="pila">
        <section className="resumen-principal"><div><strong>Solicitudes registradas</strong>
          <div className="cifra">{datos.total}</div><p>{datos.abiertas} abiertas · {datos.resueltas} atendidas</p></div>
          <img src={recurso('campus-tablero.jpg')} alt="" /></section>
        <div className="mini-grid">
          <div className="panel mini"><span className="insignia verde" aria-hidden="true">↗</span><div><small>Resolución</small><strong>{datos.tasa}%</strong></div></div>
          <div className="panel mini"><span className="insignia dorada" aria-hidden="true">◷</span><div><small>Vencidas</small><strong>{datos.vencidas}</strong></div></div>
        </div>
      </div>
      <section className="panel categorias"><h2>Por categoría</h2><div className="categorias-contenido">
        <div className="medidor" style={{ background: paradas.length
          ? 'conic-gradient(from -90deg, ' + paradas.join(',') + ', transparent 180deg 360deg)' : undefined }}>
          <span>{datos.total}</span>
        </div>
        <ul>{categorias.map(([nombre, cantidad], i) => <li key={i}>
          <i style={{ background: tonos[i % tonos.length] }} /><span>{nombre}</span><strong>{cantidad}</strong>
        </li>)}{!categorias.length && <li>Aún no hay solicitudes</li>}</ul>
      </div><a className="enlace" href="#estadisticas">Ver indicadores →</a></section>
      <section className="panel serie"><h2>Solicitudes por día</h2><p>Últimos siete días</p>
        <div className="grafico">{dias.map((dia, i) => <div key={i} aria-label={dia.letra + ': ' + dia.total}>
          <strong>{dia.total}</strong><i style={{ height: Math.max(3, dia.total / maximo * 100) + '%' }} /><span>{dia.letra}</span>
        </div>)}</div>
      </section>
      <section className="panel recientes"><h2>Actividad reciente</h2>
        <Filas solicitudes={solicitudes.slice(0, 4)} catalogos={catalogos} origen="inicio" vacio="Las solicitudes recientes aparecerán aquí." />
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
    const resultado = await ejecutar('/solicitudes', { metodo: 'POST', confirmacion: 'Solicitud registrada. Guarda el código de la ficha para hacer seguimiento.',
      cuerpo: { ...datos, categoriaId: Number(datos.categoriaId), evidencia: datos.evidencia || null } });
    if (resultado) cerrar(resultado.solicitud.id);
  }
  return <section className="panel panel-formulario">
    <h1>Nueva solicitud</h1>
    <p className="introduccion-formulario">Indica dónde ocurrió y qué necesita atender el campus.</p>
    {!catalogos.categorias.length && <p role="status">Por ahora no hay categorías disponibles para registrar una solicitud.</p>}
    <form className="formulario" onSubmit={guardar}>
      <label>Asunto<input required name="titulo" minLength={5} maxLength={120} placeholder="Ej. Proyector sin señal" /></label>
      <label>Categoría<select name="categoriaId" aria-label="Categoría" required defaultValue=""><option value="" disabled>Elige una categoría</option>
        {catalogos.categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
      <label>Ubicación<input name="ubicacion" required minLength={3} maxLength={150} placeholder="Facultad, pabellón o aula" /></label>
      <label>Descripción<textarea name="descripcion" aria-label="Descripción" required minLength={10} maxLength={2000} rows={4}
        aria-describedby="ayuda-descripcion" /><span id="ayuda-descripcion" className="ayuda-campo">Indica qué pasó, desde cuándo y a quién afecta.</span></label>
      <label>Evidencia (enlace HTTPS opcional)<input type="url" name="evidencia" maxLength={500} placeholder="https://" /></label>
      <div className="acciones"><button className="primario" disabled={ocupado || !catalogos.categorias.length}>{ocupado ? 'Registrando…' : 'Registrar solicitud'}</button>
        <button className="secundario" type="button" onClick={() => cerrar()}>Cancelar</button></div>
    </form>
  </section>;
}

const cookieCategoria = 'orbita_campus_categoria';

function categoriaGuardada() {
  const dato = document.cookie.split('; ').find((cookie) => cookie.startsWith(cookieCategoria + '='));
  const valor = dato?.slice(cookieCategoria.length + 1) ?? '';
  return /^\d+$/.test(valor) ? valor : '';
}

function Listado({ solicitudes, catalogos, estudiante }) {
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState('');
  const [categoriaGuardadaId, setCategoria] = useState(categoriaGuardada);
  const [vencidas, setVencidas] = useState(false);
  const categoria = catalogos.categorias.some((c) => c.id === Number(categoriaGuardadaId)) ? categoriaGuardadaId : '';
  function guardarCategoria(valor) {
    setCategoria(valor);
    const ruta = new URL(import.meta.env.BASE_URL, location.href).pathname;
    const seguro = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = cookieCategoria + '=' + valor + '; Path=' + ruta
      + '; SameSite=Lax; Max-Age=' + (valor ? 2592000 : 0) + seguro;
  }
  const filtrado = Boolean(texto || estado || categoria || vencidas);
  const visibles = solicitudes.filter((s) => (!estado || estado === s.estado) && (!categoria || Number(categoria) === s.categoriaId)
    && (!vencidas || vencida(s, Date.now()))
    && normalizar(s.titulo + ' ' + s.codigo + ' ' + s.ubicacion).includes(normalizar(texto)));
  return <>
    <div className="titular"><div><h1>Solicitudes</h1><p>Consulta el estado, el responsable y el historial de cada pedido.</p></div>
      {estudiante && <button className="primario" onClick={() => { location.hash = 'solicitudes/nueva'; }}>+ Nueva solicitud</button>}</div>
    <section className="panel">
      <div className="filtros">
        <input aria-label="Buscar solicitudes por asunto, código o ubicación" type="search" placeholder="Asunto, código o lugar" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <select aria-label="Filtrar por estado" value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos los estados</option>
          {catalogos.estados.map((e) => <option key={e.clave} value={e.clave}>{e.nombre}</option>)}</select>
        <select aria-label="Filtrar por categoría" value={categoria} onChange={(e) => guardarCategoria(e.target.value)}><option value="">Todas las categorías</option>
          {catalogos.categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
      </div>
      <div className="lista-herramientas">
        <p className="cantidad" role="status">{visibles.length} de {solicitudes.length} solicitudes</p>
        <div className="acciones">
          <button className="secundario" aria-pressed={vencidas} onClick={() => setVencidas(!vencidas)}>Solo vencidas</button>
          {filtrado && <button className="enlace" onClick={() => {
            setTexto(''); setEstado(''); guardarCategoria(''); setVencidas(false);
          }}>Limpiar filtros</button>}
        </div>
      </div>
      <Filas solicitudes={visibles} catalogos={catalogos} vacio={solicitudes.length
        ? 'No hay coincidencias. Cambia los filtros o límpialos.'
        : estudiante ? 'Aún no has registrado solicitudes.' : 'Aún no hay solicitudes en el alcance de tu cuenta.'} />
    </section>
  </>;
}

function Detalle({ detalle, catalogos, tecnicos, sesion, ocupado, ejecutar, cambiar, cerrar, origen }) {
  const { solicitud: s, actividad } = detalle;
  const rol = sesion.perfil.rol;
  const supervisor = ['ADMIN', 'SUPERVISOR'].includes(rol);
  const siguiente = proximo(s.estado, rol);
  const abierta = !['RESUELTA', 'CERRADA'].includes(s.estado);
  const [destino, setDestino] = useState(s.estado);
  const [prioridad, setPrioridad] = useState(s.prioridad);
  const [responsable, setResponsable] = useState(String(s.responsableId ?? ''));
  const asignar = supervisor && ['ASIGNADA', 'ATENCION'].includes(destino);
  const hayCambios = destino !== s.estado || prioridad !== s.prioridad || asignar && responsable !== String(s.responsableId ?? '');
  const nombrePrioridad = catalogos.prioridades.find((p) => p.clave === s.prioridad)?.nombre ?? s.prioridad;
  async function actualizar(evento) {
    evento.preventDefault();
    const valores = Object.fromEntries(new FormData(evento.currentTarget));
    const cuerpo = { estado: destino, version: s.version };
    if (valores.prioridad) cuerpo.prioridad = valores.prioridad;
    if (valores.responsableId) cuerpo.responsableId = Number(valores.responsableId);
    const resultado = await ejecutar('/solicitudes/' + s.id, { metodo: 'PUT', cuerpo, confirmacion: 'Atención actualizada.' });
    if (resultado) cambiar(resultado);
  }
  async function comentar(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const mensaje = new FormData(formulario).get('mensaje').trim();
    if (mensaje.length < 2) return ejecutar(() => Promise.reject(new Error('Escribe un comentario de al menos dos caracteres.')));
    const resultado = await ejecutar('/solicitudes/' + s.id + '/comentarios', { metodo: 'POST', cuerpo: { mensaje }, confirmacion: 'Comentario añadido al historial.' });
    if (resultado) { formulario.reset(); cambiar(resultado); }
  }
  return <div className="pila">
    <button className="enlace volver" onClick={cerrar}>‹ Volver a {origen}</button>
    <section className="panel">
      <div className="titular detalle"><div><p>{s.codigo} · {s.categoria}</p><h1>{s.titulo}</h1></div>
        <Estado dato={s.estado} catalogos={catalogos} /></div>
      <dl className="ficha"><div><dt>Solicitante</dt><dd>{s.usuario}</dd></div><div><dt>Responsable</dt><dd>{s.responsable ?? 'Sin asignar'}</dd></div>
        <div><dt>Prioridad</dt><dd>{nombrePrioridad}</dd></div><div><dt>Ubicación</dt><dd>{s.ubicacion}</dd></div>
        <div><dt>Fecha de registro</dt><dd>{fecha(s.creada)}</dd></div><div><dt>Plazo de atención</dt><dd>{fecha(s.vence)}{vencida(s, Date.now()) && <span className="plazo-vencido">Vencida</span>}</dd></div></dl>
      <p className="descripcion">{s.descripcion}</p>
      {s.evidencia && <a className="enlace" href={s.evidencia} target="_blank" rel="noopener noreferrer">Abrir evidencia ↗</a>}
      {rol === 'ESTUDIANTE' && s.estado === 'REGISTRADA' && <details className="retirar"><summary>Retirar solicitud</summary>
        <p>Se eliminará este registro y su actividad.</p><button className="peligro" disabled={ocupado}
          onClick={async () => { if (await ejecutar('/solicitudes/' + s.id, { metodo: 'DELETE' }, true)) cerrar(); }}>Confirmar retiro</button></details>}
    </section>
    {(siguiente || supervisor && abierta) && <section className="panel"><h2>Gestionar atención</h2>
      <form className="formulario" onSubmit={actualizar}>
        <label>Estado<select aria-label="Estado" value={destino} onChange={(e) => setDestino(e.target.value)}>
          {catalogos.estados.filter((e) => e.clave === siguiente || e.clave === s.estado)
            .map((e) => <option key={e.clave} value={e.clave}>{e.nombre}{e.clave === s.estado ? ' (actual)' : ''}</option>)}
        </select></label>
        {supervisor && abierta && <label>Prioridad<select aria-label="Prioridad" name="prioridad" value={prioridad} onChange={e => setPrioridad(e.target.value)}>
          {catalogos.prioridades.map((p) => <option key={p.clave} value={p.clave}>{p.nombre} · {p.horas} h</option>)}
        </select></label>}
        {asignar && <label>Técnico responsable<select name="responsableId" aria-label="Técnico responsable" required value={responsable} onChange={e => setResponsable(e.target.value)}>
          <option value="" disabled>Selecciona un técnico</option>{tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label>}
        <button className="primario" disabled={ocupado || !hayCambios}>{ocupado ? 'Guardando…' : 'Guardar cambios'}</button>
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

function Seguimiento({ catalogos, solicitudes }) {
  const [mostrarVacias, setMostrarVacias] = useState(true);
  const porEstado = new Map(agrupar(solicitudes, 'estado'));
  const etapas = catalogos.estados.filter(e => mostrarVacias || porEstado.has(e.clave));
  return <><div className="titular"><div><h1>Seguimiento</h1><p>Consulta las solicitudes por etapa de atención.</p></div>
    <button className="secundario" aria-pressed={!mostrarVacias} onClick={() => setMostrarVacias(!mostrarVacias)}>Ocultar etapas vacías</button></div>
    {!etapas.length && <p className="vacio">No hay solicitudes para seguir en esta cuenta.</p>}
    <div className="etapas">{etapas.map((e) => <section className="panel" key={e.clave}>
      <div className="etapa-titulo"><h2><Estado dato={e.clave} catalogos={catalogos} /></h2><strong>{porEstado.get(e.clave) ?? 0}</strong></div>
      <Filas solicitudes={solicitudes.filter((s) => s.estado === e.clave)} catalogos={catalogos}
        origen="seguimiento" repetirEstado={false} vacio="Sin solicitudes en esta etapa." />
    </section>)}</div></>;
}

function Estadisticas({ solicitudes, catalogos }) {
  const [periodo, setPeriodo] = useState('');
  const ahora = Date.now();
  const visibles = periodo ? solicitudes.filter(s => Date.parse(s.creada) >= ahora - Number(periodo) * 86_400_000) : solicitudes;
  const datos = indicadores(visibles, ahora);
  return <><div className="titular"><div><h1>Indicadores</h1><p>Datos del conjunto de solicitudes visible para tu perfil.</p></div></div>
    <div className="periodo"><label>Periodo de registro<select aria-label="Periodo de registro" value={periodo} onChange={e => setPeriodo(e.target.value)}>
      <option value="">Desde el inicio</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option>
    </select></label><p role="status">{datos.total} solicitudes en el periodo</p></div>
    <div className="metricas">{[['Registradas', datos.total], ['Pendientes', datos.abiertas], ['Atendidas', datos.resueltas],
      ['Vencidas', datos.vencidas], ['Tasa de resolución', datos.tasa + '%'],
      ['Atención promedio', datos.promedio === null ? '—' : datos.promedio.toLocaleString('es-PE', { maximumFractionDigits: 1 }) + ' h']]
      .map(([nombre, cantidad]) => <section className="panel mini" key={nombre}><div><small>{nombre}</small><strong>{cantidad}</strong></div></section>)}</div>
    <div className="metricas graficos">
      <Barras datos={agrupar(visibles, 'categoria')} catalogos={catalogos} titulo="Por categoría" />
      <Barras datos={agrupar(visibles, 'prioridad')} catalogos={catalogos} titulo="Por prioridad" />
      <Barras datos={agrupar(visibles, 'responsable')} catalogos={catalogos} titulo="Por responsable" />
    </div></>;
}

const catalogoVacio = { estados: [], prioridades: [], categorias: [] };
const nombreOrigen = { inicio: 'Inicio', solicitudes: 'Solicitudes', seguimiento: 'Seguimiento' };
function App() {
  const [ruta, setRuta] = useState(fragmento);
  const [sesion, setSesion] = useState(leerSesion);
  const [mensajeAcceso, setMensajeAcceso] = useState('');
  const [catalogos, setCatalogos] = useState(catalogoVacio);
  const [solicitudes, setSolicitudes] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [listaAdmin, setListaAdmin] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [detalleError, setDetalleError] = useState('');
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [recargaDetalle, setRecargaDetalle] = useState(0);
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(Boolean(sesion));
  const [ocupado, setOcupado] = useState(false);
  const navegar = useRef(null);
  const titulo = useRef(null);
  const seccion = ruta.split('?')[0];
  const [pestana, subvista, extra] = seccion.split('/');
  const admin = sesion?.perfil.rol === 'ADMIN';
  const estudiante = sesion?.perfil.rol === 'ESTUDIANTE';
  const pagina = pestañas.some(([id]) => pestana === id && (id !== 'admin' || admin)) ? pestana : 'inicio';
  const gestor = admin || sesion?.perfil.rol === 'SUPERVISOR';
  const enlaceCuenta = seccion === 'cuenta' && ruta.includes('?');
  const origenDetalle = Object.hasOwn(nombreOrigen, pestana) ? pestana : null;
  const solicitudId = origenDetalle && !extra && /^[1-9]\d{0,15}$/.test(subvista ?? '') ? subvista : null;
  const nueva = pagina === 'solicitudes' && subvista === 'nueva' && estudiante;
  const ficha = solicitudId && String(detalle?.solicitud.id) === solicitudId ? detalle : null;
  const destinoActivo = solicitudId || nueva;

  function expirarSesion() {
    cambiarSesion(null);
    setMensajeAcceso('Tu sesión expiró. Vuelve a iniciar sesión.');
  }

  function cambiarSesion(valor) {
    if (valor) sessionStorage.setItem(claveSesion, JSON.stringify(valor));
    else sessionStorage.removeItem(claveSesion);
    setMensajeAcceso('');
    setDetalle(null); setDetalleError(''); setError(''); setConfirmacion(''); setCatalogos(catalogoVacio);
    setSolicitudes([]); setTecnicos([]); setListaAdmin(null); setSesion(valor);
    setCargando(Boolean(valor));
  }

  useEffect(() => {
    const cambiarRuta = () => {
      setRuta(fragmento()); setError(''); setDetalleError('');
      if (fragmento() !== navegar.current) setConfirmacion('');
      navegar.current = null;
      window.scrollTo(0, 0);
    };
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
      if (fallo.estado === 401) expirarSesion();
      else setError(fallo.message);
    }).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [sesion]);

  useEffect(() => {
    if (!solicitudId || !sesion) { setDetalle(null); setCargandoDetalle(false); return; }
    const control = new AbortController();
    setCargandoDetalle(true);
    setDetalleError('');
    peticion('/solicitudes/' + solicitudId, { sesion, signal: control.signal }).then(resultado => {
      if (!control.signal.aborted) setDetalle(resultado);
    }).catch(fallo => {
      if (control.signal.aborted) return;
      if (fallo.estado === 401) expirarSesion();
      else setDetalleError(fallo.estado === 404 ? 'La solicitud no está disponible para tu cuenta.' : fallo.message);
    }).finally(() => { if (!control.signal.aborted) setCargandoDetalle(false); });
    return () => control.abort();
  }, [sesion, solicitudId, recargaDetalle]);

  useEffect(() => {
    const encabezado = titulo.current?.querySelector('h1:not([hidden] h1)');
    if (encabezado && !cargando && !cargandoDetalle) {
      encabezado.tabIndex = -1;
      encabezado.focus({ preventScroll: true });
      document.title = encabezado.textContent + ' · Órbita Campus';
    }
  }, [ruta, cargando, cargandoDetalle]);

  async function ejecutar(rutaApi, opciones = {}, sinRespuesta = false) {
    setError(''); setConfirmacion(''); setOcupado(true);
    try {
      const { confirmacion: mensaje, ...peticionOpciones } = opciones;
      const resultado = typeof rutaApi === 'function' ? await rutaApi() : await peticion(rutaApi, { ...peticionOpciones, sesion });
      if (opciones.metodo && opciones.metodo !== 'GET') {
        setConfirmacion(mensaje ?? 'Cambios guardados.');
        try { aplicar(await obtener()); }
        catch { setError('Se guardó el cambio. Actualiza los datos para ver el listado al día.'); }
      }
      return sinRespuesta ? true : resultado;
    } catch (fallo) {
      if (fallo.estado === 401) expirarSesion();
      else setError(fallo.message);
    } finally { setOcupado(false); }
  }

  function volver() {
    location.hash = origenDetalle ?? 'solicitudes';
  }

  if (!sesion || enlaceCuenta) {
    const destino = ['inicio', 'solicitudes', 'seguimiento', 'estadisticas', 'admin'].includes(pestana) ? seccion : 'inicio';
    return <Acceso ruta={ruta} onSesion={cambiarSesion} mensaje={mensajeAcceso} avisar={setMensajeAcceso} destino={destino} />;
  }

  const { nombre } = sesion.perfil;
  return <>
    <a className="salto" href="#contenido" onClick={(evento) => {
      evento.preventDefault();
      document.getElementById('contenido').focus();
    }}>Saltar al contenido</a>
    <Navegacion pagina={pagina} admin={admin} />
    <div className="espacio">
      <header className="cabecera">
        <Marca movil />
        <span className="modo">Servicios UNMSM</span>
        <a className="secundario" href="#cuenta">{nombre ? roles[sesion.perfil.rol] + ' · ' + nombre.split(' ')[0] : 'Mi cuenta'}</a>
      </header>
      <main id="contenido" tabIndex="-1" ref={titulo}>
        <Aviso error={error || detalleError} cargando={cargando || cargandoDetalle} />
        {confirmacion && !error && <p className="aviso" role="status">{confirmacion}</p>}
        {error && !cargando && !ocupado && <button className="enlace reintentar" onClick={() => ejecutar(async () => {
          aplicar(await obtener());
          if (solicitudId) setDetalle(await peticion('/solicitudes/' + solicitudId, { sesion }));
        })}>Actualizar datos</button>}
        {detalleError && !cargandoDetalle && <button className="enlace reintentar" onClick={() => setRecargaDetalle(n => n + 1)}>Reintentar abrir ficha</button>}
        {(!cargando && pagina === 'solicitudes' && (!error || catalogos.estados.length > 0)) && <div hidden={Boolean(destinoActivo)}>
          <Listado solicitudes={solicitudes} catalogos={catalogos} estudiante={estudiante} />
        </div>}
        {pagina === 'cuenta'
          ? <><div className="titular"><div><h1>Mi cuenta</h1><p>Perfil y seguridad</p></div></div>
            <MiCuenta sesion={sesion} onSesion={cambiarSesion} avisar={setMensajeAcceso} /></>
          : cargando || error && !catalogos.estados.length ? null
          : ficha ? <Detalle key={ficha.solicitud.id + ':' + ficha.solicitud.version} detalle={ficha} catalogos={catalogos} tecnicos={tecnicos}
            sesion={sesion} ocupado={ocupado} ejecutar={ejecutar} cambiar={setDetalle} cerrar={volver}
            origen={nombreOrigen[origenDetalle]} />
          : solicitudId ? <button className="enlace volver" onClick={volver}>‹ Volver a {nombreOrigen[origenDetalle]}</button>
          : pagina === 'inicio' ? <Inicio solicitudes={solicitudes} catalogos={catalogos} rol={sesion.perfil.rol} />
          : nueva ? <Nueva catalogos={catalogos} ocupado={ocupado} ejecutar={ejecutar} cerrar={(id) => {
            const destino = id ? 'solicitudes/' + id : 'solicitudes';
            if (id) navegar.current = destino;
            location.hash = destino;
          }} />
          : pagina === 'solicitudes' ? null
          : pagina === 'seguimiento' ? <Seguimiento solicitudes={solicitudes} catalogos={catalogos} />
          : pagina === 'estadisticas' ? <Estadisticas solicitudes={solicitudes} catalogos={catalogos} />
          : <Administracion datos={listaAdmin} ocupado={ocupado} ejecutar={ejecutar} perfil={sesion.perfil} />}
      </main>
      <footer><span>Órbita Campus · Grupo 7</span><div className="acciones">
        <a href={informeFinal}>Informe final PDF</a>
        <a href="https://github.com/Andrey3210/orbita-campus">Código y documentación</a>
      </div></footer>
    </div>
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
