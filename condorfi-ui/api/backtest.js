/**
 * ==============================================================================
 * CondorFi - Motor de Backtesting Institucional Cuantitativo
 * Archivo: condorfi-ui/api/backtest.js
 * 
 * Microservicio Serverless para Vercel & Vite Dev Server.
 * Simula el rendimiento del algoritmo CondorScore sin sesgo de anticipación
 * (Look-Ahead Bias) sobre datos históricos diarios (1 a 2 años).
 * 
 * Arquitectura de Datos:
 * - Proveedor Unificado: Yahoo Finance (yahoo-finance2) para TradFi y Cripto.
 * - Elimina por completo la dependencia de Binance API (evitando errores HTTP 451
 *   por restricciones geográficas en IPs de Vercel US).
 * - Mapper automático de tickers cripto a formato Yahoo Finance (ej. BTC -> BTC-USD).
 * - Estandarización de velas OHLCV adaptadas a la estructura esperada por el Motor Quant.
 * 
 * Parámetros recibidos (Query / Body):
 * - ticker: ej. 'SPY', 'BTC', 'QQQ', 'AAPL', 'ETH', 'SOL', '^MERV'
 * - mercado: 'tradfi' | 'cripto' (auto-detectado si se omite)
 * - capital_inicial: number (por defecto $10,000 USD)
 * - periodo: '1y' | '2y' (por defecto '1y')
 * 
 * Métricas de Salida:
 * - ROI (% y USD)
 * - Buy & Hold Benchmark (%)
 * - Win Rate (%)
 * - Max Drawdown (%)
 * - Total Trades, Ganadores, Perdedores, Profit Factor
 * - Velas históricas OHLCV formateadas para lightweight-charts
 * - Markers de Compra (arrowUp verde) y Venta (arrowDown roja)
 * - Curva de Equity histórica paso a paso
 * - Historial detallado de operaciones
 * ==============================================================================
 */

import YahooFinance from 'yahoo-finance2';
import { supabase as supabaseCliente } from '../src/lib/supabase.js';
import { createClient } from '@supabase/supabase-js';
import { evaluarEstrategiaDinamica } from '../src/lib/strategyEvaluator.js';
import {
  calcularRSI,
  calcularMACD,
  calcularBandasBollinger,
  calcularCondorScore,
  TOP_CRIPTO
} from './generar-insights.js';

// Polyfill para WebSocket en Node < 22
if (!globalThis.WebSocket) {
  globalThis.WebSocket = class DummyWebSocket {};
}

// Cliente Yahoo Finance con supresión de avisos de consola
const yf = typeof YahooFinance === 'function'
  ? new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })
  : YahooFinance;

/**
 * Detecta automáticamente si el activo es Cripto o TradFi.
 * @param {string} ticker Símbolo a evaluar
 * @param {string} [mercadoParam] Parámetro explícito opcional
 * @returns {'cripto' | 'tradfi'}
 */
export function inferirMercado(ticker, mercadoParam) {
  if (mercadoParam) {
    const m = mercadoParam.toLowerCase().trim();
    if (m === 'cripto' || m === 'crypto') return 'cripto';
    if (m === 'tradfi' || m === 'acciones' || m === 'indices' || m === 'bonos') return 'tradfi';
  }

  const raw = (ticker || '').toString().toUpperCase().trim();
  const clean = raw.replace(/[-_/]?(USDT|BUSD|USD)$/i, '').trim();

  if (TOP_CRIPTO.includes(clean) || ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX'].includes(clean)) {
    return 'cripto';
  }

  return 'tradfi';
}

const MAPEO_CRIPTO_YAHOO = {
  TON: 'TON11419-USD',
  SUI: 'SUI20947-USD',
  APT: 'APT21794-USD',
  ARB: 'ARB11841-USD',
  RNDR: 'RENDER-USD',
  RENDER: 'RENDER-USD',
  MATIC: 'POL-USD',
  POL: 'POL-USD'
};

/**
 * Mapeador institucional de Tickers para Yahoo Finance.
 * Transforma el símbolo ingresado al formato oficial esperado por Yahoo Finance:
 * - Cripto: 'BTC' -> 'BTC-USD', 'SUI' -> 'SUI20947-USD', 'TON' -> 'TON11419-USD'
 * - TradFi: Mantiene el ticker institucional saneado ('SPY', 'QQQ', '^MERV', 'GGAL.BA')
 * 
 * @param {string} ticker Símbolo solicitado por el usuario
 * @param {'cripto' | 'tradfi'} mercado Mercado del activo
 * @returns {string} Símbolo adaptado para Yahoo Finance
 */
