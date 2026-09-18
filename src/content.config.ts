import { defineCollection, reference } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

import { normalizarRuta } from './lib/convenciones';

const RAIZ_OBRAS = './src/content/obras';

/**
 * Texto en español y, opcionalmente, su version en ingles.
 *
 * `nullish` y no `optional`: en YAML un campo sin rellenar se escribe
 * `en: null`, y `optional()` solo admite que la clave no exista.
 */
const bilingue = z.object({
  es: z.string(),
  en: z.string().nullish(),
});

/** Igual, pero con el ingles obligatorio: las etiquetas del menu van en ingles. */
const bilingueEstricto = z.object({
  es: z.string(),
  en: z.string(),
});

/**
 * Saca el slug de una ruta dentro de `src/content`, quitando el prefijo
 * numerico del segmento que toque. Normaliza los separadores primero, porque
 * en Windows llegan con `\`.
 *
 * @param segmento 0 para la categoria, 1 para la obra.
 */
function slugDesdeRuta(entry: string, segmento: number): string {
  const partes = normalizarRuta(entry).split('/');
  const nombre = partes[segmento] ?? '';
  return nombre.replace(/^\d+-/, '');
}

const categorias = defineCollection({
  loader: glob({
    pattern: '*/categoria.yaml',
    base: RAIZ_OBRAS,
    generateId: ({ entry }) => slugDesdeRuta(entry, 0),
  }),
  schema: z.object({
    nombre: bilingueEstricto,
  }),
});

const obras = defineCollection({
  loader: glob({
    pattern: '*/*/meta.yaml',
    base: RAIZ_OBRAS,
    generateId: ({ entry }) => slugDesdeRuta(entry, 1),
  }),
  schema: z.object({
    titulo: bilingue,
    /** Esculturas e instalaciones. */
    materiales: bilingue.nullish(),
    medidas: bilingue.nullish(),
    /** Performances: comisario, sede, ciudad, pais y año. */
    contexto: bilingue.nullish(),
    anio: z.number().int().nullish(),
    cliente: bilingue.nullish(),
    /** Ruta del PDF de catalogo dentro de `public/`, empezando por `/docs/`. */
    catalogo: z.string().nullish(),
    /** Textos relacionados, del tipo "Marta Borcha. En la época del alma". */
    textos: z
      .array(
        z.object({
          titulo: bilingue,
          fichero: z.string(),
        }),
      )
      .default([]),
    /** Texto alternativo. Si falta, se usa el titulo. */
    alt: bilingue.nullish(),
  }),
});

const noticias = defineCollection({
  loader: glob({
    pattern: '*/meta.yaml',
    base: './src/content/noticias',
    generateId: ({ entry }) => slugDesdeRuta(entry, 0),
  }),
  schema: z.object({
    titulo: bilingue,
    /** URL externa a la nota de prensa, si la hay. */
    enlace: z.url().nullish(),
    fecha: z.coerce.date().nullish(),
    /** Obras relacionadas, por slug. */
    obras: z.array(reference('obras')).default([]),
  }),
});

const trayectoria = defineCollection({
  loader: file('./src/content/trayectoria.yaml'),
  schema: z.object({
    titulo: bilingueEstricto,
    anios: z
      .array(
        z.object({
          anio: z.number().int(),
          /**
           * Cada entrada es una linea suelta. No es `{ es, en }` porque el CV
           * original viene en un solo idioma y traducirlo seria inventarselo.
           */
          entradas: z.array(z.string()).default([]),
        }),
      )
      .default([]),
  }),
});

export const collections = { categorias, obras, noticias, trayectoria };
