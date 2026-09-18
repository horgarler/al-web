# angelalergo.com

Web de [Ángela Lergo](https://www.angelalergo.com), escultora y performer. Astro 7 con salida estática, publicada como assets de un Worker de Cloudflare.

## Requisitos

- **Node 24 LTS** o superior. Astro 7 exige como mínimo 22.12.
- **npm**.
- Git. Los finales de línea los fija el `.gitattributes` del repo (`eol=lf`), que manda sobre `core.autocrlf`.

## Instalación

```bash
npm install
npm run dev
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo de Astro. |
| `npm run build` | Valida el contenido y compila a `dist/`. |
| `npm run preview` | Sirve `dist/` con wrangler, **aplicando `_redirects` y `_headers`**. |
| `npm run check` | Comprobación de tipos. |
| `npm run validar` | Valida el contenido. Con `-- --estricto`, los TODO y los marcadores pendientes son errores. |
| `npm run imagenes` | Genera las versiones web desde el archivo de originales. |
| `npm run meta:crear` | Crea los `meta.yaml` y `categoria.yaml` que falten. |
| `npm run urls:comprobar` | Comprueba una lista de URLs contra un despliegue. |

`astro dev` **no** aplica las redirecciones ni las cabeceras. Para verlas funcionando hace falta `npm run preview`.

## Convención de carpetas

Los originales están fuera del repo, en `angelalergo/recursos`, y son de **solo lectura**. El repo solo contiene las versiones web de 2560 px que genera el script.

```
recursos/
├── img/
│   ├── 1-home/                      portadas de la home
│   ├── 2-sculptures-installations/  galería + info.txt
│   ├── 3-performances/              galería + info.txt
│   ├── 4-news/
│   └── 5-trajectory/
└── textos/                          PDFs de catálogo y textos, misma jerarquía
```

Dentro de una galería:

```
2-sculptures-installations/
└── 05-aire/
    ├── aire-00.jpg     -00 es la portada y la miniatura de la galería
    ├── aire-01.jpg
    └── aire-02.jpg
```

- `N` es la posición en el menú; `NN`, el orden dentro de la galería.
- El separador es el guion, en minúsculas. El nombre de la carpeta sin su prefijo **es** el slug de la URL: `05-aire` → `/obra/aire/`.
- El nombre base de cada imagen coincide con el slug de su carpeta.
- Se ordena por el valor numérico del prefijo, no alfabéticamente.

## Añadir una obra

1. Copia los originales a `<recursos>/img/<N-categoria>/<NN-obra>/<obra>-00.<ext>`, `<obra>-01.<ext>`... Valen `jpg`, `jpeg`, `png` y `webp`.
2. Si tiene catálogo, el PDF va en `<recursos>/textos/<N-categoria>/<NN-obra>/`.
3. Procesa:
   ```bash
   npm run imagenes -- --origen "<ruta a recursos>" --solo <N-categoria>/<NN-obra>
   ```
4. Crea la ficha y rellénala:
   ```bash
   npm run meta:crear
   ```
5. Revisa:
   ```bash
   npm run validar -- --estricto
   npm run dev
   ```
6. Haz commit en una rama, revisa la URL de vista previa y haz merge a `main`.

Para intercalar una obra entre dos existentes hay que renumerar los prefijos. Como el slug no lleva el número, las URLs no cambian.

## Despliegue

Cloudflare Workers Builds, desde este repositorio:

- **`main`** es la rama de producción. Cada push despliega con `npx wrangler deploy`.
- **El resto de ramas** suben una versión con `npx wrangler versions upload`, que genera una URL de vista previa sin promoverla. Las `*.workers.dev` llevan `X-Robots-Tag: noindex` por `public/_headers`, así que no se indexan.

El comando de build es `npm run build`. **El de producción tiene que pasar `--estricto`** a la validación, para que los TODO y los marcadores sin sustituir no lleguen a la web:

```bash
node scripts/validar-contenido.ts --estricto && astro build
```

El script detecta la rama por `WORKERS_CI_BRANCH`, `CF_PAGES_BRANCH` o `GITHUB_REF_NAME`; si Workers Builds no expone ninguna, el `--estricto` explícito es lo único que lo garantiza.

## Estructura

```
src/
├── components/     Bilingue, Navegacion, Pie, GaleriaObras, TarjetaObra,
│                   CarruselObra, HeroInicio, FormularioContacto
├── config/site.ts  nombre, host, breakpoint, menú, presets de imagen, clave del formulario
├── content/        obras/, noticias/ y trayectoria.yaml
├── layouts/        BaseLayout
├── lib/
│   ├── convenciones.ts   regex y reglas de nombres; la comparten Astro y los scripts
│   └── obras.ts          API tipada de las galerías
├── pages/
└── styles/         tokens.css y global.css
scripts/            preparar-imagenes, validar-contenido, crear-meta, comprobar-urls
public/             _redirects, _headers y docs/ con los PDFs
```

`docs/` está en `.gitignore`: es material de trabajo y no llega al clon que hace Cloudflare, así que nada del build puede depender de esa carpeta.