export function mapearTickerYahoo(ticker, mercado) {
  if (!ticker) return 'SPY';
  const raw = ticker.toString().trim().toUpperCase();

  if (mercado === 'cripto' || TOP_CRIPTO.includes(raw) || MAPEO_CRIPTO_YAHOO[raw]) {
    // Si ya incluye el formato oficial de par en USD de Yahoo Finance
    if (raw.endsWith('-USD')) {
      return raw;
    }

    // Remueve sufijos y separadores típicos de exchanges (USDT, BUSD, USD, ARS, /, _, -)
    const base = raw
      .replace(/[-_/]?(USDT|BUSD|USD|ARS)$/i, '')
      .replace(/[^A-Z0-9]/g, '');

    if (MAPEO_CRIPTO_YAHOO[base]) {
      return MAPEO_CRIPTO_YAHOO[base];
    }

    return `${base || 'BTC'}-USD`;
  }

  // Mercado TradFi
  return raw;
}

/**
 * Normaliza valores numéricos preservando precisión decimal adecuada
 * para activos de bajo valor unitario (como altcoins).
 */
function ajustarPrecision(val) {
  if (typeof val !== 'number' || isNaN(val)) return 0;
  if (val >= 1) return Number(val.toFixed(4));
  if (val >= 0.0001) return Number(val.toFixed(6));
  return Number(val.toFixed(8));
}

/**
 * Formatea precios para markers visuales en gráficos.
 */
function formatearPrecioMarker(p) {
  if (p >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(4);
}

/**
 * Proveedor Unificado de Datos Cuantitativos (Yahoo Finance).
 * Extrae y estandariza velas históricas diarias (OHLCV) para TradFi y Criptomonedas.
 * Reemplaza la dependencia de Binance API resolviendo el error HTTP 451 en servidores Vercel US.
 * 
 * @param {string} tickerYahoo Símbolo compatible con Yahoo Finance (ej. 'BTC-USD', 'SPY')
 * @param {'1y' | '2y'} periodo Rango temporal
 * @returns {Promise<Array<{time: string, open: number, high: number, low: number, close: number, volume: number}>>}
 */
async function obtenerVelasHistoricas(tickerYahoo, periodo = '1y') {
  const cleanTicker = tickerYahoo.trim().toUpperCase();
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - (periodo === '2y' ? 2 : 1));

  let rawCandles;
  try {
    rawCandles = await yf.historical(cleanTicker, {
      period1: start.toISOString().split('T')[0],
      period2: end.toISOString().split('T')[0],
      interval: '1d'
    });
  } catch (err) {
    throw new Error(`Error consultando datos históricos de Yahoo Finance para ${cleanTicker}: ${err.message}`);
  }

  if (!Array.isArray(rawCandles) || rawCandles.length === 0) {
    throw new Error(`No se obtuvieron velas históricas de Yahoo Finance para ${cleanTicker}`);
  }

  // Filtrado y adaptación estructural al formato esperado por el Motor Quant
  return rawCandles
    .filter(c => c && c.date && c.close != null && !isNaN(c.close))
    .map(c => {
      const close = Number(c.close);
      const open = Number(c.open != null && !isNaN(c.open) ? c.open : close);
      const high = Number(c.high != null && !isNaN(c.high) ? c.high : Math.max(open, close));
      const low = Number(c.low != null && !isNaN(c.low) ? c.low : Math.min(open, close));
      const volume = Number(c.volume != null && !isNaN(c.volume) ? c.volume : 0);

      return {
        time: new Date(c.date).toISOString().split('T')[0],
        open,
        high,
        low,
        close,
        volume
      };
    });
}

/**
 * Handler HTTP principal del microservicio de Backtesting.
 */
