/**
 * ==============================================================================
 * CondorFi - Terminal Financiera Institucional Multi-Página (SPA)
 * Archivo: condorfi-ui/src/App.jsx
 * 
 * Arquitectura de Rutas con react-router-dom:
 * - <BrowserRouter>
 *   - <Route path="/" element={<Layout ... />}>
 *     - <Route index element={<Dashboard />} />
 *     - <Route path="cripto" element={<VistaMercado categoria="cripto" />} />
 *     - <Route path="acciones" element={<VistaMercado categoria="acciones" />} />
 *     - <Route path="indices" element={<VistaMercado categoria="indices" />} />
 *     - <Route path="bonos" element={<VistaMercado categoria="bonos" />} />
 *     - <Route path=":categoria" element={<VistaMercado />} />
 * ==============================================================================
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import condorLogo from './assets/condorfi-logo.png';
import { supabase } from './lib/supabase';
import Layout from './layouts/Layout';
import Dashboard from './pages/Dashboard';
import VistaMercado from './pages/VistaMercado';
import Backtesting from './pages/Backtesting';
import { CurrencyProvider } from './context/CurrencyContext';

/**
 * Universo de 41 Activos Iniciales para el Screener (Fallback Instantáneo)
 */
const DATOS_SCREENER_INICIAL = [
  // TOP CRIPTOACTIVOS (20)
  {
    activo: 'ETH',
    nombre: 'Ethereum',
    mercado: 'Cripto ARS',
    tipoMercado: 'cripto',
    moneda: 'ARS',
    precioActual: 3913229,
    precioApertura: 3974200,
    variacion24h: -1.54,
    spreadActual: -1.54,
    exchangeCompra: 'Fiwind',
    exchangeVenta: 'Binance P2P',
    condorScore: 99,
    dictamen: 'STRONG_BUY',
    rsi: 40.9,
    macd: { macd: 338.9, signal: 210.4, histogram: 128.5, cruceAlcista: true, cruceBajista: false },
    bollinger: { sma: 3950000, upper: 4080000, lower: 3820000, bandwidth: 6.58, percentB: 0.36, tocaInferior: false, tocaSuperior: false },
    mensaje: 'Setup de compra detectado en zona de descuento (%B: 0.36). Cruce alcista de MACD.'
  },
  {
    activo: 'XRP',
    nombre: 'XRP (Ripple)',
    mercado: 'Cripto ARS',
    tipoMercado: 'cripto',
    moneda: 'ARS',
    precioActual: 2138,
    precioApertura: 2175,
    variacion24h: -1.73,
    spreadActual: -1.73,
    exchangeCompra: 'Binance P2P',
    exchangeVenta: 'Fiwind',
    condorScore: 99,
    dictamen: 'STRONG_BUY',
    rsi: 40.1,
    macd: { macd: 0.23, signal: 0.15, histogram: 0.08, cruceAlcista: true, cruceBajista: false },
    bollinger: { sma: 2160, upper: 2240, lower: 2080, bandwidth: 7.41, percentB: 0.36, tocaInferior: false, tocaSuperior: false },
    mensaje: 'Fuerte soporte intradiario con histograma MACD expandiéndose positivamente.'
  },
  {
    activo: 'LTC',
    nombre: 'Litecoin',
    mercado: 'Cripto ARS',
    tipoMercado: 'cripto',
    moneda: 'ARS',
    precioActual: 95863,
    precioApertura: 99480,
    variacion24h: -3.64,
    spreadActual: -3.64,
    exchangeCompra: 'Fiwind',
    exchangeVenta: 'Binance P2P',
    condorScore: 79,
    dictamen: 'BUY',
    rsi: 39.3,
    macd: { macd: -75.6, signal: -110.2, histogram: 34.6, cruceAlcista: true, cruceBajista: false },
    bollinger: { sma: 97500, upper: 102000, lower: 93000, bandwidth: 9.23, percentB: 0.32, tocaInferior: false, tocaSuperior: false },
    mensaje: 'RSI en zona de sobreventa intradiaria con rebote técnico incipiente.'
  },
  {
    activo: 'BTC',
    nombre: 'Bitcoin',
    mercado: 'Cripto ARS',
    tipoMercado: 'cripto',
    moneda: 'ARS',
    precioActual: 131762650,
    precioApertura: 133420000,
    variacion24h: -1.24,
    spreadActual: 0.85,
    exchangeCompra: 'SatoshiTango',
    exchangeVenta: 'Fiwind',
    condorScore: 65,
    dictamen: 'BUY',
    rsi: 43.1,
    macd: { macd: 9207.2, signal: 8100.0, histogram: 1107.2, cruceAlcista: false, cruceBajista: false },
    bollinger: { sma: 132500000, upper: 136000000, lower: 129000000, bandwidth: 5.28, percentB: 0.39, tocaInferior: false, tocaSuperior: false },
    mensaje: 'Consolidación institucional sobre soporte dinámico SMA 20.'
  },
  {
    activo: 'USDT',
    nombre: 'Tether USD',
    mercado: 'Cripto ARS',
    tipoMercado: 'cripto',
    moneda: 'ARS',
    precioActual: 1610.73,
    precioApertura: 1597.50,
    variacion24h: 0.83,
    spreadActual: 0.92,
    exchangeCompra: 'Weexp2p',
    exchangeVenta: 'Binance P2P',
    condorScore: 75,
    dictamen: 'BUY',
    rsi: 45.2,
    macd: { macd: 2.1, signal: 1.4, histogram: 0.7, cruceAlcista: true, cruceBajista: false },
    bollinger: { sma: 1605, upper: 1625, lower: 1585, bandwidth: 2.49, percentB: 0.64, tocaInferior: false, tocaSuperior: false },
    mensaje: 'Spread neto rentable entre plataformas P2P descontadas comisiones.'
  },
  {
    activo: 'SOL',
    nombre: 'Solana',
    mercado: 'Cripto ARS',
    tipoMercado: 'cripto',
    moneda: 'ARS',
    precioActual: 167662,
    precioApertura: 170610,
    variacion24h: -1.73,
    spreadActual: -1.73,
    exchangeCompra: 'Fiwind',
    exchangeVenta: 'Binance P2P',
    condorScore: 45,
    dictamen: 'HOLD',
    rsi: 43.2,
    macd: { macd: -9.9, signal: -5.2, histogram: -4.7, cruceAlcista: false, cruceBajista: false },
    bollinger: { sma: 169000, upper: 175000, lower: 163000, bandwidth: 7.10, percentB: 0.39, tocaInferior: false, tocaSuperior: false },
    mensaje: 'Rango lateral a la espera de confirmación de volumen.'
  },

  // TRADFI GLOBAL: WALL STREET ÍNDICES Y TECH
  {
    activo: 'QQQ',
    nombre: 'Invesco QQQ (Nasdaq 100)',
    mercado: 'NASDAQ',
    tipoMercado: 'tradfi',
    moneda: 'USD',
    precioActual: 727.02,
    precioApertura: 738.00,
    variacion24h: -1.49,
    condorScore: 90,
    dictamen: 'STRONG_BUY',
    rsi: 19.8,
    macd: { macd: -0.96, signal: -0.45, histogram: -0.51, cruceAlcista: false, cruceBajista: false },
    bollinger: { sma: 735.00, upper: 748.00, lower: 722.00, bandwidth: 3.54, percentB: 0.19, tocaInferior: false, tocaSuperior: false },
    mensaje: 'RSI en sobreventa extrema (19.8). Alta probabilidad estadística de reversión a la media.'
  },
  {
    activo: 'SPY',
    nombre: 'S&P 500 ETF Trust',
    mercado: 'NYSE Arca',
    tipoMercado: 'tradfi',
    moneda: 'USD',
    precioActual: 767.25,
    precioApertura: 774.92,
    variacion24h: -0.99,
    condorScore: 90,
    dictamen: 'STRONG_BUY',
    rsi: 20.4,
    macd: { macd: -0.64, signal: -0.32, histogram: -0.32, cruceAlcista: false, cruceBajista: false },
    bollinger: { sma: 772.00, upper: 782.00, lower: 762.00, bandwidth: 2.59, percentB: 0.26, tocaInferior: false, tocaSuperior: false },
    mensaje: 'ETF de referencia tocando soporte institucional con sobreventa en 14 períodos.'
  },
  {
    activo: '^MERV',
    nombre: 'S&P Merval Argentina',
    mercado: 'BYMA',
    tipoMercado: 'tradfi',
    moneda: 'ARS',
    precioActual: 2850830,
    precioApertura: 2869151,
    variacion24h: -0.64,
    condorScore: 49,
    dictamen: 'HOLD',
    rsi: 34.8,
    macd: { macd: -782.4, signal: -520.1, histogram: -262.3, cruceAlcista: false, cruceBajista: false },
    bollinger: { sma: 2875000, upper: 2920000, lower: 2830000, bandwidth: 3.13, percentB: 0.23, tocaInferior: false, tocaSuperior: false },
    mensaje: 'Índice bursátil argentino en compresión de volatilidad.'
  },
  {
    activo: 'DIA',
    nombre: 'SPDR Dow Jones Industrial',
    mercado: 'NYSE Arca',
    tipoMercado: 'tradfi',
    moneda: 'USD',
    precioActual: 513.80,
    precioApertura: 515.39,
    variacion24h: -0.31,
    condorScore: 55,
    dictamen: 'HOLD',
    rsi: 48.2,
    macd: { macd: 0.12, signal: 0.08, histogram: 0.04, cruceAlcista: false, cruceBajista: false },
    bollinger: { sma: 514.50, upper: 519.00, lower: 510.00, bandwidth: 1.75, percentB: 0.42, tocaInferior: false, tocaSuperior: false },
    mensaje: 'Índice de 30 gigantes industriales con baja volatilidad.'
  },
  {
    activo: 'IWM',
    nombre: 'iShares Russell 2000 ETF',
    mercado: 'NYSE Arca',
    tipoMercado: 'tradfi',
    moneda: 'USD',
    precioActual: 270.44,
    precioApertura: 273.36,
    variacion24h: -1.07,
    condorScore: 52,
    dictamen: 'HOLD',
    rsi: 42.1,
    macd: { macd: -0.22, signal: -0.15, histogram: -0.07, cruceAlcista: false, cruceBajista: false },
    bollinger: { sma: 272.00, upper: 277.00, lower: 267.00, bandwidth: 3.68, percentB: 0.34, tocaInferior: false, tocaSuperior: false },
    mensaje: 'Pequeñas y medianas empresas estadounidenses en rango de consolidación.'
  },
  {
    activo: 'AAPL',
    nombre: 'Apple Inc.',
    mercado: 'NASDAQ',
    tipoMercado: 'tradfi',
    moneda: 'USD',
    precioActual: 343.14,
    precioApertura: 344.61,
    variacion24h: -0.43,
    condorScore: 35,
    dictamen: 'SELL',
    rsi: 46.0,
    macd: { macd: -0.09, signal: 0.05, histogram: -0.14, cruceAlcista: false, cruceBajista: true },
    bollinger: { sma: 345.50, upper: 352.00, lower: 339.00, bandwidth: 3.76, percentB: 0.32, tocaInferior: false, tocaSuperior: false },
    mensaje: 'Cruce bajista en MACD con pérdida de impulso en zona media.'
  },
  {
    activo: 'NVDA',
    nombre: 'NVIDIA Corporation',
    mercado: 'NASDAQ',
    tipoMercado: 'tradfi',
    moneda: 'USD',
    precioActual: 220.13,
    precioApertura: 225.60,
    variacion24h: -2.43,
    condorScore: 68,
    dictamen: 'BUY',
    rsi: 38.5,
    macd: { macd: 1.25, signal: 1.80, histogram: -0.55, cruceAlcista: false, cruceBajista: false },
    bollinger: { sma: 224.00, upper: 232.00, lower: 216.00, bandwidth: 7.14, percentB: 0.26, tocaInferior: false, tocaSuperior: false },
    mensaje: 'Corrección técnica sobre soporte relevante de chips e IA.'
  },
  {
    activo: 'MSFT',
    nombre: 'Microsoft Corporation',
    mercado: 'NASDAQ',
    tipoMercado: 'tradfi',
    moneda: 'USD',
    precioActual: 532.79,
    precioApertura: 545.15,
    variacion24h: -2.27,
    condorScore: 50,
    dictamen: 'HOLD',
    rsi: 41.2,
    macd: { macd: -1.10, signal: -0.80, histogram: -0.30, cruceAlcista: false, cruceBajista: false },
    bollinger: { sma: 540.00, upper: 552.00, lower: 528.00, bandwidth: 4.44, percentB: 0.20, tocaInferior: false, tocaSuperior: false },
    mensaje: 'Presión vendedora institucional contenida en banda inferior.'
  },
  {
    activo: 'GGAL.BA',
    nombre: 'Grupo Financiero Galicia',
    mercado: 'BYMA',
    tipoMercado: 'tradfi',
    moneda: 'ARS',
    precioActual: 5795,
    precioApertura: 5935,
    variacion24h: -2.36,
    condorScore: 65,
    dictamen: 'BUY',
    rsi: 44.5,
    macd: { macd: 25, signal: 18, histogram: 7, cruceAlcista: true, cruceBajista: false },
    bollinger: { sma: 5880, upper: 6050, lower: 5710, bandwidth: 5.78, percentB: 0.25, tocaInferior: false, tocaSuperior: false },
    mensaje: 'Sector bancario argentino mostrando divergencias alcistas.'
  },
  {
    activo: 'YPFD.BA',
    nombre: 'YPF Sociedad Anónima',
    mercado: 'BYMA',
    tipoMercado: 'tradfi',
    moneda: 'ARS',
    precioActual: 34100,
    precioApertura: 34500,
    variacion24h: -1.16,
    condorScore: 58,
    dictamen: 'HOLD',
    rsi: 48.0,
    macd: { macd: 110, signal: 95, histogram: 15, cruceAlcista: false, cruceBajista: false },
    bollinger: { sma: 34300, upper: 35100, lower: 33500, bandwidth: 4.66, percentB: 0.38, tocaInferior: false, tocaSuperior: false },
    mensaje: 'Empresa energética con flujo comprador en BYMA.'
  },
  {
    activo: 'PAMP.BA',
    nombre: 'Pampa Energía S.A.',
    mercado: 'BYMA',
    tipoMercado: 'tradfi',
    moneda: 'ARS',
    precioActual: 3090,
    precioApertura: 3120,
    variacion24h: -0.96,
    condorScore: 54,
    dictamen: 'HOLD',
    rsi: 49.2,
    macd: { macd: 12, signal: 10, histogram: 2, cruceAlcista: false, cruceBajista: false },
    bollinger: { sma: 3105, upper: 3180, lower: 3030, bandwidth: 4.83, percentB: 0.40, tocaInferior: false, tocaSuperior: false },
    mensaje: 'Estabilidad en generación eléctrica y paridad tarifaria.'
  },

  // RENTA FIJA & BONOS SOBERANOS
  {
    activo: 'AL30.BA',
    nombre: 'Bono Bonar 2030 Ley Arg',
    mercado: 'BYMA',
    tipoMercado: 'tradfi',
    moneda: 'ARS',
    precioActual: 726,
    precioApertura: 721.5,
    variacion24h: 0.62,
    condorScore: 78,
    dictamen: 'BUY',
    rsi: 54.2,
    macd: { macd: 3.5, signal: 2.1, histogram: 1.4, cruceAlcista: true, cruceBajista: false },
    bollinger: { sma: 720, upper: 735, lower: 705, bandwidth: 4.17, percentB: 0.70, tocaInferior: false, tocaSuperior: false },
    mensaje: 'Curva soberana argentina en dólares con compresión de spreads.'
  },
  {
    activo: 'GD30.BA',
    nombre: 'Bono Global 2030 Ley NY',
    mercado: 'BYMA',
    tipoMercado: 'tradfi',
    moneda: 'ARS',
    precioActual: 752,
    precioApertura: 747.5,
    variacion24h: 0.60,
    condorScore: 76,
    dictamen: 'BUY',
    rsi: 53.8,
    macd: { macd: 3.2, signal: 2.0, histogram: 1.2, cruceAlcista: true, cruceBajista: false },
    bollinger: { sma: 746, upper: 762, lower: 730, bandwidth: 4.29, percentB: 0.69, tocaInferior: false, tocaSuperior: false },
    mensaje: 'Bono bajo ley extranjera con demanda de fondos de mercados emergentes.'
  },
  {
    activo: 'TLT',
    nombre: 'iShares 20+ Year Treasury ETF',
    mercado: 'NASDAQ',
    tipoMercado: 'tradfi',
    moneda: 'USD',
    precioActual: 78.90,
    precioApertura: 77.82,
    variacion24h: 1.38,
    condorScore: 65,
    dictamen: 'BUY',
    rsi: 48.5,
    macd: { macd: 0.05, signal: 0.02, histogram: 0.03, cruceAlcista: true, cruceBajista: false },
    bollinger: { sma: 78.20, upper: 79.50, lower: 76.90, bandwidth: 3.32, percentB: 0.77, tocaInferior: false, tocaSuperior: false },
    mensaje: 'Curva de bonos del Tesoro de EE.UU. rebotando ante expectativas de tasas de la Fed.'
  }
];

