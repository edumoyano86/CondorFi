/**
 * ==============================================================================
 * CondorFi - Pantalla de Autenticación Institucional (Auth.jsx)
 * Archivo: condorfi-ui/src/pages/Auth.jsx
 * 
 * Interfaz de Acceso Seguro Estilo Bloomberg Terminal:
 * - Login con Email y Contraseña (Supabase Auth).
 * - Registro de Nuevos Operadores Quants con metadata de perfil.
 * - Soporte para Acceso Rápido Sandbox / Demo para testing sin fricción.
 * - Redirección inteligente a la ruta previamente intentada (state.from).
 * - Indicadores de seguridad corporativa (RLS, TLS 256, JWT Token).
 * ==============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import condorLogo from '../assets/condorfi-logo.png';
import {
  Lock,
  Mail,
  User,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  Building,
  Terminal
} from 'lucide-react';

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, signUp, loginDemo, isAuthenticated } = useAuth();

  const [modo, setModo] = useState('login'); // 'login' | 'registro'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const [cargando, setCargando] = useState(false);
  const [errorLocal, setErrorLocal] = useState(null);
  const [mensajeExito, setMensajeExito] = useState(null);

  // Ruta a la que redirigir tras loguear (por defecto a /portfolio)
  const destino = location.state?.from?.pathname || '/portfolio';

  // Si el usuario ya está autenticado, redirigir inmediatamente
  useEffect(() => {
    if (isAuthenticated) {
      navigate(destino, { replace: true });
    }
  }, [isAuthenticated, navigate, destino]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorLocal(null);
    setMensajeExito(null);

    // Validaciones preventivas
    if (!email || !password) {
      setErrorLocal('Por favor ingresa todos los campos obligatorios.');
      return;
    }

    if (modo === 'registro') {
      if (password.length < 6) {
        setErrorLocal('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorLocal('Las contraseñas no coinciden.');
        return;
      }
    }

    setCargando(true);

    try {
      if (modo === 'login') {
        await signIn({ email: email.trim(), password });
        navigate(destino, { replace: true });
      } else {
        const res = await signUp({
          email: email.trim(),
          password,
          nombre: nombre.trim() || undefined
        });

        if (res?.session) {
          navigate(destino, { replace: true });
        } else {
          setMensajeExito('Cuenta institucional creada. Si se requiere confirmación por email, por favor revisa tu bandeja de entrada o utiliza el acceso Demo.');
          setModo('login');
        }
      }
    } catch (err) {
      console.error('[Auth] Error de autenticación:', err);
      let msg = err.message || 'Error al autenticar las credenciales.';
      if (msg.includes('Invalid login credentials')) {
        msg = 'Credenciales inválidas. Verifica tu correo y contraseña, o prueba el Acceso Demo.';
      } else if (msg.includes('User already registered')) {
        msg = 'Este correo electrónico ya se encuentra registrado. Inicia sesión.';
      }
      setErrorLocal(msg);
    } finally {
      setCargando(false);
    }
  };

  const handleAccesoDemo = () => {
    loginDemo(nombre || 'Senior Quant Trader');
    navigate(destino, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-200 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Patrón de Grilla de Fondo Estilo Bloomberg */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#f97316 1px, transparent 1px), linear-gradient(90deg, #f97316 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* Gradientes de Luz Ambiental */}
      <div className="absolute top-1/4 -left-40 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Card Principal de Autenticación */}
      <div className="w-full max-w-md bg-[#0D111A]/95 border border-slate-800/80 rounded-2xl shadow-2xl backdrop-blur-xl relative z-10 overflow-hidden">
        {/* Barra de Estado Terminal */}
        <div className="bg-[#090C14] px-5 py-3 border-b border-slate-800/90 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            <span className="text-[11px] font-mono font-semibold text-slate-400 ml-2 tracking-wider">
              CONDORFI // AUTH GATEWAY
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/30 font-bold">
            TLS 256-BIT
          </span>
        </div>

        <div className="p-7">
          {/* Cabecera de Marca */}
          <div className="text-center mb-6">
            <div className="inline-block relative mb-3">
              <img
                src={condorLogo}
                alt="CondorFi Logo"
                className="w-14 h-14 object-cover rounded-2xl border border-slate-700/80 shadow-lg shadow-orange-500/10 mx-auto ring-1 ring-orange-500/30"
              />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0D111A] animate-pulse" />
            </div>
            <h1 className="text-xl font-black tracking-wider text-white">
              CONDOR<span className="text-orange-500">FI</span>
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Terminal Cuantitativa Multi-Usuario Institucional
            </p>
          </div>

          {/* Toggle de Modo: Iniciar Sesión vs Registro */}
          <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80 mb-6 font-mono text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setModo('login');
                setErrorLocal(null);
              }}
              className={`py-2 rounded-lg transition-all cursor-pointer ${
                modo === 'login'
                  ? 'bg-orange-500 text-white font-bold shadow-md shadow-orange-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setModo('registro');
                setErrorLocal(null);
              }}
              className={`py-2 rounded-lg transition-all cursor-pointer ${
                modo === 'registro'
                  ? 'bg-orange-500 text-white font-bold shadow-md shadow-orange-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Crear Cuenta
            </button>
          </div>

          {/* Alertas de Error o Éxito */}
          {errorLocal && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorLocal}</span>
            </div>
          )}

          {mensajeExito && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{mensajeExito}</span>
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {modo === 'registro' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 font-mono">
                  Nombre de Operador / Trader
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="ej. Eduardo Moyano"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-orange-500 transition-colors font-mono"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 font-mono">
                Correo Electrónico Institucional
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="trader@hedgefund.com"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-orange-500 transition-colors font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 font-mono">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type={mostrarPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-orange-500 transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {mostrarPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {modo === 'registro' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 font-mono">
                  Confirmar Contraseña
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type={mostrarPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-orange-500 transition-colors font-mono"
                  />
                </div>
              </div>
            )}

            {/* Botón Principal */}
            <button
              type="submit"
              disabled={cargando}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 active:scale-[0.98] text-white font-bold font-mono text-sm rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {cargando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Autenticando credenciales...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>{modo === 'login' ? 'Acceder a la Terminal' : 'Registrar Operador'}</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </form>

          {/* Separador */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800/80" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-mono">
              <span className="bg-[#0D111A] px-3 text-slate-500 font-bold">
                O acceso inmediato
              </span>
            </div>
          </div>

          {/* Botón de Acceso Instantáneo Sandbox / Demo */}
          <button
            type="button"
            onClick={handleAccesoDemo}
            className="w-full py-2.5 px-4 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/80 hover:border-slate-600 text-slate-200 text-xs font-mono font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm group"
          >
            <Zap className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
            <span>Acceso Rápido Sandbox (Demo Trader)</span>
          </button>

          {/* Enlace Volver al Dashboard */}
          <div className="text-center mt-5">
            <Link
              to="/"
              className="text-xs font-mono text-slate-400 hover:text-orange-400 transition-colors"
            >
              &larr; Volver al Dashboard Público
            </Link>
          </div>
        </div>

        {/* Footer Institucional de Seguridad */}
        <div className="bg-[#090C14] px-6 py-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>RLS Multi-Tenant Activo</span>
          </span>
          <span className="text-slate-600">&bull;</span>
          <span>Supabase Auth v2</span>
          <span className="text-slate-600">&bull;</span>
          <span>CondorFi SaaS</span>
        </div>
      </div>
    </div>
  );
}

