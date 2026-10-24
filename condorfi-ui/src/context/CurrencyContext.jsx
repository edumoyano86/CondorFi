/**
 * ==============================================================================
 * CondorFi - Motor Multidivisa Global Institucional (CurrencyContext)
 * Archivo: condorfi-ui/src/context/CurrencyContext.jsx
 * 
 * Arquitectura Institucional de Divisas (ARS / USD):
 * - Cotización en vivo mediante DolarAPI (Cripto USDT/ARS & Dólar Blue) y CriptoYa.
 * - Descarte absoluto de valores estáticos hardcodeados (como $1.651 fijo).
 * - Multiplicador y conversión FX estricta en tiempo real:
 *     * Activo USD visualizado en ARS: valor_usd * tasa_cambio_ars
 *     * Activo ARS visualizado en USD: valor_ars / tasa_cambio_ars
 * - Determinación robusta de moneda nativa por ticker (Wall Street / ETFs / BYMA).
 * - Formateo monetario con separador de miles ('es-AR' con puntos y 'en-US' con comas).
 * ==============================================================================
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

// Tasa de contingencia mínima si la red está 100% desconectada
export const TASA_DEFAULT_USDT_ARS = 1640;

/**
 * Tickers conocidos del mercado estadounidense cuyo activo base es estrictamente USD.
 */
const TICKERS_ESTRICTAMENTE_USD = new Set([
  'VIG', 'SCHD', 'JEPI', 'JEPQ', 'VYM', 'DGRO', 'NOBL', 'QQQM', 'HDV', 'SPYD',
  'DVY', 'SDY', 'COWZ', 'DIVO', 'MOAT', 'BST', 'SPY', 'QQQ', 'DIA', 'IWM',
  'VOO', 'IVV', 'VTI', 'TLT', 'IEF', 'SHY', 'BND', 'AGG', 'LQD', 'HYG',
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'GOOG', 'META', 'TSLA', 'AVGO', 'NFLX',
  'AMD', 'QCOM', 'TXN', 'INTC', 'AMAT', 'MU', 'LRCX', 'KLAC', 'MRVL', 'ADI',
  'ORCL', 'CRM', 'ADBE', 'NOW', 'INTU', 'SNOW', 'WDAY', 'PLTR', 'TEAM', 'DDOG'
]);

/**
 * Determina con certeza la moneda nativa de un instrumento financiero.
 * Evita que activos de Wall Street como VIG se clasifiquen erróneamente en ARS.
 * 
 * @param {string} ticker Símbolo del activo (ej: 'VIG', 'GGAL.BA', 'BTC')
 * @param {string} [tipoMercado] 'tradfi' | 'cripto' | 'indices' | 'bonos'
 * @param {string} [monedaGuardada] Valor almacenado en base de datos
 * @returns {'ARS' | 'USD'} Moneda base verdadera
 */
export function determinarMonedaNativa(ticker = '', tipoMercado = 'tradfi', monedaGuardada = null) {
  const t = String(ticker || '').trim().toUpperCase();
  if (!t) return 'USD';

  // Mercado local argentino (BYMA, Merval, Bonos soberanos en pesos o tickers .BA)
  if (t === '^MERV' || t.endsWith('.BA')) {
    return 'ARS';
  }

  // Activos de Wall Street y ETFs estratégicos: siempre son nativos USD
  if (TICKERS_ESTRICTAMENTE_USD.has(t)) {
    return 'USD';
  }

  // Si no tiene punto (.BA) ni arranca con ^ y es TradFi, es Wall Street (USD)
  if (tipoMercado !== 'cripto' && !t.includes('.') && !t.startsWith('^')) {
    return 'USD';
  }

  // Criptoactivos: si vienen cotizados expresamente en ARS o USD
  if (tipoMercado === 'cripto' && monedaGuardada) {
    return monedaGuardada.toUpperCase() === 'USD' ? 'USD' : 'ARS';
  }

  return monedaGuardada ? monedaGuardada.toUpperCase() : 'USD';
}

/**
 * Convierte un monto aplicando la paridad FX matemática:
 * - USD a ARS: valor * tasaCambio
 * - ARS a USD: valor / tasaCambio
 * - Misma moneda: valor sin alterar
 * 
 * @param {number} valor Monto original
 * @param {'ARS' | 'USD'} monedaNativa Moneda base original del activo
 * @param {'ARS' | 'USD'} monedaGlobal Moneda visual seleccionada
 * @param {number} tasaCambio Tasa de cambio USDT/ARS en vivo
 * @returns {number} Valor numérico convertido
 */
