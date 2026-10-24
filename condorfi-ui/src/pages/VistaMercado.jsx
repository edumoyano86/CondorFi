/**
 * ==============================================================================
 * CondorFi - Vista de Mercado Reutilizable & Modular (Multi-Página SPA)
 * Archivo: condorfi-ui/src/pages/VistaMercado.jsx
 * 
 * Componente modular de mercado de alto rendimiento:
 * - Realiza peticiones HTTP explícitas con parámetros (ej. ?categoria=indices)
 * - Integra sub-pestañas universales modulares para Acciones, Índices, Cripto y Bonos
 * - Sincroniza datos masivos en tiempo real con datosScreener y la grilla con paginación
 * - Conecta con TradingView Candlestick Chart y ScreenerDataGrid
 * ==============================================================================
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import ScreenerDataGrid, { clasificarActivo } from '../components/ScreenerDataGrid';
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
  Info,
  Layers,
  PieChart,
  Zap,
  RefreshCw
} from 'lucide-react';

export const ETFS_ESTRATEGICOS_TICKERS = [
  'VIG', 'SCHD', 'JEPI', 'JEPQ', 'VYM', 'DGRO', 'NOBL', 'QQQM',
  'HDV', 'SPYD', 'DVY', 'SDY', 'COWZ', 'DIVO', 'MOAT', 'BST'
];

// Sub-pestañas Universales por Mercado
export const SUB_PESTANAS_POR_MERCADO = {
  acciones: [
    { id: 'global',     label: '🌐 Mercado Global',   desc: 'Todas las acciones y ETFs TradFi' },
    { id: 'dividendos', label: '💰 ETFs Dividendos', desc: 'VIG, SCHD, JEPI, JEPQ, VYM, DGRO, NOBL, QQQM' },
    { id: 'lideres',    label: '🚀 Acciones Líderes', desc: 'Mega-Cap Tech NASDAQ & S&P 500 (NVDA, AAPL, MSFT...)' },
    { id: 'byma',       label: '🇦🇷 BYMA & Merval',    desc: 'Líderes locales y CEDEARs (GGAL, YPFD, PAMP...)' }
  ],
  indices: [
    { id: 'todos',        label: '🌐 Todos los Benchmarks', desc: '100 Benchmarks Globales, Sectoriales y Cobertura' },
    { id: 'wallstreet',   label: '🏛️ Wall Street Core',     desc: 'S&P 500, Nasdaq 100, Dow Jones, Russell 2000' },
    { id: 'sectores',     label: '📊 Sectores SPDR',         desc: 'Tech (XLK), Financiero (XLF), Energía (XLE), Salud (XLV)...' },
    { id: 'tematicos',    label: '⚡ Temáticos & Tech',       desc: 'Semis (SMH), Ciberseguridad (HACK), Biotech (XBI), IA...' },
    { id: 'globales',     label: '🌍 Globales & Países',     desc: 'Merval, FTSE, DAX, Nikkei, China, Emergentes...' },
    { id: 'volatilidad',  label: '🛡️ Volatilidad & Cobertura', desc: 'VIX, UVXY, Oro (GLD), Petróleo (USO), Bonos (BND)' }
  ],
  cripto: [
    { id: 'todas',    label: '🪙 Todas las Criptos', desc: 'Top 100 Criptomonedas por Capitalización de Mercado' },
    { id: 'core',     label: '💎 Core & High-Cap',    desc: 'BTC, ETH, SOL, BNB, XRP, ADA, AVAX, DOGE, LINK' },
    { id: 'l1_l2',    label: '⚡ Layer 1 & 2',         desc: 'ARB, OP, SUI, APT, NEAR, TON, MATIC, DOT, TRX...' },
    { id: 'defi',     label: '🏦 DeFi & RWA',         desc: 'UNI, AAVE, MKR, PENDLE, ONDO, CRV, LDO, SNX...' },
    { id: 'ia_memes', label: '🤖 IA & Memecoins',     desc: 'FET, RNDR, TAO, PEPE, WIF, BONK, FLOKI, SHIB...' }
  ],
  bonos: [
    { id: 'todos',     label: '🏛️ Todos los Bonos',      desc: 'Soberanos en Dólares y Treasuries de EE.UU.' },
    { id: 'soberanos', label: '🇦🇷 Soberanos Argentina',  desc: 'Curva AL30, GD30, AL35, GD35, AE38, GD38...' },
    { id: 'globales',  label: '🇺🇸 Treasuries & Global',  desc: 'TLT, IEF, SHY, BND, AGG, LQD, HYG' }
  ]
};

export const SUB_PESTANAS_TRADFI = SUB_PESTANAS_POR_MERCADO.acciones;

// Conjuntos de tickers para filtrado modular exacto
const GRUPOS_TICKERS = {
  indices: {
    wallstreet: new Set(['^GSPC', 'SPY', 'IVV', 'VOO', 'VTI', '^NDX', 'QQQ', 'QQQM', '^DJI', 'DIA', '^RUT', 'IWM', 'IWO', 'IWN', 'MDY', 'IJH', '^W5000']),
    sectores: new Set(['XLK', 'VGT', 'XLF', 'VFH', 'XLE', 'VDE', 'XLV', 'VHT', 'XLI', 'VIS', 'XLY', 'VCR', 'XLP', 'VDC', 'XLU', 'VPU', 'XLB', 'VAW', 'XLRE', 'VNQ', 'XLC', 'VOX']),
    tematicos: new Set(['SMH', 'SOXX', 'IBB', 'XBI', 'KRE', 'KBE', 'XHB', 'ITB', 'XRT', 'XME', 'GDX', 'GDXJ', 'XOP', 'OIH', 'TAN', 'ICLN', 'BOTZ', 'AIQ', 'HACK', 'CIBR', 'IGV', 'JETS', 'ARKK']),
    globales: new Set(['^MERV', 'ARGT', '^FTSE', 'EWU', '^GDAXI', 'EWG', '^FCHI', 'EWQ', '^N225', 'EWJ', '^HSI', 'FXI', 'MCHI', '^STOXX50E', 'FEZ', '^IBEX', 'EWP', '^BVSP', 'EWZ', 'EEM', 'VWO', 'EFA', 'VEA', 'INDA', 'EPI', 'EWY', 'EWT', 'EWA', 'EWC', 'EWW']),
    volatilidad: new Set(['^VIX', 'VXX', 'UVXY', 'GLD', 'SLV', 'USO', 'DBC', 'BND'])
  },
  cripto: {
    core: new Set(['USDT', 'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOGE', 'LINK']),
    l1_l2: new Set(['DOT', 'MATIC', 'NEAR', 'ARB', 'OP', 'INJ', 'TON', 'TRX', 'BCH', 'ETC', 'FIL', 'APT', 'SUI', 'KAS', 'STX', 'FTM', 'ALGO', 'SEI', 'TIA', 'STRK', 'MINA', 'ROSE', 'CFX', 'EGLD', 'EOS']),
    defi: new Set(['UNI', 'AAVE', 'MKR', 'PENDLE', 'ONDO', 'CRV', 'SNX', 'COMP', '1INCH', 'LDO', 'DYDX', 'RAY', 'GNO', 'KAVA', 'OSMO']),
    ia_memes: new Set(['FET', 'TAO', 'RNDR', 'AGIX', 'OCEAN', 'WLD', 'SHIB', 'PEPE', 'WIF', 'BONK', 'FLOKI', 'DOGE', 'MEME', 'SUPER', 'ILV', 'SAND', 'MANA', 'AXS', 'APE'])
  },
  bonos: {
    soberanos: new Set(['AL30.BA', 'GD30.BA', 'AL35.BA', 'GD35.BA', 'AE38.BA', 'GD38.BA', 'AL29.BA', 'GD29.BA']),
    globales: new Set(['TLT', 'IEF', 'SHY', 'BND', 'AGG', 'LQD', 'HYG'])
  },
  acciones: {
    dividendos: new Set(ETFS_ESTRATEGICOS_TICKERS),
    byma: new Set(['GGAL.BA', 'YPFD.BA', 'PAMP.BA', 'BMA.BA', 'CEPU.BA', 'TXAR.BA', 'ALUA.BA', 'CRES.BA', 'EDN.BA', 'LOMA.BA', 'MIRG.BA', 'TECO2.BA', 'TGNO4.BA', 'TGSU2.BA', 'TRAN.BA', 'VALO.BA', 'BYMA.BA', 'MELI', 'VIST', 'YPF', 'GLOB', 'BBD', 'ITUB', 'VALE', 'PBR'])
  }
};

const METADATA_MERCADOS = {
  cripto: {
    clave: 'Criptomonedas',
    titulo: 'Mercado Criptoactivo & Arbitraje',
    subtitulo: 'Top 100 criptomonedas con cotizaciones en tiempo real en pesos argentinos, arbitraje de paridades y spreads entre exchanges.',
    icono: Coins,
    color: 'text-orange-600',
    colorBg: 'bg-orange-50 border-orange-200 text-orange-800',
    tickersInsignia: ['USDT', 'BTC', 'ETH', 'SOL', 'BNB']
  },
  acciones: {
    clave: 'Acciones',
    titulo: 'Renta Variable: Acciones Tech & Dividendos',
    subtitulo: 'Mega-Cap Tech NASDAQ, S&P 500, ETFs de Dividendos Estratégicos y acciones líderes BYMA Argentina.',
    icono: Building2,
    color: 'text-blue-600',
    colorBg: 'bg-blue-50 border-blue-200 text-blue-800',
    tickersInsignia: ['AAPL', 'NVDA', 'MSFT', 'SCHD', 'GGAL.BA']
  },
  indices: {
    clave: 'Índices',
    titulo: 'Índices Financieros Globales',
    subtitulo: '100 benchmarks globales de Wall Street (S&P 500, Nasdaq 100, Dow Jones, Russell 2000), sectores SPDR y mercados internacionales.',
    icono: BarChart3,
    color: 'text-emerald-600',
    colorBg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    tickersInsignia: ['SPY', 'QQQ', '^MERV', 'DIA', 'IWM']
  },
  bonos: {
    clave: 'Bonos',
    titulo: 'Renta Fija Soberana & Treasuries',
    subtitulo: 'Curva de bonos soberanos argentinos en dólares (Ley Arg & NY) y Bonos del Tesoro de EE.UU. (Treasuries TLT, BND).',
    icono: Landmark,
    color: 'text-purple-600',
    colorBg: 'bg-purple-50 border-purple-200 text-purple-800',
    tickersInsignia: ['AL30.BA', 'GD30.BA', 'TLT', 'BND']
  }
};

export default function VistaMercado({
  categoria: propCategoria,
  activosExternos = null,
  isLoadingExterno = null,
  onRefrescarExterno = null
}) {
  const { categoria: paramCategoria } = useParams();
  const context = useOutletContext() || {};

  const {
    datosScreener = [],
    setDatosScreener,
    registrosTradfi = [],
    ejecutandoInsight = false,
    isLoading: contextIsLoading = false,
    onEjecutarAnalisis: onAnalisisGlobal,
    onExportarCSV,
    isExporting = false
  } = context;

  const onEjecutarAnalisis = onRefrescarExterno || onAnalisisGlobal;

  // Normalización del slug de categoría
  const categoriaSlug = (propCategoria || paramCategoria || 'cripto').toLowerCase().trim();
  const meta = METADATA_MERCADOS[categoriaSlug] || METADATA_MERCADOS.cripto;
  const IconoMercado = meta.icono;

  // Lista de sub-pestañas para la categoría activa
  const subPestanasDisponibles = SUB_PESTANAS_POR_MERCADO[categoriaSlug] || [];
  const defaultSubPestana = subPestanasDisponibles[0]?.id || 'todos';

  const [subPestanaActiva, setSubPestanaActiva] = useState(defaultSubPestana);
  const [activosLocales, setActivosLocales] = useState([]);
  const [cargandoApi, setCargandoApi] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Reiniciar sub-pestaña al cambiar de categoría
  useEffect(() => {
    const defaultId = SUB_PESTANAS_POR_MERCADO[categoriaSlug]?.[0]?.id || 'todos';
    setSubPestanaActiva(defaultId);
  }, [categoriaSlug]);

  // =========================================================================
  // FETCH EXPLÍCITO POR CATEGORÍA (/api/scrapper-tradfi?categoria=... o /api/bot)
  // =========================================================================
  useEffect(() => {
    // Si la vista padre (ej. Indices.jsx) ya gestiona la carga externa, omitir fetch redundante
    if (isLoadingExterno !== null) {
      return;
    }

    let isMounted = true;

    async function cargarCatalogoCategoria() {
      setCargandoApi(true);
      setIsLoading(true);
      try {
        let endpoint = '';
        if (categoriaSlug === 'indices') {
          endpoint = '/api/scrapper-tradfi?categoria=indices';
        } else if (categoriaSlug === 'acciones') {
          endpoint = subPestanaActiva === 'dividendos'
            ? '/api/scrapper-tradfi?categoria=etfs'
            : '/api/scrapper-tradfi?categoria=acciones';
        } else if (categoriaSlug === 'bonos') {
          endpoint = '/api/scrapper-tradfi?categoria=bonos';
        } else if (categoriaSlug === 'cripto') {
          endpoint = '/api/bot';
        } else {
          endpoint = `/api/scrapper-tradfi?categoria=${encodeURIComponent(categoriaSlug)}`;
        }

        const res = await fetch(endpoint);
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data.screener) && data.screener.length > 0
            ? data.screener
            : (Array.isArray(data.activos) && data.activos.length > 0 ? data.activos : []);

          if (isMounted && items.length > 0) {
            setActivosLocales(items);

            // Sincronizar en el estado global para que contadores de toda la app se actualicen
            if (typeof setDatosScreener === 'function') {
              setDatosScreener(prev => {
                const mapa = new Map();
                (prev || []).forEach(it => {
                  const k = (it.activo || it.ticker || '').toUpperCase();
                  if (k) mapa.set(k, it);
                });
                items.forEach(it => {
                  const k = (it.activo || it.ticker || '').toUpperCase();
                  if (k) mapa.set(k, it);
                });
                return Array.from(mapa.values());
              });
            }
          }
        }
      } catch (err) {
        console.warn(`[VistaMercado] Error en fetch de ${categoriaSlug}:`, err);
      } finally {
        if (isMounted) {
          setCargandoApi(false);
          setIsLoading(false);
        }
      }
    }

    cargarCatalogoCategoria();
    return () => { isMounted = false; };
  }, [categoriaSlug, subPestanaActiva, setDatosScreener]);

  // Conteo dinámico de activos de la categoría disponibles en memoria
  const activosEnMemoria = useMemo(() => {
    const mapaUnificado = new Map();

    (datosScreener || []).forEach(item => {
      const k = (item.activo || item.ticker || '').toUpperCase();
      if (k) mapaUnificado.set(k, item);
    });

    (activosLocales || []).forEach(item => {
      const k = (item.activo || item.ticker || '').toUpperCase();
      if (k) mapaUnificado.set(k, item);
    });

    (activosExternos || []).forEach(item => {
      const k = (item.activo || item.ticker || '').toUpperCase();
      if (k) mapaUnificado.set(k, item);
    });

    const lista = Array.from(mapaUnificado.values());

    return lista.filter(item => {
      const cat = clasificarActivo(item);
      if (categoriaSlug === 'cripto') return cat === 'Criptomonedas';
      if (categoriaSlug === 'acciones') return cat === 'Acciones';
      if (categoriaSlug === 'indices') return cat === 'Índices';
      if (categoriaSlug === 'bonos') return cat === 'Bonos';
      return false;
    });
  }, [datosScreener, activosLocales, categoriaSlug]);

  // Filtrado modular dinámico por Sub-Pestaña activa
  const activosFiltrados = useMemo(() => {
    if (!subPestanaActiva || subPestanaActiva === 'global' || subPestanaActiva === 'todos' || subPestanaActiva === 'todas') {
      return activosEnMemoria;
    }

    const grupoActual = GRUPOS_TICKERS[categoriaSlug]?.[subPestanaActiva];

    if (grupoActual) {
      return activosEnMemoria.filter(item => {
        const t = (item.activo || item.ticker || '').toUpperCase();
        return grupoActual.has(t);
      });
    }

    // Regla especial para acciones líderes (excluye dividendos y BYMA local)
    if (categoriaSlug === 'acciones' && subPestanaActiva === 'lideres') {
      const divSet = GRUPOS_TICKERS.acciones.dividendos;
      const bymaSet = GRUPOS_TICKERS.acciones.byma;
      return activosEnMemoria.filter(item => {
        const t = (item.activo || item.ticker || '').toUpperCase();
        return !divSet.has(t) && !bymaSet.has(t) && !t.endsWith('.BA') && t !== '^MERV';
      });
    }

    return activosEnMemoria;
  }, [activosEnMemoria, categoriaSlug, subPestanaActiva]);

  // Conteos dinámicos para los badges de las sub-pestañas
  const conteosSubPestanas = useMemo(() => {
    const conteos = {};
    const grupos = GRUPOS_TICKERS[categoriaSlug] || {};

    subPestanasDisponibles.forEach(tab => {
      if (tab.id === 'global' || tab.id === 'todos' || tab.id === 'todas') {
        conteos[tab.id] = activosEnMemoria.length;
      } else if (categoriaSlug === 'acciones' && tab.id === 'lideres') {
        const divSet = grupos.dividendos || new Set();
        const bymaSet = grupos.byma || new Set();
        conteos[tab.id] = activosEnMemoria.filter(item => {
          const t = (item.activo || item.ticker || '').toUpperCase();
          return !divSet.has(t) && !bymaSet.has(t) && !t.endsWith('.BA') && t !== '^MERV';
        }).length;
      } else if (grupos[tab.id]) {
        const setTarget = grupos[tab.id];
        conteos[tab.id] = activosEnMemoria.filter(item => {
          const t = (item.activo || item.ticker || '').toUpperCase();
          return setTarget.has(t);
        }).length;
      } else {
        conteos[tab.id] = 0;
      }
    });

    return conteos;
  }, [activosEnMemoria, categoriaSlug, subPestanasDisponibles]);

  const totalActivosCategoria = activosFiltrados.length;
  const subPestanaMeta = subPestanasDisponibles.find(t => t.id === subPestanaActiva);

  return (
    <div className="space-y-6">
      {/* =========================================================================
          1. HEADER DESTACADO DE LA CATEGORÍA DE MERCADO CON CONTADOR DINÁMICO
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
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${meta.colorBg}`}>
                  {cargandoApi && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                  {totalActivosCategoria > 0
                    ? `${totalActivosCategoria} Activos`
                    : (cargandoApi ? 'Sincronizando Catálogo...' : '0 Activos')}
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
          2. SISTEMA DE SUB-PESTAÑAS UNIVERSALES (Tabs Modulares por Categoría)
      ========================================================================== */}
      {subPestanasDisponibles.length > 0 && (
        <section className="bg-slate-900 p-2 sm:p-2.5 rounded-2xl border border-slate-800 flex flex-wrap items-center gap-2 shadow-sm">
          {subPestanasDisponibles.map(tab => {
            const count = conteosSubPestanas[tab.id] ?? 0;
            const esActiva = subPestanaActiva === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubPestanaActiva(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all duration-150 cursor-pointer ${
                  esActiva
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
                title={tab.desc}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  esActiva ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </section>
      )}

      {/* =========================================================================
          3. GRÁFICO DE VELAS JAPONESAS TRADINGVIEW (FILTRADO DINÁMICO POR SUB-PESTAÑA)
      ========================================================================== */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <span>TradingView LightWeight Charts</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-normal">
              Filtro: {subPestanaMeta ? subPestanaMeta.label : meta.clave}
            </span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            Series Intradiarias OHLC en Vivo
          </span>
        </div>

        <TradFiCandlestickChart
          registrosTradfi={registrosTradfi}
          filtroCategoria={meta.clave}
          datosScreener={activosFiltrados}
        />
      </section>

      {/* =========================================================================
          4. SCREENER DATAGRID CUANTITATIVO CON PAGINACIÓN Y 60 FPS
      ========================================================================== */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-mono font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <span>Terminal Screener Cuantitativo</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-orange-100 text-orange-800 font-bold">
              {subPestanaMeta ? subPestanaMeta.label : meta.clave} ({activosFiltrados.length} Filtrados)
            </span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            RSI(14) • MACD • Bandas de Bollinger • Señales Algorítmicas
          </span>
        </div>

        <ScreenerDataGrid
          datosScreener={activosFiltrados}
          filtroCategoria={meta.clave}
          ejecutandoInsight={Boolean(isLoadingExterno !== null ? isLoadingExterno : (ejecutandoInsight || contextIsLoading || cargandoApi || isLoading))}
          isLoading={Boolean(isLoadingExterno !== null ? isLoadingExterno : (ejecutandoInsight || contextIsLoading || cargandoApi || isLoading))}
          onEjecutarAnalisis={onEjecutarAnalisis}
          onExportarCSV={onExportarCSV}
          isExporting={isExporting}
        />
      </section>
    </div>
  );
}
