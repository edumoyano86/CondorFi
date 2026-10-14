/**
 * ==============================================================================
 * CondorFi - Screener DataGrid Cuantitativo (Estilo Bloomberg Terminal)
 * Archivo: condorfi-ui/src/components/ScreenerDataGrid.jsx
 * 
 * Funcionalidades Institucionales:
 * - Clasificación modular en 4 Vistas (Tabs): Criptomonedas, Acciones, Índices, Bonos
 * - Menú superior de navegación estilo 'Pills' con contadores dinámicos por categoría
 * - Reducción de carga cognitiva con filtrado estricto por pestaña activa
 * - Estado vacío elegante ('Esperando datos de mercado para esta categoría...')
 * - Columnas ordenables interactivamente: Activo, Precio Actual, CondorScore, RSI, MACD, Señal
 * - Barra visual de progreso para CondorScore (0-100) y badges de Graceful Degradation
 * - Soporte institucional de expansión de fila y exportación CSV
 * ==============================================================================
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Zap,
  Download,
  Search,
  AlertTriangle,
  Clock,
  Info,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// Constantes de clasificación según el universo de CondorFi
export const INDICES_TICKERS = ['^MERV', 'SPY', 'QQQ', 'DIA', 'IWM'];
export const BONOS_TICKERS = ['AL30.BA', 'GD30.BA', 'TLT'];

/**
 * Función auxiliar de clasificación institucional.
 * Clasifica cada activo en una de las 4 categorías:
 * - 'Criptomonedas'
 * - 'Acciones'
 * - 'Índices'
 * - 'Bonos'
 */
export function clasificarActivo(item) {
  if (!item) return 'Acciones';
  const ticker = (item.activo || item.ticker || '').toUpperCase();

  // 1. Criptomonedas: Si su mercado o tipoMercado es cripto
  if (
    item.tipoMercado === 'cripto' ||
    (item.mercado && item.mercado.toLowerCase().includes('cripto'))
  ) {
    return 'Criptomonedas';
  }

  // 2. Índices: Benchmarks globales y Merval
  if (INDICES_TICKERS.includes(ticker)) {
    return 'Índices';
  }

  // 3. Bonos: Soberanos argentinos y Renta Fija US
  if (BONOS_TICKERS.includes(ticker)) {
    return 'Bonos';
  }

  // 4. Acciones: Cualquier activo TradFi restante (tech, NYSE, NASDAQ, BYMA)
  return 'Acciones';
}

export const TABS_CONFIG = [
  { id: 'Criptomonedas', label: '🪙 Criptomonedas' },
  { id: 'Acciones',      label: '🏢 Acciones' },
  { id: 'Índices',       label: '📊 Índices' },
  { id: 'Bonos',         label: '🏛️ Bonos' }
];

export const normalizarCategoria = (cat) => {
  if (!cat) return null;
  const c = String(cat).toLowerCase().trim();
  if (c.includes('bono')) return 'Bonos';
  if (c.includes('accion')) return 'Acciones';
  if (c.includes('indice') || c.includes('índice')) return 'Índices';
  if (c.includes('cripto')) return 'Criptomonedas';
  return cat;
};

