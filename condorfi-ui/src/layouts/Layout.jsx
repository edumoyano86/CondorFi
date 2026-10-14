/**
 * ==============================================================================
 * CondorFi - Layout Principal (Multi-Página SPA)
 * Archivo: condorfi-ui/src/layouts/Layout.jsx
 * 
 * Marco base institucional con navegación lateral (Sidebar) oscura y minimalista:
 * - 🏠 Dashboard (Resumen General) -> /
 * - 🪙 Criptomonedas -> /cripto
 * - 🏢 Acciones -> /acciones
 * - 📊 Índices -> /indices
 * - 🏛️ Bonos -> /bonos
 * ==============================================================================
 */

import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import condorLogo from '../assets/condorfi-logo.png';
import {
  LayoutDashboard,
  Coins,
  Building2,
  BarChart3,
  Landmark,
  Radio,
  Bell,
  BellOff,
  RefreshCw,
  Database,
  Cpu,
  Layers,
  ArrowUpRight,
  FlaskConical
} from 'lucide-react';

export const RUTAS_NAVEGACION = [
  {
    path: '/',
    label: 'Dashboard',
    subLabel: 'Resumen General',
    icon: LayoutDashboard,
    badge: 'Quant',
    exact: true
  },
  {
    path: '/cripto',
    label: 'Criptomonedas',
    subLabel: 'Spreads & Paridades',
    icon: Coins,
    badge: '20'
  },
  {
    path: '/acciones',
    label: 'Acciones',
    subLabel: 'Wall Street & BYMA',
    icon: Building2,
    badge: '13'
  },
  {
    path: '/indices',
    label: 'Índices',
    subLabel: 'Benchmarks Globales',
    icon: BarChart3,
    badge: '5'
  },
  {
    path: '/bonos',
    label: 'Bonos',
    subLabel: 'Renta Fija Soberana',
    icon: Landmark,
    badge: '3'
  },
  {
    path: '/backtest',
    label: 'Backtesting',
    subLabel: 'Simulación Quant',
    icon: FlaskConical,
    badge: 'Lab'
  }
];

