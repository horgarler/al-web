/**
 * Marcadores de la plantilla, todos en un solo sitio.
 *
 * Mientras un valor siga con la forma `[...]`, o no se resuelva contra el
 * contenido, la web lo enseña como marcador y `validar-contenido.ts --estricto`
 * da error, asi que no puede llegar a produccion por descuido.
 *
 * Las rutas de imagen son relativas a la raiz de contenido y siguen la misma
 * convencion que las galerias: `<N-categoria>/<NN-obra>/<obra>-YY.<ext>`. Las
 * resuelve `resolverImagen()` de `src/lib/obras.ts`; aqui nunca se escribe una
 * extension a mano en un componente.
 */

export type ImagenHome = {
  /** Ruta relativa a la raiz de contenido, o el marcador sin sustituir. */
  ruta: string;
  alt: { es: string; en?: string | null };
  /** `object-position`, para elegir el recorte en movil. */
  posicion?: string;
};

/**
 * Las tres imagenes de la rotacion, en orden.
 *
 * El orden es el mismo que sirve la web actual: Cover2, Cover1 y lergoCOVER.
 * Los ficheros estan en los originales en `img/1-home/`, pero esa carpeta no es
 * una galeria y el pipeline no la procesa todavia: hay que decidir donde caen
 * dentro del repo antes de sustituir los marcadores.
 */
export const IMAGENES_HOME: ImagenHome[] = [
  {
    ruta: 'home/cover2-angelalergo.jpg',
    alt: { es: 'TODO: describir la primera imagen', en: null },
    posicion: '50% 50%',
  },
  {
    ruta: 'home/cover1-angelalergo.jpg',
    alt: { es: 'TODO: describir la segunda imagen', en: null },
    posicion: '50% 50%',
  },
  {
    ruta: 'home/lergocover.jpg',
    alt: { es: 'TODO: describir la tercera imagen', en: null },
    posicion: '50% 50%',
  },
];

/**
 * Logo de la barra lateral.
 *
 * Por defecto es un logotipo de texto: "Ángela Lergo" en rojo y en Roboto. Ya
 * no es un marcador pendiente, asi que no bloquea el build de produccion.
 *
 * Si algun dia se quiere una imagen en su lugar, se pone aqui su ruta relativa
 * a la raiz de contenido y se pinta esa en vez del texto.
 */
export const LOGO: string | null = null;

/** Segunda linea del pie de la barra. Si es un marcador, no se pinta. */
export const CREDITOS = '[creditos]';

/**
 * Tiempos de la rotacion, en milisegundos. Son los de la web actual:
 * `data-delay="3000"` en el slider y el fundido por defecto de FlexSlider.
 */
export const ROTACION = {
  /** Cuanto se queda cada imagen. */
  intervalo: 3000,
  /** Cuanto dura el fundido cruzado. */
  fundido: 600,
} as const;
