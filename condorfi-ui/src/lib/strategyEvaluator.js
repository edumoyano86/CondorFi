/**
 * ==============================================================================
 * CondorFi - Motor de Evaluación Dinámica de Estrategias (Rule Engine)
 * Archivo: condorfi-ui/src/lib/strategyEvaluator.js
 * 
 * Función universal para parseo y ejecución de reglas lógicas cuantitativas:
 * evaluarEstrategiaDinamica(datosActivo, reglasJson).
 * 
 * Indicadores Soportados:
 * - RSI (14 períodos)
 * - MACD_HIST (Histograma MACD)
 * - MACD_LINE (Línea rápida MACD)
 * - MACD_CRUCE (Cruce de medias MACD)
 * - BOLLINGER_PERCENT_B (Oscilador %B de Bandas de Bollinger)
 * - PRECIO_VS_SMA20 (Desviación porcentual del Precio respecto a SMA 20)
 * - VARIACION_24H (Variación porcentual diaria)
 * 
 * Operadores Soportados:
 * - '>'  (Mayor que)
 * - '<'  (Menor que)
 * - '>=' (Mayor o igual)
 * - '<=' (Menor o igual)
 * - '='  (Igualdad con tolerancia numérica)
 * - 'CrossUp'   (Cruce alcista hacia arriba)
 * - 'CrossDown' (Cruce bajista hacia abajo)
 * 
 * Conectores Lógicos:
 * - 'AND' | 'OR'
 * ==============================================================================
 */

/**
 * Catálogo de indicadores disponibles para el constructor visual.
 */
export const INDICADORES_CATALOGO = [
  {
    id: 'RSI',
    nombre: 'RSI (14 Períodos)',
    categoria: 'Oscilador',
    unidad: 'pts',
    rangoDefault: [0, 100],
    defaultValor: 30,
    descripcion: 'Índice de Fuerza Relativa. <30 Sobreventa, >70 Sobrecompra.'
  },
  {
    id: 'MACD_HIST',
    nombre: 'MACD (Histograma)',
    categoria: 'Momentum',
    unidad: '',
    rangoDefault: [-100, 100],
    defaultValor: 0,
    descripcion: 'Diferencia entre Línea MACD y Señal. >0 Expansión alcista.'
  },
  {
    id: 'MACD_LINE',
    nombre: 'MACD (Línea Principal)',
    categoria: 'Momentum',
    unidad: '',
    rangoDefault: [-100, 100],
    defaultValor: 0,
    descripcion: 'Diferencia entre EMA(12) y EMA(26).'
  },
  {
    id: 'MACD_CRUCE',
    nombre: 'MACD (Cruce de Medias)',
    categoria: 'Gatillo',
    unidad: '',
    rangoDefault: ['CrossUp', 'CrossDown'],
    defaultValor: 'CrossUp',
    descripcion: 'Gatillo direccional: Cruce alcista (Golden Cross) o bajista (Death Cross).'
  },
  {
    id: 'BOLLINGER_PERCENT_B',
    nombre: 'Bandas de Bollinger (%B)',
    categoria: 'Volatilidad',
    unidad: 'ratio',
    rangoDefault: [0, 1.2],
    defaultValor: 0.20,
    descripcion: 'Ubicación respecto a las bandas: <=0 Toca Banda Inf, >=1 Toca Banda Sup.'
  },
  {
    id: 'PRECIO_VS_SMA20',
    nombre: 'Precio vs SMA(20) [%]',
    categoria: 'Tendencia',
    unidad: '%',
    rangoDefault: [-20, 20],
    defaultValor: 0,
    descripcion: 'Porcentaje de separación respecto a la Media Móvil Simple de 20 períodos.'
  },
  {
    id: 'VARIACION_24H',
    nombre: 'Variación 24 Horas (%)',
    categoria: 'Momentum',
    unidad: '%',
    rangoDefault: [-20, 20],
    defaultValor: 0,
    descripcion: 'Cambio porcentual de precio en las últimas 24 horas.'
  }
];

/**
 * Catálogo de operadores relacionales y gatillos.
 */
export const OPERADORES_CATALOGO = [
  { id: '>', label: 'Mayor que (>)' },
  { id: '<', label: 'Menor que (<)' },
  { id: '>=', label: 'Mayor o igual (>=)' },
  { id: '<=', label: 'Menor o igual (<=)' },
  { id: '=', label: 'Igual a (=)' },
  { id: 'CrossUp', label: 'Cruza hacia arriba (CrossUp)' },
  { id: 'CrossDown', label: 'Cruza hacia abajo (CrossDown)' }
];

/**
 * Extrae el valor numérico o estado del indicador a partir de los datos del activo.
 */
