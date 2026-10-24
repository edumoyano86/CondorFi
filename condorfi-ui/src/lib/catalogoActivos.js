/**
 * ==============================================================================
 * CondorFi - Catálogo Maestro Universal de Activos Financieros
 * Archivo: condorfi-ui/src/lib/catalogoActivos.js
 * 
 * Fuente única de verdad para el Frontend y Backend.
 * Cero truncamiento: Cada símbolo está tipeado explícitamente sin puntos suspensivos.
 * ==============================================================================
 */

// 1. ÍNDICES FINANCIEROS GLOBALES (EXACTAMENTE 100 TICKERS EXPLÍCITOS)
export const INDICES_GLOBALES = [
  '^GSPC', 'SPY', 'IVV', 'VOO', 'VTI', '^NDX', 'QQQ', 'QQQM', '^DJI', 'DIA',
  '^RUT', 'IWM', 'IWO', 'IWN', 'MDY', 'IJH', '^W5000', '^VIX', 'VXX', 'UVXY',
  'XLK', 'VGT', 'XLF', 'VFH', 'XLE', 'VDE', 'XLV', 'VHT', 'XLI', 'VIS',
  'XLY', 'VCR', 'XLP', 'VDC', 'XLU', 'VPU', 'XLB', 'VAW', 'XLRE', 'VNQ',
  'XLC', 'VOX', 'SMH', 'SOXX', 'IBB', 'XBI', 'KRE', 'KBE', 'XHB', 'ITB',
  'XRT', 'XME', 'GDX', 'GDXJ', 'XOP', 'OIH', 'TAN', 'ICLN', 'BOTZ', 'AIQ',
  'HACK', 'CIBR', 'IGV', 'JETS', 'ARKK', '^MERV', 'ARGT', '^FTSE', 'EWU', '^GDAXI',
  'EWG', '^FCHI', 'EWQ', '^N225', 'EWJ', '^HSI', 'FXI', 'MCHI', '^STOXX50E', 'FEZ',
  '^IBEX', 'EWP', '^BVSP', 'EWZ', 'EEM', 'VWO', 'EFA', 'VEA', 'INDA', 'EPI',
  'EWY', 'EWT', 'EWA', 'EWC', 'EWW', 'GLD', 'SLV', 'USO', 'DBC', 'BND'
];

export const TRADFI_INDICES_100 = INDICES_GLOBALES;

// 2. ETFS ESTRATÉGICOS (EXACTAMENTE 16 TICKERS EXPLÍCITOS)
export const ETFS_ESTRATEGICOS = [
  'VIG',
  'SCHD',
  'JEPI',
  'JEPQ',
  'VYM',
  'DGRO',
  'NOBL',
  'QQQM',
  'HDV',
  'SPYD',
  'DVY',
  'SDY',
  'COWZ',
  'DIVO',
  'MOAT',
  'BST'
];

// 3. ACCIONES TECH & MEGA-CAP (EXACTAMENTE 100 TICKERS EXPLÍCITOS)
export const ACCIONES_TECH = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'GOOG', 'META', 'TSLA', 'AVGO', 'NFLX',
  'AMD', 'QCOM', 'TXN', 'INTC', 'AMAT', 'MU', 'LRCX', 'KLAC', 'MRVL', 'ADI',
  'NXPI', 'MCHP', 'ON', 'ASML', 'ARM', 'TSM', 'MPWR', 'SWKS', 'QRVO', 'SMCI',
  'ORCL', 'CRM', 'ADBE', 'NOW', 'INTU', 'SNOW', 'WDAY', 'PLTR', 'TEAM', 'DDOG',
  'MDB', 'ZS', 'CRWD', 'PANW', 'FTNT', 'NET', 'OKTA', 'SPLK', 'ANSS', 'CDNS',
  'IBM', 'CSCO', 'DELL', 'HPE', 'ANET', 'SNPS', 'VRSN', 'AKAM', 'NTAP', 'WDC',
  'STX', 'CIEN', 'KEYS', 'FFIV', 'JNPR', 'UBER', 'ABNB', 'DASH', 'COIN', 'SHOP',
  'MELI', 'SE', 'PYPL', 'SQ', 'HOOD', 'V', 'MA', 'AFRM', 'SOFI', 'ROKU',
  'SPOT', 'PINS', 'SNAP', 'TTD', 'APP', 'ISRG', 'DXCM', 'ILMN', 'VRTX', 'REGN',
  'BIIB', 'ALNY', 'CRSP', 'RIVN', 'LCID', 'TTWO', 'EA', 'RBLX', 'PATH', 'SYM'
];

export const TRADFI_GLOBAL = ACCIONES_TECH;

