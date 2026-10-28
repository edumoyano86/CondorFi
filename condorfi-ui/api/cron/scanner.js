/**
 * ==============================================================================
 * CondorFi - Motor Cuantitativo de Escaneo Técnico MTFA & Alertas RSI
 * Archivo: condorfi-ui/api/cron/scanner.js (Vercel Serverless Function & Cron)
 * 
 * Funcionalidad Institucional Avanzada:
 * 1. Diseñado para ejecutarse en horario bursátil (lunes a viernes 14:00-19:59 UTC)
 *    mediante GitHub Actions o disparador HTTP autenticado.
 * 2. Extrae todas las posiciones activas registradas en 'cartera_activa' (Supabase).
 * 3. Descarga en paralelo la serie histórica en dos temporalidades:
 *    - Macro Diario (1D): para evaluar la estructura mayor y zonas de soporte/resistencia.
 *    - Micro Horario (1H): para evaluar el gatillo de momentum intradiario.
 * 4. Calcula el RSI clásico de Wilder (14 períodos) en ambas temporalidades.
 * 5. Aplica Confluencia Multi-Timeframe (MTFA):
 *    - 🟢 SEÑAL DE COMPRA MTFA: RSI 1H < 30 con RSI 1D <= 48 (o RSI 1D < 30).
 *    - 🔴 SEÑAL DE VENTA MTFA: RSI 1H > 70 con RSI 1D >= 55 (o RSI 1D > 70).
 * 6. Despacha alertas instantáneas y estructuradas a Telegram.
 * 7. Persiste automáticamente cada alerta en 'alertas_historial' para alimentar
 *    el Centro de Notificaciones en la interfaz web de CondorFi.
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
 * Obtiene la serie histórica en dos temporalidades (1D y 1H) para análisis MTFA.
 * Soporta activos TradFi (BYMA, CEDEARs, Wall Street) y Cripto (Binance / Yahoo).
 * 
 * @param {string} ticker Símbolo del activo (ej. 'VIG.BA', 'AAPL', 'BTC', 'ETH')
 * @returns {Promise<{ ok: boolean, ticker: string, precios1d: number[], precios1h: number[], precioActual: number, moneda: string }>}
 */
