/**
 * ==============================================================================
 * CondorFi - Motor de Backtesting Institucional Cuantitativo
 * Archivo: condorfi-ui/api/backtest.js
 * 
 * Microservicio Serverless para Vercel & Vite Dev Server.
 * Simula el rendimiento del algoritmo CondorScore sin sesgo de anticipación
 * (Look-Ahead Bias) sobre datos históricos diarios (1 a 2 años).
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
 */
function inferirMercado(ticker, mercadoParam) {
  if (mercadoParam) {
    const m = mercadoParam.toLowerCase().trim();
    if (m === 'cripto' || m === 'crypto') return 'cripto';
    if (m === 'tradfi' || m === 'acciones' || m === 'indices' || m === 'bonos') return 'tradfi';
  }

  const clean = ticker.toUpperCase().replace('USDT', '').trim();
  if (TOP_CRIPTO.includes(clean) || ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX'].includes(clean)) {
    return 'cripto';
  }

  return 'tradfi';
}

/**
 * Obtiene velas históricas de Binance para criptoactivos.
 */
async function obtenerVelasBinance(ticker, periodo = '1y') {
  const clean = ticker.toUpperCase().replace('USDT', '').trim();
  const symbol = `${clean}USDT`;
  const limit = periodo === '2y' ? 730 : 365;
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=${limit}`;

  const res = await fetch(url, { headers: { 'User-Agent': 'CondorFi-Quant/1.0' } });
  if (!res.ok) {
    throw new Error(`Binance API respondió con status ${res.status}: ${res.statusText}`);
  }

  const klines = await res.json();
  if (!Array.isArray(klines) || klines.length === 0) {
    throw new Error(`No se obtuvieron velas históricas de Binance para ${symbol}`);
  }

  return klines.map(k => {
    const d = new Date(k[0]);
    return {
      time: d.toISOString().split('T')[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    };
  });
}

/**
 * Obtiene velas históricas de Yahoo Finance para activos TradFi.
 */
async function obtenerVelasYahoo(ticker, periodo = '1y') {
  const cleanTicker = ticker.trim().toUpperCase();
  const end = new Date();
  const start = new Date();
  start.setFullYear(start.getFullYear() - (periodo === '2y' ? 2 : 1));

  const rawCandles = await yf.historical(cleanTicker, {
    period1: start.toISOString().split('T')[0],
    period2: end.toISOString().split('T')[0],
    interval: '1d'
  });

  if (!Array.isArray(rawCandles) || rawCandles.length === 0) {
    throw new Error(`No se obtuvieron velas históricas de Yahoo Finance para ${cleanTicker}`);
  }

  return rawCandles
    .filter(c => c && c.date && c.close != null && !isNaN(c.close))
    .map(c => ({
      time: new Date(c.date).toISOString().split('T')[0],
      open: Number(c.open || c.close),
      high: Number(c.high || c.close),
      low: Number(c.low || c.close),
      close: Number(c.close),
      volume: Number(c.volume || 0)
    }));
}

/**
 * Handler HTTP principal del microservicio de Backtesting.
 */
export default async function handler(req, res) {
  const inicioTimer = performance.now();

  try {
    const params = { ...(req.query || {}), ...(req.body || {}) };
    const ticker = (params.ticker || 'SPY').toString().toUpperCase().trim();
    const mercado = inferirMercado(ticker, params.mercado);
    const capitalInicial = Math.max(100, Number(params.capital_inicial || params.capitalInicial || 10000));
    const periodo = (params.periodo || '1y').toString().toLowerCase();

    // 1. Extracción histórica según mercado
    let rawCandles = [];
    if (mercado === 'cripto') {
      rawCandles = await obtenerVelasBinance(ticker, periodo);
    } else {
      rawCandles = await obtenerVelasYahoo(ticker, periodo);
    }

    // 2. Normalización, deduplicación y ordenamiento temporal estricto (requerido por lightweight-charts)
    const candlesMap = new Map();
    for (const c of rawCandles) {
      if (c && c.time && typeof c.close === 'number' && !isNaN(c.close) && c.close > 0) {
        candlesMap.set(c.time, {
          time: c.time,
          open: Number(c.open.toFixed(4)),
          high: Number(c.high.toFixed(4)),
          low: Number(c.low.toFixed(4)),
          close: Number(c.close.toFixed(4)),
          volume: Number(c.volume.toFixed(2))
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

      // Período de warmup técnico (mínimo 26 períodos para MACD)
      if (i >= 26) {
        const slicePrecios = candles.slice(0, i + 1).map(item => item.close);
        const rsi = calcularRSI(slicePrecios, 14);
        const macd = calcularMACD(slicePrecios, 12, 26, 9);
        const bollinger = calcularBandasBollinger(slicePrecios, 20, 2);
        const quant = calcularCondorScore({ rsi, bollinger, macd });
        scoreActual = quant.condorScore;
        dictamenActual = quant.dictamen;
      }

      scoresHistoricos.push({ time: c.time, score: scoreActual, dictamen: dictamenActual });

      // LÓGICA DE TRADING INSTITUCIONAL CONDORSCORE:
      // A. COMPRA (All-In): Si CondorScore >= 80 (STRONG_BUY) y no hay posición abierta
      if (scoreActual >= 80 && !posicionAbierta && cash > 0) {
        const precioCompra = c.close;
        const cantidad = cash / precioCompra;
        posicionAbierta = {
          fechaEntrada: c.time,
          precioCompra,
          cantidad,
          costoTotal: cash,
          scoreEntrada: scoreActual
        };
        cash = 0;

        markers.push({
          time: c.time,
          position: 'belowBar',
          color: '#10b981',
          shape: 'arrowUp',
          text: `BUY @ $${precioCompra >= 1000 ? precioCompra.toLocaleString(undefined, { maximumFractionDigits: 1 }) : precioCompra.toFixed(2)}`
        });
      }
      // B. VENTA: Si CondorScore <= 40 (SELL / STRONG_SELL) y hay posición abierta
      else if (scoreActual <= 40 && posicionAbierta) {
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
          precioCompra: Number(posicionAbierta.precioCompra.toFixed(4)),
          precioVenta: Number(precioVenta.toFixed(4)),
          cantidad: Number(posicionAbierta.cantidad.toFixed(6)),
          pnlUsd: Number(pnlUsd.toFixed(2)),
          pnlPct: Number(pnlPct.toFixed(2)),
          duracionDias,
          scoreEntrada: posicionAbierta.scoreEntrada,
          scoreSalida: scoreActual,
          resultado: pnlUsd >= 0 ? 'WIN' : 'LOSS',
          capitalResultante: Number(cash.toFixed(2))
        });

        markers.push({
          time: c.time,
          position: 'aboveBar',
          color: '#ef4444',
          shape: 'arrowDown',
          text: `SELL @ $${precioVenta >= 1000 ? precioVenta.toLocaleString(undefined, { maximumFractionDigits: 1 }) : precioVenta.toFixed(2)}`
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
        precioCompra: Number(posicionAbierta.precioCompra.toFixed(4)),
        precioActual: Number(ultimaVela.close.toFixed(4)),
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
        ticker,
        mercado,
        periodo,
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
