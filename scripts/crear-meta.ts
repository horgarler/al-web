/**
 * Crea los meta.yaml y categoria.yaml que falten, con TODO donde no haya dato.
 * Nunca sobrescribe un fichero existente.
 *
 *   node scripts/crear-meta.ts
 *   node scripts/crear-meta.ts --desde-info --origen "D:\ruta\recursos"
 *
 * Con --desde-info prerrellena los meta.yaml a partir de los `info.txt` del
 * archivo de originales. El emparejamiento es POR POSICION, no por titulo: los
 * titulos de info.txt no coinciden de forma fiable con los nombres de carpeta
 * (tildes, "·", "in your" frente a "on your"). Si el numero de bloques no
 * cuadra con el de carpetas, aborta esa categoria en lugar de desalinear todo.
 *
 * Es transcripcion, no invencion: lo que no se pueda leer con seguridad queda
 * en TODO. Revisa siempre la tabla que imprime.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { analizarCarpeta } from '../src/lib/convenciones.ts';
import {
  crearRegistro,
  esDirectorio,
  existe,
  ficheros,
  parsearArgumentos,
  subdirectorios,
} from './comun.ts';

const RAIZ_OBRAS = 'src/content/obras';

const args = parsearArgumentos(process.argv.slice(2));
const log = crearRegistro();

const desdeInfo = args.banderas.has('desde-info');
const origen = args.valores.get('origen') ?? process.env['ORIGINALES_DIR'];

if (desdeInfo && origen === undefined) {
  console.error('--desde-info necesita --origen <ruta a recursos>.');
  process.exit(2);
}

/** Escapa una cadena para YAML entre comillas dobles. */
function yaml(valor: string): string {
  return `"${valor.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

type Bloque = {
  titulo: string;
  /** Parrafos del bloque, ya sin lineas vacias. */
  parrafos: string[][];
};

/** Parte un info.txt en bloques `# Titulo` + parrafos. */
function parsearInfo(contenido: string): Bloque[] {
  const bloques: Bloque[] = [];
  let actual: Bloque | null = null;
  let parrafo: string[] = [];

  const cerrarParrafo = () => {
    if (parrafo.length > 0 && actual !== null) actual.parrafos.push(parrafo);
    parrafo = [];
  };

  for (const cruda of contenido.split(/\r?\n/)) {
    const linea = cruda.trim();

    if (linea.startsWith('# ')) {
      cerrarParrafo();
      if (actual !== null) bloques.push(actual);
      actual = { titulo: linea.slice(2).trim(), parrafos: [] };
      continue;
    }

    if (linea === '') {
      cerrarParrafo();
      continue;
    }

    parrafo.push(linea);
  }

  cerrarParrafo();
  if (actual !== null) bloques.push(actual);
  return bloques;
}

type Campos = {
  titulo: string;
  materiales: [string, string] | null;
  medidas: [string, string] | null;
  contexto: [string, string] | null;
};

/**
 * Traduce un bloque a campos.
 *
 * Esculturas: parrafo 1 = materiales (ES, EN), parrafo 2 = medidas (ES, EN).
 * Performances: primer parrafo = ficha en español, ultimo = en ingles.
 */
function camposDeBloque(bloque: Bloque, esPerformance: boolean): Campos {
  const base: Campos = {
    titulo: bloque.titulo,
    materiales: null,
    medidas: null,
    contexto: null,
  };

  if (esPerformance) {
    const parrafos = bloque.parrafos;
    if (parrafos.length >= 2) {
      base.contexto = [
        parrafos[0]!.join(' '),
        parrafos[parrafos.length - 1]!.join(' '),
      ];
    }
    return base;
  }

  const par = (p: string[] | undefined): [string, string] | null =>
    p !== undefined && p.length >= 2 ? [p[0]!, p[1]!] : null;

  base.materiales = par(bloque.parrafos[0]);
  base.medidas = par(bloque.parrafos[1]);
  return base;
}

function plantillaMeta(campos: Campos | null, nombreCarpeta: string): string {
  const titulo = campos?.titulo ?? `TODO: título de ${nombreCarpeta}`;

  const bilingue = (par: [string, string] | null, sangria: string) =>
    par === null
      ? ' null'
      : `\n${sangria}es: ${yaml(par[0])}\n${sangria}en: ${yaml(par[1])}`;

  return `# Generado por scripts/crear-meta.ts. Revisa y completa lo que falte.
titulo:
  es: ${yaml(titulo)}
  en: null

# Esculturas e instalaciones
materiales:${bilingue(campos?.materiales ?? null, '  ')}
medidas:${bilingue(campos?.medidas ?? null, '  ')}

# Performances: comisario, sede, ciudad, país y año
contexto:${bilingue(campos?.contexto ?? null, '  ')}

anio: null
cliente: null
catalogo: null
textos: []
alt: null
`;
}

function plantillaCategoria(slug: string): string {
  return `# Generado por scripts/crear-meta.ts. Revisa y completa lo que falte.
# nombre.en es la etiqueta que sale en el menú.
nombre:
  es: "TODO: nombre en español de ${slug}"
  en: "TODO: nombre en inglés de ${slug}"
`;
}

// --- Recorrido -------------------------------------------------------------

if (!esDirectorio(RAIZ_OBRAS)) {
  log.info(`No existe ${RAIZ_OBRAS}. Ejecuta antes \`npm run imagenes\`.`);
  process.exit(0);
}

let creados = 0;

for (const carpetaCat of subdirectorios(RAIZ_OBRAS)) {
  const cat = analizarCarpeta(carpetaCat);
  if (cat === null) {
    log.aviso(`${carpetaCat} no cumple la convencion, se omite`);
    continue;
  }

  const rutaCat = join(RAIZ_OBRAS, carpetaCat);
  const rutaCategoriaYaml = join(rutaCat, 'categoria.yaml');

  if (!existe(rutaCategoriaYaml)) {
    mkdirSync(rutaCat, { recursive: true });
    writeFileSync(rutaCategoriaYaml, plantillaCategoria(cat.slug), 'utf8');
    log.info(`creado ${carpetaCat}/categoria.yaml`);
    creados++;
  }

  const carpetasObra = subdirectorios(rutaCat);

  // --- Emparejamiento con info.txt, si se ha pedido ---
  let bloques: Bloque[] | null = null;
  const esPerformance = /performance/i.test(cat.slug);

  if (desdeInfo && origen !== undefined) {
    const rutaInfo = join(origen, 'img', carpetaCat, 'info.txt');
    if (!existe(rutaInfo)) {
      log.aviso(`no hay info.txt para ${carpetaCat}, se rellena con TODO`);
    } else {
      const leidos = parsearInfo(readFileSync(rutaInfo, 'utf8'));
      if (leidos.length !== carpetasObra.length) {
        log.error(
          `${carpetaCat}: info.txt tiene ${leidos.length} bloques y hay ${carpetasObra.length} carpetas de obra. No se puede emparejar por posicion; se rellena con TODO`,
        );
      } else {
        bloques = leidos;
        log.info('');
        log.info(`  ${carpetaCat}: emparejamiento por posicion`);
        carpetasObra.forEach((carpeta, i) => {
          log.info(`    ${carpeta.padEnd(52)} <- ${leidos[i]!.titulo}`);
        });
        log.info('');
      }
    }
  }

  carpetasObra.forEach((carpetaObra, i) => {
    const rutaMeta = join(rutaCat, carpetaObra, 'meta.yaml');
    if (existe(rutaMeta)) return;
    if (ficheros(join(rutaCat, carpetaObra)).length === 0) return;

    const campos =
      bloques !== null ? camposDeBloque(bloques[i]!, esPerformance) : null;

    // Si el bloque traia texto y no ha encajado en ningun campo, avisa: hay
    // dato que se estaria perdiendo y lo tiene que colocar una persona.
    if (campos !== null && bloques !== null) {
      const vacio =
        campos.materiales === null && campos.medidas === null && campos.contexto === null;
      if (vacio && bloques[i]!.parrafos.length > 0) {
        const muestra = bloques[i]!.parrafos[0]!.join(' ').slice(0, 60);
        log.aviso(
          `${carpetaCat}/${carpetaObra}: info.txt trae texto que no encaja en el formato habitual ("${muestra}"). Ponlo a mano en meta.yaml`,
        );
      }
    }

    writeFileSync(rutaMeta, plantillaMeta(campos, carpetaObra), 'utf8');
    log.info(`creado ${carpetaCat}/${carpetaObra}/meta.yaml`);
    creados++;
  });
}

const { avisos, errores } = log.resumen();
log.info('');
log.info(`Creados: ${creados}   Avisos: ${avisos}   Errores: ${errores}`);
if (creados > 0 && !desdeInfo) {
  log.info('Rellena los TODO antes de publicar.');
}
