/**
 * ==============================================================================
 * CondorFi - API Universal de Notificaciones y Alertas por Telegram
 * Archivo: condorfi-ui/api/telegram/send.js (Vercel Serverless Function)
 * 
 * Funcionalidad:
 * 1. Endpoint privado para el despacho unificado de alertas cuantitativas, tests
 *    de conectividad y notificaciones de cartera a operadores verificados.
 * 2. Valida la sesión del usuario mediante Supabase JWT (Bearer Token) o secreto interno.
 * 3. Consulta la tabla 'telegram_links' en Supabase para obtener el telegram_chat_id
 *    activo (donde is_verified = true).
 * 4. Despacha el mensaje a través de la API oficial de Telegram (sendMessage).
 * 5. Exporta la función utilitaria 'enviarNotificacionTelegram' para invocación
 *    directa in-process desde otros microservicios (ej. /api/cron/scanner.js).
 * ==============================================================================
 */

import { createClient } from '@supabase/supabase-js';

// Polyfill defensivo para WebSocket en Serverless Node.js
if (!globalThis.WebSocket) {
  globalThis.WebSocket = class DummyWebSocket {};
}

/**
 * Obtiene o inicializa el cliente de Supabase con Service Role o Anon Key.
 */
export function getSupabaseAdminClient() {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseUrl = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '') : null;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
                      process.env.SUPABASE_KEY ||
                      process.env.SUPABASE_ANON_KEY ||
                      process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/**
 * Función central de despacho de mensajes a Telegram para un usuario determinado.
 * @param {Object} params
 * @param {string} params.user_id - UUID del usuario en Supabase
 * @param {string} params.texto - Texto del mensaje a despachar (soporta Markdown)
 * @param {string} [params.parseMode='Markdown'] - Formato del texto ('Markdown' o 'HTML')
 * @returns {Promise<{ ok: boolean, message_id?: number, telegram_chat_id?: string|number, error?: string }>}
 */
export async function enviarNotificacionTelegram({ user_id, texto, parseMode = 'Markdown' }) {
  if (!user_id) {
    return { ok: false, error: 'Parámetro user_id es obligatorio.' };
  }

  if (!texto || typeof texto !== 'string' || !texto.trim()) {
    return { ok: false, error: 'El contenido del mensaje (texto) no puede estar vacío.' };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN no configurado en variables de entorno.' };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: 'Cliente de base de datos Supabase no configurado.' };
  }

  try {
    // 1. Buscar la vinculación activa y verificada del usuario
    const { data: link, error: dbError } = await supabase
      .from('telegram_links')
      .select('user_id, telegram_chat_id, is_verified')
      .eq('user_id', user_id)
      .eq('is_verified', true)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dbError) {
      console.error('[Telegram Send] Error al consultar telegram_links:', dbError);
      return { ok: false, error: `Error en base de datos: ${dbError.message}` };
    }

    if (!link || !link.telegram_chat_id) {
      return {
        ok: false,
        error: 'El usuario no tiene una cuenta de Telegram vinculada y verificada (is_verified = true).'
      };
    }

    // 2. Despachar mensaje a la Telegram Bot API oficial
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: link.telegram_chat_id,
        text: texto,
        parse_mode: parseMode,
        disable_web_page_preview: true
      })
    });

    const resJson = await response.json();

    if (!response.ok || !resJson.ok) {
      console.warn(`[Telegram Send] Error de Telegram API para chat ${link.telegram_chat_id}:`, resJson);
      return {
        ok: false,
        error: resJson.description || 'Error devuelto por la API de Telegram al despachar el mensaje.'
      };
    }

    return {
      ok: true,
      message_id: resJson.result?.message_id,
      telegram_chat_id: link.telegram_chat_id
    };
  } catch (err) {
    console.error('[Telegram Send] Excepción inesperada:', err);
    return { ok: false, error: err.message || 'Error interno de red al despachar a Telegram.' };
  }
}

