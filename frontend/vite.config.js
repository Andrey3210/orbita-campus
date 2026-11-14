import { defineConfig } from 'vite';
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic' },
  server: { proxy: { '/api': process.env.QA_API_PROXY ?? 'http://127.0.0.1:8080' } },
  plugins: [{
    name: 'documentos-entrega',
    closeBundle() {
      const ruta = (valor) => fileURLToPath(new URL(valor, import.meta.url));
      copyFileSync(ruta('../docs/Informe-segundo-entregable.pdf'), ruta('./dist/Informe-segundo-entregable.pdf'));
    },
  }],
});
