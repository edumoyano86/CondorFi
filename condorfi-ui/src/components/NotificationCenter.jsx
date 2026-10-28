/**
 * ==============================================================================
 * CondorFi - Centro de Notificaciones & Feed de Señales MTFA
 * Archivo: condorfi-ui/src/components/NotificationCenter.jsx
 * 
 * Funcionalidades Institucionales:
 * 1. Campanita con contador reactivo de señales sin leer en el Header.
 * 2. Panel flotante desplegable estilo Bloomberg Terminal con feed de señales MTFA.
 * 3. Muestra métricas completas de confluencia: Ticker, RSI 1D, RSI 1H, precio y hora.
 * 4. Botón 'Simular Señal en Vivo' ideal para demostraciones en entrevistas/portfolio.
 * 5. Sincronización bidireccional con Supabase ('alertas_historial') y persistencia local.
 * ==============================================================================
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import {
  Bell,
  CheckCheck,
  Trash2,
  Zap,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  Clock,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  X
} from 'lucide-react';

const NOTIFICACIONES_STORAGE_KEY = 'condorfi_feed_alertas_mtfa';

// Señales iniciales de demostración para el portfolio
const ALERTAS_DEMO_INICIALES = [
  {
    id: 'demo-alert-1',
    ticker: 'VIG.BA',
    tipo_alerta: 'COMPRA_SOBREVENTA',
    rsi_1d: 28.4,
    rsi_1h: 24.8,
    precio_actual: 10310.0,
    moneda: 'ARS',
    mensaje: '🦅 ALERTA MTFA: VIG.BA | 🟢 SEÑAL DE COMPRA (RSI 1D: 28.4 • 1H: 24.8) | Precio: $ 10.310,00',
    leida: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString() // hace 18 min
  },
  {
    id: 'demo-alert-2',
    ticker: 'AAPL',
    tipo_alerta: 'VENTA_SOBRECOMPRA',
    rsi_1d: 74.2,
    rsi_1h: 76.5,
    precio_actual: 238.5,
    moneda: 'USD',
    mensaje: '🦅 ALERTA MTFA: AAPL | 🔴 SEÑAL DE VENTA (RSI 1D: 74.2 • 1H: 76.5) | Precio: US$ 238,50',
    leida: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 65).toISOString() // hace 1 hora
  },
  {
    id: 'demo-alert-3',
    ticker: 'BTC',
    tipo_alerta: 'COMPRA_SOBREVENTA',
    rsi_1d: 31.0,
    rsi_1h: 27.5,
    precio_actual: 108420.0,
    moneda: 'USD',
    mensaje: '🦅 ALERTA MTFA: BTC | 🟢 SEÑAL DE COMPRA (RSI 1D: 31.0 • 1H: 27.5) | Precio: US$ 108.420,00',
    leida: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString() // hace 4 horas
  }
];

export default function NotificationCenter() {
  const { user } = useAuth();
  const { monedaGlobal, tasaCambio } = useCurrency();

  const [abierto, setAbierto] = useState(false);
  const [alertas, setAlertas] = useState(() => {
    try {
      const guardadas = localStorage.getItem(NOTIFICACIONES_STORAGE_KEY);
      if (guardadas) {
        const parsed = JSON.parse(guardadas);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return ALERTAS_DEMO_INICIALES;
  });

  const contenedorRef = useRef(null);

  // Cerrar al hacer click fuera del desplegable
  useEffect(() => {
    function handleClickOutside(e) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target)) {
        setAbierto(false);
      }
    }
    if (abierto) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [abierto]);

  // Cargar alertas desde Supabase si la tabla existe
  const cargarAlertasSupabase = useCallback(async () => {
    if (!supabase) return;
    try {
      let query = supabase
        .from('alertas_historial')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(20);

      if (user && user.id && !user.id.startsWith('demo-')) {
        query = query.or(`user_id.eq.${user.id},user_id.is.null`);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        setAlertas(data);
        localStorage.setItem(NOTIFICACIONES_STORAGE_KEY, JSON.stringify(data));
      }
    } catch (err) {
      console.warn('[NotificationCenter] Aviso al consultar alertas:', err.message);
    }
  }, [user]);

  useEffect(() => {
    cargarAlertasSupabase();
  }, [cargarAlertasSupabase]);

  // Total de alertas sin leer
  const totalNoLeidas = alertas.filter(a => !a.leida).length;

  /**
   * Marcar todas las alertas como leídas
   */
  const handleMarcarTodasLeidas = async () => {
    const actualizadas = alertas.map(a => ({ ...a, leida: true }));
    setAlertas(actualizadas);
    localStorage.setItem(NOTIFICACIONES_STORAGE_KEY, JSON.stringify(actualizadas));

    if (supabase && user && !user.id?.startsWith('demo-')) {
      try {
        await supabase
          .from('alertas_historial')
          .update({ leida: true })
          .eq('user_id', user.id);
      } catch {}
    }
  };

  /**
   * Limpiar historial de notificaciones
   */
  const handleLimpiarHistorial = () => {
    setAlertas([]);
    localStorage.removeItem(NOTIFICACIONES_STORAGE_KEY);
  };

  /**
   * Generar Alerta Simulada en Vivo (Herramienta para Portfolio / Entrevistas)
   */
  const handleSimularAlerta = () => {
    const tickersOpciones = ['SPY.BA', 'NVDA', 'AL30.BA', 'ETH', 'MELI.BA', 'TSLA'];
    const tickerElegido = tickersOpciones[Math.floor(Math.random() * tickersOpciones.length)];
    const esCompra = Math.random() > 0.5;

    const rsi1d = esCompra ? Number((22 + Math.random() * 7).toFixed(1)) : Number((72 + Math.random() * 6).toFixed(1));
    const rsi1h = esCompra ? Number((20 + Math.random() * 8).toFixed(1)) : Number((74 + Math.random() * 6).toFixed(1));

    const precioBase = tickerElegido.endsWith('.BA') ? 14200 : 185;
    const precio = Number((precioBase * (1 + (Math.random() * 0.1 - 0.05))).toFixed(2));
    const esArs = tickerElegido.endsWith('.BA');
    const moneda = esArs ? 'ARS' : 'USD';
    const simbolo = esArs ? '$' : 'US$';

    const nuevaAlerta = {
      id: 'sim-' + Date.now(),
      ticker: tickerElegido,
      tipo_alerta: esCompra ? 'COMPRA_SOBREVENTA' : 'VENTA_SOBRECOMPRA',
      rsi_1d: rsi1d,
      rsi_1h: rsi1h,
      precio_actual: precio,
      moneda,
      mensaje: `🦅 ALERTA MTFA: ${tickerElegido} | ${esCompra ? '🟢 SEÑAL DE COMPRA' : '🔴 SEÑAL DE VENTA'} (RSI 1D: ${rsi1d} • 1H: ${rsi1h}) | Precio: ${simbolo} ${precio.toLocaleString('es-AR')}`,
      leida: false,
      timestamp: new Date().toISOString()
    };

    const listaNueva = [nuevaAlerta, ...alertas.slice(0, 19)];
    setAlertas(listaNueva);
    localStorage.setItem(NOTIFICACIONES_STORAGE_KEY, JSON.stringify(listaNueva));
  };

  /**
   * Formatear tiempo relativo amigable (ej. 'hace 5 min')
   */
  const formatearTiempoRelativo = (isoDate) => {
    try {
      const fecha = new Date(isoDate);
      const diffMs = Date.now() - fecha.getTime();
      const diffMin = Math.floor(diffMs / 60000);

      if (diffMin < 1) return 'Hace un momento';
      if (diffMin < 60) return `Hace ${diffMin} min`;
      const diffHoras = Math.floor(diffMin / 60);
      if (diffHoras < 24) return `Hace ${diffHoras} h`;
      const diffDias = Math.floor(diffHoras / 24);
      return `Hace ${diffDias} d`;
    } catch {
      return 'Reciente';
    }
  };

  return (
    <div className="relative" ref={contenedorRef}>
      {/* Botón de la Campana */}
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        title="Centro de Alertas Cuantitativas MTFA"
        className={`relative flex items-center justify-center p-2 rounded-xl border transition-all cursor-pointer shadow-2xs ${
          abierto
            ? 'bg-slate-900 text-orange-400 border-slate-700'
            : totalNoLeidas > 0
            ? 'bg-amber-50 hover:bg-amber-100/80 text-amber-900 border-amber-300'
            : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
        }`}
      >
        <Bell className="w-4 h-4" />
        {totalNoLeidas > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-orange-600 text-[9px] font-black font-mono text-white ring-2 ring-white animate-pulse">
            {totalNoLeidas}
          </span>
        )}
      </button>

      {/* Menú Desplegable Flotante */}
      {abierto && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-2xl z-50 overflow-hidden font-sans animate-in fade-in zoom-in-95 duration-150">
          {/* Header del Panel */}
          <div className="p-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                  Señales Cuantitativas MTFA
                </h3>
                <span className="text-[10px] font-mono text-slate-400">
                  {totalNoLeidas > 0 ? `${totalNoLeidas} nuevas sin leer` : 'Todas leídas'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Barra de Acciones Rápidas */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-mono">
            <button
              type="button"
              onClick={handleSimularAlerta}
              className="text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1 transition cursor-pointer"
              title="Dispara una señal de demostración en tiempo real"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Simular Señal MTFA</span>
            </button>

            {totalNoLeidas > 0 && (
              <button
                type="button"
                onClick={handleMarcarTodasLeidas}
                className="text-slate-500 hover:text-slate-800 flex items-center gap-1 transition cursor-pointer"
              >
                <CheckCheck className="w-3 h-3 text-emerald-600" />
                <span>Marcar leídas</span>
              </button>
            )}
          </div>

          {/* Lista de Alertas */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {alertas.length === 0 ? (
              <div className="py-8 px-4 text-center text-slate-400 font-mono text-xs">
                <Bell className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                <span>No hay señales en el historial</span>
              </div>
            ) : (
              alertas.map((alerta) => {
                const esCompra = alerta.tipo_alerta?.includes('COMPRA');
                const simboloMoneda = alerta.moneda === 'ARS' ? '$' : 'US$';

                return (
                  <div
                    key={alerta.id}
                    className={`p-3.5 hover:bg-slate-50/80 transition-colors ${
                      !alerta.leida ? 'bg-orange-50/30' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                            esCompra
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {esCompra ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                          )}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs text-slate-900">
                              {alerta.ticker}
                            </span>
                            <span
                              className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full border ${
                                esCompra
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {esCompra ? 'COMPRA (Sobreventa)' : 'VENTA (Sobrecompra)'}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-500">
                            Precio:{' '}
                            <strong className="text-slate-800">
                              {simboloMoneda} {Number(alerta.precio_actual || 0).toLocaleString('es-AR')}
                            </strong>
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 shrink-0">
                        <Clock className="w-2.5 h-2.5" />
                        {formatearTiempoRelativo(alerta.timestamp)}
                      </span>
                    </div>

                    {/* Chips de Confluencia Multi-Timeframe */}
                    <div className="flex items-center gap-2 mt-2 pt-1 border-t border-slate-100 text-[10px] font-mono text-slate-600">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-bold">
                        RSI 1D: {alerta.rsi_1d ?? '---'}
                      </span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-bold">
                        RSI 1H: {alerta.rsi_1h ?? '---'}
                      </span>
                      <span className="text-slate-400 text-[9px] ml-auto">MTFA Dual</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer del Panel */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span className="flex items-center gap-1 text-slate-600">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Convergencia Algorítmica MTFA</span>
            </span>

            {alertas.length > 0 && (
              <button
                type="button"
                onClick={handleLimpiarHistorial}
                className="hover:text-rose-600 flex items-center gap-1 transition cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Vaciar</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