export default async function handler(req, res) {
  const inicioTimer = performance.now();

  try {
    // Soporte para body JSON (POST) y query params (GET)
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    } else if (!req.body && req.method === 'POST') {
      try {
        const buffers = [];
        for await (const chunk of req) {
          buffers.push(chunk);
        }
        const raw = Buffer.concat(buffers).toString('utf-8');
        if (raw) body = JSON.parse(raw);
      } catch {}
    }

    const params = { ...(req.query || {}), ...(body || {}) };
    const tickerOriginal = (params.ticker || 'SPY').toString().toUpperCase().trim();
    const mercado = inferirMercado(tickerOriginal, params.mercado);
    const capitalInicial = Math.max(100, Number(params.capital_inicial || params.capitalInicial || 10000));
    const periodo = (params.periodo || '1y').toString().toLowerCase();

    // Parámetros cuantitativos dinámicos (Walk-Forward Strategy Optimization)
    const rawBuy = params.buy_threshold ?? params.buyThreshold;
    const rawSell = params.sell_threshold ?? params.sellThreshold;
    const buyThreshold = Math.min(100, Math.max(50, rawBuy !== undefined && !isNaN(Number(rawBuy)) ? Number(rawBuy) : 80));
    const sellThreshold = Math.min(50, Math.max(0, rawSell !== undefined && !isNaN(Number(rawSell)) ? Number(rawSell) : 40));

    // Inicialización defensiva de Supabase para consulta de estrategias personalizadas
    let db = supabaseCliente;
    if (!db) {
      const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const url = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '') : null;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (url && key) {
        db = createClient(url, key);
      }
    }

    // Detección de Estrategia Personalizada Activa (Query Builder)
    let estrategiaActiva = null;
    if (params.estrategia) {
      try {
        estrategiaActiva = typeof params.estrategia === 'string' ? JSON.parse(params.estrategia) : params.estrategia;
      } catch (eParse) {
        console.warn('[Motor Backtesting] Error parseando estrategia enviada en params:', eParse.message);
      }
    } else if (db) {
      try {
        const { data: estData } = await db
          .from('estrategias_personalizadas')
          .select('*')
          .eq('activa', true)
          .limit(1);
        if (estData && estData.length > 0) {
          estrategiaActiva = estData[0];
        }
      } catch (errEst) {
        console.warn('[Motor Backtesting] Aviso consultando estrategias_personalizadas:', errEst.message);
      }
    }

    // 1. Mapeo de ticker y extracción histórica unificada mediante Yahoo Finance
    const tickerYahoo = mapearTickerYahoo(tickerOriginal, mercado);
    const rawCandles = await obtenerVelasHistoricas(tickerYahoo, periodo);

    // 2. Normalización, deduplicación y ordenamiento temporal estricto (requerido por lightweight-charts)
    const candlesMap = new Map();
    for (const c of rawCandles) {
      if (c && c.time && typeof c.close === 'number' && !isNaN(c.close) && c.close > 0) {
        candlesMap.set(c.time, {
          time: c.time,
          open: ajustarPrecision(c.open),
          high: ajustarPrecision(c.high),
          low: ajustarPrecision(c.low),
          close: ajustarPrecision(c.close),
          volume: Number(Number(c.volume || 0).toFixed(2))
        });
      }
    }

    const candles = Array.from(candlesMap.values()).sort((a, b) => a.time.localeCompare(b.time));

    if (candles.length < 35) {
      return res.status(400).json({
        status: 'error',
        message: `Velas insuficientes para backtest (${candles.length} disponibles, se requieren al menos 35 para estabilidad de indicadores quant).`
      });
    }

    // 3. Motor de Simulación Iterativa Walk-Forward (Sin Look-Ahead Bias)
    let cash = capitalInicial;
    let posicionAbierta = null;
    let peakCapital = capitalInicial;
    let maxDrawdown = 0;

    const trades = [];
    const markers = [];
    const curvaEquity = [];
    const scoresHistoricos = [];

    // Iteramos día por día cronológicamente
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];

      // En cada vela i, únicamente los datos hasta ese día están disponibles
      let scoreActual = 50;
      let dictamenActual = 'HOLD';
      let señalCompra = false;
      let señalVenta = false;
      let motivoOperacion = '';

      // Período de warmup técnico (mínimo 26 períodos para MACD)
      if (i >= 26) {
        const slicePrecios = candles.slice(0, i + 1).map(item => item.close);
        const rsi = calcularRSI(slicePrecios, 14);
        const macd = calcularMACD(slicePrecios, 12, 26, 9);
        const bollinger = calcularBandasBollinger(slicePrecios, 20, 2);
        const quant = calcularCondorScore({ rsi, bollinger, macd });
        scoreActual = quant.condorScore;
        dictamenActual = quant.dictamen;

        // Evaluación con Estrategia Personalizada Dinámica si está activa
        if (estrategiaActiva) {
          const prevClose = i > 0 ? candles[i - 1].close : c.open;
          const variacion24h = prevClose > 0 ? ((c.close - prevClose) / prevClose) * 100 : 0;

          const datosVela = {
            activo: tickerOriginal,
            precioActual: c.close,
            close: c.close,
            open: c.open,
            high: c.high,
            low: c.low,
            volume: c.volume,
            rsi,
            macd,
            bollinger,
            variacion24h,
            condorScore: quant.condorScore,
            dictamen: quant.dictamen
          };

          const reglas = estrategiaActiva.reglas_json || estrategiaActiva;
          const evalDinamica = evaluarEstrategiaDinamica(datosVela, reglas);

          if (evalDinamica.cumpleCompra) {
            scoreActual = Math.max(quant.condorScore, 95);
            dictamenActual = 'STRONG_BUY';
            señalCompra = true;
            motivoOperacion = `[${estrategiaActiva.nombre || 'Estrategia'}] Entrada confirmada`;
          } else if (evalDinamica.cumpleVenta) {
            scoreActual = Math.min(quant.condorScore, 15);
            dictamenActual = 'STRONG_SELL';
            señalVenta = true;
            motivoOperacion = `[${estrategiaActiva.nombre || 'Estrategia'}] Salida confirmada`;
          } else {
            // Si la estrategia es un array plano de compra y no tiene reglas de venta explícitas,
            // utilizamos el sellThreshold para stop de seguridad cuantitativo
            if (Array.isArray(reglas) && quant.condorScore <= sellThreshold) {
              señalVenta = true;
              motivoOperacion = `Stop CondorScore <= ${sellThreshold}`;
            }
          }
        } else {
          // Lógica tradicional de CondorScore base con parámetros dinámicos
          señalCompra = scoreActual >= buyThreshold;
          señalVenta = scoreActual <= sellThreshold;
          motivoOperacion = señalCompra
            ? `CondorScore >= ${buyThreshold}`
            : `CondorScore <= ${sellThreshold}`;
        }
      }

      scoresHistoricos.push({ time: c.time, score: scoreActual, dictamen: dictamenActual });

      // LÓGICA DE TRADING INSTITUCIONAL (All-In / Liquidación de Posición):
      // A. COMPRA (All-In): Si se activa señal de compra y no hay posición abierta
      if (señalCompra && !posicionAbierta && cash > 0) {
        const precioCompra = c.close;
        const cantidad = cash / precioCompra;
        posicionAbierta = {
          fechaEntrada: c.time,
          precioCompra,
          cantidad,
          costoTotal: cash,
          scoreEntrada: scoreActual,
          motivo: motivoOperacion
        };
        cash = 0;

        markers.push({
          time: c.time,
          position: 'belowBar',
          color: '#10b981',
          shape: 'arrowUp',
          text: `BUY @ $${formatearPrecioMarker(precioCompra)}`
        });
      }
      // B. VENTA: Si se activa señal de venta y hay posición abierta
      else if (señalVenta && posicionAbierta) {
        const precioVenta = c.close;
        const valorVenta = posicionAbierta.cantidad * precioVenta;
        const pnlUsd = valorVenta - posicionAbierta.costoTotal;
        const pnlPct = ((precioVenta - posicionAbierta.precioCompra) / posicionAbierta.precioCompra) * 100;
        cash = valorVenta;

        const duracionDias = Math.max(1, Math.round(
          (new Date(c.time).getTime() - new Date(posicionAbierta.fechaEntrada).getTime()) / 86400000
        ));

        trades.push({
          id: trades.length + 1,
          fechaEntrada: posicionAbierta.fechaEntrada,
          fechaSalida: c.time,
          precioCompra: ajustarPrecision(posicionAbierta.precioCompra),
          precioVenta: ajustarPrecision(precioVenta),
          cantidad: Number(posicionAbierta.cantidad.toFixed(6)),
          pnlUsd: Number(pnlUsd.toFixed(2)),
          pnlPct: Number(pnlPct.toFixed(2)),
          duracionDias,
          scoreEntrada: posicionAbierta.scoreEntrada,
          scoreSalida: scoreActual,
          motivoSalida: motivoOperacion,
          estrategia: estrategiaActiva ? (estrategiaActiva.nombre || 'Estrategia Personalizada') : 'CondorScore Base',
          resultado: pnlUsd >= 0 ? 'WIN' : 'LOSS',
          capitalResultante: Number(cash.toFixed(2))
        });

        markers.push({
          time: c.time,
          position: 'aboveBar',
          color: '#ef4444',
          shape: 'arrowDown',
          text: `SELL @ $${formatearPrecioMarker(precioVenta)}`
        });

        posicionAbierta = null;
      }

      // Registro del valor total de la cartera (Equity) y Drawdown al cierre de la vela
      const equityActual = posicionAbierta ? (posicionAbierta.cantidad * c.close) : cash;
      if (equityActual > peakCapital) {
        peakCapital = equityActual;
      }
      const drawdownActual = peakCapital > 0 ? ((peakCapital - equityActual) / peakCapital) * 100 : 0;
      if (drawdownActual > maxDrawdown) {
        maxDrawdown = drawdownActual;
      }

      curvaEquity.push({
        time: c.time,
        equity: Number(equityActual.toFixed(2)),
        drawdown: Number(drawdownActual.toFixed(2)),
        score: scoreActual
      });
    }

    // 4. Liquidación Teórica Final / Posición Abierta Residual
    const ultimaVela = candles[candles.length - 1];
    let capitalFinal = cash;
    let posicionResidualInfo = null;

    if (posicionAbierta) {
      const valorActual = posicionAbierta.cantidad * ultimaVela.close;
      capitalFinal = valorActual;
      const pnlNoRealizadoUsd = valorActual - posicionAbierta.costoTotal;
      const pnlNoRealizadoPct = ((ultimaVela.close - posicionAbierta.precioCompra) / posicionAbierta.precioCompra) * 100;

      posicionResidualInfo = {
        abierta: true,
        fechaEntrada: posicionAbierta.fechaEntrada,
        precioCompra: ajustarPrecision(posicionAbierta.precioCompra),
        precioActual: ajustarPrecision(ultimaVela.close),
        cantidad: Number(posicionAbierta.cantidad.toFixed(6)),
        pnlNoRealizadoUsd: Number(pnlNoRealizadoUsd.toFixed(2)),
        pnlNoRealizadoPct: Number(pnlNoRealizadoPct.toFixed(2))
      };
    }

    // 5. Cálculo de Métricas Institucionales Cuantitativas
    const gananciaNeta = capitalFinal - capitalInicial;
    const roi = ((capitalFinal - capitalInicial) / capitalInicial) * 100;

    const primeraVela = candles[0];
    const buyAndHoldRoi = ((ultimaVela.close - primeraVela.close) / primeraVela.close) * 100;

    const tradesGanadores = trades.filter(t => t.pnlUsd > 0);
    const tradesPerdedores = trades.filter(t => t.pnlUsd <= 0);
    const winRate = trades.length > 0 ? (tradesGanadores.length / trades.length) * 100 : 0;

    const gananciaBruta = tradesGanadores.reduce((acc, t) => acc + t.pnlUsd, 0);
    const perdidaBruta = Math.abs(tradesPerdedores.reduce((acc, t) => acc + t.pnlUsd, 0));
    const profitFactor = perdidaBruta > 0 ? gananciaBruta / perdidaBruta : gananciaBruta > 0 ? 99.99 : 1.0;

    const duracionPromedioDias = trades.length > 0
      ? trades.reduce((acc, t) => acc + t.duracionDias, 0) / trades.length
      : 0;

    const duracionMs = Math.round(performance.now() - inicioTimer);

    // 6. Respuesta JSON Cuantitativa
    return res.status(200).json({
      status: 'success',
      simulacion: {
        ticker: tickerOriginal,
        tickerYahoo,
        mercado,
        periodo,
        estrategia: estrategiaActiva ? {
          id: estrategiaActiva.id,
          nombre: estrategiaActiva.nombre || 'Estrategia Personalizada',
          descripcion: estrategiaActiva.descripcion,
          activa: true
        } : null,
        parametros: {
          buyThreshold,
          sellThreshold
        },
        fechaInicio: primeraVela.time,
        fechaFin: ultimaVela.time,
        totalVelas: candles.length,
        duracionMs
      },
      metricas: {
        capitalInicial: Number(capitalInicial.toFixed(2)),
        capitalFinal: Number(capitalFinal.toFixed(2)),
        gananciaNeta: Number(gananciaNeta.toFixed(2)),
        roi: Number(roi.toFixed(2)),
        buyAndHoldRoi: Number(buyAndHoldRoi.toFixed(2)),
        alpha: Number((roi - buyAndHoldRoi).toFixed(2)),
        winRate: Number(winRate.toFixed(2)),
        maxDrawdown: Number(maxDrawdown.toFixed(2)),
        totalTrades: trades.length + (posicionAbierta ? 1 : 0),
        tradesCerrados: trades.length,
        tradesGanadores: tradesGanadores.length,
        tradesPerdedores: tradesPerdedores.length,
        profitFactor: Number(profitFactor.toFixed(2)),
        duracionPromedioDias: Number(duracionPromedioDias.toFixed(1))
      },
      posicionResidual: posicionResidualInfo,
      historialOperaciones: trades,
      markers,
      curvaEquity,
      velas: candles
    });

  } catch (error) {
    console.error('[API /api/backtest] Error en simulación:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message || 'Error interno ejecutando backtesting'
    });
  }
}
