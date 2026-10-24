/**
 * ==============================================================================
 * CondorFi - Contexto Global de Autenticación Institucional (Supabase Auth)
 * Archivo: condorfi-ui/src/context/AuthContext.jsx
 * 
 * Funcionalidades:
 * - Proveedor de estado global reactivo para la sesión institucional.
 * - Escucha activa de cambios de sesión (onAuthStateChange) en Supabase.
 * - Métodos integrados: signInWithPassword, signUp, signOut, loginDemo.
 * - Persistencia segura de tokens y soporte multi-tenant con Row-Level Security (RLS).
 * - Contingencia elegante en caso de entorno local sin conexión remota.
 * ==============================================================================
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  error: null,
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  loginDemo: () => {},
  isAuthenticated: false
});

const DEMO_USER_STORAGE_KEY = 'condorfi_auth_demo_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Inicialización y escucha de estado de sesión en Supabase
  useEffect(() => {
    let montado = true;

    async function inicializarSesion() {
      // Verificar si hay sesión demo guardada localmente
      const demoUserJson = localStorage.getItem(DEMO_USER_STORAGE_KEY);
      if (demoUserJson) {
        try {
          const demoUser = JSON.parse(demoUserJson);
          if (demoUser && demoUser.id) {
            setUser(demoUser);
            setSession({ user: demoUser, access_token: 'demo-token' });
            setLoading(false);
            return;
          }
        } catch {
          localStorage.removeItem(DEMO_USER_STORAGE_KEY);
        }
      }

      if (!supabase) {
        if (montado) {
          setLoading(false);
        }
        return;
      }

      try {
        const { data: { session: sesionInicial }, error: sesionError } = await supabase.auth.getSession();
        if (sesionError) throw sesionError;

        if (montado) {
          setSession(sesionInicial);
          setUser(sesionInicial?.user ?? null);
        }
      } catch (err) {
        console.warn('[AuthContext] Aviso al obtener sesión inicial:', err.message);
        if (montado) {
          setError(err.message);
        }
      } finally {
        if (montado) {
          setLoading(false);
        }
      }
    }

    inicializarSesion();

    // Suscripción reactiva a eventos de autenticación de Supabase
    let subscription = null;
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((_event, sesionActual) => {
        if (montado) {
          // Si Supabase toma el control, limpiamos sesión demo
          localStorage.removeItem(DEMO_USER_STORAGE_KEY);
          setSession(sesionActual);
          setUser(sesionActual?.user ?? null);
          setLoading(false);
        }
      });
      subscription = data?.subscription;
    }

    return () => {
      montado = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  /**
   * Inicio de Sesión Institucional con Correo y Contraseña
   */
  const signIn = useCallback(async ({ email, password }) => {
    setError(null);
    if (!supabase) {
      throw new Error('El cliente de Supabase no está configurado. Use el modo Demo.');
    }

    const { data, error: errAuth } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (errAuth) {
      setError(errAuth.message);
      throw errAuth;
    }

    localStorage.removeItem(DEMO_USER_STORAGE_KEY);
    setUser(data.user);
    setSession(data.session);
    return data;
  }, []);

  /**
   * Inicio de Sesión Institucional mediante Google OAuth
   */
  const signInWithGoogle = useCallback(async () => {
    setError(null);
    if (!supabase) {
      throw new Error('El cliente de Supabase no está configurado. Use el modo Demo.');
    }

    const { data, error: errOAuth } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`
      }
    });

    if (errOAuth) {
      setError(errOAuth.message);
      throw errOAuth;
    }

    return data;
  }, []);

  /**
   * Registro Institucional de Nuevo Operador
   */
  const signUp = useCallback(async ({ email, password, nombre }) => {
    setError(null);
    if (!supabase) {
      throw new Error('El cliente de Supabase no está configurado. Use el modo Demo.');
    }

    const { data, error: errAuth } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre: nombre || email.split('@')[0],
          rol: 'quant_trader',
          tier: 'INSTITUTIONAL'
        }
      }
    });

    if (errAuth) {
      setError(errAuth.message);
      throw errAuth;
    }

    if (data.session) {
      setUser(data.user);
      setSession(data.session);
    }
    return data;
  }, []);

  /**
   * Cierre de Sesión Seguro
   */
  const signOut = useCallback(async () => {
    setError(null);
    localStorage.removeItem(DEMO_USER_STORAGE_KEY);

    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('[AuthContext] Error al desloguear en Supabase:', err.message);
      }
    }

    setUser(null);
    setSession(null);
  }, []);

  /**
   * Acceso Instantáneo Sandbox / Demo Institucional
   * Permite probar todas las características protegidas inmediatamente
   */
  const loginDemo = useCallback((nombre = 'Trader Cuantitativo') => {
    const mockUser = {
      id: 'demo-user-8888-4444-9999-111122223333',
      email: 'quant.operator@condorfi.internal',
      role: 'authenticated',
      user_metadata: {
        nombre,
        rol: 'Senior Quant Trader',
        tier: 'INSTITUTIONAL_PRO',
        institucion: 'CondorFi Capital'
      },
      app_metadata: {
        provider: 'demo'
      },
      created_at: new Date().toISOString()
    };

    localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(mockUser));
    setUser(mockUser);
    setSession({ user: mockUser, access_token: 'demo-jwt-token' });
    return mockUser;
  }, []);

  const value = useMemo(() => ({
    user,
    session,
    loading,
    error,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    loginDemo,
    isAuthenticated: Boolean(user)
  }), [user, session, loading, error, signIn, signInWithGoogle, signUp, signOut, loginDemo]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
}

export default AuthContext;

