/**
 * Configuracion del sitio. Un unico sitio donde tocar nombres, rutas fijas,
 * el breakpoint movil y los presets de imagen.
 *
 * Este fichero lo consume el codigo de Astro. Lo que tambien necesitan los
 * scripts de Node vive en `src/lib/convenciones.ts`, que no importa nada de
 * `astro:*`.
 */

export const sitio = {
  nombre: 'Ángela Lergo',
  /** Host canonico. Es el que sirve WordPress hoy, asi que los enlaces viejos lo conservan. */
  url: 'https://www.angelalergo.com',
  idioma: 'es',
  descripcion: {
    es: 'Ángela Lergo, escultora y performer. Sevilla, España.',
    en: 'Ángela Lergo, sculptor and performance artist. Seville, Spain.',
  },
} as const;

/**
 * Breakpoint movil, en pixeles.
 *
 * El JavaScript lo usa con `matchMedia`. El CSS tiene que repetir el valor a
 * mano, porque las custom properties no funcionan dentro de una media query:
 * busca el comentario que remite a esta constante en `src/styles/`.
 */
export const BREAKPOINT_MOVIL = 768;

/** Ancho de la barra lateral en escritorio, en pixeles. Lo usa el `sizes` del hero. */
export const ANCHO_BARRA = 203;

/**
 * Apartados del menu que no son galerias.
 *
 * `posicion` ordena el menu completo. Las categorias se intercalan usando el
 * prefijo numerico de su carpeta (2, 3...), que cae entre HOME y NEWS.
 */
export const APARTADOS_FIJOS = [
  { clave: 'home', etiqueta: 'Home', ruta: '/', posicion: 0 },
  { clave: 'news', etiqueta: 'News', ruta: '/news/', posicion: 100 },
  { clave: 'trajectory', etiqueta: 'Trajectory', ruta: '/trajectory/', posicion: 110 },
  { clave: 'contact', etiqueta: 'Contact', ruta: '/contact/', posicion: 120 },
] as const;

/**
 * Presets de imagen. `widths` son los anchos que genera `<Picture>` y `sizes`
 * le dice al navegador cuanto espacio ocupara la imagen.
 */
export const PRESETS_IMAGEN = {
  /** Tarjeta de galeria. Con `auto-fill` y un minimo de 300px, nunca pasa de 600px. */
  miniatura: {
    widths: [320, 480, 640, 960, 1280],
    sizes: '(max-width: 599px) 100vw, 600px',
  },
  /** Carrusel de la ficha de obra. */
  detalle: {
    widths: [640, 960, 1280, 1920, 2560],
    sizes: `(max-width: ${BREAKPOINT_MOVIL}px) 100vw, calc(100vw - ${ANCHO_BARRA}px)`,
  },
  /** Imagenes de la rotacion de la home, a sangre. */
  hero: {
    widths: [768, 1024, 1280, 1600, 1920, 2560],
    sizes: `(max-width: ${BREAKPOINT_MOVIL}px) 100vw, calc(100vw - ${ANCHO_BARRA}px)`,
  },
} as const;

export type NombrePreset = keyof typeof PRESETS_IMAGEN;

/**
 * Clave de acceso de Web3Forms. Es publica por diseño: no revela el destino
 * y no es un secreto, asi que va en el repo.
 *
 * Mientras siga siendo el marcador, el formulario se muestra deshabilitado y
 * `validar-contenido.ts --estricto` falla.
 */
export const WEB3FORMS_KEY = '[web3forms_key]';

/** Asunto fijo de los correos que manda el formulario. */
export const WEB3FORMS_ASUNTO = 'Mensaje desde angelalergo.com';
