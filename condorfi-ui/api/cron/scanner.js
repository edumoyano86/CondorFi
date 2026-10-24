/**
 * ==============================================================================
 * CondorFi - Motor Cuantitativo de Escaneo Técnico MTFA & Alertas RSI
 * Archivo: condorfi-ui/api/cron/scanner.js (Vercel Serverless Function & Cron)
 * 
 * Funcionalidad Institucional:
 * 1. Diseñado para ejecutarse en horario bursátil (lunes a viernes 14:00-19:59 UTC)
 *    mediante GitHub Actions o disparador HTTP autenticado.
 * 2. Extrae todas las posiciones activas registradas en 'cartera_activa' (Supabase).
 * 3. Descarga la serie histórica de precios recientes para calcular el RSI (Relative
 *    Strength Index) clásico de Wilder con período de 14 ruedas.
 * 4. Aplica las Reglas Cuantitativas MTFA:
 *    - SEÑAL DE COMPRA (Sobreventa): RSI < 30
 *    - SEÑAL DE VENTA (Sobrecompra): RSI > 70
 * 5. Despacha alertas instantáneas y estructuradas a Telegram:
 *    Ejemplo: 🦅 ALERTA MTFA: VIG.BA | 🟢 SEÑAL DE COMPRA (Sobreventa RSI: 28) | Precio Actual: $X
 * ==============================================================================
 */

import YahooFinance from 'yahoo-finance2';
import { getSupabaseAdminClient, enviarNotificacionTelegram } from '../telegram/send.js';

// Polyfill defensivo para WebSocket en entornos Serverless
if (!globalThis.WebSocket) {
  globalThis.WebSocket = class DummyWebSocket {};
}

// Inicialización de cliente Yahoo Finance con supresión de encuestas
const yahooFinance = typeof YahooFinance === 'function'
  ? new YahooFinance({ suppressNotices: ['yahooSurvey'] })
  : YahooFinance;

/**
 * Calcula el RSI (Relative Strength Index) de 14 períodos utilizando
 * el método de alisado exponencial de J. Welles Wilder.
 * 
 * @param {number[]} precios - Array cronológico de precios de cierre (de más antiguo a más reciente)
 * @param {number} [periodo=14] - Período de cálculo (14 por defecto)
 * @returns {number|null} Valor de RSI entre 0 y 100, o null si la serie es insuficiente
 */
