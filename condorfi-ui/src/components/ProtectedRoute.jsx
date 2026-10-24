/**
 * ==============================================================================
 * CondorFi - Guardián de Rutas Protegidas (ProtectedRoute.jsx)
 * Archivo: condorfi-ui/src/components/ProtectedRoute.jsx
 * 
 * Intercepta el acceso a módulos operativos privados de la terminal
 * (/dashboard, /acciones, /cripto, /indices, /bonos, /portfolio, /estrategias, /backtest).
 * Si el usuario no cuenta con una sesión activa en Supabase Auth, lo redirige
 * automáticamente a la Landing Page ('/').
 * ==============================================================================
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RefreshCw } from 'lucide-react';

export default function ProtectedRoute({ children, redirectTo = '/login' }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#07090E] text-slate-200 gap-3">
        <div className="relative">
          <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
          <span className="absolute inset-0 rounded-full border-2 border-orange-500/20 animate-ping pointer-events-none" />
        </div>
        <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
          Verificando Credenciales Institucionales...
        </span>
      </div>
    );
  }

  // Si no se detecta sesión activa en Supabase, redirigir automáticamente a la Landing Page
  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  return children;
}
