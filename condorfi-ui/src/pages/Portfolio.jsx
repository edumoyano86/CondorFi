/**
 * ==============================================================================
 * CondorFi - Gestor de Portafolio en Tiempo Real (Portfolio Tracker)
 * Archivo: condorfi-ui/src/pages/Portfolio.jsx
 * 
 * Módulo Institucional de Gestión de Cartera Activa y Mark-to-Market en Vivo:
 * 1. Soporte de Tickers Locales y CEDEARs (.BA):
 *    - Catálogo maestro enriquecido con CEDEARs (ej: VIG.BA, SPY.BA, AAPL.BA, etc.).
 *    - El buscador interactivo (combobox) permite seleccionar o tipear cualquier activo BYMA.
 * 2. Lógica Condicional de FX:
 *    - Activos con sufijo .BA (BYMA): La cotización de la API ya viene en Pesos Argentinos (ARS)
 *      e incluye el tipo de cambio CCL implícito. Se OMITE el multiplicador del Dólar Cripto
 *      y se utiliza el precio directo en pesos.
 *    - En caso de alternar a USD, se divide por la tasa de cambio en vivo para obtener la paridad en divisa dura.
 *    - Activos de Wall Street (USD): Se multiplican por el tipo de cambio en vivo únicamente si la vista está en ARS.
 * 3. Formateo Financiero con Separador de Miles Oficial:
 *    - Cifras en ARS formateadas con notación 'es-AR' (ej. $112.970 ARS).
 *    - Cifras en USD formateadas con notación 'en-US' (ej. $2,145.00 USD).
 * ==============================================================================
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  useCurrency,
  convertirValorFX,
  formatearMonto,
  determinarMonedaNativa
} from '../context/CurrencyContext';
import { useAuth } from '../context/AuthContext';
import {
  ACCIONES_TECH,
  INDICES_GLOBALES,
  ETFS_ESTRATEGICOS,
  TOP_CRIPTO,
  BONOS_TICKERS,
  TRADFI_ARG_BONOS,
  CEDEARS_BYMA,
  NOMBRES_CEDEARS
} from '../lib/catalogoActivos';
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PlusCircle,
  Trash2,
  PieChart as PieChartIcon,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Coins,
  Building2,
  Percent,
  Search,
  CheckCircle2,
  ChevronDown,
  X,
  Radio,
  Zap,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis
} from 'recharts';

/**
 * Catálogo Maestro Unificado de Activos Financieros
 * Combina Criptomonedas, CEDEARs de BYMA, Acciones Tech, ETFs Estratégicos, Índices y Renta Fija
 */
const CATALOGO_UNIFICADO_BASE = (() => {
  const mapa = new Map();

  // 1. CEDEARs de BYMA (Mercado Argentino - Cotizados en Pesos ARS con CCL implícito)
  (CEDEARS_BYMA || []).forEach(ticker => {
    const t = ticker.toUpperCase();
    const baseTicker = t.replace(/\.BA$/, '');
    const desc = NOMBRES_CEDEARS?.[t] || `CEDEAR ${baseTicker} (BYMA)`;
    mapa.set(t, {
      ticker: t,
      nombre: desc,
      categoria: 'CEDEARs',
      tipoMercado: 'tradfi',
      moneda: 'ARS'
    });
  });

  // 2. Criptomonedas
  (TOP_CRIPTO || []).forEach(ticker => {
    const t = ticker.toUpperCase();
    mapa.set(t, {
      ticker: t,
      nombre: `Criptoactivo ${t}`,
      categoria: 'Criptomonedas',
      tipoMercado: 'cripto',
      moneda: 'ARS'
    });
  });

  // 3. Acciones Tech & Mega-Cap NASDAQ / S&P 500 (Wall Street - USD)
  (ACCIONES_TECH || []).forEach(ticker => {
    const t = ticker.toUpperCase();
    if (!mapa.has(t)) {
      mapa.set(t, {
        ticker: t,
        nombre: `${t} Inc. - Wall Street`,
        categoria: 'Acciones',
        tipoMercado: 'tradfi',
        moneda: 'USD'
      });
    }
  });

  // 4. ETFs Estratégicos (Dividendos y Cobertura - Wall Street USD)
  (ETFS_ESTRATEGICOS || []).forEach(ticker => {
    const t = ticker.toUpperCase();
    if (!mapa.has(t)) {
      mapa.set(t, {
        ticker: t,
        nombre: `${t} - Strategic Dividend ETF (EE.UU.)`,
        categoria: 'ETFs',
        tipoMercado: 'tradfi',
        moneda: 'USD'
      });
    }
  });

  // 5. Índices Financieros Globales
  (INDICES_GLOBALES || []).forEach(ticker => {
    const t = ticker.toUpperCase();
    if (!mapa.has(t)) {
      mapa.set(t, {
        ticker: t,
        nombre: t.startsWith('^') ? `Índice ${t}` : `${t} - Global Benchmark ETF`,
        categoria: 'Índices',
        tipoMercado: 'indices',
        moneda: (t === '^MERV' || t.endsWith('.BA')) ? 'ARS' : 'USD'
      });
    }
  });

  // 6. Renta Fija & Bonos Soberanos / Treasuries
  (BONOS_TICKERS || []).forEach(ticker => {
    const t = ticker.toUpperCase();
    if (!mapa.has(t)) {
      mapa.set(t, {
        ticker: t,
        nombre: t.includes('30') || t.includes('29') || t.includes('35') || t.includes('38')
          ? `Bono Soberano ${t}`
          : `Treasury / Bond ETF ${t}`,
        categoria: 'Bonos',
        tipoMercado: 'bonos',
        moneda: t.endsWith('.BA') ? 'ARS' : 'USD'
      });
    }
  });

  // 7. Acciones Líderes BYMA (Mercado Argentino)
  (TRADFI_ARG_BONOS || []).forEach(ticker => {
    const t = ticker.toUpperCase();
    if (!mapa.has(t)) {
      mapa.set(t, {
        ticker: t,
        nombre: t.endsWith('.BA') ? `Acción BYMA ${t}` : `Cedear / ADR ${t}`,
        categoria: t.endsWith('.BA') ? 'CEDEARs' : 'Acciones',
        tipoMercado: 'tradfi',
        moneda: t.endsWith('.BA') ? 'ARS' : 'USD'
      });
    }
  });

  return Array.from(mapa.values());
})();

