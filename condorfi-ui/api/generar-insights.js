/**
 * ==============================================================================
 * CondorFi - Motor Quant Institucional y Screener Multimercado
 * Archivo: condorfi-ui/api/generar-insights.js
 * 
 * Serverless Function para Vercel:
 * Procesa activos individuales o lotes (batch) para TradFi y Cripto.
 * 
 * Modelos Matemáticos Cuantitativos:
 * 1. RSI (Relative Strength Index) de 14 períodos (Wilder's Smoothing).
 * 2. MACD (Moving Average Convergence Divergence) [12, 26, 9].
 * 3. Bandas de Bollinger [SMA(20), ±2σ] con %B y Bandwidth.
 * 4. CondorScore Cuantitativo (0 a 100) y Dictamen Institucional:
 *    ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'].
 * 5. Persistencia selectiva en 'alertas_mercado'.
 * ==============================================================================
 */

import { supabase as supabaseCliente } from '../src/lib/supabase.js';
import { createClient } from '@supabase/supabase-js';

// Polyfill ligero para WebSocket en entornos Serverless Node < 22
if (!globalThis.WebSocket) {
  globalThis.WebSocket = class DummyWebSocket {};
}

export const TOP_CRIPTO = [
  'USDT', 'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOGE', 'LINK',
  'DOT', 'MATIC', 'SHIB', 'LTC', 'UNI', 'ATOM', 'NEAR', 'ARB', 'OP', 'INJ'
];

export const TRADFI_GLOBAL = [
  'SPY', 'QQQ', 'DIA', 'IWM', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL', 'AMD', 'NFLX', 'JPM'
];

export const TRADFI_ARG_BONOS = [
  '^MERV', 'GGAL.BA', 'YPFD.BA', 'PAMP.BA', 'AL30.BA', 'GD30.BA', 'TLT'
];

export const UNIVERSO_COMPLETO = [...TRADFI_GLOBAL, ...TRADFI_ARG_BONOS, ...TOP_CRIPTO];

