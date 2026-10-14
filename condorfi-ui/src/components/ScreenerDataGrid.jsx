/**
 * ==============================================================================
 * CondorFi - Screener DataGrid Cuantitativo (Estilo Bloomberg Terminal)
 * Archivo: condorfi-ui/src/components/ScreenerDataGrid.jsx
 * 
 * Funcionalidades:
 * - Tabla avanzada de alta densidad de información estilo terminal financiera
 * - Columnas ordenables interactivamente: Activo, Precio Actual, CondorScore, RSI, MACD, Señal
 * - Barra visual de progreso para CondorScore (0-100) con gradiente de color dinámico
 * - Badges institucionales para Señales: STRONG_BUY, BUY, HOLD, SELL, STRONG_SELL
 * - Filtros rápidos por mercado: Todos, TradFi, Cripto
 * - Ejecución interactiva del motor cuantitativo (/api/generar-insights)
 * ==============================================================================
 */

import React, { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Zap,
  TrendingUp,
  TrendingDown,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';


export default function ScreenerDataGrid({
  datosScreener = [],
  ejecutandoInsight = false,
  onEjecutarAnalisis,
  onExportarCSV,
  isExporting = false
}) {
  const [columnaOrden, setColumnaOrden] = useState('condorScore');
  const [direccionOrden, setDireccionOrden] = useState('desc'); // 'asc' | 'desc'
  const [filtroMercado, setFiltroMercado] = useState('todos');  // 'todos' | 'tradfi' | 'cripto'
  const [busqueda, setBusqueda] = useState('');
  const [filaExpandida, setFilaExpandida] = useState(null);
  const [paginaActual, setPaginaActual] = useState(1);
  const [filasPorPagina, setFilasPorPagina] = useState(15); // 15 | 30 | 'todos'


  // Manejador del ordenamiento al hacer clic en las cabeceras
  const manejarOrden = (columna) => {
    if (columnaOrden === columna) {
      setDireccionOrden(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setColumnaOrden(columna);
      setDireccionOrden('desc');
    }
  };

  // Filtrado y ordenamiento de los datos del Screener
  const datosProcesados = useMemo(() => {
    let lista = [...datosScreener];

    // 1. Filtrado por mercado
    if (filtroMercado === 'tradfi') {
      lista = lista.filter(item => item.tipoMercado === 'tradfi');
    } else if (filtroMercado === 'cripto') {
      lista = lista.filter(item => item.tipoMercado === 'cripto');
    }

    // 2. Búsqueda por texto (ticker o nombre)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      lista = lista.filter(item =>
        item.activo.toLowerCase().includes(q) ||
        (item.nombre && item.nombre.toLowerCase().includes(q))
      );
    }

    // 3. Ordenamiento dinámico
    lista.sort((a, b) => {
      let valA = a[columnaOrden];
      let valB = b[columnaOrden];

      if (columnaOrden === 'macd') {
        valA = a.macd?.histogram ?? 0;
        valB = b.macd?.histogram ?? 0;
      } else if (columnaOrden === 'activo') {
        valA = a.activo.toLowerCase();
        valB = b.activo.toLowerCase();
      } else if (columnaOrden === 'dictamen') {
        const pesoDictamen = { STRONG_BUY: 5, BUY: 4, HOLD: 3, SELL: 2, STRONG_SELL: 1 };
        valA = pesoDictamen[a.dictamen] || 0;
        valB = pesoDictamen[b.dictamen] || 0;
      }

      if (valA < valB) return direccionOrden === 'asc' ? -1 : 1;
      if (valA > valB) return direccionOrden === 'asc' ? 1 : -1;
      return 0;
    });

    return lista;
  }, [datosScreener, filtroMercado, busqueda, columnaOrden, direccionOrden]);

  // Cálculos de paginación institucional
  const totalFilas = datosProcesados.length;
  const esModoTodos = filasPorPagina === 'todos';
  const totalPaginas = esModoTodos ? 1 : Math.max(1, Math.ceil(totalFilas / (Number(filasPorPagina) || 15)));

  const datosPaginados = useMemo(() => {
    if (esModoTodos) return datosProcesados;
    const porPag = Number(filasPorPagina) || 15;
    const inicio = (paginaActual - 1) * porPag;
    return datosProcesados.slice(inicio, inicio + porPag);
  }, [datosProcesados, paginaActual, filasPorPagina, esModoTodos]);


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

  // Badge institucional para la Señal (Dictamen Final)
  const renderBadgeDictamen = (dictamen) => {
    switch (dictamen) {
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
              Bloomberg Terminal Style
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1 font-mono">
            Modelos de Valuación Cuantitativa: RSI(14) • MACD(12,26,9) • Bandas de Bollinger(20,2σ) • CondorScore Institucional
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

      {/* 2. BARRA DE HERRAMIENTAS: BÚSQUEDA Y FILTROS POR MERCADO */}
      <div className="p-3 sm:px-5 border-b border-gray-100 bg-gray-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 flex items-center gap-1 font-semibold">
            <Filter className="w-3.5 h-3.5" /> Filtrar:
          </span>
          <div className="flex items-center p-0.5 rounded-lg bg-gray-200/80 border border-gray-300/80">
            {[
              { id: 'todos', label: 'Todos' },
              { id: 'tradfi', label: 'TradFi (Acciones/ETFs)' },
              { id: 'cripto', label: 'Cripto ARS' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFiltroMercado(tab.id)}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer font-bold ${
                  filtroMercado === tab.id
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Buscador de Ticker */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar activo (SPY, BTC, AAPL)..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
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

                const estiloScore = obtenerEstiloScore(item.condorScore);
                const esFilaAbierta = filaExpandida === item.activo;
                const rsi = Number(item.rsi || 50);
                const macd = item.macd || {};

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
                        <div className="font-bold text-gray-900 text-sm">
                          {formatearPrecio(item.precioActual, item.moneda, item.activo)}
                        </div>
                        <div className="text-[10px] font-mono">
                          <span className={item.variacion24h >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                            {item.variacion24h >= 0 ? `+${item.variacion24h}%` : `${item.variacion24h}%`}
                          </span>
                        </div>
                      </td>

                      {/* 3. CondorScore con barra visual de progreso */}
                      <td className="py-3 px-4">
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
                      </td>

                      {/* 4. RSI (14) */}
                      <td className="py-3 px-4 text-center">
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
                      </td>

                      {/* 5. MACD */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`font-bold text-xs ${
                            macd.histogram > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {macd.histogram !== undefined ? (macd.histogram > 0 ? `+${macd.histogram}` : macd.histogram) : '0.00'}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${
                            macd.trend === 'BULLISH'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {macd.trend || 'NEUTRAL'}
                          </span>
                        </div>
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
                                Muestras analizadas: {item.totalMuestras || 100} registros
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
            ) : (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertTriangle className="w-6 h-6 text-orange-500" />
                    <p className="text-sm font-bold text-gray-800">
                      Sin datos en el Screener Cuantitativo
                    </p>
                    <p className="text-xs text-gray-400 max-w-sm">
                      Ejecuta el escaneo para calcular en vivo el RSI(14), MACD y Bandas de Bollinger sobre el universo de activos.
                    </p>
                    {onEjecutarAnalisis && (
                      <button
                        onClick={onEjecutarAnalisis}
                        disabled={ejecutandoInsight}
                        className="mt-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white transition active:scale-95 shadow-xs"
                      >
                        Iniciar Escaneo Cuantitativo
                      </button>
                    )}
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
            de <strong className="text-gray-800">{totalFilas}</strong> activos analizados
          </span>
          <span className="text-gray-300">•</span>
          <span>Filas por página:</span>
          <div className="flex items-center gap-1 bg-gray-200/80 p-0.5 rounded-lg border border-gray-300/80">
            {[15, 30, 'todos'].map(opcion => (
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