// 4. CEDEARS DE BYMA (MERCADO ARGENTINO - EN PESOS ARS CON CCL IMPLÍCITO)
export const CEDEARS_BYMA = [
  'VIG.BA', 'SPY.BA', 'QQQ.BA', 'DIA.BA', 'IWM.BA', 'EEM.BA', 'EWZ.BA', 'ARKK.BA',
  'AAPL.BA', 'MSFT.BA', 'NVDA.BA', 'AMZN.BA', 'GOOGL.BA', 'META.BA', 'TSLA.BA',
  'KO.BA', 'MELI.BA', 'MCD.BA', 'DIS.BA', 'WMT.BA', 'JNJ.BA', 'PG.BA', 'XOM.BA',
  'CVX.BA', 'BABA.BA', 'GLOB.BA', 'VIST.BA', 'PBR.BA', 'VALE.BA', 'AMD.BA',
  'INTC.BA', 'QCOM.BA', 'CRM.BA', 'ADBE.BA', 'NFLX.BA', 'PYPL.BA', 'COIN.BA',
  'SHOP.BA', 'UBER.BA', 'ABNB.BA', 'GOLD.BA', 'XLE.BA', 'XLF.BA', 'XLK.BA',
  'DESP.BA', 'BIOX.BA', 'BBD.BA', 'ITUB.BA', 'MOAT.BA', 'VYM.BA', 'SCHD.BA'
];

export const NOMBRES_CEDEARS = {
  'VIG.BA': 'CEDEAR Vanguard Dividend Appreciation',
  'SPY.BA': 'CEDEAR S&P 500 ETF Trust',
  'QQQ.BA': 'CEDEAR Invesco NASDAQ 100',
  'DIA.BA': 'CEDEAR SPDR Dow Jones Industrial',
  'IWM.BA': 'CEDEAR iShares Russell 2000',
  'EEM.BA': 'CEDEAR iShares MSCI Emerging Markets',
  'EWZ.BA': 'CEDEAR iShares MSCI Brazil',
  'ARKK.BA': 'CEDEAR ARK Innovation ETF',
  'AAPL.BA': 'CEDEAR Apple Inc.',
  'MSFT.BA': 'CEDEAR Microsoft Corporation',
  'NVDA.BA': 'CEDEAR NVIDIA Corporation',
  'AMZN.BA': 'CEDEAR Amazon.com Inc.',
  'GOOGL.BA': 'CEDEAR Alphabet Inc. (Google)',
  'META.BA': 'CEDEAR Meta Platforms Inc.',
  'TSLA.BA': 'CEDEAR Tesla Inc.',
  'KO.BA': 'CEDEAR The Coca-Cola Company',
  'MELI.BA': 'CEDEAR MercadoLibre Inc.',
  'MCD.BA': "CEDEAR McDonald's Corporation",
  'DIS.BA': 'CEDEAR The Walt Disney Company',
  'WMT.BA': 'CEDEAR Walmart Inc.',
  'JNJ.BA': 'CEDEAR Johnson & Johnson',
  'PG.BA': 'CEDEAR Procter & Gamble',
  'XOM.BA': 'CEDEAR ExxonMobil Corporation',
  'CVX.BA': 'CEDEAR Chevron Corporation',
  'BABA.BA': 'CEDEAR Alibaba Group',
  'GLOB.BA': 'CEDEAR Globant S.A.',
  'VIST.BA': 'CEDEAR Vista Energy S.A.B.',
  'PBR.BA': 'CEDEAR Petrobras Petróleo Brasileiro',
  'VALE.BA': 'CEDEAR Vale S.A.',
  'AMD.BA': 'CEDEAR Advanced Micro Devices',
  'INTC.BA': 'CEDEAR Intel Corporation',
  'QCOM.BA': 'CEDEAR Qualcomm Inc.',
  'CRM.BA': 'CEDEAR Salesforce Inc.',
  'ADBE.BA': 'CEDEAR Adobe Inc.',
  'NFLX.BA': 'CEDEAR Netflix Inc.',
  'PYPL.BA': 'CEDEAR PayPal Holdings',
  'COIN.BA': 'CEDEAR Coinbase Global',
  'SHOP.BA': 'CEDEAR Shopify Inc.',
  'UBER.BA': 'CEDEAR Uber Technologies',
  'ABNB.BA': 'CEDEAR Airbnb Inc.',
  'GOLD.BA': 'CEDEAR Barrick Gold Corporation',
  'XLE.BA': 'CEDEAR Energy Select Sector SPDR',
  'XLF.BA': 'CEDEAR Financial Select Sector SPDR',
  'XLK.BA': 'CEDEAR Technology Select Sector SPDR',
  'SCHD.BA': 'CEDEAR Schwab U.S. Dividend Equity',
  'MOAT.BA': 'CEDEAR VanEck Morningstar Wide Moat',
  'VYM.BA': 'CEDEAR Vanguard High Dividend Yield'
};

export const TRADFI_ARG_BONOS = [
  '^MERV', 'GGAL.BA', 'YPFD.BA', 'PAMP.BA', 'BMA.BA', 'CEPU.BA', 'TXAR.BA', 'ALUA.BA',
  'CRES.BA', 'EDN.BA', 'LOMA.BA', 'MIRG.BA', 'TECO2.BA', 'TGNO4.BA', 'TGSU2.BA', 'TRAN.BA', 'VALO.BA', 'BYMA.BA',
  ...CEDEARS_BYMA,
  'MELI', 'VIST', 'YPF', 'GLOB', 'BBD', 'ITUB', 'VALE', 'PBR',
  'AL30.BA', 'GD30.BA', 'AL35.BA', 'GD35.BA', 'AE38.BA', 'GD38.BA', 'AL29.BA', 'GD29.BA', 'TLT'
];

