/**
 * ==============================================================================
 * CondorFi - Motor de Insights y Detección de Anomalías Estadísticas
 * Archivo: condorfi-ui/api/generar-insights.js
 * 
 * Serverless Function para Vercel:
 * 1. Extrae los últimos 100 registros de 'cotizaciones_historicas' para un activo (default: USDT).
 * 2. Calcula la Media Móvil Simple (SMA) del spread.
 * 3. Calcula la Desviación Estándar (σ) del spread.
 * 4. Evalúa si el spread más reciente es una anomalía positiva (Spread > 1.0% Y Spread > SMA + 1.5*σ).
 * 5. Si se detecta, persiste la alerta 'OPORTUNIDAD_ALTA' en 'alertas_mercado'.
 * 6. Retorna cálculo matemático completo y estado de la alerta en JSON con HTTP 200.
 * ==============================================================================
 */

import { supabase as supabaseCliente } from '../src/lib/supabase.js';
import { createClient } from '@supabase/supabase-js';

// Polyfill ligero para WebSocket en entornos Serverless Node < 22
if (!globalThis.WebSocket) {
  globalThis.WebSocket = class DummyWebSocket {};
}

/**
 * Calcula la Media Móvil Simple (SMA) de un array numérico.
 * @param {number[]} valores 
 * @returns {number}
 */
function calcularSMA(valores) {
  if (!valores || valores.length === 0) return 0;
  const suma = valores.reduce((acc, val) => acc + val, 0);
  return suma / valores.length;
}

/**
 * Calcula la Desviación Estándar poblacional (σ) de un array numérico.
 * @param {number[]} valores 
 * @param {number} sma 
 * @returns {number}
 */
function calcularDesviacionEstandar(valores, sma) {
  if (!valores || valores.length === 0) return 0;
  const media = typeof sma === 'number' ? sma : calcularSMA(valores);
  const sumaDiferenciasCuadradas = valores.reduce((acc, val) => acc + Math.pow(val - media, 2), 0);
  return Math.sqrt(sumaDiferenciasCuadradas / valores.length);
}

/**
 * Extrae o calcula el spread porcentual de un registro.
 * Si el registro tiene la columna 'spread', la utiliza; si no, calcula (venta - compra) / compra * 100.
 * @param {object} registro 
 * @returns {number}
 */