export function calcularRSI(precios, periodo = 14) {
  if (!precios || !Array.isArray(precios) || precios.length <= periodo) {
    return null;
  }

  // Filtrar valores no numéricos
  const validos = precios.filter(p => typeof p === 'number' && !isNaN(p) && p > 0);
  if (validos.length <= periodo) {
    return null;
  }

  // 1. Calcular las diferencias entre cierres consecutivos
  const deltas = [];
  for (let i = 1; i < validos.length; i++) {
    deltas.push(validos[i] - validos[i - 1]);
  }

  if (deltas.length < periodo) {
    return null;
  }

  // 2. Primera media simple de ganancias y pérdidas sobre las primeras 'periodo' ruedas
  let gainSum = 0;
  let lossSum = 0;

  for (let i = 0; i < periodo; i++) {
    if (deltas[i] > 0) {
      gainSum += deltas[i];
    } else {
      lossSum += Math.abs(deltas[i]);
    }
  }

  let avgGain = gainSum / periodo;
  let avgLoss = lossSum / periodo;

  // 3. Alisado exponencial de Wilder para el resto de la serie histórica
  for (let i = periodo; i < deltas.length; i++) {
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
 * Obtiene la serie histórica de precios recientes y la cotización actual para un activo.
 * Soporta activos TradFi (BYMA, CEDEARs, Wall Street) y Cripto (Binance / Yahoo).
 * 
 * @param {string} ticker Símbolo del activo (ej. 'VIG.BA', 'AAPL', 'BTC', 'ETH')
 * @returns {Promise<{ ok: boolean, ticker: string, precios: number[], precioActual: number, moneda: string }>}
 */
async function obtenerHistoricoPrecios(ticker) {
  const t = ticker.toUpperCase().trim();
  const esArs = t === '^MERV' || t.endsWith('.BA');

  // 1. Manejo especializado para Criptomonedas (Binance API 1d klines)
  const criptosPrincipales = ['BTC', 'ETH', 'SOL', 'USDT', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOGE', 'LINK'];
  const esCriptoPura = criptosPrincipales.includes(t) || t.endsWith('USDT') || t.endsWith('USD');

  if (esCriptoPura && !t.includes('.')) {
    try {
      const symbolBinance = t.endsWith('USDT') ? t : `${t}USDT`;
      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbolBinance}&interval=1d&limit=45`, {
        headers: { 'Accept': 'application/json' }
      });

      if (res.ok) {
        const klines = await res.json();
        if (Array.isArray(klines) && klines.length >= 15) {
          const precios = klines.map(k => parseFloat(k[4])).filter(p => !isNaN(p) && p > 0);
          const precioActual = precios[precios.length - 1];

          return {
            ok: true,
            ticker: t,
            precios,
            precioActual,
            moneda: 'USD'
          };
        }
      }
    } catch {
      // Si Binance falla, continuamos con el fallback de Yahoo Finance
    }
  }

  // 2. Consulta TradFi / Acciones / ETFs / CEDEARs / Bonos vía Yahoo Finance
  let yahooSymbol = t;
  if (criptosPrincipales.includes(t)) {
    yahooSymbol = `${t}-USD`;
  }

  try {
    const startDate = new Date();
    // 55 días atrás para asegurar al menos ~35-40 ruedas de negociación activas
    startDate.setDate(startDate.getDate() - 55);

    const chartRes = await yahooFinance.chart(yahooSymbol, {
      period1: startDate.toISOString().split('T')[0],
      interval: '1d'
    });

    const quotes = chartRes?.quotes || [];
    const precios = quotes
      .map(q => q.close)
      .filter(p => typeof p === 'number' && !isNaN(p) && p > 0);

    const moneda = (chartRes?.meta?.currency === 'ARS' || esArs) ? 'ARS' : 'USD';
    const regularPrice = chartRes?.meta?.regularMarketPrice;
    const precioActual = (typeof regularPrice === 'number' && regularPrice > 0)
      ? regularPrice
      : (precios.length > 0 ? precios[precios.length - 1] : 0);

    if (precios.length >= 15 && precioActual > 0) {
      return {
        ok: true,
        ticker: t,
        precios,
        precioActual,
        moneda
      };
    }
  } catch (err) {
    console.warn(`[Cron Scanner] Fallo al descargar velas históricas para ${t}:`, err.message);
  }

  return {
    ok: false,
    ticker: t,
    precios: [],
    precioActual: 0,
    moneda: esArs ? 'ARS' : 'USD'
  };
}

/**
 * Valida la autorización de ejecución del cron.
 */
function verificarAutorizacionCron(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return true; // Si no hay secreto configurado, se permite ejecución interna
  }

  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const xCronSecret = req.headers['x-cron-secret'] || '';
  const querySecret = req.query?.secret || '';

  return (
    authHeader === `Bearer ${cronSecret}` ||
    xCronSecret === cronSecret ||
    querySecret === cronSecret
  );
}

/**
 * Handler HTTP Principal del Cron Scanner MTFA
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!verificarAutorizacionCron(req)) {
    return res.status(401).json({
      ok: false,
      error: 'Petición no autorizada para el escáner cuantitativo MTFA.'
    });
  }

  const inicio = performance.now();
  console.log('[Cron Scanner] Iniciando escaneo técnico MTFA con RSI(14)...');

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return res.status(500).json({
      ok: false,
      error: 'Supabase Admin Client no inicializado. Verifica las variables de entorno.'
    });
  }

  try {
    // 1. Extraer todas las posiciones activas de cartera de los operadores
    const { data: posiciones, error: dbError } = await supabase
      .from('cartera_activa')
      .select('id, user_id, ticker, cantidad, precio_compra_promedio, moneda');

    if (dbError) {
      console.warn('[Cron Scanner] Aviso al consultar cartera_activa:', dbError.message);
      if (dbError.code === 'PGRST205' || dbError.message?.includes('schema cache')) {
        return res.status(200).json({
          ok: true,
          aviso: "Tabla 'cartera_activa' no encontrada en Supabase. Ejecuta schema.sql en tu consola de Supabase.",
          posiciones_escaneadas: 0,
          alertas_disparadas: 0,
          duracion_ms: Math.round(performance.now() - inicio)
        });
      }
      return res.status(500).json({ ok: false, error: dbError.message });
    }

    if (!posiciones || posiciones.length === 0) {
      return res.status(200).json({
        ok: true,
        mensaje: 'No hay posiciones activas registradas en cartera_activa para analizar.',
        posiciones_escaneadas: 0,
        alertas_disparadas: 0,
        duracion_ms: Math.round(performance.now() - inicio)
      });
    }

    console.log(`[Cron Scanner] Analizando ${posiciones.length} posiciones en cartera...`);

    // 2. Extraer tickers únicos y descargar series históricas concurrentemente en lotes
    const tickersUnicos = [...new Set(posiciones.map(p => p.ticker.toUpperCase().trim()))];
    const mapaDatosTecnicos = new Map();

    const tamanoLote = 8;
    for (let i = 0; i < tickersUnicos.length; i += tamanoLote) {
      const lote = tickersUnicos.slice(i, i + tamanoLote);
      const resultados = await Promise.allSettled(
        lote.map(t => obtenerHistoricoPrecios(t))
      );

      resultados.forEach((resLote) => {
        if (resLote.status === 'fulfilled' && resLote.value.ok) {
          const item = resLote.value;
          const rsi = calcularRSI(item.precios, 14);
          mapaDatosTecnicos.set(item.ticker, {
            ...item,
            rsi
          });
        }
      });
    }

    // 3. Evaluar Reglas de Disparo MTFA (RSI < 30 y RSI > 70)
    const alertasADespachar = [];

    for (const pos of posiciones) {
      const ticker = pos.ticker.toUpperCase().trim();
      const datosTecnicos = mapaDatosTecnicos.get(ticker);

      if (!datosTecnicos || datosTecnicos.rsi === null || datosTecnicos.rsi === undefined) {
        continue;
      }

      const rsi = datosTecnicos.rsi;
      const precioActual = datosTecnicos.precioActual;
      const moneda = datosTecnicos.moneda || pos.moneda || 'USD';
      const monedaSimbolo = moneda === 'ARS' ? '$' : 'US$';
      const precioStr = precioActual.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

      let tipoAlerta = null;
      let textoAlertaResumido = '';
      let mensajeMarkdownCompleto = '';

      // Regla MTFA 1: Sobreventa Extrema (RSI < 30) -> Señal de Compra
      if (rsi < 30.0) {
        tipoAlerta = 'COMPRA_SOBREVENTA';
        textoAlertaResumido = `🦅 ALERTA MTFA: ${ticker} | 🟢 SEÑAL DE COMPRA (Sobreventa RSI: ${rsi}) | Precio Actual: ${monedaSimbolo} ${precioStr}`;

        mensajeMarkdownCompleto = 
`🦅 *ALERTA MTFA: ${ticker}*
────────────────────────
🟢 *SEÑAL DE COMPRA (Sobreventa RSI: ${rsi})*
💵 *Precio Actual:* ${monedaSimbolo} ${precioStr}

📊 *Análisis Técnico Cuantitativo:*
• *Indicador:* RSI (14 períodos de Wilder)
• *Lectura:* \`${rsi}\` (Zona de Sobreventa extrema < 30)
• *Posición en Cartera:* \`${pos.cantidad}\` nominales
• *Precio Base de Compra:* ${monedaSimbolo} ${Number(pos.precio_compra_promedio || 0).toLocaleString('es-AR')}

💡 _Interpretación Cuantitativa: Agotamiento vendedor detectado en temporalidad diaria. Evaluar compras tácticas o rebalanceo alcista._

────────────────────────
⚙️ _CondorFi Quantitative Trading Terminal_`;
      }
      // Regla MTFA 2: Sobrecompra Extrema (RSI > 70) -> Señal de Venta
      else if (rsi > 70.0) {
        tipoAlerta = 'VENTA_SOBRECOMPRA';
        textoAlertaResumido = `🦅 ALERTA MTFA: ${ticker} | 🔴 SEÑAL DE VENTA (Sobrecompra RSI: ${rsi}) | Precio Actual: ${monedaSimbolo} ${precioStr}`;

        mensajeMarkdownCompleto = 
`🦅 *ALERTA MTFA: ${ticker}*
────────────────────────
🔴 *SEÑAL DE VENTA (Sobrecompra RSI: ${rsi})*
💵 *Precio Actual:* ${monedaSimbolo} ${precioStr}

📊 *Análisis Técnico Cuantitativo:*
• *Indicador:* RSI (14 períodos de Wilder)
• *Lectura:* \`${rsi}\` (Zona de Sobrecompra extrema > 70)
• *Posición en Cartera:* \`${pos.cantidad}\` nominales
• *Precio Base de Compra:* ${monedaSimbolo} ${Number(pos.precio_compra_promedio || 0).toLocaleString('es-AR')}

💡 _Interpretación Cuantitativa: Euforia compradora en niveles extremos. Evaluar toma parcial de ganancias o ajuste de trailing stop._

────────────────────────
⚙️ _CondorFi Quantitative Trading Terminal_`;
      }

      if (tipoAlerta) {
        alertasADespachar.push({
          userId: pos.user_id,
          posicionId: pos.id,
          ticker,
          rsi,
          precioActual,
          moneda,
          tipoAlerta,
          textoResumido: textoAlertaResumido,
          mensajeMarkdown: mensajeMarkdownCompleto
        });
      }
    }

    // 4. Despachar notificaciones a través de la API oficial de Telegram
    let despachosExitosos = 0;
    let despachosOmitidos = 0;

    for (const alerta of alertasADespachar) {
      const resultadoEnvio = await enviarNotificacionTelegram({
        user_id: alerta.userId,
        texto: alerta.mensajeMarkdown,
        parseMode: 'Markdown'
      });

      if (resultadoEnvio.ok) {
        despachosExitosos++;
        console.log(`[Cron Scanner] Alerta enviada con éxito para ${alerta.ticker} a usuario ${alerta.userId}`);
      } else {
        despachosOmitidos++;
        console.warn(`[Cron Scanner] No se envió alerta para ${alerta.ticker}:`, resultadoEnvio.error);
      }
    }

    const duracionMs = Math.round(performance.now() - inicio);

    return res.status(200).json({
      ok: true,
      mensaje: 'Escaneo técnico MTFA completado con éxito.',
      timestamp: new Date().toISOString(),
      posiciones_analizadas: posiciones.length,
      activos_con_rsi: mapaDatosTecnicos.size,
      alertas_detectadas: alertasADespachar.length,
      despachos_telegram: {
        exitosos: despachosExitosos,
        omitidos_o_sin_telegram: despachosOmitidos
      },
      alertas: alertasADespachar.map(a => ({
        ticker: a.ticker,
        rsi: a.rsi,
        precio_actual: a.precioActual,
        moneda: a.moneda,
        tipo: a.tipoAlerta,
        resumen: a.textoResumido
      })),
      duracion_ms: duracionMs
    });
  } catch (err) {
    console.error('[Cron Scanner] Error general en el escaneo técnico:', err);
    return res.status(500).json({
      ok: false,
      error: 'Error crítico en el motor de escaneo MTFA.',
      details: err.message
    });
  }
}
