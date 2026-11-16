import { defineConfig } from 'vite';

export default defineConfig(({ command, mode }) => {
  const enableDevTools = command === 'serve' && mode === 'development';
  return {
    base: './',
    define: {
      __BW_DEVTOOLS__: JSON.stringify(enableDevTools),
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
    },
  };
});
