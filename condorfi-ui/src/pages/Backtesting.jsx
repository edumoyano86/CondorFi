/**
 * ==============================================================================
 * CondorFi - Vista de Backtesting Cuantitativo Institucional
 * Archivo: condorfi-ui/src/pages/Backtesting.jsx
 * 
 * Funcionalidades:
 * - Panel de Control: Selección de activo, mercado, período (1y/2y) y capital inicial.
 * - Simulación serverless sin sesgo de anticipación (/api/backtest).
 * - KPI Dashboard: ROI Neto (%), Win Rate (%), Max Drawdown (%), Total Trades, Alpha.
 * - Visualización Quant con TradingView lightweight-charts:
 *   Velas diarias históricas + Markers interactivos (flechas de COMPRA y VENTA).
 * - Curva de Equity acumulada y Drawdown en el tiempo.
 * - Tabla auditora de Trades ejecutados con PnL ($ / %) y duración.
 * ==============================================================================
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
  createSeriesMarkers
} from 'lightweight-charts';
import { useCurrency, convertirMonto } from '../context/CurrencyContext';
import { supabase } from '../lib/supabase';
import {
  FlaskConical,
  Play,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  DollarSign,
  Percent,
  BarChart2,
  Sparkles,
  RefreshCw,
  Sliders,
  Activity,
  Layers,
  Info,
  Maximize2
} from 'lucide-react';

const ACTIVOS_PREDETERMINADOS = [
  // TradFi Global
  { ticker: 'SPY',     nombre: 'S&P 500 ETF',       mercado: 'tradfi', categoria: 'Wall Street' },
  { ticker: 'QQQ',     nombre: 'Invesco Nasdaq 100', mercado: 'tradfi', categoria: 'Wall Street' },
  { ticker: 'AAPL',    nombre: 'Apple Inc.',         mercado: 'tradfi', categoria: 'Wall Street' },
  { ticker: 'NVDA',    nombre: 'NVIDIA Corp',        mercado: 'tradfi', categoria: 'Wall Street' },
  { ticker: 'V',       nombre: 'Visa Inc.',          mercado: 'tradfi', categoria: 'Wall Street' },
  { ticker: 'KO',      nombre: 'Coca-Cola',          mercado: 'tradfi', categoria: 'Wall Street' },
  { ticker: 'TLT',     nombre: 'Treasury 20Y ETF',   mercado: 'tradfi', categoria: 'Wall Street' },

  // Merval, CEDEARs & Bonos
  { ticker: '^MERV',   nombre: 'S&P Merval Arg',    mercado: 'tradfi', categoria: 'Argentina' },
  { ticker: 'MELI',    nombre: 'MercadoLibre',      mercado: 'tradfi', categoria: 'Argentina' },
  { ticker: 'GGAL.BA', nombre: 'Grupo Fin. Galicia', mercado: 'tradfi', categoria: 'Argentina' },
  { ticker: 'BMA.BA',  nombre: 'Banco Macro',       mercado: 'tradfi', categoria: 'Argentina' },
  { ticker: 'YPFD.BA', nombre: 'YPF S.A.',          mercado: 'tradfi', categoria: 'Argentina' },
  { ticker: 'AL30.BA', nombre: 'Bonar 2030',        mercado: 'tradfi', categoria: 'Argentina' },

  // Criptoactivos
  { ticker: 'BTC',     nombre: 'Bitcoin',           mercado: 'cripto', categoria: 'Criptomonedas' },
  { ticker: 'ETH',     nombre: 'Ethereum',          mercado: 'cripto', categoria: 'Criptomonedas' },
  { ticker: 'SOL',     nombre: 'Solana',            mercado: 'cripto', categoria: 'Criptomonedas' },
  { ticker: 'SUI',     nombre: 'Sui Network',       mercado: 'cripto', categoria: 'Criptomonedas' },
  { ticker: 'TON',     nombre: 'Toncoin',           mercado: 'cripto', categoria: 'Criptomonedas' },
  { ticker: 'XRP',     nombre: 'XRP Ripple',        mercado: 'cripto', categoria: 'Criptomonedas' }
];

export default function Backtesting() {
  // Motor Multidivisa Global (ARS / USD)
  const { monedaGlobal, tasaCambio, formatearPrecio: formatPrecioCurrency } = useCurrency();

  // Estado del Formulario
  const [tickerSeleccionado, setTickerSeleccionado] = useState('SPY');
  const [mercado, setMercado] = useState('tradfi');
  const [periodo, setPeriodo] = useState('1y');
  const [capitalInicial, setCapitalInicial] = useState(10000);
  const [tickerPersonalizado, setTickerPersonalizado] = useState('');

  // Parámetros Cuantitativos Dinámicos (Walk-Forward Strategy)
  const [buyThreshold, setBuyThreshold] = useState(80);
  const [sellThreshold, setSellThreshold] = useState(40);

  // Integración de Estrategias Personalizadas (Sprint 2 - Visual Query Builder)
  const [estrategiasDisponibles, setEstrategiasDisponibles] = useState([]);
  const [estrategiaSeleccionadaId, setEstrategiaSeleccionadaId] = useState('base'); // 'base' | string/number id

  // Estado de Ejecución y Resultados
  const [cargando, setCargando] = useState(false);
  const [errorSimulacion, setErrorSimulacion] = useState(null);
  const [resultadoBacktest, setResultadoBacktest] = useState(null);
  const [vistaGrafico, setVistaGrafico] = useState('velas'); // 'velas' | 'equity'

  // HUD de Crosshair interactivo
  const [hudVela, setHudVela] = useState(null);

  // Carga de Estrategias Personalizadas (LocalStorage + Supabase)
  useEffect(() => {
    async function cargarEstrategias() {
      let lista = [];
      try {
        const guardadas = localStorage.getItem('condorfi_estrategias_personalizadas');
        if (guardadas) {
          lista = JSON.parse(guardadas);
        }
      } catch (errLocal) {
        console.warn('[Backtesting] Error leyendo estrategias locales:', errLocal);
      }

      if (lista.length === 0 && supabase) {
        try {
          const { data } = await supabase.from('estrategias_personalizadas').select('*');
          if (data && data.length > 0) lista = data;
        } catch (errDb) {
          console.warn('[Backtesting] Supabase offline o sin tablas:', errDb.message);
        }
      }

      setEstrategiasDisponibles(lista);
      const activa = lista.find(e => e.activa);
      if (activa) {
        setEstrategiaSeleccionadaId(String(activa.id));
      }
    }
    cargarEstrategias();
  }, []);

  // Referencias para el gráfico TradingView
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const candlestickSeriesRef = useRef(null);
  const markersRef = useRef(null);

  /**
   * Al cambiar de preset de activo, sincroniza automáticamente el mercado
   */
  const handleSeleccionarPreset = (preset) => {
    setTickerSeleccionado(preset.ticker);
    setMercado(preset.mercado);
    setTickerPersonalizado('');
  };

  /**
   * Ejecuta la simulación en el microservicio backend enviando parámetros dinámicos por req.body
   */
  const ejecutarSimulacion = useCallback(async () => {
    const tickerFinal = (tickerPersonalizado.trim() || tickerSeleccionado).toUpperCase();
    if (!tickerFinal) return;

    setCargando(true);
    setErrorSimulacion(null);

    try {
      const estrategiaElegida = estrategiaSeleccionadaId !== 'base'
        ? estrategiasDisponibles.find(e => String(e.id) === String(estrategiaSeleccionadaId))
        : null;

      const payload = {
        ticker: tickerFinal,
        mercado,
        periodo,
        capital_inicial: capitalInicial,
        buy_threshold: buyThreshold,
        sell_threshold: sellThreshold,
        estrategia: estrategiaElegida || undefined
      };

      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Error en la simulación cuantitativa');
      }

      setResultadoBacktest(data);
    } catch (err) {
      console.error('[Backtesting] Error ejecutando prueba:', err);
      setErrorSimulacion(err.message || 'Fallo de conexión con el motor de backtesting');
    } finally {
      setCargando(false);
    }
  }, [tickerSeleccionado, tickerPersonalizado, mercado, periodo, capitalInicial, buyThreshold, sellThreshold, estrategiaSeleccionadaId, estrategiasDisponibles]);

  // Ejecución inicial automática (SPY 1 año)
  useEffect(() => {
    ejecutarSimulacion();
  }, []);

  /**
   * Renderizado e inyección del gráfico TradingView lightweight-charts
   */
  useEffect(() => {
    if (!chartContainerRef.current || !resultadoBacktest || !resultadoBacktest.velas) {
      return;
    }

    // Limpiar gráfico anterior si existe
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const container = chartContainerRef.current;
    const width = container.clientWidth || 800;
    const height = 480;

    // Crear instancia de Chart con tema Dark Institucional
    const chart = createChart(container, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#090d16' },
        textColor: '#94a3b8',
        fontSize: 12,
        fontFamily: 'Inter, system-ui, sans-serif'
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.45)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.45)' }
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#38bdf8',
          width: 1,
          style: 2,
          labelBackgroundColor: '#0369a1'
        },
        horzLine: {
          color: '#38bdf8',
          width: 1,
          style: 2,
          labelBackgroundColor: '#0369a1'
        }
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: {
          top: 0.15,
          bottom: 0.15
        }
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true
      }
    });

    chartInstanceRef.current = chart;

    if (vistaGrafico === 'velas') {
      // 1. Serie de Velas Japonesas
      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#10b981',           // Emerald
        downColor: '#ef4444',         // Rose
        borderVisible: true,
        borderUpColor: '#059669',
        borderDownColor: '#dc2626',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444'
      });

      candlestickSeriesRef.current = candlestickSeries;

      const velasConvertidas = (resultadoBacktest.velas || []).map(v => ({
        time: v.time,
        open: Number(convertirMonto(v.open, 'USD', monedaGlobal, tasaCambio).toFixed(monedaGlobal === 'ARS' ? 0 : 2)),
        high: Number(convertirMonto(v.high, 'USD', monedaGlobal, tasaCambio).toFixed(monedaGlobal === 'ARS' ? 0 : 2)),
        low: Number(convertirMonto(v.low, 'USD', monedaGlobal, tasaCambio).toFixed(monedaGlobal === 'ARS' ? 0 : 2)),
        close: Number(convertirMonto(v.close, 'USD', monedaGlobal, tasaCambio).toFixed(monedaGlobal === 'ARS' ? 0 : 2))
      }));

      candlestickSeries.setData(velasConvertidas);

      // Inyección de Markers de Compra y Venta (Fase 1 y 2)
      if (resultadoBacktest.markers && resultadoBacktest.markers.length > 0) {
        if (typeof createSeriesMarkers === 'function') {
          createSeriesMarkers(candlestickSeries, resultadoBacktest.markers);
        } else if (typeof candlestickSeries.setMarkers === 'function') {
          candlestickSeries.setMarkers(resultadoBacktest.markers);
        }
      }

      // HUD inicial con la última vela
      const ultVela = velasConvertidas[velasConvertidas.length - 1] || resultadoBacktest.velas[resultadoBacktest.velas.length - 1];
      setHudVela(ultVela);

      // Suscripción al movimiento del cursor para HUD
      chart.subscribeCrosshairMove((param) => {
        if (!param || !param.time) {
          setHudVela(ultVela);
          return;
        }
        const candleData = param.seriesData?.get(candlestickSeries);
        if (candleData) {
          setHudVela({
            time: param.time,
            open: candleData.open,
            high: candleData.high,
            low: candleData.low,
            close: candleData.close
          });
        }
      });
    } else {
      // 2. Vista de Curva de Equity del Portafolio
      const equitySeries = chart.addSeries(LineSeries, {
        color: '#38bdf8',
        lineWidth: 2.5,
        priceFormat: {
          type: 'price',
          precision: monedaGlobal === 'ARS' ? 0 : 2,
          minMove: monedaGlobal === 'ARS' ? 1 : 0.01
        }
      });

      const equityData = (resultadoBacktest.curvaEquity || []).map(p => ({
        time: p.time,
        value: Number(convertirMonto(p.equity, 'USD', monedaGlobal, tasaCambio).toFixed(monedaGlobal === 'ARS' ? 0 : 2))
      }));

      equitySeries.setData(equityData);

      // Suscripción a HUD de Equity
      chart.subscribeCrosshairMove((param) => {
        if (!param || !param.time) return;
        const val = param.seriesData?.get(equitySeries);
        if (val) {
          setHudVela({
            time: param.time,
            close: val.value,
            isEquity: true
          });
        }
      });
    }

    chart.timeScale().fitContent();

    // Redimensionamiento dinámico
    const handleResize = () => {
      if (chartContainerRef.current && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
      }
    };
  }, [resultadoBacktest, vistaGrafico, monedaGlobal, tasaCambio]);

  const metricas = resultadoBacktest?.metricas || null;
  const operaciones = resultadoBacktest?.historialOperaciones || [];

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header de Vista & Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-900/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-indigo-400" />
                Quant Lab Institucional
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Sin Look-Ahead Bias
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Motor de Backtesting Cuantitativo
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Simulación walk-forward del algoritmo institucional CondorScore sobre 1 a 2 años de velas diarias reales.
              Valida matemáticamente la rentabilidad neta, win rate y drawdown de cada activo.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-xs text-slate-400 block">Reglas de Trading</span>
              <span className="text-xs font-mono font-medium text-emerald-400">Score &ge; 80 Compra</span>
              <span className="text-xs font-mono text-slate-500 mx-1">|</span>
              <span className="text-xs font-mono font-medium text-rose-400">Score &le; 40 Venta</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Panel de Control y Parámetros */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">Configuración del Experimento Quant</h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">Modo: Walk-Forward Causal</span>
        </div>

        {/* Selector de Presets Populares */}
        <div className="mb-4">
          <label className="text-xs font-medium text-slate-400 block mb-2">
            Activos Preconfigurados (TradFi & Cripto)
          </label>
          <div className="flex flex-wrap gap-2">
            {ACTIVOS_PREDETERMINADOS.map((p) => {
              const activo = tickerSeleccionado === p.ticker && !tickerPersonalizado;
              return (
                <button
                  key={p.ticker}
                  type="button"
                  onClick={() => handleSeleccionarPreset(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 border ${
                    activo
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700/60 hover:bg-slate-700/80 hover:text-white'
                  }`}
                >
                  <span className="font-mono">{p.ticker}</span>
                  <span className={`text-[10px] px-1 py-0.2 rounded ${
                    p.mercado === 'cripto' ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'
                  }`}>
                    {p.mercado === 'cripto' ? 'Cripto' : 'TradFi'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Formulario de Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2 border-t border-slate-800/80">
          {/* Ticker / Activo personalizado */}
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">
              Ticker o Símbolo
            </label>
            <input
              type="text"
              value={tickerPersonalizado || tickerSeleccionado}
              onChange={(e) => {
                setTickerPersonalizado(e.target.value.toUpperCase());
                setTickerSeleccionado(e.target.value.toUpperCase());
              }}
              placeholder="ej. SPY, BTC, NVDA, AL30.BA"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors uppercase"
            />
          </div>

          {/* Mercado */}
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">
              Tipo de Mercado
            </label>
            <select
              value={mercado}
              onChange={(e) => setMercado(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="tradfi">TradFi (Yahoo Finance)</option>
              <option value="cripto">Cripto (Yahoo Finance / Par USD)</option>
            </select>
          </div>

          {/* Período de Tiempo */}
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">
              Horizonte Temporal
            </label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="1y">1 Año (~365 velas)</option>
              <option value="2y">2 Años (~730 velas)</option>
            </select>
          </div>

          {/* Capital Inicial */}
          <div>
            <label className="text-xs font-medium text-slate-400 block mb-1">
              Capital Inicial ({monedaGlobal})
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500 text-sm">$</span>
              <input
                type="number"
                min="100"
                step="500"
                value={capitalInicial}
                onChange={(e) => setCapitalInicial(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Botón Ejecutar */}
          <div className="flex items-end">
            <button
              type="button"
              disabled={cargando}
              onClick={ejecutarSimulacion}
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.98] text-white font-semibold py-2 px-4 rounded-lg text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {cargando ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Simulando...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Ejecutar Backtest</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Selector de Estrategia Cuantitativa (Sprint 2 - Query Builder Integration) */}
        <div className="pt-4 border-t border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono text-white uppercase tracking-wider">
                    Estrategia de Ejecución Cuantitativa
                  </span>
                  {resultadoBacktest?.simulacion?.estrategia ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      Reglas Personalizadas: {resultadoBacktest.simulacion.estrategia.nombre}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      CondorScore Base
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {estrategiaSeleccionadaId === 'base'
                    ? 'Ejecutando modelo cuantitativo nativo (CondorScore) regulado por los umbrales dinámicos inferiores.'
                    : `Simulando según reglas lógicas creadas visualmente en el Strategy Builder.`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={estrategiaSeleccionadaId}
                onChange={(e) => setEstrategiaSeleccionadaId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
              >
                <option value="base">CondorScore Base (Parámetros Dinámicos)</option>
                {estrategiasDisponibles.map((est) => (
                  <option key={est.id} value={est.id}>
                    {est.nombre} {est.activa ? '⚡ (Activa)' : ''}
                  </option>
                ))}
              </select>

              <Link
                to="/estrategias"
                className="px-3 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Constructor Visual &rarr;</span>
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider">
                Parámetros Cuantitativos Dinámicos (Walk-Forward Strategy Optimization)
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
              Ajusta los umbrales de CondorScore para optimizar la estrategia
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 shadow-inner">
            {/* Slider 1: Umbral de Compra (Buy Threshold: 50 a 100) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Umbral de Compra (Buy Threshold)</span>
                </label>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  Score &ge; {buyThreshold} pts
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="100"
                step="1"
                value={buyThreshold}
                onChange={(e) => setBuyThreshold(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>50 (Más agresivo)</span>
                <span className="text-slate-400">Default: 80</span>
                <span>100 (Ultra selectivo)</span>
              </div>
            </div>

            {/* Slider 2: Umbral de Venta (Sell Threshold: 0 a 50) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
                  <span>Umbral de Venta (Sell Threshold)</span>
                </label>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                  Score &le; {sellThreshold} pts
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={sellThreshold}
                onChange={(e) => setSellThreshold(Number(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>0 (Stop loss extremo)</span>
                <span className="text-slate-400">Default: 40</span>
                <span>50 (Salida rápida)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mensaje de Error si ocurre */}
        {errorSimulacion && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2 text-rose-300 text-xs">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorSimulacion}</span>
          </div>
        )}
      </div>

      {/* 3. KPI Dashboard (Tarjetas destacadas con Tailwind) */}
      {metricas && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: ROI Neto */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Retorno Neto (ROI)
              </span>
              <div className={`p-2 rounded-lg ${
                metricas.roi >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
              }`}>
                {metricas.roi >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className={`text-3xl font-black font-mono tracking-tight ${
                metricas.roi >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {metricas.roi >= 0 ? '+' : ''}{metricas.roi}%
              </span>
              <span className="text-xs font-mono text-slate-400">
                ({metricas.gananciaNeta >= 0 ? '+' : ''}{formatPrecioCurrency(metricas.gananciaNeta, 'USD', { mostrarCodigo: true })})
              </span>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Capital Final:</span>
              <span className="font-mono font-bold text-white">
                {formatPrecioCurrency(metricas.capitalFinal, 'USD', { mostrarCodigo: true })}
              </span>
            </div>
          </div>

          {/* Card 2: Win Rate */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Tasa de Acierto (Win Rate)
              </span>
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono tracking-tight text-white">
                {metricas.winRate}%
              </span>
              <span className="text-xs text-slate-400">
                ({metricas.tradesGanadores}W / {metricas.tradesPerdedores}L)
              </span>
            </div>

            {/* Barra de progreso de efectividad */}
            <div className="mt-3 pt-3 border-t border-slate-800/80">
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${metricas.winRate}%` }}
                />
                <div
                  className="bg-rose-500 h-full transition-all duration-500"
                  style={{ width: `${100 - metricas.winRate}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 3: Max Drawdown */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Caída Máxima (Drawdown)
              </span>
              <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono tracking-tight text-rose-400">
                -{metricas.maxDrawdown}%
              </span>
              <span className="text-xs text-slate-400">
                Pico a Valle
              </span>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Profit Factor:</span>
              <span className="font-mono font-bold text-indigo-300">
                {metricas.profitFactor}x
              </span>
            </div>
          </div>

          {/* Card 4: Total Trades & Benchmark */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Operaciones Ejecutadas
              </span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <Activity className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono tracking-tight text-white">
                {metricas.totalTrades}
              </span>
              <span className="text-xs text-slate-400">
                (Trades totales)
              </span>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Buy & Hold ROI:</span>
              <span className={`font-mono font-semibold ${
                metricas.buyAndHoldRoi >= 0 ? 'text-slate-300' : 'text-rose-400'
              }`}>
                {metricas.buyAndHoldRoi >= 0 ? '+' : ''}{metricas.buyAndHoldRoi}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Visualización Quant: Gráfico de Velas con Markers */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{resultadoBacktest?.simulacion?.ticker || tickerSeleccionado}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  {resultadoBacktest?.simulacion?.totalVelas || 0} Velas Diarias
                </span>
              </h2>
              <span className="text-xs text-slate-400">
                Rango: {resultadoBacktest?.simulacion?.fechaInicio} &rarr; {resultadoBacktest?.simulacion?.fechaFin}
              </span>
            </div>
          </div>

          {/* Selector de Vista: Velas vs Curva Equity */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center">
              <button
                type="button"
                onClick={() => setVistaGrafico('velas')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  vistaGrafico === 'velas'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Velas & Markers
              </button>
              <button
                type="button"
                onClick={() => setVistaGrafico('equity')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  vistaGrafico === 'equity'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Curva de Equity ($)
              </button>
            </div>
          </div>
        </div>

        {/* HUD de Crosshair en Tiempo Real */}
        {hudVela && (
          <div className="my-3 px-3 py-2 bg-slate-950/80 border border-slate-800/80 rounded-lg flex flex-wrap items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Fecha: <strong className="text-white">{hudVela.time}</strong></span>
            </div>
            {hudVela.isEquity ? (
              <div className="flex items-center gap-1.5 text-slate-400">
                <span>Equity Portafolio: <strong className="text-sky-400">{formatPrecioCurrency(hudVela.close, monedaGlobal, { mostrarCodigo: true })}</strong></span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-1 text-slate-400">
                  <span>O: <strong className="text-slate-200">{formatPrecioCurrency(hudVela.open, monedaGlobal)}</strong></span>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <span>H: <strong className="text-emerald-400">{formatPrecioCurrency(hudVela.high, monedaGlobal)}</strong></span>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <span>L: <strong className="text-rose-400">{formatPrecioCurrency(hudVela.low, monedaGlobal)}</strong></span>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <span>C: <strong className="text-white">{formatPrecioCurrency(hudVela.close, monedaGlobal)}</strong></span>
                </div>
              </>
            )}

            <div className="ml-auto flex items-center gap-2">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Flecha Verde: Compra (&ge; {resultadoBacktest?.simulacion?.parametros?.buyThreshold ?? buyThreshold} pts)
              </span>
              <span className="flex items-center gap-1 text-rose-400 ml-2">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                Flecha Roja: Venta (&le; {resultadoBacktest?.simulacion?.parametros?.sellThreshold ?? sellThreshold} pts)
              </span>
            </div>
          </div>
        )}

        {/* Contenedor del Gráfico TradingView */}
        <div
          ref={chartContainerRef}
          className="w-full h-[480px] rounded-xl overflow-hidden bg-slate-950 border border-slate-800/60 relative"
        >
          {cargando && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
              <span className="text-sm font-medium text-slate-300">
                Simulando modelo matemático cuantitativo...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 5. Historial Detallado de Operaciones (Audit Trail) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">
              Historial de Operaciones Ejecutadas ({operaciones.length})
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {resultadoBacktest?.simulacion?.ticker} | Capital: {formatPrecioCurrency(capitalInicial, 'USD', { mostrarCodigo: true })}
          </span>
        </div>

        {/* Posición Abierta Residual si existe */}
        {resultadoBacktest?.posicionResidual && (
          <div className="mb-4 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-indigo-400 animate-ping" />
              <div>
                <span className="text-xs font-semibold uppercase text-indigo-300 block">
                  Posición Activa al Cierre del Período
                </span>
                <span className="text-sm font-mono text-white">
                  Comprada el {resultadoBacktest.posicionResidual.fechaEntrada} a {formatPrecioCurrency(resultadoBacktest.posicionResidual.precioCompra, 'USD')} &bull; Precio Actual: {formatPrecioCurrency(resultadoBacktest.posicionResidual.precioActual, 'USD')}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">PnL No Realizado</span>
              <span className={`text-sm font-bold font-mono ${
                resultadoBacktest.posicionResidual.pnlNoRealizadoPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {resultadoBacktest.posicionResidual.pnlNoRealizadoPct >= 0 ? '+' : ''}
                {resultadoBacktest.posicionResidual.pnlNoRealizadoPct}% ({formatPrecioCurrency(resultadoBacktest.posicionResidual.pnlNoRealizadoUsd, 'USD', { mostrarCodigo: true })})
              </span>
            </div>
          </div>
        )}

        {operaciones.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            No se generaron operaciones cerradas en el período seleccionado con los umbrales configurados (&ge;{resultadoBacktest?.simulacion?.parametros?.buyThreshold ?? buyThreshold} compra / &le;{resultadoBacktest?.simulacion?.parametros?.sellThreshold ?? sellThreshold} venta).
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">Entrada (Buy)</th>
                  <th className="py-3 px-3">Precio Compra</th>
                  <th className="py-3 px-3">Salida (Sell)</th>
                  <th className="py-3 px-3">Precio Venta</th>
                  <th className="py-3 px-3">Duración</th>
                  <th className="py-3 px-3">Resultado</th>
                  <th className="py-3 px-3">Estrategia</th>
                  <th className="py-3 px-3">PnL (%)</th>
                  <th className="py-3 px-3 text-right">PnL ({monedaGlobal})</th>
                  <th className="py-3 px-3 text-right">Capital ({monedaGlobal})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {operaciones.map((op) => {
                  const esGanador = op.pnlUsd >= 0;
                  return (
                    <tr
                      key={op.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-3 text-slate-500 font-bold">{op.id}</td>
                      <td className="py-3 px-3 text-slate-300">{op.fechaEntrada}</td>
                      <td className="py-3 px-3 font-semibold text-emerald-400">{formatPrecioCurrency(op.precioCompra, 'USD')}</td>
                      <td className="py-3 px-3 text-slate-300">{op.fechaSalida}</td>
                      <td className="py-3 px-3 font-semibold text-rose-400">{formatPrecioCurrency(op.precioVenta, 'USD')}</td>
                      <td className="py-3 px-3 text-slate-400">{op.duracionDias} días</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          esGanador
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          {op.resultado}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800/90 text-slate-300 border border-slate-700/60 truncate max-w-[130px] inline-block" title={op.motivoSalida ? `${op.estrategia} (${op.motivoSalida})` : op.estrategia}>
                          {op.estrategia || 'CondorScore'}
                        </span>
                      </td>
                      <td className={`py-3 px-3 font-bold ${
                        esGanador ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {esGanador ? '+' : ''}{op.pnlPct}%
                      </td>
                      <td className={`py-3 px-3 text-right font-bold ${
                        esGanador ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {esGanador ? '+' : ''}{formatPrecioCurrency(op.pnlUsd, 'USD')}
                      </td>
                      <td className="py-3 px-3 text-right text-white font-semibold">
                        {formatPrecioCurrency(op.capitalResultante, 'USD')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