function reproducirDingSonoro() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const oscilador = ctx.createOscillator();
    const ganancia = ctx.createGain();
    const ahora = ctx.currentTime;
    oscilador.type = 'sine';
    oscilador.frequency.setValueAtTime(880, ahora);
    oscilador.frequency.exponentialRampToValueAtTime(1320, ahora + 0.08);
    ganancia.gain.setValueAtTime(0.0001, ahora);
    ganancia.gain.linearRampToValueAtTime(0.28, ahora + 0.02);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.55);
    oscilador.connect(ganancia);
    ganancia.connect(ctx.destination);
    oscilador.start(ahora);
    oscilador.stop(ahora + 0.6);
    setTimeout(() => { ctx.close().catch(() => {}); }, 1000);
  } catch (err) {
    console.warn('[Audio] Error al reproducir ding:', err);
  }
}

async function solicitarPermisoNotificaciones() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

export default function App() {
  const [estaActualizando, setEstaActualizando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState('Iniciando...');
  const [registrosCompletos, setRegistrosCompletos] = useState([]);
  const [registrosTradfi, setRegistrosTradfi] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [datosScreener, setDatosScreener] = useState(DATOS_SCREENER_INICIAL);
  const [ejecutandoInsight, setEjecutandoInsight] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [conectadoSupabase, setConectadoSupabase] = useState(false);

  // Sistema de Alertas Sonoras y Push Notifications
  const [alertasHabilitadas, setAlertasHabilitadas] = useState(false);
  const ultimaAlertaRef = useRef(null);

  const toggleAlertas = async () => {
    if (!alertasHabilitadas) {
      const permisoConcedido = await solicitarPermisoNotificaciones();
      setAlertasHabilitadas(true);
      reproducirDingSonoro();

      if (permisoConcedido) {
        try {
          new Notification('CondorFi: Radar de Alertas Activo', {
            body: 'Recibirás sonido y notificaciones push cuando se detecte arbitraje o anomalías cuantitativas.',
            icon: condorLogo
          });
        } catch (e) {
          console.warn('[Push] Notificación de bienvenida:', e);
        }
      }
    } else {
      setAlertasHabilitadas(false);
      ultimaAlertaRef.current = null;
    }
  };

  // Consulta reactiva a Supabase para capturar cotizaciones reales
  const fetchCotizacionesReales = useCallback(async () => {
    setEstaActualizando(true);

    if (!supabase) {
      setConectadoSupabase(false);
      setUltimaSincronizacion('Modo Simulación (Sin credenciales)');
      setCargando(false);
      setEstaActualizando(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('cotizaciones_historicas')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(2000);

      if (error) throw error;

      setConectadoSupabase(true);

      if (data && data.length > 0) {
        setRegistrosCompletos(data);
        setUltimaSincronizacion(
          new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
      } else {
        setUltimaSincronizacion('Tabla vacía');
        setRegistrosCompletos([]);
      }

      // Consulta de cotizaciones TradFi (mercado tradicional: acciones e índices)
      try {
        const { data: dataTradfi, error: errTradfi } = await supabase
          .from('cotizaciones_tradfi')
          .select('*')
          .order('id', { ascending: false })
          .limit(1000);

        if (!errTradfi && dataTradfi && dataTradfi.length > 0) {
          setRegistrosTradfi(dataTradfi);
        }
      } catch (eTradfi) {
        console.warn('[TradFi] Aviso al consultar cotizaciones_tradfi:', eTradfi);
      }

      // Consulta de Alertas Quants desde alertas_mercado
      try {
        const { data: dataAlertas, error: errAlertas } = await supabase
          .from('alertas_mercado')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(10);

        if (!errAlertas && dataAlertas) {
          setAlertas(dataAlertas);
        }
      } catch (eAlertas) {
        console.warn('[Alertas] Aviso al consultar alertas_mercado:', eAlertas);
      }
    } catch (err) {
      console.error('Error al consultar Supabase:', err);
      setConectadoSupabase(false);
      setUltimaSincronizacion('Error de conexión');
    } finally {
      setCargando(false);
      setEstaActualizando(false);
    }
  }, []);

  // Disparador del Screener Cuantitativo (/api/generar-insights)
  const ejecutarAnalisisScreener = useCallback(async () => {
    setEjecutandoInsight(true);
    try {
      const res = await fetch('/api/generar-insights?mercado=multimercado');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.screener) && data.screener.length > 0) {
          setDatosScreener(data.screener);
        }
      }
      if (supabase) {
        const { data: dataAlertas } = await supabase
          .from('alertas_mercado')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(10);
        if (dataAlertas && dataAlertas.length > 0) {
          setAlertas(dataAlertas);
        }
      }
    } catch (err) {
      console.warn('[Terminal] Error al consultar /api/generar-insights:', err);
    } finally {
      setEjecutandoInsight(false);
    }
  }, []);

  useEffect(() => {
    fetchCotizacionesReales();
    ejecutarAnalisisScreener();
  }, [fetchCotizacionesReales, ejecutarAnalisisScreener]);

  // Exportación nativa a CSV
  const descargarHistorialCSV = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      let registrosAExportar = [];

      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('cotizaciones_historicas')
            .select('timestamp, moneda, exchange_compra, exchange_venta, exchange, precio_compra, precio_venta, spread')
            .order('timestamp', { ascending: false })
            .limit(1000);

          if (!error && data && data.length > 0) {
            registrosAExportar = data;
          }
        } catch (e) {
          console.warn('[CSV Export] Aviso al consultar Supabase:', e);
        }
      }

      if (registrosAExportar.length === 0) {
        registrosAExportar = registrosCompletos;
      }

      if (registrosAExportar.length === 0) {
        alert('No hay cotizaciones disponibles para exportar en este momento.');
        return;
      }

      const encabezados = ['timestamp', 'moneda', 'exchange_compra', 'exchange_venta', 'spread'];
      const escapar = val => {
        const str = String(val ?? '');
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      };

      const filasCSV = registrosAExportar.map(r => {
        const timestamp = r.timestamp || new Date().toISOString();
        const moneda = r.moneda || 'USDT';
        let exCompra = r.exchange_compra || r.exchange || 'N/A';
        let exVenta = r.exchange_venta || r.exchange || 'N/A';
        let spreadValor = typeof r.spread === 'number' ? r.spread : 0;
        return [
          escapar(timestamp),
          escapar(moneda),
          escapar(exCompra),
          escapar(exVenta),
          escapar(spreadValor.toFixed(4))
        ].join(',');
      });

      const contenidoCSV = [encabezados.join(','), ...filasCSV].join('\r\n');
      const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      const fechaHoy = new Date().toISOString().split('T')[0];
      enlace.setAttribute('href', url);
      enlace.setAttribute('download', `condorfi_export_${fechaHoy}.csv`);
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al generar archivo CSV:', err);
      alert('Ocurrió un error al intentar exportar el archivo CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  // Contexto unificado que se propaga a todas las páginas vía Outlet context
  const outletContext = {
    datosScreener,
    registrosTradfi,
    registrosCompletos,
    alertas,
    conectadoSupabase,
    alertasHabilitadas,
    estaActualizando,
    ultimaSincronizacion,
    ejecutandoInsight,
    isExporting,
    onEjecutarAnalisis: ejecutarAnalisisScreener,
    onExportarCSV: descargarHistorialCSV,
    fetchCotizacionesReales
  };

  return (
    <CurrencyProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <Layout
                conectadoSupabase={conectadoSupabase}
                alertasHabilitadas={alertasHabilitadas}
                toggleAlertas={toggleAlertas}
                fetchCotizacionesReales={fetchCotizacionesReales}
                estaActualizando={estaActualizando}
                ultimaSincronizacion={ultimaSincronizacion}
                outletContext={outletContext}
              />
            }
          >
            {/* 1. Dashboard (Resumen General) */}
            <Route index element={<Dashboard />} />

            {/* 2. Vistas Dedicadas de Mercado */}
            <Route path="cripto" element={<VistaMercado categoria="cripto" />} />
            <Route path="acciones" element={<VistaMercado categoria="acciones" />} />
            <Route path="indices" element={<VistaMercado categoria="indices" />} />
            <Route path="bonos" element={<VistaMercado categoria="bonos" />} />

            {/* 3. Motor de Backtesting Institucional */}
            <Route path="backtesting" element={<Backtesting />} />
            <Route path="backtest" element={<Backtesting />} />

            {/* 4. Ruta dinámica para cualquier otra categoría */}
            <Route path=":categoria" element={<VistaMercado />} />

            {/* 5. Fallback a la raíz */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </CurrencyProvider>
  );
}
