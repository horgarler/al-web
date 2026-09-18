/**
 * Genera las versiones web del contenido a partir del archivo de originales.
 *
 *   node scripts/preparar-imagenes.ts --origen "D:\ruta\recursos"
 *
 * Opciones:
 *   --origen <ruta>   Raiz de `recursos`, no de `recursos/img`. Tambien vale
 *                     la variable de entorno ORIGINALES_DIR.
 *   --solo <ruta>     Procesa solo una categoria o una obra, por ejemplo
 *                     `2-sculptures-installations/05-aire`.
 *   --dry-run         Enseña lo que haria sin escribir nada.
 *   --forzar          Reprocesa aunque el destino sea mas reciente.
 *   --limpiar         Borra del repo lo que ya no esta en el origen.
 *
 * El archivo de originales es de SOLO LECTURA: este script nunca escribe ahi.
 */

import { copyFileSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import sharp from 'sharp';

import {
  analizarCarpeta,
  analizarImagen,
  extensionNormalizada,
  huecosDeNumeracion,
  LADO_LARGO,
  normalizarRuta,
  sanearNombreFichero,
} from '../src/lib/convenciones.ts';
import {
  crearRegistro,
  enLotes,
  esDirectorio,
  existe,
  ficheros,
  ficherosRecursivos,
  formatearBytes,
  parsearArgumentos,
  subdirectorios,
} from './comun.ts';

const CALIDAD = 85;
const CONCURRENCIA = 4;

const DESTINO_OBRAS = 'src/content/obras';
const DESTINO_PDFS = 'public/docs';
/** Secciones que no son galeria: home, news... Imagenes sueltas, sin ficha. */
const DESTINO_SUELTAS = 'src/content';

const args = parsearArgumentos(process.argv.slice(2));
const log = crearRegistro();

const origen = args.valores.get('origen') ?? process.env['ORIGINALES_DIR'];
const solo = args.valores.get('solo');
const dryRun = args.banderas.has('dry-run');
const forzar = args.banderas.has('forzar');
const limpiar = args.banderas.has('limpiar');

if (origen === undefined) {
  console.error('Falta --origen <ruta> (o la variable ORIGINALES_DIR).');
  console.error('Apunta a la raiz de `recursos`, la que contiene img/ y textos/.');
  process.exit(2);
}

const raizImg = join(origen, 'img');
const raizTextos = join(origen, 'textos');

if (!esDirectorio(raizImg)) {
  console.error(`No existe ${raizImg}. --origen debe apuntar a la raiz de recursos.`);
  process.exit(2);
}

type Destino = { origen: string; destino: string; bytesOrigen: number };

const aProcesar: Destino[] = [];
const generados = new Set<string>();
let bytesDespues = 0;

/** ¿Hay que rehacer el destino? */
function desactualizado(rutaOrigen: string, rutaDestino: string): boolean {
  if (forzar) return true;
  if (!existe(rutaDestino)) return true;
  return statSync(rutaOrigen).mtimeMs > statSync(rutaDestino).mtimeMs;
}

function coincideConSolo(categoria: string, obra?: string): boolean {
  if (solo === undefined) return true;
  const objetivo = normalizarRuta(solo).replace(/\/$/, '');
  const actual = obra === undefined ? categoria : `${categoria}/${obra}`;
  return actual === objetivo || actual.startsWith(`${objetivo}/`) || objetivo.startsWith(`${actual}/`);
}

/**
 * Codifica conservando el formato. El PNG solo se mantiene si tiene
 * transparencia de verdad; si es opaco pesa mucho menos como JPEG.
 */
async function procesarImagen(rutaOrigen: string, ext: string) {
  const base = sharp(rutaOrigen)
    // .rotate() sin argumentos aplica la orientacion EXIF.
    .rotate()
    .resize({ width: LADO_LARGO, height: LADO_LARGO, fit: 'inside', withoutEnlargement: true });

  if (ext === 'webp') {
    return { buffer: await base.webp({ quality: CALIDAD }).toBuffer(), ext: 'webp' };
  }

  if (ext === 'png') {
    const meta = await sharp(rutaOrigen).metadata();
    let opaco = !meta.hasAlpha;
    if (meta.hasAlpha) {
      const stats = await sharp(rutaOrigen).stats();
      opaco = stats.isOpaque;
    }
    if (!opaco) {
      return { buffer: await base.png().toBuffer(), ext: 'png' };
    }
    return { buffer: await base.jpeg({ quality: CALIDAD, mozjpeg: true }).toBuffer(), ext: 'jpg' };
  }

  return { buffer: await base.jpeg({ quality: CALIDAD, mozjpeg: true }).toBuffer(), ext: 'jpg' };
}

// --- Recorrido del archivo -------------------------------------------------

log.info(`Origen:  ${origen}`);
log.info(`Destino: ${DESTINO_OBRAS}/`);
if (solo !== undefined) log.info(`Filtro:  ${solo}`);
if (dryRun) log.info('Modo:    dry-run, no se escribe nada');
log.info('');

let bytesAntes = 0;

for (const carpetaCat of subdirectorios(raizImg)) {
  const cat = analizarCarpeta(carpetaCat);
  if (cat === null) {
    log.error(`"${carpetaCat}" no cumple <N>-<slug> en minusculas con guiones`);
    continue;
  }

  if (!coincideConSolo(carpetaCat)) continue;

  const rutaCat = join(raizImg, carpetaCat);
  const carpetasObra = subdirectorios(rutaCat);

  /*
   * Una categoria de galeria tiene subcarpetas de obra. Home, news y trajectory
   * son imagenes sueltas: no son obras, no tienen ficha ni slug propio, y van a
   * `src/content/<slug>/` para que las use quien las necesite (la rotacion de
   * la home, por ejemplo).
   *
   * Como no son obras, no se les exige la convencion `<base>-<YY>`: basta con
   * sanear el nombre para poder servirlo.
   */
  if (carpetasObra.length === 0) {
    const sueltas = ficheros(rutaCat).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    if (sueltas.length === 0) {
      log.info(`· ${carpetaCat}: vacia, nada que hacer.`);
      continue;
    }

    log.info(`· ${carpetaCat} (${sueltas.length} imagenes sueltas)`);

    const noAdmitidas = ficheros(rutaCat).filter(
      (f) => /\.[a-z0-9]+$/i.test(f) && !/\.(jpe?g|png|webp|txt|md|ya?ml)$/i.test(f),
    );
    for (const f of noAdmitidas) {
      log.aviso(`${carpetaCat}/${f}: formato no admitido, se omite`);
    }

    for (const fichero of sueltas) {
      const ext = (fichero.split('.').pop() ?? 'jpg').toLowerCase();
      const base = sanearNombreFichero(fichero).replace(/\.[^.]+$/, '');
      const carpetaDestino = join(DESTINO_SUELTAS, cat.slug);
      const rutaOrigenAbs = join(rutaCat, fichero);

      generados.add(normalizarRuta(join(carpetaDestino, `${base}.${extensionNormalizada(ext)}`)));
      generados.add(normalizarRuta(join(carpetaDestino, `${base}.jpg`)));

      const bytes = statSync(rutaOrigenAbs).size;
      bytesAntes += bytes;

      if (
        desactualizado(rutaOrigenAbs, join(carpetaDestino, `${base}.${extensionNormalizada(ext)}`))
      ) {
        aProcesar.push({
          origen: rutaOrigenAbs,
          destino: join(carpetaDestino, base),
          bytesOrigen: bytes,
        });
      }
    }

    continue;
  }

  log.info(`· ${carpetaCat} (${carpetasObra.length} obras)`);

  for (const carpetaObra of carpetasObra) {
    if (!coincideConSolo(carpetaCat, carpetaObra)) continue;

    const obra = analizarCarpeta(carpetaObra);
    if (obra === null) {
      log.error(`"${carpetaCat}/${carpetaObra}" no cumple <NN>-<slug>`);
      continue;
    }

    const rutaObra = join(rutaCat, carpetaObra);
    const indices: number[] = [];

    for (const fichero of ficheros(rutaObra)) {
      const img = analizarImagen(fichero);
      if (img === null) {
        if (!/\.(txt|md|yaml|yml|pdf)$/i.test(fichero)) {
          log.aviso(`${carpetaCat}/${carpetaObra}/${fichero} no cumple <base>-<YY>.<ext>, se omite`);
        }
        continue;
      }
      if (img.base !== obra.slug) {
        log.error(
          `${carpetaCat}/${carpetaObra}/${fichero}: deberia empezar por "${obra.slug}-"`,
        );
        continue;
      }
      if (indices.includes(img.indice)) {
        log.error(
          `${carpetaCat}/${carpetaObra}: el indice ${String(img.indice).padStart(2, '0')} esta repetido`,
        );
        continue;
      }
      indices.push(img.indice);

      const extFinal = extensionNormalizada(img.extension);
      const nombreDestino = `${obra.slug}-${String(img.indice).padStart(2, '0')}`;
      const carpetaDestino = join(DESTINO_OBRAS, carpetaCat, carpetaObra);
      const rutaOrigenAbs = join(rutaObra, fichero);

      generados.add(normalizarRuta(join(carpetaDestino, `${nombreDestino}.${extFinal}`)));
      // El PNG opaco acaba en .jpg, asi que tambien se marca como generado el
      // nombre alternativo para que --limpiar no lo borre por sorpresa.
      generados.add(normalizarRuta(join(carpetaDestino, `${nombreDestino}.jpg`)));

      const bytes = statSync(rutaOrigenAbs).size;
      bytesAntes += bytes;

      if (desactualizado(rutaOrigenAbs, join(carpetaDestino, `${nombreDestino}.${extFinal}`))) {
        aProcesar.push({
          origen: rutaOrigenAbs,
          destino: join(carpetaDestino, nombreDestino),
          bytesOrigen: bytes,
        });
      }
    }

    if (indices.length === 0) {
      log.aviso(`${carpetaCat}/${carpetaObra} no tiene ninguna imagen`);
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

    // --- PDFs y metadatos del arbol paralelo `textos/` ---
    const rutaTextos = join(raizTextos, carpetaCat, carpetaObra);
    for (const fichero of ficheros(rutaTextos)) {
      if (/\.pdf$/i.test(fichero)) {
        const destino = join(DESTINO_PDFS, cat.slug, obra.slug, sanearNombreFichero(fichero));
        if (!existe(destino)) {
          if (!dryRun) {
            mkdirSync(dirname(destino), { recursive: true });
            copyFileSync(join(rutaTextos, fichero), destino);
          }
          log.info(`    pdf  ${fichero} -> ${normalizarRuta(destino)}`);
        }
      } else if (/^(meta|categoria)\.ya?ml$/i.test(fichero)) {
        const destino = join(DESTINO_OBRAS, carpetaCat, carpetaObra, fichero.toLowerCase());
        if (!existe(destino)) {
          if (!dryRun) {
            mkdirSync(dirname(destino), { recursive: true });
            copyFileSync(join(rutaTextos, fichero), destino);
          }
          log.info(`    meta ${fichero}`);
        }
      }
      // Los .txt no se copian: son material de partida para rellenar los
      // meta.yaml a mano, no contenido del sitio.
    }
  }
}

// --- Procesado -------------------------------------------------------------

log.info('');
if (aProcesar.length === 0) {
  log.info('No hay imagenes que procesar: todo esta al dia.');
} else {
  log.info(`Procesando ${aProcesar.length} imagenes...`);

  const tareas = aProcesar.map((item) => async () => {
    const ext = (item.origen.split('.').pop() ?? 'jpg').toLowerCase();
    try {
      const { buffer, ext: extFinal } = await procesarImagen(item.origen, ext);
      const destinoFinal = `${item.destino}.${extFinal}`;
      if (!dryRun) {
        mkdirSync(dirname(destinoFinal), { recursive: true });
        writeFileSync(destinoFinal, buffer);
      }
      bytesDespues += buffer.length;
      log.info(
        `    ${normalizarRuta(relative(DESTINO_OBRAS, destinoFinal))}  ${formatearBytes(item.bytesOrigen)} -> ${formatearBytes(buffer.length)}`,
      );
    } catch (e) {
      log.error(`${item.origen}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  await enLotes(tareas, CONCURRENCIA);
}

// --- Huerfanos -------------------------------------------------------------

if (solo === undefined) {
  const enRepo = ficherosRecursivos(DESTINO_OBRAS)
    .map((f) => normalizarRuta(f))
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f));

  const huerfanos = enRepo.filter((f) => !generados.has(f));
  if (huerfanos.length > 0) {
    log.info('');
    log.info(`Huerfanos (en el repo pero ya no en el origen): ${huerfanos.length}`);
    for (const h of huerfanos) {
      if (limpiar && !dryRun) {
        rmSync(h);
        log.info(`    borrado ${h}`);
      } else {
        log.aviso(`${h}  (usa --limpiar para borrarlo)`);
      }
    }
  }
}

// --- Resumen ---------------------------------------------------------------

const { avisos, errores } = log.resumen();
log.info('');
log.info(`Origen: ${formatearBytes(bytesAntes)}   Generado: ${formatearBytes(bytesDespues)}`);
log.info(`Avisos: ${avisos}   Errores: ${errores}`);

if (errores > 0) process.exit(1);