/**
 * Valida la autenticación de la petición entrante.
 * Acepta:
 * 1. Bearer token de Supabase con sesión activa que coincida con el user_id solicitado.
 * 2. Secreto de servidor interno (CRON_SECRET o SUPABASE_SERVICE_ROLE_KEY).
 */
async function validarAutorizacion(req, targetUserId) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const internalSecretHeader = req.headers['x-internal-secret'] || req.headers['x-cron-secret'] || '';

  const cronSecret = process.env.CRON_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 1. Verificación por secreto interno (llamadas entre microservicios o cron)
  if (
    (cronSecret && (authHeader === `Bearer ${cronSecret}` || internalSecretHeader === cronSecret)) ||
    (serviceRoleKey && (authHeader === `Bearer ${serviceRoleKey}` || internalSecretHeader === serviceRoleKey))
  ) {
    return { autorizada: true, esServidor: true };
  }

  // 2. Verificación por Supabase Access Token del usuario autenticado
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        try {
          const { data: { user }, error } = await supabase.auth.getUser(token);
          if (!error && user) {
            // El usuario autenticado solo puede enviarse alertas a sí mismo
            if (user.id === targetUserId) {
              return { autorizada: true, user };
            } else {
              return {
                autorizada: false,
                status: 403,
                motivo: 'Privilegios insuficientes: No puedes despachar alertas a otro usuario.'
              };
            }
          }
        } catch (authErr) {
          console.warn('[Telegram Send Auth] Error al verificar token JWT:', authErr.message);
        }
      }
    }
  }

  // 3. Fallback de desarrollo local si no hay auth headers configurados
  if (process.env.NODE_ENV !== 'production' && !cronSecret && !serviceRoleKey) {
    console.warn('[Telegram Send Auth] ADVERTENCIA: Permitiendo llamada en entorno de desarrollo local sin auth estricta.');
    return { autorizada: true, modoDev: true };
  }

  return {
    autorizada: false,
    status: 401,
    motivo: 'Petición no autorizada. Provee un Bearer token de Supabase válido o un secreto de servidor.'
  };
}

/**
 * Handler HTTP Serverless (/api/telegram/send)
 */
export default async function handler(req, res) {
  // Configuración de encabezados CORS para peticiones desde el frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-internal-secret, x-cron-secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Diagnóstico informativo
  if (req.method === 'GET') {
    return res.status(200).json({
      service: 'CondorFi Telegram Notification Gateway',
      status: 'active',
      endpoint: '/api/telegram/send',
      methods: ['POST']
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: `Método ${req.method} no permitido. Utiliza POST.`
    });
  }

  try {
    const body = req.body || {};
    const userId = body.user_id || body.userId;
    const texto = body.text || body.texto || body.message;
    const parseMode = body.parse_mode || body.parseMode || 'Markdown';

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: 'El campo "user_id" es obligatorio en el cuerpo de la petición.'
      });
    }

    if (!texto) {
      return res.status(400).json({
        ok: false,
        error: 'El campo "text" (o "texto") es obligatorio en el cuerpo de la petición.'
      });
    }

    // Validar autorización de acceso
    const authCheck = await validarAutorizacion(req, userId);
    if (!authCheck.autorizada) {
      return res.status(authCheck.status || 401).json({
        ok: false,
        error: authCheck.motivo || 'Acceso no autorizado.'
      });
    }

    // Despachar el mensaje a través de Telegram
    const resultado = await enviarNotificacionTelegram({
      user_id: userId,
      texto,
      parseMode
    });

    if (!resultado.ok) {
      const statusCode = resultado.error?.includes('is_verified = true') ? 404 : 500;
      return res.status(statusCode).json({
        ok: false,
        error: resultado.error
      });
    }

    return res.status(200).json({
      ok: true,
      message: 'Notificación despachada exitosamente a Telegram.',
      message_id: resultado.message_id,
      chat_id: resultado.telegram_chat_id
    });
  } catch (err) {
    console.error('[Telegram Send] Error crítico en el handler:', err);
    return res.status(500).json({
      ok: false,
      error: 'Error interno del servidor al procesar la notificación.',
      details: err.message
    });
  }
}