// Datos semilla de contingencia institucional (con soporte explícito de CEDEARs .BA en ARS)
const CARTERA_SEMILLA = [
  {
    id: 1,
    ticker: 'BTC',
    tipo_mercado: 'cripto',
    cantidad: 0.25,
    precio_compra_promedio: 126500000,
    moneda: 'ARS',
    fecha_ingreso: '2026-10-01T12:00:00Z'
  },
  {
    id: 2,
    ticker: 'ETH',
    tipo_mercado: 'cripto',
    cantidad: 3.2,
    precio_compra_promedio: 3780000,
    moneda: 'ARS',
    fecha_ingreso: '2026-10-04T15:30:00Z'
  },
  {
    id: 3,
    ticker: 'VIG.BA', // CEDEAR local cotizado en BYMA en pesos con CCL implícito
    tipo_mercado: 'tradfi',
    cantidad: 11,
    precio_compra_promedio: 10180.0,
    moneda: 'ARS',
    fecha_ingreso: '2026-10-10T14:00:00Z'
  },
  {
    id: 4,
    ticker: 'SPY.BA', // CEDEAR S&P 500 en BYMA
    tipo_mercado: 'tradfi',
    cantidad: 18,
    precio_compra_promedio: 20850.0,
    moneda: 'ARS',
    fecha_ingreso: '2026-09-15T18:00:00Z'
  },
  {
    id: 5,
    ticker: 'NVDA', // Acción directa en Wall Street (USD)
    tipo_mercado: 'tradfi',
    cantidad: 35,
    precio_compra_promedio: 208.2,
    moneda: 'USD',
    fecha_ingreso: '2026-09-25T14:20:00Z'
  },
  {
    id: 6,
    ticker: 'AL30.BA',
    tipo_mercado: 'tradfi',
    cantidad: 4500,
    precio_compra_promedio: 712.0,
    moneda: 'ARS',
    fecha_ingreso: '2026-09-28T16:45:00Z'
  },
  {
    id: 7,
    ticker: 'GGAL.BA',
    tipo_mercado: 'tradfi',
    cantidad: 800,
    precio_compra_promedio: 5620.0,
    moneda: 'ARS',
    fecha_ingreso: '2026-10-08T11:10:00Z'
  }
];

const COLORES_PALETA = [
  '#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#06b6d4',
  '#ec4899', '#eab308', '#6366f1', '#14b8a6', '#f43f5e'
];

