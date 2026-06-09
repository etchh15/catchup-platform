import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/setupTests.js',
    },
    define: {
      'process.env.REACT_APP_SUPABASE_URL': JSON.stringify(
        env.VITE_SUPABASE_URL || env.REACT_APP_SUPABASE_URL || ''
      ),
      'process.env.REACT_APP_SUPABASE_ANON_KEY': JSON.stringify(
        env.VITE_SUPABASE_ANON_KEY || env.REACT_APP_SUPABASE_ANON_KEY || ''
      ),
      'process.env.REACT_APP_SENTRY_DSN': JSON.stringify(
        env.VITE_SENTRY_DSN || env.REACT_APP_SENTRY_DSN || ''
      ),
      'process.env.REACT_APP_SENTRY_RELEASE': JSON.stringify(
        env.VITE_SENTRY_RELEASE || env.REACT_APP_SENTRY_RELEASE || 'catchup-platform@local'
      ),
      'process.env.REACT_APP_SENTRY_TRACES_SAMPLE_RATE': JSON.stringify(
        env.VITE_SENTRY_TRACES_SAMPLE_RATE || env.REACT_APP_SENTRY_TRACES_SAMPLE_RATE || '0.2'
      ),
      'process.env.NODE_ENV': JSON.stringify(mode),
    },
  };
});
