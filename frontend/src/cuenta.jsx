import { useState } from 'react';
import { correoValido, roles } from './modelo.js';
import { modoDemo, peticion } from './api.js';
import { perfiles } from './demo.js';

const recurso = (ruta) => import.meta.env.BASE_URL + ruta;
const informe = recurso('Informe-segundo-entregable.pdf');
const repositorio = 'https://github.com/Andrey3210/orbita-campus';
const modos = {
  login: ['Iniciar sesión', 'Entra con tu cuenta de Órbita Campus y tu correo institucional de San Marcos.'],
  registro: ['Crear cuenta', 'Regístrate con tu correo de la UNMSM. Te enviaremos un enlace para confirmarlo.'],
  recuperar: ['Recuperar contraseña', 'Solicita un enlace para establecer una nueva contraseña.'],
  reenviar: ['Reenviar verificación', 'Solicita otro enlace para confirmar tu correo institucional.'],
  verificar: ['Verificar correo', 'Confirma tu correo institucional con la contraseña que elegiste al registrarte.'],
  restablecer: ['Nueva contraseña', 'Elige una nueva contraseña para acceder a Órbita Campus.'],
  demo: ['Explorar la demostración', 'Elige un perfil para recorrer el sistema con datos de ejemplo.'],
};
const tokenValido = (valor) => /^[A-Za-z0-9_-]{43}$/.test(valor ?? '');
const requisitos = 'Usa al menos 12 caracteres, con una letra y un número (máximo 72 bytes).';
const bytes = (valor) => new TextEncoder().encode(valor).length;

export function Marca({ movil = false }) {
  return <a className={'marca' + (movil ? ' marca-movil' : '')} href="#inicio">
    <span className="monograma" aria-hidden="true">OC</span><span>Órbita Campus</span>
  </a>;
}

function Clave({ nombre = 'clave', titulo = 'Contraseña', nueva, describir = false }) {
  const [visible, setVisible] = useState(false);
  return <div className="campo-clave">
    <label htmlFor={nombre}>{titulo}</label>
    <div className="entrada-clave">
      <input id={nombre} name={nombre} type={visible ? 'text' : 'password'} required maxLength={72}
        minLength={nueva ? 12 : undefined} aria-describedby={describir ? 'reglas-clave' : undefined}
        autoComplete={nueva ? 'new-password' : 'current-password'} />
      <button type="button" onClick={() => setVisible(!visible)} aria-label={(visible ? 'Ocultar ' : 'Mostrar ') + titulo.toLowerCase()}>
        {visible ? 'Ocultar' : 'Mostrar'}
      </button>
    </div>
  </div>;
}

function validarClave(datos) {
  if (datos.clave.length < 12 || bytes(datos.clave) > 72 || !/\p{L}/u.test(datos.clave) || !/\p{Nd}/u.test(datos.clave)) {
    throw new Error(requisitos);
  }
  if (datos.clave !== datos.confirmacion) throw new Error('Las contraseñas deben coincidir.');
}

function CamposNuevaClave() {
  return <>
    <Clave titulo="Nueva contraseña" nueva describir />
    <p id="reglas-clave" className="ayuda-campo">{requisitos}</p>
    <Clave nombre="confirmacion" titulo="Confirmar contraseña" nueva />
  </>;
}

function PerfilesDemo({ sesion, onSesion, destino = 'inicio' }) {
  return <div className="perfiles">{perfiles.map((perfil) => <button key={perfil.id} className="perfil" type="button"
    aria-pressed={sesion?.perfil.id === perfil.id} onClick={() => { onSesion({ perfil }); location.hash = destino; }}>
    <strong>{roles[perfil.rol]}</strong><span>{perfil.nombre}</span>
  </button>)}</div>;
}