// Catálogo de metadatos de referencia institucional
const ASSETS_METADATA = {
  // TradFi Global: Índices y Tech
  SPY:     { nombre: 'S&P 500 ETF Trust',             mercado: 'NYSE Arca', tipo: 'tradfi', baseMoneda: 'USD' },
  QQQ:     { nombre: 'Invesco QQQ (Nasdaq 100)',       mercado: 'NASDAQ',    tipo: 'tradfi', baseMoneda: 'USD' },
  DIA:     { nombre: 'SPDR Dow Jones Industrial',      mercado: 'NYSE Arca', tipo: 'tradfi', baseMoneda: 'USD' },
  IWM:     { nombre: 'iShares Russell 2000 ETF',       mercado: 'NYSE Arca', tipo: 'tradfi', baseMoneda: 'USD' },
  AAPL:    { nombre: 'Apple Inc.',                     mercado: 'NASDAQ',    tipo: 'tradfi', baseMoneda: 'USD' },
  MSFT:    { nombre: 'Microsoft Corporation',          mercado: 'NASDAQ',    tipo: 'tradfi', baseMoneda: 'USD' },
  NVDA:    { nombre: 'NVIDIA Corporation',             mercado: 'NASDAQ',    tipo: 'tradfi', baseMoneda: 'USD' },
  TSLA:    { nombre: 'Tesla Inc.',                     mercado: 'NASDAQ',    tipo: 'tradfi', baseMoneda: 'USD' },
  AMZN:    { nombre: 'Amazon.com Inc.',                mercado: 'NASDAQ',    tipo: 'tradfi', baseMoneda: 'USD' },
  META:    { nombre: 'Meta Platforms Inc.',            mercado: 'NASDAQ',    tipo: 'tradfi', baseMoneda: 'USD' },
  GOOGL:   { nombre: 'Alphabet Inc. (Google)',         mercado: 'NASDAQ',    tipo: 'tradfi', baseMoneda: 'USD' },
  AMD:     { nombre: 'Advanced Micro Devices',         mercado: 'NASDAQ',    tipo: 'tradfi', baseMoneda: 'USD' },
  NFLX:    { nombre: 'Netflix Inc.',                   mercado: 'NASDAQ',    tipo: 'tradfi', baseMoneda: 'USD' },
  JPM:     { nombre: 'JPMorgan Chase & Co.',           mercado: 'NYSE',      tipo: 'tradfi', baseMoneda: 'USD' },

  // TradFi Argentina & Renta Fija
  '^MERV':   { nombre: 'S&P Merval Argentina',         mercado: 'BYMA',      tipo: 'tradfi', baseMoneda: 'ARS' },
  'GGAL.BA': { nombre: 'Grupo Financiero Galicia',     mercado: 'BYMA',      tipo: 'tradfi', baseMoneda: 'ARS' },
  'YPFD.BA': { nombre: 'YPF Sociedad Anónima',         mercado: 'BYMA',      tipo: 'tradfi', baseMoneda: 'ARS' },
  'PAMP.BA': { nombre: 'Pampa Energía S.A.',           mercado: 'BYMA',      tipo: 'tradfi', baseMoneda: 'ARS' },
  'AL30.BA': { nombre: 'Bono Bonar 2030 Ley Arg',      mercado: 'BYMA',      tipo: 'tradfi', baseMoneda: 'ARS' },
  'GD30.BA': { nombre: 'Bono Global 2030 Ley NY',      mercado: 'BYMA',      tipo: 'tradfi', baseMoneda: 'ARS' },
  TLT:       { nombre: 'iShares 20+ Year Treasury ETF', mercado: 'NASDAQ',    tipo: 'tradfi', baseMoneda: 'USD' },

  // Top Criptoactivos
  USDT:    { nombre: 'Tether USD',                    mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' },
  BTC:     { nombre: 'Bitcoin',                       mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' },
  ETH:     { nombre: 'Ethereum',                      mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' },
  SOL:     { nombre: 'Solana',                        mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' },
  BNB:     { nombre: 'BNB Chain',                     mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' },
  XRP:     { nombre: 'XRP (Ripple)',                  mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' },
  ADA:     { nombre: 'Cardano',                       mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' },
  AVAX:    { nombre: 'Avalanche',                     mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' },
  DOGE:    { nombre: 'Dogecoin',                      mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' },
  LINK:    { nombre: 'Chainlink',                     mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' },
  DOT:     { nombre: 'Polkadot',                      mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' },
  MATIC:   { nombre: 'Polygon (MATIC)',               mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' },
  SHIB:    { nombre: 'Shiba Inu',                     mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' },
  LTC:     { nombre: 'Litecoin',                      mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' },
  UNI:     { nombre: 'Uniswap',                       mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' },
  ATOM:    { nombre: 'Cosmos',                        mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' },
  NEAR:    { nombre: 'NEAR Protocol',                 mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' },
  ARB:     { nombre: 'Arbitrum',                      mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' },
  OP:      { nombre: 'Optimism',                      mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' },
  INJ:     { nombre: 'Injective Protocol',            mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' },
  USDC:    { nombre: 'USD Coin',                      mercado: 'Cripto ARS', tipo: 'cripto', baseMoneda: 'ARS' }
};


/**
 * Calcula la Media Móvil Simple (SMA) de un array numérico.
 */
export function calcularSMA(valores) {
  if (!valores || valores.length === 0) return 0;
  const suma = valores.reduce((acc, val) => acc + val, 0);
  return suma / valores.length;
}

/**
 * Calcula la Desviación Estándar poblacional (σ) de un array numérico.
 */
export function calcularDesviacionEstandar(valores, sma) {
  if (!valores || valores.length === 0) return 0;
  const media = typeof sma === 'number' ? sma : calcularSMA(valores);
  const sumaDiferenciasCuadradas = valores.reduce((acc, val) => acc + Math.pow(val - media, 2), 0);
  return Math.sqrt(sumaDiferenciasCuadradas / valores.length);
}

/**
 * Calcula el RSI (Relative Strength Index) con período estándar de 14.
 * Recibe array de precios cronológicos [antiguo -> reciente].
 */
export function calcularRSI(precios, periodo = 14) {
  if (!precios || precios.length < 2) return 50.0;

  const deltas = [];
  for (let i = 1; i < precios.length; i++) {
    deltas.push(precios[i] - precios[i - 1]);
  }

  const n = Math.min(deltas.length, periodo);
  let gainSum = 0;
  let lossSum = 0;

  for (let i = 0; i < n; i++) {
    if (deltas[i] > 0) gainSum += deltas[i];
    else lossSum += Math.abs(deltas[i]);
  }

  let avgGain = gainSum / (n || 1);
  let avgLoss = lossSum / (n || 1);

  // Alisado exponencial de Wilder para el resto de la serie
  for (let i = n; i < deltas.length; i++) {
    const diff = deltas[i];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (periodo - 1) + gain) / periodo;
    avgLoss = (avgLoss * (periodo - 1) + loss) / periodo;
  }

  if (avgLoss === 0 && avgGain === 0) return 50.0;
  if (avgLoss === 0) return 100.0;
  if (avgGain === 0) return 0.0;

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  return Number(Math.max(0, Math.min(100, rsi)).toFixed(2));
}

/**
 * Calcula EMA (Exponential Moving Average) sobre una serie de precios.
 */
export function calcularEMA(precios, periodo) {
  if (!precios || precios.length === 0) return [];
  const k = 2 / (periodo + 1);
  const emaArray = [precios[0]];
  for (let i = 1; i < precios.length; i++) {
    const ema = precios[i] * k + emaArray[i - 1] * (1 - k);
    emaArray.push(ema);
  }
  return emaArray;
}

/**
 * Calcula MACD (12, 26, 9) sobre una serie de precios cronológicos.
 */
export function calcularMACD(precios, fast = 12, slow = 26, signalPeriod = 9) {
  if (!precios || precios.length === 0) {
    return { macd: 0, signal: 0, histogram: 0, trend: 'NEUTRAL', cruceAlcista: false, cruceBajista: false };
  }

  const emaFast = calcularEMA(precios, fast);
  const emaSlow = calcularEMA(precios, slow);

  const macdLine = [];
  for (let i = 0; i < precios.length; i++) {
    macdLine.push(emaFast[i] - emaSlow[i]);
  }

  const signalLine = calcularEMA(macdLine, signalPeriod);

  const ultimoIndex = precios.length - 1;
  const ultimoMACD = macdLine[ultimoIndex] || 0;
  const ultimoSignal = signalLine[ultimoIndex] || 0;
  const ultimoHistogram = ultimoMACD - ultimoSignal;

  const prevIndex = Math.max(0, ultimoIndex - 1);
  const prevHistogram = (macdLine[prevIndex] || 0) - (signalLine[prevIndex] || 0);

  const cruceAlcista = prevHistogram <= 0 && ultimoHistogram > 0;
  const cruceBajista = prevHistogram >= 0 && ultimoHistogram < 0;
  const trend = ultimoHistogram > 0 ? 'BULLISH' : ultimoHistogram < 0 ? 'BEARISH' : 'NEUTRAL';

  return {
    macd: Number(ultimoMACD.toFixed(4)),
    signal: Number(ultimoSignal.toFixed(4)),
    histogram: Number(ultimoHistogram.toFixed(4)),
    trend,
    cruceAlcista,
    cruceBajista
  };
}

/**
 * Calcula Bandas de Bollinger [SMA(20), ±2σ] con %B y Bandwidth.
 */
export function calcularBandasBollinger(precios, periodo = 20, numDesvios = 2) {
  if (!precios || precios.length === 0) {
    return { middle: 0, upper: 0, lower: 0, percentB: 0.5, bandwidth: 0, stdDev: 0 };
  }

  const slice = precios.slice(-periodo);
  const sma = slice.reduce((a, b) => a + b, 0) / slice.length;

  const varianza = slice.reduce((acc, p) => acc + Math.pow(p - sma, 2), 0) / slice.length;
  const stdDev = Math.sqrt(varianza);

  const upper = sma + (numDesvios * stdDev);
  const lower = sma - (numDesvios * stdDev);

  const precioActual = slice[slice.length - 1];
  const rango = upper - lower;
  const percentB = rango > 0 ? (precioActual - lower) / rango : 0.5;
  const bandwidth = sma > 0 ? ((upper - lower) / sma) * 100 : 0;

  return {
    middle: Number(sma.toFixed(4)),
    upper: Number(upper.toFixed(4)),
    lower: Number(lower.toFixed(4)),
    percentB: Number(percentB.toFixed(4)),
    bandwidth: Number(bandwidth.toFixed(2)),
    stdDev: Number(stdDev.toFixed(4))
  };
}

/**
 * Motor de Scoring Cuantitativo CondorScore (0 a 100) y Dictamen Institucional.
 * 
 * Reglas de ponderación:
 * 1. RSI (< 30 sobreventa suma +28 a +35 pts; > 70 sobrecompra resta -28 a -35 pts).
 * 2. Bandas de Bollinger (%B <= 0 toca banda inferior suma +25 a +30 pts; %B >= 1.0 resta -30 pts).
 * 3. MACD (Cruce alcista suma +25 pts; histograma positivo suma +15 pts; cruce bajista resta -25 pts).
 */
export function calcularCondorScore({ rsi, bollinger, macd }) {
  let score = 50; // Punto neutral base

  // 1. Evaluación RSI
  if (rsi < 25) {
    score += 35; // Sobreventa extrema
  } else if (rsi < 30) {
    score += 28; // Sobreventa
  } else if (rsi < 42) {
    score += 14; // Acumulación / rebote
  } else if (rsi > 75) {
    score -= 35; // Sobrecompra extrema
  } else if (rsi > 70) {
    score -= 28; // Sobrecompra
  } else if (rsi > 60) {
    score -= 10;
  }

  // 2. Evaluación Bandas de Bollinger
  if (bollinger.percentB <= 0) {
    score += 30; // Ruptura de banda inferior (Mean Reversion)
  } else if (bollinger.percentB <= 0.20) {
    score += 20; // Zona de soporte inferior
  } else if (bollinger.percentB >= 1.0) {
    score -= 30; // Ruptura de banda superior (Sobreextensión)
  } else if (bollinger.percentB >= 0.80) {
    score -= 18; // Resistencia de banda superior
  }

  // 3. Evaluación MACD & Momentum
  if (macd.cruceAlcista) {
    score += 25; // Golden cross de momentum
  } else if (macd.histogram > 0 && macd.trend === 'BULLISH') {
    score += 15; // Momentum comprador
  } else if (macd.cruceBajista) {
    score -= 25; // Death cross de momentum
  } else if (macd.histogram < 0 && macd.trend === 'BEARISH') {
    score -= 15; // Momentum vendedor
  }

  // Bounding estricto [0, 100]
  const finalScore = Math.round(Math.max(0, Math.min(100, score)));

  // Dictamen Institucional
  let dictamen = 'HOLD';
  if (finalScore >= 80) dictamen = 'STRONG_BUY';
  else if (finalScore >= 62) dictamen = 'BUY';
  else if (finalScore <= 20) dictamen = 'STRONG_SELL';
  else if (finalScore <= 38) dictamen = 'SELL';

  return {
    condorScore: finalScore,
    dictamen
  };
}

/**
 * Normaliza y extrae un array de tickers o monedas de la query o body.
 */
function extraerListaActivos(req, defaultMercado) {
  const query = req.query || {};
  const body = req.body || {};

  let items = [];

  if (body.tickers && Array.isArray(body.tickers)) items.push(...body.tickers);
  else if (typeof body.tickers === 'string') items.push(...body.tickers.split(','));

  if (body.monedas && Array.isArray(body.monedas)) items.push(...body.monedas);
  else if (typeof body.monedas === 'string') items.push(...body.monedas.split(','));

  if (query.tickers) {
    items.push(...String(query.tickers).split(','));
  }
  if (query.monedas) {
    items.push(...String(query.monedas).split(','));
  }
  if (query.ticker) items.push(String(query.ticker));
  if (query.moneda) items.push(String(query.moneda));

  items = items.map(s => s.trim().toUpperCase()).filter(Boolean);

  if (items.length === 0) {
    if (defaultMercado === 'tradfi') {
      return [...TRADFI_GLOBAL, ...TRADFI_ARG_BONOS];
    }
    if (defaultMercado === 'cripto') {
      return TOP_CRIPTO;
    }
    return UNIVERSO_COMPLETO;
  }

  return Array.from(new Set(items));
}

/**
 * Determina si un símbolo corresponde al mercado TradFi.
 */
function esActivoTradfi(activo, mercadoParam) {
  const a = (activo || '').toUpperCase();
  if (mercadoParam === 'tradfi') return true;
  if (mercadoParam === 'cripto') return false;
  if (TRADFI_GLOBAL.includes(a) || TRADFI_ARG_BONOS.includes(a) || a.endsWith('.BA') || a === '^MERV') {
    return true;
  }
  return ASSETS_METADATA[a]?.tipo === 'tradfi';
}


/**
 * Procesa cuantitativamente un activo TradFi.
 * Implementa Graceful Degradation: Nunca descarta un activo del array final.
 */
async function analizarActivoTradfi(db, ticker, limite = 100) {
  const meta = ASSETS_METADATA[ticker] || {
    nombre: ticker,
    mercado: 'TradFi',
    tipo: 'tradfi',
    baseMoneda: (ticker === '^MERV' || ticker.endsWith('.BA')) ? 'ARS' : 'USD'
  };

  const { data: registros, error } = await db
    .from('cotizaciones_tradfi')
    .select('id, timestamp, ticker, precio_actual, precio_apertura, moneda, maximo_diario, minimo_diario')
    .eq('ticker', ticker)
    .order('id', { ascending: false })
    .limit(limite);

  // Caso 1: Sin registros en base de datos (0 muestras)
  if (error || !registros || registros.length === 0) {
    return {
      activo: ticker,
      nombre: meta.nombre,
      mercado: meta.mercado,
      tipoMercado: 'tradfi',
      moneda: meta.baseMoneda,
      precioActual: null,
      precioApertura: null,
      variacion24h: 0,
      condorScore: null,
      dictamen: 'INSUFFICIENT_DATA',
      status: 'INSUFFICIENT_DATA',
      rsi: null,
      macd: null,
      bollinger: null,
      esVolatilidadExtrema: false,
      mensaje: `Historial insuficiente para ${ticker} (0 muestras en base de datos). Recopilando datos de mercado.`,
      totalMuestras: 0,
      timestamp: new Date().toISOString()
    };
  }

  // Invertir a orden cronológico (antiguo -> reciente) para indicadores técnicos
  const cronologicos = [...registros].reverse();
  const precios = cronologicos.map(r => Number(r.precio_actual)).filter(p => !isNaN(p) && p > 0);
  const registroReciente = registros[0];
  const precioActual = Number(registroReciente.precio_actual) || 0;
  const precioApertura = Number(registroReciente.precio_apertura) || precioActual;

  const variacionApertura = precioApertura > 0
    ? Number((((precioActual - precioApertura) / precioApertura) * 100).toFixed(2))
    : 0;

  // Caso 2: Muestras insuficientes para modelos estadísticos (< 14 períodos)
  if (precios.length < 14) {
    return {
      activo: ticker,
      nombre: meta.nombre,
      mercado: meta.mercado,
      tipoMercado: 'tradfi',
      moneda: registroReciente.moneda || meta.baseMoneda,
      precioActual,
      precioApertura,
      variacion24h: variacionApertura,
      condorScore: null,
      dictamen: 'INSUFFICIENT_DATA',
      status: 'INSUFFICIENT_DATA',
      rsi: null,
      macd: null,
      bollinger: null,
      esVolatilidadExtrema: false,
      mensaje: `Historial preliminar (${precios.length}/14 muestras requeridas). Indicadores cuantitativos en proceso de cálculo.`,
      totalMuestras: registros.length,
      timestamp: registroReciente.timestamp || new Date().toISOString()
    };
  }

  // Caso 3: Historial suficiente (>= 14 períodos) -> Cálculo completo de modelos cuantitativos
  const rsi = calcularRSI(precios, 14);
  const macd = calcularMACD(precios, 12, 26, 9);
  const bollinger = calcularBandasBollinger(precios, 20, 2);

  const { condorScore, dictamen } = calcularCondorScore({
    rsi,
    bollinger,
    macd,
    precioActual,
    variacion24h: variacionApertura
  });

  // Evaluación de Volatilidad Extrema TradFi (|variación| > 2% Y rompe SMA ± 2σ)
  const esVolatilidadExtrema = Math.abs(variacionApertura) >= 2.0 &&
    (precioActual > bollinger.upper || precioActual < bollinger.lower);

  let mensaje = `${ticker}: CondorScore ${condorScore}/100 (${dictamen}). RSI(14): ${rsi}. MACD ${macd.trend} (${macd.histogram > 0 ? '+' : ''}${macd.histogram}).`;
  if (dictamen === 'STRONG_BUY' || dictamen === 'BUY') {
    mensaje += ` Setup de compra detectado en zona de descuento (%B: ${bollinger.percentB}).`;
  } else if (dictamen === 'STRONG_SELL' || dictamen === 'SELL') {
    mensaje += ` Presión vendedora activa en resistencia (%B: ${bollinger.percentB}).`;
  }

  return {
    activo: ticker,
    nombre: meta.nombre,
    mercado: meta.mercado,
    tipoMercado: 'tradfi',
    moneda: registroReciente.moneda || meta.baseMoneda,
    precioActual,
    precioApertura,
    variacion24h: variacionApertura,
    condorScore,
    dictamen,
    status: 'CALCULATED',
    rsi,
    macd,
    bollinger,
    esVolatilidadExtrema,
    mensaje,
    totalMuestras: registros.length,
    timestamp: registroReciente.timestamp || new Date().toISOString()
  };
}

/**
 * Procesa cuantitativamente un activo Cripto.
 * Implementa Graceful Degradation: Nunca descarta un activo del array final.
 */
async function analizarActivoCripto(db, moneda, limite = 100) {
  const meta = ASSETS_METADATA[moneda] || {
    nombre: moneda,
    mercado: 'Cripto ARS',
    tipo: 'cripto',
    baseMoneda: 'ARS'
  };

  const monedasBuscar = moneda === 'MATIC' || moneda === 'POL' ? ['MATIC', 'POL'] : [moneda];

  const { data: registros, error } = await db
    .from('cotizaciones_historicas')
    .select('id, timestamp, moneda, exchange, precio_compra, precio_venta, spread, exchange_compra, exchange_venta')
    .in('moneda', monedasBuscar)
    .order('timestamp', { ascending: false })
    .limit(limite);

  // Caso 1: Sin registros en base de datos (0 muestras)
  if (error || !registros || registros.length === 0) {
    return {
      activo: moneda,
      nombre: meta.nombre,
      mercado: meta.mercado,
      tipoMercado: 'cripto',
      moneda: 'ARS',
      precioActual: null,
      precioApertura: null,
      precioCompra: null,
      precioVenta: null,
      variacion24h: 0,
      spreadActual: 0,
      exchangeCompra: 'Sin exchange',
      exchangeVenta: 'Sin exchange',
      condorScore: null,
      dictamen: 'INSUFFICIENT_DATA',
      status: 'INSUFFICIENT_DATA',
      rsi: null,
      macd: null,
      bollinger: null,
      mensaje: `Historial insuficiente para ${moneda}/ARS (0 muestras en base de datos). Recopilando cotizaciones.`,
      totalMuestras: 0,
      timestamp: new Date().toISOString()
    };
  }

  const cronologicos = [...registros].reverse();

  // Precios medios para la serie técnica
  const preciosMedios = cronologicos.map(r => {
    const ask = Number(r.precio_compra) || 0;
    const bid = Number(r.precio_venta) || 0;
    return ask > 0 && bid > 0 ? (ask + bid) / 2 : (ask || bid || 0);
  }).filter(p => p > 0);

  const registroReciente = registros[0];
  const precioAsk = Number(registroReciente.precio_compra) || 0;
  const precioBid = Number(registroReciente.precio_venta) || 0;
  const precioActual = precioAsk > 0 && precioBid > 0 ? (precioAsk + precioBid) / 2 : (precioAsk || precioBid);

  // Spread actual
  const spreadActual = typeof registroReciente.spread === 'number'
    ? Number(registroReciente.spread.toFixed(4))
    : (precioAsk > 0 ? Number((((precioBid - precioAsk) / precioAsk) * 100).toFixed(4)) : 0);

  const exchangeCompra = registroReciente.exchange_compra || (registroReciente.exchange?.split('->')[0]?.trim()) || 'Ex. Compra';
  const exchangeVenta = registroReciente.exchange_venta || (registroReciente.exchange?.split('->')[1]?.trim()) || 'Ex. Venta';

  // Caso 2: Muestras insuficientes para modelos estadísticos (< 14 períodos)
  if (preciosMedios.length < 14) {
    return {
      activo: moneda,
      nombre: meta.nombre,
      mercado: meta.mercado,
      tipoMercado: 'cripto',
      moneda: 'ARS',
      precioActual,
      precioApertura: precioAsk,
      precioCompra: precioAsk,
      precioVenta: precioBid,
      variacion24h: spreadActual,
      spreadActual,
      exchangeCompra,
      exchangeVenta,
      condorScore: null,
      dictamen: 'INSUFFICIENT_DATA',
      status: 'INSUFFICIENT_DATA',
      rsi: null,
      macd: null,
      bollinger: null,
      mensaje: `Historial preliminar (${preciosMedios.length}/14 muestras requeridas). Modelos cuantitativos en proceso de cálculo.`,
      totalMuestras: registros.length,
      timestamp: registroReciente.timestamp || new Date().toISOString()
    };
  }

  // Caso 3: Historial suficiente (>= 14 períodos) -> Cálculo completo de modelos cuantitativos
  const rsi = calcularRSI(preciosMedios, 14);
  const macd = calcularMACD(preciosMedios, 12, 26, 9);
  const bollinger = calcularBandasBollinger(preciosMedios, 20, 2);

  const { condorScore, dictamen } = calcularCondorScore({
    rsi,
    bollinger,
    macd,
    precioActual,
    variacion24h: spreadActual
  });

  let mensaje = `${moneda}/ARS: CondorScore ${condorScore}/100 (${dictamen}). Spread actual: ${spreadActual > 0 ? '+' : ''}${spreadActual.toFixed(2)}%. Compra: ${exchangeCompra} ($${precioAsk}) -> Venta: ${exchangeVenta} ($${precioBid}).`;

  return {
    activo: moneda,
    nombre: meta.nombre,
    mercado: meta.mercado,
    tipoMercado: 'cripto',
    moneda: 'ARS',
    precioActual,
    precioApertura: precioAsk,
    precioCompra: precioAsk,
    precioVenta: precioBid,
    variacion24h: spreadActual,
    spreadActual,
    exchangeCompra,
    exchangeVenta,
    condorScore,
    dictamen,
    status: 'CALCULATED',
    rsi,
    macd,
    bollinger,
    mensaje,
    totalMuestras: registros.length,
    timestamp: registroReciente.timestamp || new Date().toISOString()
  };
}

/**
 * Handler HTTP Serverless de Vercel.
 */
export default async function handler(req, res) {
  const inicio = performance.now();

  try {
    // 1. Inicialización defensiva de Supabase
    let db = supabaseCliente;
    if (!db) {
      const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const url = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '') : null;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      if (url && key) {
        db = createClient(url, key);
      }
    }

    if (!db) {
      return res.status(500).json({
        status: "error",
        message: "No se pudo inicializar el cliente de Supabase. Verifica las variables de entorno."
      });
    }

    // 2. Parámetros de mercado y activos a analizar
    const query = req.query || {};
    const body = req.body || {};
    const mercadoParam = (query.mercado || body.mercado || '').toLowerCase().trim();

    const listaActivos = extraerListaActivos(req, mercadoParam);
    const limiteMuestras = Math.min(100, Math.max(10, parseInt(query.limite || body.limite || 100, 10)));

    // 3. Procesamiento concurrente masivo de cada activo con Promise.allSettled
    const promesasAnalisis = listaActivos.map(async (activo) => {
      const esTradfi = esActivoTradfi(activo, mercadoParam);
      if (esTradfi) {
        return await analizarActivoTradfi(db, activo, limiteMuestras);
      } else {
        return await analizarActivoCripto(db, activo, limiteMuestras);
      }
    });

    const resultadosSettled = await Promise.allSettled(promesasAnalisis);

    const screenerResults = [];
    const alertasParaGuardar = [];

    resultadosSettled.forEach((item, idx) => {
      const activo = listaActivos[idx];
      if (item.status === 'fulfilled' && item.value) {
        const resultado = item.value;
        screenerResults.push(resultado);

        // Si el veredicto es 'STRONG_BUY' o 'STRONG_SELL' o anomalía, y los cálculos son válidos, preparar alerta
        if (resultado.status === 'CALCULATED' && resultado.bollinger && (resultado.dictamen === 'STRONG_BUY' || resultado.dictamen === 'STRONG_SELL' || resultado.esVolatilidadExtrema)) {
          const tipoAlerta = resultado.esVolatilidadExtrema ? 'VOLATILIDAD_EXTREMA' : resultado.dictamen;
          const safeSpread = Math.min(999.99, Math.max(-999.99, Number(resultado.variacion24h || 0)));
          const safeSMA = Math.min(999.99, Math.max(-999.99, Number(resultado.bollinger.percentB ? (resultado.bollinger.percentB * 100) : 50)));
          const safeStdDev = Math.min(999.99, Math.max(0, Number(resultado.bollinger.bandwidth || resultado.bollinger.stdDev || 0)));

          alertasParaGuardar.push({
            tipo_alerta: tipoAlerta,
            moneda: resultado.activo,
            spread_actual: Number(safeSpread.toFixed(4)),
            spread_sma: Number(safeSMA.toFixed(4)),
            desviacion_estandar: Number(safeStdDev.toFixed(4)),
            exchange_compra: resultado.exchangeCompra || resultado.mercado,
            exchange_venta: resultado.exchangeVenta || resultado.moneda,
            mensaje: `[${resultado.dictamen} CondorScore: ${resultado.condorScore}/100] ${resultado.mensaje}`,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        const errorMsg = item.reason?.message || String(item.reason || 'Error no controlado');
        console.error('Fallo en activo motor quant:', activo, 'Motivo:', errorMsg);
        const meta = ASSETS_METADATA[activo] || { nombre: activo, mercado: 'Multimercado', tipo: 'desconocido', baseMoneda: 'USD' };
        screenerResults.push({
          activo,
          nombre: meta.nombre,
          mercado: meta.mercado,
          tipoMercado: meta.tipo,
          moneda: meta.baseMoneda,
          precioActual: null,
          precioApertura: null,
          variacion24h: 0,
          condorScore: null,
          dictamen: 'INSUFFICIENT_DATA',
          status: 'INSUFFICIENT_DATA',
          rsi: null,
          macd: null,
          bollinger: null,
          esVolatilidadExtrema: false,
          mensaje: `Error en análisis del activo (${errorMsg}). Esperando sincronización.`,
          totalMuestras: 0,
          timestamp: new Date().toISOString()
        });
      }
    });

    // 4. Inserción en lote de alertas institucionales en 'alertas_mercado'
    let alertasPersistidas = 0;
    if (alertasParaGuardar.length > 0) {
      try {
        const { data, error } = await db
          .from('alertas_mercado')
          .insert(alertasParaGuardar)
          .select();

        if (!error) {
          alertasPersistidas = data ? data.length : alertasParaGuardar.length;
        } else {
          console.warn('[Motor Quant] Aviso RLS o inserción en alertas_mercado:', error.message);
        }
      } catch (errDb) {
        console.warn('[Motor Quant] Excepción al persistir alertas:', errDb.message);
      }
    }

    const duracionMs = Math.round(performance.now() - inicio);

    // 5. Ordenamiento institucional: CondorScores válidos arriba en orden descendente, nulls abajo
    screenerResults.sort((a, b) => {
      const scoreA = typeof a.condorScore === 'number' ? a.condorScore : -1;
      const scoreB = typeof b.condorScore === 'number' ? b.condorScore : -1;
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      return a.activo.localeCompare(b.activo);
    });

    // 6. Respuesta HTTP 200 con formato institucional garantizando los 41 activos
    return res.status(200).json({
      status: "success",
      timestamp: new Date().toISOString(),
      duracionMs,
      mercado: mercadoParam || 'multimercado',
      totalAnalizados: screenerResults.length,
      alertasGeneradas: alertasParaGuardar.length,
      alertasPersistidas,
      screener: screenerResults
    });

  } catch (error) {
    console.error('[Motor Quant Serverless] Error fatal:', error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Error interno en el motor cuantitativo"
    });
  }
}