function extraerSpread(registro) {
  if (typeof registro.spread === 'number' && !isNaN(registro.spread)) {
    return Number(registro.spread);
  }
  const compra = Number(registro.precio_compra) || 0;
  const venta = Number(registro.precio_venta) || 0;
  if (compra > 0 && venta > 0) {
    return Number((((venta - compra) / compra) * 100).toFixed(4));
  }
  return 0;
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

    // 2. Parámetros de consulta (por defecto USDT)
    const moneda = (req.query?.moneda || req.body?.moneda || 'USDT').toUpperCase();
    const limite = 100;

    // 3. Extracción de los últimos 100 registros históricos ordenados descendentemente
    const { data: registros, error: errSelect } = await db
      .from('cotizaciones_historicas')
      .select('id, timestamp, moneda, exchange, precio_compra, precio_venta, spread, exchange_compra, exchange_venta')
      .eq('moneda', moneda)
      .order('timestamp', { ascending: false })
      .limit(limite);

    if (errSelect) {
      throw new Error(`Error consultando cotizaciones_historicas: ${errSelect.message} (${errSelect.code})`);
    }

    if (!registros || registros.length === 0) {
      return res.status(200).json({
        status: "sin_datos",
        moneda,
        mensaje: `No se encontraron registros históricos para ${moneda} en Supabase.`,
        totalRegistrosAnalizados: 0
      });
    }

    // 4. Extracción de spreads y cálculo de Media Móvil Simple (SMA) y Desviación Estándar (σ)
    const spreads = registros.map(extraerSpread);
    const sma = calcularSMA(spreads);
    const desviacionEstandar = calcularDesviacionEstandar(spreads, sma);

    // 5. Análisis del registro más reciente
    const registroReciente = registros[0];
    const spreadActual = extraerSpread(registroReciente);
    const umbralEstadistico = sma + (1.5 * desviacionEstandar);

    // Regla de decisión: Spread actual > 1.0% Y Spread actual > (SMA + 1.5 * σ)
    const cumpleFiltroMinimo = spreadActual > 1.0;
    const superaUmbralEstadistico = spreadActual > umbralEstadistico;
    const esOportunidadAlta = cumpleFiltroMinimo && superaUmbralEstadistico;

    let alertaGenerada = null;
    let guardadoEnDb = false;
    let errorGuardado = null;

    // 6. Generación y persistencia de alerta si se cumple la condición
    if (esOportunidadAlta) {
      const exchangeCompra = registroReciente.exchange_compra || (registroReciente.exchange?.split('->')[0]?.trim()) || 'Desconocido';
      const exchangeVenta = registroReciente.exchange_venta || (registroReciente.exchange?.split('->')[1]?.trim()) || 'Desconocido';

      alertaGenerada = {
        tipo_alerta: 'OPORTUNIDAD_ALTA',
        moneda,
        spread_actual: Number(spreadActual.toFixed(4)),
        spread_sma: Number(sma.toFixed(4)),
        desviacion_estandar: Number(desviacionEstandar.toFixed(4)),
        exchange_compra: exchangeCompra,
        exchange_venta: exchangeVenta,
        mensaje: `Alerta OPORTUNIDAD_ALTA detectada en ${moneda}: Spread actual de ${spreadActual.toFixed(2)}% supera el umbral estadístico de ${umbralEstadistico.toFixed(2)}% (SMA: ${sma.toFixed(2)}% + 1.5σ: ${(1.5 * desviacionEstandar).toFixed(2)}%). Compra sugerida en ${exchangeCompra} ($${registroReciente.precio_compra}) y venta en ${exchangeVenta} ($${registroReciente.precio_venta}).`,
        timestamp: new Date().toISOString()
      };

      try {
        const { error: errInsert } = await db
          .from('alertas_mercado')
          .insert([alertaGenerada]);

        if (errInsert) {
          errorGuardado = `${errInsert.message} (Código: ${errInsert.code})`;
          console.warn('[Motor Insights] Aviso al insertar en alertas_mercado:', errorGuardado);
        } else {
          guardadoEnDb = true;
        }
      } catch (errDb) {
        errorGuardado = errDb.message;
        console.warn('[Motor Insights] Excepción al guardar alerta:', errDb);
      }
    }

    const duracionMs = Math.round(performance.now() - inicio);

    // 7. Respuesta HTTP 200 con el cálculo matemático y el estado de la alerta
    return res.status(200).json({
      status: "success",
      moneda,
      timestamp: new Date().toISOString(),
      duracionMs,
      totalRegistrosAnalizados: registros.length,
      metricasMatematicas: {
        sma: Number(sma.toFixed(4)),
        desviacionEstandar: Number(desviacionEstandar.toFixed(4)),
        factorMultiplicador: 1.5,
        umbralEstadistico: Number(umbralEstadistico.toFixed(4)),
        filtroMinimoPorcentual: 1.0
      },
      ultimoPrecio: {
        id: registroReciente.id,
        timestamp: registroReciente.timestamp,
        exchange: registroReciente.exchange,
        exchange_compra: registroReciente.exchange_compra,
        exchange_venta: registroReciente.exchange_venta,
        precio_compra: registroReciente.precio_compra,
        precio_venta: registroReciente.precio_venta,
        spreadActual: Number(spreadActual.toFixed(4))
      },
      evaluacion: {
        cumpleFiltroMinimo,
        superaUmbralEstadistico,
        esOportunidadAlta
      },
      alerta: alertaGenerada,
      alertaGuardada: guardadoEnDb,
      errorGuardado
    });

  } catch (error) {
    console.error('[Motor de Insights] Error:', error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Error interno al generar insights matemáticos"
    });
  }
}
