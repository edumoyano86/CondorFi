/**
 * ==============================================================================
 * CondorFi - Creador Visual de Estrategias Quants (Strategy Query Builder)
 * Archivo: condorfi-ui/src/pages/StrategyBuilder.jsx
 * 
 * Módulo Institucional para Diseño y Ejecución de Estrategias Cuantitativas:
 * 1. Constructor visual modular: Agrega, edita y conecta bloques de reglas
 *    lógicas con operadores relacionales (>, <, =, CrossUp, CrossDown).
 * 2. Soporte completo de indicadores técnicos clave:
 *    - RSI (14 períodos)
 *    - MACD (Histograma, Línea y Cruces)
 *    - Bandas de Bollinger (%B y Bandwidth)
 *    - Precio vs SMA(20) y Variación 24h
 * 3. Sincronización bidireccional con Supabase ('estrategias_personalizadas')
 *    con fallback transparente en localStorage para funcionamiento offline/local.
 * 4. Sandbox de Prueba en Tiempo Real: Evalúa la estrategia instantáneamente
 *    sobre los 41 activos de datosScreener.
 * 5. Gestor de Estrategias: Activa la estrategia elegida para que el Motor Quant
 *    y el Backtesting la ejecuten en tiempo real.
 * ==============================================================================
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  INDICADORES_CATALOGO,
  OPERADORES_CATALOGO,
  evaluarEstrategiaDinamica
} from '../lib/strategyEvaluator';
import {
  Sliders,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
  Code,
  Copy,
  Layers,
  FlaskConical,
  Activity,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Info
} from 'lucide-react';

const ESTRATEGIAS_DEFAULT = [
  {
    id: 1,
    nombre: 'Mean Reversion Institucional (RSI + BB)',
    descripcion: 'Compra en sobreventa extrema con soporte en banda inferior de Bollinger y momentum positivo.',
    activa: true,
    reglas_json: {
      compras: [
        { indicador: 'RSI', operador: '<', valor: 30, conector: 'AND' },
        { indicador: 'BOLLINGER_PERCENT_B', operador: '<=', valor: 0.20, conector: 'AND' },
        { indicador: 'MACD_HIST', operador: '>', valor: 0, conector: 'AND' }
      ],
      ventas: [
        { indicador: 'RSI', operador: '>', valor: 70, conector: 'OR' },
        { indicador: 'BOLLINGER_PERCENT_B', operador: '>=', valor: 0.85, conector: 'OR' }
      ]
    },
    fecha_creacion: '2026-10-01T12:00:00Z'
  },
  {
    id: 2,
    nombre: 'Breakout Tendencial (Precio > SMA20)',
    descripcion: 'Gatilla compra al quebrar al alza la media móvil de 20 períodos con momentum positivo y sin sobrecompra.',
    activa: false,
    reglas_json: {
      compras: [
        { indicador: 'PRECIO_VS_SMA20', operador: '>', valor: 0.5, conector: 'AND' },
        { indicador: 'MACD_HIST', operador: '>', valor: 0, conector: 'AND' },
        { indicador: 'RSI', operador: '<', valor: 65, conector: 'AND' }
      ],
      ventas: [
        { indicador: 'PRECIO_VS_SMA20', operador: '<', valor: 0, conector: 'OR' },
        { indicador: 'MACD_CRUCE', operador: '=', valor: 'CrossDown', conector: 'OR' }
      ]
    },
    fecha_creacion: '2026-10-05T14:30:00Z'
  }
];

export default function StrategyBuilder() {
  const navigate = useNavigate();
  const context = useOutletContext() || {};
  const { datosScreener = [] } = context;

  // Estado de lista de estrategias
  const [estrategias, setEstrategias] = useState(() => {
    try {
      const guardadas = localStorage.getItem('condorfi_estrategias_personalizadas');
      if (guardadas) {
        const parsed = JSON.parse(guardadas);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return ESTRATEGIAS_DEFAULT;
  });

  const [cargandoDb, setCargandoDb] = useState(false);
  const [notificacion, setNotificacion] = useState(null);
  const [vistaJson, setVistaJson] = useState(false);

  // Estado del formulario de edición activa
  const [estrategiaActualId, setEstrategiaActualId] = useState(1);
  const [nombreEstrategia, setNombreEstrategia] = useState('Mi Estrategia Cuantitativa');
  const [descripcionEstrategia, setDescripcionEstrategia] = useState('Estrategia de momentum y reversión a la media adaptada.');
  
  // Reglas de Compra (Entry) y Venta (Exit)
  const [reglasCompra, setReglasCompra] = useState([
    { id: 1, indicador: 'RSI', operador: '<', valor: 30, conector: 'AND' },
    { id: 2, indicador: 'BOLLINGER_PERCENT_B', operador: '<=', valor: 0.20, conector: 'AND' },
    { id: 3, indicador: 'MACD_HIST', operador: '>', valor: 0, conector: 'AND' }
  ]);

  const [reglasVenta, setReglasVenta] = useState([
    { id: 4, indicador: 'RSI', operador: '>', valor: 70, conector: 'OR' },
    { id: 5, indicador: 'BOLLINGER_PERCENT_B', operador: '>=', valor: 0.85, conector: 'OR' }
  ]);

  // Carga inicial desde Supabase
  const cargarEstrategiasSupabase = useCallback(async () => {
    if (!supabase) return;
    setCargandoDb(true);
    try {
      const { data, error } = await supabase
        .from('estrategias_personalizadas')
        .select('*')
        .order('fecha_creacion', { ascending: false });

      if (!error && data && data.length > 0) {
        setEstrategias(data);
        localStorage.setItem('condorfi_estrategias_personalizadas', JSON.stringify(data));
      }
    } catch (err) {
      console.warn('[StrategyBuilder] Aviso consultando Supabase:', err.message);
    } finally {
      setCargandoDb(false);
    }
  }, []);

  useEffect(() => {
    cargarEstrategiasSupabase();
  }, [cargarEstrategiasSupabase]);

  // Sincronizar editor cuando cambia la estrategia seleccionada
  const cargarEnEditor = useCallback((est) => {
    setEstrategiaActualId(est.id);
    setNombreEstrategia(est.nombre);
    setDescripcionEstrategia(est.descripcion || '');

    const rJson = est.reglas_json || {};
    if (typeof rJson === 'object' && !Array.isArray(rJson)) {
      const bRules = (rJson.compras || rJson.buyRules || []).map((r, i) => ({
        id: Date.now() + i,
        indicador: r.indicador || 'RSI',
        operador: r.operador || '<',
        valor: r.valor ?? 30,
        conector: r.conector || 'AND'
      }));
      const sRules = (rJson.ventas || rJson.sellRules || []).map((r, i) => ({
        id: Date.now() + 100 + i,
        indicador: r.indicador || 'RSI',
        operador: r.operador || '>',
        valor: r.valor ?? 70,
        conector: r.conector || 'OR'
      }));
      setReglasCompra(bRules.length > 0 ? bRules : [{ id: 1, indicador: 'RSI', operador: '<', valor: 30, conector: 'AND' }]);
      setReglasVenta(sRules.length > 0 ? sRules : [{ id: 2, indicador: 'RSI', operador: '>', valor: 70, conector: 'OR' }]);
    } else if (Array.isArray(rJson)) {
      // Si es un array plano
      const bRules = rJson
        .filter(r => r.indicador)
        .map((r, i) => ({
          id: Date.now() + i,
          indicador: r.indicador,
          operador: r.operador || '<',
          valor: r.valor ?? 30,
          conector: r.conector || 'AND'
        }));
      setReglasCompra(bRules);
      setReglasVenta([]);
    }
  }, []);

  // Cargar la primera estrategia al inicio
  useEffect(() => {
    if (estrategias.length > 0) {
      const activa = estrategias.find(e => e.activa) || estrategias[0];
      cargarEnEditor(activa);
    }
  }, [estrategias, cargarEnEditor]);

  // Manejo de reglas en el editor
  const agregarRegla = (tipo) => {
    const nueva = {
      id: Date.now(),
      indicador: tipo === 'compra' ? 'RSI' : 'RSI',
      operador: tipo === 'compra' ? '<' : '>',
      valor: tipo === 'compra' ? 30 : 70,
      conector: tipo === 'compra' ? 'AND' : 'OR'
    };

    if (tipo === 'compra') {
      setReglasCompra([...reglasCompra, nueva]);
    } else {
      setReglasVenta([...reglasVenta, nueva]);
    }
  };

  const eliminarRegla = (tipo, id) => {
    if (tipo === 'compra') {
      if (reglasCompra.length <= 1) {
        alert('Debe conservar al menos una regla de compra.');
        return;
      }
      setReglasCompra(reglasCompra.filter(r => r.id !== id));
    } else {
      setReglasVenta(reglasVenta.filter(r => r.id !== id));
    }
  };

  const actualizarRegla = (tipo, id, campo, valor) => {
    const updater = (lista) =>
      lista.map(r => {
        if (r.id !== id) return r;
        const actual = { ...r, [campo]: valor };
        // Preset automático de valor al cambiar de indicador
        if (campo === 'indicador') {
          const itemCatalogo = INDICADORES_CATALOGO.find(ic => ic.id === valor);
          if (itemCatalogo) {
            actual.valor = itemCatalogo.defaultValor;
            if (valor === 'MACD_CRUCE') {
              actual.operador = '=';
            }
          }
        }
        return actual;
      });

    if (tipo === 'compra') setReglasCompra(updater);
    else setReglasVenta(updater);
  };

  // Objeto JSON final consolidado
  const jsonEstrategiaGenerado = useMemo(() => {
    return {
      compras: reglasCompra.map(({ indicador, operador, valor, conector }) => ({
        indicador,
        operador,
        valor: typeof valor === 'string' && !isNaN(Number(valor)) ? Number(valor) : valor,
        conector
      })),
      ventas: reglasVenta.map(({ indicador, operador, valor, conector }) => ({
        indicador,
        operador,
        valor: typeof valor === 'string' && !isNaN(Number(valor)) ? Number(valor) : valor,
        conector
      }))
    };
  }, [reglasCompra, reglasVenta]);

  // Guardar estrategia
  const guardarEstrategia = async (comoNueva = false) => {
    if (!nombreEstrategia.trim()) {
      alert('Por favor ingrese un nombre para la estrategia.');
      return;
    }

    const payload = {
      nombre: nombreEstrategia.trim(),
      descripcion: descripcionEstrategia.trim(),
      reglas_json: jsonEstrategiaGenerado,
      activa: true,
      updated_at: new Date().toISOString()
    };

    let actualizadas = [...estrategias];

    if (comoNueva || !estrategiaActualId) {
      payload.fecha_creacion = new Date().toISOString();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('estrategias_personalizadas')
            .insert([payload])
            .select();
          if (!error && data && data.length > 0) {
            payload.id = data[0].id;
          }
        } catch (e) {
          console.warn('[StrategyBuilder] Error al insertar en Supabase:', e);
        }
      }
      if (!payload.id) payload.id = Date.now();
      actualizadas = [payload, ...actualizadas.map(e => ({ ...e, activa: false }))];
      setEstrategiaActualId(payload.id);
    } else {
      payload.id = estrategiaActualId;
      if (supabase) {
        try {
          await supabase
            .from('estrategias_personalizadas')
            .update(payload)
            .eq('id', estrategiaActualId);
        } catch (e) {
          console.warn('[StrategyBuilder] Error al actualizar en Supabase:', e);
        }
      }
      actualizadas = actualizadas.map(e => (e.id === estrategiaActualId ? { ...e, ...payload } : e));
    }

    setEstrategias(actualizadas);
    try {
      localStorage.setItem('condorfi_estrategias_personalizadas', JSON.stringify(actualizadas));
    } catch {}

    setNotificacion(`Estrategia "${payload.nombre}" guardada y activada en el Motor Quant.`);
    setTimeout(() => setNotificacion(null), 3500);
  };

  // Conmutar estado activo de una estrategia
  const activarEstrategia = async (id) => {
    const actualizadas = estrategias.map(e => ({
      ...e,
      activa: e.id === id ? !e.activa : false
    }));

    setEstrategias(actualizadas);
    try {
      localStorage.setItem('condorfi_estrategias_personalizadas', JSON.stringify(actualizadas));
    } catch {}

    if (supabase) {
      try {
        await supabase
          .from('estrategias_personalizadas')
          .update({ activa: false })
          .neq('id', 0);

        const est = actualizadas.find(e => e.id === id);
        if (est && est.activa) {
          await supabase
            .from('estrategias_personalizadas')
            .update({ activa: true })
            .eq('id', id);
        }
      } catch (e) {
        console.warn('[StrategyBuilder] Aviso al activar en Supabase:', e);
      }
    }

    const estTarget = actualizadas.find(e => e.id === id);
    setNotificacion(
      estTarget?.activa
        ? `Estrategia "${estTarget.nombre}" activada como motor primario.`
        : `Estrategia desactivada. Motor Quant volvió al modo institucional MTFA.`
    );
    setTimeout(() => setNotificacion(null), 3000);
  };

  // Eliminar estrategia
  const eliminarEstrategia = async (id, nombre) => {
    if (!window.confirm(`¿Deseas eliminar la estrategia "${nombre}"?`)) return;

    if (supabase) {
      try {
        await supabase
          .from('estrategias_personalizadas')
          .delete()
          .eq('id', id);
      } catch (e) {
        console.warn('[StrategyBuilder] Error al eliminar en Supabase:', e);
      }
    }

    const actualizadas = estrategias.filter(e => e.id !== id);
    setEstrategias(actualizadas);
    try {
      localStorage.setItem('condorfi_estrategias_personalizadas', JSON.stringify(actualizadas));
    } catch {}

    if (estrategiaActualId === id && actualizadas.length > 0) {
      cargarEnEditor(actualizadas[0]);
    }
  };

  // Sandbox en vivo: Evaluar la estrategia actual sobre el Screener activo
  const resultadosSandbox = useMemo(() => {
    if (!datosScreener || datosScreener.length === 0) return { compras: [], ventas: [], neutrales: [] };

    const compras = [];
    const ventas = [];
    const neutrales = [];

    datosScreener.forEach(activo => {
      const evalResult = evaluarEstrategiaDinamica(activo, jsonEstrategiaGenerado);
      const item = { ...activo, dictamenDinamico: evalResult.dictamen, detalles: evalResult.detalles };

      if (evalResult.dictamen === 'STRONG_BUY' || evalResult.dictamen === 'BUY') {
        compras.push(item);
      } else if (evalResult.dictamen === 'STRONG_SELL' || evalResult.dictamen === 'SELL') {
        ventas.push(item);
      } else {
        neutrales.push(item);
      }
    });

    return { compras, ventas, neutrales };
  }, [datosScreener, jsonEstrategiaGenerado]);

  return (
    <div className="space-y-6">
      {/* =========================================================================
          1. HEADER INSTITUCIONAL: CREADOR VISUAL DE ESTRATEGIAS
      ========================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 shadow-2xs">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-mono text-slate-900 tracking-tight">
                Creador Visual de Estrategias (Query Builder)
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                Sprint 2 Institucional
              </span>
            </div>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              Diseña reglas booleanas dinámicas para compra y venta. Sobrescribe el CondorScore hardcodeado.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setVistaJson(!vistaJson)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-medium border transition cursor-pointer ${
              vistaJson ? 'bg-slate-900 text-white border-slate-800' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
            }`}
            title="Alternar entre interfaz gráfica y JSON crudo"
          >
            <Code className="w-3.5 h-3.5" />
            <span>{vistaJson ? 'Ver Formulario' : 'Ver JSON'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEstrategiaActualId(null);
              setNombreEstrategia('Nueva Estrategia Personalizada');
              setDescripcionEstrategia('Definición de reglas quant para arbitraje o momentum.');
              setReglasCompra([{ id: Date.now(), indicador: 'RSI', operador: '<', valor: 30, conector: 'AND' }]);
              setReglasVenta([{ id: Date.now() + 1, indicador: 'RSI', operador: '>', valor: 70, conector: 'OR' }]);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpiar</span>
          </button>

          <button
            type="button"
            onClick={() => guardarEstrategia(false)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold text-white bg-orange-600 hover:bg-orange-700 shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Guardar & Activar</span>
          </button>
        </div>
      </div>

      {notificacion && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-mono text-emerald-800 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notificacion}</span>
        </div>
      )}

      {/* =========================================================================
          2. CONSTRUCTOR VISUAL DE CONDICIONES (PANEL DE REGLAS)
      ========================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Metadata de la Estrategia */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 font-mono text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  Nombre de la Estrategia:
                </label>
                <input
                  type="text"
                  value={nombreEstrategia}
                  onChange={e => setNombreEstrategia(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none"
                  placeholder="ej. Divergencia Alcista RSI + MACD"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  Descripción Cuantitativa:
                </label>
                <input
                  type="text"
                  value={descripcionEstrategia}
                  onChange={e => setDescripcionEstrategia(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none"
                  placeholder="ej. Setup de compra en soporte dinámico con rebote..."
                />
              </div>
            </div>
          </div>

          {vistaJson ? (
            /* Vista JSON Crudo */
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-xl font-mono text-xs text-emerald-400 overflow-x-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3 text-slate-400">
                <span className="font-bold flex items-center gap-2">
                  <Code className="w-4 h-4 text-orange-400" />
                  Estructura JSON de Reglas Lógicas (reglas_json)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(jsonEstrategiaGenerado, null, 2));
                    setNotificacion('JSON copiado al portapapeles.');
                    setTimeout(() => setNotificacion(null), 2500);
                  }}
                  className="p-1.5 hover:text-white rounded bg-slate-800 text-slate-300 transition"
                  title="Copiar JSON"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <pre>{JSON.stringify(jsonEstrategiaGenerado, null, 2)}</pre>
            </div>
          ) : (
            <>
              {/* BLOQUE A: Reglas de Entrada (Compra / STRONG_BUY) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <TrendingUp className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold font-mono text-slate-900">
                        Reglas de Entrada (Señal de COMPRA / LONG)
                      </h3>
                      <p className="text-[11px] text-slate-500 font-sans">
                        Si se cumplen todas las condiciones, se emitirá dictamen STRONG_BUY.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => agregarRegla('compra')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Regla</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {reglasCompra.map((regla, idx) => (
                    <div
                      key={regla.id}
                      className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/90 flex flex-wrap items-center gap-3 font-mono text-xs"
                    >
                      {/* Conector lógico (AND/OR) */}
                      {idx > 0 && (
                        <select
                          value={regla.conector}
                          onChange={e => actualizarRegla('compra', regla.id, 'conector', e.target.value)}
                          className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs focus:ring-2 focus:ring-orange-500/20"
                        >
                          <option value="AND">Y (AND)</option>
                          <option value="OR">O (OR)</option>
                        </select>
                      )}

                      {/* Dropdown de Indicador */}
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] text-slate-500 font-bold mb-1">
                          Indicador:
                        </label>
                        <select
                          value={regla.indicador}
                          onChange={e => actualizarRegla('compra', regla.id, 'indicador', e.target.value)}
                          className="w-full p-2 rounded-xl border border-slate-300 bg-white text-xs font-mono focus:ring-2 focus:ring-orange-500/20"
                        >
                          {INDICADORES_CATALOGO.map(ind => (
                            <option key={ind.id} value={ind.id}>
                              {ind.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Dropdown de Operador */}
                      <div className="w-36">
                        <label className="block text-[10px] text-slate-500 font-bold mb-1">
                          Operador:
                        </label>
                        <select
                          value={regla.operador}
                          onChange={e => actualizarRegla('compra', regla.id, 'operador', e.target.value)}
                          className="w-full p-2 rounded-xl border border-slate-300 bg-white text-xs font-mono focus:ring-2 focus:ring-orange-500/20"
                        >
                          {OPERADORES_CATALOGO.map(op => (
                            <option key={op.id} value={op.id}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Input de Valor */}
                      <div className="w-28">
                        <label className="block text-[10px] text-slate-500 font-bold mb-1">
                          Valor Objetivo:
                        </label>
                        {regla.indicador === 'MACD_CRUCE' ? (
                          <select
                            value={regla.valor}
                            onChange={e => actualizarRegla('compra', regla.id, 'valor', e.target.value)}
                            className="w-full p-2 rounded-xl border border-slate-300 bg-white text-xs font-mono"
                          >
                            <option value="CrossUp">CrossUp (Alcista)</option>
                            <option value="CrossDown">CrossDown (Bajista)</option>
                          </select>
                        ) : (
                          <input
                            type="number"
                            step="any"
                            value={regla.valor}
                            onChange={e => actualizarRegla('compra', regla.id, 'valor', e.target.value)}
                            className="w-full p-2 rounded-xl border border-slate-300 bg-white text-xs font-mono text-right"
                          />
                        )}
                      </div>

                      {/* Botón de Eliminación */}
                      <div className="pt-4">
                        <button
                          type="button"
                          onClick={() => eliminarRegla('compra', regla.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Eliminar regla"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* BLOQUE B: Reglas de Salida (Venta / STRONG_SELL) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
                      <TrendingDown className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold font-mono text-slate-900">
                        Reglas de Salida (Señal de VENTA / SHORT)
                      </h3>
                      <p className="text-[11px] text-slate-500 font-sans">
                        Condiciones que activan toma de ganancia, stop loss o señal de venta.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => agregarRegla('venta')}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Regla</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {reglasVenta.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 font-mono text-xs border border-dashed border-slate-200 rounded-xl">
                      Sin reglas de venta configuradas. Se utilizarán salidas estándar del motor.
                    </div>
                  ) : (
                    reglasVenta.map((regla, idx) => (
                      <div
                        key={regla.id}
                        className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/90 flex flex-wrap items-center gap-3 font-mono text-xs"
                      >
                        {idx > 0 && (
                          <select
                            value={regla.conector}
                            onChange={e => actualizarRegla('venta', regla.id, 'conector', e.target.value)}
                            className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-800 text-xs"
                          >
                            <option value="OR">O (OR)</option>
                            <option value="AND">Y (AND)</option>
                          </select>
                        )}

                        <div className="flex-1 min-w-[200px]">
                          <label className="block text-[10px] text-slate-500 font-bold mb-1">
                            Indicador:
                          </label>
                          <select
                            value={regla.indicador}
                            onChange={e => actualizarRegla('venta', regla.id, 'indicador', e.target.value)}
                            className="w-full p-2 rounded-xl border border-slate-300 bg-white text-xs font-mono"
                          >
                            {INDICADORES_CATALOGO.map(ind => (
                              <option key={ind.id} value={ind.id}>
                                {ind.nombre}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="w-36">
                          <label className="block text-[10px] text-slate-500 font-bold mb-1">
                            Operador:
                          </label>
                          <select
                            value={regla.operador}
                            onChange={e => actualizarRegla('venta', regla.id, 'operador', e.target.value)}
                            className="w-full p-2 rounded-xl border border-slate-300 bg-white text-xs font-mono"
                          >
                            {OPERADORES_CATALOGO.map(op => (
                              <option key={op.id} value={op.id}>
                                {op.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="w-28">
                          <label className="block text-[10px] text-slate-500 font-bold mb-1">
                            Valor Objetivo:
                          </label>
                          <input
                            type="number"
                            step="any"
                            value={regla.valor}
                            onChange={e => actualizarRegla('venta', regla.id, 'valor', e.target.value)}
                            className="w-full p-2 rounded-xl border border-slate-300 bg-white text-xs font-mono text-right"
                          />
                        </div>

                        <div className="pt-4">
                          <button
                            type="button"
                            onClick={() => eliminarRegla('venta', regla.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* SANDBOX DE PRUEBA EN VIVO */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-orange-50 text-orange-600 border border-orange-200">
                  <Activity className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-bold font-mono text-slate-900">
                    Radar Sandbox: Prueba en Vivo sobre 41 Activos
                  </h3>
                  <p className="text-[11px] text-slate-500 font-sans">
                    Evaluación instantánea de las reglas sobre las cotizaciones actuales de mercado.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                  {resultadosSandbox.compras.length} Compras
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-bold">
                  {resultadosSandbox.ventas.length} Ventas
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                  {resultadosSandbox.neutrales.length} Neutrales
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-56 overflow-y-auto font-mono text-xs pr-1">
              {resultadosSandbox.compras.map(c => (
                <div key={c.activo} className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900">{c.activo}</span>
                    <span className="text-[10px] text-slate-500">{c.nombre}</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px]">
                    STRONG_BUY
                  </span>
                </div>
              ))}

              {resultadosSandbox.ventas.map(v => (
                <div key={v.activo} className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900">{v.activo}</span>
                    <span className="text-[10px] text-slate-500">{v.nombre}</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px]">
                    STRONG_SELL
                  </span>
                </div>
              ))}

              {resultadosSandbox.compras.length === 0 && resultadosSandbox.ventas.length === 0 && (
                <div className="col-span-2 py-6 text-center text-slate-400">
                  Ningún activo del universo cumple actualmente las condiciones estrictas de compra o venta.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================================
            3. PANEL LATERAL: GESTOR DE ESTRATEGIAS GUARDADAS
        ========================================================================== */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-orange-600" />
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-slate-800">
                  Estrategias Guardadas ({estrategias.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={cargarEstrategiasSupabase}
                disabled={cargandoDb}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                title="Refrescar desde Supabase"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cargandoDb ? 'animate-spin text-orange-600' : ''}`} />
              </button>
            </div>

            <div className="space-y-3">
              {estrategias.map(est => {
                const esActiva = Boolean(est.activa);
                const esSeleccionada = est.id === estrategiaActualId;

                return (
                  <div
                    key={est.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      esSeleccionada
                        ? 'bg-orange-50/30 border-orange-400 ring-1 ring-orange-400/20 shadow-xs'
                        : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="font-bold font-mono text-xs text-slate-900 leading-tight">
                          {est.nombre}
                        </h4>
                        <p className="text-[11px] text-slate-500 font-sans mt-0.5 line-clamp-2">
                          {est.descripcion || 'Sin descripción'}
                        </p>
                      </div>

                      {/* Switch de activación */}
                      <button
                        type="button"
                        onClick={() => activarEstrategia(est.id)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border transition cursor-pointer shrink-0 ${
                          esActiva
                            ? 'bg-emerald-500 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400'
                        }`}
                        title={esActiva ? 'Estrategia activa en Motor Quant' : 'Activar como motor primario'}
                      >
                        {esActiva ? '● ACTIVA' : 'INACTIVA'}
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => cargarEnEditor(est)}
                        className="text-orange-600 hover:text-orange-700 font-bold hover:underline cursor-pointer"
                      >
                        Cargar en Editor
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            navigate('/backtest');
                          }}
                          className="p-1 text-slate-400 hover:text-emerald-600 rounded transition"
                          title="Simular en Backtesting"
                        >
                          <FlaskConical className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminarEstrategia(est.id, est.nombre)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                          title="Eliminar estrategia"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Acción de guardado secundario */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => guardarEstrategia(true)}
                className="w-full py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                + Guardar como Nueva Copia
              </button>

              <button
                type="button"
                onClick={() => {
                  const desactivadas = estrategias.map(e => ({ ...e, activa: false }));
                  setEstrategias(desactivadas);
                  localStorage.setItem('condorfi_estrategias_personalizadas', JSON.stringify(desactivadas));
                  setNotificacion('Estrategias personalizadas pausadas. Motor volvió al CondorScore base.');
                  setTimeout(() => setNotificacion(null), 3000);
                }}
                className="w-full py-2 rounded-xl text-[11px] font-mono text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                Restaurar CondorScore Institucional (Default)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

