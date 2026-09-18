/**
 * Comprueba que el contenido cumple la convencion y que cabe en los limites
 * de Cloudflare. Lo llama `npm run build` antes de compilar.
 *
 *   node scripts/validar-contenido.ts [--estricto]
 *
 * Con --estricto, los TODO y los marcadores `[...]` sin sustituir pasan de
 * aviso a error. Tambien se activa solo cuando detecta que la build es de la
 * rama de produccion.
 *
 * IMPORTANTE: el comando de despliegue de produccion debe pasar --estricto si
 * Workers Builds no expone las variables de rama. Ver docs/decisiones.md.
 */

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  analizarCarpeta,
  analizarImagen,
  AVISO_BYTES_IMAGEN,
  esSlugReservado,
  huecosDeNumeracion,
  MAX_BYTES_FICHERO,
  MAX_FICHEROS_DIST,
  normalizarRuta,
  RE_MARCADOR,
} from '../src/lib/convenciones.ts';
import {
  crearRegistro,
  esDirectorio,
  ficheros,
  ficherosRecursivos,
  formatearBytes,
  parsearArgumentos,
  subdirectorios,
} from './comun.ts';

const RAIZ_OBRAS = 'src/content/obras';
const RAIZ_NOTICIAS = 'src/content/noticias';
const FICHERO_TRAYECTORIA = 'src/content/trayectoria.yaml';
const CONFIG = ['src/config/site.ts', 'src/config/plantilla.ts'];
const DIST = 'dist';

const args = parsearArgumentos(process.argv.slice(2));
const log = crearRegistro();

/**
 * Workers Builds inyecta la rama en estas variables. Si ninguna esta, no se
 * puede saber si es produccion, asi que se queda en modo permisivo.
 */
function esRamaProduccion(): boolean {
  const rama =
    process.env['WORKERS_CI_BRANCH'] ??
    process.env['CF_PAGES_BRANCH'] ??
    process.env['GITHUB_REF_NAME'];
  return rama === 'main';
}

const estricto = args.banderas.has('estricto') || esRamaProduccion();
log.info(estricto ? 'Validando en modo estricto.' : 'Validando.');
log.info('');

/** Un TODO o un marcador pendiente: aviso, o error si vamos en estricto. */
function pendiente(mensaje: string) {
  if (estricto) log.error(mensaje);
  else log.aviso(mensaje);
}

// --- Estructura de las galerias --------------------------------------------

const slugsObra = new Map<string, string>();
let totalObras = 0;

for (const carpetaCat of subdirectorios(RAIZ_OBRAS)) {
  const cat = analizarCarpeta(carpetaCat);
  if (cat === null) {
    log.error(`${RAIZ_OBRAS}/${carpetaCat}: no cumple <N>-<slug> en minusculas con guiones`);
    continue;
  }
  if (esSlugReservado(cat.slug)) {
    log.error(`"${cat.slug}" es un slug reservado y no puede ser una categoria`);
  }

  const rutaCat = join(RAIZ_OBRAS, carpetaCat);
  if (!ficheros(rutaCat).includes('categoria.yaml')) {
    log.error(`falta ${carpetaCat}/categoria.yaml`);
  }

  const numerosObra = new Map<number, string>();

  for (const carpetaObra of subdirectorios(rutaCat)) {
    const obra = analizarCarpeta(carpetaObra);
    if (obra === null) {
      log.error(`${carpetaCat}/${carpetaObra}: no cumple <NN>-<slug>`);
      continue;
    }
    totalObras++;

    const yaNumero = numerosObra.get(obra.numero);
    if (yaNumero !== undefined) {
      log.error(`${carpetaCat}: "${yaNumero}" y "${carpetaObra}" comparten el numero ${obra.numero}`);
    }
    numerosObra.set(obra.numero, carpetaObra);

    const yaSlug = slugsObra.get(obra.slug);
    if (yaSlug !== undefined) {
      log.error(
        `el slug "${obra.slug}" esta en ${yaSlug} y en ${carpetaCat}/${carpetaObra}. Los slugs son unicos en todo el sitio`,
      );
    }
    slugsObra.set(obra.slug, `${carpetaCat}/${carpetaObra}`);

    const rutaObra = join(rutaCat, carpetaObra);
    const listado = ficheros(rutaObra);

    if (!listado.includes('meta.yaml')) {
      log.error(`falta ${carpetaCat}/${carpetaObra}/meta.yaml`);
    }

    const indices: number[] = [];
    for (const fichero of listado) {
      if (/\.ya?ml$/i.test(fichero)) continue;

      const img = analizarImagen(fichero);
      if (img === null) {
        log.error(`${carpetaCat}/${carpetaObra}/${fichero}: no cumple <base>-<YY>.<ext>`);
        continue;
      }
      if (img.base !== obra.slug) {
        log.error(`${carpetaCat}/${carpetaObra}/${fichero}: deberia empezar por "${obra.slug}-"`);
      }
      if (indices.includes(img.indice)) {
        log.error(
          `${carpetaCat}/${carpetaObra}: el indice ${String(img.indice).padStart(2, '0')} esta repetido`,
        );
      }
      indices.push(img.indice);

      const bytes = statSync(join(rutaObra, fichero)).size;
      if (bytes > AVISO_BYTES_IMAGEN) {
        log.aviso(
          `${carpetaCat}/${carpetaObra}/${fichero} pesa ${formatearBytes(bytes)}, por encima de ${formatearBytes(AVISO_BYTES_IMAGEN)}`,
        );
      }
    }

    if (indices.length === 0) {
      log.error(`${carpetaCat}/${carpetaObra} no tiene ninguna imagen`);
    } else {
      if (!indices.includes(0)) {
        log.error(`${carpetaCat}/${carpetaObra} no tiene imagen -00 (la portada)`);
      }
      const huecos = huecosDeNumeracion(indices);
      if (huecos.length > 0) {
        log.aviso(
          `${carpetaCat}/${carpetaObra}: faltan los indices ${huecos.map((h) => String(h).padStart(2, '0')).join(', ')}`,
        );
      }
    }
  }
}