export function convertirValorFX(valor, monedaNativa = 'USD', monedaGlobal = 'ARS', tasaCambio = TASA_DEFAULT_USDT_ARS) {
  if (typeof valor !== 'number' || isNaN(valor)) return 0;
  const nativa = (monedaNativa || 'USD').toUpperCase();
  const global = (monedaGlobal || 'USD').toUpperCase();
  const tasa = Number(tasaCambio) > 0 ? Number(tasaCambio) : TASA_DEFAULT_USDT_ARS;

  if (nativa === global) {
    return valor;
  }

  // Si el activo es USD y el usuario seleccionó ver en ARS: multiplicador obligatorio
  if (nativa === 'USD' && global === 'ARS') {
    return valor * tasa;
  }

  // Si el activo es ARS y el usuario seleccionó ver en USD: división por la tasa
  if (nativa === 'ARS' && global === 'USD') {
    return valor / tasa;
  }

  return valor;
}

// Alias para compatibilidad hacia atrás
export const convertirMonto = (valor, monedaNativa = 'USD', monedaGlobal = 'USD', tasaCambio = TASA_DEFAULT_USDT_ARS) => {
  return convertirValorFX(valor, monedaNativa, monedaGlobal, tasaCambio);
};

/**
 * Formatea un valor monetario aplicando los separadores de miles estándar.
 * Para ARS utiliza formato argentino (puntos para miles, comas para decimales).
 * Para USD utiliza formato estándar americano (comas para miles, puntos para decimales).
 * 
 * @param {number} valor Monto numérico ya convertido a la moneda destino
 * @param {'ARS' | 'USD'} moneda Moneda visual de la cifra
 * @param {Object} [opciones]
 * @returns {string} Cadena estilizada (ej: "$1.448.480 ARS" o "$2,450.50 USD")
 */
