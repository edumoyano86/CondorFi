/**
 * ==============================================================================
 * CondorFi - Webhook de Integración Oficial con Telegram Bot
 * Archivo: api/telegram.js (Vercel Serverless Function)
 * 
 * Funcionalidad:
 * 1. Recibe eventos POST del Webhook oficial de Telegram Bot API (@CondorFi_bot).
 * 2. Extrae el chat_id y el texto del mensaje enviado por el operador.
 * 3. Admite tanto envío directo del código (ej. "CDF-8K42") como deep-links (/start CDF-8K42).
 * 4. Consulta en Supabase la tabla 'telegram_links' buscando 'verification_code'.
 * 5. Si coincide:
 *    - Guarda el telegram_chat_id del operador.
 *    - Actualiza 'is_verified' a true.
 *    - Envía mensaje interactivo por Telegram confirmando la vinculación institucional.
 * 6. Si no coincide o el código expiró:
 *    - Responde cordialmente guiando al usuario para generar un código en la terminal.
 * ==============================================================================
 */

import { createClient } from '@supabase/supabase-js';

// Polyfill ligero para WebSocket en entornos Serverless Node < 22
if (!globalThis.WebSocket) {
  globalThis.WebSocket = class DummyWebSocket {};
}

/**
 * Envía un mensaje formateado a un chat de Telegram mediante la Bot API oficial.
 * @param {string|number} chatId ID del chat de destino
 * @param {string} texto Mensaje en formato Markdown
 * @returns {Promise<boolean>}
 */
async function enviarMensajeTelegram(chatId, texto) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[Telegram Webhook] AVISO: TELEGRAM_BOT_TOKEN no configurado en variables de entorno.');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      })
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.warn(`[Telegram Webhook] Fallo al despachar mensaje a ${chatId}:`, errBody);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[Telegram Webhook] Excepción al despachar a ${chatId}:`, err.message);
    return false;
  }
}

/**
 * Inicializa el cliente de Supabase con Service Role o Anon Key.
 */
function getSupabaseClient() {
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
 * Handler HTTP Principal del Webhook
 */
export default async function handler(req, res) {
  // Manejo de peticiones GET de diagnóstico
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'online',
      service: 'CondorFi Telegram Webhook',
      bot: '@CondorFi_bot',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Método no permitido. Utilice POST para webhooks.' });
  }

  try {
    const update = req.body || {};
    const message = update.message || update.edited_message || update.channel_post;

    // Si Telegram envía un evento sin mensaje de texto (ej. join de canal o inline query), responder 200 OK
    if (!message || !message.chat || !message.chat.id) {
      return res.status(200).json({ ok: true, notice: 'Update ignorado (sin mensaje de chat)' });
    }

    const chatId = message.chat.id;
    const textRaw = (message.text || '').trim();
    const nombreUsuario = message.from?.first_name || message.chat?.first_name || 'Operador';

    if (!textRaw) {
      return res.status(200).json({ ok: true, notice: 'Mensaje vacío' });
    }

    // 1. Comando /start sin argumentos o /help
    if (textRaw === '/start' || textRaw === '/help' || textRaw === '/ayuda') {
      const saludo = `🦅 *¡Hola ${nombreUsuario}! Bienvenido a CondorFi Terminal.*

Este es el canal oficial de alertas cuantitativas, arbitraje y monitoreo de portafolios.

