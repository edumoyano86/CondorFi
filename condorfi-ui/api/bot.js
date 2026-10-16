/**
 * ==============================================================================
 * CondorFi - Serverless Collector & Arbitrage Node (Vercel Serverless Function)
 * Archivo: condorfi-ui/api/bot.js
 * 
 * Descripción:
 * Función Serverless HTTP que se ejecuta a demanda (o vía Vercel Cron).
 * Recolecta cotizaciones en tiempo real integrando APIs públicas de:
 *  - CriptoYa (agregador multi-exchange dinámico: Lemon, Buenbit, Fiwind, Ripio, Belo, etc.)
 *  - Bitso (API pública directa v3)
 *  - Binance (API pública directa Spot ARS y conversión líquida Spot USDT/ARS)
 *  - Lemon Cash (API dedicada)
 * 
 * Inteligencia Matemática:
 * Calcula el Arbitraje y Spread para cada activo del universo Top Cripto (20 activos):
 *  - Identifica el exchange con menor precio para comprar (Ask)
 *  - Identifica el exchange con mayor precio para vender (Bid)
 *  - Deduce comisiones operativas y calcula spread neto.
 *  - Almacena el resultado consolidado en Supabase (cotizaciones_historicas).
 * ==============================================================================
 */

import { createClient } from '@supabase/supabase-js';

// Polyfill ligero para compatibilidad con Node.js < 22 en Serverless Functions
if (!globalThis.WebSocket) {
  globalThis.WebSocket = class DummyWebSocket {};
}

export const TOP_CRIPTO_DEFAULT = [
  // Top 10 Core
  'USDT', 'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOGE', 'LINK',
  // Layer 1, DeFi & Smart Contracts (11 - 20)
  'DOT', 'MATIC', 'SHIB', 'LTC', 'UNI', 'ATOM', 'NEAR', 'ARB', 'OP', 'INJ',
  // Expansión Institucional Top 30
  'TON', 'TRX', 'BCH', 'ETC', 'FIL', 'LDO', 'APT', 'SUI', 'RNDR', 'XLM'
];

// Configuración general del enjambre multi-activo y parámetros matemáticos
const CONFIG = {
  TIMEOUT_MS: 5000,
  ACTIVOS: TOP_CRIPTO_DEFAULT,
  TABLA_SUPABASE: 'cotizaciones_historicas',
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
    { id: 'decrypto',     nombre: 'Decrypto' },
    { id: 'cryptomkt',    nombre: 'CryptoMkt' }
  ]
};

/**
 * Consulta la cotización de referencia USDT/ARS para conversión de pares altcoin.
 */
let cacheUsdtRate = { ask: 1615, bid: 1614, timestamp: 0 };
async function obtenerTasaUsdtArs(signal) {
  const ahora = Date.now();
  if (ahora - cacheUsdtRate.timestamp < 30000 && cacheUsdtRate.ask > 0) {
    return cacheUsdtRate;
  }
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/bookTicker?symbol=USDTARS', { signal });
    if (res.ok) {
      const data = await res.json();
      const ask = parseFloat(data.askPrice);
      const bid = parseFloat(data.bidPrice);
      if (!isNaN(ask) && !isNaN(bid) && ask > 0) {
        cacheUsdtRate = { ask, bid, timestamp: ahora };
        return cacheUsdtRate;
      }
    }
  } catch {
    // Si falla, usar caché o valor por defecto
  }
  return cacheUsdtRate;
}

/**
 * Consulta la API pública de Bitso (v3).
 * Soporta USDT, BTC, ETH, SOL, XRP, ADA, AVAX, DOGE, LTC, SHIB y POL.
 */
async function consultarBitso(moneda, signal) {
  const m = moneda.toUpperCase() === 'MATIC' ? 'POL' : moneda.toUpperCase();
  const mapBooks = {
    USDT: 'usdt_ars',
    BTC: 'btc_ars',
    ETH: 'eth_ars',
    SOL: 'sol_ars',
    XRP: 'xrp_ars',
    ADA: 'ada_ars',
    AVAX: 'avax_ars',
    DOGE: 'doge_ars',
    LTC: 'ltc_ars',
    SHIB: 'shib_ars',
    POL: 'pol_ars',
    MATIC: 'pol_ars',
    BCH: 'bch_ars',
    XLM: 'xlm_ars',
    TRX: 'trx_ars'
  };
  const book = mapBooks[m];
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
    // Falla controlada
  }
  return null;
}

/**
 * Consulta la API pública de Binance (Spot bookTicker) en par ARS directo.
 */