export default function Portfolio() {
  const context = useOutletContext() || {};
  const {
    datosScreener = [],
    conectadoSupabase = false,
    fetchCotizacionesReales
  } = context;

  const {
    monedaGlobal,
    tasaCambio,
    fuenteTasa,
    formatearPrecio,
    formatearMonto: formatMontoCtx,
    convertirMonto
  } = useCurrency();
  const { user } = useAuth();

  const storageKey = useMemo(() => {
    return 'condorfi_cartera_activa_' + (user?.id || 'default');
  }, [user]);

  const [posiciones, setPosiciones] = useState(() => {
    try {
      const guardadas = localStorage.getItem('condorfi_cartera_activa_' + (user?.id || 'default')) ||
                        localStorage.getItem('condorfi_cartera_activa');
      if (guardadas) {
        const parsed = JSON.parse(guardadas);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Migración suave: Si la cartera guardada contiene 'VIG' ingresado como CEDEAR en pesos (< $1.000 o marcado en ARS)
          // se migra automáticamente a 'VIG.BA' para corregir la sobrevaloración del ticker de EE.UU.
          return parsed.map(p => {
            if (p.ticker === 'VIG' && (p.precio_compra_promedio === 80 || p.moneda === 'ARS')) {
              return {
                ...p,
                ticker: 'VIG.BA',
                precio_compra_promedio: p.precio_compra_promedio === 80 ? 10180 : p.precio_compra_promedio,
                moneda: 'ARS'
              };
            }
            return p;
          });
        }
      }
    } catch {}
    return CARTERA_SEMILLA;
  });

  const [cargandoPosiciones, setCargandoPosiciones] = useState(false);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [filtroMercado, setFiltroMercado] = useState('todos');

  // Precios en vivo capturados directamente de APIs remotas para erradicar mocks
  const [preciosEnVivo, setPreciosEnVivo] = useState({});
  const [cargandoPreciosVivo, setCargandoPreciosVivo] = useState(false);
  const [ultimaCapturaEnVivo, setUltimaCapturaEnVivo] = useState(null);

  // Formulario de nueva posición y Autocomplete Combobox
  const [nuevoTicker, setNuevoTicker] = useState('VIG.BA');
  const [busquedaTicker, setBusquedaTicker] = useState('VIG.BA');
  const [dropdownAbierto, setDropdownAbierto] = useState(false);
  const [nuevaCantidad, setNuevaCantidad] = useState('');
  const [nuevoPrecioCompra, setNuevoPrecioCompra] = useState('');
  const [nuevaMoneda, setNuevaMoneda] = useState('ARS');
  const [nuevoTipoMercado, setNuevoTipoMercado] = useState('tradfi');
  const [mensajeExito, setMensajeExito] = useState(null);
  const comboboxRef = useRef(null);

  // Cerrar dropdown flotante al hacer clic fuera del combobox
  useEffect(() => {
    function handleClickOutside(event) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target)) {
        setDropdownAbierto(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  /**
   * Sincronización en Vivo de Cotizaciones Reales para la Cartera
   * Realiza una consulta directa a /api/scrapper-tradfi (Yahoo Finance) y CriptoYa
   * para obtener los precios actuales de todos los activos guardados.
   * Maneja tanto tickers .BA (en ARS) como tickers de Wall Street (en USD).
   */
  const sincronizarPreciosEnVivo = useCallback(async () => {
    if (!posiciones || posiciones.length === 0) return;

    const tickersUnicos = Array.from(new Set(
      posiciones.map(p => (p.ticker || '').toUpperCase().trim())
    )).filter(Boolean);

    if (tickersUnicos.length === 0) return;

    setCargandoPreciosVivo(true);

    try {
      // 1. Extraer activos TradFi (Wall Street, CEDEARs .BA, Bonos, BYMA)
      const tickersTradFi = tickersUnicos.filter(t => !['BTC', 'ETH', 'SOL', 'USDT', 'BNB', 'XRP', 'LTC', 'ADA', 'DOGE'].includes(t));
      if (tickersTradFi.length > 0) {
        try {
          const res = await fetch(`/api/scrapper-tradfi?tickers=${tickersTradFi.join(',')}`);
          if (res.ok) {
            const json = await res.json();
            const listaActivos = json.activos || json.screener || json.datos || [];
            if (Array.isArray(listaActivos) && listaActivos.length > 0) {
              setPreciosEnVivo(prev => {
                const copia = { ...prev };
                listaActivos.forEach(item => {
                  const sym = (item.ticker || item.activo || '').toUpperCase();
                  const pActual = Number(item.precio_actual ?? item.precioActual ?? 0);
                  const pApertura = Number(item.precio_apertura ?? item.precioApertura ?? pActual);
                  if (sym && pActual > 0) {
                    const esBA = sym.endsWith('.BA') || sym === '^MERV';
                    copia[sym] = {
                      precio_actual: pActual,
                      precio_apertura: pApertura,
                      moneda: esBA ? 'ARS' : (item.moneda || 'USD'),
                      variacion24h: item.variacion24h ?? (pApertura > 0 ? ((pActual - pApertura) / pApertura) * 100 : 0),
                      timestamp: new Date().toISOString()
                    };
                  }
                });
                return copia;
              });
            }
          }
        } catch (eTradFi) {
          console.warn('[Portfolio] Error al consultar /api/scrapper-tradfi:', eTradFi);
        }
      }

      // 2. Extraer activos Cripto (consultar cotizaciones en ARS de exchanges locales)
      const tickersCripto = tickersUnicos.filter(t => ['BTC', 'ETH', 'SOL', 'USDT', 'BNB', 'XRP', 'LTC'].includes(t));
      for (const cTicker of tickersCripto) {
        try {
          const resCripto = await fetch(`https://criptoya.com/api/binance/${cTicker.toLowerCase()}/ars`);
          if (resCripto.ok) {
            const dataC = await resCripto.json();
            const precioCripto = Number(dataC.ask || dataC.bid || dataC.totalAsk);
            if (precioCripto > 0) {
              setPreciosEnVivo(prev => ({
                ...prev,
                [cTicker]: {
                  precio_actual: precioCripto,
                  precio_apertura: precioCripto,
                  moneda: 'ARS',
                  variacion24h: 0,
                  timestamp: new Date().toISOString()
                }
              }));
            }
          }
        } catch {}
      }

      setUltimaCapturaEnVivo(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.warn('[Portfolio] Error general al sincronizar precios en vivo:', err);
    } finally {
      setCargandoPreciosVivo(false);
    }
  }, [posiciones]);

  // Sincronización automática de precios al montar y periódicamente cada 45s
  useEffect(() => {
    sincronizarPreciosEnVivo();
    const timer = setInterval(sincronizarPreciosEnVivo, 45000);
    return () => clearInterval(timer);
  }, [sincronizarPreciosEnVivo]);

  // Catálogo unificado enriquecido con cotizaciones en tiempo real del Screener y Precios en Vivo
  const catalogoCombinado = useMemo(() => {
    const mapa = new Map();

    // 1. Cargar activos de la fuente unificada (catalogoActivos.js)
    CATALOGO_UNIFICADO_BASE.forEach(item => {
      mapa.set(item.ticker.toUpperCase(), { ...item });
    });

    // 2. Enriquecer o agregar con datos dinámicos recibidos por datosScreener
    (datosScreener || []).forEach(item => {
      const t = (item.activo || item.ticker || '').toUpperCase();
      if (t) {
        const previo = mapa.get(t);
        const esBA = t.endsWith('.BA') || t === '^MERV';
        mapa.set(t, {
          ticker: t,
          nombre: item.nombre || previo?.nombre || t,
          categoria: previo?.categoria || (esBA ? 'CEDEARs' : (item.tipoMercado === 'cripto' ? 'Criptomonedas' : 'Acciones')),
          tipoMercado: item.tipoMercado || previo?.tipoMercado || 'tradfi',
          moneda: esBA ? 'ARS' : (item.moneda || previo?.moneda || 'USD'),
          precioActual: item.precioActual || null
        });
      }
    });

    // 3. Enriquecer con cotizaciones remotas en vivo recientes
    Object.entries(preciosEnVivo).forEach(([sym, datos]) => {
      const previo = mapa.get(sym);
      const esBA = sym.endsWith('.BA') || sym === '^MERV';
      if (previo && datos.precio_actual > 0) {
        mapa.set(sym, {
          ...previo,
          precioActual: datos.precio_actual,
          moneda: esBA ? 'ARS' : (datos.moneda || previo.moneda)
        });
      }
    });

    return Array.from(mapa.values());
  }, [datosScreener, preciosEnVivo]);

  // Filtrado en tiempo real sin límites arbitrarios con soporte dinámico para tickers .BA
  const opcionesFiltradas = useMemo(() => {
    const q = (busquedaTicker || '').trim().toUpperCase();
    let lista = [...catalogoCombinado];

    // Soporte de Tickers Locales Dinámicos:
    // Si el usuario escribe un símbolo que no está en el catálogo predeterminado,
    // pero termina en .BA o es un ticker válido, se inyecta como opción inmediata.
    if (q) {
      const existeExacto = lista.some(item => item.ticker.toUpperCase() === q);
      if (!existeExacto) {
        const esBA = q.endsWith('.BA');
        const sugerido = {
          ticker: q,
          nombre: esBA ? `CEDEAR / Instrumento BYMA ${q}` : `Instrumento Personalizado ${q}`,
          categoria: esBA ? 'CEDEARs' : 'Acciones',
          tipoMercado: 'tradfi',
          moneda: esBA ? 'ARS' : 'USD'
        };
        lista.unshift(sugerido);
      }
    }

    if (!q) {
      return lista;
    }

    const qLower = q.toLowerCase();
    return lista.filter(item => {
      const matchTicker = (item.ticker || '').toLowerCase().includes(qLower);
      const matchNombre = (item.nombre || '').toLowerCase().includes(qLower);
      const matchCat = (item.categoria || '').toLowerCase().includes(qLower);
      return matchTicker || matchNombre || matchCat;
    });
  }, [catalogoCombinado, busquedaTicker]);

  // Manejador al seleccionar un elemento del combobox
  const handleSeleccionarActivo = (item) => {
    const tUpper = item.ticker.toUpperCase().trim();
    const esBA = tUpper.endsWith('.BA') || tUpper === '^MERV';

    setNuevoTicker(tUpper);
    setBusquedaTicker(tUpper);
    setNuevaMoneda(esBA ? 'ARS' : determinarMonedaNativa(tUpper, item.tipoMercado, item.moneda));
    setNuevoTipoMercado(item.tipoMercado || 'tradfi');
    if (item.precioActual) {
      setNuevoPrecioCompra(String(item.precioActual));
    }
    setDropdownAbierto(false);
  };

  // Cargar posiciones desde Supabase si está disponible (con aislamiento RLS por usuario)
  const cargarPosicionesSupabase = useCallback(async () => {
    if (!supabase) return;
    setCargandoPosiciones(true);
    try {
      let query = supabase
        .from('cartera_activa')
        .select('*');

      if (user && user.id) {
        query = query.or(`user_id.eq.${user.id},user_id.is.null`);
      }

      const { data, error } = await query.order('fecha_ingreso', { ascending: false });

      if (!error && data && data.length > 0) {
        setPosiciones(data);
        localStorage.setItem(storageKey, JSON.stringify(data));
      }
    } catch (err) {
      console.warn('[Portfolio] Aviso al consultar cartera_activa en Supabase:', err.message);
    } finally {
      setCargandoPosiciones(false);
    }
  }, [user, storageKey]);

  useEffect(() => {
    cargarPosicionesSupabase();
  }, [cargarPosicionesSupabase]);

  // Sincronizar precio sugerido al cambiar de ticker en el modal
  useEffect(() => {
    const tUpper = nuevoTicker.toUpperCase().trim();
    const esBA = tUpper.endsWith('.BA') || tUpper === '^MERV';
    const itemScreener = catalogoCombinado.find(d => d.ticker.toUpperCase() === tUpper);

    if (esBA) {
      setNuevaMoneda('ARS');
    }

    if (itemScreener) {
      setNuevoTipoMercado(itemScreener.tipoMercado || 'tradfi');
      setNuevaMoneda(esBA ? 'ARS' : determinarMonedaNativa(itemScreener.ticker, itemScreener.tipoMercado, itemScreener.moneda));
      if (itemScreener.precioActual && !nuevoPrecioCompra) {
        setNuevoPrecioCompra(String(itemScreener.precioActual));
      }
    }
  }, [nuevoTicker, catalogoCombinado, nuevoPrecioCompra]);

  /**
   * =========================================================================
   * CÁLCULO CUANTITATIVO CON LÓGICA CONDICIONAL DE FX PARA ACTIVOS .BA
   * =========================================================================
   */
  const posicionesConMetricas = useMemo(() => {
    return posiciones.map(pos => {
      const tickerClean = (pos.ticker || '').toUpperCase().trim();
      const screenerMatch = datosScreener.find(d => (d.activo || d.ticker || '').toUpperCase() === tickerClean);
      const enVivoMatch = preciosEnVivo[tickerClean];

      // 1. Verificación de activo local BYMA / CEDEAR (.BA o ^MERV)
      const esActivoBYMA = tickerClean.endsWith('.BA') || tickerClean === '^MERV';

      // 2. Determinación de la moneda nativa estricta:
      // Si termina en .BA, el activo es NATIVO en Pesos Argentinos (ARS)
      const monedaNativa = esActivoBYMA ? 'ARS' : determinarMonedaNativa(tickerClean, pos.tipo_mercado, pos.moneda);
      
      // 3. Precio actual en vivo: prioridad máxima a la cotización fresca remota
      let precioActual = Number(pos.precio_compra_promedio);
      let esPrecioEnVivo = false;

      if (enVivoMatch && enVivoMatch.precio_actual > 0) {
        precioActual = Number(enVivoMatch.precio_actual);
        esPrecioEnVivo = true;
      } else if (screenerMatch && screenerMatch.precioActual > 0) {
        precioActual = Number(screenerMatch.precioActual);
        esPrecioEnVivo = true;
      }

      const precioCompra = Number(pos.precio_compra_promedio);
      const cantidad = Number(pos.cantidad);

      // 4. Métricas en moneda nativa
      const costoTotalNativo = cantidad * precioCompra;
      const valorMercadoNativo = cantidad * precioActual;
      const pnlNominalNativo = valorMercadoNativo - costoTotalNativo;
      const pnlPct = precioCompra > 0 ? ((precioActual - precioCompra) / precioCompra) * 100 : 0;

      // 5. LÓGICA CONDICIONAL DE FX OBLIGATORIA:
      // Regla 1: Si un activo termina en .BA (ej. VIG.BA, SPY.BA, GGAL.BA):
      //    El precio que devuelve la API ya se encuentra en pesos argentinos (ARS)
      //    e incluye el tipo de cambio CCL implícito.
      //    * En vista 'ARS': OMITIR el multiplicador de FX y utilizar el precio directo en pesos.
      //    * En vista 'USD': Dividir por la tasa de cambio en vivo para reflejar el valor en divisa dura.
      // Regla 2: Si un activo NO termina en .BA y es de Wall Street (USD):
      //    * En vista 'ARS': Multiplicar por la tasa de cambio en vivo (USD * FX).
      //    * En vista 'USD': Utilizar el precio directo en dólares.
      let costoConvertido;
      let valorConvertido;
      let precioActualConvertido;
      let precioCompraConvertido;

      const fx = tasaCambio > 0 ? tasaCambio : 1640;

      if (esActivoBYMA) {
        if (monedaGlobal === 'ARS') {
          // OMITIR MULTIPLICADOR FX: PRECIO DIRECTO EN ARS (CCL IMPLÍCITO)
          costoConvertido = costoTotalNativo;
          valorConvertido = valorMercadoNativo;
          precioActualConvertido = precioActual;
          precioCompraConvertido = precioCompra;
        } else {
          // Vista en USD: Descontar el tipo de cambio
          costoConvertido = costoTotalNativo / fx;
          valorConvertido = valorMercadoNativo / fx;
          precioActualConvertido = precioActual / fx;
          precioCompraConvertido = precioCompra / fx;
        }
      } else if (monedaNativa === 'USD') {
        // Instrumento de Wall Street en dólares estadounidenses
        if (monedaGlobal === 'ARS') {
          costoConvertido = costoTotalNativo * fx;
          valorConvertido = valorMercadoNativo * fx;
          precioActualConvertido = precioActual * fx;
          precioCompraConvertido = precioCompra * fx;
        } else {
          costoConvertido = costoTotalNativo;
          valorConvertido = valorMercadoNativo;
          precioActualConvertido = precioActual;
          precioCompraConvertido = precioCompra;
        }
      } else {
        // Criptomonedas u otros instrumentos en ARS
        if (monedaGlobal === 'ARS') {
          costoConvertido = costoTotalNativo;
          valorConvertido = valorMercadoNativo;
          precioActualConvertido = precioActual;
          precioCompraConvertido = precioCompra;
        } else {
          costoConvertido = costoTotalNativo / fx;
          valorConvertido = valorMercadoNativo / fx;
          precioActualConvertido = precioActual / fx;
          precioCompraConvertido = precioCompra / fx;
        }
      }

      const pnlNominalConvertido = valorConvertido - costoConvertido;

      return {
        ...pos,
        tickerClean,
        nombre: screenerMatch?.nombre || NOMBRES_CEDEARS?.[tickerClean] || pos.ticker,
        mercado: esActivoBYMA ? 'BYMA (CCL Implícito)' : (screenerMatch?.mercado || pos.tipo_mercado),
        tipoMercado: esActivoBYMA ? 'cedears' : (screenerMatch?.tipoMercado || pos.tipo_mercado || 'tradfi'),
        condorScore: screenerMatch?.condorScore ?? null,
        dictamen: screenerMatch?.dictamen ?? 'HOLD',
        alineacionTemporal: screenerMatch?.alineacion_temporal ?? 'NEUTRAL',
        variacion24h: enVivoMatch?.variacion24h ?? screenerMatch?.variacion24h ?? 0,
        monedaNativa,
        esActivoBYMA,
        cantidad,
        precioCompra,
        precioActual,
        costoTotalNativo,
        valorMercadoNativo,
        pnlNominalNativo,
        pnlPct,
        costoConvertido,
        valorConvertido,
        pnlNominalConvertido,
        precioActualConvertido,
        precioCompraConvertido,
        esPrecioEnVivo
      };
    });
  }, [posiciones, datosScreener, preciosEnVivo, monedaGlobal, tasaCambio]);

  // Métricas agregadas de Portafolio Total
  const metricasConsolidadas = useMemo(() => {
    const exposicionTotal = posicionesConMetricas.reduce((acc, p) => acc + p.valorConvertido, 0);
    const costoTotal = posicionesConMetricas.reduce((acc, p) => acc + p.costoConvertido, 0);
    const pnlNominalTotal = exposicionTotal - costoTotal;
    const pnlPorcentajeTotal = costoTotal > 0 ? ((exposicionTotal - costoTotal) / costoTotal) * 100 : 0;

    // Top performer
    const posicionesOrdenadasPnL = [...posicionesConMetricas].sort((a, b) => b.pnlPct - a.pnlPct);
    const mejorActivo = posicionesOrdenadasPnL[0] || null;
    const peorActivo = posicionesOrdenadasPnL[posicionesOrdenadasPnL.length - 1] || null;

    // Distribución por clase de activo
    const exposicionCripto = posicionesConMetricas
      .filter(p => p.tipoMercado === 'cripto')
      .reduce((acc, p) => acc + p.valorConvertido, 0);
    const exposicionTradfi = exposicionTotal - exposicionCripto;

    return {
      exposicionTotal,
      costoTotal,
      pnlNominalTotal,
      pnlPorcentajeTotal,
      mejorActivo,
      peorActivo,
      exposicionCripto,
      exposicionTradfi,
      pctCripto: exposicionTotal > 0 ? (exposicionCripto / exposicionTotal) * 100 : 0,
      pctTradfi: exposicionTotal > 0 ? (exposicionTradfi / exposicionTotal) * 100 : 0,
      totalPosiciones: posicionesConMetricas.length
    };
  }, [posicionesConMetricas]);

  // Ponderación por activo para la tabla y gráficos
  const posicionesConPonderacion = useMemo(() => {
    const total = metricasConsolidadas.exposicionTotal || 1;
    return posicionesConMetricas.map(p => ({
      ...p,
      ponderacion: (p.valorConvertido / total) * 100
    }));
  }, [posicionesConMetricas, metricasConsolidadas.exposicionTotal]);

  // Filtrado de posiciones para visualización en tabla
  const posicionesFiltradas = useMemo(() => {
    return posicionesConPonderacion.filter(p => {
      const matchTexto = p.ticker.toLowerCase().includes(filtroBusqueda.toLowerCase()) ||
        p.nombre.toLowerCase().includes(filtroBusqueda.toLowerCase());
      const matchMercado = filtroMercado === 'todos' ||
        (filtroMercado === 'cripto' && p.tipoMercado === 'cripto') ||
        (filtroMercado === 'cedears' && p.esActivoBYMA) ||
        (filtroMercado === 'tradfi' && p.tipoMercado !== 'cripto');
      return matchTexto && matchMercado;
    });
  }, [posicionesConPonderacion, filtroBusqueda, filtroMercado]);

  // Datos para el gráfico de distribución por activo
  const datosGraficoDistribucion = useMemo(() => {
    return posicionesConPonderacion
      .map(p => ({
        name: p.ticker,
        value: Number(p.valorConvertido.toFixed(2)),
        pct: Number(p.ponderacion.toFixed(1))
      }))
      .sort((a, b) => b.value - a.value);
  }, [posicionesConPonderacion]);

  // Manejo de Altas y Bajas
  const agregarPosicion = async (e) => {
    e.preventDefault();
    const cant = parseFloat(nuevaCantidad);
    const precio = parseFloat(nuevoPrecioCompra);

    if (isNaN(cant) || cant <= 0 || isNaN(precio) || precio <= 0) {
      alert('Por favor ingrese valores numéricos positivos para cantidad y precio de compra.');
      return;
    }

    const tUpper = nuevoTicker.toUpperCase().trim();
    const esBA = tUpper.endsWith('.BA') || tUpper === '^MERV';
    const monedaFinal = esBA ? 'ARS' : determinarMonedaNativa(tUpper, nuevoTipoMercado, nuevaMoneda);

    const nueva = {
      user_id: user?.id || null,
      ticker: tUpper,
      tipo_mercado: nuevoTipoMercado,
      cantidad: cant,
      precio_compra_promedio: precio,
      moneda: monedaFinal,
      fecha_ingreso: new Date().toISOString()
    };

    // Guardar en Supabase si está disponible (con user_id para RLS)
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('cartera_activa')
          .insert([nueva])
          .select();
        if (!error && data && data.length > 0) {
          nueva.id = data[0].id;
        }
      } catch (err) {
        console.warn('[Portfolio] Aviso al insertar en Supabase:', err.message);
      }
    }

    if (!nueva.id) {
      nueva.id = Date.now();
    }

    const actualizadas = [nueva, ...posiciones];
    setPosiciones(actualizadas);
    try {
      localStorage.setItem(storageKey, JSON.stringify(actualizadas));
    } catch {}

    setMensajeExito(`Posición ${nueva.ticker} (${monedaFinal}) registrada exitosamente en cartera.`);
    setTimeout(() => setMensajeExito(null), 3500);
    setModalAbierto(false);
    setNuevaCantidad('');
    setNuevoPrecioCompra('');
  };

  const eliminarPosicion = async (id, ticker) => {
    if (!window.confirm(`¿Estás seguro de liquidar/eliminar la posición de ${ticker}?`)) {
      return;
    }

    if (supabase) {
      try {
        await supabase
          .from('cartera_activa')
          .delete()
          .eq('id', id);
      } catch (err) {
        console.warn('[Portfolio] Aviso al eliminar en Supabase:', err.message);
      }
    }

    const actualizadas = posiciones.filter(p => p.id !== id);
    setPosiciones(actualizadas);
    try {
      localStorage.setItem(storageKey, JSON.stringify(actualizadas));
    } catch {}
  };

  return (
    <div className="space-y-6">
      {/* =========================================================================
          1. HEADER INSTITUCIONAL DEL PORTAFOLIO
      ========================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 shadow-2xs">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-mono text-slate-900 tracking-tight">
                Cartera Activa Institucional
              </h2>
              <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Mark-to-Market ({monedaGlobal})
              </span>
            </div>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              Soporte nativo para CEDEARs (.BA con CCL implícito) y Wall Street. Paridad FX ${tasaCambio.toLocaleString('es-AR', { maximumFractionDigits: 1 })} ARS/USD ({fuenteTasa})
              {ultimaCapturaEnVivo && ` • Feed ${ultimaCapturaEnVivo}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              cargarPosicionesSupabase();
              sincronizarPreciosEnVivo();
            }}
            disabled={cargandoPosiciones || cargandoPreciosVivo}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
            title="Refrescar cotizaciones reales y base de datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargandoPosiciones || cargandoPreciosVivo ? 'animate-spin text-orange-600' : ''}`} />
            <span className="hidden md:inline">{cargandoPreciosVivo ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>

          <button
            onClick={() => {
              setBusquedaTicker(nuevoTicker || '');
              setDropdownAbierto(false);
              setModalAbierto(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold text-white bg-orange-600 hover:bg-orange-700 shadow-sm transition active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Registrar Posición</span>
          </button>
        </div>
      </div>

      {mensajeExito && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-mono text-emerald-800 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{mensajeExito}</span>
        </div>
      )}

      {/* =========================================================================
          2. CARDS DE MÉTRICAS GLOBALES (KPIS CON SEPARADOR DE MILES)
      ========================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Exposición Total */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold">Exposición Total</span>
            <div className="p-2 rounded-lg bg-slate-50 text-slate-700 border border-slate-100">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl lg:text-3xl font-black font-mono text-slate-900 tracking-tight">
              {formatearMonto(metricasConsolidadas.exposicionTotal, monedaGlobal, { mostrarCodigo: true })}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs font-mono">
              <span className="text-slate-400">Activos:</span>
              <strong className="text-slate-700 font-bold">{metricasConsolidadas.totalPosiciones} tickers</strong>
              <span className="text-slate-300">•</span>
              <span className="text-slate-400">FX:</span>
              <strong className="text-slate-700 font-bold">${tasaCambio.toLocaleString('es-AR')}</strong>
            </div>
          </div>
        </div>

        {/* Card 2: PnL Total Abierto */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold">PnL Abierto Total</span>
            <div className={`p-2 rounded-lg border ${
              metricasConsolidadas.pnlNominalTotal >= 0
                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                : 'bg-rose-50 text-rose-600 border-rose-100'
            }`}>
              {metricasConsolidadas.pnlNominalTotal >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
            </div>
          </div>
          <div>
            <div className={`text-2xl lg:text-3xl font-black font-mono tracking-tight flex items-baseline gap-2 ${
              metricasConsolidadas.pnlNominalTotal >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}>
              <span>
                {metricasConsolidadas.pnlNominalTotal >= 0 ? '+' : ''}
                {formatearMonto(metricasConsolidadas.pnlNominalTotal, monedaGlobal, { mostrarCodigo: true })}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${
                metricasConsolidadas.pnlPorcentajeTotal >= 0
                  ? 'bg-emerald-100/70 text-emerald-800'
                  : 'bg-rose-100/70 text-rose-800'
              }`}>
                {metricasConsolidadas.pnlPorcentajeTotal >= 0 ? '+' : ''}
                {metricasConsolidadas.pnlPorcentajeTotal.toFixed(2)}%
              </span>
              <span className="text-xs font-mono text-slate-400">retorno global</span>
            </div>
          </div>
        </div>

        {/* Card 3: Inversión Base (Costo Total) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold">Costo Base Invertido</span>
            <div className="p-2 rounded-lg bg-slate-50 text-slate-700 border border-slate-100">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl lg:text-3xl font-black font-mono text-slate-900 tracking-tight">
              {formatearMonto(metricasConsolidadas.costoTotal, monedaGlobal, { mostrarCodigo: true })}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs font-mono text-slate-500">
              <span>Capital desembolsado original ({monedaGlobal})</span>
            </div>
          </div>
        </div>

        {/* Card 4: Top Performer & Asignación */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider font-semibold">Top Performer</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          {metricasConsolidadas.mejorActivo ? (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xl font-black font-mono text-slate-900">
                  {metricasConsolidadas.mejorActivo.ticker}
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  +{metricasConsolidadas.mejorActivo.pnlPct.toFixed(2)}%
                </span>
              </div>
              <div className="text-xs font-mono text-slate-500 mt-2 truncate">
                PnL: +{formatearMonto(metricasConsolidadas.mejorActivo.pnlNominalConvertido, monedaGlobal, { mostrarCodigo: true })}
              </div>
            </div>
          ) : (
            <div className="text-sm font-mono text-slate-400">Sin posiciones</div>
          )}
        </div>
      </div>

      {/* =========================================================================
          3. DISTRIBUCIÓN DE ACTIVOS & ASIGNACIÓN DE CARTERA
      ========================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Barra de Diversificación */}
        <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-slate-700 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-orange-500" />
                Diversificación por Mercado
              </h3>
              <span className="text-[11px] font-mono text-slate-400">Total 100%</span>
            </div>

            {/* Barra segmentada */}
            <div className="w-full h-3.5 rounded-full bg-slate-100 flex overflow-hidden border border-slate-200 mb-4">
              <div
                style={{ width: `${metricasConsolidadas.pctCripto}%` }}
                className="bg-orange-500 h-full transition-all duration-500"
                title={`Cripto: ${metricasConsolidadas.pctCripto.toFixed(1)}%`}
              />
              <div
                style={{ width: `${metricasConsolidadas.pctTradfi}%` }}
                className="bg-blue-600 h-full transition-all duration-500"
                title={`TradFi: ${metricasConsolidadas.pctTradfi.toFixed(1)}%`}
              />
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-orange-50/60 border border-orange-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                  <span className="font-semibold text-slate-800">Criptoactivos</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900">
                    {formatearMonto(metricasConsolidadas.exposicionCripto, monedaGlobal)}
                  </span>
                  <span className="text-slate-400 ml-1.5">({metricasConsolidadas.pctCripto.toFixed(1)}%)</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50/60 border border-blue-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  <span className="font-semibold text-slate-800">TradFi (BYMA / CEDEARs & Wall St.)</span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900">
                    {formatearMonto(metricasConsolidadas.exposicionTradfi, monedaGlobal)}
                  </span>
                  <span className="text-slate-400 ml-1.5">({metricasConsolidadas.pctTradfi.toFixed(1)}%)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>Tasa FX Dólar Cripto:</span>
            <strong className="text-slate-800">${tasaCambio.toLocaleString('es-AR')} ARS/USD</strong>
          </div>
        </div>

        {/* Gráfico de Barras: Exposición por Activo */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-slate-700">
                Ponderación de Cartera por Activo (Weight %)
              </h3>
              <p className="text-[11px] text-slate-500 font-sans">
                Exposición relativa convertida a {monedaGlobal} con separador de miles
              </p>
            </div>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datosGraficoDistribucion} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} fontFamily="monospace" />
                <YAxis stroke="#94a3b8" fontSize={10} fontFamily="monospace" tickFormatter={v => `${v}`} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-2.5 rounded-xl border border-slate-700 shadow-xl text-xs font-mono">
                          <p className="font-bold text-orange-400">{d.name}</p>
                          <p className="text-slate-300">
                            Valor: {formatearMonto(d.value, monedaGlobal, { mostrarCodigo: true })}
                          </p>
                          <p className="text-emerald-400">Ponderación: {d.pct}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {datosGraficoDistribucion.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORES_PALETA[index % COLORES_PALETA.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* =========================================================================
          4. TABLA DE POSICIONES ACTIVAS (DATAGRID CON DISTINCIÓN BYMA / CEDEARS)
      ========================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Controles de Filtro de la Tabla */}
        <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filtroBusqueda}
                onChange={e => setFiltroBusqueda(e.target.value)}
                placeholder="Buscar por ticker o nombre (ej. VIG.BA)..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition"
              />
            </div>
            <div className="flex items-center rounded-xl border border-slate-200 p-0.5 bg-slate-50 font-mono text-xs">
              <button
                type="button"
                onClick={() => setFiltroMercado('todos')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  filtroMercado === 'todos' ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFiltroMercado('cedears')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  filtroMercado === 'cedears' ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                CEDEARs (.BA)
              </button>
              <button
                type="button"
                onClick={() => setFiltroMercado('cripto')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  filtroMercado === 'cripto' ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Cripto
              </button>
              <button
                type="button"
                onClick={() => setFiltroMercado('tradfi')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  filtroMercado === 'tradfi' ? 'bg-white font-bold text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                TradFi
              </button>
            </div>
          </div>

          <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
            {cargandoPreciosVivo && (
              <span className="flex items-center gap-1 text-orange-600">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Actualizando quotes...</span>
              </span>
            )}
            <span>Mostrando <strong>{posicionesFiltradas.length}</strong> de <strong>{posiciones.length}</strong> posiciones</span>
          </div>
        </div>

        {/* Tabla Responsiva */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[10px] font-mono uppercase tracking-wider text-slate-500 select-none">
                <th className="py-3 px-4">Activo / Instrumento</th>
                <th className="py-3 px-3 text-right">Cantidad</th>
                <th className="py-3 px-3 text-right">Precio Compra</th>
                <th className="py-3 px-3 text-right">Precio Actual en Vivo</th>
                <th className="py-3 px-3 text-right">Exposición ({monedaGlobal})</th>
                <th className="py-3 px-3 text-right">Costo Base ({monedaGlobal})</th>
                <th className="py-3 px-3 text-right">PnL Abierto ({monedaGlobal})</th>
                <th className="py-3 px-3 text-right">Retorno %</th>
                <th className="py-3 px-3 text-center">Peso</th>
                <th className="py-3 px-3 text-center">Quant Score</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {posicionesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400 font-mono text-xs">
                    No se encontraron posiciones activas coincidentes con el filtro.
                  </td>
                </tr>
              ) : (
                posicionesFiltradas.map(pos => {
                  const esGanancia = pos.pnlNominalConvertido >= 0;
                  return (
                    <tr key={pos.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Activo / Ticker */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            pos.tipoMercado === 'cripto'
                              ? 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                              : pos.esActivoBYMA
                              ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                              : 'bg-blue-500/10 text-blue-700 border border-blue-500/20'
                          }`}>
                            {pos.tipoMercado === 'cripto' ? (
                              <Coins className="w-4 h-4" />
                            ) : (
                              <Building2 className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">{pos.ticker}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                pos.esActivoBYMA
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {pos.esActivoBYMA ? 'CEDEAR ARS' : pos.monedaNativa}
                              </span>
                              {pos.esPrecioEnVivo && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Cotización remota en vivo" />
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 font-sans block truncate max-w-[150px]" title={pos.nombre}>
                              {pos.nombre}
                            </span>
                            {pos.esActivoBYMA && (
                              <span className="text-[9px] text-emerald-600 font-mono block">
                                CCL implícito • Sin FX mult.
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Cantidad */}
                      <td className="py-3.5 px-3 text-right font-medium text-slate-800">
                        {pos.cantidad.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                      </td>

                      {/* Precio de Compra (Nativo y convertido si difiere) */}
                      <td className="py-3.5 px-3 text-right text-slate-600">
                        <div className="font-semibold text-slate-800">
                          {formatearMonto(pos.precioCompra, pos.monedaNativa, { mostrarCodigo: true })}
                        </div>
                        {pos.monedaNativa !== monedaGlobal && (
                          <div className="text-[10px] text-slate-400">
                            ≈ {formatearMonto(pos.precioCompraConvertido, monedaGlobal)}
                          </div>
                        )}
                      </td>

                      {/* Precio Actual en Vivo */}
                      <td className="py-3.5 px-3 text-right font-bold text-slate-900">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${pos.esPrecioEnVivo ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></span>
                          <span>{formatearMonto(pos.precioActual, pos.monedaNativa, { mostrarCodigo: true })}</span>
                        </div>
                        {pos.monedaNativa !== monedaGlobal && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            ≈ {formatearMonto(pos.precioActualConvertido, monedaGlobal)}
                          </div>
                        )}
                        <div className={`text-[10px] ${pos.variacion24h >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {pos.variacion24h >= 0 ? '+' : ''}{pos.variacion24h.toFixed(2)}% (24h)
                        </div>
                      </td>

                      {/* Exposición Actual en Moneda Global */}
                      <td className="py-3.5 px-3 text-right font-black text-slate-900">
                        {formatearMonto(pos.valorConvertido, monedaGlobal, { mostrarCodigo: true })}
                      </td>

                      {/* Costo Base en Moneda Global */}
                      <td className="py-3.5 px-3 text-right font-medium text-slate-600">
                        {formatearMonto(pos.costoConvertido, monedaGlobal)}
                      </td>

                      {/* PnL Abierto Nominal */}
                      <td className={`py-3.5 px-3 text-right font-black ${
                        esGanancia ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {esGanancia ? '+' : ''}
                        {formatearMonto(pos.pnlNominalConvertido, monedaGlobal, { mostrarCodigo: true })}
                      </td>

                      {/* PnL Abierto % */}
                      <td className="py-3.5 px-3 text-right">
                        <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${
                          pos.pnlPct >= 0
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          {pos.pnlPct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {pos.pnlPct >= 0 ? '+' : ''}{pos.pnlPct.toFixed(2)}%
                        </span>
                      </td>

                      {/* Ponderación de Cartera */}
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[11px] font-bold text-slate-700">{pos.ponderacion.toFixed(1)}%</span>
                          <div className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                            <div
                              style={{ width: `${Math.min(100, pos.ponderacion)}%` }}
                              className="h-full bg-orange-500 rounded-full"
                            />
                          </div>
                        </div>
                      </td>

                      {/* Quant Score & Dictamen */}
                      <td className="py-3.5 px-3 text-center">
                        {pos.condorScore !== null ? (
                          <div className="flex flex-col items-center">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              pos.dictamen === 'STRONG_BUY'
                                ? 'bg-emerald-500 text-white'
                                : pos.dictamen === 'BUY'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : pos.dictamen === 'SELL' || pos.dictamen === 'STRONG_SELL'
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {pos.dictamen}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5">
                              {pos.condorScore}/100
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">---</span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => eliminarPosicion(pos.id, pos.ticker)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                          title="Eliminar posición de cartera"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          5. MODAL INTERACTIVO: REGISTRAR NUEVA POSICIÓN CON SOPORTE .BA
      ========================================================================== */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-orange-600" />
                <h3 className="text-base font-bold font-mono text-slate-900">
                  Registrar Posición en Cartera
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={agregarPosicion} className="p-6 space-y-4 font-mono text-xs">
              {/* Ticker Selector con Autocomplete Personalizado (Combobox) */}
              <div className="relative" ref={comboboxRef}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-700 font-bold">
                    Ticker del Instrumento:
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    {opcionesFiltradas.length} activos disponibles
                  </span>
                </div>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={busquedaTicker}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setBusquedaTicker(val);
                      setNuevoTicker(val.trim());
                      if (val.trim().endsWith('.BA')) {
                        setNuevaMoneda('ARS');
                      }
                      setDropdownAbierto(true);
                    }}
                    onFocus={() => setDropdownAbierto(true)}
                    placeholder="Buscar (ej. VIG.BA, SPY.BA, NVDA, AL30.BA)..."
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white font-mono text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => setDropdownAbierto(prev => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${dropdownAbierto ? 'rotate-180 text-orange-600' : ''}`} />
                  </button>
                </div>

                {/* Dropdown Flotante con scroll natural */}
                {dropdownAbierto && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50 divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                    {opcionesFiltradas.length > 0 ? (
                      opcionesFiltradas.map((item) => {
                        const esSeleccionado = nuevoTicker.toUpperCase() === item.ticker.toUpperCase();
                        const esBA = item.ticker.toUpperCase().endsWith('.BA');
                        return (
                          <div
                            key={item.ticker}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSeleccionarActivo(item);
                            }}
                            className={`p-2.5 flex items-center justify-between hover:bg-orange-50 transition cursor-pointer ${
                              esSeleccionado ? 'bg-orange-50/70' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded border shrink-0 ${
                                esBA
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-slate-100 text-slate-900 border-slate-200'
                              }`}>
                                {item.ticker}
                              </span>
                              <div className="truncate min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate font-sans">
                                  {item.nombre}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {item.categoria} &bull; {esBA ? 'ARS (CCL Implícito)' : item.moneda}
                                </p>
                              </div>
                            </div>

                            <div className="text-right shrink-0 ml-2">
                              {item.precioActual ? (
                                <span className="font-mono text-xs font-bold text-slate-900 block">
                                  {formatearMonto(item.precioActual, esBA ? 'ARS' : (item.moneda || 'USD'))}
                                </span>
                              ) : null}
                              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                                esBA
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.categoria === 'Criptomonedas'
                                  ? 'bg-orange-100 text-orange-700'
                                  : item.categoria === 'Acciones'
                                  ? 'bg-blue-100 text-blue-700'
                                  : item.categoria === 'ETFs'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {esBA ? 'BYMA / CEDEAR' : item.categoria}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-4 text-center text-slate-400 font-mono text-xs">
                        No se encontraron activos para "{busquedaTicker}"
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Banner dinámico de confirmación de CEDEAR */}
              {nuevoTicker.toUpperCase().endsWith('.BA') && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-emerald-800 text-[11px] font-sans">
                  <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-mono font-bold">Instrumento BYMA (.BA) Detectado:</strong>
                    <p className="mt-0.5">
                      Cotiza directamente en pesos argentinos (ARS) con el tipo de cambio CCL ya implícito en el precio.
                      Se omitirá el multiplicador del Dólar Cripto.
                    </p>
                  </div>
                </div>
              )}

              {/* Cantidad y Moneda */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    Cantidad:
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="ej. 11"
                    value={nuevaCantidad}
                    onChange={e => setNuevaCantidad(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1.5">
                    Moneda de Compra:
                  </label>
                  <select
                    value={nuevaMoneda}
                    onChange={e => setNuevaMoneda(e.target.value)}
                    disabled={nuevoTicker.toUpperCase().endsWith('.BA')}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-mono text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="ARS">ARS (Pesos)</option>
                    <option value="USD">USD (Dólares)</option>
                  </select>
                </div>
              </div>

              {/* Precio de Compra */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">
                  Precio de Compra Unitario ({nuevaMoneda}):
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder={nuevoTicker.toUpperCase().endsWith('.BA') ? "ej. 10270.00 ARS" : "ej. 243.00 USD"}
                  value={nuevoPrecioCompra}
                  onChange={e => setNuevoPrecioCompra(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono text-xs focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 font-sans space-y-1">
                <p>
                  • Si registraste un CEDEAR local (ej. <strong>VIG.BA</strong>), el portafolio toma el precio directo en ARS sin multiplicar por el dólar.
                </p>
                <p>
                  • Si registraste la acción en EE.UU. (ej. <strong>VIG</strong>), el sistema aplicará la tasa de cambio viva (${tasaCambio.toLocaleString('es-AR')} ARS) en vista ARS.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition font-mono cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold shadow-sm transition active:scale-95 font-mono cursor-pointer"
                >
                  Guardar Posición
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
