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
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import condorLogo from '../assets/condorfi-logo.png';
import { useCurrency } from '../context/CurrencyContext';
import { useAuth } from '../context/AuthContext';
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
  Briefcase,
  Sliders,
  LogIn,
  LogOut,
  UserCheck,
  ShieldCheck,
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
    path: '/portfolio',
    label: 'Portafolio',
    subLabel: 'Cartera Activa & PnL',
    icon: Briefcase,
    badge: 'Live'
  },
  {
    path: '/estrategias',
    label: 'Estrategias',
    subLabel: 'Query Builder Visual',
    icon: Sliders,
    badge: 'Rules'
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
  const { monedaGlobal, setMonedaGlobal, tasaCambio } = useCurrency();
  const { user, signOut, isAuthenticated } = useAuth();

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
    if (ruta.startsWith('/portfolio') || ruta.startsWith('/cartera')) {
      return {
        titulo: 'Gestor de Portafolio Institucional & Tracker de PnL',
        subtitulo: 'Monitoreo de cartera activa, mark-to-market continuo y exposición multidivisa',
        badge: 'Portfolio Live'
      };
    }
    if (ruta.startsWith('/estrategias') || ruta.startsWith('/strategy-builder') || ruta.startsWith('/builder')) {
      return {
        titulo: 'Creador Visual de Estrategias Quants (Query Builder)',
        subtitulo: 'Diseña y ejecuta reglas lógicas booleanas dinámicas para compra y venta',
        badge: 'Rule Engine'
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
          {/* Card de Usuario Autenticado / Login CTA */}
          {isAuthenticated ? (
            <div className="p-3 rounded-xl border border-slate-800/90 bg-slate-900/80 text-slate-300">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-emerald-400" />
                  <span>Operador RLS</span>
                </span>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ACTIVO
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="truncate min-w-0">
                  <p className="text-xs font-mono font-bold text-white truncate">
                    {user?.user_metadata?.nombre || user?.email?.split('@')[0]}
                  </p>
                  <p className="text-[10px] font-mono text-slate-400 truncate">
                    {user?.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={signOut}
                  title="Cerrar sesión"
                  className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <Link
              to="/auth"
              className="block p-3 rounded-xl border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/15 text-orange-300 text-center text-xs font-mono font-bold transition-all group"
            >
              <div className="flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform" />
                <span>Acceso Institucional</span>
              </div>
              <span className="block text-[10px] text-slate-400 font-sans font-normal mt-0.5">
                Inicia sesión para Portafolio & Reglas
              </span>
            </Link>
          )}

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
              <strong className="text-slate-200">70+ Tickers</strong>
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
            {/* Switcher Multidivisa Estilo Bloomberg Terminal */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-lg p-0.5 shadow-xs font-mono">
                <button
                  type="button"
                  onClick={() => setMonedaGlobal('ARS')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    monedaGlobal === 'ARS'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Visualizar precios en Pesos Argentinos (ARS)"
                >
                  ARS
                </button>
                <button
                  type="button"
                  onClick={() => setMonedaGlobal('USD')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    monedaGlobal === 'USD'
                      ? 'bg-emerald-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Visualizar precios en Dólares Estadounidenses (USD)"
                >
                  USD
                </button>
              </div>

              {/* FX Rate Pill (Binance USDT/ARS) */}
              <div
                className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-600 shadow-2xs"
                title="Tipo de cambio Binance USDT/ARS en tiempo real"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-slate-400">USDT/ARS:</span>
                <strong className="text-slate-800 font-bold">
                  ${tasaCambio ? tasaCambio.toLocaleString('es-AR', { maximumFractionDigits: 1 }) : '---'}
                </strong>
              </div>
            </div>

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

            {/* Estado de Autenticación Institucional (SaaS) */}
            {isAuthenticated ? (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700/80 text-white shadow-2xs">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-[10px] font-bold text-white uppercase shrink-0">
                    {(user?.user_metadata?.nombre || user?.email || 'U').charAt(0)}
                  </div>
                  <div className="hidden xl:block text-left">
                    <span className="block text-[11px] font-mono font-bold leading-tight truncate max-w-[100px]">
                      {user?.user_metadata?.nombre || user?.email?.split('@')[0]}
                    </span>
                    <span className="block text-[9px] font-mono text-emerald-400 font-semibold leading-tight">
                      PRO TRADER
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={signOut}
                  title="Cerrar sesión institucional"
                  className="p-1.5 rounded-lg border border-slate-200 hover:border-rose-300 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <Link
                to="/auth"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition active:scale-95 cursor-pointer ml-1"
              >
                <LogIn className="w-3.5 h-3.5 text-orange-400" />
                <span className="hidden sm:inline">Iniciar Sesión</span>
              </Link>
            )}
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
