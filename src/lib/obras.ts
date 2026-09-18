/**
 * API de datos de las galerias.
 *
 * Junta dos fuentes:
 *   - las imagenes, descubiertas con `import.meta.glob`, que es lo que le da a
 *     Astro los `ImageMetadata` que necesita `<Picture>` para optimizarlas;
 *   - los metadatos, que vienen de las colecciones de contenido.
 *
 * Ninguna ruta ni extension se escribe a mano: todo sale de la convencion.
 * Los errores de estructura se lanzan al cargar, asi que rompen el build en
 * lugar de colarse hasta produccion.
 */

import type { ImageMetadata } from 'astro';
import { getCollection } from 'astro:content';

import {
  analizarCarpeta,
  analizarImagen,
  esSlugReservado,
  normalizarRuta,
  ordenarPorPrefijo,
} from './convenciones';

const RAIZ = '/src/content/obras/';

/**
 * El patron es literal a proposito: `import.meta.glob` lo resuelve en tiempo
 * de build y no admite variables.
 */
const IMAGENES = import.meta.glob<ImageMetadata>(
  '/src/content/obras/*/*/*.{jpg,jpeg,png,webp}',
  { eager: true, import: 'default' },
);

/** Solo las claves: sirve para descubrir que obras existen aunque no tengan imagenes. */
const RUTAS_META = Object.keys(
  import.meta.glob('/src/content/obras/*/*/meta.yaml'),
);

export type Imagen = {
  /** Ruta relativa a la raiz de contenido, por ejemplo `2-x/05-aire/aire-00.jpg`. */
  ruta: string;
  /** Orden dentro de la obra. El 0 es la portada. */
  indice: number;
  src: ImageMetadata;
};

export type Obra = {
  /** Segmento de la URL: `/obra/<slug>/`. */
  slug: string;
  /** Nombre de la carpeta con su prefijo, por ejemplo `05-aire`. */
  carpeta: string;
  /** Orden dentro de la galeria. */
  numero: number;
  /** Slug de la categoria a la que pertenece. */
  categoria: string;
  datos: CollectionObra['data'];
  /** Ordenadas por indice. La primera es siempre la `-00`. */
  imagenes: Imagen[];
  portada: Imagen | null;
};

export type Categoria = {
  slug: string;
  carpeta: string;
  numero: number;
  nombre: { es: string; en: string };
  obras: Obra[];
};

type CollectionObra = Awaited<ReturnType<typeof getCollection<'obras'>>>[number];
type CollectionCategoria = Awaited<ReturnType<typeof getCollection<'categorias'>>>[number];

type Indice = {
  categorias: Categoria[];
  porSlugObra: Map<string, Obra>;
  porRutaImagen: Map<string, ImageMetadata>;
};

let cache: Promise<Indice> | null = null;

function error(mensaje: string): never {
  throw new Error(`[contenido] ${mensaje}`);
}

/** Descompone `/src/content/obras/2-x/05-aire/aire-00.jpg` en sus partes. */
function partesDeRuta(clave: string): { categoria: string; obra: string; fichero: string } | null {
  const relativa = normalizarRuta(clave).replace(RAIZ, '');
  const partes = relativa.split('/');
  if (partes.length !== 3) return null;
  return { categoria: partes[0]!, obra: partes[1]!, fichero: partes[2]! };
}