export function Acceso({ ruta, onSesion, mensaje, avisar, destino }) {
  const [vista, consulta] = ruta.split('?');
  const opciones = new URLSearchParams(consulta);
  const verificar = opciones.has('verificar');
  const restablecer = opciones.has('restablecer');
  const vistaElegida = vista.startsWith('acceso/') ? vista.slice(7) : '';
  const modo = verificar ? 'verificar' : restablecer ? 'restablecer'
    : ['registro', 'recuperar', 'reenviar', ...(modoDemo ? ['demo'] : [])].includes(vistaElegida) ? vistaElegida : 'login';
  const token = opciones.get(modo);
  return <div className="portal">
    <main id="contenido" className="portal-contenido">
      <header className="portal-cabecera"><Marca /><span>Proyecto académico · UNMSM</span></header>
      <FormularioAcceso key={ruta} modo={modo} token={token} onSesion={onSesion}
        mensaje={mensaje} avisar={avisar} destino={destino} />
      <footer className="portal-pie"><span>Grupo 7 · Taller de Software Web</span>
        <div><a href={informe}>Informe del proyecto</a><a href={repositorio}>GitHub</a></div>
      </footer>
    </main>
    <figure className="portal-imagen">
      <img src={recurso('campus-acceso.jpg')} alt="Edificio universitario junto a un jardín y una vía peatonal" fetchPriority="high" />
      <figcaption><span>Imagen referencial</span><strong>Servicios universitarios</strong>
        <p>Registro, atención y seguimiento de solicitudes del campus.</p></figcaption>
    </figure>
  </div>;
}

function FormularioAcceso({ modo, token, onSesion, mensaje, avisar, destino }) {
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [correo, setCorreo] = useState('');
  const [titulo, texto] = modos[modo];
  const conToken = modo === 'verificar' || modo === 'restablecer';
  const enlaceInvalido = conToken && !tokenValido(token);
  const demo = modo === 'demo';
  async function enviar(evento) {
    evento.preventDefault();
    if (ocupado || enlaceInvalido) return;
    const datos = Object.fromEntries(new FormData(evento.currentTarget));
    setError('');
    avisar('');
    try {
      if (!conToken && !correoValido(datos.correo)) throw new Error('Escribe un correo válido como ejemplo@unmsm.edu.pe.');
      if (datos.correo) datos.correo = datos.correo.trim().toLowerCase();
      if (modo === 'registro') {
        datos.nombre = datos.nombre.trim();
        if (datos.nombre.length < 2) throw new Error('Escribe tu nombre completo.');
      }
      if (modo === 'registro' || modo === 'restablecer') validarClave(datos);
      if ((modo === 'login' || modo === 'verificar') && bytes(datos.clave) > 72) {
        throw new Error('La contraseña supera el máximo de 72 bytes.');
      }
      delete datos.confirmacion;
      if (conToken) datos.token = token;
      setOcupado(true);
      const resultado = await peticion('/auth/' + modo, { metodo: 'POST', cuerpo: datos });
      if (modo === 'login') {
        onSesion(resultado);
        location.hash = destino;
      } else {
        if (modo === 'restablecer') onSesion(null);
        avisar(modo === 'verificar' ? 'Correo verificado. Ya puedes iniciar sesión.'
          : modo === 'restablecer' ? 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.'
          : modo === 'recuperar' ? 'Si la cuenta está activa, recibirás un enlace para restablecer tu contraseña.'
          : 'Si corresponde, recibirás un enlace para verificar tu correo.');
        location.hash = 'acceso';
      }
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setOcupado(false);
    }
  }
  return <section className="portal-forma" aria-labelledby="acceso-titulo">
    {modo !== 'login' && <a href="#acceso" className="enlace acceso-volver">← Volver al inicio de sesión</a>}
    <h1 id="acceso-titulo">{titulo}</h1>
    <p className="portal-intro">{texto}</p>
    {modoDemo && !demo && <p className="aviso acceso-nota">El acceso en línea está pendiente de conexión. Puedes explorar la demostración.</p>}
    {mensaje && modo === 'login' && <p className="aviso" role="status">{mensaje}</p>}
    {(error || enlaceInvalido) && <p className="aviso error" role="alert">{error || 'El enlace es inválido. Solicita uno nuevo.'}</p>}
    {demo ? <PerfilesDemo onSesion={onSesion} destino={destino} />
      : !enlaceInvalido && <form className="formulario formulario-acceso" onSubmit={enviar} aria-busy={ocupado}>
        {modo === 'registro' && <label>Nombre completo<input name="nombre" minLength={2} maxLength={100} required autoComplete="name" /></label>}
        {!conToken && <label htmlFor="correo-institucional">Correo institucional
          <input id="correo-institucional" name="correo" type="email" required maxLength={180} value={correo}
            autoCapitalize="none" spellCheck={false} autoComplete={modo === 'login' ? 'username' : 'email'}
            placeholder="ejemplo@unmsm.edu.pe" onChange={(evento) => setCorreo(evento.target.value)} /></label>}
        {(modo === 'login' || modo === 'verificar') && <Clave />}
        {(modo === 'registro' || modo === 'restablecer') && <CamposNuevaClave />}
        {modo === 'login' && <a className="enlace recuperar" href="#acceso/recuperar">¿Olvidaste tu contraseña?</a>}
        <button className="primario" disabled={ocupado}>{ocupado ? 'Procesando…'
          : ({ recuperar: 'Enviar enlace', reenviar: 'Enviar verificación', restablecer: 'Guardar contraseña' })[modo] ?? titulo}</button>
      </form>}
    {(modo === 'login' || modo === 'verificar') && <nav className="opciones-acceso" aria-label="Opciones de cuenta">
      {modo === 'login' && <a className="enlace" href="#acceso/registro">Crear cuenta</a>}
      <a className="enlace" href="#acceso/reenviar">Reenviar verificación</a></nav>}
    {modo === 'restablecer' && <a className="enlace" href="#acceso/recuperar">Solicitar otro enlace</a>}
    {modoDemo && !demo && <div className="portal-demo"><a className="secundario" href="#acceso/demo">Explorar la demostración →</a></div>}
  </section>;
}