export function extraerValorIndicador(datosActivo, indicadorId) {
  if (!datosActivo) return null;

  const precioActual = Number(datosActivo.precioActual ?? datosActivo.close ?? datosActivo.precio ?? 0);
  const rsi = typeof datosActivo.rsi === 'number' ? datosActivo.rsi : null;
  const macd = datosActivo.macd || null;
  const bollinger = datosActivo.bollinger || null;
  const sma20 = Number(bollinger?.middle ?? bollinger?.sma ?? 0);
  const variacion24h = Number(datosActivo.variacion24h ?? 0);

  switch (indicadorId?.toUpperCase()) {
    case 'RSI':
      return rsi;

    case 'MACD_HIST':
    case 'MACD_HISTOGRAM':
    case 'MACD':
      return macd && typeof macd.histogram === 'number' ? macd.histogram : null;

    case 'MACD_LINE':
      return macd && typeof macd.macd === 'number' ? macd.macd : null;

    case 'MACD_SIGNAL':
      return macd && typeof macd.signal === 'number' ? macd.signal : null;

    case 'MACD_CRUCE':
      if (macd?.cruceAlcista) return 'CrossUp';
      if (macd?.cruceBajista) return 'CrossDown';
      return macd?.trend === 'BULLISH' ? 'CrossUp' : 'CrossDown';

    case 'BOLLINGER_PERCENT_B':
    case 'BOLLINGER_%B':
    case 'PERCENT_B':
      return bollinger && typeof bollinger.percentB === 'number' ? bollinger.percentB : null;

    case 'BOLLINGER_BANDWIDTH':
      return bollinger && typeof bollinger.bandwidth === 'number' ? bollinger.bandwidth : null;

    case 'PRECIO_VS_SMA20':
      if (sma20 > 0 && precioActual > 0) {
        return Number((((precioActual - sma20) / sma20) * 100).toFixed(2));
      }
      return 0;

    case 'VARIACION_24H':
      return variacion24h;

    case 'PRECIO_ACTUAL':
    case 'PRECIO':
      return precioActual;

    default:
      return null;
  }
}

/**
 * Evalúa una condición relacional unitaria.
 */
export function evaluarCondicion(valorActual, operador, valorObjetivo) {
  if (valorActual === null || valorActual === undefined) {
    return false;
  }

  // Comparaciones especiales para Cruces
  if (operador === 'CrossUp') {
    if (typeof valorActual === 'string') {
      return valorActual === 'CrossUp';
    }
    const target = Number(valorObjetivo);
    return !isNaN(target) && Number(valorActual) >= target;
  }

  if (operador === 'CrossDown') {
    if (typeof valorActual === 'string') {
      return valorActual === 'CrossDown';
    }
    const target = Number(valorObjetivo);
    return !isNaN(target) && Number(valorActual) <= target;
  }

  // Comparaciones numéricas estándar
  const numActual = Number(valorActual);
  const numTarget = Number(valorObjetivo);

  if (isNaN(numActual) || isNaN(numTarget)) {
    if (operador === '=') return String(valorActual).toLowerCase() === String(valorObjetivo).toLowerCase();
    return false;
  }

  switch (operador) {
    case '>':
      return numActual > numTarget;
    case '<':
      return numActual < numTarget;
    case '>=':
      return numActual >= numTarget;
    case '<=':
      return numActual <= numTarget;
    case '=':
    case '==':
      return Math.abs(numActual - numTarget) < 0.0001;
    case '!=':
      return Math.abs(numActual - numTarget) >= 0.0001;
    default:
      return false;
  }
}

/**
 * Evalúa una lista secuencial de reglas con soporte para operadores lógicos AND / OR.
 * Soporta formato plano con objetos conectores [{...}, {operadorLogico: 'AND'}, {...}]
 * o formato de reglas con propiedad conector [{..., conector: 'AND'}].
 */
export function evaluarListaReglas(datosActivo, listaReglas) {
  if (!Array.isArray(listaReglas) || listaReglas.length === 0) {
    return { cumple: false, detalles: [] };
  }

  // Normalizar array extrayendo condiciones y conectores
  const itemsNormalizados = [];
  let conectorPendiente = 'AND';

  for (let i = 0; i < listaReglas.length; i++) {
    const item = listaReglas[i];
    if (!item) continue;

    // Si es un nodo de conector lógico explícito
    if (item.operadorLogico || item.conectorLogico) {
      conectorPendiente = (item.operadorLogico || item.conectorLogico).toUpperCase();
      continue;
    }

    // Si es una regla de condición
    if (item.indicador) {
      itemsNormalizados.push({
        indicador: item.indicador,
        operador: item.operador || '>',
        valor: item.valor ?? 0,
        conector: item.conector ? item.conector.toUpperCase() : conectorPendiente
      });
      conectorPendiente = 'AND'; // Reset por defecto
    }
  }

  if (itemsNormalizados.length === 0) {
    return { cumple: false, detalles: [] };
  }

  let resultadoAcumulado = null;
  const detalles = [];

  for (let i = 0; i < itemsNormalizados.length; i++) {
    const regla = itemsNormalizados[i];
    const valorActual = extraerValorIndicador(datosActivo, regla.indicador);
    const cumpleRegla = evaluarCondicion(valorActual, regla.operador, regla.valor);

    detalles.push({
      indicador: regla.indicador,
      operador: regla.operador,
      valorObjetivo: regla.valor,
      valorActual: typeof valorActual === 'number' ? Number(valorActual.toFixed(4)) : valorActual,
      cumple: cumpleRegla,
      conector: regla.conector
    });

    if (resultadoAcumulado === null) {
      resultadoAcumulado = cumpleRegla;
    } else {
      if (regla.conector === 'OR') {
        resultadoAcumulado = resultadoAcumulado || cumpleRegla;
      } else {
        // AND por defecto
        resultadoAcumulado = resultadoAcumulado && cumpleRegla;
      }
    }
  }

  return {
    cumple: Boolean(resultadoAcumulado),
    detalles
  };
}

