/**
 * ==============================================================================
 * CondorFi - Motor Multidivisa Global (CurrencyContext)
 * Archivo: condorfi-ui/src/context/CurrencyContext.jsx
 * 
 * Arquitectura Institucional de Divisas (ARS / USD):
 * - Gestiona el estado reactivo global de la divisa activa ('ARS' o 'USD').
 * - Sincroniza en tiempo real la tasa de cambio USDT/ARS desde Binance Public API
 *   (con fallback automático a CriptoYa / valor de contingencia institucional).
 * - Provee la función universal de conversión y formateo de precios:
 *   formatearPrecio(valor, monedaNativa, monedaGlobal, tasaCambio).
 * ==============================================================================
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

// Tasa de cambio de contingencia institucional si las APIs están temporalmente inaccesibles
const TASA_DEFAULT_USDT_ARS = 1615;

/**
 * Función de utilidad matemática institucional para conversión de montos.
 * @param {number} valor Valor numérico original
 * @param {'ARS' | 'USD'} monedaNativa Moneda base original del activo
 * @param {'ARS' | 'USD'} monedaGlobal Moneda destino seleccionada
 * @param {number} tasaCambio Tasa de cambio USDT/ARS
 * @returns {number} Valor convertido
 */
export function convertirMonto(valor, monedaNativa = 'USD', monedaGlobal = 'USD', tasaCambio = TASA_DEFAULT_USDT_ARS) {
  if (typeof valor !== 'number' || isNaN(valor)) return 0;
  const tasa = Number(tasaCambio) > 0 ? Number(tasaCambio) : TASA_DEFAULT_USDT_ARS;
  const nativa = (monedaNativa || 'USD').toUpperCase();
  const global = (monedaGlobal || 'USD').toUpperCase();

  if (nativa === global) {
    return valor;
  }

  // De ARS a USD (división por la tasa)
  if (nativa === 'ARS' && global === 'USD') {
    return valor / tasa;
  }

  // De USD a ARS (multiplicación por la tasa)
  if (nativa === 'USD' && global === 'ARS') {
    return valor * tasa;
  }

  return valor;
}

/**
 * Función universal de formateo dinámico multidivisa.
 * @param {number} valor Monto original
 * @param {'ARS' | 'USD'} monedaNativa Moneda nativa del instrumento
 * @param {'ARS' | 'USD'} monedaGlobal Moneda visual seleccionada
 * @param {number} tasaCambio Tasa de paridad USDT/ARS
 * @param {Object} [opciones] Configuración adicional (mostrarSimbolo, mostrarCodigo)
 * @returns {string} Cadena formateada
 */
export function formatearPrecio(valor, monedaNativa = 'USD', monedaGlobal = 'USD', tasaCambio = TASA_DEFAULT_USDT_ARS, opciones = {}) {
  if (valor === undefined || valor === null || isNaN(Number(valor))) {
    return '-';
  }

  const num = Number(valor);
  const global = (monedaGlobal || 'USD').toUpperCase();
  const convertido = convertirMonto(num, monedaNativa, global, tasaCambio);
  const { mostrarCodigo = false, compactar = false } = opciones;

  let texto = '';
  if (global === 'ARS') {
    if (compactar && Math.abs(convertido) >= 1_000_000) {
      texto = `$${(convertido / 1_000_000).toFixed(2)}M`;
    } else if (Math.abs(convertido) >= 100) {
      texto = `$${Math.round(convertido).toLocaleString('es-AR')}`;
    } else {
      texto = `$${convertido.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  } else {
    // Formato USD
    if (compactar && Math.abs(convertido) >= 1_000_000) {
      texto = `$${(convertido / 1_000_000).toFixed(2)}M`;
    } else if (Math.abs(convertido) >= 1) {
      texto = `$${convertido.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else if (Math.abs(convertido) >= 0.0001) {
      texto = `$${convertido.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
    } else {
      texto = `$${convertido.toFixed(6)}`;
    }
  }

  return mostrarCodigo ? `${texto} ${global}` : texto;
}

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  // Estado de moneda global persistente en localStorage
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
   * Obtiene la tasa de cambio en tiempo real desde Binance USDT/ARS con fallback institucional
   */
  const actualizarTasa = useCallback(async () => {
    setCargandoTasa(true);
    setErrorTasa(null);

    // 1. Intento primario: Binance Public API (ticker USDTARS)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDTARS', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const price = parseFloat(data.price);
        if (!isNaN(price) && price > 0) {
          setTasaCambio(price);
          setUltimaActualizacion(new Date());
          setCargandoTasa(false);
          return;
        }
      }
    } catch (e) {
      console.warn('[CurrencyContext] Binance API timeout/bloqueada, consultando fallback CriptoYa...', e.message);
    }

    // 2. Fallback secundario: CriptoYa Binance USDT/ARS
    try {
      const res = await fetch('https://criptoya.com/api/binance/usdt/ars');
      if (res.ok) {
        const data = await res.json();
        const price = parseFloat(data.ask || data.bid || data.totalAsk);
        if (!isNaN(price) && price > 0) {
          setTasaCambio(price);
          setUltimaActualizacion(new Date());
          setCargandoTasa(false);
          return;
        }
      }
    } catch (e) {
      console.warn('[CurrencyContext] Fallback CriptoYa falló, usando tasa de contingencia institucional:', e.message);
    }

    // 3. Fallback de contingencia garantizado
    setTasaCambio(TASA_DEFAULT_USDT_ARS);
    setUltimaActualizacion(new Date());
    setCargandoTasa(false);
  }, []);

  // Carga inicial al montar la aplicación
  useEffect(() => {
    actualizarTasa();
    // Refresco periódico cada 60 segundos
    const intervalo = setInterval(actualizarTasa, 60000);
    return () => clearInterval(intervalo);
  }, [actualizarTasa]);

  // Función formateadora memorizada y vinculada al estado global
  const formatPrecioBound = useCallback((valor, monedaNativa, opciones) => {
    return formatearPrecio(valor, monedaNativa, monedaGlobal, tasaCambio, opciones);
  }, [monedaGlobal, tasaCambio]);

  const value = useMemo(() => ({
    monedaGlobal,
    setMonedaGlobal,
    toggleMonedaGlobal,
    tasaCambio,
    cargandoTasa,
    errorTasa,
    ultimaActualizacion,
    actualizarTasa,
    formatearPrecio: formatPrecioBound,
    convertirMonto: (v, nativa) => convertirMonto(v, nativa, monedaGlobal, tasaCambio)
  }), [monedaGlobal, setMonedaGlobal, toggleMonedaGlobal, tasaCambio, cargandoTasa, errorTasa, ultimaActualizacion, actualizarTasa, formatPrecioBound]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    // Retorno seguro con valores predeterminados para evitar rupturas fuera del Provider
    return {
      monedaGlobal: 'ARS',
      setMonedaGlobal: () => {},
      toggleMonedaGlobal: () => {},
      tasaCambio: TASA_DEFAULT_USDT_ARS,
      cargandoTasa: false,
      errorTasa: null,
      ultimaActualizacion: null,
      actualizarTasa: () => {},
      formatearPrecio: (v, nativa = 'USD', opts) => formatearPrecio(v, nativa, 'ARS', TASA_DEFAULT_USDT_ARS, opts),
      convertirMonto: (v, nativa = 'USD') => convertirMonto(v, nativa, 'ARS', TASA_DEFAULT_USDT_ARS)
    };
  }
  return context;
}