export function MiCuenta({ sesion, onSesion, avisar }) {
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const demo = !sesion.token;
  function cerrar(mensaje) {
    onSesion(null);
    avisar(mensaje);
    location.hash = 'acceso';
  }
  async function cambiar(evento) {
    evento.preventDefault();
    const datos = Object.fromEntries(new FormData(evento.currentTarget));
    setError('');
    try {
      validarClave(datos);
      if (bytes(datos.anterior) > 72) throw new Error('La contraseña actual supera el máximo de 72 bytes.');
      setOcupado(true);
      await peticion('/auth/clave', { metodo: 'POST', cuerpo: { anterior: datos.anterior, clave: datos.clave }, sesion });
      cerrar('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
    } catch (fallo) {
      if (fallo.estado === 401) cerrar('Tu sesión expiró. Vuelve a iniciar sesión.');
      else setError(fallo.message);
    } finally { setOcupado(false); }
  }
  async function salir() {
    setError('');
    setOcupado(true);
    try {
      if (!demo) await peticion('/auth/salir', { metodo: 'POST', sesion });
      cerrar('Sesión cerrada.');
    } catch (fallo) {
      if (fallo.estado === 401) cerrar('Sesión cerrada.');
      else setError('No pudimos cerrar la sesión en el servidor. Inténtalo de nuevo.');
    } finally { setOcupado(false); }
  }
  return <div className="pila">
    <section className="panel cuenta"><h2>{sesion.perfil.nombre}</h2>
      <p>{demo ? 'Datos de demostración' : sesion.perfil.correo} · {roles[sesion.perfil.rol]}</p>
      {demo && <PerfilesDemo sesion={sesion} onSesion={onSesion} />}
      <button className="secundario" disabled={ocupado} onClick={salir}>{demo ? 'Salir de la demostración' : 'Cerrar sesión'}</button>
    </section>
    {error && <p className="aviso error" role="alert">{error}</p>}
    {!demo && <section className="panel cuenta"><h2>Cambiar contraseña</h2>
      <form className="formulario" onSubmit={cambiar}>
        <Clave nombre="anterior" titulo="Contraseña actual" /><CamposNuevaClave />
        <button className="primario" disabled={ocupado}>Guardar y cerrar sesión</button>
      </form>
    </section>}
  </div>;
}