async function obtenerHistoricoPreciosMTFA(ticker) {
  const t = ticker.toUpperCase().trim();
  const esArs = t === '^MERV' || t.endsWith('.BA');

  // 1. Manejo especializado para Criptomonedas (Binance API 1d y 1h klines)
  const criptosPrincipales = ['BTC', 'ETH', 'SOL', 'USDT', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOGE', 'LINK'];
  const esCriptoPura = criptosPrincipales.includes(t) || t.endsWith('USDT') || t.endsWith('USD');

  if (esCriptoPura && !t.includes('.')) {
    try {
      const symbolBinance = t.endsWith('USDT') ? t : `${t}USDT`;
      const [res1d, res1h] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/klines?symbol=${symbolBinance}&interval=1d&limit=45`, {
          headers: { 'Accept': 'application/json' }
        }),
        fetch(`https://api.binance.com/api/v3/klines?symbol=${symbolBinance}&interval=1h&limit=50`, {
          headers: { 'Accept': 'application/json' }
        })
      ]);

      if (res1d.ok) {
        const klines1d = await res1d.json();
        const klines1h = res1h.ok ? await res1h.json() : [];

        if (Array.isArray(klines1d) && klines1d.length >= 15) {
          const precios1d = klines1d.map(k => parseFloat(k[4])).filter(p => !isNaN(p) && p > 0);
          const precios1h = Array.isArray(klines1h)
            ? klines1h.map(k => parseFloat(k[4])).filter(p => !isNaN(p) && p > 0)
            : precios1d;
          const precioActual = precios1d[precios1d.length - 1];

          return {
            ok: true,
            ticker: t,
            precios1d,
            precios1h,
            precioActual,
            moneda: 'USD'
          };
        }
      }
    } catch {
      // Si Binance falla, continuamos con el fallback de Yahoo Finance
    }
  }

  // 2. Consulta TradFi / Acciones / ETFs / CEDEARs / Bonos vía Yahoo Finance (Dual 1D + 1H)
  let yahooSymbol = t;
  if (criptosPrincipales.includes(t)) {
    yahooSymbol = `${t}-USD`;
  }

  try {
    const startDate1d = new Date();
    startDate1d.setDate(startDate1d.getDate() - 55);

    const startDate1h = new Date();
    startDate1h.setDate(startDate1h.getDate() - 12);

    const [chartRes1d, chartRes1h] = await Promise.all([
      yahooFinance.chart(yahooSymbol, {
        period1: startDate1d.toISOString().split('T')[0],
        interval: '1d'
      }).catch(() => null),
      yahooFinance.chart(yahooSymbol, {
        period1: startDate1h.toISOString().split('T')[0],
        interval: '1h'
      }).catch(() => null)
    ]);

    const quotes1d = chartRes1d?.quotes || [];
    const precios1d = quotes1d
      .map(q => q.close)
      .filter(p => typeof p === 'number' && !isNaN(p) && p > 0);

    const quotes1h = chartRes1h?.quotes || [];
    const precios1h = quotes1h
      .map(q => q.close)
      .filter(p => typeof p === 'number' && !isNaN(p) && p > 0);

    const moneda = (chartRes1d?.meta?.currency === 'ARS' || esArs) ? 'ARS' : 'USD';
    const regularPrice = chartRes1d?.meta?.regularMarketPrice;
    const precioActual = (typeof regularPrice === 'number' && regularPrice > 0)
      ? regularPrice
      : (precios1d.length > 0 ? precios1d[precios1d.length - 1] : 0);

    if (precios1d.length >= 15 && precioActual > 0) {
      return {
        ok: true,
        ticker: t,
        precios1d,
        precios1h: precios1h.length >= 15 ? precios1h : precios1d,
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
    precios1d: [],
    precios1h: [],
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
  console.log('[Cron Scanner] Iniciando escaneo técnico MTFA con RSI(14) Dual (1D + 1H)...');

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

    const tamanoLote = 6;
    for (let i = 0; i < tickersUnicos.length; i += tamanoLote) {
      const lote = tickersUnicos.slice(i, i + tamanoLote);
      const resultados = await Promise.allSettled(
        lote.map(t => obtenerHistoricoPreciosMTFA(t))
      );

      resultados.forEach((resLote) => {
        if (resLote.status === 'fulfilled' && resLote.value.ok) {
          const item = resLote.value;
          const rsi1d = calcularRSI(item.precios1d, 14);
          const rsi1h = calcularRSI(item.precios1h, 14) || rsi1d;

          mapaDatosTecnicos.set(item.ticker, {
            ...item,
            rsi1d,
            rsi1h
          });
        }
      });
    }

    // 3. Evaluar Reglas de Disparo Cuantitativas MTFA (1D + 1H)
    const alertasADespachar = [];

    for (const pos of posiciones) {
      const ticker = pos.ticker.toUpperCase().trim();
      const datosTecnicos = mapaDatosTecnicos.get(ticker);

      if (!datosTecnicos || datosTecnicos.rsi1d === null) {
        continue;
      }

      const rsi1d = datosTecnicos.rsi1d;
      const rsi1h = datosTecnicos.rsi1h ?? rsi1d;
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

      // Regla MTFA 1: Señal de Compra por Sobreventa y Confluencia
      // Condición A: Micro horario en sobreventa extrema (< 30) con Macro diario en zona de descuento/soporte (<= 48)
      // Condición B: Macro diario en sobreventa extrema (< 30)
      const esSobreventaMicro = rsi1h < 30.0 && rsi1d <= 48.0;
      const esSobreventaMacro = rsi1d < 30.0;

      if (esSobreventaMicro || esSobreventaMacro) {
        tipoAlerta = 'COMPRA_SOBREVENTA';
        const justificacion = esSobreventaMacro
          ? `Sobreventa Estructural Diaria (RSI 1D: ${rsi1d})`
          : `Gatillo Micro Horario en Sobreventa (RSI 1H: ${rsi1h}) con Soporte Diario (RSI 1D: ${rsi1d})`;

        textoAlertaResumido = `🦅 ALERTA MTFA: ${ticker} | 🟢 SEÑAL DE COMPRA (RSI 1D: ${rsi1d} • 1H: ${rsi1h}) | Precio: ${monedaSimbolo} ${precioStr}`;

        mensajeMarkdownCompleto = 
`🦅 *ALERTA MTFA: ${ticker}*
────────────────────────
🟢 *SEÑAL DE COMPRA (Confluencia MTFA)*
💵 *Precio Actual:* ${monedaSimbolo} ${precioStr}

📊 *Análisis Multi-Temporal (MTFA 1D + 1H):*
• *RSI Diario (1D):* \`${rsi1d}\` (${rsi1d < 30 ? 'Sobreventa Mayor' : 'Soporte / Descuento'})
• *RSI Horario (1H):* \`${rsi1h}\` (${rsi1h < 30 ? 'Gatillo Sobreventa < 30' : 'Momentum neutral'})
• *Confluencia:* _${justificacion}_
• *Posición en Cartera:* \`${pos.cantidad}\` nominales
• *Precio Base de Compra:* ${monedaSimbolo} ${Number(pos.precio_compra_promedio || 0).toLocaleString('es-AR')}

💡 _Interpretación Cuantitativa: Agotamiento vendedor confirmado en múltiples temporalidades. Oportunidad de entrada táctica o acumulación con stop ceñido._

────────────────────────
⚙️ _CondorFi Quantitative Trading Terminal_`;
      }
      // Regla MTFA 2: Señal de Venta por Sobrecompra y Confluencia
      // Condición A: Micro horario en sobrecompra extrema (> 70) con Macro diario extendido (>= 55)
      // Condición B: Macro diario en sobrecompra extrema (> 70)
      else {
        const esSobrecompraMicro = rsi1h > 70.0 && rsi1d >= 55.0;
        const esSobrecompraMacro = rsi1d > 70.0;

        if (esSobrecompraMicro || esSobrecompraMacro) {
          tipoAlerta = 'VENTA_SOBRECOMPRA';
          const justificacion = esSobrecompraMacro
            ? `Sobrecompra Estructural Diaria (RSI 1D: ${rsi1d})`
            : `Gatillo Micro Horario en Sobrecompra (RSI 1H: ${rsi1h}) con Macro Extendido (RSI 1D: ${rsi1d})`;

          textoAlertaResumido = `🦅 ALERTA MTFA: ${ticker} | 🔴 SEÑAL DE VENTA (RSI 1D: ${rsi1d} • 1H: ${rsi1h}) | Precio: ${monedaSimbolo} ${precioStr}`;

          mensajeMarkdownCompleto = 
`🦅 *ALERTA MTFA: ${ticker}*
────────────────────────
🔴 *SEÑAL DE VENTA (Confluencia MTFA)*
💵 *Precio Actual:* ${monedaSimbolo} ${precioStr}

📊 *Análisis Multi-Temporal (MTFA 1D + 1H):*
• *RSI Diario (1D):* \`${rsi1d}\` (${rsi1d > 70 ? 'Sobrecompra Mayor' : 'Tendencia Extendida'})
• *RSI Horario (1H):* \`${rsi1h}\` (${rsi1h > 70 ? 'Gatillo Sobrecompra > 70' : 'Momentum neutral'})
• *Confluencia:* _${justificacion}_
• *Posición en Cartera:* \`${pos.cantidad}\` nominales
• *Precio Base de Compra:* ${monedaSimbolo} ${Number(pos.precio_compra_promedio || 0).toLocaleString('es-AR')}

💡 _Interpretación Cuantitativa: Euforia compradora en zonas extremas. Evaluar toma parcial de ganancias o elevación de trailing stop._

────────────────────────
⚙️ _CondorFi Quantitative Trading Terminal_`;
        }
      }

      if (tipoAlerta) {
        alertasADespachar.push({
          userId: pos.user_id,
          posicionId: pos.id,
          ticker,
          rsi1d,
          rsi1h,
          precioActual,
          moneda,
          tipoAlerta,
          textoResumido: textoAlertaResumido,
          mensajeMarkdown: mensajeMarkdownCompleto
        });
      }
    }

    // 4. Despachar notificaciones a Telegram y persistir en Supabase 'alertas_historial'
    let despachosExitosos = 0;
    let despachosOmitidos = 0;
    let registrosPersistidos = 0;

    for (const alerta of alertasADespachar) {
      // A. Envío vía Telegram Bot
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

      // B. Persistencia auditable en Supabase 'alertas_historial'
      if (supabase) {
        try {
          const { error: errInsertAlert } = await supabase
            .from('alertas_historial')
            .insert({
              user_id: alerta.userId,
              ticker: alerta.ticker,
              tipo_alerta: alerta.tipoAlerta,
              rsi_1d: alerta.rsi1d,
              rsi_1h: alerta.rsi1h,
              precio_actual: alerta.precioActual,
              moneda: alerta.moneda,
              mensaje: alerta.textoResumido,
              leida: false,
              timestamp: new Date().toISOString()
            });

          if (!errInsertAlert) {
            registrosPersistidos++;
          } else {
            console.warn('[Cron Scanner] Aviso al registrar en alertas_historial:', errInsertAlert.message);
          }
        } catch (eDb) {
          console.warn('[Cron Scanner] Excepción al registrar alerta:', eDb.message);
        }
      }
    }

    const duracionMs = Math.round(performance.now() - inicio);

    return res.status(200).json({
      ok: true,
      mensaje: 'Escaneo técnico MTFA (1D + 1H) completado con éxito.',
      timestamp: new Date().toISOString(),
      posiciones_analizadas: posiciones.length,
      activos_con_rsi: mapaDatosTecnicos.size,
      alertas_detectadas: alertasADespachar.length,
      despachos_telegram: {
        exitosos: despachosExitosos,
        omitidos_o_sin_telegram: despachosOmitidos
      },
      alertas_persistidas_db: registrosPersistidos,
      alertas: alertasADespachar.map(a => ({
        ticker: a.ticker,
        rsi_1d: a.rsi1d,
        rsi_1h: a.rsi1h,
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