export const BONOS_TICKERS = [
  'AL30.BA', 'GD30.BA', 'AL35.BA', 'GD35.BA', 'AE38.BA', 'GD38.BA', 'AL29.BA', 'GD29.BA',
  'TLT', 'IEF', 'SHY', 'BND', 'AGG', 'LQD', 'HYG'
];

export const TOP_CRIPTO = [
  'USDT', 'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOGE', 'LINK',
  'DOT', 'MATIC', 'SHIB', 'LTC', 'UNI', 'ATOM', 'NEAR', 'ARB', 'OP', 'INJ',
  'TON', 'TRX', 'BCH', 'ETC', 'FIL'
];

/**
 * Genera el universo de contingencia inicial para el Screener.
 * Garantiza que desde el primer render, los contadores de Índices y Acciones
 * reflejen la totalidad del universo (100 activos en cada uno) sin esperar la red.
 */
export function generarScreenerInicialCompleto() {
  const activos = [];

  // Índices Globales (100)
  INDICES_GLOBALES.forEach((ticker, idx) => {
    activos.push({
      activo: ticker,
      ticker,
      nombre: ticker.startsWith('^') ? `Índice ${ticker}` : `${ticker} Benchmark ETF`,
      mercado: 'Índices',
      tipoMercado: 'indices',
      subTipo: 'indices_globales',
      moneda: (ticker === '^MERV' || ticker.endsWith('.BA')) ? 'ARS' : 'USD',
      precioActual: ticker.startsWith('^') ? 5000 + idx * 50 : 250 + (idx % 20) * 10,
      precioApertura: ticker.startsWith('^') ? 4980 + idx * 50 : 249 + (idx % 20) * 10,
      variacion24h: Number((0.25 + (idx % 5) * 0.15 - 0.30).toFixed(2)),
      condorScore: 70 + (idx % 25),
      dictamen: (idx % 3 === 0) ? 'BUY' : 'HOLD',
      alineacion_temporal: 'ALINEADO_ALCISTA',
      rsi: Number((45 + (idx % 20)).toFixed(1)),
      macd: { macd: 1.2, signal: 0.9, histogram: 0.3, cruceAlcista: true, cruceBajista: false },
      bollinger: { sma: 250, upper: 260, lower: 240, bandwidth: 4.0, percentB: 0.55 },
      mensaje: `Seguimiento cuantitativo de benchmark global (${ticker})`
    });
  });

  // Acciones Tech & Mega-Cap (100)
  ACCIONES_TECH.forEach((ticker, idx) => {
    activos.push({
      activo: ticker,
      ticker,
      nombre: `${ticker} Inc.`,
      mercado: 'Acciones',
      tipoMercado: 'acciones',
      subTipo: 'acciones_tech',
      moneda: 'USD',
      precioActual: 150 + (idx % 30) * 12,
      precioApertura: 149 + (idx % 30) * 12,
      variacion24h: Number((0.50 + (idx % 7) * 0.20 - 0.40).toFixed(2)),
      condorScore: 65 + (idx % 30),
      dictamen: (idx % 2 === 0) ? 'BUY' : 'HOLD',
      alineacion_temporal: 'ALINEADO_ALCISTA',
      rsi: Number((50 + (idx % 18)).toFixed(1)),
      macd: { macd: 2.1, signal: 1.5, histogram: 0.6, cruceAlcista: true, cruceBajista: false },
      bollinger: { sma: 150, upper: 158, lower: 142, bandwidth: 5.3, percentB: 0.60 },
      mensaje: `Seguimiento institucional de renta variable (${ticker})`
    });
  });

  // ETFs Estratégicos (16)
  ETFS_ESTRATEGICOS.forEach((ticker, idx) => {
    activos.push({
      activo: ticker,
      ticker,
      nombre: `${ticker} Dividend ETF`,
      mercado: 'Acciones',
      tipoMercado: 'acciones',
      subTipo: 'etfs_estrategicos',
      moneda: 'USD',
      precioActual: 80 + idx * 7,
      precioApertura: 79.5 + idx * 7,
      variacion24h: 0.45,
      condorScore: 85,
      dictamen: 'STRONG_BUY',
      alineacion_temporal: 'ALINEADO_ALCISTA',
      rsi: 58.0,
      macd: { macd: 0.8, signal: 0.5, histogram: 0.3, cruceAlcista: true, cruceBajista: false },
      bollinger: { sma: 80, upper: 84, lower: 76, bandwidth: 3.5, percentB: 0.70 },
      mensaje: `Estrategia de dividendos y cobertura (${ticker})`
    });
  });

  return activos;
}
