/**
 * ==============================================================================
 * CondorFi - Serverless Collector Node (Vercel Serverless Function)
 * Archivo: condorfi-ui/api/bot.js
 * 
 * Descripción:
 * Función Serverless HTTP que se ejecuta a demanda (o vía Vercel Cron).
 * Consulta en paralelo CriptoYa para el portafolio multi-activo (USDT, BTC, ETH, USDC)
 * sobre 10 exchanges argentinos e inserta las cotizaciones en Supabase en una sola ejecución.
 * ==============================================================================
 */

import { createClient } from '@supabase/supabase-js';

// Polyfill ligero para compatibilidad con Node.js < 22 en Serverless Functions
if (!globalThis.WebSocket) {
  globalThis.WebSocket = class DummyWebSocket {};
}

// Configuración general del enjambre multi-activo
const CONFIG = {
  TIMEOUT_MS: 7000,
  ACTIVOS: ['USDT', 'BTC', 'ETH', 'USDC'],
  TABLA_SUPABASE: 'cotizaciones_historicas',
  EXCHANGES: [
    { id: 'lemoncash',    nombre: 'Lemon Cash' },
    { id: 'buenbit',      nombre: 'Buenbit' },
    { id: 'fiwind',       nombre: 'Fiwind' },
    { id: 'ripio',        nombre: 'Ripio' },
    { id: 'binancep2p',   nombre: 'Binance P2P' },
    { id: 'belo',         nombre: 'Belo' },
    { id: 'satoshitango', nombre: 'SatoshiTango' },
    { id: 'tiendacrypto', nombre: 'TiendaCrypto' },
    { id: 'letsbit',      nombre: 'Let\'sBit' },
    { id: 'decrypto',     nombre: 'Decrypto' }
  ]
};

/**
 * Consulta la cotización consolidada para una moneda en todos los exchanges en CriptoYa.
 * Realiza fallback atómico individual si el endpoint consolidado no responde.
 * 
 * @param {string} moneda - Símbolo de la moneda (USDT, BTC, ETH, USDC)
 */
async function recolectarCotizacionesParaMoneda(moneda) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
  const endpoint = `https://criptoya.com/api/${moneda.toLowerCase()}/ars`;

  try {
    const respuesta = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CondorFi-VercelServerless/5.0'
      },
      signal: controller.signal
    });

    if (!respuesta.ok) {
      throw new Error(`HTTP ${respuesta.status}: ${respuesta.statusText}`);
    }

    const data = await respuesta.json();
    const timestamp = new Date().toISOString();
    const exitosos = [];
    const omitidos = [];

    CONFIG.EXCHANGES.forEach(exchange => {
      const cotizacion = data[exchange.id];
      if (cotizacion && typeof cotizacion.ask === 'number' && typeof cotizacion.bid === 'number') {
        exitosos.push({
          timestamp,
          moneda: moneda.toUpperCase(),
          exchange: exchange.nombre,
          precio_compra: cotizacion.ask,
          precio_venta: cotizacion.bid
        });
      } else {
        omitidos.push(exchange.nombre);
      }
    });

    return { exitosos, omitidos };
  } catch (error) {
    // Si falla el endpoint consolidado, intentar consultas atómicas como fallback
    return recolectarFallbackAtomico(moneda);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fallback de consultas individuales exchange por exchange con Promise.allSettled.
 * 
 * @param {string} moneda 
 */
async function recolectarFallbackAtomico(moneda) {
  const promesas = CONFIG.EXCHANGES.map(async exchange => {
    const res = await fetch(`https://criptoya.com/api/${exchange.id}/${moneda.toLowerCase()}/ars`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CondorFi-VercelServerless/5.0'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    if (typeof d.ask !== 'number' || typeof d.bid !== 'number') throw new Error('Par no listado');
    return {
      timestamp: new Date().toISOString(),
      moneda: moneda.toUpperCase(),
      exchange: exchange.nombre,
      precio_compra: d.ask,
      precio_venta: d.bid
    };
  });

  const resultados = await Promise.allSettled(promesas);
  const exitosos = [];
  const omitidos = [];

  resultados.forEach((r, idx) => {
    if (r.status === 'fulfilled') {
      exitosos.push(r.value);
    } else {
      omitidos.push(CONFIG.EXCHANGES[idx].nombre);
    }
  });

  return { exitosos, omitidos };
}

/**
 * Handler HTTP Serverless para Vercel.
 * Se ejecuta una sola vez por cada petición web y retorna la respuesta.
 */
export default async function handler(req, res) {
  const inicio = performance.now();

  // Inicialización defensiva del cliente Supabase soportando variables estándar o de Vite
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseUrl = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '') : null;
  const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  const todosLosRegistros = [];
  const detallesPorMoneda = {};

  try {
    // Iteración secuencial sobre cada activo multi-activo
    for (const moneda of CONFIG.ACTIVOS) {
      const { exitosos, omitidos } = await recolectarCotizacionesParaMoneda(moneda);
      todosLosRegistros.push(...exitosos);
      detallesPorMoneda[moneda] = {
        capturados: exitosos.length,
        omitidos: omitidos.length
      };
    }

    // Inserción en lote en Supabase si las credenciales están configuradas
    let registrosInsertados = 0;
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      if (todosLosRegistros.length > 0) {
        const { data, error } = await supabase
          .from(CONFIG.TABLA_SUPABASE)
          .insert(todosLosRegistros)
          .select();

        if (error) {
          throw new Error(`Error en Supabase insert: ${error.message} (${error.code})`);
        }
        registrosInsertados = data ? data.length : todosLosRegistros.length;
      }
    }

    const duracionMs = Math.round(performance.now() - inicio);

    return res.status(200).json({
      status: "Arbitraje ejecutado",
      timestamp: new Date().toISOString(),
      activos: CONFIG.ACTIVOS,
      totalCapturado: todosLosRegistros.length,
      registrosInsertados,
      duracionMs,
      detallesPorMoneda
    });
  } catch (error) {
    console.error('[Vercel Serverless Bot] Error:', error);
    return res.status(500).json({
      status: "Error",
      message: error.message || "Error interno al ejecutar arbitraje"
    });
  }
}
