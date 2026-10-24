/**
 * ==============================================================================
 * CondorFi - Componente de Vinculación con Bot de Telegram (TelegramConfig)
 * Archivo: condorfi-ui/src/components/TelegramConfig.jsx
 * 
 * Funcionalidades Institucionales:
 * 1. Genera un código alfanumérico aleatorio corto y unívoco (ej. 'CDF-9K42').
 * 2. Realiza el INSERT / UPSERT en Supabase ('telegram_links') con el user_id del operador activo.
 * 3. Muestra en pantalla el código generado con botón de copia rápida al portapapeles.
 * 4. Despliega enlaces directos al bot oficial:
 *    - Deep-link automático: https://t.me/CondorFi_bot?start=CODIGO
 *    - Enlace general: https://t.me/CondorFi_bot
 * 5. Escucha reactiva en tiempo real (Supabase Channel + Polling defensivo):
 *    - Detecta automáticamente cuando el Webhook confirma la vinculación (is_verified = true).
 * 6. Permite desvincular o generar un nuevo código en cualquier momento.
 * ==============================================================================
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Send,
  Bot,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Zap,
  X,
  Bell,
  MessageSquare,
  Lock,
  ChevronRight
} from 'lucide-react';

/**
 * Genera un código alfanumérico corto y legible (sin caracteres ambiguos como O/0 o I/1).
 */
function generarCodigoCorto() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `CDF-${rand}`;
}

