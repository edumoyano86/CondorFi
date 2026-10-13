import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import condorLogo from './assets/condorfi-logo.png';
import { supabase } from './lib/supabase';
import {
  Activity,
  Zap,
  Cpu,
  Database,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
  Sparkles,
  Layers,
  Radio,
  Percent,
  DollarSign,
  AlertCircle,
  Clock,
  ArrowRight,
  CheckCircle2,
  Table,
  Coins,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Bell,
  BellOff,
  Volume2,
  Building2,
  BarChart3,
  Globe,
  Download
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from 'recharts';

const MONEDAS_DISPONIBLES = ['USDT', 'BTC', 'ETH', 'USDC'];

// Configuración de costos y fricción operativa inter-exchange (0.5% compra + 0.5% venta = 1.0% total)
const COMISIONES_CONFIG = {
  compraPct: 0.005, // 0.5% por operación de compra
  ventaPct: 0.005,  // 0.5% por operación de venta
  friccionTotalPct: 0.01, // 1.0% fricción combinada
  etiquetaBadge: 'Comisiones estimadas descontadas (~1.0% total)'
};

/**
 * Gestión de Riesgo y Profundidad de Mercado (Slippage):
 * Determina el 'Volumen Máximo Sugerido'.
 * Regla de gestión: a mayor spread neto, mayor volumen permitido (mayor colchón ante slippage),
 * con un tope de seguridad establecido en el equivalente a 500 USD.
 */
function calcularVolumenSeguro(spreadNetoPct, askPrecioARS, moneda, precioUsdtArs = 1610) {
  if (spreadNetoPct <= 0 || !askPrecioARS) {
    return {
      cantidad: 0,
      usdEquivalente: 0,
      texto: `0 ${moneda}`
    };
  }

  // Escala progresiva: de 50 USD hasta 500 USD según el spread neto
  // Si spreadNetoPct es ajustado (<= 0.2%) -> ~50-160 USD
  // Si spreadNetoPct es amplio (>= 0.8%) -> 500 USD (tope de seguridad)
  const factor = Math.min(1, Math.max(0.1, spreadNetoPct / 0.8));
  const usdEquivalente = Math.round(50 + factor * (500 - 50));

  // Tasa de cambio de referencia en ARS por USD
  const tasaUSD = precioUsdtArs > 0 ? precioUsdtArs : 1610;
  const precioUnitarioUSD = askPrecioARS / tasaUSD;
  const cantidadRaw = usdEquivalente / (precioUnitarioUSD || 1);

  let cantidad = 0;
  let texto = '';

  if (moneda === 'BTC') {
    cantidad = Number(cantidadRaw.toFixed(5));
    texto = `${cantidad} BTC (~$${usdEquivalente} USD)`;
  } else if (moneda === 'ETH') {
    cantidad = Number(cantidadRaw.toFixed(4));
    texto = `${cantidad} ETH (~$${usdEquivalente} USD)`;
  } else if (moneda === 'USDT' || moneda === 'USDC') {
    cantidad = Math.round(usdEquivalente);
    texto = `${cantidad.toLocaleString('es-AR')} ${moneda} (~$${usdEquivalente} USD)`;
  } else {
    cantidad = Number(cantidadRaw.toFixed(2));
    texto = `${cantidad.toLocaleString('es-AR')} ${moneda} (~$${usdEquivalente} USD)`;
  }

  return {
    cantidad,
    usdEquivalente,
    texto
  };
}

/**
 * Reproduce un sonido armónico 'ding' suave y profesional usando la Web Audio API.
 * 100% nativo, sin dependencias externas ni problemas de red.
 */
function reproducirDingSonoro() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const oscilador = ctx.createOscillator();
    const ganancia = ctx.createGain();

    const ahora = ctx.currentTime;
    oscilador.type = 'sine';

    // Salto armónico suave y elegante: 880Hz (La) a 1320Hz (Mi)
    oscilador.frequency.setValueAtTime(880, ahora);
    oscilador.frequency.exponentialRampToValueAtTime(1320, ahora + 0.08);

    // Envolvente de volumen: ataque de 15ms y decaimiento suave a 550ms
    ganancia.gain.setValueAtTime(0.0001, ahora);
    ganancia.gain.linearRampToValueAtTime(0.28, ahora + 0.02);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.55);

    oscilador.connect(ganancia);
    ganancia.connect(ctx.destination);

    oscilador.start(ahora);
    oscilador.stop(ahora + 0.6);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1000);
  } catch (err) {
    console.warn('[Audio] Error al reproducir ding:', err);
  }
}

/**
 * Solicita permisos al navegador para notificaciones push de escritorio.
 */
async function solicitarPermisoNotificaciones() {
  if (!('Notification' in window)) {
    console.warn('[Push] Notification API no disponible en este navegador.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      const permiso = await Notification.requestPermission();
      return permiso === 'granted';
    } catch (err) {
      console.warn('[Push] Error solicitando permisos de notificación:', err);
      return false;
    }
  }

  return false;
}

/**
 * Formatea un timestamp a una representación relativa amigable ("Hace 5 min", "Hace 2 h", etc.)
 */
function formatearTiempoRelativo(timestamp) {
  if (!timestamp) return 'Reciente';
  try {
    const ahora = Date.now();
    const fecha = new Date(timestamp).getTime();
    if (isNaN(fecha)) return 'Reciente';
    const diffSegundos = Math.floor((ahora - fecha) / 1000);

    if (diffSegundos < 60) return 'Hace unos segundos';
    const diffMinutos = Math.floor(diffSegundos / 60);
    if (diffMinutos < 60) return `Hace ${diffMinutos} min`;
    const diffHoras = Math.floor(diffMinutos / 60);
    if (diffHoras < 24) return `Hace ${diffHoras} h`;
    const diffDias = Math.floor(diffHoras / 24);
    return `Hace ${diffDias} d`;
  } catch {
    return 'Reciente';
  }
}

// Lista de exchanges de referencia
const EXCHANGES_CONFIG = [
  { id: 'node-lemon',        nombre: 'Lemon Cash',    clave: 'lemon',        rol: 'Mapeo Liquidez Retail' },
  { id: 'node-binance',      nombre: 'Binance P2P',   clave: 'binance',      rol: 'Mercado P2P Global' },
  { id: 'node-fiwind',       nombre: 'Fiwind',        clave: 'fiwind',       rol: 'Arco de Arbitraje OTC' },
  { id: 'node-buenbit',      nombre: 'Buenbit',       clave: 'buenbit',      rol: 'Rastreo Spread Alto' },
  { id: 'node-belo',         nombre: 'Belo',          clave: 'belo',         rol: 'Billetera Cripto & Tarjeta' },
  { id: 'node-ripio',        nombre: 'Ripio',         clave: 'ripio',        rol: 'Vigilancia Institucional' },
  { id: 'node-satoshitango', nombre: 'SatoshiTango',  clave: 'satoshitango', rol: 'Gateway Cripto' },
  { id: 'node-tiendacrypto', nombre: 'TiendaCrypto',  clave: 'tiendacrypto', rol: 'Arbitraje Minorista' },
  { id: 'node-letsbit',      nombre: 'Let\'sBit',     clave: 'letsbit',      rol: 'Fintech Multimoneda' },
  { id: 'node-decrypto',     nombre: 'Decrypto',      clave: 'decrypto',     rol: 'Mesa de Dinero OTC' }
];

