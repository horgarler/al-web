/**
 * Comprueba que una lista de URLs antiguas sigue respondiendo, siguiendo las
 * redirecciones. Sirve para verificar la migracion contra la URL de
 * workers.dev antes de tocar el DNS.
 *
 *   node scripts/comprobar-urls.ts --base https://x.y.workers.dev --lista docs/urls-wordpress.txt
 *
 * La lista admite URLs completas o rutas sueltas; de cada linea se usa solo la
 * ruta y la query, y se pega a --base.
 */

import { readFileSync } from 'node:fs';

import { crearRegistro, parsearArgumentos } from './comun.ts';

const MAX_SALTOS = 5;
const CONCURRENCIA = 6;

const args = parsearArgumentos(process.argv.slice(2));
const log = crearRegistro();

const base = args.valores.get('base');
const lista = args.valores.get('lista');

if (base === undefined || lista === undefined) {
  console.error('Uso: node scripts/comprobar-urls.ts --base <url> --lista <fichero>');
  process.exit(2);
}

/** Se queda con la ruta y la query, venga una URL completa o una ruta. */
function soloRuta(linea: string): string | null {
  const limpia = linea.trim();
  if (limpia === '' || limpia.startsWith('#')) return null;
  try {
    const u = new URL(limpia);
    return u.pathname + u.search;
  } catch {
    return limpia.startsWith('/') ? limpia : `/${limpia}`;
  }
}

type Resultado = {
  ruta: string;
  estado: number | null;
  saltos: string[];
  nota: string | null;
};

async function seguir(ruta: string): Promise<Resultado> {
  const saltos: string[] = [];
  let actual = new URL(ruta, base).href;

  for (let i = 0; i <= MAX_SALTOS; i++) {
    let respuesta: Response;
    try {
      respuesta = await fetch(actual, { redirect: 'manual' });
    } catch (e) {
      return {
        ruta,
        estado: null,
        saltos,
        nota: `no se pudo conectar: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    const destino = respuesta.headers.get('location');
    if (respuesta.status >= 300 && respuesta.status < 400 && destino !== null) {
      const siguiente = new URL(destino, actual).href;
      if (saltos.includes(siguiente) || siguiente === actual) {
        return { ruta, estado: respuesta.status, saltos, nota: 'BUCLE de redirecciones' };
      }
      saltos.push(siguiente);
      actual = siguiente;
      continue;
    }

    return {
      ruta,
      estado: respuesta.status,
      saltos,
      nota: respuesta.status === 404 ? '404' : null,
    };
  }

  return { ruta, estado: null, saltos, nota: `mas de ${MAX_SALTOS} redirecciones` };
}

const rutas = readFileSync(lista, 'utf8')
  .split(/\r?\n/)
  .map(soloRuta)
  .filter((r): r is string => r !== null);

log.info(`Base:  ${base}`);
log.info(`Lista: ${lista} (${rutas.length} URLs)`);
log.info('');

const resultados: Resultado[] = [];
let siguiente = 0;

async function trabajador() {
  while (siguiente < rutas.length) {
    const i = siguiente++;
    resultados[i] = await seguir(rutas[i]!);
  }
}

await Promise.all(
  Array.from({ length: Math.min(CONCURRENCIA, rutas.length) }, () => trabajador()),
);

let fallos = 0;

for (const r of resultados) {
  const destinoFinal = r.saltos.length > 0 ? ` -> ${r.saltos[r.saltos.length - 1]}` : '';
  const linea = `${String(r.estado ?? '---').padEnd(4)} ${r.ruta}${destinoFinal}`;

  if (r.nota !== null) {
    fallos++;
    log.error(`${linea}   ${r.nota}`);
  } else {
    log.info(`  ok   ${linea}`);
  }
}

log.info('');
log.info(`Comprobadas ${resultados.length}   Con problema: ${fallos}`);
if (fallos > 0) process.exit(1);