function construir(
  entradasCategoria: CollectionCategoria[],
  entradasObra: CollectionObra[],
): Indice {
  const metaPorSlug = new Map(entradasObra.map((e) => [e.id, e]));
  const nombrePorSlug = new Map(entradasCategoria.map((e) => [e.id, e.data.nombre]));

  // Estructura: categoria -> obra -> imagenes. Se descubre con las rutas de
  // los meta.yaml para que una obra sin imagenes tambien salte como error.
  const estructura = new Map<string, Map<string, Imagen[]>>();

  const registrarCarpeta = (categoria: string, obra: string) => {
    if (!estructura.has(categoria)) estructura.set(categoria, new Map());
    const obras = estructura.get(categoria)!;
    if (!obras.has(obra)) obras.set(obra, []);
    return obras.get(obra)!;
  };

  for (const clave of RUTAS_META) {
    const p = partesDeRuta(clave);
    if (p !== null) registrarCarpeta(p.categoria, p.obra);
  }

  const porRutaImagen = new Map<string, ImageMetadata>();

  for (const [clave, src] of Object.entries(IMAGENES)) {
    const p = partesDeRuta(clave);
    if (p === null) continue;

    const carpetaObra = analizarCarpeta(p.obra);
    if (carpetaObra === null) {
      error(`la carpeta de obra "${p.obra}" no cumple la convencion <NN>-<slug>`);
    }

    const img = analizarImagen(p.fichero);
    if (img === null) {
      error(`la imagen "${p.categoria}/${p.obra}/${p.fichero}" no cumple <base>-<YY>.<ext>`);
    }
    if (img.base !== carpetaObra.slug) {
      error(
        `"${p.fichero}" deberia empezar por "${carpetaObra.slug}-", que es el nombre de su carpeta`,
      );
    }

    const ruta = `${p.categoria}/${p.obra}/${p.fichero}`;
    porRutaImagen.set(ruta, src);
    registrarCarpeta(p.categoria, p.obra).push({ ruta, indice: img.indice, src });
  }

  const categorias: Categoria[] = [];
  const porSlugObra = new Map<string, Obra>();

  for (const [carpetaCat, obrasPorCarpeta] of estructura) {
    const cat = analizarCarpeta(carpetaCat);
    if (cat === null) {
      error(`la carpeta de categoria "${carpetaCat}" no cumple la convencion <N>-<slug>`);
    }
    if (esSlugReservado(cat.slug)) {
      error(`"${cat.slug}" es un slug reservado y no puede ser una categoria`);
    }

    const nombre = nombrePorSlug.get(cat.slug);
    if (nombre === undefined) {
      error(`falta ${carpetaCat}/categoria.yaml, o su nombre no esta relleno`);
    }

    const obras: Obra[] = [];

    for (const [carpetaObra, imagenes] of obrasPorCarpeta) {
      const o = analizarCarpeta(carpetaObra);
      if (o === null) {
        error(`la carpeta de obra "${carpetaCat}/${carpetaObra}" no cumple <NN>-<slug>`);
      }

      const yaExiste = porSlugObra.get(o.slug);
      if (yaExiste !== undefined) {
        error(
          `el slug de obra "${o.slug}" esta repetido: ${yaExiste.categoria}/${yaExiste.carpeta} y ${cat.slug}/${carpetaObra}. Los slugs son unicos en todo el sitio`,
        );
      }

      const indices = imagenes.map((i) => i.indice);
      const repetidos = indices.filter((n, i) => indices.indexOf(n) !== i);
      if (repetidos.length > 0) {
        error(
          `en ${carpetaCat}/${carpetaObra} hay mas de una imagen con el indice ${repetidos[0]!.toString().padStart(2, '0')}`,
        );
      }
      if (imagenes.length > 0 && !indices.includes(0)) {
        error(`${carpetaCat}/${carpetaObra} no tiene imagen -00, que es la portada`);
      }

      const meta = metaPorSlug.get(o.slug);
      if (meta === undefined) {
        error(`falta ${carpetaCat}/${carpetaObra}/meta.yaml`);
      }

      const ordenadas = [...imagenes].sort((a, b) => a.indice - b.indice);
      const obra: Obra = {
        slug: o.slug,
        carpeta: carpetaObra,
        numero: o.numero,
        categoria: cat.slug,
        datos: meta.data,
        imagenes: ordenadas,
        portada: ordenadas[0] ?? null,
      };
      obras.push(obra);
      porSlugObra.set(o.slug, obra);
    }

    categorias.push({
      slug: cat.slug,
      carpeta: carpetaCat,
      numero: cat.numero,
      nombre,
      obras: ordenarPorPrefijo(obras),
    });
  }

  return { categorias: ordenarPorPrefijo(categorias), porSlugObra, porRutaImagen };
}

async function indice(): Promise<Indice> {
  if (cache === null) {
    cache = (async () => {
      const [cats, obras] = await Promise.all([
        getCollection('categorias'),
        getCollection('obras'),
      ]);
      return construir(cats, obras);
    })();
  }
  return cache;
}

/** Categorias ordenadas por el prefijo numerico de su carpeta. */
export async function getCategorias(): Promise<Categoria[]> {
  return (await indice()).categorias;
}

/** Obras de una categoria, ordenadas. Array vacio si la categoria no existe. */
export async function getObras(categoria: string): Promise<Obra[]> {
  const cats = await getCategorias();
  return cats.find((c) => c.slug === categoria)?.obras ?? [];
}

export async function getObra(slug: string): Promise<Obra | null> {
  return (await indice()).porSlugObra.get(slug) ?? null;
}

/** Obra anterior y siguiente dentro de su misma categoria. No hace bucle. */
export async function getAdyacentes(
  slug: string,
): Promise<{ anterior: Obra | null; siguiente: Obra | null }> {
  const obra = await getObra(slug);
  if (obra === null) return { anterior: null, siguiente: null };
  const hermanas = await getObras(obra.categoria);
  const i = hermanas.findIndex((o) => o.slug === slug);
  return {
    anterior: i > 0 ? hermanas[i - 1]! : null,
    siguiente: i >= 0 && i < hermanas.length - 1 ? hermanas[i + 1]! : null,
  };
}

/**
 * Resuelve una ruta relativa a la raiz de contenido, del tipo
 * `2-sculptures-installations/05-aire/aire-00.jpg`. Devuelve `null` si no
 * existe, para que quien llame pueda pintar un marcador en su lugar.
 */
export async function resolverImagen(rutaRelativa: string): Promise<ImageMetadata | null> {
  return (await indice()).porRutaImagen.get(normalizarRuta(rutaRelativa)) ?? null;
}

/** Texto alternativo de una obra: el explicito si lo hay, si no el titulo. */
export function altDeObra(obra: Obra): { es: string; en?: string | null } {
  return obra.datos.alt ?? obra.datos.titulo;
}