export default function App() {
  const [monedaActiva, setMonedaActiva] = useState('USDT');
  const [seccionActiva, setSeccionActiva] = useState('mercado');
  const [estaActualizando, setEstaActualizando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState('Iniciando...');
  const [modoTiempo, setModoTiempo] = useState('24H');
  const [registrosCompletos, setRegistrosCompletos] = useState([]);
  const [registrosTradfi, setRegistrosTradfi] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [ejecutandoInsight, setEjecutandoInsight] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [tabActivo, setTabActivo] = useState('cripto');
  const [conectadoSupabase, setConectadoSupabase] = useState(false);

  // Sistema de Alertas Sonoras y Push Notifications
  const [alertasHabilitadas, setAlertasHabilitadas] = useState(false);
  const ultimaAlertaRef = useRef(null);

  // Activación / Muteo de Alertas con solicitud de permisos
  const toggleAlertas = async () => {
    if (!alertasHabilitadas) {
      const permisoConcedido = await solicitarPermisoNotificaciones();
      setAlertasHabilitadas(true);
      // Ding de confirmación inmediata
      reproducirDingSonoro();

      if (permisoConcedido) {
        try {
          new Notification('CondorFi: Radar de Alertas Activo', {
            body: 'Recibirás sonido y notificaciones push cuando se detecte arbitraje neto rentable.',
            icon: condorLogo
          });
        } catch (e) {
          console.warn('[Push] Notificación de bienvenida:', e);
        }
      }
    } else {
      setAlertasHabilitadas(false);
      ultimaAlertaRef.current = null;
    }
  };

  // Consulta reactiva a Supabase con límite amplio para capturar todos los activos
  const fetchCotizacionesReales = useCallback(async () => {
    setEstaActualizando(true);

    if (!supabase) {
      setConectadoSupabase(false);
      setUltimaSincronizacion('Modo Simulación (Sin credenciales)');
      setCargando(false);
      setEstaActualizando(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('cotizaciones_historicas')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(200);

      if (error) throw error;

      setConectadoSupabase(true);

      if (data && data.length > 0) {
        setRegistrosCompletos(data);
        setUltimaSincronizacion(
          new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
      } else {
        setUltimaSincronizacion('Tabla vacía');
        setRegistrosCompletos([]);
      }

      // Consulta de cotizaciones TradFi (mercado tradicional: acciones e índices)
      try {
        const { data: dataTradfi, error: errTradfi } = await supabase
          .from('cotizaciones_tradfi')
          .select('*')
          .order('id', { ascending: false })
          .limit(100);

        if (!errTradfi && dataTradfi && dataTradfi.length > 0) {
          setRegistrosTradfi(dataTradfi);
        }
      } catch (eTradfi) {
        console.warn('[TradFi] Aviso al consultar cotizaciones_tradfi:', eTradfi);
      }

      // Consulta de Alertas Quants desde alertas_mercado (últimas 10 alertas ordenadas por timestamp desc)
      try {
        const { data: dataAlertas, error: errAlertas } = await supabase
          .from('alertas_mercado')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(10);

        if (!errAlertas && dataAlertas) {
          setAlertas(dataAlertas);
        }
      } catch (eAlertas) {
        console.warn('[Alertas] Aviso al consultar alertas_mercado:', eAlertas);
      }
    } catch (err) {
      console.error('Error al consultar Supabase:', err);
      setConectadoSupabase(false);
      setUltimaSincronizacion('Error de conexión');
    } finally {
      setCargando(false);
      setEstaActualizando(false);
    }
  }, []);

  useEffect(() => {
    fetchCotizacionesReales();
  }, [fetchCotizacionesReales]);

  // Disparador manual para el Motor de Insights Quants (Serverless Function /api/generar-insights)
  const ejecutarAnalisisQuant = async () => {
    setEjecutandoInsight(true);
    try {
      const endpointUrl = tabActivo === 'tradfi'
        ? `/api/generar-insights?mercado=tradfi&ticker=SPY`
        : `/api/generar-insights?mercado=cripto&moneda=${monedaActiva}`;
      const res = await fetch(endpointUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.alerta) {
          setAlertas(prev => [data.alerta, ...prev.filter(a => a.id !== data.alerta.id).slice(0, 9)]);
        }
      }
      if (supabase) {
        const { data: dataAlertas } = await supabase
          .from('alertas_mercado')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(10);
        if (dataAlertas && dataAlertas.length > 0) {
          setAlertas(dataAlertas);
        }
      }
    } catch (err) {
      console.warn('Error al invocar /api/generar-insights:', err);
    } finally {
      setEjecutandoInsight(false);
    }
  };

  /**
   * Exporta las cotizaciones históricas a un archivo CSV nativo mediante Blob y URL.createObjectURL.
   * Consulta los últimos 1000 registros de Supabase con fallback a los registros en memoria.
   */
  const descargarHistorialCSV = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      let registrosAExportar = [];

      // 1. Intentar consultar hasta 1000 registros recientes en Supabase
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('cotizaciones_historicas')
            .select('timestamp, moneda, exchange_compra, exchange_venta, exchange, precio_compra, precio_venta, spread')
            .order('timestamp', { ascending: false })
            .limit(1000);

          if (!error && data && data.length > 0) {
            registrosAExportar = data;
          }
        } catch (e) {
          console.warn('[CSV Export] Aviso al consultar Supabase:', e);
        }
      }

      // 2. Fallback a registros en memoria si la consulta no devuelve datos
      if (registrosAExportar.length === 0) {
        registrosAExportar = registrosCompletos.length > 0 ? registrosCompletos : registrosMoneda;
      }

      if (registrosAExportar.length === 0) {
        alert('No hay cotizaciones disponibles para exportar en este momento.');
        return;
      }

      // 3. Encabezados exactos requeridos
      const encabezados = ['timestamp', 'moneda', 'exchange_compra', 'exchange_venta', 'spread'];

      // Función para escapar campos con comas, comillas o saltos de línea
      const escapar = val => {
        const str = String(val ?? '');
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      };

      // 4. Conversión de objetos JSON a filas de texto CSV
      const filasCSV = registrosAExportar.map(r => {
        const timestamp = r.timestamp || new Date().toISOString();
        const moneda = r.moneda || monedaActiva || 'USDT';

        // Determinar exchange_compra y exchange_venta
        let exCompra = r.exchange_compra || '';
        let exVenta = r.exchange_venta || '';
        if (!exCompra && r.exchange && r.exchange.includes('->')) {
          const partes = r.exchange.split('->');
          exCompra = partes[0]?.trim();
          exVenta = partes[1]?.replace(/\(.*?\)/g, '')?.trim();
        } else if (!exCompra) {
          exCompra = r.exchange || 'N/A';
          exVenta = r.exchange || 'N/A';
        }

        // Calcular o formatear el spread
        let spreadValor = 0;
        if (typeof r.spread === 'number' && !isNaN(r.spread)) {
          spreadValor = r.spread;
        } else if (r.precio_compra > 0 && r.precio_venta > 0) {
          spreadValor = Number((((r.precio_venta - r.precio_compra) / r.precio_compra) * 100).toFixed(4));
        }

        return [
          escapar(timestamp),
          escapar(moneda),
          escapar(exCompra),
          escapar(exVenta),
          escapar(spreadValor.toFixed(4))
        ].join(',');
      });

      const contenidoCSV = [encabezados.join(','), ...filasCSV].join('\r\n');

      // 5. Creación del objeto Blob nativo y enlace temporal <a>
      const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
      const fechaActual = new Date().toISOString().slice(0, 10);
      const nombreArchivo = `condorfi_export_${fechaActual}.csv`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', nombreArchivo);
      document.body.appendChild(link);
      link.click();

      // Limpieza del enlace y liberación del recurso
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Error al exportar datos a CSV:', err);
      alert('Ocurrió un error al generar la descarga del archivo CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  // Filtrado de registros exclusivos para la moneda seleccionada
  const registrosMoneda = useMemo(() => {
    return registrosCompletos.filter(r => (r.moneda || 'USDT').toUpperCase() === monedaActiva);
  }, [registrosCompletos, monedaActiva]);

  // Nodos activos calculados para la moneda seleccionada
  const nodos = useMemo(() => {
    const mapaExchanges = new Map();
    registrosMoneda.forEach(item => {
      const nombre = item.exchange?.trim();
      if (nombre && !mapaExchanges.has(nombre)) {
        mapaExchanges.set(nombre, item);
      }
    });

    if (mapaExchanges.size > 0) {
      return Array.from(mapaExchanges.entries()).map(([nombre, registro], index) => {
        const conf = EXCHANGES_CONFIG.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
        return {
          id: `node-${nombre.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          nombre,
          compra: Number(registro.precio_compra) || 0,
          venta: Number(registro.precio_venta) || 0,
          latencia: 25 + (index * 4),
          altitud: `${3100 + (index * 70)}m`,
          bateria: 95 + (index % 5),
          rol: conf?.rol || 'Exchange de Liquidez'
        };
      });
    }

    // Fallback de demostración proporcional al activo seleccionado
    const multiplicadorBase = monedaActiva === 'BTC' ? 83000 : monedaActiva === 'ETH' ? 2500 : 1;
    return EXCHANGES_CONFIG.map((conf, index) => ({
      id: conf.id,
      nombre: conf.nombre,
      compra: Number((1612 * multiplicadorBase * (1 + index * 0.003)).toFixed(2)),
      venta: Number((1580 * multiplicadorBase * (1 + index * 0.002)).toFixed(2)),
      latencia: 30 + index * 3,
      altitud: `${3100 + (index * 70)}m`,
      bateria: 96,
      rol: conf.rol
    }));
  }, [registrosMoneda, monedaActiva]);

  // Datos cronológicos para el gráfico filtrados por moneda
  const datosGrafico = useMemo(() => {
    if (registrosMoneda.length > 0) {
      return [...registrosMoneda]
        .reverse()
        .slice(-20)
        .map(d => ({
          hora: new Date(d.timestamp).toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }),
          promedio: Number(d.precio_compra) || 0
        }));
    }

    const base = monedaActiva === 'BTC' ? 134200000 : monedaActiva === 'ETH' ? 4050000 : 1612;
    return [
      { hora: '08:00', promedio: base * 0.98 },
      { hora: '09:00', promedio: base * 0.99 },
      { hora: '10:00', promedio: base * 1.002 },
      { hora: '11:00', promedio: base * 1.008 },
      { hora: '12:00', promedio: base * 1.005 },
      { hora: '13:00', promedio: base * 1.012 },
    ];
  }, [registrosMoneda, monedaActiva]);

  // Datos cronológicos comparativos para el LineChart (BTC vs USDT) en las últimas horas
  const datosGraficoBTCyUSDT = useMemo(() => {
    const registrosBTC = registrosCompletos.filter(r => (r.moneda || '').toUpperCase() === 'BTC');
    const registrosUSDT = registrosCompletos.filter(r => (r.moneda || '').toUpperCase() === 'USDT');

    if (registrosBTC.length > 0 || registrosUSDT.length > 0) {
      const mapaTiempos = new Map();

      // Procesar BTC cronológicamente
      [...registrosBTC].reverse().forEach(r => {
        const d = new Date(r.timestamp);
        const horaStr = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        const clave = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()} ${horaStr}`;
        if (!mapaTiempos.has(clave)) {
          mapaTiempos.set(clave, { hora: horaStr, rawTime: d.getTime(), btcPuntos: [], usdtPuntos: [] });
        }
        const precio = Number(r.precio_compra) || Number(r.precio_venta) || 0;
        if (precio > 0) mapaTiempos.get(clave).btcPuntos.push(precio);
      });

      // Procesar USDT cronológicamente
      [...registrosUSDT].reverse().forEach(r => {
        const d = new Date(r.timestamp);
        const horaStr = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        const clave = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()} ${horaStr}`;
        if (!mapaTiempos.has(clave)) {
          mapaTiempos.set(clave, { hora: horaStr, rawTime: d.getTime(), btcPuntos: [], usdtPuntos: [] });
        }
        const precio = Number(r.precio_compra) || Number(r.precio_venta) || 0;
        if (precio > 0) mapaTiempos.get(clave).usdtPuntos.push(precio);
      });

      let ultBTC = 131500000;
      let ultUSDT = 1608;

      const puntos = Array.from(mapaTiempos.values())
        .sort((a, b) => a.rawTime - b.rawTime)
        .slice(-25)
        .map(item => {
          if (item.btcPuntos.length > 0) {
            ultBTC = Math.round(item.btcPuntos.reduce((a, b) => a + b, 0) / item.btcPuntos.length);
          }
          if (item.usdtPuntos.length > 0) {
            ultUSDT = Number((item.usdtPuntos.reduce((a, b) => a + b, 0) / item.usdtPuntos.length).toFixed(2));
          }
          return {
            hora: item.hora,
            BTC: ultBTC,
            USDT: ultUSDT
          };
        });

      if (puntos.length >= 2) {
        return puntos;
      }
    }

    // Curva de demostración para las últimas horas en caso de que Supabase esté inicializándose
    return [
      { hora: '12:00', BTC: 131200000, USDT: 1604.5 },
      { hora: '13:00', BTC: 131450000, USDT: 1606.2 },
      { hora: '14:00', BTC: 131380000, USDT: 1605.8 },
      { hora: '15:00', BTC: 131620000, USDT: 1607.4 },
      { hora: '16:00', BTC: 131550000, USDT: 1608.9 },
      { hora: '17:00', BTC: 131800000, USDT: 1609.5 },
      { hora: '18:00', BTC: 131750000, USDT: 1610.1 },
      { hora: '19:00', BTC: 131920000, USDT: 1609.8 }
    ];
  }, [registrosCompletos]);

  // Oportunidades de Arbitraje Actuales calculadas en tiempo real para todos los activos
  const oportunidadesActuales = useMemo(() => {
    return MONEDAS_DISPONIBLES.map(moneda => {
      const registrosMonedaActual = registrosCompletos.filter(
        r => (r.moneda || '').toUpperCase() === moneda
      );

      // Si los registros provienen del bot serverless con spread y exchanges ya calculados
      const registroBot = registrosMonedaActual.find(
        r => r.exchange_compra && r.exchange_venta
      );

      if (registroBot) {
        const ask = Number(registroBot.precio_compra) || 0;
        const bid = Number(registroBot.precio_venta) || 0;
        const difPesos = Number((bid - ask).toFixed(2));
        const spreadBruto = Number((((bid - ask) / (ask || 1)) * 100).toFixed(2));
        const spreadGuardado = typeof registroBot.spread === 'number' ? Number(registroBot.spread.toFixed(2)) : spreadBruto;

        return {
          moneda,
          exchangeCompra: registroBot.exchange_compra,
          precioCompra: ask,
          exchangeVenta: registroBot.exchange_venta,
          precioVenta: bid,
          diferenciaPesos: difPesos,
          spread: spreadGuardado,
          spreadNeto: Number((((bid * 0.995 - ask * 1.005) / (ask * 1.005 || 1)) * 100).toFixed(2)),
          timestamp: registroBot.timestamp,
          fuente: 'Bot Serverless Vercel'
        };
      }

      // Si hay cotizaciones de exchanges individuales en Supabase
      const mapaEx = new Map();
      registrosMonedaActual.forEach(item => {
        const nom = item.exchange?.trim();
        if (nom && !mapaEx.has(nom)) {
          mapaEx.set(nom, item);
        }
      });

      if (mapaEx.size > 0) {
        const lista = Array.from(mapaEx.values());
        const minAskItem = lista.reduce((min, c) => (Number(c.precio_compra) < Number(min.precio_compra) ? c : min), lista[0]);
        const maxBidItem = lista.reduce((max, c) => (Number(c.precio_venta) > Number(max.precio_venta) ? c : max), lista[0]);

        const ask = Number(minAskItem.precio_compra) || 0;
        const bid = Number(maxBidItem.precio_venta) || 0;
        const difPesos = Number((bid - ask).toFixed(2));
        const spreadBruto = Number((((bid - ask) / (ask || 1)) * 100).toFixed(2));
        const spreadNeto = Number((((bid * 0.995 - ask * 1.005) / (ask * 1.005 || 1)) * 100).toFixed(2));

        return {
          moneda,
          exchangeCompra: minAskItem.exchange,
          precioCompra: ask,
          exchangeVenta: maxBidItem.exchange,
          precioVenta: bid,
          diferenciaPesos: difPesos,
          spread: spreadBruto,
          spreadNeto,
          timestamp: minAskItem.timestamp,
          fuente: 'Red de Exchanges'
        };
      }

      // Demostración proporcional cuando no hay registros de esa moneda
      const base = moneda === 'BTC' ? 131500000 : moneda === 'ETH' ? 3920000 : 1608;
      const spreadDemo = moneda === 'USDT' ? 1.45 : moneda === 'BTC' ? 0.38 : moneda === 'ETH' ? 1.22 : -0.25;
      const askDemo = base;
      const bidDemo = Number((base * (1 + spreadDemo / 100)).toFixed(2));

      return {
        moneda,
        exchangeCompra: moneda === 'USDT' ? 'Bitso' : moneda === 'BTC' ? 'Bitso' : 'Fiwind',
        precioCompra: askDemo,
        exchangeVenta: moneda === 'USDT' ? 'Lemon Cash' : moneda === 'BTC' ? 'Binance' : 'Buenbit',
        precioVenta: bidDemo,
        diferenciaPesos: Number((bidDemo - askDemo).toFixed(2)),
        spread: spreadDemo,
        spreadNeto: Number((spreadDemo - 1.0).toFixed(2)),
        timestamp: new Date().toISOString(),
        fuente: 'Radar Predictivo'
      };
    });
  }, [registrosCompletos]);

  // Resumen de últimos precios y variaciones para TradFi (SPY, QQQ, AAPL, ^MERV)
  const ultimosTradfi = useMemo(() => {
    const tickersConfig = [
      { ticker: 'SPY', nombre: 'S&P 500 ETF Trust', mercado: 'NYSE Arca', moneda: 'USD', base: 777.26, open: 777.34 },
      { ticker: 'QQQ', nombre: 'Invesco QQQ (Nasdaq 100)', mercado: 'NASDAQ', moneda: 'USD', base: 743.01, open: 739.53 },
      { ticker: 'AAPL', nombre: 'Apple Inc.', mercado: 'NASDAQ', moneda: 'USD', base: 344.29, open: 344.67 },
      { ticker: '^MERV', nombre: 'S&P Merval Argentina', mercado: 'BYMA', moneda: 'ARS', base: 2881671, open: 2828027 }
    ];

    return tickersConfig.map(t => {
      const registro = registrosTradfi.find(r => r.ticker === t.ticker);
      const precioActual = Number(registro?.precio_actual) || t.base;
      const precioApertura = Number(registro?.precio_apertura) || t.open;
      const variacion = precioApertura > 0
        ? Number((((precioActual - precioApertura) / precioApertura) * 100).toFixed(2))
        : 0;

      return {
        ticker: t.ticker,
        nombre: t.nombre,
        mercado: t.mercado,
        moneda: registro?.moneda || t.moneda,
        precioActual,
        precioApertura,
        variacion,
        timestamp: registro?.timestamp || new Date().toISOString()
      };
    });
  }, [registrosTradfi]);

  // Datos cronológicos para el LineChart TradFi con Doble Eje Y (USD y ARS)
  const datosGraficoTradfi = useMemo(() => {
    const mapaTiempos = new Map();
    [...registrosTradfi].reverse().forEach(r => {
      const d = new Date(r.timestamp);
      const horaStr = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      const clave = d.toISOString().slice(0, 16);
      if (!mapaTiempos.has(clave)) {
        mapaTiempos.set(clave, { hora: horaStr, rawTime: d.getTime(), SPY: null, QQQ: null, AAPL: null, MERV: null });
      }
      const punto = mapaTiempos.get(clave);
      const precio = Number(r.precio_actual) || 0;
      if (r.ticker === 'SPY') punto.SPY = precio;
      if (r.ticker === 'QQQ') punto.QQQ = precio;
      if (r.ticker === 'AAPL') punto.AAPL = precio;
      if (r.ticker === '^MERV') punto.MERV = precio;
    });

    const puntosReales = Array.from(mapaTiempos.values())
      .sort((a, b) => a.rawTime - b.rawTime)
      .filter(p => p.SPY || p.QQQ || p.AAPL || p.MERV);

    if (puntosReales.length >= 3) {
      let lSPY = 777.26, lQQQ = 743.01, lAAPL = 344.29, lMERV = 2881671;
      return puntosReales.map(p => {
        if (p.SPY) lSPY = p.SPY;
        if (p.QQQ) lQQQ = p.QQQ;
        if (p.AAPL) lAAPL = p.AAPL;
        if (p.MERV) lMERV = p.MERV;
        return {
          hora: p.hora,
          SPY: lSPY,
          QQQ: lQQQ,
          AAPL: lAAPL,
          MERV: lMERV
        };
      });
    }

    // Curva intradiaria continua coherente con los valores capturados en Supabase
    const regSPY = Number(ultimosTradfi.find(t => t.ticker === 'SPY')?.precioActual) || 777.26;
    const regQQQ = Number(ultimosTradfi.find(t => t.ticker === 'QQQ')?.precioActual) || 743.01;
    const regAAPL = Number(ultimosTradfi.find(t => t.ticker === 'AAPL')?.precioActual) || 344.29;
    const regMERV = Number(ultimosTradfi.find(t => t.ticker === '^MERV')?.precioActual) || 2881671;

    const openSPY = Number(ultimosTradfi.find(t => t.ticker === 'SPY')?.precioApertura) || 777.34;
    const openQQQ = Number(ultimosTradfi.find(t => t.ticker === 'QQQ')?.precioApertura) || 739.53;
    const openAAPL = Number(ultimosTradfi.find(t => t.ticker === 'AAPL')?.precioApertura) || 344.67;
    const openMERV = Number(ultimosTradfi.find(t => t.ticker === '^MERV')?.precioApertura) || 2828027;

    return [
      { hora: '10:00', SPY: openSPY, QQQ: openQQQ, AAPL: openAAPL, MERV: openMERV },
      { hora: '11:30', SPY: Number((openSPY * 0.998).toFixed(2)), QQQ: Number((openQQQ * 1.002).toFixed(2)), AAPL: Number((openAAPL * 0.997).toFixed(2)), MERV: Number((openMERV * 1.008).toFixed(0)) },
      { hora: '13:00', SPY: Number((openSPY * 1.001).toFixed(2)), QQQ: Number((openQQQ * 1.003).toFixed(2)), AAPL: Number((openAAPL * 1.001).toFixed(2)), MERV: Number((openMERV * 1.012).toFixed(0)) },
      { hora: '14:30', SPY: Number((openSPY * 0.999).toFixed(2)), QQQ: Number((openQQQ * 1.004).toFixed(2)), AAPL: Number((openAAPL * 0.998).toFixed(2)), MERV: Number((openMERV * 1.015).toFixed(0)) },
      { hora: '16:00', SPY: regSPY, QQQ: regQQQ, AAPL: regAAPL, MERV: regMERV }
    ];
  }, [registrosTradfi, ultimosTradfi]);

  // 1. Lógica Dinámica de Arbitraje Neto (restando comisiones operativas)
  const analisisArbitraje = useMemo(() => {
    if (!nodos || nodos.length === 0) return null;

    const nodoMenorCompra = nodos.reduce((min, n) => (n.compra < min.compra ? n : min), nodos[0]);
    const nodoMayorVenta = nodos.reduce((max, n) => (n.venta > max.venta ? n : max), nodos[0]);

    const ask = nodoMenorCompra.compra;
    const bid = nodoMayorVenta.venta;

    // Métricas brutas
    const diferenciaBrutaPesos = Number((bid - ask).toFixed(2));
    const spreadBrutoPorcentaje = Number(((diferenciaBrutaPesos / (ask || 1)) * 100).toFixed(2));

    // Lógica Matemática Real de Spread Neto:
    // Costo Real Compra = Ask + (Ask * 0.005)
    const comisionCompraPesos = ask * COMISIONES_CONFIG.compraPct;
    const costoRealCompra = ask + comisionCompraPesos;

    // Ingreso Neto Venta = Bid - (Bid * 0.005)
    const comisionVentaPesos = bid * COMISIONES_CONFIG.ventaPct;
    const ingresoNetoVenta = bid - comisionVentaPesos;

    // Spread Neto = Ingreso Neto Venta - Costo Real Compra
    const spreadNetoPesos = Number((ingresoNetoVenta - costoRealCompra).toFixed(2));
    const spreadNetoPorcentaje = Number(((spreadNetoPesos / (costoRealCompra || 1)) * 100).toFixed(2));

    const comisionesTotalesPesos = Number((comisionCompraPesos + comisionVentaPesos).toFixed(2));

    // Bloqueo estricto: solo hay alerta positiva si el Spread Neto es estrictamente mayor a 0
    const hayArbitrajePositivo = spreadNetoPesos > 0;

    // Semáforo de Riesgo (Slippage):
    // Si el spread neto es muy ajustado (<= 0.2%), alerta en tono amarillo/naranja con ⚠️ Riesgo de Slippage Alto
    // Si es mayor a 0.2%, se mantiene en verde esmeralda con ✅ Operación Segura
    const esSlippageAlto = spreadNetoPorcentaje <= 0.2;
    const riesgoSlippageTexto = esSlippageAlto ? 'Riesgo de Slippage Alto' : 'Operación Segura';
    const riesgoSlippageIcono = esSlippageAlto ? '⚠️' : '✅';

    // Cálculo del Volumen Máximo Sugerido por Gestión de Riesgo (Tope ~500 USD)
    const volumenSugerido = calcularVolumenSeguro(
      spreadNetoPorcentaje,
      ask,
      monedaActiva
    );

    return {
      nodoCompra: nodoMenorCompra,
      nodoVenta: nodoMayorVenta,
      ask,
      bid,
      costoRealCompra,
      ingresoNetoVenta,
      comisionCompraPesos,
      comisionVentaPesos,
      comisionesTotalesPesos,
      diferenciaBrutaPesos,
      spreadBrutoPorcentaje,
      spreadNetoPesos,
      spreadNetoPorcentaje,
      esSlippageAlto,
      riesgoSlippageTexto,
      riesgoSlippageIcono,
      volumenSugerido,
      // Alias para vistas
      diferenciaPesos: spreadNetoPesos,
      spreadPorcentaje: spreadNetoPorcentaje,
      hayArbitrajePositivo
    };
  }, [nodos, monedaActiva]);

  // Lógica de Alertas Sonoras y Push Notifications con Prevención de Spam
  useEffect(() => {
    if (!alertasHabilitadas) return;

    if (!analisisArbitraje?.hayArbitrajePositivo) {
      // Si el mercado no presenta arbitraje neto positivo, reseteamos para alertar en la próxima oportunidad
      ultimaAlertaRef.current = null;
      return;
    }

    const { nodoCompra, nodoVenta, spreadNetoPorcentaje, spreadNetoPesos } = analisisArbitraje;
    // Huella única de la oportunidad detectada
    const huellaActual = `${monedaActiva}-${nodoCompra.id}-${nodoVenta.id}-${spreadNetoPesos}`;

    // Prevención de spam: no volver a sonar si es exactamente la misma oportunidad ya notificada
    if (ultimaAlertaRef.current === huellaActual) {
      return;
    }

    // Guardar huella en el ref para silenciar hasta que el mercado cambie
    ultimaAlertaRef.current = huellaActual;

    // 1. Sonido 'ding' Web Audio API
    reproducirDingSonoro();

    // 2. Notificación push de escritorio si tiene permisos concedidos
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const titulo = `CondorFi: Oportunidad en ${monedaActiva} (+${spreadNetoPorcentaje}%)`;
        const cuerpo = `Comprar en ${nodoCompra.nombre} y vender en ${nodoVenta.nombre}. Spread neto: +$${spreadNetoPesos.toLocaleString('es-AR')} ARS (+${spreadNetoPorcentaje}%).`;

        new Notification(titulo, {
          body: cuerpo,
          icon: condorLogo,
          tag: `condorfi-${monedaActiva}`,
          renotify: true
        });
      } catch (err) {
        console.warn('[Push] Error al emitir notificación:', err);
      }
    }
  }, [alertasHabilitadas, analisisArbitraje, monedaActiva]);

  // Estadísticas globales filtradas
  const mejorCompra = analisisArbitraje?.nodoCompra.compra ?? 0;
  const mejorVenta = analisisArbitraje?.nodoVenta.venta ?? 0;
  const promedioCompra = nodos.length > 0
    ? (nodos.reduce((acc, curr) => acc + curr.compra, 0) / nodos.length)
    : 0;

  // Formateador de moneda adaptable para BTC/ETH vs USDT/USDC
  const formatearPrecio = (valor) => {
    if (valor >= 1000000) {
      return `$${(valor / 1000000).toFixed(2)}M ARS`;
    }
    return `$${Number(valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS`;
  };

  const formatearTick = (val) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    return `$${Math.round(val)}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex text-gray-900 font-sans selection:bg-orange-500 selection:text-white">
      {/* =========================================================================
          1. SIDEBAR (Minimalismo Limpio estilo Stripe / Vercel)
      ========================================================================== */}
      <aside className="w-64 hidden lg:flex flex-col border-r border-gray-200 bg-white p-5 justify-between z-20 shadow-xs">
        <div>
          <div className="flex items-center gap-3 px-1 py-2 mb-6 border-b border-gray-100 pb-5">
            <div className="p-1 rounded-xl bg-gray-50 border border-gray-200 shadow-2xs">
              <img
                src={condorLogo}
                alt="CondorFi Isotipo"
                className="w-10 h-10 object-cover rounded-lg"
              />
            </div>
            <div>
              <div className="flex items-center">
                <span className="text-lg font-extrabold tracking-tight text-gray-900">
                  CONDOR<span className="text-orange-600">FI</span>
                </span>
              </div>
              <p className="text-[11px] font-mono tracking-wider text-gray-500 uppercase">
                Multi-Asset Swarm
              </p>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'mercado', label: 'Radar de Mercado', icon: Activity, badge: monedaActiva },
              {
                id: 'arbitraje',
                label: 'Matriz de Arbitraje',
                icon: Zap,
                badge: analisisArbitraje?.hayArbitrajePositivo
                  ? `+${analisisArbitraje.spreadPorcentaje}%`
                  : 'Sin Arbitraje'
              },
              { id: 'enjambre', label: 'Nodos en Vuelo', icon: Cpu, badge: `${nodos.length} Nodos` },
              { id: 'historial', label: 'Live Data Feed', icon: Table, badge: `${registrosMoneda.length} filas` },
            ].map(item => {
              const Icon = item.icon;
              const activo = seccionActiva === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setSeccionActiva(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition duration-150 ${
                    activo
                      ? 'bg-gray-100 text-gray-900 font-semibold border border-gray-200 shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${activo ? 'text-orange-600' : 'text-gray-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      activo
                        ? 'border-gray-300 bg-white text-gray-800'
                        : 'border-gray-200 bg-gray-50 text-gray-500'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-gray-100">
          <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/70">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-600" />
                <span className="text-xs font-semibold text-gray-900">Supabase DB</span>
              </div>
              <span className={`flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                conectadoSupabase
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-orange-700 bg-orange-50 border-orange-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${conectadoSupabase ? 'bg-emerald-500' : 'bg-orange-500'}`}></span>
                {conectadoSupabase ? 'Conectado' : 'Simulación'}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-mono">
              Activo: <span className="text-gray-900 font-bold">{monedaActiva}</span> / ARS
            </p>
            <div className="mt-2 flex items-center justify-between text-[10px] text-gray-500 font-mono pt-2 border-t border-gray-200/60">
              <span>{registrosCompletos.length} filas totales</span>
              <span className="text-gray-700 font-medium">{nodos.length} Nodos {monedaActiva}</span>
            </div>
          </div>
          <div className="text-[11px] text-gray-400 px-1 flex items-center justify-between font-mono">
            <span>CondorFi UI v2.1</span>
            <span className="text-gray-600 font-medium">Multi-Asset</span>
          </div>
        </div>
      </aside>

      {/* =========================================================================
          2. CONTENIDO PRINCIPAL
      ========================================================================== */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-gray-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="lg:hidden flex items-center gap-2">
              <img src={condorLogo} alt="Logo" className="w-8 h-8 rounded-lg border border-gray-200" />
              <span className="font-bold text-base text-gray-900">
                CONDOR<span className="text-orange-600">FI</span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900">
                  Rastreo Financiero Multi-Activo
                </h1>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200">
                  {monedaActiva} / ARS
                </span>
              </div>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                {conectadoSupabase
                  ? `Base de datos viva: ${nodos.length} exchanges monitoreando ${monedaActiva}`
                  : 'Modo simulación activo. Conecta tus variables en .env.local'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* SELECTOR DE MONEDA ACTIVA (Tabs Crisp Light) */}
            <div className="flex items-center p-1 rounded-xl bg-gray-100 border border-gray-200 shadow-2xs">
              <span className="text-gray-400 pl-2 pr-1.5">
                <Coins className="w-3.5 h-3.5" />
              </span>
              {MONEDAS_DISPONIBLES.map(moneda => {
                const seleccionada = monedaActiva === moneda;
                return (
                  <button
                    key={moneda}
                    onClick={() => setMonedaActiva(moneda)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition duration-150 ${
                      seleccionada
                        ? 'bg-white text-gray-900 shadow-xs border border-gray-200'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {moneda}
                  </button>
                );
              })}
            </div>

            {/* BOTÓN TOGGLE DE ALERTAS SONORAS Y PUSH NOTIFICATIONS */}
            <button
              onClick={toggleAlertas}
              title={alertasHabilitadas ? 'Silenciar alertas sonoras y push' : 'Activar alertas sonoras y notificaciones push'}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition active:scale-95 shadow-2xs ${
                alertasHabilitadas
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200'
              }`}
            >
              {alertasHabilitadas ? (
                <>
                  <Bell className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Alertas Activas</span>
                  <span className="sm:hidden">Activas</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                </>
              ) : (
                <>
                  <BellOff className="w-3.5 h-3.5 text-gray-400" />
                  <span className="hidden sm:inline">Alertas Muteadas</span>
                  <span className="sm:hidden">Mute</span>
                </>
              )}
            </button>

            <button
              onClick={fetchCotizacionesReales}
              disabled={estaActualizando}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white shadow-xs transition active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${estaActualizando ? 'animate-spin' : ''}`} />
              <span>{estaActualizando ? 'Mapeando...' : 'Escanear'}</span>
            </button>
            <div className="hidden md:flex items-center gap-1.5 text-xs font-mono px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 shadow-2xs">
              <Radio className="w-3.5 h-3.5 text-orange-600" />
              <span>{ultimaSincronizacion}</span>
            </div>
          </div>
        </header>

        {cargando && (
          <div className="mx-6 md:mx-8 mt-4 p-3 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center gap-2.5 text-xs font-mono text-cyan-800">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-600" />
            <span>Consultando cotizaciones de {monedaActiva} desde Supabase...</span>
          </div>
        )}

        <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* =========================================================================
              SELECTOR PRINCIPAL DE MERCADOS: ARBITRAJE CRIPTO VS MERCADOS TRADICIONALES
          ========================================================================== */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-2xs">
            <div className="flex items-center p-1 rounded-xl bg-gray-100 border border-gray-200 shadow-inner w-fit">
              <button
                onClick={() => setTabActivo('cripto')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold font-mono transition duration-150 cursor-pointer ${
                  tabActivo === 'cripto'
                    ? 'bg-white text-gray-900 shadow-xs border border-gray-200/80'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Coins className={`w-4 h-4 ${tabActivo === 'cripto' ? 'text-orange-600' : 'text-gray-400'}`} />
                <span>Arbitraje Cripto</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 font-bold">10 Exchanges</span>
              </button>
              <button
                onClick={() => setTabActivo('tradfi')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold font-mono transition duration-150 cursor-pointer ${
                  tabActivo === 'tradfi'
                    ? 'bg-white text-gray-900 shadow-xs border border-gray-200/80'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <Building2 className={`w-4 h-4 ${tabActivo === 'tradfi' ? 'text-cyan-600' : 'text-gray-400'}`} />
                <span>Mercados Tradicionales</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800 font-bold">TradFi</span>
              </button>
            </div>

            <div className="text-xs font-mono text-gray-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>
                {tabActivo === 'cripto'
                  ? 'Feed en Vivo: Cotizaciones ARS / Cripto'
                  : 'Feed Yahoo Finance: SPY, QQQ, AAPL, ^MERV'}
              </span>
            </div>
          </div>

          {/* VISTA CONDICIONAL SEGÚN PESTAÑA ACTIVA */}
          {tabActivo === 'cripto' ? (
            <>
              {/* =====================================================================
                  A. CARDS DE MÉTRICAS (Filtradas por Moneda Activa)
              ====================================================================== */}
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Precio Promedio */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-gray-300 transition">
              <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-2.5">
                <span>Precio Promedio {monedaActiva}</span>
                <TrendingUp className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-gray-900 tracking-tight">
                  {monedaActiva === 'BTC' || monedaActiva === 'ETH'
                    ? `$${Math.round(promedioCompra).toLocaleString('es-AR')}`
                    : `$${promedioCompra.toFixed(2)}`}
                </span>
                <span className="text-xs font-mono text-emerald-600 font-semibold flex items-center">
                  <ArrowUpRight className="w-3.5 h-3.5" /> +0.82%
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-2 font-mono truncate">
                Compra mín: <span className="text-gray-900 font-semibold">${mejorCompra.toLocaleString('es-AR')}</span> ({analisisArbitraje?.nodoCompra.nombre})
              </p>
            </div>

            {/* Card 2: Arbitraje Real para el Activo (Spread Neto con Semáforo de Riesgo) */}
            <div className={`bg-white p-5 rounded-xl border transition shadow-xs ${
              analisisArbitraje?.hayArbitrajePositivo
                ? analisisArbitraje.esSlippageAlto
                  ? 'border-amber-300 bg-amber-50/20'
                  : 'border-emerald-300 bg-emerald-50/20'
                : 'border-gray-200 hover:border-gray-300'
            }`}>
              <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-2.5">
                <span className="flex items-center gap-1.5">
                  <span>Spread Neto ({monedaActiva})</span>
                </span>
                <Percent className={`w-4 h-4 ${
                  analisisArbitraje?.hayArbitrajePositivo
                    ? analisisArbitraje.esSlippageAlto ? 'text-amber-600' : 'text-emerald-600'
                    : 'text-gray-400'
                }`} />
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold font-mono tracking-tight ${
                  analisisArbitraje?.hayArbitrajePositivo
                    ? analisisArbitraje.esSlippageAlto ? 'text-amber-700' : 'text-emerald-700'
                    : 'text-gray-900'
                }`}>
                  {analisisArbitraje?.hayArbitrajePositivo ? `+${analisisArbitraje.spreadNetoPorcentaje}%` : '0.00%'}
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-medium border ${
                  analisisArbitraje?.hayArbitrajePositivo
                    ? analisisArbitraje.esSlippageAlto
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-gray-100 text-gray-600 border-gray-200'
                }`}>
                  {analisisArbitraje?.hayArbitrajePositivo
                    ? analisisArbitraje.esSlippageAlto ? '⚠️ Slippage Alto' : '✅ Op. Segura'
                    : 'Sin Spread'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500 mt-2 font-mono">
                <span>
                  {analisisArbitraje?.hayArbitrajePositivo
                    ? `Neto: +$${analisisArbitraje.spreadNetoPesos.toLocaleString('es-AR')} ARS`
                    : `Brecha: $${analisisArbitraje?.spreadNetoPesos.toLocaleString('es-AR')} ARS`}
                </span>
                <span className="text-[10px] text-gray-400 font-sans" title="0.5% compra + 0.5% venta">
                  -1.0% com.
                </span>
              </div>
            </div>

            {/* Card 3: Nodos en Vuelo */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-gray-300 transition">
              <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-2.5">
                <span>Nodos {monedaActiva} en Vuelo</span>
                <Cpu className="w-4 h-4 text-cyan-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-gray-900 tracking-tight">
                  {nodos.length} Activos
                </span>
                <span className="text-xs font-mono text-emerald-600 font-semibold">
                  {nodos.length} Plataformas
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mt-2 font-mono truncate">
                Venta máx: <span className="text-gray-900 font-semibold">${mejorVenta.toLocaleString('es-AR')}</span> ({analisisArbitraje?.nodoVenta.nombre})
              </p>
            </div>

            {/* Card 4: Volumen Capturado */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-gray-300 transition">
              <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-2.5">
                <span>Registros Capturados</span>
                <DollarSign className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-gray-900 tracking-tight">
                  {registrosMoneda.length}
                </span>
                <span className="text-xs font-mono text-gray-500">Filas de {monedaActiva}</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-2 font-mono">
                Portafolio: <span className="text-gray-800 font-medium">4 Activos Globales</span>
              </p>
            </div>
          </section>

          {/* =====================================================================
              B. TELEMETRÍA DEL ENJAMBRE (Nodos Vivos de la Moneda Activa)
          ====================================================================== */}
          <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <span>Telemetría de Red: Cotizaciones de {monedaActiva}</span>
                  <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                    {nodos.length} Nodos
                  </span>
                </h2>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  Precios de compra (Ask) y venta (Bid) en tiempo real para par {monedaActiva}/ARS
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="px-2.5 py-1 rounded-md bg-gray-50 text-gray-700 border border-gray-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Filtro: {monedaActiva}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {nodos.map((bot) => {
                const esMejorCompra = bot.id === analisisArbitraje?.nodoCompra.id;
                const esMejorVenta = bot.id === analisisArbitraje?.nodoVenta.id;

                return (
                  <div
                    key={bot.id}
                    className={`p-3.5 rounded-xl border transition-all duration-150 ${
                      esMejorCompra
                        ? 'bg-cyan-50/40 border-cyan-300 shadow-xs'
                        : esMejorVenta
                        ? 'bg-orange-50/40 border-orange-300 shadow-xs'
                        : 'bg-gray-50/70 border-gray-200 hover:border-gray-300 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2 text-[10px] font-mono text-gray-500">
                      <span className="text-gray-600 flex items-center gap-1">
                        <Radio className="w-2.5 h-2.5 text-cyan-600" /> {bot.altitud}
                      </span>
                      <span>{bot.latencia}ms</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-xs text-gray-900 truncate max-w-[120px]">
                        {bot.nombre}
                      </h3>
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    </div>

                    <p className="text-[10px] text-gray-500 font-mono mt-0.5 truncate">{bot.rol}</p>

                    <div className="mt-3 pt-2.5 border-t border-gray-200/80 space-y-1 font-mono text-[11px]">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 text-[10px] flex items-center gap-1">
                          Ask:
                          {esMejorCompra && (
                            <span className="text-[8px] bg-cyan-100 text-cyan-800 px-1 rounded font-bold">MÍN</span>
                          )}
                        </span>
                        <span className="font-semibold text-orange-600 truncate max-w-[110px]">
                          ${bot.compra >= 1000000 ? (bot.compra / 1000000).toFixed(2) + 'M' : bot.compra.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 text-[10px] flex items-center gap-1">
                          Bid:
                          {esMejorVenta && (
                            <span className="text-[8px] bg-orange-100 text-orange-800 px-1 rounded font-bold">MÁX</span>
                          )}
                        </span>
                        <span className="font-semibold text-cyan-700 truncate max-w-[110px]">
                          ${bot.venta >= 1000000 ? (bot.venta / 1000000).toFixed(2) + 'M' : bot.venta.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className="h-full bg-gray-400 rounded-full"
                          style={{ width: `${bot.bateria}%` }}
                        ></div>
                      </div>
                      <span className="text-[9px] font-mono text-gray-500">{bot.bateria}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* =====================================================================
              C. GRÁFICO RECHARTS PROFESIONAL (LINECHART BTC & USDT ÚLTIMAS HORAS)
          ====================================================================== */}
          <section className="bg-white p-5 sm:p-6 rounded-xl border border-gray-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                    <span>Evolución Financiera: BTC & USDT / ARS</span>
                  </h2>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                    Historial Supabase
                  </span>
                </div>
                <p className="text-xs text-gray-500 font-mono mt-1">
                  Variación de precios de Bitcoin y Tether en las últimas horas (Doble escala ARS)
                </p>
              </div>

              {/* Badges con últimas cotizaciones registradas */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-900">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span className="font-semibold">BTC:</span>
                  <span>${datosGraficoBTCyUSDT[datosGraficoBTCyUSDT.length - 1]?.BTC.toLocaleString('es-AR')} ARS</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-50 border border-sky-200 text-sky-900">
                  <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                  <span className="font-semibold">USDT:</span>
                  <span>${datosGraficoBTCyUSDT[datosGraficoBTCyUSDT.length - 1]?.USDT.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS</span>
                </div>
              </div>
            </div>

            {/* Gráfico de Líneas (LineChart) con Dual Axis para BTC y USDT */}
            <div className="h-72 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={datosGraficoBTCyUSDT} margin={{ top: 15, right: 15, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="hora"
                    stroke="#94a3b8"
                    fontSize={11}
                    fontFamily="JetBrains Mono"
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  {/* Eje izquierdo: BTC (millones de ARS) */}
                  <YAxis
                    yAxisId="btc"
                    orientation="left"
                    stroke="#d97706"
                    fontSize={11}
                    fontFamily="JetBrains Mono"
                    tickLine={false}
                    axisLine={{ stroke: '#fde68a' }}
                    domain={['dataMin - (dataMin * 0.005)', 'dataMax + (dataMax * 0.005)']}
                    tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`}
                  />
                  {/* Eje derecho: USDT (ARS) */}
                  <YAxis
                    yAxisId="usdt"
                    orientation="right"
                    stroke="#0284c7"
                    fontSize={11}
                    fontFamily="JetBrains Mono"
                    tickLine={false}
                    axisLine={{ stroke: '#bae6fd' }}
                    domain={['dataMin - 5', 'dataMax + 5']}
                    tickFormatter={(val) => `$${Number(val).toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                      fontFamily: 'JetBrains Mono',
                      fontSize: '12px',
                      color: '#f8fafc'
                    }}
                    formatter={(value, name) => [
                      `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: name.includes('USDT') ? 2 : 0, maximumFractionDigits: 2 })} ARS`,
                      name
                    ]}
                    labelStyle={{ color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    wrapperStyle={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }}
                  />
                  <Line
                    yAxisId="btc"
                    type="monotone"
                    dataKey="BTC"
                    name="Bitcoin (BTC / ARS - Eje Izq)"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 1.5 }}
                    activeDot={{ r: 6, fill: '#d97706', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                  <Line
                    yAxisId="usdt"
                    type="monotone"
                    dataKey="USDT"
                    name="Tether (USDT / ARS - Eje Der)"
                    stroke="#0284c7"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#0284c7', stroke: '#ffffff', strokeWidth: 1.5 }}
                    activeDot={{ r: 6, fill: '#0369a1', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* =====================================================================
              TABLA DINÁMICA: OPORTUNIDADES DE ARBITRAJE ACTUALES (EN TIEMPO REAL)
          ====================================================================== */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden mt-6">
            <div className="p-5 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-gray-900">
                      Oportunidades de Arbitraje Actuales
                    </h2>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-100/80 text-emerald-800 border border-emerald-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Tiempo Real
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    Detección algorítmica de mejores puntos de compra y venta inter-exchange
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-green-500 font-bold">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Alerta Spread &gt; 1%
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80 text-gray-600 uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4 font-semibold">Par / Activo</th>
                    <th className="py-3.5 px-4 font-semibold">Exchange Compra (Ask)</th>
                    <th className="py-3.5 px-4 font-semibold">Exchange Venta (Bid)</th>
                    <th className="py-3.5 px-4 text-right font-semibold">Diferencia ARS</th>
                    <th className="py-3.5 px-4 text-right font-semibold">Spread (%)</th>
                    <th className="py-3.5 px-4 text-center font-semibold">Diagnóstico</th>
                    <th className="py-3.5 px-4 text-center font-semibold">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {oportunidadesActuales.map((op) => {
                    const esSpreadMayor1 = op.spread > 1;
                    const esPositivo = op.spread > 0;
                    return (
                      <tr
                        key={op.moneda}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          esSpreadMayor1 ? 'bg-green-500/5' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 font-bold text-gray-900">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shadow-2xs ${
                              op.moneda === 'BTC' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                              op.moneda === 'USDT' ? 'bg-teal-100 text-teal-800 border border-teal-200' :
                              op.moneda === 'ETH' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                              'bg-sky-100 text-sky-800 border border-sky-200'
                            }`}>
                              {op.moneda.slice(0, 3)}
                            </span>
                            <div>
                              <div className="text-gray-900 font-bold">{op.moneda} / ARS</div>
                              <div className="text-[10px] text-gray-400 font-normal">{op.fuente}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-gray-800">{op.exchangeCompra}</div>
                          <div className="text-[11px] text-gray-500">
                            ${Number(op.precioCompra).toLocaleString('es-AR', { minimumFractionDigits: op.moneda === 'BTC' || op.moneda === 'ETH' ? 0 : 2, maximumFractionDigits: 2 })} ARS
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-gray-800">{op.exchangeVenta}</div>
                          <div className="text-[11px] text-gray-500">
                            ${Number(op.precioVenta).toLocaleString('es-AR', { minimumFractionDigits: op.moneda === 'BTC' || op.moneda === 'ETH' ? 0 : 2, maximumFractionDigits: 2 })} ARS
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className={`font-semibold ${esSpreadMayor1 ? 'text-green-500 font-bold' : esPositivo ? 'text-gray-900' : 'text-gray-400'}`}>
                            {op.diferenciaPesos > 0 ? `+$${op.diferenciaPesos.toLocaleString('es-AR')} ARS` : `$${op.diferenciaPesos.toLocaleString('es-AR')} ARS`}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className={`text-sm ${esSpreadMayor1 ? 'text-green-500 font-bold' : esPositivo ? 'text-gray-900 font-semibold' : 'text-gray-400 font-medium'}`}>
                              {op.spread > 0 ? `+${op.spread.toFixed(2)}%` : `${op.spread.toFixed(2)}%`}
                            </span>
                            {esSpreadMayor1 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 border border-green-500/30">
                                &gt;1%
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            Neto: {op.spreadNeto > 0 ? `+${op.spreadNeto.toFixed(2)}%` : `${op.spreadNeto.toFixed(2)}%`}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {esSpreadMayor1 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-500/10 text-green-500 border border-green-500/30">
                              <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                              Oportunidad Alta
                            </span>
                          ) : esPositivo ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Margen Moderado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500 border border-gray-200">
                              Sin Arbitraje
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => setMonedaActiva(op.moneda)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 mx-auto ${
                              monedaActiva === op.moneda
                                ? 'bg-gray-900 text-white shadow-2xs'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            <span>{monedaActiva === op.moneda ? 'Activo' : 'Ver Detalle'}</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* =====================================================================
              D. PANEL DE ARBITRAJE FILTRADO POR MONEDA ACTIVA (SPREAD NETO)
          ====================================================================== */}
          <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-orange-50 border border-orange-200 text-orange-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-gray-900">
                      Oportunidades de Arbitraje en {monedaActiva}
                    </h2>
                    {/* Badge de transparencia requerido */}
                    <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1 shadow-2xs">
                      <Percent className="w-3 h-3 text-slate-500" />
                      {COMISIONES_CONFIG.etiquetaBadge}
                    </span>
                    {/* Badge interactivo de radar sonoro */}
                    <button
                      onClick={toggleAlertas}
                      className={`text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full border flex items-center gap-1 transition shadow-2xs cursor-pointer ${
                        alertasHabilitadas
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-slate-100 text-slate-500 border-slate-200 hover:text-slate-800'
                      }`}
                      title={alertasHabilitadas ? 'Radar sonoro activo. Clic para mutear.' : 'Alertas silenciadas. Clic para activar.'}
                    >
                      {alertasHabilitadas ? (
                        <>
                          <Bell className="w-3 h-3 text-emerald-600" />
                          <span>Radar Sonoro Activo</span>
                        </>
                      ) : (
                        <>
                          <BellOff className="w-3 h-3 text-slate-400" />
                          <span>Alertas Muteadas</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    Evaluando spreads netos reales (compra +0.5% y venta -0.5%) para {monedaActiva}/ARS
                  </p>
                </div>
              </div>

              {analisisArbitraje?.hayArbitrajePositivo ? (
                <span className={`text-xs font-mono px-3 py-1 rounded-full border flex items-center gap-1.5 font-bold ${
                  analisisArbitraje.esSlippageAlto
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  <span>{analisisArbitraje.riesgoSlippageIcono}</span>
                  {analisisArbitraje.riesgoSlippageTexto} (+{analisisArbitraje.spreadNetoPorcentaje}%)
                </span>
              ) : (
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200 flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-gray-500" />
                  Monitoreando {monedaActiva}
                </span>
              )}
            </div>

            {analisisArbitraje?.hayArbitrajePositivo ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-5 rounded-xl border ${
                  analisisArbitraje.esSlippageAlto
                    ? 'bg-amber-50/40 border-amber-300'
                    : 'bg-emerald-50/40 border-emerald-200'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-mono font-bold flex items-center gap-1.5 ${
                      analisisArbitraje.esSlippageAlto ? 'text-amber-900' : 'text-emerald-800'
                    }`}>
                      <Zap className={`w-4 h-4 ${analisisArbitraje.esSlippageAlto ? 'text-amber-600' : 'text-emerald-600'}`} />
                      Spread Neto Positivo ({monedaActiva})
                    </span>
                    <span className={`text-xs font-mono font-extrabold px-2 py-0.5 rounded border ${
                      analisisArbitraje.esSlippageAlto
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}>
                      +{analisisArbitraje.spreadNetoPorcentaje}% Spread Neto
                    </span>
                  </div>
                  
                  <div className="my-3 p-3 rounded-lg bg-white border border-gray-200 text-xs font-mono flex items-center justify-between shadow-2xs">
                    <div>
                      <p className="text-gray-500 text-[10px]">1. Comprar en (Ask + 0.5%):</p>
                      <p className="text-orange-600 font-bold text-sm">{analisisArbitraje.nodoCompra.nombre}</p>
                      <p className="text-gray-700 text-xs">Base: ${analisisArbitraje.ask.toLocaleString('es-AR')}</p>
                      <p className="text-orange-700 font-semibold text-[11px]">
                        Costo Real: ${analisisArbitraje.costoRealCompra.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 shrink-0 mx-2" />
                    <div className="text-right">
                      <p className="text-gray-500 text-[10px]">2. Vender en (Bid - 0.5%):</p>
                      <p className="text-cyan-700 font-bold text-sm">{analisisArbitraje.nodoVenta.nombre}</p>
                      <p className="text-gray-700 text-xs">Base: ${analisisArbitraje.bid.toLocaleString('es-AR')}</p>
                      <p className="text-cyan-700 font-semibold text-[11px]">
                        Ingreso Neto: ${analisisArbitraje.ingresoNetoVenta.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* CAMPO DESTACADO: VOLUMEN MÁXIMO SUGERIDO & SEMÁFORO DE SLIPPAGE */}
                  <div className={`my-3 p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
                    analisisArbitraje.esSlippageAlto
                      ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                      : 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg border shrink-0 ${
                        analisisArbitraje.esSlippageAlto
                          ? 'bg-amber-100 border-amber-300 text-amber-700'
                          : 'bg-emerald-100 border-emerald-300 text-emerald-700'
                      }`}>
                        {analisisArbitraje.esSlippageAlto ? (
                          <AlertTriangle className="w-4 h-4 text-amber-700" />
                        ) : (
                          <ShieldCheck className="w-4 h-4 text-emerald-700" />
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 font-semibold block">
                          Gestión de Riesgo & Profundidad
                        </span>
                        <div className="text-xs font-mono font-bold text-gray-900 mt-0.5">
                          <span>Volumen Máximo Sugerido: </span>
                          <span className={`font-extrabold text-xs sm:text-sm underline decoration-2 underline-offset-2 ${
                            analisisArbitraje.esSlippageAlto
                              ? 'text-amber-900 decoration-amber-400'
                              : 'text-emerald-900 decoration-emerald-400'
                          }`}>
                            ~{analisisArbitraje.volumenSugerido.texto}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Cartel / Semáforo de Riesgo */}
                    <div className="shrink-0">
                      {analisisArbitraje.esSlippageAlto ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                          <span>⚠️</span> Riesgo de Slippage Alto
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                          <span>✅</span> Operación Segura
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 mt-2 text-xs font-mono">
                    <p className="text-gray-800">
                      Ganancia Neta Real: <strong className={`font-bold text-sm ${
                        analisisArbitraje.esSlippageAlto ? 'text-amber-800' : 'text-emerald-700'
                      }`}>+${analisisArbitraje.spreadNetoPesos.toLocaleString('es-AR')} ARS</strong> (+{analisisArbitraje.spreadNetoPorcentaje}%) por cada {monedaActiva}.
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Fricción descontada: ~${analisisArbitraje.comisionesTotalesPesos.toLocaleString('es-AR')} ARS (~1.0% total). Spread bruto previo: +{analisisArbitraje.spreadBrutoPorcentaje}%.
                    </p>
                  </div>

                  <div className={`mt-3 flex items-center justify-between text-[11px] font-mono text-gray-500 pt-2 border-t ${
                    analisisArbitraje.esSlippageAlto ? 'border-amber-200' : 'border-emerald-200'
                  }`}>
                    <span>Tope prudencial: ~500 USD</span>
                    <span className={`font-semibold cursor-pointer hover:underline ${
                      analisisArbitraje.esSlippageAlto ? 'text-amber-800' : 'text-emerald-700'
                    }`}>
                      Ejecutar Ruta →
                    </span>
                  </div>
                </div>

                <div className={`p-5 rounded-xl border ${
                  analisisArbitraje.esSlippageAlto ? 'bg-amber-50/20 border-amber-200' : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono font-bold text-cyan-800 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-cyan-600" /> Diagnóstico Predictivo RAG
                    </span>
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                      analisisArbitraje.esSlippageAlto
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}>
                      {analisisArbitraje.esSlippageAlto ? 'Riesgo Alto (Slippage)' : 'Score IA: 96%'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {analisisArbitraje.esSlippageAlto ? (
                      <>
                        <strong className="text-amber-900">Advertencia de Slippage:</strong> El spread neto (+{analisisArbitraje.spreadNetoPorcentaje}%) es estrecho (&le; 0.2%). La falta de profundidad en el libro de órdenes podría absorber el margen de beneficio ante transacciones mayores a <strong className="text-gray-900">~{analisisArbitraje.volumenSugerido.texto}</strong>.
                      </>
                    ) : (
                      <>
                        Oportunidad de spread neto en <strong className="text-gray-900">{monedaActiva}</strong>. La IA identificó compra en <strong className="text-gray-900">{analisisArbitraje.nodoCompra.nombre}</strong> y venta en <strong className="text-gray-900">{analisisArbitraje.nodoVenta.nombre}</strong> con amplio margen de seguridad (&gt; 0.2%), permitiendo operar hasta <strong className="text-gray-900">~{analisisArbitraje.volumenSugerido.texto}</strong>.
                      </>
                    )}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-[11px] font-mono text-gray-500 pt-3 border-t border-gray-200">
                    <span>Modelo: Vector similarity pgvector</span>
                    <span className="text-orange-600 font-semibold cursor-pointer hover:underline">
                      Ver Desglose →
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-gray-50 border border-gray-200 text-center space-y-2.5">
                <div className="inline-flex p-2.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-600">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">
                  Monitoreando spread - Sin oportunidades rentables actuales en {monedaActiva}
                </h3>
                <p className="text-xs text-gray-500 max-w-xl mx-auto font-mono">
                  {analisisArbitraje?.diferenciaBrutaPesos > 0 ? (
                    <>
                      Existe una diferencia bruta aparente de <strong className="text-gray-700">+${analisisArbitraje.diferenciaBrutaPesos.toLocaleString('es-AR')} ARS (+{analisisArbitraje.spreadBrutoPorcentaje}%)</strong>, pero es absorbida por las comisiones operativas estimadas (~1.0% total: ~${analisisArbitraje.comisionesTotalesPesos.toLocaleString('es-AR')} ARS), resultando en un spread neto negativo de <strong className="text-orange-700">${analisisArbitraje.spreadNetoPesos.toLocaleString('es-AR')} ARS</strong>.
                    </>
                  ) : (
                    <>
                      En este momento el ingreso neto de venta más alto de {monedaActiva} (<strong>{analisisArbitraje?.nodoVenta.nombre}</strong> a ${analisisArbitraje?.ingresoNetoVenta ? Math.round(analisisArbitraje.ingresoNetoVenta).toLocaleString('es-AR') : '0'}) no supera el costo real de compra más bajo (<strong>{analisisArbitraje?.nodoCompra.nombre}</strong> a ${analisisArbitraje?.costoRealCompra ? Math.round(analisisArbitraje.costoRealCompra).toLocaleString('es-AR') : '0'}).
                    </>
                  )}
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white border border-gray-200 text-xs font-mono text-gray-700 shadow-2xs">
                  <span>Brecha neta requerida para rentabilidad:</span>
                  <span className="text-orange-600 font-bold">
                    ${Math.abs(analisisArbitraje?.spreadNetoPesos ?? 0).toLocaleString('es-AR')} ARS
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* =====================================================================
              E. HISTORIAL DE INSERCIONES FILTRADO POR MONEDA ACTIVA
          ====================================================================== */}
          <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-700">
                  <Table className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <span>Historial de Inserciones ({monedaActiva})</span>
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                      Últimos {Math.min(10, registrosMoneda.length)} registros
                    </span>
                  </h2>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    Transmisión directa de <span className="text-gray-800 font-medium">cotizaciones_historicas</span> filtrada para {monedaActiva}
                  </p>
                </div>
              </div>

              <div className="text-[11px] font-mono text-gray-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Filtro activo: {monedaActiva}</span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80 text-gray-500 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">Timestamp</th>
                    <th className="py-3 px-4 font-semibold">Exchange</th>
                    <th className="py-3 px-4 font-semibold">Moneda</th>
                    <th className="py-3 px-4 text-right font-semibold">Compra (Ask)</th>
                    <th className="py-3 px-4 text-right font-semibold">Venta (Bid)</th>
                    <th className="py-3 px-4 text-center font-semibold">Spread Local</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800 bg-white">
                  {registrosMoneda.length > 0 ? (
                    registrosMoneda.slice(0, 10).map((item, index) => {
                      const ask = Number(item.precio_compra) || 0;
                      const bid = Number(item.precio_venta) || 0;
                      const spreadLocal = (((ask - bid) / ask) * 100).toFixed(2);
                      const fechaFormateada = item.timestamp
                        ? new Date(item.timestamp).toLocaleString('es-AR', {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                            timeZone: 'America/Argentina/Buenos_Aires'
                          })
                        : 'Reciente';

                      return (
                        <tr
                          key={item.id || index}
                          className="hover:bg-gray-50 transition-colors duration-100"
                        >
                          <td className="py-3 px-4 text-gray-500 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            <span>{fechaFormateada}</span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-900">
                            {item.exchange}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-700 font-bold text-[10px] border border-orange-200">
                              {item.moneda || monedaActiva}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-orange-600">
                            ${ask.toLocaleString('es-AR')}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-cyan-700">
                            ${bid.toLocaleString('es-AR')}
                          </td>
                          <td className="py-3 px-4 text-center text-gray-500 text-[11px]">
                            {spreadLocal}%
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <AlertCircle className="w-5 h-5 text-gray-400" />
                          <p className="text-xs font-semibold text-gray-700">
                            No hay registros de {monedaActiva} en la base de datos todavía
                          </p>
                          <p className="text-[11px] text-gray-400">
                            Ejecuta <code className="text-orange-600 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">node bot_cripto.js</code> para recolectar el lote multi-activo
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        /* =========================================================================
           VISTA: MERCADOS TRADICIONALES (TradFi)
           - Tarjetas de Resumen (SPY, QQQ, AAPL, ^MERV)
           - Gráfico Dual Y-Axis Recharts (USD vs Millones ARS)
           - Tabla de Cotizaciones e Índices
        ========================================================================== */
        <div className="space-y-6">
          {/* 1. TARJETAS DE RESUMEN TRADFI */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ultimosTradfi.map(item => {
              const esPositivo = item.variacion >= 0;
              const esMerval = item.ticker === '^MERV';
              const precioFmt = esMerval
                ? `$${Math.round(item.precioActual).toLocaleString('es-AR')} ARS`
                : `$${item.precioActual.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
              const openFmt = esMerval
                ? `$${Math.round(item.precioApertura).toLocaleString('es-AR')}`
                : `$${item.precioApertura.toFixed(2)}`;

              return (
                <div
                  key={item.ticker}
                  className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs hover:border-gray-300 transition"
                >
                  <div className="flex items-center justify-between text-gray-500 text-xs font-medium mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-gray-900 text-sm px-2 py-0.5 rounded bg-gray-100 border border-gray-200">
                        {item.ticker}
                      </span>
                      <span className="text-[11px] text-gray-400 font-mono">{item.mercado}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 font-bold">
                      {item.moneda}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 font-medium truncate mb-2">{item.nombre}</p>

                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-bold font-mono text-gray-900 tracking-tight">
                      {precioFmt}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold flex items-center px-1.5 py-0.5 rounded ${
                        esPositivo
                          ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                          : 'text-rose-700 bg-rose-50 border border-rose-200'
                      }`}
                    >
                      <ArrowUpRight className={`w-3.5 h-3.5 ${!esPositivo ? 'rotate-90' : ''}`} />
                      {esPositivo ? `+${item.variacion}%` : `${item.variacion}%`}
                    </span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px] font-mono text-gray-500">
                    <span>Apertura: {openFmt}</span>
                    <span className="text-gray-400">Yahoo Finance</span>
                  </div>
                </div>
              );
            })}
          </section>

          {/* 2. GRÁFICO TRADFI CON DOBLE EJE Y (USD IZQUIERDA / ARS DERECHA) */}
          <section className="bg-white p-5 md:p-6 rounded-xl border border-gray-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-cyan-600" />
                  <h2 className="text-sm font-bold text-gray-900">
                    Evolución Multiactivo TradFi: Índices & Acciones
                  </h2>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">
                    Doble Eje Y
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 font-mono">
                  Eje Izquierdo: SPY, QQQ y AAPL en USD • Eje Derecho: S&P Merval en Millones de ARS
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-50 text-sky-800 border border-sky-200 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-sky-500"></span> SPY ($USD)
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span> QQQ ($USD)
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> AAPL ($USD)
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-50 text-orange-800 border border-orange-200 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span> MERVAL ($M ARS)
                </span>
              </div>
            </div>

            <div className="h-80 sm:h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={datosGraficoTradfi} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="hora"
                    stroke="#94a3b8"
                    tick={{ fontSize: 11, fontFamily: 'monospace' }}
                    tickLine={false}
                  />
                  {/* EJE Y IZQUIERDO: USD (SPY, QQQ, AAPL) */}
                  <YAxis
                    yAxisId="usd"
                    orientation="left"
                    stroke="#0284c7"
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 11, fontFamily: 'monospace' }}
                    tickFormatter={val => `$${val}`}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  {/* EJE Y DERECHO: ARS (MERVAL EN MILLONES) */}
                  <YAxis
                    yAxisId="ars"
                    orientation="right"
                    stroke="#ea580c"
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 11, fontFamily: 'monospace' }}
                    tickFormatter={val => `$${(val / 1000000).toFixed(2)}M`}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '0.75rem',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                      fontFamily: 'monospace'
                    }}
                    formatter={(valor, nombre) => {
                      if (nombre && String(nombre).includes('MERV')) {
                        return [`$${Math.round(valor).toLocaleString('es-AR')} ARS`, nombre];
                      }
                      return [`$${Number(valor).toFixed(2)} USD`, nombre];
                    }}
                  />
                  <Line
                    yAxisId="usd"
                    type="monotone"
                    dataKey="SPY"
                    name="SPY (S&P 500 ETF)"
                    stroke="#0284c7"
                    strokeWidth={2.2}
                    dot={{ r: 3, fill: '#0284c7' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    yAxisId="usd"
                    type="monotone"
                    dataKey="QQQ"
                    name="QQQ (Nasdaq 100)"
                    stroke="#6366f1"
                    strokeWidth={2.2}
                    dot={{ r: 3, fill: '#6366f1' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    yAxisId="usd"
                    type="monotone"
                    dataKey="AAPL"
                    name="AAPL (Apple Inc.)"
                    stroke="#10b981"
                    strokeWidth={2.2}
                    dot={{ r: 3, fill: '#10b981' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    yAxisId="ars"
                    type="monotone"
                    dataKey="MERV"
                    name="^MERV (S&P Merval)"
                    stroke="#ea580c"
                    strokeWidth={2.5}
                    strokeDasharray="4 2"
                    dot={{ r: 3, fill: '#ea580c' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* 3. TABLA DE DETALLES DE MERCADOS TRADICIONALES */}
          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
            <div className="p-4 sm:p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-600" />
                  <h3 className="text-sm font-bold text-gray-900">
                    Panel de Renta Variable e Índices Clave
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">
                  Datos capturados por el microservicio scrapper-tradfi sincronizados con Supabase
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-gray-500">
                  {registrosTradfi.length} capturas en base de datos
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="bg-gray-50/75 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Ticker</th>
                    <th className="py-3 px-4">Activo / Índice</th>
                    <th className="py-3 px-4">Mercado</th>
                    <th className="py-3 px-4 text-right">Precio Apertura</th>
                    <th className="py-3 px-4 text-right">Precio Actual</th>
                    <th className="py-3 px-4 text-center">Variación Hoy</th>
                    <th className="py-3 px-4 text-center">Moneda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ultimosTradfi.map(item => {
                    const esPositivo = item.variacion >= 0;
                    const esMerval = item.ticker === '^MERV';
                    return (
                      <tr key={item.ticker} className="hover:bg-gray-50/80 transition">
                        <td className="py-3.5 px-4 font-bold text-gray-900">
                          <span className="px-2 py-0.5 rounded bg-gray-100 border border-gray-200 font-bold">
                            {item.ticker}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-gray-800">
                          {item.nombre}
                        </td>
                        <td className="py-3.5 px-4 text-gray-500 font-mono text-[11px]">
                          {item.mercado}
                        </td>
                        <td className="py-3.5 px-4 text-right text-gray-500">
                          {esMerval
                            ? `$${Math.round(item.precioApertura).toLocaleString('es-AR')}`
                            : `$${item.precioApertura.toFixed(2)}`}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-gray-900">
                          {esMerval
                            ? `$${Math.round(item.precioActual).toLocaleString('es-AR')}`
                            : `$${item.precioActual.toFixed(2)}`}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                              esPositivo
                                ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                                : 'text-rose-700 bg-rose-50 border border-rose-200'
                            }`}
                          >
                            <ArrowUpRight className={`w-3 h-3 ${!esPositivo ? 'rotate-90' : ''}`} />
                            {esPositivo ? `+${item.variacion}%` : `${item.variacion}%`}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200 font-bold text-[10px]">
                            {item.moneda}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
          RADAR DE INSIGHTS QUANTS (Feed de Alertas Financieras)
      ========================================================================== */}
      <section id="radar-insights-quants" className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
        {/* Cabecera del Panel */}
        <div className="p-4 sm:p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-gray-50/80 via-white to-gray-50/50">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-600" />
              <h3 className="text-sm font-bold text-gray-900 tracking-tight">
                Radar de Insights Quants
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                SMA + 1.5σ Engine
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">
              Detección algorítmica de anomalías estadísticas y oportunidades de arbitraje en tiempo real
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* BOTÓN EXPORTAR DATOS CSV (Estilo secundario / fantasma) */}
            <button
              onClick={descargarHistorialCSV}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border border-gray-300 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
              title="Descargar historial de cotizaciones en formato CSV"
            >
              {isExporting ? (
                <RefreshCw className="w-3.5 h-3.5 text-orange-600 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 text-gray-500" />
              )}
              <span>{isExporting ? 'Exportando...' : 'Exportar Datos (CSV)'}</span>
            </button>

            {/* BOTÓN ESCANEAR ANOMALÍAS */}
            <button
              onClick={ejecutarAnalisisQuant}
              disabled={ejecutandoInsight}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-2xs"
              title="Ejecutar análisis estadístico sobre los últimos 100 registros con el microservicio"
            >
              <Zap className={`w-3.5 h-3.5 text-orange-600 ${ejecutandoInsight ? 'animate-bounce' : ''}`} />
              <span>{ejecutandoInsight ? 'Calculando...' : 'Escanear Anomalías'}</span>
            </button>
            <span className="text-[11px] font-mono text-gray-500 px-2.5 py-1 rounded-md bg-gray-50 border border-gray-200">
              {alertas.length} {alertas.length === 1 ? 'alerta' : 'alertas'}
            </span>
          </div>
        </div>

        {/* Feed de Tarjetas de Notificación o Estado Vacío */}
        <div className="p-5">
          {alertas.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {alertas.map((alerta, index) => {
                const esOportunidadAlta = alerta.tipo_alerta === 'OPORTUNIDAD_ALTA';
                const badgeClass = esOportunidadAlta
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-cyan-50 text-cyan-800 border-cyan-300';
                const monedaPar = `${alerta.moneda || 'USDT'}/ARS`;
                const tiempoRelativo = formatearTiempoRelativo(alerta.timestamp);

                return (
                  <div
                    key={alerta.id || index}
                    className={`p-4 rounded-xl border transition duration-150 shadow-2xs hover:shadow-xs flex flex-col justify-between ${
                      esOportunidadAlta
                        ? 'border-emerald-200 bg-emerald-50/20 hover:border-emerald-300'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div>
                      {/* Cabecera de la tarjeta: Badge + Par + Tiempo */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${badgeClass}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            {alerta.tipo_alerta || 'OPORTUNIDAD_ALTA'}
                          </span>
                          <span className="text-xs font-mono font-bold text-gray-900 px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200">
                            {monedaPar}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {tiempoRelativo}
                        </span>
                      </div>

                      {/* Mensaje descriptivo */}
                      <p className="text-xs text-gray-700 font-medium leading-relaxed mb-3">
                        {alerta.mensaje}
                      </p>
                    </div>

                    {/* Métricas y exchanges al pie de la tarjeta */}
                    <div className="pt-2.5 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                      {(alerta.exchange_compra || alerta.exchange_venta) && (
                        <div className="flex items-center gap-1 text-gray-600 truncate">
                          <span className="font-semibold text-gray-800">{alerta.exchange_compra || 'Compra'}</span>
                          <ArrowRight className="w-3 h-3 text-gray-400" />
                          <span className="font-semibold text-gray-800">{alerta.exchange_venta || 'Venta'}</span>
                        </div>
                      )}
                      {typeof alerta.spread_actual === 'number' && (
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          +{alerta.spread_actual.toFixed(2)}% Spread
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Estado vacío profesional */
            <div className="py-10 px-4 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center mb-3 text-orange-600 shadow-2xs">
                <Activity className="w-6 h-6 animate-pulse" />
              </div>
              <h4 className="text-sm font-bold text-gray-800 mb-1">
                Analizando volatilidad del mercado... Sin anomalías recientes
              </h4>
              <p className="text-xs text-gray-500 font-mono max-w-md">
                El motor estadístico está evaluando cotizaciones históricas (SMA y desviación estándar a 1.5σ). Las oportunidades de arbitraje que superen el umbral se publicarán aquí automáticamente.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={ejecutarAnalisisQuant}
                  disabled={ejecutandoInsight}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white transition active:scale-95 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  <Zap className={`w-3.5 h-3.5 ${ejecutandoInsight ? 'animate-spin' : ''}`} />
                  <span>{ejecutandoInsight ? 'Ejecutando algoritmo...' : 'Ejecutar Análisis Ahora'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  </main>
</div>
);
}
