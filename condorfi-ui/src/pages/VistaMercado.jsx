/**
 * ==============================================================================
 * CondorFi - Vista de Mercado Reutilizable (Multi-Página SPA)
 * Archivo: condorfi-ui/src/pages/VistaMercado.jsx
 * 
 * Componente modular de mercado:
 * - Recibe o extrae de la ruta la categoría activa (cripto, acciones, indices, bonos)
 * - Pasa filtroCategoria a TradFiCandlestickChart y ScreenerDataGrid
 * - Si la ruta es /bonos, muestra exclusivamente AL30.BA, GD30.BA y TLT
 * ==============================================================================
 */

import React, { useMemo } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import ScreenerDataGrid from '../components/ScreenerDataGrid';
import TradFiCandlestickChart from '../components/TradFiCandlestickChart';
import {
  Coins,
  Building2,
  BarChart3,
  Landmark,
  Radio,
  ArrowUpRight,
  Sparkles,
  ShieldAlert,
  Info
} from 'lucide-react';

const METADATA_MERCADOS = {
  cripto: {
    clave: 'Criptomonedas',
    titulo: 'Mercado Criptoactivo & Arbitraje',
    subtitulo: '20 Criptomonedas con cotizaciones en tiempo real en pesos argentinos y spreads entre exchanges locales y globales.',
    icono: Coins,
    color: 'text-orange-600',
    colorBg: 'bg-orange-50 border-orange-200 text-orange-800',
    tickersInsignia: ['USDT', 'BTC', 'ETH', 'SOL', 'BNB'],
    total: 20
  },
  acciones: {
    clave: 'Acciones',
    titulo: 'Renta Variable: Acciones Tech & Locales',
    subtitulo: 'Big Tech NASDAQ (AAPL, MSFT, NVDA, TSLA, AMZN, META, GOOGL...) y líderes BYMA Argentina (GGAL, YPFD, PAMP).',
    icono: Building2,
    color: 'text-blue-600',
    colorBg: 'bg-blue-50 border-blue-200 text-blue-800',
    tickersInsignia: ['AAPL', 'NVDA', 'MSFT', 'GGAL.BA', 'YPFD.BA'],
    total: 13
  },
  indices: {
    clave: 'Índices',
    titulo: 'Índices Financieros Globales',
    subtitulo: 'Benchmarks de Wall Street (S&P 500 SPY, Nasdaq 100 QQQ, Dow Jones DIA, Russell 2000 IWM) y el índice local S&P Merval (^MERV).',
    icono: BarChart3,
    color: 'text-emerald-600',
    colorBg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    tickersInsignia: ['SPY', 'QQQ', '^MERV', 'DIA', 'IWM'],
    total: 5
  },
  bonos: {
    clave: 'Bonos',
    titulo: 'Renta Fija Soberana & Treasuries',
    subtitulo: 'Curva de bonos argentinos en dólares (Bonar 2030 AL30.BA, Global 2030 GD30.BA) y Bonos del Tesoro de EE.UU. (TLT).',
    icono: Landmark,
    color: 'text-purple-600',
    colorBg: 'bg-purple-50 border-purple-200 text-purple-800',
    tickersInsignia: ['AL30.BA', 'GD30.BA', 'TLT'],
    total: 3
  }
};

export default function VistaMercado({ categoria: propCategoria }) {
  const { categoria: paramCategoria } = useParams();
  const context = useOutletContext() || {};

  const {
    datosScreener = [],
    registrosTradfi = [],
    ejecutandoInsight = false,
    onEjecutarAnalisis,
    onExportarCSV,
    isExporting = false
  } = context;

  // Normalización del slug de categoría
  const categoriaSlug = (propCategoria || paramCategoria || 'cripto').toLowerCase().trim();
  const meta = METADATA_MERCADOS[categoriaSlug] || METADATA_MERCADOS.cripto;
  const IconoMercado = meta.icono;

  // Conteo de activos de la categoría disponibles en memoria
  const activosEnMemoria = useMemo(() => {
    return datosScreener.filter(item => {
      const ticker = item.activo;
      if (categoriaSlug === 'bonos') {
        return ['AL30.BA', 'GD30.BA', 'TLT'].includes(ticker);
      }
      if (categoriaSlug === 'indices') {
        return ['^MERV', 'SPY', 'QQQ', 'DIA', 'IWM'].includes(ticker);
      }
      if (categoriaSlug === 'cripto') {
        return item.tipoMercado === 'cripto' || item.mercado === 'Cripto' || item.moneda === 'ARS';
      }
      // Acciones: TradFi que no sea Índice ni Bono
      const esIndice = ['^MERV', 'SPY', 'QQQ', 'DIA', 'IWM'].includes(ticker);
      const esBono = ['AL30.BA', 'GD30.BA', 'TLT'].includes(ticker);
      const esCripto = item.tipoMercado === 'cripto' || item.mercado === 'Cripto';
      return !esIndice && !esBono && !esCripto;
    });
  }, [datosScreener, categoriaSlug]);

  return (
    <div className="space-y-6">
      {/* =========================================================================
          1. HEADER DESTACADO DE LA CATEGORÍA DE MERCADO
      ========================================================================== */}
      <section className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs ${meta.color}`}>
              <IconoMercado className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 font-mono">
                  {meta.titulo}
                </h2>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${meta.colorBg}`}>
                  {meta.total} Activos
                </span>
              </div>
              <p className="text-xs text-slate-500 font-sans mt-1 max-w-3xl leading-relaxed">
                {meta.subtitulo}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-500 self-start md:self-auto bg-slate-50 p-2 rounded-xl border border-slate-100">
            <span className="text-[11px] font-bold text-slate-700">Insignia:</span>
            {meta.tickersInsignia.map(t => (
              <span key={t} className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-bold text-slate-800 text-[10px] shadow-2xs">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. GRÁFICO DE VELAS JAPONESAS TRADINGVIEW (FILTRADO POR CATEGORÍA)
      ========================================================================== */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <span>TradingView LightWeight Charts</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-normal">
              Filtro: {meta.clave}
            </span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            Series Intradiarias OHLC en Vivo
          </span>
        </div>

        <TradFiCandlestickChart
          registrosTradfi={registrosTradfi}
          filtroCategoria={meta.clave}
        />
      </section>

      {/* =========================================================================
          3. SCREENER DATAGRID CUANTITATIVO (FILTRADO EXCLUSIVAMENTE POR CATEGORÍA)
      ========================================================================== */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <span>Terminal Screener Cuantitativo</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-orange-100 text-orange-800 font-bold">
              {meta.clave} ({activosEnMemoria.length} Filtrados)
            </span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            RSI(14) • MACD • Bandas de Bollinger • Señales Algorítmicas
          </span>
        </div>

        <ScreenerDataGrid
          datosScreener={datosScreener}
          filtroCategoria={meta.clave}
          ejecutandoInsight={ejecutandoInsight}
          onEjecutarAnalisis={onEjecutarAnalisis}
          onExportarCSV={onExportarCSV}
          isExporting={isExporting}
        />
      </section>
    </div>
  );
}
