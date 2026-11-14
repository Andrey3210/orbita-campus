import { useLayoutEffect, useRef } from 'react';

export function useTransicionVista(vista, lista = true) {
  const elemento = useRef(null);
  const anterior = useRef(null);

  useLayoutEffect(() => {
    const nodo = elemento.current;
    if (!lista || !nodo) return;

    const regreso = vista.split('/').length < (anterior.current?.split('/').length ?? 0);
    anterior.current = vista;
    const reducida = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducida.matches || typeof nodo.animate !== 'function') return;

    const animacion = nodo.animate([
      { opacity: 0.3, transform: regreso ? 'translateY(-9px)' : 'translateY(13px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 250, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)' });
    const detenerSiReduce = (evento) => { if (evento.matches) animacion.cancel(); };
    reducida.addEventListener('change', detenerSiReduce);
    return () => {
      reducida.removeEventListener('change', detenerSiReduce);
      animacion.cancel();
    };
  }, [vista, lista]);

  return elemento;
}
