import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import { sitio } from './src/config/site';

// Sin adaptador: el sitio es estatico puro y el `dist` se publica como
// assets de un Worker de Cloudflare.
export default defineConfig({
  site: sitio.url,
  trailingSlash: 'always',
  integrations: [sitemap()],

  /*
   * La web actual usa Playfair Display solo en las dos lineas en cursiva del
   * pie de la barra; el resto se queda con la serif por defecto del navegador.
   *
   * Astro descarga el fichero en el build y lo sirve desde nuestro dominio, asi
   * que el navegador no le pide nada a Google Fonts.
   */
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Playfair Display',
      cssVariable: '--fuente-cursiva',
      styles: ['italic'],
      weights: [400],
      // Por defecto Astro cierra la cadena con Arial y sans-serif, que no pega
      // con una serif: mientras carga se vería un salto de estilo feo.
      fallbacks: ['Times New Roman', 'Liberation Serif', 'serif'],
    },
    {
      // Solo para el logotipo de la barra lateral.
      provider: fontProviders.google(),
      name: 'Roboto',
      cssVariable: '--fuente-logo',
      weights: [700],
      fallbacks: ['Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
    },
  ],

  // Las imagenes se optimizan con `astro:assets` (sharp) desde los componentes.
  // Solo WebP por ahora: nada de AVIF hasta medir cuanto alarga el build.
});
