/**
 * Convencion de nombres del contenido.
 *
 * Este fichero lo importan tanto los componentes de Astro como los scripts de
 * `scripts/`, que Node ejecuta directamente. Por eso:
 *   - no importa nada de `astro:*` ni de ninguna dependencia;
 *   - usa solo sintaxis TypeScript borrable (nada de `enum` ni `namespace`).
 *
 * La regla de fondo es que el nombre de la carpeta, sin su prefijo numerico,
 * ya es el slug de la URL. No hay tablas de equivalencias en ningun sitio.
 */

/** Extensiones de imagen admitidas, siempre en minusculas dentro del repo. */
export const EXTENSIONES_IMAGEN = ['jpg', 'jpeg', 'png', 'webp'] as const;
export type ExtensionImagen = (typeof EXTENSIONES_IMAGEN)[number];

/**
 * Carpeta de categoria o de obra: prefijo numerico, guion y el slug.
 * Minusculas, digitos y guiones. Windows no distingue mayusculas y el build
 * de Cloudflare (Linux) si, asi que aqui no se admiten.
 */
export const RE_CARPETA = /^(\d+)-([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/** Fichero de imagen: `<base>-<YY>.<ext>`, con YY de dos digitos. */
export const RE_IMAGEN = /^(.+)-(\d{2})\.(jpe?g|png|webp)$/i;

/** Marcador sin sustituir, del tipo `[home_img1]` o `[web3forms_key]`. */
export const RE_MARCADOR = /\[[a-z0-9_]+\]/;

/** Slugs que ninguna categoria puede usar, porque chocarian con una ruta. */
export const SLUGS_RESERVADOS = [
  'obra',
  'portfolios',
  'news',
  'trajectory',
  'contact',
  'privacidad',
  'docs',
  '_astro',
  '404',
] as const;

/** Limite duro de Cloudflare: 25 MiB por fichero servido. */
export const MAX_BYTES_FICHERO = 25 * 1024 * 1024;

/** Limite duro de Cloudflare: 20.000 ficheros por version. */
export const MAX_FICHEROS_DIST = 20_000;

/** A partir de aqui, una imagen de `src/` merece un aviso. */
export const AVISO_BYTES_IMAGEN = 5 * 1024 * 1024;

/** Lado largo al que se redimensionan las imagenes para el repo. */
export const LADO_LARGO = 2560;

export type CarpetaAnalizada = {
  /** Nombre completo de la carpeta, con prefijo. */
  carpeta: string;
  /** Valor numerico del prefijo, para ordenar. */
  numero: number;
  /** Nombre sin el prefijo. Es el slug de la URL. */
  slug: string;
};

/**
 * Descompone el nombre de una carpeta. Devuelve `null` si no cumple la
 * convencion, para que quien llame decida si es error o si toca ignorarla.
 */
export function analizarCarpeta(nombre: string): CarpetaAnalizada | null {
  const m = RE_CARPETA.exec(nombre);
  if (m === null) return null;
  return { carpeta: nombre, numero: Number(m[1]), slug: m[2]! };
}

export type ImagenAnalizada = {
  fichero: string;
  /** Nombre base, que debe coincidir con el slug de la carpeta de la obra. */
  base: string;
  /** Orden de la imagen. El 0 es la portada. */
  indice: number;
  /** Extension en minusculas, tal como viene. */
  extension: string;
};

/** Descompone el nombre de un fichero de imagen. `null` si no cumple. */
export function analizarImagen(nombre: string): ImagenAnalizada | null {
  const m = RE_IMAGEN.exec(nombre);
  if (m === null) return null;
  return {
    fichero: nombre,
    base: m[1]!,
    indice: Number(m[2]),
    extension: m[3]!.toLowerCase(),
  };
}

/**
 * Extension con la que se guarda una imagen en el repo.
 * `.jpeg` se normaliza a `.jpg`; el resto se mantiene.
 */
export function extensionNormalizada(extension: string): string {
  const e = extension.toLowerCase();
  return e === 'jpeg' ? 'jpg' : e;
}

/** Ordena carpetas por el valor numerico del prefijo, no alfabeticamente. */
export function ordenarPorPrefijo<T extends { numero: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.numero - b.numero);
}

export function esSlugReservado(slug: string): boolean {
  return (SLUGS_RESERVADOS as readonly string[]).includes(slug);
}

/**
 * Normaliza los separadores de una ruta a `/`, para que las rutas de Windows
 * y las de Linux produzcan el mismo identificador.
 */
export function normalizarRuta(ruta: string): string {
  return ruta.replace(/\\/g, '/');
}

/**
 * Nombre de fichero seguro para servir desde `public/`: minusculas, sin
 * tildes ni espacios. Se usa al copiar los PDFs de catalogo, que en el
 * archivo vienen con nombres como `CAT-todos-los-momentos-vividos.pdf`.
 */
export function sanearNombreFichero(nombre: string): string {
  const punto = nombre.lastIndexOf('.');
  const base = punto === -1 ? nombre : nombre.slice(0, punto);
  const ext = punto === -1 ? '' : nombre.slice(punto).toLowerCase();
  const limpio = base
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${limpio}${ext}`;
}

/** Devuelve los indices que faltan en una secuencia que deberia ir de 0 a n. */
export function huecosDeNumeracion(indices: number[]): number[] {
  if (indices.length === 0) return [];
  const orden = [...indices].sort((a, b) => a - b);
  const huecos: number[] = [];
  for (let i = 0; i < orden[orden.length - 1]!; i++) {
    if (!orden.includes(i)) huecos.push(i);
  }
  return huecos;
}
