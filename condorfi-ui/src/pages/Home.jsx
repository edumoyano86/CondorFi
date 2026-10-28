/**
 * ==============================================================================
 * CondorFi - Landing Page Comercial Institucional (Home.jsx)
 * Archivo: condorfi-ui/src/pages/Home.jsx
 * 
 * Portal Comercial de Grado Institucional (SaaS Financiero):
 * - Hero Section con Título 'CondorFi - Terminal Cuantitativa'
 * - Propuesta de valor enfocada en automatización, MTFA y convergencia algorítmica
 * - Botón principal 'Comenzar a Operar' que dirige a /login
 * - Tarjetas de Beneficios Clave:
 *   1. Análisis MTFA (Ponderación dinámica de volatilidad 1d + 1h)
 *   2. Alertas Telegram (Despacho en tiempo real anti-spam)
 *   3. Seguridad RLS (Row Level Security en Supabase para aislamiento multi-tenant)
 * - Muro de Acceso Institucional y Footer Corporativo
 * ==============================================================================
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import condorLogo from '../assets/condorfi-logo.png';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  Zap,
  BarChart3,
  Sliders,
  Send,
  Briefcase,
  Lock,
  ArrowRight,
  ChevronRight,
  Globe,
  Coins,
  Building2,
  Landmark,
  CheckCircle2,
  Cpu,
  Layers,
  Sparkles,
  Terminal,
  Activity,
  LineChart,
  UserCheck,
  ShieldCheck,
  Check
} from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { isAuthenticated, user, loginDemo } = useAuth();

  const handleExplorarDemo = () => {
    if (typeof loginDemo === 'function') {
      loginDemo('Portfolio Reviewer');
    }
    navigate('/dashboard');
  };

  // Snapshot representativo de activos para el radar en vivo
  const ACTIVOS_DESTACADOS = [
    { ticker: 'BTC', nombre: 'Bitcoin', mercado: 'Cripto', precio: '$108,250', variacion: '+4.12%', score: 94, señal: 'STRONG_BUY' },
    { ticker: 'NVDA', nombre: 'NVIDIA Corp', mercado: 'Nasdaq 100', precio: '$138.25', variacion: '+3.48%', score: 88, señal: 'STRONG_BUY' },
    { ticker: 'SPY', nombre: 'S&P 500 ETF', mercado: 'Wall Street', precio: '$585.40', variacion: '+0.85%', score: 82, señal: 'BUY' },
    { ticker: 'GGAL.BA', nombre: 'Grupo Fin. Galicia', mercado: 'BYMA', precio: '$6,420', variacion: '+2.10%', score: 85, señal: 'STRONG_BUY' }
  ];

  // Tres Tarjetas de Beneficios Clave (Análisis MTFA, Alertas Telegram, Seguridad Institucional)
  const BENEFICIOS_PRINCIPALES = [
    {
      id: 'mtfa',
      titulo: 'Análisis MTFA',
      subtitulo: 'Convergencia Dinámica 1d + 1h',
      icono: Layers,
      colorIcono: 'text-orange-400',
      bgIcono: 'bg-orange-500/10 border-orange-500/20',
      badge: 'Core Quant',
      badgeColor: 'border-orange-500/30 text-orange-400 bg-orange-500/10',
      descripcion:
        'Ponderación dinámica automatizada por volatilidad intradiaria (Bollinger Bandwidth): asigna 70% al Micro (1h) en fases de quiebre para capturar momentum, y 80% al Macro (1d) en consolidación lateral para evitar señales falsas.'
    },
    {
      id: 'telegram',
      titulo: 'Alertas Telegram',
      subtitulo: 'Canal Push Institucional en Vivo',
      icono: Send,
      colorIcono: 'text-sky-400',
      bgIcono: 'bg-sky-500/10 border-sky-500/20',
      badge: 'Cero Latencia',
      badgeColor: 'border-sky-500/30 text-sky-400 bg-sky-500/10',
      descripcion:
        'Conexión directa con la API oficial de Telegram. Monitoreo constante de +300 activos con despacho automatizado de oportunidades de alta convicción (STRONG_BUY y STRONG_SELL), precio en vivo y justificación técnica en un solo reporte.'
    },
    {
      id: 'seguridad',
      titulo: 'Seguridad Institucional',
      subtitulo: 'Aislamiento Estricto a Nivel SQL (RLS)',
      icono: ShieldCheck,
      colorIcono: 'text-emerald-400',
      bgIcono: 'bg-emerald-500/10 border-emerald-500/20',
      badge: 'Enterprise Security',
      badgeColor: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
      descripcion:
        'Infraestructura respaldada por Supabase Auth y Row Level Security (RLS). Aislamiento total de carteras, transacciones y reglas cuantitativas personalizadas. Ningún operador puede consultar ni modificar datos ajenos.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 selection:bg-orange-500 selection:text-white font-sans relative overflow-x-hidden">
      {/* Patrón de Grilla Cuantitativa de Fondo */}
      <div 
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#f97316 1px, transparent 1px), linear-gradient(90deg, #f97316 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />

      {/* Glow ambiental superior */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[420px] bg-gradient-to-b from-orange-500/15 via-amber-500/5 to-transparent blur-3xl pointer-events-none" />

      {/* =========================================================================
          1. NAVBAR SUPERIOR PÚBLICA
      ========================================================================== */}
      <nav className="relative z-30 border-b border-slate-800/80 bg-[#07090E]/80 backdrop-blur-md sticky top-0 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <img
                src={condorLogo}
                alt="CondorFi Logo"
                className="w-9 h-9 object-cover rounded-xl border border-slate-700 shadow-md shadow-orange-500/10 group-hover:scale-105 transition-transform"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#07090E] animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black tracking-wider text-white leading-none">
                CONDOR<span className="text-orange-500">FI</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400 tracking-widest mt-0.5 uppercase">
                QUANT TERMINAL
              </span>
            </div>
          </Link>

          {/* Enlaces de Navegación Rápida */}
          <div className="hidden md:flex items-center gap-8 text-xs font-mono text-slate-300">
            <a href="#beneficios" className="hover:text-orange-400 transition-colors">
              Beneficios
            </a>
            <a href="#mtfa" className="hover:text-orange-400 transition-colors">
              Análisis MTFA
            </a>
            <a href="#mercados" className="hover:text-orange-400 transition-colors">
              Mercados
            </a>
            <a href="#seguridad" className="hover:text-orange-400 transition-colors">
              Seguridad RLS
            </a>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-md shadow-orange-600/20 transition-all cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Ingresar a la Terminal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleExplorarDemo}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Modo Demo</span>
                </button>
                <Link
                  to="/login"
                  className="px-3.5 py-2 rounded-xl text-xs font-mono font-semibold text-slate-300 hover:text-white hover:bg-slate-850 transition-colors cursor-pointer"
                >
                  Iniciar Sesión
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-600/30 transition-all cursor-pointer active:scale-95"
                >
                  <span>Comenzar a Operar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* =========================================================================
          2. HERO SECTION COMERCIAL
      ========================================================================== */}
      <section className="relative z-10 pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Badge de Versión Institucional */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-mono font-semibold mb-8 animate-fade-in shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-orange-400" />
          <span>MOTOR CUANTITATIVO MULTIMERCADO • VERSIÓN 4.2</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
        </div>

        {/* Título Principal Requerido */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-[1.1] mb-6">
          CondorFi -{' '}
          <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-emerald-400 bg-clip-text text-transparent">
            Terminal Cuantitativa
          </span>
        </h1>

        {/* Propuesta de Valor */}
        <p className="text-base sm:text-xl text-slate-300 max-w-3xl mx-auto font-normal leading-relaxed mb-10">
          Infraestructura institucional para traders sistemáticos y quants. Detección automática de convergencia
          mediante <strong className="text-white font-semibold">Análisis Multi-Temporal (MTFA 1d + 1h)</strong>,
          alertas push en vivo vía Telegram y aislamiento de portafolios con seguridad de base de datos RLS.
        </p>

        {/* Botones de Acción (CTA Principal: 'Comenzar a Operar' + 'Explorar Modo Demo') */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-2xl mx-auto mb-16">
          <Link
            to="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-mono font-bold text-sm bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 hover:from-orange-500 hover:to-amber-500 text-white shadow-xl shadow-orange-600/30 hover:shadow-orange-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            <span>Comenzar a Operar</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>

          <button
            type="button"
            onClick={handleExplorarDemo}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-mono font-bold text-sm bg-slate-900/90 hover:bg-slate-800 border border-amber-500/40 hover:border-amber-400 text-amber-300 shadow-md shadow-amber-500/10 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
          >
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Explorar Modo Demo (1 Clic)</span>
          </button>

          <a
            href="#beneficios"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl font-mono font-semibold text-sm bg-slate-950/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 transition-all duration-200 cursor-pointer"
          >
            <Layers className="w-4 h-4 text-slate-400" />
            <span>Beneficios</span>
          </a>
        </div>

        {/* Barra de Telemetría y Métricas en Tiempo Real */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md max-w-5xl mx-auto shadow-2xl font-mono text-left">
          <div className="p-3 border-r border-slate-800/80 last:border-none">
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <Cpu className="w-3.5 h-3.5 text-orange-400" />
              <span>UNIVERSO ACTIVO</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white">300+ Tickers</div>
            <div className="text-[11px] text-emerald-400 mt-0.5">100 Criptos, 100 Índices, 100+ Acciones</div>
          </div>

          <div className="p-3 border-r border-slate-800/80 last:border-none">
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>ALGORITMO MTFA</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white">1d + 1h Dual</div>
            <div className="text-[11px] text-amber-400 mt-0.5">Bollinger Bandwidth Adaptativo</div>
          </div>

          <div className="p-3 border-r border-slate-800/80 last:border-none">
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <Send className="w-3.5 h-3.5 text-sky-400" />
              <span>ALERTAS PUSH</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white">Telegram Live</div>
            <div className="text-[11px] text-sky-400 mt-0.5">Consolidación Anti-Spam</div>
          </div>

          <div className="p-3">
            <div className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>SEGURIDAD RLS</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-white">Multi-Tenant</div>
            <div className="text-[11px] text-emerald-400 mt-0.5">Aislamiento por Usuario</div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. RADAR CUANTITATIVO EN VIVO (SNAPSHOT DEMOSTRATIVO)
      ========================================================================== */}
      <section id="mercados" className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xs font-mono font-bold tracking-wider text-orange-400 uppercase">
              // Monitoreo Sistemático Multimercado
            </h2>
            <p className="text-xl sm:text-2xl font-bold text-white mt-1">
              Activos con Mayor Convergencia Técnica
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-orange-400 hover:text-orange-300 transition"
          >
            <span>Desbloquear acceso a los 300+ activos</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ACTIVOS_DESTACADOS.map((item) => (
            <div
              key={item.ticker}
              className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all duration-200 group shadow-md"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center font-mono font-bold text-orange-400 text-xs">
                    {item.ticker.slice(0, 3)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-orange-400 transition">
                      {item.ticker}
                    </h3>
                    <p className="text-[11px] text-slate-400">{item.mercado}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {item.señal}
                </span>
              </div>

              <div className="flex items-end justify-between font-mono pt-2 border-t border-slate-800/70">
                <div>
                  <div className="text-[10px] text-slate-400">PRECIO</div>
                  <div className="text-base font-bold text-white">{item.precio}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400">CONDORSCORE</div>
                  <div className="text-base font-bold text-emerald-400">{item.score}/100</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          4. TARJETAS DE BENEFICIOS CLAVE (ANÁLISIS MTFA, TELEGRAM, SEGURIDAD RLS)
      ========================================================================== */}
      <section id="beneficios" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/60">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-mono font-semibold mb-4">
            <Zap className="w-3.5 h-3.5" />
            <span>SUITE CUANTITATIVA INSTITUCIONAL</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Potencia Algorítmica Diseñada para Fondos y Quants
          </h2>
          <p className="text-slate-400 text-base sm:text-lg">
            CondorFi unifica el escaneo multimercado, la ponderación adaptativa de volatilidad y la
            distribución de alertas automáticas bajo un entorno privado de alta seguridad.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {BENEFICIOS_PRINCIPALES.map((feat) => {
            const Icono = feat.icono;
            return (
              <div
                key={feat.id}
                id={feat.id}
                className="relative p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-900 transition-all duration-300 flex flex-col justify-between group shadow-xl"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${feat.bgIcono} ${feat.colorIcono} group-hover:scale-105 transition-transform duration-200`}>
                      <Icono className="w-6 h-6" />
                    </div>
                    <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-full border ${feat.badgeColor}`}>
                      {feat.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1 group-hover:text-orange-400 transition">
                    {feat.titulo}
                  </h3>
                  <div className="text-xs font-mono text-slate-400 mb-3">
                    {feat.subtitulo}
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed font-normal">
                    {feat.descripcion}
                  </p>
                </div>

                <div className="pt-5 mt-5 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Módulo Operativo</span>
                  </span>
                  <Link
                    to="/login"
                    className="text-orange-400 hover:text-orange-300 flex items-center gap-1 group-hover:translate-x-1 transition-transform"
                  >
                    <span>Operar</span>
                    <span>&rarr;</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =========================================================================
          5. MURO DE REGISTRO / ACCESO RESTRINGIDO A HERRAMIENTAS
      ========================================================================== */}
      <section id="seguridad" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/60">
        <div className="p-8 sm:p-10 rounded-3xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-mono font-bold">
              <Lock className="w-3.5 h-3.5" />
              <span>TERMINAL PRIVADA PROTEGIDA</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white">
              Herramientas de Trading Ocultas Detrás del Registro Institucional
            </h3>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Para garantizar el cumplimiento con políticas de privacidad y el aislamiento de carteras mediante
              Row Level Security (RLS), el Dashboard, el Gestor de Portafolio, el Constructor de Estrategias y el
              Screener en vivo requieren autenticación activa con Google o correo corporativo.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-slate-400 pt-2">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Acceso inmediato con Google OAuth</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Sandbox de pruebas para traders</span>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-center gap-3 w-full sm:w-auto">
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-mono font-bold text-sm bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-xl shadow-orange-600/30 transition-all cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>Comenzar a Operar</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
            <span className="text-[11px] font-mono text-slate-400">
              Sin tarjeta requerida • Acceso institucional
            </span>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. CTA FINAL DE ALTA CONVERSIÓN
      ========================================================================== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center border-t border-slate-800/60">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-orange-500/10 via-slate-900 to-slate-950 border border-orange-500/20 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />

          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight">
            Toma el Control con Análisis Cuantitativo de Alto Nivel
          </h2>
          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto mb-8 font-normal">
            Conecta tus modelos a la velocidad de la terminal. Comienza a operar con señales respaldadas
            por convergencia matemática, alertas en Telegram y ejecución sin fricción.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-mono font-bold text-sm bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-xl shadow-orange-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>Comenzar a Operar</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>

            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-mono font-semibold text-sm bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-200 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Probar Modo Sandbox Demo</span>
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. FOOTER INSTITUCIONAL
      ========================================================================== */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80 text-xs font-mono text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          © {new Date().getFullYear()} <strong className="text-slate-300 font-semibold">CondorFi Inc.</strong> — Terminal Cuantitativa Institucional.
        </div>
        <div className="flex items-center gap-6">
          <a href="#beneficios" className="hover:text-orange-400 transition">Beneficios</a>
          <a href="#mtfa" className="hover:text-orange-400 transition">MTFA</a>
          <Link to="/login" className="hover:text-orange-400 transition">Acceso Seguro</Link>
          <Link to="/login" className="hover:text-orange-400 transition">Google OAuth</Link>
        </div>
      </footer>
    </div>
  );
}
