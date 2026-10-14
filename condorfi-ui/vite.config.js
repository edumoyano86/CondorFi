import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function apiDevServerPlugin() {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/')) {
          const pathname = req.url.split('?')[0].replace(/^\/api\//, '');
          const allowed = ['generar-insights', 'scrapper-tradfi', 'bot', 'backtest'];
          if (allowed.includes(pathname)) {
            try {
              const url = new URL(req.url, 'http://localhost');
              const query = Object.fromEntries(url.searchParams.entries());
              const module = await server.ssrLoadModule(`/api/${pathname}.js`);
              const handler = module.default;
              req.query = query;
              res.status = (code) => {
                res.statusCode = code;
                return res;
              };
              res.json = (data) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return res;
              };
              return await handler(req, res);
            } catch (err) {
              console.error(`[Vite Dev API ${pathname}] Error:`, err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'error', message: err.message }));
              return;
            }
          }
        }
        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiDevServerPlugin()],
})