// --- Noticias --------------------------------------------------------------

for (const carpeta of subdirectorios(RAIZ_NOTICIAS)) {
  if (analizarCarpeta(carpeta) === null) {
    log.error(`${RAIZ_NOTICIAS}/${carpeta}: no cumple <NN>-<slug>`);
    continue;
  }
  if (!ficheros(join(RAIZ_NOTICIAS, carpeta)).includes('meta.yaml')) {
    log.error(`falta ${RAIZ_NOTICIAS}/${carpeta}/meta.yaml`);
  }
}

// --- TODO y marcadores sin sustituir ---------------------------------------

const ficherosTexto = [
  ...ficherosRecursivos(RAIZ_OBRAS).filter((f) => /\.ya?ml$/i.test(f)),
  ...ficherosRecursivos(RAIZ_NOTICIAS).filter((f) => /\.ya?ml$/i.test(f)),
  FICHERO_TRAYECTORIA,
  ...CONFIG,
].filter((f) => {
  try {
    return statSync(f).isFile();
  } catch {
    return false;
  }
});

for (const fichero of ficherosTexto) {
  const contenido = readFileSync(fichero, 'utf8');
  const ruta = normalizarRuta(fichero);

  contenido.split(/\r?\n/).forEach((linea, i) => {
    if (linea.includes('TODO')) {
      pendiente(`${ruta}:${i + 1} tiene un TODO`);
    }
    const marcador = RE_MARCADOR.exec(linea);
    if (marcador !== null) {
      pendiente(`${ruta}:${i + 1} tiene el marcador ${marcador[0]} sin sustituir`);
    }
  });
}

// --- Limites de Cloudflare -------------------------------------------------

if (esDirectorio(DIST)) {
  const todos = ficherosRecursivos(DIST);
  let bytesTotales = 0;

  for (const fichero of todos) {
    const bytes = statSync(fichero).size;
    bytesTotales += bytes;
    if (bytes > MAX_BYTES_FICHERO) {
      log.error(
        `${normalizarRuta(fichero)} pesa ${formatearBytes(bytes)}, por encima del limite de Cloudflare (${formatearBytes(MAX_BYTES_FICHERO)})`,
      );
    }
  }

  if (todos.length > MAX_FICHEROS_DIST) {
    log.error(
      `dist tiene ${todos.length} ficheros y el limite por version es ${MAX_FICHEROS_DIST}`,
    );
  }

  log.info(`dist: ${todos.length} ficheros, ${formatearBytes(bytesTotales)}`);
} else {
  log.info('dist todavia no existe: los limites de Cloudflare se comprobaran tras el build.');
}

// --- Resumen ---------------------------------------------------------------

const { avisos, errores } = log.resumen();
log.info('');
log.info(`Obras: ${totalObras}   Avisos: ${avisos}   Errores: ${errores}`);

if (errores > 0) {
  log.info('');
  log.info('El build no puede continuar. Corrige los errores de arriba.');
  process.exit(1);
}