👉 *Para vincular tu cuenta institucional:*
1. Abre tu terminal en [condorfi.vercel.app](https://condorfi.vercel.app).
2. Ve a la sección de *Vinculación de Telegram* y haz clic en *Generar Código*.
3. Envíame el código aquí o haz clic en el enlace automático.

Comandos rápidos:
• \`/status\` : Verificar si este chat está vinculado.`;

      await enviarMensajeTelegram(chatId, saludo);
      return res.status(200).json({ ok: true, action: 'saludo_enviado' });
    }

    // 2. Comando /status
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('[Telegram Webhook] Supabase no configurado en el servidor.');
      await enviarMensajeTelegram(chatId, '⚠️ Servicio temporalmente no disponible: Supabase no configurado.');
      return res.status(200).json({ ok: true, error: 'supabase_no_configurado' });
    }

    if (textRaw === '/status' || textRaw === '/estado') {
      const { data: vinculoExistente } = await supabase
        .from('telegram_links')
        .select('*')
        .eq('telegram_chat_id', String(chatId))
        .eq('is_verified', true)
        .limit(1);

      if (vinculoExistente && vinculoExistente.length > 0) {
        await enviarMensajeTelegram(chatId, `✅ *¡Tu cuenta ya está vinculada y activa!*

• Chat ID: \`${chatId}\`
• Estado: *VERIFICADO* 🛡️
• Servicio: Alertas de Arbitraje, MTFA y Cartera Activa en tiempo real.`);
      } else {
        await enviarMensajeTelegram(chatId, `ℹ️ Este chat (\`${chatId}\`) *aún no está vinculado* a ninguna cuenta de CondorFi.

Genera tu código en la plataforma para habilitar alertas.`);
      }
      return res.status(200).json({ ok: true, action: 'status_enviado' });
    }

    // 3. Extracción de código de verificación
    // Soporta: "/start CODIGO", "/vincular CODIGO" o "CODIGO" directo
    let codigoCandidato = textRaw;
    if (textRaw.startsWith('/start ')) {
      codigoCandidato = textRaw.replace(/^\/start\s+/, '').trim();
    } else if (textRaw.startsWith('/vincular ')) {
      codigoCandidato = textRaw.replace(/^\/vincular\s+/, '').trim();
    }

    const codigoLimpio = codigoCandidato.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();

    if (!codigoLimpio || codigoLimpio.length < 4) {
      await enviarMensajeTelegram(chatId, `⚠️ El código \`${textRaw}\` no parece tener un formato válido.

Ingresa el código alfanumérico generado en tu terminal CondorFi (ej: \`CDF-9X82\`).`);
      return res.status(200).json({ ok: true, error: 'codigo_invalido' });
    }

    // 4. Búsqueda en Supabase: tabla 'telegram_links'
    const { data: rows, error: selectErr } = await supabase
      .from('telegram_links')
      .select('*')
      .or(`verification_code.eq.${codigoLimpio},verification_code.eq.${codigoCandidato.trim()}`)
      .limit(1);

    if (selectErr) {
      console.error('[Telegram Webhook] Error al consultar telegram_links:', selectErr.message);
      await enviarMensajeTelegram(chatId, '⚠️ Error de base de datos al verificar tu código. Por favor intenta más tarde.');
      return res.status(200).json({ ok: true, error: selectErr.message });
    }

    // 5. Caso: Código Encontrado -> Actualizar y Confirmar Vinculación
    if (rows && rows.length > 0) {
      const linkRecord = rows[0];

      // Actualizar registro en Supabase
      const updatePayload = {
        telegram_chat_id: String(chatId),
        is_verified: true
      };

      let query = supabase
        .from('telegram_links')
        .update(updatePayload);

      if (linkRecord.id) {
        query = query.eq('id', linkRecord.id);
      } else if (linkRecord.user_id) {
        query = query.eq('user_id', linkRecord.user_id);
      } else {
        query = query.eq('verification_code', linkRecord.verification_code);
      }

      const { error: updateErr } = await query;

      if (updateErr) {
        console.error('[Telegram Webhook] Error al actualizar telegram_links:', updateErr.message);
        await enviarMensajeTelegram(chatId, '⚠️ Error al guardar la vinculación en el sistema. Intenta generar un nuevo código.');
        return res.status(200).json({ ok: true, error: updateErr.message });
      }

      // Notificación exitosa al usuario por Telegram
      const mensajeConfirmacion = `🦅 *¡VINCULACIÓN EXITOSA CON CONDORFI!* 🦅

¡Hola *${nombreUsuario}*! Tu cuenta institucional ha sido verificada y enlazada correctamente a este chat (\`${chatId}\`).

🔔 *A partir de este momento recibirás en tiempo real:*
• 🚨 *Alertas de Arbitraje Cripto* (Spreads positivos detectados entre exchanges)
• 📊 *Señales Cuantitativas MTFA* (STRONG_BUY, quiebres de volatilidad y momentum)
• 💼 *Notificaciones de Portafolio* (Mark-to-Market y movimientos relevantes)

_Para desvincular o cambiar de cuenta, ingresa a los ajustes de tu terminal._`;

      await enviarMensajeTelegram(chatId, mensajeConfirmacion);

      return res.status(200).json({
        ok: true,
        vinculado: true,
        chat_id: chatId,
        user_id: linkRecord.user_id
      });
    }

    // 6. Caso: Código no encontrado o expirado
    const mensajeRechazo = `❌ *Código de verificación no encontrado*

El código \`${codigoLimpio}\` no coincide con ninguna solicitud pendiente de vinculación en CondorFi.

👉 *¿Cómo resolverlo?*
1. Inicia sesión en [condorfi.vercel.app](https://condorfi.vercel.app).
2. Abre la ventana de *Telegram* y haz clic en *Generar Código*.
3. Presiona el enlace directo para enviar el nuevo código al bot.`;

    await enviarMensajeTelegram(chatId, mensajeRechazo);

    return res.status(200).json({
      ok: true,
      vinculado: false,
      reason: 'codigo_no_coincide'
    });

  } catch (err) {
    console.error('[Telegram Webhook] Excepción no controlada:', err);
    return res.status(200).json({ ok: true, error: err.message });
  }
}