export default function ScreenerDataGrid({
  datosScreener = [],
  ejecutandoInsight = false,
  onEjecutarAnalisis,
  onExportarCSV,
  isExporting = false,
  filtroCategoria = null
}) {
  const categoriaNormalizada = useMemo(() => normalizarCategoria(filtroCategoria), [filtroCategoria]);
  // Estado activo de navegación modular (por defecto filtroCategoria o 'Criptomonedas')
  const [tabActivo, setTabActivo] = useState(categoriaNormalizada || 'Criptomonedas');
  const [columnaOrden, setColumnaOrden] = useState('condorScore');
  const [direccionOrden, setDireccionOrden] = useState('desc'); // 'asc' | 'desc'
  const [busqueda, setBusqueda] = useState('');
  const [filaExpandida, setFilaExpandida] = useState(null);
  const [paginaActual, setPaginaActual] = useState(1);
  const [filasPorPagina, setFilasPorPagina] = useState(20); // 10 | 20 | 'todos'

  useEffect(() => {
    if (categoriaNormalizada) {
      setTabActivo(categoriaNormalizada);
      setPaginaActual(1);
      setFilaExpandida(null);
    }
  }, [categoriaNormalizada]);

  const categoriaEfectiva = categoriaNormalizada || tabActivo;

  // Conteo dinámico de activos por categoría para los badges de las pestañas
  const conteoPorCategoria = useMemo(() => {
    const conteo = { Criptomonedas: 0, Acciones: 0, Índices: 0, Bonos: 0 };
    datosScreener.forEach(item => {
      const cat = clasificarActivo(item);
      if (conteo[cat] !== undefined) {
        conteo[cat]++;
      }
    });
    return conteo;
  }, [datosScreener]);

  // Activos pertenecientes a la categoría de la pestaña activa o filtrada
  const datosCategoriaActiva = useMemo(() => {
    return datosScreener.filter(item => clasificarActivo(item) === categoriaEfectiva);
  }, [datosScreener, categoriaEfectiva]);

  // Filtrado por búsqueda y ordenamiento institucional
  const datosProcesados = useMemo(() => {
    let lista = [...datosCategoriaActiva];

    // Búsqueda por texto (ticker o nombre descriptivo)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      lista = lista.filter(item =>
        item.activo.toLowerCase().includes(q) ||
        (item.nombre && item.nombre.toLowerCase().includes(q))
      );
    }

    // Ordenamiento dinámico con tolerancia defensiva a valores nulos
    lista.sort((a, b) => {
      if (columnaOrden === 'condorScore') {
        const numA = typeof a.condorScore === 'number' ? a.condorScore : -1;
        const numB = typeof b.condorScore === 'number' ? b.condorScore : -1;
        if (numA !== numB) {
          return direccionOrden === 'asc' ? numA - numB : numB - numA;
        }
        return a.activo.localeCompare(b.activo);
      }

      let valA = a[columnaOrden];
      let valB = b[columnaOrden];

      if (columnaOrden === 'macd') {
        valA = a.macd?.histogram ?? -9999;
        valB = b.macd?.histogram ?? -9999;
      } else if (columnaOrden === 'rsi') {
        valA = typeof a.rsi === 'number' ? a.rsi : -1;
        valB = typeof b.rsi === 'number' ? b.rsi : -1;
      } else if (columnaOrden === 'precioActual') {
        valA = typeof a.precioActual === 'number' ? a.precioActual : -1;
        valB = typeof b.precioActual === 'number' ? b.precioActual : -1;
      } else if (columnaOrden === 'activo') {
        valA = a.activo.toLowerCase();
        valB = b.activo.toLowerCase();
      } else if (columnaOrden === 'dictamen') {
        const pesoDictamen = { STRONG_BUY: 5, BUY: 4, HOLD: 3, SELL: 2, STRONG_SELL: 1, INSUFFICIENT_DATA: 0 };
        valA = pesoDictamen[a.dictamen] ?? 0;
        valB = pesoDictamen[b.dictamen] ?? 0;
      }

      if (valA < valB) return direccionOrden === 'asc' ? -1 : 1;
      if (valA > valB) return direccionOrden === 'asc' ? 1 : -1;
      return 0;
    });

    return lista;
  }, [datosCategoriaActiva, busqueda, columnaOrden, direccionOrden]);

  // Cálculos de paginación para la vista activa
  const totalFilas = datosProcesados.length;
  const esModoTodos = filasPorPagina === 'todos';
  const totalPaginas = esModoTodos ? 1 : Math.max(1, Math.ceil(totalFilas / (Number(filasPorPagina) || 20)));

  const datosPaginados = useMemo(() => {
    if (esModoTodos) return datosProcesados;
    const porPag = Number(filasPorPagina) || 20;
    const inicio = (paginaActual - 1) * porPag;
    return datosProcesados.slice(inicio, inicio + porPag);
  }, [datosProcesados, paginaActual, filasPorPagina, esModoTodos]);

  // Manejador del ordenamiento al hacer clic en las cabeceras
  const manejarOrden = (columna) => {
    if (columnaOrden === columna) {
      setDireccionOrden(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setColumnaOrden(columna);
      setDireccionOrden('desc');
    }
  };

  // Indicador visual de orden en la cabecera
  const renderIconoOrden = (columna) => {
    if (columnaOrden !== columna) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-60 ml-1 inline" />;
    }
    return direccionOrden === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-orange-600 ml-1 inline" />
      : <ArrowDown className="w-3.5 h-3.5 text-orange-600 ml-1 inline" />;
  };

  // Color y estilo del CondorScore
  const obtenerEstiloScore = (score) => {
    if (score === null || score === undefined) {
      return {
        gradiente: 'from-amber-400 to-amber-500',
        texto: 'text-amber-600',
        fondo: 'bg-amber-400'
      };
    }
    if (score >= 80) {
      return {
        gradiente: 'from-emerald-500 to-teal-400',
        texto: 'text-emerald-700',
        fondo: 'bg-emerald-500'
      };
    }
    if (score >= 60) {
      return {
        gradiente: 'from-teal-500 to-emerald-400',
        texto: 'text-teal-700',
        fondo: 'bg-teal-500'
      };
    }
    if (score >= 40) {
      return {
        gradiente: 'from-amber-400 to-amber-500',
        texto: 'text-amber-700',
        fondo: 'bg-amber-500'
      };
    }
    if (score >= 20) {
      return {
        gradiente: 'from-orange-500 to-rose-500',
        texto: 'text-orange-700',
        fondo: 'bg-orange-500'
      };
    }
    return {
      gradiente: 'from-rose-600 to-red-700',
      texto: 'text-rose-700',
      fondo: 'bg-rose-600'
    };
  };

  // Badge institucional para la Señal (Dictamen Cuantitativo)
  const renderBadgeDictamen = (dictamen) => {
    switch (dictamen) {
      case 'INSUFFICIENT_DATA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            CALCULANDO...
          </span>
        );
      case 'STRONG_BUY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-extrabold bg-emerald-600 text-white shadow-xs tracking-wider ring-1 ring-emerald-500/80 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
            STRONG BUY
          </span>
        );
      case 'BUY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            BUY
          </span>
        );
      case 'SELL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-300">
            SELL
          </span>
        );
      case 'STRONG_SELL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-extrabold bg-rose-600 text-white shadow-xs tracking-wider ring-1 ring-rose-500/80">
            STRONG SELL
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            HOLD
          </span>
        );
    }
  };

  const formatearPrecio = (precio, moneda, ticker) => {
    if (ticker === '^MERV' || moneda === 'ARS') {
      return `$${Math.round(precio).toLocaleString('es-AR')}`;
    }
    return `$${Number(precio).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <section id="radar-insights-quants" className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
      {/* 1. CABECERA BLOOMBERG TERMINAL */}
      <div className="p-4 sm:p-5 border-b border-gray-200 bg-gradient-to-r from-gray-50/90 via-white to-gray-50/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-600" />
            <h3 className="text-base font-extrabold text-gray-900 tracking-tight">
              Screener DataGrid Cuantitativo
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
              Terminal Institucional
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1 font-mono">
            Modelos de Valuación: RSI(14) • MACD(12,26,9) • Bandas de Bollinger(20,2σ) • CondorScore
          </p>
        </div>

        {/* Acciones y Disparador de Análisis */}
        <div className="flex flex-wrap items-center gap-2">
          {onExportarCSV && (
            <button
              onClick={onExportarCSV}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border border-gray-300 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
              title="Descargar historial de cotizaciones en formato CSV"
            >
              <Download className="w-3.5 h-3.5 text-gray-500" />
              <span>{isExporting ? 'Exportando...' : 'Exportar CSV'}</span>
            </button>
          )}

          {onEjecutarAnalisis && (
            <button
              onClick={onEjecutarAnalisis}
              disabled={ejecutandoInsight}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white transition active:scale-95 shadow-xs disabled:opacity-50 cursor-pointer"
              title="Ejecutar motor cuantitativo en paralelo sobre todos los activos"
            >
              <Zap className={`w-3.5 h-3.5 ${ejecutandoInsight ? 'animate-spin' : ''}`} />
              <span>{ejecutandoInsight ? 'Calculando Modelos...' : 'Escanear Todo el Mercado'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. SISTEMA DE PESTAÑAS (TABS) MODULARES CON TAILWIND */}
      <div className="p-3 sm:px-5 border-b border-gray-200 bg-gray-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        {/* Pestañas o Indicador de Categoría Filtrada */}
        {categoriaNormalizada ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-orange-600 text-white shadow-xs">
              <span>
                {categoriaNormalizada === 'Bonos' && '🏛️'}
                {categoriaNormalizada === 'Índices' && '📊'}
                {categoriaNormalizada === 'Acciones' && '🏢'}
                {categoriaNormalizada === 'Criptomonedas' && '🪙'}
              </span>
              <span>{categoriaNormalizada}</span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-orange-700/90 text-orange-50">
                {datosCategoriaActiva.length}
              </span>
            </span>
            <span className="text-[11px] text-gray-500 hidden sm:inline">
              Filtrado por ruta institucional
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {TABS_CONFIG.map(tab => {
              const estaActiva = tabActivo === tab.id;
              const cantidad = conteoPorCategoria[tab.id] || 0;

              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setTabActivo(tab.id);
                    setPaginaActual(1);
                    setFilaExpandida(null);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer select-none whitespace-nowrap ${
                    estaActiva
                      ? 'bg-orange-600 text-white shadow-xs ring-1 ring-orange-500'
                      : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                      estaActiva
                        ? 'bg-orange-700/90 text-orange-50'
                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}
                  >
                    {cantidad}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Buscador de Ticker dentro de la pestaña activa */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={e => {
              setBusqueda(e.target.value);
              setPaginaActual(1);
            }}
            placeholder={`Buscar en ${tabActivo}...`}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-2xs"
          />
        </div>
      </div>

      {/* 3. DATAGRID SCREENER (TABLA ESTILO BLOOMBERG CON STICKY HEADER & SCROLL CONTAINER) */}
      <div className="overflow-x-auto max-h-[620px] overflow-y-auto relative border-b border-gray-200">
        <table className="w-full text-left text-xs font-mono divide-y divide-gray-200">
          <thead className="sticky top-0 z-20 bg-gray-100 shadow-2xs border-b border-gray-200">
            <tr className="bg-gray-100 text-gray-700 font-bold uppercase tracking-wider text-[11px] select-none">

              {/* Columna 1: Activo */}
              <th
                onClick={() => manejarOrden('activo')}
                className="py-3.5 px-4 cursor-pointer hover:bg-gray-200/70 transition"
              >
                <span>Activo</span>
                {renderIconoOrden('activo')}
              </th>

              {/* Columna 2: Precio Actual */}
              <th
                onClick={() => manejarOrden('precioActual')}
                className="py-3.5 px-4 text-right cursor-pointer hover:bg-gray-200/70 transition"
              >
                <span>Precio Actual</span>
                {renderIconoOrden('precioActual')}
              </th>

              {/* Columna 3: CondorScore */}
              <th
                onClick={() => manejarOrden('condorScore')}
                className="py-3.5 px-4 cursor-pointer hover:bg-gray-200/70 transition min-w-[210px]"
              >
                <span>CondorScore (0-100)</span>
                {renderIconoOrden('condorScore')}
              </th>

              {/* Columna 4: RSI (14) */}
              <th
                onClick={() => manejarOrden('rsi')}
                className="py-3.5 px-4 text-center cursor-pointer hover:bg-gray-200/70 transition"
              >
                <span>RSI (14)</span>
                {renderIconoOrden('rsi')}
              </th>

              {/* Columna 5: MACD */}
              <th
                onClick={() => manejarOrden('macd')}
                className="py-3.5 px-4 text-center cursor-pointer hover:bg-gray-200/70 transition"
              >
                <span>MACD (12,26,9)</span>
                {renderIconoOrden('macd')}
              </th>

              {/* Columna 6: Señal */}
              <th
                onClick={() => manejarOrden('dictamen')}
                className="py-3.5 px-4 text-center cursor-pointer hover:bg-gray-200/70 transition"
              >
                <span>Señal</span>
                {renderIconoOrden('dictamen')}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 bg-white">
            {datosPaginados.length > 0 ? (
              datosPaginados.map(item => {
                const esInsuficiente = item.status === 'INSUFFICIENT_DATA' || item.condorScore === null || item.condorScore === undefined;
                const estiloScore = obtenerEstiloScore(item.condorScore);
                const esFilaAbierta = filaExpandida === item.activo;
                const tienePrecio = item.precioActual !== null && item.precioActual !== undefined && item.precioActual > 0;
                const rsi = typeof item.rsi === 'number' ? item.rsi : null;
                const macd = item.macd || null;

                return (
                  <React.Fragment key={item.activo}>
                    <tr
                      onClick={() => setFilaExpandida(esFilaAbierta ? null : item.activo)}
                      className={`hover:bg-orange-50/20 transition cursor-pointer ${
                        item.dictamen === 'STRONG_BUY' ? 'bg-emerald-50/10' : ''
                      }`}
                    >
                      {/* 1. Activo */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-gray-900 px-2 py-0.5 rounded bg-gray-100 border border-gray-200 shadow-2xs">
                            {item.activo}
                          </span>
                          <div>
                            <p className="font-bold text-gray-800 truncate max-w-[150px] sm:max-w-xs text-[11px]">
                              {item.nombre || item.activo}
                            </p>
                            <p className="text-[10px] text-gray-400 font-mono">
                              {item.mercado} • {item.moneda}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* 2. Precio Actual */}
                      <td className="py-3 px-4 text-right">
                        {tienePrecio ? (
                          <>
                            <div className="font-bold text-gray-900 text-sm">
                              {formatearPrecio(item.precioActual, item.moneda, item.activo)}
                            </div>
                            <div className="text-[10px] font-mono">
                              <span className={item.variacion24h >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                {item.variacion24h >= 0 ? `+${item.variacion24h}%` : `${item.variacion24h}%`}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="font-bold text-gray-400 text-sm">—</div>
                            <div className="text-[10px] font-mono text-gray-400">Sin cotización</div>
                          </>
                        )}
                      </td>

                      {/* 3. CondorScore con barra visual de progreso o cartel Calculando... */}
                      <td className="py-3 px-4">
                        {esInsuficiente ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                              Calculando...
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              ({item.totalMuestras || 0}/14 reg.)
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="w-12 text-right">
                              <span className={`text-base font-black font-mono ${estiloScore.texto}`}>
                                {item.condorScore}
                              </span>
                              <span className="text-[10px] text-gray-400 font-medium">/100</span>
                            </div>

                            {/* Barra de progreso visual con gradiente */}
                            <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden border border-gray-200">
                              <div
                                className={`h-full rounded-full bg-gradient-to-r ${estiloScore.gradiente} transition-all duration-500`}
                                style={{ width: `${Math.max(6, item.condorScore)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 4. RSI (14) */}
                      <td className="py-3 px-4 text-center">
                        {rsi !== null ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="font-extrabold text-gray-900 text-xs">
                              {rsi.toFixed(1)}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5 border ${
                              rsi < 30
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : rsi > 70
                                  ? 'bg-rose-100 text-rose-800 border-rose-300'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                            }`}>
                              {rsi < 30 ? 'SOBREVENTA' : rsi > 70 ? 'SOBRECOMPRA' : 'NEUTRAL'}
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span className="font-extrabold text-gray-400 text-xs">—</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5 bg-gray-100 text-gray-500 border border-gray-200">
                              CALCULANDO...
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 5. MACD */}
                      <td className="py-3 px-4 text-center">
                        {macd && macd.histogram !== undefined ? (
                          <div className="inline-flex flex-col items-center">
                            <span className={`font-bold text-xs ${
                              macd.histogram > 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {macd.histogram > 0 ? `+${macd.histogram}` : macd.histogram}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${
                              macd.trend === 'BULLISH'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {macd.trend || 'NEUTRAL'}
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span className="font-bold text-xs text-gray-400">—</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5 bg-gray-100 text-gray-500 border border-gray-200">
                              CALCULANDO...
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 6. Señal */}
                      <td className="py-3 px-4 text-center">
                        {renderBadgeDictamen(item.dictamen)}
                      </td>
                    </tr>

                    {/* Fila expandible con detalle cuantitativo */}
                    {esFilaAbierta && (
                      <tr className="bg-gray-50/80 border-b border-gray-200">
                        <td colSpan={6} className="p-4">
                          <div className="p-4 rounded-xl bg-white border border-gray-200 shadow-2xs space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2">
                              <div className="flex items-center gap-2">
                                <Info className="w-4 h-4 text-orange-600" />
                                <span className="font-bold text-gray-900 text-xs">
                                  Desglose Cuantitativo de {item.activo}
                                </span>
                              </div>
                              <span className="text-[11px] font-mono text-gray-500">
                                Muestras analizadas: {item.totalMuestras || 0} registros
                              </span>
                            </div>

                            <p className="text-xs text-gray-700 font-medium leading-relaxed">
                              {item.mensaje}
                            </p>

                            {item.bollinger && (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono">
                                <div className="p-2 rounded bg-gray-50 border border-gray-100">
                                  <span className="text-gray-400 block text-[10px]">Banda Sup (+2σ)</span>
                                  <strong className="text-gray-800">${item.bollinger.upper}</strong>
                                </div>
                                <div className="p-2 rounded bg-gray-50 border border-gray-100">
                                  <span className="text-gray-400 block text-[10px]">Media SMA(20)</span>
                                  <strong className="text-gray-800">${item.bollinger.middle}</strong>
                                </div>
                                <div className="p-2 rounded bg-gray-50 border border-gray-100">
                                  <span className="text-gray-400 block text-[10px]">Banda Inf (-2σ)</span>
                                  <strong className="text-gray-800">${item.bollinger.lower}</strong>
                                </div>
                                <div className="p-2 rounded bg-gray-50 border border-gray-100">
                                  <span className="text-gray-400 block text-[10px]">Oscilador %B</span>
                                  <strong className="text-emerald-700">{item.bollinger.percentB}</strong>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            ) : datosCategoriaActiva.length === 0 ? (
              /* ESTADO VACÍO ELEGANTE: Si la categoría aún no tiene datos desde Supabase */
              <tr>
                <td colSpan={6} className="py-14 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2.5">
                    <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center border border-amber-200">
                      <Clock className="w-6 h-6 text-amber-600 animate-pulse" />
                    </div>
                    <p className="text-sm font-bold text-gray-900">
                      Esperando datos de mercado para esta categoría...
                    </p>
                    <p className="text-xs text-gray-400 max-w-md leading-relaxed font-mono">
                      Los activos correspondientes a <span className="font-bold text-gray-700">{tabActivo}</span> se sincronizarán en tiempo real con las próximas cotizaciones del swarm.
                    </p>
                    {onEjecutarAnalisis && (
                      <button
                        onClick={onEjecutarAnalisis}
                        disabled={ejecutandoInsight}
                        className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white transition active:scale-95 shadow-xs cursor-pointer"
                      >
                        <Zap className={`w-3.5 h-3.5 ${ejecutandoInsight ? 'animate-spin' : ''}`} />
                        <span>{ejecutandoInsight ? 'Sincronizando...' : 'Escanear Mercado Ahora'}</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              /* ESTADO SIN COINCIDENCIAS POR BÚSQUEDA */
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertTriangle className="w-6 h-6 text-orange-500" />
                    <p className="text-sm font-bold text-gray-800">
                      No se encontraron activos para "{busqueda}" en {tabActivo}
                    </p>
                    <p className="text-xs text-gray-400">
                      Intenta buscando por otro símbolo o limpia el filtro de búsqueda.
                    </p>
                    <button
                      onClick={() => setBusqueda('')}
                      className="mt-2 px-3 py-1 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer"
                    >
                      Limpiar búsqueda
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 4. PIE DE PAGINACIÓN INSTITUCIONAL & CONTROL DE VISTA */}
      <div className="p-3.5 sm:px-5 border-t border-gray-200 bg-gray-50/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-2 text-gray-500">
          <span>
            Mostrando{' '}
            <strong className="text-gray-800">
              {totalFilas === 0 ? 0 : (paginaActual - 1) * (esModoTodos ? totalFilas : Number(filasPorPagina)) + 1}
              {' - '}
              {esModoTodos ? totalFilas : Math.min(paginaActual * Number(filasPorPagina), totalFilas)}
            </strong>{' '}
            de <strong className="text-gray-800">{totalFilas}</strong> activos en{' '}
            <span className="text-orange-700 font-bold">{tabActivo}</span>
          </span>
          <span className="text-gray-300">•</span>
          <span>Filas por página:</span>
          <div className="flex items-center gap-1 bg-gray-200/80 p-0.5 rounded-lg border border-gray-300/80">
            {[10, 20, 'todos'].map(opcion => (
              <button
                key={opcion}
                onClick={() => {
                  setFilasPorPagina(opcion);
                  setPaginaActual(1);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                  filasPorPagina === opcion
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {opcion === 'todos' ? 'Todos' : opcion}
              </button>
            ))}
          </div>
        </div>

        {/* Controles de paginación interactiva cuando hay más de una página */}
        {!esModoTodos && totalPaginas > 1 && (
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              onClick={() => setPaginaActual(prev => Math.max(1, prev - 1))}
              disabled={paginaActual === 1}
              className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
              title="Página anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(num => (
                <button
                  key={num}
                  onClick={() => setPaginaActual(num)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center ${
                    paginaActual === num
                      ? 'bg-orange-600 text-white shadow-2xs'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPaginaActual(prev => Math.min(totalPaginas, prev + 1))}
              disabled={paginaActual === totalPaginas}
              className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
              title="Página siguiente"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
