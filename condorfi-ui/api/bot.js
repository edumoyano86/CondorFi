/**
 * ==============================================================================
 * CondorFi - Serverless Collector & Arbitrage Node (Vercel Serverless Function)
 * Archivo: condorfi-ui/api/bot.js
 * 
 * Descripción:
 * Función Serverless HTTP que se ejecuta a demanda (o vía Vercel Cron).
 * Recolecta cotizaciones en tiempo real integrando APIs públicas de:
 *  - CriptoYa (agregador multi-exchange con Lemon Cash, Buenbit, Fiwind, Ripio, Belo, etc.)
 *  - Bitso (API pública directa v3)
 *  - Binance (API pública directa Spot bookTicker)
 *  - Lemon Cash (API dedicada)
 * 
 * Inteligencia Matemática:
 * Calcula el Arbitraje y Spread para cada activo (USDT, BTC, ETH):
 *  - Identifica el exchange con menor precio para comprar (Ask)
 *  - Identifica el exchange con mayor precio para vender (Bid)
 *  - Calcula el porcentaje de ganancia neta (Spread) deduciendo comisiones operativas.
 *  - Almacena el resultado consolidado en Supabase (spread, exchange_compra, exchange_venta).
 * ==============================================================================
 */

import { createClient } from '@supabase/supabase-js';

// Polyfill ligero para compatibilidad con Node.js < 22 en Serverless Functions
if (!globalThis.WebSocket) {
  globalThis.WebSocket = class DummyWebSocket {};
}

// Configuración general del enjambre multi-activo y parámetros matemáticos
const CONFIG = {
  TIMEOUT_MS: 6000,
  ACTIVOS: ['USDT', 'BTC', 'ETH'],
  TABLA_SUPABASE: 'cotizaciones_historicas',
  // Fricción operativa y comisiones de mercado estimadas (0.5% compra + 0.5% venta = 1.0% total)
  COMISION_COMPRA_PCT: 0.005,
  COMISION_VENTA_PCT: 0.005,
  EXCHANGES_CRIPTOYA: [
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
 * Consulta la API pública de Bitso (v3).
 * Soporta USDT/ARS y BTC/ARS.
 */
async function consultarBitso(moneda, signal) {
  const mapBooks = {
    USDT: 'usdt_ars',
    BTC: 'btc_ars'
  };
  const book = mapBooks[moneda.toUpperCase()];
  if (!book) return null;

  try {
    const res = await fetch(`https://api.bitso.com/v3/ticker/?book=${book}`, {
      headers: { 'Accept': 'application/json' },
      signal
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.success && data.payload?.ask && data.payload?.bid) {
      const ask = parseFloat(data.payload.ask);
      const bid = parseFloat(data.payload.bid);
      if (!isNaN(ask) && !isNaN(bid) && ask > 0 && bid > 0) {
        return {
          exchange: 'Bitso',
          precio_compra: ask,
          precio_venta: bid,
          moneda: moneda.toUpperCase()
        };
      }
    }
  } catch {
    // Falla controlada sin bloquear el flujo principal
  }
  return null;
}

/**
 * Consulta la API pública de Binance (Spot bookTicker).
 * Soporta USDT/ARS, BTC/ARS y ETH/ARS.
 */
async function consultarBinance(moneda, signal) {
  const symbol = `${moneda.toUpperCase()}ARS`;

  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/bookTicker?symbol=${symbol}`, {
      headers: { 'Accept': 'application/json' },
      signal
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.askPrice && data?.bidPrice) {
      const ask = parseFloat(data.askPrice);
      const bid = parseFloat(data.bidPrice);
      if (!isNaN(ask) && !isNaN(bid) && ask > 0 && bid > 0) {
        return {
          exchange: 'Binance (Spot)',
          precio_compra: ask,
          precio_venta: bid,
          moneda: moneda.toUpperCase()
        };
      }
    }
  } catch {
    // Falla controlada
  }
  return null;
}

/**
 * Consulta la API de Lemon Cash para obtener cotizaciones directas.
 */
async function consultarLemonCash(moneda, signal) {
  try {
    const res = await fetch(`https://criptoya.com/api/lemoncash/${moneda.toLowerCase()}/ars`, {
      headers: { 'Accept': 'application/json' },
      signal
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data?.ask === 'number' && typeof data?.bid === 'number' && data.ask > 0 && data.bid > 0) {
      return {
        exchange: 'Lemon Cash',
        precio_compra: data.ask,
        precio_venta: data.bid,
        moneda: moneda.toUpperCase()
      };
    }
  } catch {
    // Falla controlada
  }
  return null;
}

/**
 * Consulta consolidada en CriptoYa con fallback a consultas atómicas.
 */
async function consultarCriptoYa(moneda, signal) {
  const endpoint = `https://criptoya.com/api/${moneda.toLowerCase()}/ars`;
  const cotizaciones = [];

  try {
    const respuesta = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CondorFi-VercelServerless/5.0'
      },
      signal
    });

    if (respuesta.ok) {
      const data = await respuesta.json();
      CONFIG.EXCHANGES_CRIPTOYA.forEach(exchange => {
        const cotizacion = data[exchange.id];
        if (cotizacion && typeof cotizacion.ask === 'number' && typeof cotizacion.bid === 'number') {
          cotizaciones.push({
            exchange: exchange.nombre,
            precio_compra: cotizacion.ask,
            precio_venta: cotizacion.bid,
            moneda: moneda.toUpperCase()
          });
        }
      });
      return cotizaciones;
    }
  } catch {
    // Si falla el endpoint global, continuar con fallback
  }

  // Fallback atómico exchange por exchange
  const promesas = CONFIG.EXCHANGES_CRIPTOYA.map(async exchange => {
    const res = await fetch(`https://criptoya.com/api/${exchange.id}/${moneda.toLowerCase()}/ars`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CondorFi-VercelServerless/5.0'
      },
      signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    if (typeof d.ask !== 'number' || typeof d.bid !== 'number') throw new Error('Par no listado');
    return {
      exchange: exchange.nombre,
      precio_compra: d.ask,
      precio_venta: d.bid,
      moneda: moneda.toUpperCase()
    };
  });

  const resultados = await Promise.allSettled(promesas);
  resultados.forEach(r => {
    if (r.status === 'fulfilled' && r.value) {
      cotizaciones.push(r.value);
    }
  });

  return cotizaciones;
}