export function formatearMonto(valor, moneda = 'USD', opciones = {}) {
  if (valor === undefined || valor === null || isNaN(Number(valor))) {
    return '-';
  }
  const num = Number(valor);
  const m = (moneda || 'USD').toUpperCase();
  const { mostrarCodigo = false, compactar = false, decimales } = opciones;

  let texto = '';
  if (m === 'ARS') {
    if (compactar && Math.abs(num) >= 1_000_000) {
      texto = `$${(num / 1_000_000).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
    } else {
      const maxDec = decimales !== undefined ? decimales : (Math.abs(num) >= 100 ? 0 : 2);
      texto = `$${num.toLocaleString('es-AR', { minimumFractionDigits: maxDec, maximumFractionDigits: maxDec })}`;
    }
  } else {
    // Formato USD
    if (compactar && Math.abs(num) >= 1_000_000) {
      texto = `$${(num / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
    } else {
      const maxDec = decimales !== undefined ? decimales : (Math.abs(num) >= 1 ? 2 : 4);
      texto = `$${num.toLocaleString('en-US', { minimumFractionDigits: maxDec, maximumFractionDigits: maxDec })}`;
    }
  }

  return mostrarCodigo ? `${texto} ${m}` : texto;
}

/**
 * Función universal de formateo dinámico multidivisa con conversión automática.
 */
export function formatearPrecio(valor, monedaNativa = 'USD', monedaGlobal = 'USD', tasaCambio = TASA_DEFAULT_USDT_ARS, opciones = {}) {
  if (valor === undefined || valor === null || isNaN(Number(valor))) {
    return '-';
  }
  const num = Number(valor);
  const global = (monedaGlobal || 'USD').toUpperCase();
  const convertido = convertirValorFX(num, monedaNativa, global, tasaCambio);
  return formatearMonto(convertido, global, opciones);
}

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  // Estado de moneda global persistente ('ARS' por defecto para el mercado argentino)
  const [monedaGlobal, setMonedaGlobalState] = useState(() => {
    try {
      const guardada = localStorage.getItem('condorfi_moneda_global');
      return guardada === 'USD' ? 'USD' : 'ARS';
    } catch {
      return 'ARS';
    }
  });

  const [tasaCambio, setTasaCambio] = useState(TASA_DEFAULT_USDT_ARS);
  const [cargandoTasa, setCargandoTasa] = useState(true);
  const [errorTasa, setErrorTasa] = useState(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);
  const [fuenteTasa, setFuenteTasa] = useState('DolarAPI');

  const setMonedaGlobal = useCallback((moneda) => {
    const m = moneda === 'USD' ? 'USD' : 'ARS';
    setMonedaGlobalState(m);
    try {
      localStorage.setItem('condorfi_moneda_global', m);
    } catch {}
  }, []);

  const toggleMonedaGlobal = useCallback(() => {
    setMonedaGlobal(monedaGlobal === 'ARS' ? 'USD' : 'ARS');
  }, [monedaGlobal, setMonedaGlobal]);

  /**
   * Sincroniza la cotización del dólar en vivo desde DolarAPI (USDT/Cripto o Blue)
   * eliminando cualquier dependencia de valores mock o estáticos.
   */
  const actualizarTasa = useCallback(async () => {
    setCargandoTasa(true);
    setErrorTasa(null);

    // 1. Intento primario: DolarAPI Dólar Cripto (USDT/ARS en vivo)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('https://dolarapi.com/v1/dolares/cripto', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const price = parseFloat(data.venta || data.promedio || data.compra);
        if (!isNaN(price) && price > 0) {
          setTasaCambio(price);
          setFuenteTasa('DolarAPI Cripto');
          setUltimaActualizacion(new Date());
          setCargandoTasa(false);
          return price;
        }
      }
    } catch (e) {
      console.warn('[CurrencyContext] DolarAPI Cripto falló, probando DolarAPI Blue...', e.message);
    }

    // 2. Fallback secundario: DolarAPI Dólar Blue
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('https://dolarapi.com/v1/dolares/blue', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const price = parseFloat(data.venta || data.promedio || data.compra);
        if (!isNaN(price) && price > 0) {
          setTasaCambio(price);
          setFuenteTasa('DolarAPI Blue');
          setUltimaActualizacion(new Date());
          setCargandoTasa(false);
          return price;
        }
      }
    } catch (e) {
      console.warn('[CurrencyContext] DolarAPI Blue falló, probando CriptoYa...', e.message);
    }

    // 3. Fallback terciario: CriptoYa Binance USDT/ARS
    try {
      const res = await fetch('https://criptoya.com/api/binance/usdt/ars');
      if (res.ok) {
        const data = await res.json();
        const price = parseFloat(data.ask || data.bid || data.totalAsk);
        if (!isNaN(price) && price > 0) {
          setTasaCambio(price);
          setFuenteTasa('CriptoYa');
          setUltimaActualizacion(new Date());
          setCargandoTasa(false);
          return price;
        }
      }
    } catch (e) {
      console.warn('[CurrencyContext] Fallback CriptoYa falló, probando Binance directo...', e.message);
    }

    // 4. Fallback cuaternario: Binance Public API
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDTARS');
      if (res.ok) {
        const data = await res.json();
        const price = parseFloat(data.price);
        if (!isNaN(price) && price > 0) {
          setTasaCambio(price);
          setFuenteTasa('Binance');
          setUltimaActualizacion(new Date());
          setCargandoTasa(false);
          return price;
        }
      }
    } catch (e) {
      console.warn('[CurrencyContext] Todas las fuentes remotas fallaron, manteniendo tasa previa:', e.message);
    }

    // Si fallan todas las APIs, mantener la última tasa conocida o contingencia
    setTasaCambio(prev => prev > 0 ? prev : TASA_DEFAULT_USDT_ARS);
    setUltimaActualizacion(new Date());
    setCargandoTasa(false);
  }, []);

  // Carga inicial y sondeo periódico cada 60 segundos
  useEffect(() => {
    actualizarTasa();
    const intervalo = setInterval(actualizarTasa, 60000);
    return () => clearInterval(intervalo);
  }, [actualizarTasa]);

  // Funciones formateadoras memorizadas y vinculadas al estado global
  const formatPrecioBound = useCallback((valor, monedaNativa, opciones) => {
    return formatearPrecio(valor, monedaNativa, monedaGlobal, tasaCambio, opciones);
  }, [monedaGlobal, tasaCambio]);

  const formatMontoBound = useCallback((valorConvertido, opciones) => {
    return formatearMonto(valorConvertido, monedaGlobal, opciones);
  }, [monedaGlobal]);

  const convertirMontoBound = useCallback((valor, monedaNativa) => {
    return convertirValorFX(valor, monedaNativa, monedaGlobal, tasaCambio);
  }, [monedaGlobal, tasaCambio]);

  const value = useMemo(() => ({
    monedaGlobal,
    setMonedaGlobal,
    toggleMonedaGlobal,
    tasaCambio,
    cargandoTasa,
    errorTasa,
    fuenteTasa,
    ultimaActualizacion,
    actualizarTasa,
    formatearPrecio: formatPrecioBound,
    formatearMonto: formatMontoBound,
    convertirMonto: convertirMontoBound,
    convertirValorFX,
    determinarMonedaNativa
  }), [
    monedaGlobal,
    setMonedaGlobal,
    toggleMonedaGlobal,
    tasaCambio,
    cargandoTasa,
    errorTasa,
    fuenteTasa,
    ultimaActualizacion,
    actualizarTasa,
    formatPrecioBound,
    formatMontoBound,
    convertirMontoBound
  ]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    return {
      monedaGlobal: 'ARS',
      setMonedaGlobal: () => {},
      toggleMonedaGlobal: () => {},
      tasaCambio: TASA_DEFAULT_USDT_ARS,
      cargandoTasa: false,
      errorTasa: null,
      fuenteTasa: 'Fallback',
      ultimaActualizacion: null,
      actualizarTasa: () => {},
      formatearPrecio: (v, nativa = 'USD', opts) => formatearPrecio(v, nativa, 'ARS', TASA_DEFAULT_USDT_ARS, opts),
      formatearMonto: (v, opts) => formatearMonto(v, 'ARS', opts),
      convertirMonto: (v, nativa = 'USD') => convertirValorFX(v, nativa, 'ARS', TASA_DEFAULT_USDT_ARS),
      convertirValorFX,
      determinarMonedaNativa
    };
  }
  return context;
}

export default CurrencyContext;
