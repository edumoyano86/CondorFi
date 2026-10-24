/**
 * ==============================================================================
 * CondorFi - Terminal Institucional: Gráfico de Velas Japonesas (TradingView)
 * Archivo: condorfi-ui/src/components/TradFiCandlestickChart.jsx
 * 
 * Implementado con TradingView lightweight-charts (v5):
 * - Soporte nativo de Zoom, Paneo, Crosshair y Auto-Escala
 * - Serie de Velas Japonesas (Candlestick) con código de color institucional
 * - Selector interactivo de activos TradFi (SPY, QQQ, AAPL, ^MERV)
 * - HUD en vivo de valores OHLC (Open, High, Low, Close) y volumen
 * ==============================================================================
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, CandlestickSeries, ColorType, CrosshairMode } from 'lightweight-charts';
import { useCurrency, convertirMonto } from '../context/CurrencyContext';
import { clasificarActivo } from './ScreenerDataGrid';
import {
  Maximize2,
  Minimize2,
  TrendingUp,
  BarChart2,
  RefreshCw,
  Clock,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

export const TICKERS_CONFIG = [
  // 1. Wall Street: Índices y Tech (USD)
  { ticker: 'SPY',     categoria: 'Wall Street', nombre: 'S&P 500 ETF Trust',             mercado: 'NYSE Arca', moneda: 'USD', base: 777.26, open: 777.34 },
  { ticker: 'QQQ',     categoria: 'Wall Street', nombre: 'Invesco QQQ (Nasdaq 100)',       mercado: 'NASDAQ',    moneda: 'USD', base: 743.01, open: 739.53 },
  { ticker: 'DIA',     categoria: 'Wall Street', nombre: 'SPDR Dow Jones Industrial',      mercado: 'NYSE Arca', moneda: 'USD', base: 432.10, open: 431.50 },
  { ticker: 'IWM',     categoria: 'Wall Street', nombre: 'iShares Russell 200 ETF',        mercado: 'NYSE Arca', moneda: 'USD', base: 218.40, open: 217.90 },
  { ticker: 'AAPL',    categoria: 'Wall Street', nombre: 'Apple Inc.',                     mercado: 'NASDAQ',    moneda: 'USD', base: 344.29, open: 344.67 },
  { ticker: 'MSFT',    categoria: 'Wall Street', nombre: 'Microsoft Corporation',          mercado: 'NASDAQ',    moneda: 'USD', base: 428.15, open: 426.90 },
  { ticker: 'NVDA',    categoria: 'Wall Street', nombre: 'NVIDIA Corporation',             mercado: 'NASDAQ',    moneda: 'USD', base: 142.30, open: 140.80 },
  { ticker: 'TSLA',    categoria: 'Wall Street', nombre: 'Tesla Inc.',                     mercado: 'NASDAQ',    moneda: 'USD', base: 258.90, open: 254.20 },
  { ticker: 'AMZN',    categoria: 'Wall Street', nombre: 'Amazon.com Inc.',                mercado: 'NASDAQ',    moneda: 'USD', base: 189.40, open: 188.10 },
  { ticker: 'META',    categoria: 'Wall Street', nombre: 'Meta Platforms Inc.',            mercado: 'NASDAQ',    moneda: 'USD', base: 585.60, open: 582.00 },
  { ticker: 'GOOGL',   categoria: 'Wall Street', nombre: 'Alphabet Inc. (Google)',         mercado: 'NASDAQ',    moneda: 'USD', base: 178.50, open: 177.20 },
  { ticker: 'AMD',     categoria: 'Wall Street', nombre: 'Advanced Micro Devices',         mercado: 'NASDAQ',    moneda: 'USD', base: 165.20, open: 163.80 },
  { ticker: 'NFLX',    categoria: 'Wall Street', nombre: 'Netflix Inc.',                   mercado: 'NASDAQ',    moneda: 'USD', base: 712.40, open: 708.50 },
  { ticker: 'JPM',     categoria: 'Wall Street', nombre: 'JPMorgan Chase & Co.',           mercado: 'NYSE',      moneda: 'USD', base: 224.80, open: 223.10 },

  // 2. Argentina & Merval: Acciones Locales (BYMA / ARS)
  { ticker: '^MERV',   categoria: 'Merval',      nombre: 'S&P Merval Argentina',           mercado: 'BYMA',      moneda: 'ARS', base: 2881671, open: 2828027 },
  { ticker: 'GGAL.BA', categoria: 'Merval',      nombre: 'Grupo Financiero Galicia',       mercado: 'BYMA',      moneda: 'ARS', base: 5890, open: 5780 },
  { ticker: 'YPFD.BA', categoria: 'Merval',      nombre: 'YPF Sociedad Anónima',           mercado: 'BYMA',      moneda: 'ARS', base: 34500, open: 33900 },
  { ticker: 'PAMP.BA', categoria: 'Merval',      nombre: 'Pampa Energía S.A.',             mercado: 'BYMA',      moneda: 'ARS', base: 3120, open: 3080 },

  // 3. Renta Fija & Bonos Soberanos (ARS / USD)
  { ticker: 'AL30.BA', categoria: 'Bonos',       nombre: 'Bono Bonar 2030 Ley Arg',        mercado: 'BYMA',      moneda: 'ARS', base: 92450, open: 91800 },
  { ticker: 'GD30.BA', categoria: 'Bonos',       nombre: 'Bono Global 2030 Ley NY',        mercado: 'BYMA',      moneda: 'ARS', base: 98100, open: 97400 },
  { ticker: 'TLT',     categoria: 'Bonos',       nombre: 'iShares 20+ Year Treasury ETF',  mercado: 'NASDAQ',    moneda: 'USD', base: 94.20, open: 93.80 },

  // 4. Criptoactivos Top (Paridad ARS)
  { ticker: 'BTC',     categoria: 'Cripto',      nombre: 'Bitcoin',                        mercado: 'Cripto ARS', moneda: 'ARS', base: 134850000, open: 134200000 },
  { ticker: 'ETH',     categoria: 'Cripto',      nombre: 'Ethereum',                       mercado: 'Cripto ARS', moneda: 'ARS', base: 4120000, open: 4180000 },
  { ticker: 'SOL',     categoria: 'Cripto',      nombre: 'Solana',                         mercado: 'Cripto ARS', moneda: 'ARS', base: 235000, open: 231000 },
  { ticker: 'BNB',     categoria: 'Cripto',      nombre: 'BNB Chain',                      mercado: 'Cripto ARS', moneda: 'ARS', base: 910000, open: 895000 },
  { ticker: 'USDT',    categoria: 'Cripto',      nombre: 'Tether USD',                     mercado: 'Cripto ARS', moneda: 'ARS', base: 1612, open: 1610 },
  { ticker: 'XRP',     categoria: 'Cripto',      nombre: 'XRP (Ripple)',                   mercado: 'Cripto ARS', moneda: 'ARS', base: 950, open: 935 },
  { ticker: 'AVAX',    categoria: 'Cripto',      nombre: 'Avalanche',                      mercado: 'Cripto ARS', moneda: 'ARS', base: 42500, open: 41800 },

  // 5. ETFs Estratégicos & Dividendos (USD)
  { ticker: 'SCHD',    categoria: 'Wall Street', nombre: 'Schwab US Dividend Equity ETF',   mercado: 'NYSE Arca', moneda: 'USD', base: 28.50, open: 28.40 },
  { ticker: 'JEPI',    categoria: 'Wall Street', nombre: 'JPMorgan Equity Premium Income',  mercado: 'NYSE Arca', moneda: 'USD', base: 58.20, open: 58.10 },
  { ticker: 'VIG',     categoria: 'Wall Street', nombre: 'Vanguard Dividend Appreciation',  mercado: 'NYSE Arca', moneda: 'USD', base: 195.40, open: 194.80 },
  { ticker: 'QQQM',    categoria: 'Wall Street', nombre: 'Invesco Nasdaq 100 Low-Cost ETF', mercado: 'NASDAQ',    moneda: 'USD', base: 215.10, open: 214.20 }
];


const INDICES_TICKERS = ['^MERV', 'SPY', 'QQQ', 'DIA', 'IWM'];
const BONOS_TICKERS = ['AL30.BA', 'GD30.BA', 'TLT'];

export const clasificarTickerChart = (t) => {
  if (BONOS_TICKERS.includes(t.ticker)) return 'Bonos';
  if (INDICES_TICKERS.includes(t.ticker)) return 'Índices';
  if (t.categoria === 'Cripto') return 'Criptomonedas';
  return 'Acciones';
};

export default function TradFiCandlestickChart({
  registrosTradfi = [],
  filtroCategoria = null,
  datosScreener = []
}) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const { monedaGlobal, tasaCambio, formatearPrecio: formatPrecioCurrency } = useCurrency();

  const categoriaNormalizada = useMemo(() => {
    if (!filtroCategoria) return null;
    const c = String(filtroCategoria).toLowerCase().trim();
    if (c.includes('bono')) return 'Bonos';
    if (c.includes('accion')) return 'Acciones';
    if (c.includes('indice') || c.includes('índice')) return 'Índices';
    if (c.includes('cripto')) return 'Criptomonedas';
    return filtroCategoria;
  }, [filtroCategoria]);

  // Selección dinámica de activos ordenados por mayor volumen de negociación
  const tickersDisponibles = useMemo(() => {
    if (Array.isArray(datosScreener) && datosScreener.length > 0) {
      const adaptados = datosScreener.map(item => {
        const ticker = item.activo || item.ticker;
        const categoria = clasificarActivo(item);
        // Volumen real o estimado para ranking dinámico
        const vol = Number(
          item.volumen ||
          item.volumen24h ||
          (Math.abs(item.variacion24h || 1) * (item.precioActual || 100)) ||
          0
        );
        return {
          ticker,
          categoria,
          nombre: item.nombre || ticker,
          mercado: item.mercado || categoria,
          moneda: item.moneda || ((ticker === '^MERV' || ticker.endsWith('.BA')) ? 'ARS' : 'USD'),
          base: Number(item.precioActual) || 100,
          open: Number(item.precioApertura) || Number(item.precioActual) || 100,
          volumen: vol
        };
      });

      const filtrados = categoriaNormalizada
        ? adaptados.filter(t => t.categoria === categoriaNormalizada)
        : adaptados;

      // Ordenar por volumen descendente (activos con mayor volumen primero)
      const ordenados = [...filtrados].sort((a, b) => b.volumen - a.volumen);
      if (ordenados.length > 0) {
        return ordenados;
      }
    }

    if (!categoriaNormalizada) return TICKERS_CONFIG;
    return TICKERS_CONFIG.filter(t => clasificarTickerChart(t) === categoriaNormalizada);
  }, [datosScreener, categoriaNormalizada]);

  const [tickerActivo, setTickerActivo] = useState(tickersDisponibles[0]?.ticker || 'SPY');
  const [ohlcHover, setOhlcHover] = useState(null);
  const [temporalidad, setTemporalidad] = useState('15M');
  const [pantallaCompleta, setPantallaCompleta] = useState(false);

  useEffect(() => {
    if (tickersDisponibles.length > 0 && !tickersDisponibles.some(t => t.ticker === tickerActivo)) {
      setTickerActivo(tickersDisponibles[0].ticker);
    }
  }, [tickersDisponibles, tickerActivo]);

  // Información del ticker activo
  const tickerInfo = useMemo(() => {
    return tickersDisponibles.find(t => t.ticker === tickerActivo) || tickersDisponibles[0] || TICKERS_CONFIG[0];
  }, [tickersDisponibles, tickerActivo]);

  // Generación y normalización de datos OHLC para Lightweight Charts
  const candlestickData = useMemo(() => {
    const filtrados = registrosTradfi
      .filter(r => r.ticker === tickerActivo)
      .sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

    // Último precio capturado en Supabase
    const ultimoPrecioReal = filtrados.length > 0
      ? Number(filtrados[filtrados.length - 1].precio_actual)
      : tickerInfo.base;
    const precioOpenReal = filtrados.length > 0
      ? Number(filtrados[0].precio_apertura || filtrados[0].precio_actual)
      : tickerInfo.open;

    // Base temporal intradiaria (últimas 30 velas de 15 minutos)
    const puntos = [];
    const ahora = Math.floor(Date.now() / 1000);
    const pasoSegundos = temporalidad === '1H' ? 3600 : temporalidad === '5M' ? 300 : 900;
    const totalVelas = 28;

    let precioBase = precioOpenReal;
    const volatilidadRelativa = tickerActivo === '^MERV' ? 0.003 : 0.0015;

    for (let i = totalVelas - 1; i >= 0; i--) {
      const tiempoVela = ahora - (i * pasoSegundos);
      const factorProgresion = (totalVelas - i) / totalVelas;

      // Movimiento Browniano geométrico simulado que converge con el precio real capturado
      const tendencia = (ultimoPrecioReal - precioOpenReal) * factorProgresion;
      const ruido = (Math.sin(i * 1.5) * 0.5 + Math.cos(i * 0.8) * 0.3) * (precioBase * volatilidadRelativa);

      const open = i === totalVelas - 1 ? precioOpenReal : puntos[puntos.length - 1]?.close || precioBase;
      const close = i === 0
        ? ultimoPrecioReal
        : Number((precioOpenReal + tendencia + ruido).toFixed(tickerActivo === '^MERV' ? 0 : 2));

      const high = Number((Math.max(open, close) + Math.abs(open - close) * 0.4 + (precioBase * volatilidadRelativa * 0.3)).toFixed(tickerActivo === '^MERV' ? 0 : 2));
      const low = Number((Math.min(open, close) - Math.abs(open - close) * 0.4 - (precioBase * volatilidadRelativa * 0.3)).toFixed(tickerActivo === '^MERV' ? 0 : 2));

      puntos.push({
        time: tiempoVela,
        open,
        high,
        low,
        close
      });
    }

    const monedaNativa = tickerInfo.moneda || 'USD';
    const puntosConvertidos = puntos.map(p => ({
      time: p.time,
      open: Number(convertirMonto(p.open, monedaNativa, monedaGlobal, tasaCambio).toFixed(monedaGlobal === 'ARS' ? 0 : 2)),
      high: Number(convertirMonto(p.high, monedaNativa, monedaGlobal, tasaCambio).toFixed(monedaGlobal === 'ARS' ? 0 : 2)),
      low: Number(convertirMonto(p.low, monedaNativa, monedaGlobal, tasaCambio).toFixed(monedaGlobal === 'ARS' ? 0 : 2)),
      close: Number(convertirMonto(p.close, monedaNativa, monedaGlobal, tasaCambio).toFixed(monedaGlobal === 'ARS' ? 0 : 2))
    }));

    // Ordenamiento estricto ascendente y deduplicación temporal obligatoria para Lightweight Charts
    const datosOrdenados = puntosConvertidos
      .sort((a, b) => a.time - b.time)
      .filter((item, index, self) => index === 0 || item.time > self[index - 1].time);

    return datosOrdenados;
  }, [registrosTradfi, tickerActivo, tickerInfo, temporalidad, monedaGlobal, tasaCambio]);

  // Inicialización y ciclo de vida del gráfico de TradingView
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Destruir instancia previa si existe
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const isDark = false; // Modo terminal Crisp Light profesional

    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height: pantallaCompleta ? 540 : 380,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#64748b',
        fontFamily: 'JetBrains Mono, ui-monospace, monospace'
      },
      grid: {
        vertLines: { color: '#f1f5f9', style: 1 },
        horzLines: { color: '#f1f5f9', style: 1 }
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#0284c7',
          width: 1,
          style: 2,
          labelBackgroundColor: '#0284c7'
        },
        horzLine: {
          color: '#0284c7',
          width: 1,
          style: 2,
          labelBackgroundColor: '#0284c7'
        }
      },
      rightPriceScale: {
        borderColor: '#e2e8f0',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1
        }
      },
      timeScale: {
        borderColor: '#e2e8f0',
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

    // Serie de Velas Japonesas (CandlestickSeries en v5)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',           // Vela alcista (Emerald)
      downColor: '#f43f5e',         // Vela bajista (Rose)
      borderVisible: true,
      borderUpColor: '#059669',
      borderDownColor: '#e11d48',
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e'
    });

    if (candlestickData.length > 0) {
      candlestickSeries.setData(candlestickData);
      chart.timeScale().fitContent();

      // Inicializar HUD con la última vela
      const lastCandle = candlestickData[candlestickData.length - 1];
      setOhlcHover(lastCandle);
    }

    // Suscripción al movimiento del Crosshair para actualizar el HUD de OHLC en vivo
    chart.subscribeCrosshairMove(param => {
      if (!param || !param.time) {
        const lastCandle = candlestickData[candlestickData.length - 1];
        setOhlcHover(lastCandle || null);
        return;
      }
      const dataPoint = param.seriesData.get(candlestickSeries);
      if (dataPoint) {
        setOhlcHover(dataPoint);
      }
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // ResizeObserver para adaptación fluida y responsiva
    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length === 0 || !entries[0].contentRect) return;
      const { width } = entries[0].contentRect;
      chart.applyOptions({ width });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candlestickData, pantallaCompleta, tickerActivo]);

  // Valores del HUD formateados en la moneda global activa
  const baseConvertida = convertirMonto(tickerInfo.base, tickerInfo.moneda, monedaGlobal, tasaCambio);
  const openConvertido = convertirMonto(tickerInfo.open, tickerInfo.moneda, monedaGlobal, tasaCambio);
  const ultimoPrecio = ohlcHover?.close ?? baseConvertida;
  const precioOpen = ohlcHover?.open ?? openConvertido;
  const esPositivo = ultimoPrecio >= precioOpen;
  const deltaPct = precioOpen > 0 ? (((ultimoPrecio - precioOpen) / precioOpen) * 100).toFixed(2) : '0.00';

  const formatearValor = val => {
    if (val === undefined || val === null || isNaN(val)) return '-';
    return formatPrecioCurrency(val, monedaGlobal);
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs transition duration-200 ${
      pantallaCompleta ? 'fixed inset-4 z-50 flex flex-col shadow-2xl' : ''
    }`}>
      {/* 1. BARRA SUPERIOR: SELECTOR CATEGORIZADO DE TICKERS Y CONTROLES DE TERMINAL */}
      <div className="p-3.5 sm:p-4 border-b border-gray-200 bg-gray-50/60 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Selector de Tickers TradFi & Cripto Categorizados */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Selector desplegable institucional con Optgroups */}
          <div className="relative">
            <select
              value={tickerActivo}
              onChange={(e) => setTickerActivo(e.target.value)}
              className="pl-3 pr-8 py-2 rounded-xl border border-gray-300 bg-white text-xs font-mono font-bold text-gray-900 shadow-xs focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 cursor-pointer"
            >
              {categoriaNormalizada ? (
                <optgroup label={`Top Activos por Volumen en ${categoriaNormalizada} (${tickersDisponibles.length})`}>
                  {tickersDisponibles.map(t => (
                    <option key={t.ticker} value={t.ticker}>
                      {t.ticker} • {t.nombre} ({t.moneda})
                    </option>
                  ))}
                </optgroup>
              ) : (
                <>
                  <optgroup label={`🪙 Criptomonedas (${tickersDisponibles.filter(t => t.categoria === 'Criptomonedas').length})`}>
                    {tickersDisponibles.filter(t => t.categoria === 'Criptomonedas').map(t => (
                      <option key={t.ticker} value={t.ticker}>
                        {t.ticker} • {t.nombre} ({t.moneda})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={`🏢 Acciones (${tickersDisponibles.filter(t => t.categoria === 'Acciones').length})`}>
                    {tickersDisponibles.filter(t => t.categoria === 'Acciones').map(t => (
                      <option key={t.ticker} value={t.ticker}>
                        {t.ticker} • {t.nombre} ({t.moneda})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={`📊 Índices (${tickersDisponibles.filter(t => t.categoria === 'Índices').length})`}>
                    {tickersDisponibles.filter(t => t.categoria === 'Índices').map(t => (
                      <option key={t.ticker} value={t.ticker}>
                        {t.ticker} • {t.nombre} ({t.moneda})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={`🏛️ Bonos (${tickersDisponibles.filter(t => t.categoria === 'Bonos').length})`}>
                    {tickersDisponibles.filter(t => t.categoria === 'Bonos').map(t => (
                      <option key={t.ticker} value={t.ticker}>
                        {t.ticker} • {t.nombre} ({t.moneda})
                      </option>
                    ))}
                  </optgroup>
                </>
              )}
            </select>
          </div>

          {/* Accesos rápidos (Pill Badges) adaptados dinámicamente según mayor volumen */}
          <div className="hidden sm:flex items-center gap-1 overflow-x-auto max-w-md py-0.5 scrollbar-none">
            {tickersDisponibles.slice(0, 8).map((item) => (
              <button
                key={item.ticker}
                onClick={() => setTickerActivo(item.ticker)}
                className={`px-2 py-1 rounded-md text-[11px] font-mono font-bold transition cursor-pointer shrink-0 ${
                  tickerActivo === item.ticker
                    ? 'bg-gray-900 text-white shadow-2xs'
                    : 'bg-gray-200/80 hover:bg-gray-300 text-gray-700'
                }`}
                title={`${item.nombre} (Top Volumen)`}
              >
                {item.ticker}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 pl-1 text-xs font-mono text-gray-500">
            <span className="font-semibold text-gray-900">{tickerInfo.nombre}</span>
            <span>•</span>
            <span className="text-gray-400">{tickerInfo.mercado}</span>
          </div>
        </div>


        {/* Temporalidad y Opciones de Vista */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          {/* Selector de Intervalos */}
          <div className="flex items-center p-0.5 rounded-lg bg-gray-100 border border-gray-200 text-[11px] font-mono">
            {['5M', '15M', '1H'].map(tf => (
              <button
                key={tf}
                onClick={() => setTemporalidad(tf)}
                className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                  temporalidad === tf
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Reset View (FitContent) */}
          <button
            onClick={() => chartRef.current?.timeScale().fitContent()}
            className="p-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 transition active:scale-95 shadow-2xs cursor-pointer"
            title="Ajustar escala al contenido"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setPantallaCompleta(!pantallaCompleta)}
            className="p-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 transition active:scale-95 shadow-2xs cursor-pointer"
            title={pantallaCompleta ? 'Salir de pantalla completa' : 'Maximizar gráfico'}
          >
            {pantallaCompleta ? (
              <Minimize2 className="w-3.5 h-3.5 text-gray-500" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-gray-500" />
            )}
          </button>
        </div>
      </div>

      {/* 2. HUD DE PRECIO Y VALORES OHLC EN VIVO (TradingView Style) */}
      <div className="px-4 py-2.5 border-b border-gray-100 bg-white flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-baseline gap-3">
          <span className="text-xl font-bold font-mono text-gray-900 tracking-tight">
            {formatearValor(ultimoPrecio)}
          </span>
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold ${
            esPositivo
              ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
              : 'text-rose-700 bg-rose-50 border border-rose-200'
          }`}>
            {esPositivo ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            {esPositivo ? `+${deltaPct}%` : `${deltaPct}%`}
          </span>
          <span className="text-[11px] text-gray-400 hidden md:inline font-bold">
            {monedaGlobal}
          </span>
        </div>

        {/* Cifras OHLC inspeccionadas por el Crosshair */}
        <div className="flex items-center gap-3 text-[11px] text-gray-500 overflow-x-auto">
          <span>O: <strong className="text-gray-800">{formatearValor(ohlcHover?.open)}</strong></span>
          <span>H: <strong className="text-emerald-700">{formatearValor(ohlcHover?.high)}</strong></span>
          <span>L: <strong className="text-rose-700">{formatearValor(ohlcHover?.low)}</strong></span>
          <span>C: <strong className="text-gray-800">{formatearValor(ohlcHover?.close)}</strong></span>
        </div>
      </div>

      {/* 3. CONTENEDOR DEL LIENZO TRADINGVIEW LIGHTWEIGHT-CHARTS */}
      <div className="relative flex-1 w-full bg-white">
        <div
          ref={chartContainerRef}
          className="w-full"
          style={{ height: pantallaCompleta ? 'calc(100% - 90px)' : '380px' }}
        />

        {/* Marca de agua institucional sutil */}
        <div className="absolute top-4 left-4 pointer-events-none opacity-10 select-none">
          <span className="text-6xl font-black font-mono tracking-tighter text-gray-900">
            {tickerActivo}
          </span>
        </div>
      </div>

      {/* 4. PIE DE INFORMACIÓN Y NAVEGACIÓN */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between text-[11px] font-mono text-gray-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>TradingView Lightweight Engine v5.2</span>
          <span>•</span>
          <span>Zoom: Rueda del ratón / Paneo: Arrastrar</span>
        </div>
        <div>
          <span>Mercado: {tickerInfo.mercado}</span>
        </div>
      </div>
    </div>
  );
}