export default function Layout({
  conectadoSupabase = false,
  alertasHabilitadas = false,
  toggleAlertas,
  fetchCotizacionesReales,
  estaActualizando = false,
  ultimaSincronizacion = 'Sincronizado',
  outletContext = {}
}) {
  const location = useLocation();

  // Título dinámico para el Header según la ruta actual
  const obtenerTituloRuta = () => {
    const ruta = location.pathname;
    if (ruta === '/' || ruta === '') {
      return {
        titulo: 'Dashboard Gerencial & Radar Quant',
        subtitulo: 'Monitoreo consolidado de 41 activos y modelos estadísticos en tiempo real',
        badge: 'Institucional'
      };
    }
    if (ruta.startsWith('/cripto')) {
      return {
        titulo: 'Mercado de Criptomonedas (20 Activos)',
        subtitulo: 'Cotizaciones en vivo en pesos argentinos, arbitraje multi-exchange y momentum',
        badge: '20 Criptoactivos'
      };
    }
    if (ruta.startsWith('/acciones')) {
      return {
        titulo: 'Renta Variable: Acciones Tech & Locales (13 Activos)',
        subtitulo: 'Big Tech NASDAQ (AAPL, MSFT, NVDA...) y líderes BYMA (GGAL, YPFD, PAMP)',
        badge: '13 Acciones'
      };
    }
    if (ruta.startsWith('/indices')) {
      return {
        titulo: 'Índices Financieros Globales (5 Benchmarks)',
        subtitulo: 'S&P 500, Nasdaq 100, Dow Jones Industrial, Russell 2000 y S&P Merval',
        badge: '5 Índices'
      };
    }
    if (ruta.startsWith('/bonos')) {
      return {
        titulo: 'Renta Fija: Bonos Soberanos & Treasuries (3 Activos)',
        subtitulo: 'Bonar 2030 (AL30.BA), Global 2030 (GD30.BA) y Treasuries Americanos (TLT)',
        badge: '3 Bonos'
      };
    }
    if (ruta.startsWith('/backtest')) {
      return {
        titulo: 'Laboratorio Quant & Motor de Backtesting',
        subtitulo: 'Simulación causal de CondorScore sobre velas históricas sin sesgo de anticipación',
        badge: 'Quant Lab'
      };
    }
    return {
      titulo: 'Terminal Cuantitativa CondorFi',
      subtitulo: 'Plataforma institucional de arbitraje e inteligencia financiera',
      badge: 'Multi-Activo'
    };
  };

  const encabezado = obtenerTituloRuta();

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-800 antialiased overflow-hidden font-sans">
      {/* =========================================================================
          1. BARRA DE NAVEGACIÓN LATERAL (SIDEBAR OSCURA Y MINIMALISTA)
      ========================================================================== */}
      <aside className="w-64 bg-[#0A0D14] border-r border-slate-800/80 flex flex-col justify-between z-30 shadow-2xl shrink-0 select-none">
        <div>
          {/* Header del Sidebar: Logo Institucional CondorFi */}
          <div className="p-5 border-b border-slate-800/70 flex items-center gap-3">
            <div className="relative">
              <img
                src={condorLogo}
                alt="CondorFi Isotipo"
                className="w-10 h-10 object-cover rounded-xl border border-slate-700/80 shadow-md ring-1 ring-orange-500/20"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0A0D14] animate-pulse"></span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-wider text-white">
                  CONDOR<span className="text-orange-500">FI</span>
                </span>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  v2.5
                </span>
              </div>
              <p className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                QUANT TERMINAL
              </p>
            </div>
          </div>

          {/* Menú de Enlaces SPA (react-router-dom) */}
          <nav className="p-3.5 space-y-1.5">
            <p className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              Vistas Institucionales
            </p>
            {RUTAS_NAVEGACION.map(ruta => {
              const Icon = ruta.icon;
              return (
                <NavLink
                  key={ruta.path}
                  to={ruta.path}
                  end={ruta.exact}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-mono transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-orange-500/15 text-orange-400 font-bold border border-orange-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60 font-medium'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-110" />
                    <div>
                      <span className="block text-xs leading-none">{ruta.label}</span>
                      <span className="block text-[10px] text-slate-500 font-sans mt-0.5 leading-none">
                        {ruta.subLabel}
                      </span>
                    </div>
                  </div>
                  {ruta.badge && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-slate-700/60 bg-slate-900/80 text-slate-300">
                      {ruta.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer del Sidebar: Telemetría de Base de Datos y Engine */}
        <div className="p-4 border-t border-slate-800/70 space-y-3 bg-[#080A10]">
          {/* Card de Conexión Supabase */}
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-400">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[11px] font-mono font-bold text-slate-200">Supabase DB</span>
              </div>
              <span className={`flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full border ${
                conectadoSupabase
                  ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/80'
                  : 'text-amber-400 bg-amber-950/60 border-amber-800/80'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${conectadoSupabase ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                {conectadoSupabase ? 'CONECTADO' : 'SIMULACIÓN'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Universo Activo:</span>
              <strong className="text-slate-200">41 Tickers</strong>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 px-1">
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3 text-orange-500" />
              <span>Vercel Concurrency</span>
            </span>
            <span className="text-emerald-400 font-bold">100% OK</span>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          2. ÁREA DE CONTENIDO PRINCIPAL CON HEADER SUPERIOR
      ========================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header Superior Oscuro Minimalista */}
        <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between shrink-0 shadow-xs z-20">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 font-mono">
                  {encabezado.titulo}
                </h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                  {encabezado.badge}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono hidden sm:block">
                {encabezado.subtitulo}
              </p>
            </div>
          </div>

          {/* Acciones Rápidas del Header */}
          <div className="flex items-center gap-2.5">
            {/* Toggle de Alertas Sonoras y Push */}
            <button
              onClick={toggleAlertas}
              title={alertasHabilitadas ? 'Silenciar alertas' : 'Activar alertas de mercado'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition active:scale-95 cursor-pointer shadow-2xs ${
                alertasHabilitadas
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              {alertasHabilitadas ? (
                <>
                  <Bell className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden md:inline">Alertas ON</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                </>
              ) : (
                <>
                  <BellOff className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden md:inline">Alertas OFF</span>
                </>
              )}
            </button>

            {/* Botón de Escaneo / Sincronización Manual */}
            <button
              onClick={fetchCotizacionesReales}
              disabled={estaActualizando}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold bg-orange-600 hover:bg-orange-700 text-white shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${estaActualizando ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{estaActualizando ? 'Mapeando...' : 'Escanear'}</span>
            </button>

            {/* Reloj de Sincronización */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
              <Radio className="w-3.5 h-3.5 text-orange-600" />
              <span>{ultimaSincronizacion}</span>
            </div>
          </div>
        </header>

        {/* Lienzo con Scroll Interno para las Páginas */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <Outlet context={outletContext} />
        </main>
      </div>
    </div>
  );
}
