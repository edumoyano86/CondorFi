/**
 * ==============================================================================
 * CondorFi - TradFi Data Collector (Vercel Serverless Function)
 * Archivo: condorfi-ui/api/scrapper-tradfi.js
 * 
 * Microservicio Serverless HTTP para la recolección de cotizaciones del
 * mercado tradicional (acciones, ETFs e índices) mediante Yahoo Finance.
 * ==============================================================================
 */

import YahooFinance from 'yahoo-finance2';
import { supabase } from '../src/lib/supabase.js';
import { createClient } from '@supabase/supabase-js';

// Polyfill ligero para compatibilidad con Node.js < 22 en Serverless Functions
if (!globalThis.WebSocket) {
  globalThis.WebSocket = class DummyWebSocket {};
}

// Inicialización del cliente Yahoo Finance con supresión de avisos
const yahooFinance = typeof YahooFinance === 'function'
  ? new YahooFinance({ suppressNotices: ['yahooSurvey'] })
  : YahooFinance;

// Configuración de los activos a consultar
const TICKERS_CONFIG = [
  { ticker: 'SPY',   nombre: 'S&P 500', moneda: 'USD' },
  { ticker: 'QQQ',   nombre: 'Nasdaq',  moneda: 'USD' },
  { ticker: 'AAPL',  nombre: 'Apple',   moneda: 'USD' },
  { ticker: '^MERV', nombre: 'Merval',  moneda: 'ARS' }
];

/**
 * Handler HTTP Serverless para Vercel.
 * Ejecuta la consulta simultánea con Promise.all e inserta en Supabase.
 */
export default async function handler(req, res) {
  const inicio = performance.now();

  try {
    // 1. Consulta simultánea de todos los tickers vía Yahoo Finance
    const promesas = TICKERS_CONFIG.map(async ({ ticker, moneda }) => {
      const quote = await yahooFinance.quote(ticker);
      
      const precioActual = Number(quote.regularMarketPrice ?? quote.price ?? 0);
      const precioApertura = Number(quote.regularMarketOpen ?? quote.open ?? precioActual);

      return {
        ticker,
        precio_actual: precioActual,
        precio_apertura: precioApertura,
        moneda
      };
    });

    const resultados = await Promise.all(promesas);

    // 2. Resolución defensiva del cliente Supabase
    let db = supabase;
    if (!db) {
      const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const url = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '') : null;
      const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (url && key) {
        db = createClient(url, key);
      }
    }

    if (!db) {
      throw new Error('Cliente de Supabase no configurado o credenciales ausentes en el entorno');
    }

    // 3. Inyección de registros en la tabla cotizaciones_tradfi
    const { data, error } = await db
      .from('cotizaciones_tradfi')
      .insert(resultados)
      .select();

    if (error) {
      throw new Error(`Error en Supabase insert: ${error.message} (${error.code})`);
    }

    const duracionMs = Math.round(performance.now() - inicio);

    // 4. Respuesta HTTP 200 confirmando la captura exitosa
    return res.status(200).json({
      status: "Captura TradFi exitosa",
      timestamp: new Date().toISOString(),
      totalRegistros: resultados.length,
      duracionMs,
      activos: resultados,
      data
    });
  } catch (error) {
    console.error('[Scrapper TradFi] Error:', error);
    return res.status(500).json({
      status: "Error",
      message: error.message || "Error al capturar datos de TradFi"
    });
  }
}
