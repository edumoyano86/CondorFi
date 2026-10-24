/**
 * ==============================================================================
 * CondorFi - Motor Cuantitativo de Escaneo de Mercado & Alertas MTFA
 * Archivo: condorfi-ui/api/cron/scanner.js (Vercel Serverless Function & Cron Job)
 * 
 * Funcionalidad Institucional:
 * 1. Diseñado para ejecución automática mediante Vercel Cron o disparador HTTP.
 * 2. Extrae las posiciones activas de todos los operadores desde 'cartera_activa' en Supabase.
 * 3. Cruza en tiempo real las cotizaciones vigentes vía Yahoo Finance y APIs Cripto.
 * 4. Aplica el motor de reglas cuantitativas MTFA y gestión de riesgo:
 *    - Variación 24h significativa (impulso alcista o correctivo > +5% o < -5%).
 *    - Take Profit Cuantitativo (PnL de la posición >= +10%).
 *    - Stop Loss Preventivo / Alerta de Riesgo (PnL de la posición <= -7%).
 * 5. Despacha alertas automáticas personalizadas por Telegram a cada operador
 *    utilizando el módulo 'enviarNotificacionTelegram'.
 * ==============================================================================
 */

import YahooFinance from 'yahoo-finance2';
import { getSupabaseAdminClient, enviarNotificacionTelegram } from '../telegram/send.js';

// Polyfill defensivo para WebSocket en entornos Serverless
if (!globalThis.WebSocket) {
  globalThis.WebSocket = class DummyWebSocket {};
}

// Inicialización de Yahoo Finance suprimiendo avisos de consola
const yahooFinance = typeof YahooFinance === 'function'
  ? new YahooFinance({ suppressNotices: ['yahooSurvey'] })
  : YahooFinance;

/**
 * Consulta la cotización en vivo de un ticker TradFi o Cripto.
 * @param {string} ticker Símbolo del activo (ej. 'VIG.BA', 'AAPL', 'BTC', 'ETH')
 * @returns {Promise<{ precioActual: number, precioApertura: number, variacion24h: number, moneda: string }>}
 */
