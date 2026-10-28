-- ==============================================================================
-- CondorFi - Esquema de Base de Datos (Supabase / PostgreSQL)
-- Fase 2: Registro histórico de cotizaciones de criptomonedas
-- ==============================================================================

-- 1. Crear tabla cotizaciones_historicas
CREATE TABLE IF NOT EXISTS public.cotizaciones_historicas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    moneda VARCHAR(20) NOT NULL,
    exchange VARCHAR(50) NOT NULL,
    precio_compra NUMERIC(16, 4) NOT NULL,
    precio_venta NUMERIC(16, 4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Índices de alto rendimiento para analítica, RAG y detección de arbitraje
CREATE INDEX IF NOT EXISTS idx_cotizaciones_exchange_moneda_timestamp 
    ON public.cotizaciones_historicas (exchange, moneda, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_timestamp 
    ON public.cotizaciones_historicas (timestamp DESC);

-- 3. Configuración de Políticas de Seguridad (Row Level Security - RLS)
ALTER TABLE public.cotizaciones_historicas ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserción de datos (usando anon o service_role key)
CREATE POLICY "Permitir insercion de cotizaciones" 
    ON public.cotizaciones_historicas 
    FOR INSERT 
    TO anon, authenticated, service_role
    WITH CHECK (true);

-- Política para lectura de cotizaciones
CREATE POLICY "Permitir lectura de cotizaciones" 
    ON public.cotizaciones_historicas 
    FOR SELECT 
    TO anon, authenticated, service_role
    USING (true);

-- ==============================================================================
-- Fase Institucional (Sprint 1): Cartera Activa y Gestor de Portafolio
-- Tabla: cartera_activa
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.cartera_activa (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    ticker VARCHAR(30) NOT NULL,
    tipo_mercado VARCHAR(20) NOT NULL DEFAULT 'tradfi', -- 'cripto', 'tradfi', 'acciones', 'indices', 'bonos'
    cantidad NUMERIC(24, 8) NOT NULL,
    precio_compra_promedio NUMERIC(18, 4) NOT NULL,
    moneda VARCHAR(10) NOT NULL DEFAULT 'USD',          -- 'USD' | 'ARS'
    fecha_ingreso TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Script de migración en caliente si la tabla ya existe sin la columna user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'cartera_activa' 
          AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.cartera_activa 
        ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
    END IF;
END $$;

-- Índices de alto rendimiento para búsqueda y agregación de portafolio por usuario
CREATE INDEX IF NOT EXISTS idx_cartera_activa_user_id 
    ON public.cartera_activa (user_id);

CREATE INDEX IF NOT EXISTS idx_cartera_activa_ticker 
    ON public.cartera_activa (ticker);

CREATE INDEX IF NOT EXISTS idx_cartera_activa_tipo_mercado 
    ON public.cartera_activa (tipo_mercado);

CREATE INDEX IF NOT EXISTS idx_cartera_activa_fecha_ingreso 
    ON public.cartera_activa (fecha_ingreso DESC);

-- Habilitar Row Level Security (RLS) estricto
ALTER TABLE public.cartera_activa ENABLE ROW LEVEL SECURITY;

-- Limpieza preventiva de políticas previas para evitar colisiones
DROP POLICY IF EXISTS "Permitir lectura de cartera_activa" ON public.cartera_activa;
DROP POLICY IF EXISTS "Permitir insercion en cartera_activa" ON public.cartera_activa;
DROP POLICY IF EXISTS "Permitir actualizacion en cartera_activa" ON public.cartera_activa;
DROP POLICY IF EXISTS "Permitir eliminacion en cartera_activa" ON public.cartera_activa;
DROP POLICY IF EXISTS "Los usuarios pueden ver sus propias posiciones" ON public.cartera_activa;
DROP POLICY IF EXISTS "Los usuarios pueden insertar sus propias posiciones" ON public.cartera_activa;
DROP POLICY IF EXISTS "Los usuarios pueden actualizar sus propias posiciones" ON public.cartera_activa;
DROP POLICY IF EXISTS "Los usuarios pueden eliminar sus propias posiciones" ON public.cartera_activa;

-- Políticas RLS Institucionales Multi-Tenant (Supabase Auth):
-- 1. SELECT: Cada usuario autenticado solo puede leer sus propias posiciones (o demo públicas con user_id IS NULL)
CREATE POLICY "Los usuarios pueden ver sus propias posiciones" 
    ON public.cartera_activa 
    FOR SELECT 
    TO authenticated, anon, service_role
    USING (auth.uid() = user_id OR user_id IS NULL);

-- 2. INSERT: Solo puede insertar si user_id coincide con su auth.uid()
CREATE POLICY "Los usuarios pueden insertar sus propias posiciones" 
    ON public.cartera_activa 
    FOR INSERT 
    TO authenticated, service_role
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 3. UPDATE: Solo puede modificar sus propias posiciones
CREATE POLICY "Los usuarios pueden actualizar sus propias posiciones" 
    ON public.cartera_activa 
    FOR UPDATE 
    TO authenticated, service_role
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. DELETE: Solo puede eliminar sus propias posiciones
CREATE POLICY "Los usuarios pueden eliminar sus propias posiciones" 
    ON public.cartera_activa 
    FOR DELETE 
    TO authenticated, service_role
    USING (auth.uid() = user_id);

-- Datos semilla institucionales iniciales para demostración inmediata
INSERT INTO public.cartera_activa (ticker, tipo_mercado, cantidad, precio_compra_promedio, moneda, fecha_ingreso)
VALUES 
    ('BTC',     'cripto',   0.25000000, 126500000.0000, 'ARS', NOW() - INTERVAL '15 days'),
    ('ETH',     'cripto',   3.20000000,   3780000.0000, 'ARS', NOW() - INTERVAL '12 days'),
    ('SPY',     'tradfi',  18.00000000,       745.5000, 'USD', NOW() - INTERVAL '30 days'),
    ('NVDA',    'tradfi',  35.00000000,       208.2000, 'USD', NOW() - INTERVAL '20 days'),
    ('AL30.BA', 'tradfi', 4500.00000000,       712.0000, 'ARS', NOW() - INTERVAL '18 days'),
    ('GGAL.BA', 'tradfi',  800.00000000,      5620.0000, 'ARS', NOW() - INTERVAL '8 days')
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- Fase Institucional (Sprint 2): Creador Visual de Estrategias Quants (Query Builder)
-- Tabla: estrategias_personalizadas
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.estrategias_personalizadas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT,
    reglas_json JSONB NOT NULL,
    activa BOOLEAN NOT NULL DEFAULT false,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de alto rendimiento para búsqueda y filtrado de estrategias activas
CREATE INDEX IF NOT EXISTS idx_estrategias_activa 
    ON public.estrategias_personalizadas (activa);

CREATE INDEX IF NOT EXISTS idx_estrategias_fecha_creacion 
    ON public.estrategias_personalizadas (fecha_creacion DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.estrategias_personalizadas ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad para operaciones completas de Estrategias
CREATE POLICY "Permitir lectura de estrategias_personalizadas" 
    ON public.estrategias_personalizadas 
    FOR SELECT 
    TO anon, authenticated, service_role
    USING (true);

CREATE POLICY "Permitir insercion en estrategias_personalizadas" 
    ON public.estrategias_personalizadas 
    FOR INSERT 
    TO anon, authenticated, service_role
    WITH CHECK (true);

CREATE POLICY "Permitir actualizacion en estrategias_personalizadas" 
    ON public.estrategias_personalizadas 
    FOR UPDATE 
    TO anon, authenticated, service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Permitir eliminacion en estrategias_personalizadas" 
    ON public.estrategias_personalizadas 
    FOR DELETE 
    TO anon, authenticated, service_role
    USING (true);

-- Semilla de estrategias cuantitativas predeterminadas
INSERT INTO public.estrategias_personalizadas (nombre, descripcion, reglas_json, activa)
VALUES 
(
    'Mean Reversion Institucional (RSI + BB)',
    'Estrategia de compra en sobreventa extrema con soporte en banda inferior de Bollinger y confirmación de momentum positivo.',
    '[
        { "indicador": "RSI", "operador": "<", "valor": 30 },
        { "operadorLogico": "AND" },
        { "indicador": "BOLLINGER_PERCENT_B", "operador": "<=", "valor": 0.20 },
        { "operadorLogico": "AND" },
        { "indicador": "MACD_HIST", "operador": ">", "valor": 0 }
    ]'::jsonb,
    true
),
(
    'Breakout de Volatilidad (Precio > SMA20)',
    'Estrategia de impulso que busca rupturas al alza de la media móvil SMA 20 con RSI en zona media de aceleración.',
    '[
        { "indicador": "PRECIO_VS_SMA20", "operador": ">", "valor": 0.5 },
        { "operadorLogico": "AND" },
        { "indicador": "MACD_HIST", "operador": ">", "valor": 0 },
        { "operadorLogico": "AND" },
        { "indicador": "RSI", "operador": "<", "valor": 65 }
    ]'::jsonb,
    false
)
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- Fase Institucional: Historial de Alertas Cuantitativas MTFA
-- Tabla: alertas_historial
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.alertas_historial (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker VARCHAR(30) NOT NULL,
    tipo_alerta VARCHAR(40) NOT NULL, -- 'COMPRA_SOBREVENTA', 'VENTA_SOBRECOMPRA', 'TAKE_PROFIT', 'STOP_LOSS'
    rsi_1d NUMERIC(8, 2),
    rsi_1h NUMERIC(8, 2),
    precio_actual NUMERIC(18, 4) NOT NULL,
    moneda VARCHAR(10) NOT NULL DEFAULT 'USD',
    mensaje TEXT NOT NULL,
    leida BOOLEAN NOT NULL DEFAULT false,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de consulta rápida para notificaciones
CREATE INDEX IF NOT EXISTS idx_alertas_historial_user_id 
    ON public.alertas_historial (user_id);

CREATE INDEX IF NOT EXISTS idx_alertas_historial_timestamp 
    ON public.alertas_historial (timestamp DESC);

-- Habilitar RLS en historial de alertas
ALTER TABLE public.alertas_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver sus propias alertas o publicas"
    ON public.alertas_historial
    FOR SELECT
    TO authenticated, anon, service_role
    USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Permitir insercion de alertas"
    ON public.alertas_historial
    FOR INSERT
    TO authenticated, anon, service_role
    WITH CHECK (true);

CREATE POLICY "Permitir actualizar leida"
    ON public.alertas_historial
    FOR UPDATE
    TO authenticated, service_role
    USING (auth.uid() = user_id OR user_id IS NULL);



