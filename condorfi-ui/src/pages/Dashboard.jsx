/**
 * ==============================================================================
 * CondorFi - Vista: Dashboard Gerencial (Panel Ejecutivo)
 * Archivo: condorfi-ui/src/pages/Dashboard.jsx
 * 
 * Muestra:
 * 1. Tarjeta Resumen: El activo con mejor CondorScore del día.
 * 2. Estado General del Mercado (Sentimiento Bullish vs Bearish y dispersión).
 * 3. Minigráfico global de momentum y distribución de CondorScores.
 * 4. Accesos directos a las 4 vistas de mercado (/cripto, /acciones, /indices, /bonos).
 * 5. Radar de Insights Quants (Feed de alertas en tiempo real).
 * ==============================================================================
 */

import React, { useMemo } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { clasificarActivo } from '../components/ScreenerDataGrid';
import {
  Sparkles,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  Clock,
  Coins,
  Building2,
  BarChart3,
  Landmark,
  Radio
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from 'recharts';

export default function Dashboard() {
  const context = useOutletContext() || {};
  const {
    datosScreener = [],
    alertas = [],
    onEjecutarAnalisis,
    ejecutandoInsight = false,
    isLoading = false
  } = context;

  const estaCargando = Boolean(ejecutandoInsight || isLoading);

  // 1. Activo con mejor CondorScore del día
  const mejorActivo = useMemo(() => {
    if (!datosScreener || datosScreener.length === 0) return null;
    const ordenados = [...datosScreener]
      .filter(item => typeof item.condorScore === 'number')
      .sort((a, b) => b.condorScore - a.condorScore);
    return ordenados[0] || datosScreener[0];
  }, [datosScreener]);

  // 2. Sentimiento General del Mercado (Alcistas vs Bajistas)
  const metricasMercado = useMemo(() => {
    let alcistas = 0;
    let bajistas = 0;
    let strongBuyCount = 0;
    let sumaScores = 0;
    let conScoreCount = 0;

    datosScreener.forEach(item => {
      const varPct = typeof item.variacion24h === 'number' ? item.variacion24h : 0;
      if (varPct >= 0) alcistas++;
      else bajistas++;

      if (item.dictamen === 'STRONG_BUY') strongBuyCount++;

      if (typeof item.condorScore === 'number') {
        sumaScores += item.condorScore;
        conScoreCount++;
      }
    });

    const total = datosScreener.length || 1;
    const porcentajeBullish = Math.round((alcistas / total) * 100);
    const scorePromedio = conScoreCount > 0 ? Math.round(sumaScores / conScoreCount) : 65;

    return {
      total,
      alcistas,
      bajistas,
      porcentajeBullish,
      scorePromedio,
      strongBuyCount
    };
  }, [datosScreener]);

  // 3. Datos para el Minigráfico Global (Top 8 activos por CondorScore)
  const datosGraficoTop = useMemo(() => {
    return [...datosScreener]
      .filter(d => typeof d.condorScore === 'number')
      .sort((a, b) => b.condorScore - a.condorScore)
      .slice(0, 8)
      .map(d => ({
        ticker: d.activo,
        score: d.condorScore,
        rsi: typeof d.rsi === 'number' ? Math.round(d.rsi) : 50,
        dictamen: d.dictamen || 'HOLD'
      }));
  }, [datosScreener]);

  // 4. Métricas dinámicas agrupadas por categoría calculadas sobre datosScreener
  const conteosPorCategoria = useMemo(() => {
    const counts = { cripto: 0, acciones: 0, indices: 0, bonos: 0 };
    datosScreener.forEach(item => {
      const cat = clasificarActivo(item);
      if (cat === 'Criptomonedas') counts.cripto++;
      else if (cat === 'Acciones') counts.acciones++;
      else if (cat === 'Índices') counts.indices++;
      else if (cat === 'Bonos') counts.bonos++;
    });
    return counts;
  }, [datosScreener]);

  const resumenCategorias = useMemo(() => {
    return [
      {
        id: 'cripto',
        titulo: 'Criptomonedas',
        subtitulo: 'USDT, BTC, ETH, SOL...',
        path: '/cripto',
        icono: Coins,
        cantidad: conteosPorCategoria.cripto,
        colorBadge: 'bg-orange-100 text-orange-800 border-orange-200',
        iconoColor: 'text-orange-600',
        bgHover: 'hover:border-orange-300'
      },
      {
        id: 'acciones',
        titulo: 'Acciones & ETFs',
        subtitulo: 'Wall Street, ETFs Dividendos & BYMA',
        path: '/acciones',
        icono: Building2,
        cantidad: conteosPorCategoria.acciones,
        colorBadge: 'bg-blue-100 text-blue-800 border-blue-200',
        iconoColor: 'text-blue-600',
        bgHover: 'hover:border-blue-300'
      },
      {
        id: 'indices',
        titulo: 'Índices',
        subtitulo: 'S&P 500, QQQ, Dow, Merval',
        path: '/indices',
        icono: BarChart3,
        cantidad: conteosPorCategoria.indices,
        colorBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        iconoColor: 'text-emerald-600',
        bgHover: 'hover:border-emerald-300'
      },
      {
        id: 'bonos',
        titulo: 'Bonos',
        subtitulo: 'Bonar 2030, Global 2030, TLT',
        path: '/bonos',
        icono: Landmark,
        cantidad: conteosPorCategoria.bonos,
        colorBadge: 'bg-purple-100 text-purple-800 border-purple-200',
        iconoColor: 'text-purple-600',
        bgHover: 'hover:border-purple-300'
      }
    ];
  }, [conteosPorCategoria]);

  return (
    <div className="space-y-6">
      {/* =========================================================================
          SECCIÓN 1: KPI CARDS GERENCIALES
      ========================================================================== */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Activo Top CondorScore */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-sm transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono mb-2">
            <span className="flex items-center gap-1.5 font-bold text-slate-700">
              <Sparkles className="w-4 h-4 text-orange-500" />
              TOP CONDORSCORE
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {mejorActivo?.dictamen || 'STRONG_BUY'}
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2 mt-2">
            <div>
              <span className="text-2xl font-black font-mono text-slate-900 tracking-tight">
                {mejorActivo?.activo || 'ETH'}
              </span>
              <p className="text-xs text-slate-500 font-sans truncate">
                {mejorActivo?.nombre || 'Ethereum (Cripto ARS)'}
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black font-mono text-emerald-600">
                {mejorActivo?.condorScore ?? 99}
                <span className="text-xs font-mono text-slate-400">/100</span>
              </span>
              <p className="text-[10px] font-mono text-slate-400">Puntaje Algorítmico</p>
            </div>
          </div>

          {/* Barra de progreso de Score */}
          <div className="mt-3.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${mejorActivo?.condorScore || 99}%` }}
            ></div>
          </div>
        </div>

        {/* Card 2: Sentimiento General del Mercado */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-sm transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono mb-2">
            <span className="flex items-center gap-1.5 font-bold text-slate-700">
              <Activity className="w-4 h-4 text-cyan-500" />
              SENTIMIENTO GLOBAL
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
              {metricasMercado.porcentajeBullish >= 50 ? 'BULLISH' : 'BEARISH'}
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2 mt-2">
            <span className="text-2xl font-black font-mono text-slate-900 tracking-tight">
              {metricasMercado.porcentajeBullish}%
            </span>
            <span className="text-xs font-mono text-slate-500">
              {metricasMercado.alcistas} Alcistas / {metricasMercado.bajistas} Bajistas
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-1">
            Distribución sobre los 41 activos analizados con SMA y MACD.
          </p>

          <div className="mt-3.5 flex h-1.5 w-full rounded-full overflow-hidden bg-slate-100">
            <div
              className="bg-emerald-500 transition-all duration-500"
              style={{ width: `${metricasMercado.porcentajeBullish}%` }}
            ></div>
            <div
              className="bg-rose-500 transition-all duration-500"
              style={{ width: `${100 - metricasMercado.porcentajeBullish}%` }}
            ></div>
          </div>
        </div>

        {/* Card 3: Puntaje Medio del Enjambre */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-sm transition">
          <div className="flex items-center justify-between text-slate-500 text-xs font-mono mb-2">
            <span className="flex items-center gap-1.5 font-bold text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              SCORE PROMEDIO
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {datosScreener.length} Activos
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2 mt-2">
            <span className="text-2xl font-black font-mono text-slate-900 tracking-tight">
              {metricasMercado.scorePromedio}
              <span className="text-xs font-mono text-slate-400">/100</span>
            </span>
            <span className="text-xs font-mono font-bold text-emerald-600 flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5" />
              {metricasMercado.strongBuyCount} Strong Buy
            </span>
          </div>

          <p className="text-xs text-slate-500 mt-1">
            Salud integral calculada mediante RSI(14) y Bandas de Bollinger.
          </p>

          <div className="mt-3.5 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-orange-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${metricasMercado.scorePromedio}%` }}
            ></div>
          </div>
        </div>

        {/* Card 4: Disparador del Motor Cuantitativo */}
        <div className="bg-gradient-to-br from-slate-900 to-[#0A0D14] p-5 rounded-2xl border border-slate-800 text-white shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono mb-2">
            <span className="flex items-center gap-1.5 text-orange-400 font-bold">
              <Zap className="w-4 h-4 text-orange-400 animate-pulse" />
              MOTOR QUANT SWARM
            </span>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
              Serverless
            </span>
          </div>

          <div>
            <p className="text-xs text-slate-300 font-mono leading-relaxed">
              Ejecución paralela concurrente de modelos estadísticos sobre todo el universo.
            </p>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              onClick={onEjecutarAnalisis}
              disabled={estaCargando}
              className="w-full py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-mono text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Zap className={`w-3.5 h-3.5 ${estaCargando ? 'animate-spin' : ''}`} />
              <span>{estaCargando ? 'Calculando...' : 'Re-Calcular Modelos'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECCIÓN 2: ACCESOS DIRECTOS A LAS 4 VISTAS DE MERCADO (TABS SPA)
      ========================================================================== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold font-mono text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <span>Mercados Institucionales</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
              4 Categorías
            </span>
          </h2>
          <span className="text-xs font-mono text-slate-500">
            Navegación instantánea sin recarga de página
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {resumenCategorias.map(cat => {
            const Icon = cat.icono;
            return (
              <Link
                key={cat.id}
                to={cat.path}
                className={`bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all duration-200 group cursor-pointer ${cat.bgHover}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2.5 rounded-xl bg-slate-50 border border-slate-100 group-hover:scale-110 transition duration-150 ${cat.iconoColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${cat.colorBadge}`}>
                    {cat.cantidad} Activos
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 group-hover:text-orange-600 transition">
                  {cat.titulo}
                </h3>
                <p className="text-xs text-slate-500 font-sans mt-0.5 truncate">
                  {cat.subtitulo}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-mono text-slate-500 group-hover:text-orange-600 font-semibold">
                  <span>Abrir Terminal</span>
                  <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* =========================================================================
          SECCIÓN 3: MINIGRÁFICO GLOBAL DE CONDORSCORE (MOMENTUM INSTITUCIONAL)
      ========================================================================== */}
      <section className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 font-mono flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-orange-600" />
              Distribución de CondorScore (Top Activos del Mercado)
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Visualización comparativa de los activos con mayor fortaleza estadística
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Escala 0 a 100 • Umbral Favorable &gt; 70
          </span>
        </div>

        <div className="h-64 w-full">
          {datosGraficoTop.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datosGraficoTop} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="ticker"
                  tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={{ stroke: '#E2E8F0' }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'monospace' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 bg-slate-900 text-white rounded-xl shadow-xl text-xs font-mono border border-slate-800">
                          <p className="font-bold text-orange-400 text-sm mb-1">{data.ticker}</p>
                          <p>CondorScore: <strong className="text-white">{data.score}/100</strong></p>
                          <p>RSI (14): <strong className="text-slate-300">{data.rsi}</strong></p>
                          <p>Dictamen: <strong className="text-emerald-400">{data.dictamen}</strong></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                  {datosGraficoTop.map((entry, index) => {
                    const color = entry.score >= 70 ? '#10B981' : entry.score >= 40 ? '#F59E0B' : '#EF4444';
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs font-mono text-slate-400">
              Cargando modelos estadísticos...
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          SECCIÓN 4: RADAR DE INSIGHTS QUANTS (FEED DE ALERTAS EN VIVO)
      ========================================================================== */}
      <section className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-50 border border-orange-200 text-orange-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-mono flex items-center gap-2">
                Radar de Insights Quants & Alertas en Vivo
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                  {alertas.length} Detecciones
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Alertas generadas por /api/generar-insights sobre SMA, Desviación Estándar, RSI y MACD
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Tabla: alertas_mercado</span>
          </div>
        </div>

        <div className="p-5">
          {alertas && alertas.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {alertas.slice(0, 6).map((alerta, idx) => {
                const esOportunidadAlta =
                  alerta.tipo_alerta === 'OPORTUNIDAD_ALTA' || alerta.tipo_alerta === 'STRONG_BUY';
                const esVolatilidad = alerta.tipo_alerta === 'VOLATILIDAD_EXTREMA';
                return (
                  <div
                    key={alerta.id || idx}
                    className={`p-4 rounded-xl border transition-all hover:shadow-xs ${
                      esOportunidadAlta
                        ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300'
                        : esVolatilidad
                        ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                        : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                          esOportunidadAlta
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : esVolatilidad
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-cyan-100 text-cyan-800 border-cyan-200'
                        }`}
                      >
                        {alerta.tipo_alerta || 'ALERTA_QUANT'}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {alerta.timestamp
                          ? new Date(alerta.timestamp).toLocaleTimeString('es-AR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Reciente'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono font-bold text-slate-900 text-xs px-2 py-0.5 rounded bg-white border border-slate-200 shadow-2xs">
                        {alerta.moneda || alerta.ticker || 'USDT/ARS'}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        Spread:{' '}
                        <strong className="text-slate-900">
                          {alerta.spread ? `${alerta.spread}%` : 'N/A'}
                        </strong>
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-mono leading-relaxed">
                      {alerta.mensaje || 'Detección estadística por encima del umbral institucional.'}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center rounded-xl bg-slate-50/70 border border-dashed border-slate-200">
              <div className="inline-flex p-3 rounded-full bg-white border border-slate-200 text-orange-600 mb-2 shadow-2xs">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <h4 className="text-xs font-bold text-slate-800 font-mono">
                Analizando mercado en busca de anomalías estadísticas...
              </h4>
              <p className="text-[11px] text-slate-400 font-mono mt-1 max-w-md mx-auto">
                El motor de insights monitorea cotizaciones históricas y alertas en tiempo real con SMA y bandas de dispersión.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