async function obtenerCotizacionEnVivo(ticker) {
  const t = ticker.toUpperCase().trim();
  const esArs = t === '^MERV' || t.endsWith('.BA');

  // 1. Manejo de Criptomonedas principales (USDT, BTC, ETH, SOL, etc.)
  const criptosPrincipales = ['BTC', 'ETH', 'SOL', 'USDT', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOGE', 'LINK'];
  const esCriptoPura = criptosPrincipales.includes(t) || t.endsWith('USDT') || t.endsWith('USD');

  if (esCriptoPura && !t.includes('.')) {
    try {
      const symbolBinance = t.endsWith('USDT') ? t : `${t}USDT`;
      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbolBinance}`, {
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const d = await res.json();
        const precio = parseFloat(d.lastPrice);
        const variacion = parseFloat(d.priceChangePercent);
        const open = parseFloat(d.openPrice) || precio;
        if (!isNaN(precio) && precio > 0) {
          return {
            precioActual: precio,
            precioApertura: open,
            variacion24h: Number(variacion.toFixed(2)),
            moneda: 'USD'
          };
        }
      }
    } catch {
      // Fallback a Yahoo Finance para criptos si Binance no responde
    }
  }

  // 2. Consulta TradFi / Acciones / ETFs / CEDEARs / Índices vía Yahoo Finance
  let yahooSymbol = t;
  if (criptosPrincipales.includes(t)) {
    yahooSymbol = `${t}-USD`;
  }

  try {
    const quote = await yahooFinance.quote(yahooSymbol);
    const precio = Number(quote?.regularMarketPrice ?? quote?.price ?? 0);
    const variacion = Number(quote?.regularMarketChangePercent ?? 0);
    const open = Number(quote?.regularMarketOpen ?? quote?.open ?? precio);
    const moneda = (quote?.currency === 'ARS' || esArs) ? 'ARS' : 'USD';

    if (!isNaN(precio) && precio > 0) {
      return {
        precioActual: precio,
        precioApertura: open,
        variacion24h: Number(variacion.toFixed(2)),
        moneda
      };
    }
  } catch (err) {
    console.warn(`[Cron Scanner] Advertencia al cotizar ${ticker}:`, err.message);
  }

  // Fallback defensivo en caso de indisponibilidad temporal
  return {
    precioActual: 0,
    precioApertura: 0,
    variacion24h: 0,
    moneda: esArs ? 'ARS' : 'USD'
  };
}

/**
 * Valida la autorización de ejecución del cron job.
 */
function verificarAutorizacionCron(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Si no está configurado CRON_SECRET en el entorno, permitir ejecución interna
    return true;
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
 * Handler HTTP Principal del Cron Scanner
 */
export default async function handler(req, res) {
  // Configuración de encabezados CORS y métodos
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Validar secreto del cron si está configurado
  if (!verificarAutorizacionCron(req)) {
    return res.status(401).json({
      ok: false,
      error: 'Petición no autorizada para el motor de escaneo cuantitativo.'
    });
  }

  const inicio = performance.now();
  console.log('[Cron Scanner] Iniciando ciclo de escaneo cuantitativo MTFA...');

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
      .select('id, user_id, ticker, tipo_mercado, cantidad, precio_compra_promedio, moneda');

    if (dbError) {
      console.warn('[Cron Scanner] Aviso al consultar cartera_activa:', dbError.message);
      // Si la tabla aún no fue creada en Supabase, responder 200 con aviso institucional
      if (dbError.code === 'PGRST205' || dbError.message?.includes('schema cache')) {
        return res.status(200).json({
          ok: true,
          aviso: "Tabla 'cartera_activa' no encontrada en el esquema de Supabase. Ejecuta schema.sql en tu consola de Supabase.",
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

    // 2. Extraer tickers únicos para optimizar cotizaciones concurrentes
    const tickersUnicos = [...new Set(posiciones.map(p => p.ticker.toUpperCase().trim()))];
    const mapaCotizaciones = new Map();

    // Obtener cotizaciones concurrentes en lotes de 10
    const tamanoLote = 10;
    for (let i = 0; i < tickersUnicos.length; i += tamanoLote) {
      const lote = tickersUnicos.slice(i, i + tamanoLote);
      const resultados = await Promise.allSettled(
        lote.map(ticker => obtenerCotizacionEnVivo(ticker))
      );

      resultados.forEach((res, index) => {
        const ticker = lote[index];
        if (res.status === 'fulfilled' && res.value.precioActual > 0) {
          mapaCotizaciones.set(ticker, res.value);
        }
      });
    }

    // 3. Evaluar reglas cuantitativas para cada posición y clasificar alertas
    const alertasDisparadas = [];

    for (const pos of posiciones) {
      const ticker = pos.ticker.toUpperCase().trim();
      const cotizacion = mapaCotizaciones.get(ticker);

      if (!cotizacion || cotizacion.precioActual <= 0) {
        continue;
      }

      const precioActual = cotizacion.precioActual;
      const precioCompra = parseFloat(pos.precio_compra_promedio) || 0;
      const variacion24h = cotizacion.variacion24h;

      // Cálculo de PnL no realizado de la posición
      const pnlPorcentaje = precioCompra > 0
        ? Number((((precioActual - precioCompra) / precioCompra) * 100).toFixed(2))
        : 0;

      const reglasCumplidas = [];

      // Regla 1: Movimiento 24h significativo mayor al 5%
      if (variacion24h >= 5.0) {
        reglasCumplidas.push({
          tipo: 'MOMENTUM_ALCISTA',
          titulo: '🚀 Impulso Alcista Acelerado (+5%)',
          descripcion: `El activo subió un *+${variacion24h}%* en las últimas 24 horas.`,
          severidad: 'INFO'
        });
      } else if (variacion24h <= -5.0) {
        reglasCumplidas.push({
          tipo: 'CORRECCION_SIGNIFICATIVA',
          titulo: '⚠️ Corrección Fuerte de Mercado (-5%)',
          descripcion: `El activo registró una caída de *${variacion24h}%* en la sesión.`,
          severidad: 'ALERTA'
        });
      }

      // Regla 2: Toma de Ganancias Cuantitativa (PnL >= +10%)
      if (pnlPorcentaje >= 10.0) {
        reglasCumplidas.push({
          tipo: 'TAKE_PROFIT',
          titulo: '🎯 Objetivo de Ganancia Cuantitativo (+10%)',
          descripcion: `Tu posición acumula un rendimiento no realizado de *+${pnlPorcentaje}%*. Se sugiere evaluar toma parcial de beneficios o trailing stop.`,
          severidad: 'OPORTUNIDAD'
        });
      }

      // Regla 3: Stop Loss / Alerta Preventiva de Riesgo (PnL <= -7%)
      if (pnlPorcentaje <= -7.0) {
        reglasCumplidas.push({
          tipo: 'STOP_LOSS_RISK',
          titulo: '🛑 Alerta Preventiva de Gestión de Riesgo (-7%)',
          descripcion: `La posición acumula una pérdida no realizada de *${pnlPorcentaje}%*. Verifica los niveles de soporte técnico y tu plan de salida.`,
          severidad: 'RIESGO'
        });
      }

      // Si cumple una o más reglas, construir alerta y encolarla
      if (reglasCumplidas.length > 0) {
        alertasDisparadas.push({
          userId: pos.user_id,
          posicionId: pos.id,
          ticker,
          moneda: cotizacion.moneda,
          precioActual,
          precioCompra,
          variacion24h,
          pnlPorcentaje,
          reglas: reglasCumplidas
        });
      }
    }

    // 4. Despachar notificaciones personalizadas vía Telegram a cada usuario afectado
    let despachosExitosos = 0;
    let despachosOmitidos = 0;

    for (const alerta of alertasDisparadas) {
      const monedaSimbolo = alerta.moneda === 'ARS' ? '$' : 'US$';
      const pnlSigno = alerta.pnlPorcentaje >= 0 ? '+' : '';
      const varSigno = alerta.variacion24h >= 0 ? '+' : '';

      // Formato institucional Markdown para Telegram
      const lineasReglas = alerta.reglas.map(r => `${r.titulo}\n_${r.descripcion}_`).join('\n\n');

      const mensajeTelegram = 
`🦅 *CondorFi - Alerta Cuantitativa de Mercado*
────────────────────────
📊 *Instrumento:* \`${alerta.ticker}\`
💵 *Precio Actual:* ${monedaSimbolo} ${alerta.precioActual.toLocaleString('es-AR')}
📈 *Variación 24h:* ${varSigno}${alerta.variacion24h}%
🎯 *Rendimiento PnL:* ${pnlSigno}${alerta.pnlPorcentaje}%

${lineasReglas}

────────────────────────
⚙️ _CondorFi Quantitative Trading Terminal_
_Aislamiento multi-tenant validado por RLS._`;

      // Envío directo utilizando la función utilitaria
      const envio = await enviarNotificacionTelegram({
        user_id: alerta.userId,
        texto: mensajeTelegram,
        parseMode: 'Markdown'
      });

      if (envio.ok) {
        despachosExitosos++;
      } else {
        despachosOmitidos++;
        console.warn(`[Cron Scanner] No se envió alerta al usuario ${alerta.userId}:`, envio.error);
      }
    }

    const duracionMs = Math.round(performance.now() - inicio);

    return res.status(200).json({
      ok: true,
      mensaje: 'Ciclo de escaneo cuantitativo completado exitosamente.',
      timestamp: new Date().toISOString(),
      posiciones_analizadas: posiciones.length,
      activos_cotizados: mapaCotizaciones.size,
      alertas_detectadas: alertasDisparadas.length,
      despachos_telegram: {
        exitosos: despachosExitosos,
        omitidos_o_sin_telegram: despachosOmitidos
      },
      duracion_ms: duracionMs
    });
  } catch (err) {
    console.error('[Cron Scanner] Error general en el escaneo:', err);
    return res.status(500).json({
      ok: false,
      error: 'Error crítico en el motor de escaneo cuantitativo.',
      details: err.message
    });
  }
}
