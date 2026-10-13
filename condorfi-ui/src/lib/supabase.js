import { createClient } from '@supabase/supabase-js';

// Polyfill ligero para compatibilidad con Node.js < 22 en Serverless Functions
if (!globalThis.WebSocket) {
  globalThis.WebSocket = class DummyWebSocket {};
}

// Resolución isomórfica de variables de entorno (Vite / Node.js Serverless)
const env = (typeof import.meta !== 'undefined' && import.meta?.env)
  ? import.meta.env
  : (typeof process !== 'undefined' && process?.env)
    ? process.env
    : {};

const rawUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseUrl = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '') : null;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_KEY || env.SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
