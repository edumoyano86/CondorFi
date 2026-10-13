/**
 * ==============================================================================
 * CondorFi - Motor de Insights y Detección de Anomalías Multimercado
 * Archivo: condorfi-ui/api/generar-insights.js
 * 
 * Serverless Function para Vercel:
 * Soporta dinámicamente dos mercados vía query params:
 *   - ?mercado=cripto&moneda=USDT (por defecto)
 *   - ?mercado=tradfi&ticker=SPY (acciones e índices)
 * 
 * Reglas Estadísticas:
 * 1. Cripto:
 *    - SMA y Desviación Estándar (σ) calculados sobre el SPREAD en 'cotizaciones_historicas'.
 *    - Alerta 'OPORTUNIDAD_ALTA' si: Spread > 1.0% Y Spread > SMA + 1.5*σ.
 * 2. TradFi:
 *    - SMA y Desviación Estándar (σ) calculados sobre PRECIO_ACTUAL en 'cotizaciones_tradfi'.
 *    - Alerta 'VOLATILIDAD_EXTREMA' si: |Variación vs Apertura| > 2.0% Y Precio rompe (SMA ± 2*σ).
 * 
 * Si se detecta anomalía, la persiste en 'alertas_mercado' y responde con HTTP 200.
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
 * Extrae o calcula el spread porcentual de un registro cripto.
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

    // 2. Extracción y normalización de parámetros
    const mercadoParam = (req.query?.mercado || req.body?.mercado || '').toLowerCase().trim();
    const tickerParam = (req.query?.ticker || req.body?.ticker || '').toUpperCase().trim();
    const monedaParam = (req.query?.moneda || req.body?.moneda || '').toUpperCase().trim();

    // Detección automática del mercado: 'tradfi' si se solicita explícitamente o si se envía un ticker tradicional
    const esTradfi = mercadoParam === 'tradfi' || (!mercadoParam && Boolean(tickerParam));
    const mercado = esTradfi ? 'tradfi' : 'cripto';
    const limite = 100;

    let alertaGenerada = null;
    let guardadoEnDb = false;
    let errorGuardado = null;

    // =========================================================================
    // RAMA TRADFI: Análisis de Acciones, ETFs e Índices
    // =========================================================================
    if (esTradfi) {
      const ticker = tickerParam || monedaParam || 'SPY';

      // Consulta a la tabla cotizaciones_tradfi
      const { data: registros, error: errSelect } = await db
        .from('cotizaciones_tradfi')
        .select('id, timestamp, ticker, precio_actual, precio_apertura, moneda, maximo_diario, minimo_diario')
        .eq('ticker', ticker)
        .order('id', { ascending: false })
        .limit(limite);

      if (errSelect) {
        throw new Error(`Error consultando cotizaciones_tradfi: ${errSelect.message} (${errSelect.code})`);
      }

      if (!registros || registros.length === 0) {
        return res.status(200).json({
          status: "sin_datos",
          mercado: "tradfi",
          ticker,
          mensaje: `No se encontraron registros de cotizaciones TradFi para el ticker '${ticker}'.`,
          totalRegistrosAnalizados: 0
        });
      }

      // SMA y Desviación Estándar calculados sobre PRECIO_ACTUAL
      const precios = registros
        .map(r => Number(r.precio_actual))
        .filter(p => !isNaN(p) && p > 0);

      const sma = calcularSMA(precios);
      const desviacionEstandar = calcularDesviacionEstandar(precios, sma);

      const registroReciente = registros[0];
      const precioActual = Number(registroReciente.precio_actual) || 0;
      const precioApertura = Number(registroReciente.precio_apertura) || precioActual;

      // Variación respecto a la apertura
      const variacionAperturaPorcentaje = precioApertura > 0
        ? Number((((precioActual - precioApertura) / precioApertura) * 100).toFixed(4))
        : 0;

      // Reglas de anomalía TradFi:
      // 1. Variación absoluta vs apertura > 2% (caída o subida)
      // 2. Precio rompe la banda de SMA ± 2 * Desviación Estándar
      const cumpleVariacionApertura = Math.abs(variacionAperturaPorcentaje) >= 2.0;
      const bandaSuperior = sma + (2 * desviacionEstandar);
      const bandaInferior = sma - (2 * desviacionEstandar);
      const rompeBandasEstadisticas = precioActual > bandaSuperior || precioActual < bandaInferior;

      const esVolatilidadExtrema = cumpleVariacionApertura && rompeBandasEstadisticas;

      if (esVolatilidadExtrema) {
        const direccion = precioActual > bandaSuperior ? 'por encima' : 'por debajo';
        const sentido = variacionAperturaPorcentaje >= 0
          ? `subida del +${variacionAperturaPorcentaje.toFixed(2)}%`
          : `caída del ${variacionAperturaPorcentaje.toFixed(2)}%`;

        alertaGenerada = {
          tipo_alerta: 'VOLATILIDAD_EXTREMA',
          moneda: ticker,
          spread_actual: Number(variacionAperturaPorcentaje.toFixed(4)),
          spread_sma: Number(sma.toFixed(4)),
          desviacion_estandar: Number(desviacionEstandar.toFixed(4)),
          exchange_compra: 'TradFi Market',
          exchange_venta: registroReciente.moneda || 'USD',
          mensaje: `${ticker} cotizando 2 desviaciones estándar ${direccion} de su media móvil (${registroReciente.moneda} $${precioActual.toLocaleString('es-AR')} vs SMA $${sma.toLocaleString('es-AR')}), acumulando ${sentido} respecto a la apertura ($${precioApertura.toLocaleString('es-AR')}).`,
          timestamp: new Date().toISOString()
        };

        try {
          const { error: errInsert } = await db
            .from('alertas_mercado')
            .insert([alertaGenerada]);

          if (errInsert) {
            errorGuardado = `${errInsert.message} (Código: ${errInsert.code})`;
            console.warn('[Motor Insights TradFi] Aviso al insertar en alertas_mercado:', errorGuardado);
          } else {
            guardadoEnDb = true;
          }
        } catch (errDb) {
          errorGuardado = errDb.message;
          console.warn('[Motor Insights TradFi] Excepción al guardar alerta:', errDb);
        }
      }

      const duracionMs = Math.round(performance.now() - inicio);

      return res.status(200).json({
        status: "success",
        mercado: "tradfi",
        ticker,
        timestamp: new Date().toISOString(),
        duracionMs,
        totalRegistrosAnalizados: registros.length,
        metricasMatematicas: {
          variableAnalizada: "precio_actual",
          sma: Number(sma.toFixed(4)),
          desviacionEstandar: Number(desviacionEstandar.toFixed(4)),
          factorMultiplicador: 2.0,
          bandaSuperior: Number(bandaSuperior.toFixed(4)),
          bandaInferior: Number(bandaInferior.toFixed(4)),
          umbralVariacionMinimaPct: 2.0
        },
        ultimoPrecio: {
          id: registroReciente.id,
          timestamp: registroReciente.timestamp,
          ticker: registroReciente.ticker,
          moneda: registroReciente.moneda,
          precioActual: Number(precioActual.toFixed(4)),
          precioApertura: Number(precioApertura.toFixed(4)),
          variacionAperturaPorcentaje: Number(variacionAperturaPorcentaje.toFixed(2))
        },
        evaluacion: {
          cumpleVariacionApertura,
          rompeBandasEstadisticas,
          esVolatilidadExtrema
        },
        alerta: alertaGenerada,
        alertaGuardada: guardadoEnDb,
        errorGuardado
      });
    }

    // =========================================================================
    // RAMA CRIPTO: Análisis de Spreads y Arbitraje
    // =========================================================================
    const moneda = monedaParam || tickerParam || 'USDT';

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
        mercado: "cripto",
        moneda,
        mensaje: `No se encontraron registros históricos para ${moneda} en Supabase.`,
        totalRegistrosAnalizados: 0
      });
    }

    // SMA y Desviación Estándar calculados sobre SPREAD
    const spreads = registros.map(extraerSpread);
    const sma = calcularSMA(spreads);
    const desviacionEstandar = calcularDesviacionEstandar(spreads, sma);

    const registroReciente = registros[0];
    const spreadActual = extraerSpread(registroReciente);
    const umbralEstadistico = sma + (1.5 * desviacionEstandar);

    // Regla de decisión Cripto: Spread actual > 1.0% Y Spread actual > (SMA + 1.5 * σ)
    const cumpleFiltroMinimo = spreadActual > 1.0;
    const superaUmbralEstadistico = spreadActual > umbralEstadistico;
    const esOportunidadAlta = cumpleFiltroMinimo && superaUmbralEstadistico;

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
          console.warn('[Motor Insights Cripto] Aviso al insertar en alertas_mercado:', errorGuardado);
        } else {
          guardadoEnDb = true;
        }
      } catch (errDb) {
        errorGuardado = errDb.message;
        console.warn('[Motor Insights Cripto] Excepción al guardar alerta:', errDb);
      }
    }

    const duracionMs = Math.round(performance.now() - inicio);

    return res.status(200).json({
      status: "success",
      mercado: "cripto",
      moneda,
      timestamp: new Date().toISOString(),
      duracionMs,
      totalRegistrosAnalizados: registros.length,
      metricasMatematicas: {
        variableAnalizada: "spread",
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