async function consultarBinanceDirectoARS(moneda, signal) {
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
          exchange: 'Binance (Spot ARS)',
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
 * Fallback Spot Binance en USD/USDT convertido a ARS para altcoins que no tienen par directo en ARS.
 * Permite liquidar ATOM, NEAR, ARB, OP, INJ, etc.
 */
async function consultarBinanceSpotUSDT(moneda, usdtRate, signal) {
  if (moneda.toUpperCase() === 'USDT') return null;
  const raw = moneda.toUpperCase();
  const mapSymbols = {
    MATIC: 'POL',
    RNDR: 'RENDER'
  };
  const m = mapSymbols[raw] || raw;
  const symbol = `${m}USDT`;

  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/bookTicker?symbol=${symbol}`, {
      headers: { 'Accept': 'application/json' },
      signal
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.askPrice && data?.bidPrice) {
      const askUsd = parseFloat(data.askPrice);
      const bidUsd = parseFloat(data.bidPrice);
      if (!isNaN(askUsd) && !isNaN(bidUsd) && askUsd > 0 && bidUsd > 0) {
        const askArs = askUsd * (usdtRate.ask || 1615);
        const bidArs = bidUsd * (usdtRate.bid || 1614);
        return {
          exchange: 'Binance (Spot USDT/ARS)',
          precio_compra: Number(askArs.toFixed(2)),
          precio_venta: Number(bidArs.toFixed(2)),
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
  const m = moneda.toUpperCase() === 'MATIC' ? 'pol' : moneda.toLowerCase();
  try {
    const res = await fetch(`https://criptoya.com/api/lemoncash/${m}/ars`, {
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
 * Consulta dinámica en CriptoYa con resolución de todos los exchanges devueltos.
 * Incluye mapeo de MATIC a POL (migración de Polygon).
 */
async function consultarCriptoYa(moneda, signal) {
  // Mapeo automático de ticker migrado MATIC -> POL
  const symbolToQuery = moneda.toUpperCase() === 'MATIC' ? 'pol' : moneda.toLowerCase();
  const endpoint = `https://criptoya.com/api/${symbolToQuery}/ars`;
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
      // Recorrer dinámicamente todas las claves del payload para no omitir ningún exchange
      Object.entries(data).forEach(([key, cotizacion]) => {
        if (cotizacion && typeof cotizacion.ask === 'number' && typeof cotizacion.bid === 'number' && cotizacion.ask > 0 && cotizacion.bid > 0) {
          const configItem = CONFIG.EXCHANGES_CRIPTOYA.find(e => e.id.toLowerCase() === key.toLowerCase());
          const nombreExchange = configItem ? configItem.nombre : (key.charAt(0).toUpperCase() + key.slice(1));
          cotizaciones.push({
            exchange: nombreExchange,
            precio_compra: cotizacion.ask,
            precio_venta: cotizacion.bid,
            moneda: moneda.toUpperCase()
          });
        }
      });
      return cotizaciones;
    }
  } catch {
    // Fallback a consultas directas si el endpoint global falla
  }

  // Fallback atómico exchange por exchange si el agregado falló
  const promesas = CONFIG.EXCHANGES_CRIPTOYA.map(async exchange => {
    const res = await fetch(`https://criptoya.com/api/${exchange.id}/${symbolToQuery}/ars`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CondorFi-VercelServerless/5.0'
      },
      signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    if (typeof d.ask !== 'number' || typeof d.bid !== 'number' || d.ask <= 0 || d.bid <= 0) {
      throw new Error('Par no listado o precio inválido');
    }
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
 * CriptoYa (múltiples exchanges dinámicos), Bitso, Binance (Spot ARS y Spot USDT/ARS) y Lemon Cash.
 */
async function recolectarCotizacionesParaMoneda(moneda, usdtRate) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

  try {
    const [criptoYaList, bitsoQuote, binanceDirecto, binanceUsdt, lemonQuote] = await Promise.allSettled([
      consultarCriptoYa(moneda, controller.signal),
      consultarBitso(moneda, controller.signal),
      consultarBinanceDirectoARS(moneda, controller.signal),
      consultarBinanceSpotUSDT(moneda, usdtRate, controller.signal),
      consultarLemonCash(moneda, controller.signal)
    ]);

    const todas = [];
    const mapaExchanges = new Set();

    if (criptoYaList.status === 'fulfilled' && Array.isArray(criptoYaList.value)) {
      criptoYaList.value.forEach(item => {
        const idNorm = item.exchange.toLowerCase();
        if (!mapaExchanges.has(idNorm)) {
          mapaExchanges.add(idNorm);
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

    if (binanceDirecto.status === 'fulfilled' && binanceDirecto.value) {
      if (!mapaExchanges.has('binance (spot ars)')) {
        mapaExchanges.add('binance (spot ars)');
        todas.push(binanceDirecto.value);
      }
    }

    if (binanceUsdt.status === 'fulfilled' && binanceUsdt.value) {
      if (!mapaExchanges.has('binance (spot usdt/ars)')) {
        mapaExchanges.add('binance (spot usdt/ars)');
        todas.push(binanceUsdt.value);
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
 */
function calcularSpread(cotizaciones, moneda) {
  if (!cotizaciones || cotizaciones.length === 0) return null;

  const validas = cotizaciones.filter(c => 
    typeof c.precio_compra === 'number' && c.precio_compra > 0 &&
    typeof c.precio_venta === 'number' && c.precio_venta > 0
  );

  if (validas.length === 0) return null;

  // Si solo hay 1 exchange disponible, tomar como referencia base sin arbitraje cruzado
  if (validas.length === 1) {
    const unico = validas[0];
    const ask = unico.precio_compra;
    const bid = unico.precio_venta;
    const spreadBruto = Number((((bid - ask) / ask) * 100).toFixed(4));
    return {
      timestamp: new Date().toISOString(),
      moneda: moneda.toUpperCase(),
      exchange_compra: unico.exchange,
      precio_compra: Number(ask.toFixed(4)),
      exchange_venta: unico.exchange,
      precio_venta: Number(bid.toFixed(4)),
      spread: spreadBruto,
      spread_bruto: spreadBruto,
      spread_neto_pesos: Number((bid - ask).toFixed(2))
    };
  }

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
  const fallosPorActivo = [];

  try {
    const query = req.query || {};
    const body = req.body || {};

    let monedasAConsultar = [];
    if (query.monedas) {
      monedasAConsultar = String(query.monedas).split(',');
    } else if (query.tickers) {
      monedasAConsultar = String(query.tickers).split(',');
    } else if (body.monedas) {
      monedasAConsultar = Array.isArray(body.monedas) ? body.monedas : String(body.monedas).split(',');
    } else if (body.tickers) {
      monedasAConsultar = Array.isArray(body.tickers) ? body.tickers : String(body.tickers).split(',');
    } else {
      monedasAConsultar = TOP_CRIPTO_DEFAULT;
    }

    monedasAConsultar = Array.from(new Set(monedasAConsultar.map(m => m.trim().toUpperCase()).filter(Boolean)));

    // Obtener tasa de referencia USDT/ARS para la conversión de altcoins
    const usdtRate = await obtenerTasaUsdtArs();

    // Recolectar cotizaciones y calcular spread por cada activo concurrentemente con Promise.allSettled
    const promesasActivos = monedasAConsultar.map(async moneda => {
      try {
        const cotizaciones = await recolectarCotizacionesParaMoneda(moneda, usdtRate);
        const oportunidad = calcularSpread(cotizaciones, moneda);
        return { moneda, cotizaciones, oportunidad };
      } catch (errActivo) {
        throw new Error(`Error en activo ${moneda}: ${errActivo.message}`);
      }
    });

    const resultadosSettled = await Promise.allSettled(promesasActivos);

    resultadosSettled.forEach((item, idx) => {
      const monedaSolicitada = monedasAConsultar[idx];
      if (item.status === 'fulfilled' && item.value) {
        const { moneda, cotizaciones, oportunidad } = item.value;
        metricasRecoleccion[moneda] = {
          totalExchangesConsultados: cotizaciones.length
        };

        if (oportunidad) {
          resumenOportunidades[moneda] = oportunidad;

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
        } else {
          const motivo = `Sin cotizaciones válidas disponibles (${cotizaciones.length} exchanges consultados)`;
          console.error(`Fallo en activo cripto [${monedaSolicitada}]:`, motivo);
          fallosPorActivo.push({ moneda: monedaSolicitada, motivo });
        }
      } else {
        const motivo = item.reason?.message || String(item.reason || 'Rechazo no controlado');
        console.error(`Fallo en activo cripto [${monedaSolicitada}]:`, motivo);
        fallosPorActivo.push({ moneda: monedaSolicitada, motivo });
      }
    });

    // Inserción en lote (Bulk Insert) en Supabase en una sola operación
    let registrosInsertados = 0;
    if (supabaseUrl && supabaseKey && oportunidadesParaInsertar.length > 0) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      let { data, error } = await supabase
        .from(CONFIG.TABLA_SUPABASE)
        .insert(oportunidadesParaInsertar)
        .select();

      // Fallback defensivo si la tabla aún no cuenta con las columnas avanzadas
      if (error && (error.code === 'PGRST204' || error.code === '42703')) {
        console.warn('[Supabase] Columnas avanzadas no encontradas en el esquema. Aplicando guardado compatible en "exchange"...');
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

        if (!fallbackRes.error) {
          data = fallbackRes.data;
          error = null;
        }
      }

      if (!error && data) {
        registrosInsertados = data.length;
      } else if (error) {
        console.error('[Supabase Cripto Insert] Error en bulk insert:', error.message);
      }
    }

    const duracionMs = Math.round(performance.now() - inicio);

    return res.status(200).json({
      status: "Arbitraje Cripto Masivo Concurrente Ejecutado",
      timestamp: new Date().toISOString(),
      duracionMs,
      totalSolicitados: monedasAConsultar.length,
      oportunidadesCalculadas: oportunidadesParaInsertar.length,
      fallos: fallosPorActivo.length,
      fallosDetalle: fallosPorActivo,
      registrosInsertados,
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
