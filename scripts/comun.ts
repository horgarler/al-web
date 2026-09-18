/**
 * Utilidades compartidas por los scripts de `scripts/`.
 *
 * Node los ejecuta directamente (`node scripts/x.ts`), asi que:
 *   - solo sintaxis TypeScript borrable, nada de `enum` ni `namespace`;
 *   - los imports relativos llevan la extension `.ts`;
 *   - nada de comandos de shell: solo `node:fs` y `node:path`.
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type Argumentos = {
  /** Opciones con valor: `--origen D:\ruta`. */
  valores: Map<string, string>;
  /** Opciones sin valor: `--dry-run`. */
  banderas: Set<string>;
};

/**
 * Parser minimo de argumentos. Admite `--clave valor`, `--clave=valor` y
 * `--bandera`.
 */
export function parsearArgumentos(argv: string[]): Argumentos {
  const valores = new Map<string, string>();
  const banderas = new Set<string>();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith('--')) continue;

    const igual = arg.indexOf('=');
    if (igual !== -1) {
      valores.set(arg.slice(2, igual), arg.slice(igual + 1));
      continue;
    }

    const clave = arg.slice(2);
    const siguiente = argv[i + 1];
    if (siguiente !== undefined && !siguiente.startsWith('--')) {
      valores.set(clave, siguiente);
      i++;
    } else {
      banderas.add(clave);
    }
  }

  return { valores, banderas };
}

export type Registro = {
  info: (mensaje: string) => void;
  aviso: (mensaje: string) => void;
  error: (mensaje: string) => void;
  /** Cuenta de avisos y errores acumulados. */
  resumen: () => { avisos: number; errores: number };
};

export function crearRegistro(): Registro {
  let avisos = 0;
  let errores = 0;
  return {
    info: (m) => console.log(m),
    aviso: (m) => {
      avisos++;
      console.warn(`  aviso  ${m}`);
    },
    error: (m) => {
      errores++;
      console.error(`  ERROR  ${m}`);
    },
    resumen: () => ({ avisos, errores }),
  };
}

export function existe(ruta: string): boolean {
  try {
    statSync(ruta);
    return true;
  } catch {
    return false;
  }
}

export function esDirectorio(ruta: string): boolean {
  try {
    return statSync(ruta).isDirectory();
  } catch {
    return false;
  }
}

/** Subdirectorios de una ruta, ordenados alfabeticamente. Vacio si no existe. */
export function subdirectorios(ruta: string): string[] {
  if (!esDirectorio(ruta)) return [];
  return readdirSync(ruta, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/** Ficheros de una ruta, ordenados alfabeticamente. Vacio si no existe. */
export function ficheros(ruta: string): string[] {
  if (!esDirectorio(ruta)) return [];
  return readdirSync(ruta, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .sort();
}

/** Todos los ficheros por debajo de una ruta, en rutas absolutas. */
export function ficherosRecursivos(ruta: string): string[] {
  if (!esDirectorio(ruta)) return [];
  const salida: string[] = [];
  for (const entrada of readdirSync(ruta, { withFileTypes: true })) {
    const completa = join(ruta, entrada.name);
    if (entrada.isDirectory()) salida.push(...ficherosRecursivos(completa));
    else if (entrada.isFile()) salida.push(completa);
  }
  return salida;
}

export function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const unidades = ['KB', 'MB', 'GB'];
  let valor = bytes / 1024;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i++;
  }
  return `${valor.toFixed(1)} ${unidades[i]}`;
}

/** Ejecuta las tareas con un limite de concurrencia. */
export async function enLotes<T>(
  tareas: (() => Promise<T>)[],
  limite: number,
): Promise<T[]> {
  const resultados: T[] = new Array(tareas.length);
  let siguiente = 0;

  const trabajador = async () => {
    while (siguiente < tareas.length) {
      const i = siguiente++;
      resultados[i] = await tareas[i]!();
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limite, tareas.length) }, () => trabajador()),
  );
  return resultados;
}