/**
 * Recolecta todas las cotizaciones disponibles para una moneda desde todas las fuentes integradas:
 * CriptoYa (múltiples exchanges locales), Bitso, Binance y Lemon Cash.
 */
async function recolectarCotizacionesParaMoneda(moneda) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

  try {
    const [criptoYaList, bitsoQuote, binanceQuote, lemonQuote] = await Promise.allSettled([
      consultarCriptoYa(moneda, controller.signal),
      consultarBitso(moneda, controller.signal),
      consultarBinance(moneda, controller.signal),
      consultarLemonCash(moneda, controller.signal)
    ]);

    const todas = [];
    const mapaExchanges = new Set();

    if (criptoYaList.status === 'fulfilled' && Array.isArray(criptoYaList.value)) {
      criptoYaList.value.forEach(item => {
        if (!mapaExchanges.has(item.exchange.toLowerCase())) {
          mapaExchanges.add(item.exchange.toLowerCase());
          todas.push(item);
        }
      });
    }

    if (bitsoQuote.status === 'fulfilled' && bitsoQuote.value) {
      if (!mapaExchanges.has('bitso')) {
        mapaExchanges.add('bitso');
        todas.push(bitsoQuote.value);
      }
    }

    if (binanceQuote.status === 'fulfilled' && binanceQuote.value) {
      if (!mapaExchanges.has('binance (spot)')) {
        mapaExchanges.add('binance (spot)');
        todas.push(binanceQuote.value);
      }
    }

    if (lemonQuote.status === 'fulfilled' && lemonQuote.value) {
      if (!mapaExchanges.has('lemon cash')) {
        mapaExchanges.add('lemon cash');
        todas.push(lemonQuote.value);
      }
    }

    return todas;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Calculadora Matemática de Spread y Arbitraje.
 * Por cada moneda:
 * 1. Identifica el precio más bajo para comprar (Ask) y su exchange.
 * 2. Identifica el precio más alto para vender (Bid) y su exchange.
 * 3. Calcula el porcentaje de ganancia neta (Spread) deduciendo comisiones operativas.
 */
function calcularSpread(cotizaciones, moneda) {
  if (!cotizaciones || cotizaciones.length === 0) return null;

  const validas = cotizaciones.filter(c => 
    typeof c.precio_compra === 'number' && c.precio_compra > 0 &&
    typeof c.precio_venta === 'number' && c.precio_venta > 0
  );

  if (validas.length === 0) return null;

  // 1. Precio más bajo para comprar (Ask) y exchange
  const mejorCompra = validas.reduce((min, c) => 
    c.precio_compra < min.precio_compra ? c : min, validas[0]
  );

  // 2. Precio más alto para vender (Bid) y exchange
  const mejorVenta = validas.reduce((max, c) => 
    c.precio_venta > max.precio_venta ? c : max, validas[0]
  );

  const ask = mejorCompra.precio_compra;
  const bid = mejorVenta.precio_venta;

  // 3. Porcentaje de ganancia neta (Spread Neto) descontando comisiones operativas
  const costoRealCompra = ask * (1 + CONFIG.COMISION_COMPRA_PCT);
  const ingresoNetoVenta = bid * (1 - CONFIG.COMISION_VENTA_PCT);
  const spreadNetoPesos = ingresoNetoVenta - costoRealCompra;
  const spreadNetoPorcentaje = Number(((spreadNetoPesos / costoRealCompra) * 100).toFixed(4));
  const spreadBrutoPorcentaje = Number((((bid - ask) / ask) * 100).toFixed(4));

  return {
    timestamp: new Date().toISOString(),
    moneda: moneda.toUpperCase(),
    exchange_compra: mejorCompra.exchange,
    precio_compra: Number(ask.toFixed(4)),
    exchange_venta: mejorVenta.exchange,
    precio_venta: Number(bid.toFixed(4)),
    spread: spreadNetoPorcentaje,
    spread_bruto: spreadBrutoPorcentaje,
    spread_neto_pesos: Number(spreadNetoPesos.toFixed(2))
  };
}

/**
 * Handler HTTP Serverless para Vercel.
 * Se ejecuta a demanda o vía Vercel Cron.
 */
export default async function handler(req, res) {
  const inicio = performance.now();

  // Inicialización defensiva del cliente Supabase
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseUrl = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '') : null;
  const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  const oportunidadesParaInsertar = [];
  const resumenOportunidades = {};
  const metricasRecoleccion = {};

  try {
    // Recolectar cotizaciones y calcular spread por cada activo en paralelo
    const promesasActivos = CONFIG.ACTIVOS.map(async moneda => {
      const cotizaciones = await recolectarCotizacionesParaMoneda(moneda);
      const oportunidad = calcularSpread(cotizaciones, moneda);
      return { moneda, cotizaciones, oportunidad };
    });

    const resultados = await Promise.all(promesasActivos);

    for (const { moneda, cotizaciones, oportunidad } of resultados) {
      metricasRecoleccion[moneda] = {
        totalExchangesConsultados: cotizaciones.length
      };

      if (oportunidad) {
        resumenOportunidades[moneda] = oportunidad;

        // Objeto enriquecido con spread, exchange_compra y exchange_venta para Supabase
        oportunidadesParaInsertar.push({
          timestamp: oportunidad.timestamp,
          moneda: oportunidad.moneda,
          exchange: `${oportunidad.exchange_compra} -> ${oportunidad.exchange_venta}`,
          exchange_compra: oportunidad.exchange_compra,
          exchange_venta: oportunidad.exchange_venta,
          precio_compra: oportunidad.precio_compra,
          precio_venta: oportunidad.precio_venta,
          spread: oportunidad.spread
        });
      }
    }

    // Inserción en Supabase si las credenciales están configuradas
    let registrosInsertados = 0;
    if (supabaseUrl && supabaseKey && oportunidadesParaInsertar.length > 0) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      let { data, error } = await supabase
        .from(CONFIG.TABLA_SUPABASE)
        .insert(oportunidadesParaInsertar)
        .select();

      // Fallback defensivo si la tabla aún no cuenta con las columnas spread / exchange_compra / exchange_venta
      if (error && (error.code === 'PGRST204' || error.code === '42703')) {
        console.warn('[Supabase] Columnas avanzadas (spread, exchange_compra, exchange_venta) no encontradas en el esquema de Supabase. Aplicando guardado compatible en "exchange"...');
        const fallbackRegistros = oportunidadesParaInsertar.map(op => ({
          timestamp: op.timestamp,
          moneda: op.moneda,
          exchange: `${op.exchange_compra} -> ${op.exchange_venta} (Spread: ${op.spread}%)`,
          precio_compra: op.precio_compra,
          precio_venta: op.precio_venta
        }));

        const fallbackRes = await supabase
          .from(CONFIG.TABLA_SUPABASE)
          .insert(fallbackRegistros)
          .select();

        if (fallbackRes.error) {
          throw new Error(`Error en Supabase insert fallback: ${fallbackRes.error.message} (${fallbackRes.error.code})`);
        }
        data = fallbackRes.data;
        error = null;
      } else if (error) {
        throw new Error(`Error en Supabase insert: ${error.message} (${error.code})`);
      }

      registrosInsertados = data ? data.length : oportunidadesParaInsertar.length;
    }

    const duracionMs = Math.round(performance.now() - inicio);

    return res.status(200).json({
      status: "Arbitraje y cálculo de spread ejecutado",
      timestamp: new Date().toISOString(),
      activos: CONFIG.ACTIVOS,
      oportunidadesCalculadas: oportunidadesParaInsertar.length,
      registrosInsertados,
      duracionMs,
      oportunidades: resumenOportunidades,
      metricasRecoleccion
    });
  } catch (error) {
    console.error('[Vercel Serverless Bot] Error:', error);
    return res.status(500).json({
      status: "Error",
      message: error.message || "Error interno al calcular arbitraje"
    });
  }
}
