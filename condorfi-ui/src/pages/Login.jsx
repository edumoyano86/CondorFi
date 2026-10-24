/**
 * ==============================================================================
 * CondorFi - Pantalla de Autenticación Institucional (Login.jsx)
 * Archivo: condorfi-ui/src/pages/Login.jsx
 * 
 * Interfaz de Acceso Seguro Estilo Bloomberg Terminal:
 * - Google OAuth con supabase.auth.signInWithOAuth({ provider: 'google' })
 * - Botón estilizado 'Continuar con Google' ubicado encima del formulario
 * - Formulario tradicional de Correo y Contraseña (Login / Registro)
 * - Acceso Rápido Sandbox (Demo Trader) para pruebas inmediatas
 * - Redirección inteligente a la vista operativa (/dashboard o state.from)
 * - Indicadores de seguridad corporativa (RLS Multi-Tenant, TLS 256-BIT)
 * ==============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
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
  Terminal,
  Sparkles
} from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, signInWithGoogle, signUp, loginDemo, isAuthenticated } = useAuth();

  const [modo, setModo] = useState('login'); // 'login' | 'registro'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const [cargandoEmail, setCargandoEmail] = useState(false);
  const [cargandoGoogle, setCargandoGoogle] = useState(false);
  const [errorLocal, setErrorLocal] = useState(null);
  const [mensajeExito, setMensajeExito] = useState(null);

  // Ruta a la que redirigir tras loguear (por defecto al Dashboard de la Terminal)
  const destino = location.state?.from?.pathname || '/dashboard';

  // Si el usuario ya cuenta con sesión activa, redirigir automáticamente
  useEffect(() => {
    if (isAuthenticated) {
      navigate(destino, { replace: true });
    }
  }, [isAuthenticated, navigate, destino]);

  /**
   * Autenticación con Google OAuth
   */
  const handleGoogleLogin = async () => {
    setErrorLocal(null);
    setMensajeExito(null);
    setCargandoGoogle(true);

    try {
      if (typeof signInWithGoogle === 'function') {
        await signInWithGoogle();
      } else if (supabase) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/dashboard`
          }
        });
        if (error) throw error;
      } else {
        throw new Error('Cliente de Supabase no disponible. Utilice el Acceso Demo.');
      }
    } catch (err) {
      console.error('[Google OAuth] Error al iniciar sesión:', err);
      setErrorLocal(err.message || 'Error al autenticar con Google. Intente nuevamente.');
      setCargandoGoogle(false);
    }
  };

  /**
   * Autenticación Tradicional con Email y Contraseña
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorLocal(null);
    setMensajeExito(null);

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

    setCargandoEmail(true);

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
          setMensajeExito('Cuenta institucional creada con éxito. Si tu proyecto requiere verificación por email, revisa tu bandeja.');
          setModo('login');
        }
      }
    } catch (err) {
      console.error('[Login] Error:', err);
      let msg = err.message || 'Error al autenticar las credenciales.';
      if (msg.includes('Invalid login credentials')) {
        msg = 'Credenciales inválidas. Verifica tu correo y contraseña, o prueba el Acceso Demo.';
      } else if (msg.includes('User already registered')) {
        msg = 'Este correo electrónico ya se encuentra registrado. Inicia sesión.';
      }
      setErrorLocal(msg);
    } finally {
      setCargandoEmail(false);
    }
  };

  /**
   * Acceso Sandbox Instantáneo
   */
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
            <Link to="/" className="inline-block relative mb-3 group">
              <img
                src={condorLogo}
                alt="CondorFi Logo"
                className="w-14 h-14 object-cover rounded-2xl border border-slate-700/80 shadow-lg shadow-orange-500/10 mx-auto ring-1 ring-orange-500/30 group-hover:scale-105 transition-transform"
              />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#0D111A] animate-pulse" />
            </Link>
            <h1 className="text-xl font-black tracking-wider text-white">
              CONDOR<span className="text-orange-500">FI</span>
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Terminal Cuantitativa Institucional
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

          {/* =========================================================================
              BOTÓN ESTILIZADO DE GOOGLE OAUTH (UBICADO ENCIMA DEL FORMULARIO)
          ========================================================================== */}
          <div className="mb-5">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={cargandoGoogle || cargandoEmail}
              className="w-full py-3 px-4 rounded-xl border border-slate-700/80 hover:border-slate-500 bg-slate-900/90 hover:bg-slate-850 text-white text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-3 shadow-md hover:shadow-lg cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              {cargandoGoogle ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="font-mono text-xs">Conectando con Google...</span>
                </>
              ) : (
                <>
                  {/* Icono Oficial SVG de Google */}
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span className="tracking-wide">Continuar con Google</span>
                </>
              )}
            </button>
          </div>

          {/* Divisor Visual */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800/80" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-mono">
              <span className="bg-[#0D111A] px-3 text-slate-500 font-bold">
                O con correo corporativo
              </span>
            </div>
          </div>

          {/* Formulario Tradicional de Email y Contraseña */}
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

            {/* Botón Principal del Formulario */}
            <button
              type="submit"
              disabled={cargandoEmail || cargandoGoogle}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 active:scale-[0.98] text-white font-bold font-mono text-sm rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {cargandoEmail ? (
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

          {/* Separador hacia Modo Demo */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800/80" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-mono">
              <span className="bg-[#0D111A] px-3 text-slate-500 font-bold">
                O prueba sin registro
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

          {/* Enlace Volver a la Landing Page */}
          <div className="text-center mt-5">
            <Link
              to="/"
              className="text-xs font-mono text-slate-400 hover:text-orange-400 transition-colors"
            >
              &larr; Volver a la Landing Page
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
          <span>Google OAuth</span>
        </div>
      </div>
    </div>
  );
}