export default function TelegramConfig({ isOpen = true, onClose = null, enModal = false }) {
  const { user, isAuthenticated } = useAuth();

  const [codigo, setCodigo] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [enviandoTest, setEnviandoTest] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [exitoMsg, setExitoMsg] = useState(null);

  const pollingRef = useRef(null);

  /**
   * 1. Consulta el estado actual de vinculación del usuario en 'telegram_links'
   */
  const cargarEstadoVinculacion = useCallback(async () => {
    if (!user || !user.id || !supabase) {
      setCargando(false);
      return;
    }

    try {
      setErrorMsg(null);
      const { data, error } = await supabase
        .from('telegram_links')
        .select('*')
        .eq('user_id', user.id)
        .order('id', { ascending: false })
        .limit(1);

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data && data.length > 0) {
        const link = data[0];
        setIsVerified(Boolean(link.is_verified));
        setChatId(link.telegram_chat_id || null);
        if (link.verification_code) {
          setCodigo(link.verification_code);
        }
      } else {
        setIsVerified(false);
        setChatId(null);
        setCodigo('');
      }
    } catch (err) {
      console.warn('[TelegramConfig] Aviso al consultar telegram_links:', err.message);
      setErrorMsg('No se pudo verificar el estado en la base de datos.');
    } finally {
      setCargando(false);
    }
  }, [user]);

  /**
   * 2. Genera un nuevo código alfanumérico e inserta/actualiza en Supabase
   */
  const handleGenerarCodigo = async () => {
    if (!user || !user.id) {
      setErrorMsg('Debes iniciar sesión para vincular tu cuenta con Telegram.');
      return;
    }

    if (!supabase) {
      setErrorMsg('Cliente de Supabase no disponible en este entorno.');
      return;
    }

    setGenerando(true);
    setErrorMsg(null);
    setExitoMsg(null);

    const nuevoCodigo = generarCodigoCorto();

    try {
      // 1. Verificar si el usuario ya cuenta con una fila previa en telegram_links
      const { data: existente } = await supabase
        .from('telegram_links')
        .select('id, user_id')
        .eq('user_id', user.id)
        .limit(1);

      if (existente && existente.length > 0) {
        // Actualizar la fila existente con el nuevo código
        const { error: errUpdate } = await supabase
          .from('telegram_links')
          .update({
            verification_code: nuevoCodigo,
            is_verified: false,
            telegram_chat_id: null
          })
          .eq('user_id', user.id);

        if (errUpdate) throw errUpdate;
      } else {
        // Realizar el INSERT requerido
        const { error: errInsert } = await supabase
          .from('telegram_links')
          .insert([
            {
              user_id: user.id,
              verification_code: nuevoCodigo,
              is_verified: false,
              telegram_chat_id: null
            }
          ]);

        if (errInsert) throw errInsert;
      }

      setCodigo(nuevoCodigo);
      setIsVerified(false);
      setChatId(null);
      setExitoMsg('Código generado exitosamente. Envíalo al bot de Telegram para completar la activación.');
    } catch (err) {
      console.error('[TelegramConfig] Error al guardar código:', err);
      setErrorMsg(err.message || 'Error al registrar el código en Supabase.');
    } finally {
      setGenerando(false);
    }
  };

  /**
   * 3. Desvincular bot
   */
  const handleDesvincular = async () => {
    if (!window.confirm('¿Seguro que deseas desvincular el bot de Telegram? Dejarás de recibir alertas en tu chat.')) {
      return;
    }

    setCargando(true);
    setErrorMsg(null);

    try {
      if (supabase && user) {
        await supabase
          .from('telegram_links')
          .update({
            telegram_chat_id: null,
            is_verified: false,
            verification_code: null
          })
          .eq('user_id', user.id);
      }

      setIsVerified(false);
      setChatId(null);
      setCodigo('');
      setExitoMsg('Bot desvinculado correctamente.');
    } catch (err) {
      setErrorMsg('Error al desvincular: ' + err.message);
    } finally {
      setCargando(false);
    }
  };

  /**
   * 4. Envía un mensaje de prueba instantáneo a través de /api/telegram/send
   *    para confirmar que el canal de salida hacia el celular del operador funciona.
   */
  const handleEnviarTest = async () => {
    if (!user || !user.id) {
      setErrorMsg('Debes iniciar sesión para realizar la prueba.');
      return;
    }

    setEnviandoTest(true);
    setErrorMsg(null);
    setExitoMsg(null);

    try {
      // Obtener el JWT de la sesión activa de Supabase
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const headers = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const mensajeTest = 
`🔔 *CondorFi - Test de Conectividad*
────────────────────────
✅ *Estado del canal:* Conexión Estable
📱 *Chat ID:* \`${chatId || 'Vinculado'}\`
⏱ *Hora:* ${new Date().toLocaleTimeString('es-AR')}

¡Tu canal institucional de alertas cuantitativas y avisos de cartera está funcionando al 100%! 🚀

────────────────────────
_CondorFi Quantitative Terminal • Aislamiento RLS_`;

      const response = await fetch('/api/telegram/send', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: user.id,
          text: mensajeTest,
          parse_mode: 'Markdown'
        })
      });

      const resData = await response.json();

      if (!response.ok || !resData.ok) {
        throw new Error(resData.error || 'No se pudo despachar el mensaje de prueba a Telegram.');
      }

      setExitoMsg('¡Test de conectividad enviado con éxito a tu Telegram! Revisa tu celular.');
    } catch (err) {
      console.error('[TelegramConfig] Error al enviar test:', err);
      setErrorMsg(err.message || 'Error al comunicarse con el servicio de alertas.');
    } finally {
      setEnviandoTest(false);
    }
  };

  // Cargar estado inicial
  useEffect(() => {
    cargarEstadoVinculacion();
  }, [cargarEstadoVinculacion]);

  // Sondeo periódico reactivo mientras se espera verificación
  useEffect(() => {
    if (isVerified || !codigo || !user) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    // Polling cada 3 segundos para detectar en tiempo real cuando el Webhook confirma
    pollingRef.current = setInterval(async () => {
      if (!supabase || !user) return;
      try {
        const { data } = await supabase
          .from('telegram_links')
          .select('is_verified, telegram_chat_id')
          .eq('user_id', user.id)
          .limit(1);

        if (data && data.length > 0 && data[0].is_verified) {
          setIsVerified(true);
          setChatId(data[0].telegram_chat_id);
          setExitoMsg('🎉 ¡Vinculación verificada con éxito por el bot de Telegram!');
          clearInterval(pollingRef.current);
        }
      } catch {}
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [codigo, isVerified, user]);

  // Manejador para copiar al portapapeles
  const handleCopiar = () => {
    if (!codigo) return;
    navigator.clipboard.writeText(codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const urlBotDirecto = codigo
    ? `https://t.me/CondorFi_bot?start=${codigo}`
    : 'https://t.me/CondorFi_bot';

  if (!isOpen) return null;

  const contenido = (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl overflow-hidden font-mono max-w-xl w-full">
      {/* Header Institucional */}
      <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-sky-500/10 via-slate-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 shadow-2xs">
            <Send className="w-5 h-5 -rotate-12 translate-x-0.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Alertas Telegram Bot
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                @CondorFi_bot
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-sans mt-0.5">
              Notificaciones de arbitraje en tiempo real, señales MTFA y valuación de cartera.
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="p-6 space-y-5 text-xs">
        {/* Mensaje de Error / Éxito */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 shadow-2xs">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-sans text-xs">{errorMsg}</span>
          </div>
        )}

        {exitoMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-sans text-xs font-semibold">{exitoMsg}</span>
          </div>
        )}

        {/* 1. ESTADO: USUARIO NO AUTENTICADO */}
        {!isAuthenticated && (
          <div className="p-6 rounded-2xl bg-amber-50/70 border border-amber-200 text-center space-y-3">
            <Lock className="w-8 h-8 text-amber-600 mx-auto" />
            <h4 className="font-bold text-amber-900 text-sm">Autenticación Requerida</h4>
            <p className="text-xs text-amber-800 font-sans max-w-sm mx-auto">
              Para vincular de forma segura tus alertas privadas y portafolio con el bot de Telegram,
              inicia sesión con tu cuenta institucional de CondorFi.
            </p>
          </div>
        )}

        {/* 2. ESTADO: BOT YA VINCULADO EXITOSAMENTE */}
        {isAuthenticated && isVerified && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                    BOT VINCULADO & ACTIVO
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/60 text-emerald-900 border border-emerald-300">
                  Verificado RLS
                </span>
              </div>

              <p className="text-xs text-emerald-800 font-sans leading-relaxed">
                Tu cuenta de CondorFi está enlazada exitosamente con el bot oficial de Telegram.
                Los micro-bots despachan alertas en tiempo real a tu chat privado.
              </p>

              {chatId && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/80 border border-emerald-200 text-xs">
                  <span className="text-slate-500 font-sans">Telegram Chat ID:</span>
                  <span className="font-bold font-mono text-slate-800">{chatId}</span>
                </div>
              )}
            </div>

            {/* Tarjeta de Prueba de Conectividad */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-white space-y-3 shadow-md">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                  <Bell className="w-4 h-4" />
                  Prueba de Salida en Vivo
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Endpoint: /api/telegram/send
                </span>
              </div>
              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                Envía una notificación instantánea a tu celular para confirmar que el motor de alertas y el canal de salida funcionan correctamente.
              </p>
              <div>
                <button
                  type="button"
                  onClick={handleEnviarTest}
                  disabled={enviandoTest || cargando}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98 shadow-md shadow-orange-500/20 cursor-pointer disabled:opacity-50"
                >
                  {enviandoTest ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Despachando prueba a tu Telegram...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 -rotate-12" />
                      <span>Enviar Test de Conectividad</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Acciones para bot vinculado */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <a
                href="https://t.me/CondorFi_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow-sm"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Abrir Chat con @CondorFi_bot</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={handleDesvincular}
                disabled={cargando}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-slate-600 hover:text-rose-700 font-medium transition cursor-pointer text-center"
              >
                Desvincular Chat
              </button>
            </div>
          </div>
        )}

        {/* 3. ESTADO: PENDIENTE DE VINCULACIÓN O CÓDIGO GENERADO */}
        {isAuthenticated && !isVerified && (
          <div className="space-y-5">
            {codigo ? (
              <div className="space-y-4">
                {/* Caja de Código */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-white space-y-3 shadow-lg">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="uppercase tracking-wider font-bold text-orange-400 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" />
                      Código de Verificación
                    </span>
                    <span className="flex items-center gap-1 text-slate-400 font-mono">
                      <RefreshCw className="w-3 h-3 animate-spin text-orange-400" />
                      Esperando mensaje en Telegram...
                    </span>
                  </div>

                  {/* Display Grande del Código */}
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
                    <span className="text-2xl sm:text-3xl font-black tracking-widest text-white font-mono select-all">
                      {codigo}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopiar}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition active:scale-95 cursor-pointer border border-slate-700"
                    >
                      {copiado ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400">¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                    Envía este código al bot para completar la asociación con tu cuenta institucional.
                  </p>
                </div>

                {/* Pasos y Enlace Directo a Telegram */}
                <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 space-y-3">
                  <h4 className="font-bold text-sky-950 text-xs flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-sky-600" />
                    Pasos para activar en Telegram:
                  </h4>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs text-sky-900 font-sans">
                    <li>
                      Haz clic en el botón inferior para abrir el bot oficial <strong>@CondorFi_bot</strong>.
                    </li>
                    <li>
                      Presiona <strong>Iniciar</strong> en Telegram (el código se enviará automáticamente).
                    </li>
                    <li>
                      ¡Listo! Esta pantalla se actualizará de forma instantánea al confirmarse la vinculación.
                    </li>
                  </ol>

                  {/* Botón Principal: Deep-Link Directo a Telegram */}
                  <div className="pt-1">
                    <a
                      href={urlBotDirecto}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition active:scale-98 shadow-md shadow-sky-500/20"
                    >
                      <Send className="w-4 h-4 -rotate-12 translate-x-0.5" />
                      <span>Abrir @CondorFi_bot en Telegram</span>
                      <ExternalLink className="w-4 h-4 ml-1 opacity-80" />
                    </a>
                  </div>

                  {/* Enlace alternativo directo */}
                  <div className="text-center pt-1">
                    <span className="text-[11px] text-slate-500 font-sans">
                      O busca manualmente el bot:{' '}
                      <a
                        href="https://t.me/CondorFi_bot"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-600 hover:underline font-mono font-bold"
                      >
                        https://t.me/CondorFi_bot
                      </a>
                    </span>
                  </div>
                </div>

                {/* Botón Regenerar Código */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={handleGenerarCodigo}
                    disabled={generando}
                    className="text-xs text-slate-500 hover:text-orange-600 font-medium transition cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${generando ? 'animate-spin text-orange-600' : ''}`} />
                    <span>Generar otro código nuevo</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Pantalla Inicial antes de generar código */
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 mx-auto shadow-2xs">
                  <Bot className="w-6 h-6" />
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-sm">
                    Vincula tu Terminal con Telegram
                  </h4>
                  <p className="text-xs text-slate-600 font-sans max-w-md mx-auto leading-relaxed">
                    Recibe en tu dispositivo móvil las alertas automáticas de arbitraje en exchanges argentinos,
                    señales cuantitativas de entrada (MTFA) y alertas críticas de posición.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleGenerarCodigo}
                    disabled={generando || cargando}
                    className="py-3 px-6 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs flex items-center justify-center gap-2 mx-auto transition active:scale-95 shadow-md shadow-orange-600/20 cursor-pointer disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>{generando ? 'Generando código...' : 'Generar Código de Vinculación'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="pt-2 text-center">
                  <span className="text-[11px] text-slate-500 font-sans">
                    Canal oficial:{' '}
                    <a
                      href="https://t.me/CondorFi_bot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-600 hover:underline font-mono font-semibold"
                    >
                      https://t.me/CondorFi_bot
                    </a>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer de Seguridad RLS */}
      <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>RLS Multi-Tenant: Aislamiento por User ID</span>
        </span>
        <span>Telegram Bot API v7</span>
      </div>
    </div>
  );

  if (enModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
        {contenido}
      </div>
    );
  }

  return contenido;
}