/**
 * ==============================================================================
 * FUNCIÓN EVALUADORA UNIVERSAL DE ESTRATEGIAS DINÁMICAS
 * ==============================================================================
 * Evalúa los indicadores calculados de un activo contra un conjunto de reglas JSON.
 * 
 * @param {Object} datosActivo Objeto con indicadores (rsi, macd, bollinger, precioActual, etc.)
 * @param {Array|Object} reglasJson Conjunto de reglas lógicas creadas visualmente
 * @returns {Object} Resultado de la evaluación con dictamen y score cuantitativo
 */
export function evaluarEstrategiaDinamica(datosActivo, reglasJson) {
  if (!datosActivo || !reglasJson) {
    return {
      cumpleCompra: false,
      cumpleVenta: false,
      dictamen: 'HOLD',
      scoreSugerido: 50,
      mensaje: 'Sin reglas dinámicas aplicables.',
      detalles: []
    };
  }

  // 1. Caso A: reglasJson es un objeto estructurado { compras: [...], ventas: [...] }
  if (typeof reglasJson === 'object' && !Array.isArray(reglasJson)) {
    const reglasCompra = reglasJson.compras || reglasJson.buyRules || [];
    const reglasVenta = reglasJson.ventas || reglasJson.sellRules || [];

    const evalCompra = evaluarListaReglas(datosActivo, reglasCompra);
    const evalVenta = evaluarListaReglas(datosActivo, reglasVenta);

    let dictamen = 'HOLD';
    let scoreSugerido = 50;
    let mensaje = '';

    if (evalCompra.cumple && !evalVenta.cumple) {
      dictamen = 'STRONG_BUY';
      scoreSugerido = 95;
      mensaje = `Señal de COMPRA activada por estrategia personalizada. Todas las condiciones de entrada confirmadas.`;
    } else if (evalVenta.cumple && !evalCompra.cumple) {
      dictamen = 'STRONG_SELL';
      scoreSugerido = 15;
      mensaje = `Señal de VENTA activada por estrategia personalizada. Condiciones de salida o stop alcanzadas.`;
    } else if (evalCompra.cumple && evalVenta.cumple) {
      dictamen = 'HOLD';
      scoreSugerido = 50;
      mensaje = `Conflicto de señales simultáneas de compra y venta. Estado en neutralidad (HOLD).`;
    } else {
      dictamen = 'HOLD';
      scoreSugerido = 50;
      mensaje = `Condiciones de estrategia no gatilladas. Monitoreando mercado.`;
    }

    return {
      cumpleCompra: evalCompra.cumple,
      cumpleVenta: evalVenta.cumple,
      dictamen,
      scoreSugerido,
      mensaje,
      detallesCompra: evalCompra.detalles,
      detallesVenta: evalVenta.detalles,
      detalles: [...evalCompra.detalles, ...evalVenta.detalles]
    };
  }

  // 2. Caso B: reglasJson es un array plano de condiciones
  if (Array.isArray(reglasJson)) {
    const evaluacion = evaluarListaReglas(datosActivo, reglasJson);
    const cumple = evaluacion.cumple;

    return {
      cumpleCompra: cumple,
      cumpleVenta: false,
      dictamen: cumple ? 'STRONG_BUY' : 'HOLD',
      scoreSugerido: cumple ? 95 : 50,
      mensaje: cumple
        ? `Reglas personalizadas cumplidas al 100%. Dictamen: STRONG_BUY.`
        : `Reglas personalizadas no satisfechas.`,
      detalles: evaluacion.detalles
    };
  }

  return {
    cumpleCompra: false,
    cumpleVenta: false,
    dictamen: 'HOLD',
    scoreSugerido: 50,
    mensaje: 'Formato de reglas no reconocido.',
    detalles: []
  };
}

