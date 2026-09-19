import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Permite servir o app fora da raiz do domínio (ex.: http://host/ip-dashboard/)
// definindo VITE_BASE_PATH no .env antes do build — sem isso, os arquivos
// JS/CSS são referenciados a partir de "/" e a página fica em branco quando
// servida de um subcaminho.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    server: {
      port: 5174,
    },
  };
});
