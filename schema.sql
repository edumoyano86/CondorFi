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
