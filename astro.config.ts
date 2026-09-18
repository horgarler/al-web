import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import { sitio } from './src/config/site';

// Sin adaptador: el sitio es estatico puro y el `dist` se publica como
// assets de un Worker de Cloudflare.
export default defineConfig({
  site: sitio.url,
  trailingSlash: 'always',
  integrations: [sitemap()],
  // Las imagenes se optimizan con `astro:assets` (sharp) desde los componentes.
  // Solo WebP por ahora: nada de AVIF hasta medir cuanto alarga el build.
});
