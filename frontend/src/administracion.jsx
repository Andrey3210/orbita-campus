import { useState } from 'react';
import { normalizar, roles } from './modelo.js';
import { useTransicionVista } from './transicion.js';

const secciones = [
  ['usuarios','Usuarios'], ['categorias','Categorías'], ['areas','Áreas'],
  ['prioridades','Prioridades'], ['estados','Estados'],
];

function Fila({ grupo, dato, datos, perfil, ejecutar, ocupado }) {
  const nuevo = !dato;
  const id = dato?.id ?? dato?.clave;
  const personal = grupo === 'usuarios';
  const categoria = grupo === 'categorias';
  const prioridad = grupo === 'prioridades';
  const nombre = dato?.nombre;
  const soloLectura = personal && dato.id === perfil.id;
  async function guardar(evento) {
    evento.preventDefault();
    const form = evento.currentTarget;
    const cuerpo = Object.fromEntries(new FormData(form));
    if (cuerpo.nombre) cuerpo.nombre = cuerpo.nombre.trim();
    if (cuerpo.nombre !== undefined && cuerpo.nombre.length < 2) {
      return ejecutar(() => Promise.reject(new Error('Escribe un nombre de al menos dos caracteres.')));
    }
    if (categoria) cuerpo.areaId = Number(cuerpo.areaId);
    if (prioridad) cuerpo.horas = Number(cuerpo.horas);
    if (personal || categoria) cuerpo.activo = cuerpo.activo === 'true';
    const ok = await ejecutar('/admin/' + grupo + (nuevo ? '' : '/' + id), { metodo: nuevo ? 'POST' : 'PUT', cuerpo }, true);
    if (ok && nuevo) form.reset();
  }
  return <form className="fila-admin" onSubmit={guardar} key={id}>
    {personal ? <div className="identidad"><strong>{nombre}</strong><small>{dato.correo} · {dato.verificado ? 'Verificado' : 'Pendiente de verificación'}</small></div>
      : <label>{nuevo ? 'Nombre nuevo' : 'Nombre'}<input name="nombre" required minLength={2}
        maxLength={['prioridades','estados'].includes(grupo) ? 32 : 80} defaultValue={nombre} /></label>}
    {personal && <label>Rol<select aria-label={'Rol de ' + nombre} name="rol" disabled={soloLectura} defaultValue={dato.rol}>
      {datos.roles.map((rol) => <option key={rol} value={rol}>{roles[rol]}</option>)}</select></label>}
    {categoria && <label>Área<select name="areaId" required defaultValue={dato?.areaId ?? ''}>
      <option value="">Seleccionar</option>{datos.areas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}
    </select></label>}
    {(categoria || personal) && <label>Acceso<select name="activo" disabled={soloLectura} defaultValue={String(dato?.activo ?? true)}>
      <option value="true">Activo</option><option value="false">Inactivo</option></select></label>}
    {prioridad && <label>Plazo en horas<input type="number" name="horas" required min="1" max="720" defaultValue={dato.horas} /></label>}
    {grupo === 'estados' && <span className="codigo">{dato.clave}</span>}
    <button className={nuevo ? 'primario' : 'secundario'} disabled={ocupado || soloLectura}>{nuevo ? 'Crear' : 'Guardar'}</button>
  </form>;
}

export function Administracion({ datos, perfil, ejecutar, ocupado }) {
  const [grupo, setGrupo] = useState('usuarios');
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const transicion = useTransicionVista(grupo, Boolean(datos));
  if (!datos) return <section className="panel"><h1>Administración</h1><p>Inicia sesión con un perfil administrador para gestionar los catálogos.</p></section>;
  const puedeCrear = ['areas','categorias'].includes(grupo);
  const registros = datos[grupo].filter(dato =>
    (!filtroRol || grupo !== 'usuarios' || filtroRol === dato.rol)
    && normalizar([dato.nombre, dato.correo, dato.clave].filter(Boolean).join(' ')).includes(normalizar(busqueda)));
  return <><div className="titular"><div><h1>Administración</h1><p>Gestiona roles, accesos y catálogos del sistema.</p></div></div>
    <section className="panel">
      <div className="pestanas acciones" role="group" aria-label="Catálogos de administración">{secciones.map(([id, nombre]) => <button key={id} className="secundario" aria-pressed={grupo === id}
        onClick={() => { setGrupo(id); setBusqueda(''); setFiltroRol(''); }}>{nombre}</button>)}</div>
      <div ref={transicion}>
        <div className="admin-filtros">
          <label>Buscar en {secciones.find(([id]) => id === grupo)[1].toLowerCase()}<input type="search" value={busqueda}
            onChange={e => setBusqueda(e.target.value)} /></label>
          {grupo === 'usuarios' && <label>Filtrar por rol<select aria-label="Filtrar por rol" value={filtroRol} onChange={e => setFiltroRol(e.target.value)}>
            <option value="">Todos los roles</option>{datos.roles.map(rol => <option key={rol} value={rol}>{roles[rol]}</option>)}
          </select></label>}
        </div>
        <p className="cantidad" role="status">{registros.length} de {datos[grupo].length} registros</p>
        <div className="pila admin-registros">
          {puedeCrear && <details className="admin-nuevo" key={grupo}><summary>{grupo === 'areas' ? 'Añadir área' : 'Añadir categoría'}</summary>
            <Fila grupo={grupo} datos={datos} perfil={perfil} ejecutar={ejecutar} ocupado={ocupado} /></details>}
          {!registros.length && <p className="vacio">No hay registros que coincidan con la búsqueda.</p>}
          {registros.map((dato) => <Fila key={grupo + ':' + (dato.id ?? dato.clave) + ':' + JSON.stringify(dato)}
            grupo={grupo} dato={dato} datos={datos} perfil={perfil} ejecutar={ejecutar} ocupado={ocupado} />)}
        </div>
      </div>
    </section></>;
}
