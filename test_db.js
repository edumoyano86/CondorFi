/**
 * ==============================================================================
 * CondorFi - Script de Diagnóstico y Verificación de Base de Datos
 * Archivo: test_db.js
 * 
 * Descripción:
 * Consulta directamente Supabase para verificar la conectividad y leer las
 * últimas cotizaciones almacenadas por el enjambre, imprimiéndolas con console.table().
 * ==============================================================================
 */

import 'dotenv/config';
import WebSocket from 'ws';
if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket;
}
import { createClient } from '@supabase/supabase-js';

// Cargar y sanitizar variables de entorno
const rawUrl = process.env.SUPABASE_URL;
const supabaseUrl = rawUrl ? rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '') : null;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('\n❌ Error: Faltan SUPABASE_URL o SUPABASE_KEY en el archivo .env\n');
  process.exit(1);
}

// Inicializar cliente de Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

async function verificarBaseDeDatos() {
  console.log('\n🔍 Conectando con Supabase y consultando tabla "cotizaciones_historicas"...\n');

  try {
    // Consultar los últimos 4 registros ordenados por timestamp descendente
    const { data, error } = await supabase
      .from('cotizaciones_historicas')
      .select('id, timestamp, moneda, exchange, precio_compra, precio_venta')
      .order('timestamp', { ascending: false })
      .limit(4);

    if (error) {
      console.error('❌ Error devuelto por Supabase:', error.message);
      if (error.code === '42501') {
        console.warn('\n⚠️ Aviso de RLS: La política de Row Level Security está bloqueando la operación.');
        console.warn('Ejecuta en el SQL Editor de Supabase: ALTER TABLE public.cotizaciones_historicas DISABLE ROW LEVEL SECURITY;\n');
      }
      process.exit(1);
    }

    if (!data || data.length === 0) {
      console.log('⚠️ La conexión fue exitosa pero la tabla "cotizaciones_historicas" aún no tiene registros.');
      console.log('💡 Ejecuta "node bot_cripto.js" para que el enjambre inserte las primeras cotizaciones.\n');
      process.exit(0);
    }

    console.log(`✅ Se encontraron ${data.length} registros recientes del enjambre:\n`);

    // Formatear columnas para visualización clara en consola
    const vistaTabla = data.map(item => ({
      ID: item.id,
      Exchange: item.exchange,
      Moneda: item.moneda,
      'Precio Compra (Ask)': `$${Number(item.precio_compra).toFixed(2)}`,
      'Precio Venta (Bid)': `$${Number(item.precio_venta).toFixed(2)}`,
      Timestamp: new Date(item.timestamp).toLocaleString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires'
      })
    }));

    console.table(vistaTabla);
    console.log('\n📡 Verificación de base de datos completada con éxito.\n');
  } catch (err) {
    console.error('❌ Error inesperado al ejecutar la consulta:', err.message);
    process.exit(1);
  }
}

verificarBaseDeDatos();
