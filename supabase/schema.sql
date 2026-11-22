-- ============================================================================
-- ESQUEMA DE BASE DE DATOS - PELUQUERÍA BOUTIQUE DE LUJO
-- Ejecutar en el SQL Editor de Supabase (Etapa 1 - Parte 1)
-- ============================================================================

-- Habilitar extensión para generación de UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABLAS PRINCIPALES
-- ============================================================================

-- Perfiles de acceso administrativo vinculados a Supabase Auth
CREATE TABLE public.perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'admin' CHECK (rol IN ('admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categorías del catálogo de servicios
CREATE TABLE public.categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL UNIQUE,
    orden INT NOT NULL DEFAULT 0,
    activa BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Servicios ofrecidos por el salón
CREATE TABLE public.servicios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria_id UUID NOT NULL REFERENCES public.categorias(id) ON DELETE RESTRICT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    precio NUMERIC(10, 2) NOT NULL CHECK (precio >= 0),
    duracion_min INT NOT NULL CHECK (duracion_min > 0),
    imagen_url TEXT,
    orden INT NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Equipo de estilistas y especialistas
CREATE TABLE public.peluqueros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    foto_url TEXT,
    especialidad TEXT,
    bio TEXT,
    telefono TEXT,
    comision_pct NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (comision_pct >= 0 AND comision_pct <= 100),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Relación muchos a muchos entre estilistas y servicios que realizan
CREATE TABLE public.peluquero_servicios (
    peluquero_id UUID NOT NULL REFERENCES public.peluqueros(id) ON DELETE CASCADE,
    servicio_id UUID NOT NULL REFERENCES public.servicios(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (peluquero_id, servicio_id)
);

-- Disponibilidad semanal base por estilista (0 = Domingo, 1 = Lunes ... 6 = Sábado)
CREATE TABLE public.horarios_peluquero (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    peluquero_id UUID NOT NULL REFERENCES public.peluqueros(id) ON DELETE CASCADE,
    dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_horario_valido CHECK (hora_fin > hora_inicio),
    CONSTRAINT uq_peluquero_dia UNIQUE (peluquero_id, dia_semana)
);

-- Base de datos de clientes
CREATE TABLE public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    telefono TEXT NOT NULL,
    email TEXT,
    notas TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clientes_telefono ON public.clientes(telefono);
CREATE INDEX idx_clientes_email ON public.clientes(email);

-- Agenda de citas
CREATE TABLE public.citas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
    servicio_id UUID NOT NULL REFERENCES public.servicios(id) ON DELETE RESTRICT,
    peluquero_id UUID NOT NULL REFERENCES public.peluqueros(id) ON DELETE RESTRICT,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'completada', 'cancelada')),
    precio_cobrado NUMERIC(10, 2) CHECK (precio_cobrado >= 0),
    metodo_pago TEXT CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia', 'otro')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_cita_horas CHECK (hora_fin > hora_inicio)
);

CREATE INDEX idx_citas_fecha_peluquero ON public.citas(fecha, peluquero_id);
CREATE INDEX idx_citas_estado ON public.citas(estado);

-- Libro de ingresos
CREATE TABLE public.ingresos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cita_id UUID UNIQUE REFERENCES public.citas(id) ON DELETE SET NULL,
    concepto TEXT NOT NULL,
    monto NUMERIC(10, 2) NOT NULL CHECK (monto >= 0),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    metodo_pago TEXT NOT NULL DEFAULT 'efectivo' CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia', 'otro')),
    peluquero_id UUID REFERENCES public.peluqueros(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ingresos_fecha ON public.ingresos(fecha);

-- Libro de gastos operativos
CREATE TABLE public.gastos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria TEXT NOT NULL,
    concepto TEXT NOT NULL,
    monto NUMERIC(10, 2) NOT NULL CHECK (monto >= 0),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    nota TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gastos_fecha ON public.gastos(fecha);

-- Configuración general del negocio (clave-valor)
CREATE TABLE public.configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. TRIGGER: REGISTRAR INGRESO AUTOMÁTICO AL COMPLETAR UNA CITA
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_registrar_ingreso_cita_completada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_nombre_servicio TEXT;
    v_precio_servicio NUMERIC(10, 2);
    v_monto_final NUMERIC(10, 2);
    v_metodo TEXT;
BEGIN
    -- Ejecutar solo cuando el estado cambia a 'completada'
    IF NEW.estado = 'completada' AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'completada') THEN
        SELECT nombre, precio
        INTO v_nombre_servicio, v_precio_servicio
        FROM public.servicios
        WHERE id = NEW.servicio_id;

        v_monto_final := COALESCE(NEW.precio_cobrado, v_precio_servicio, 0);
        v_metodo := COALESCE(NEW.metodo_pago, 'efectivo');

        -- Insertar ingreso evitando duplicados si la cita vuelve a editarse
        INSERT INTO public.ingresos (
            cita_id,
            concepto,
            monto,
            fecha,
            metodo_pago,
            peluquero_id
        )
        VALUES (
            NEW.id,
            'Servicio: ' || COALESCE(v_nombre_servicio, 'Cita en salón'),
            v_monto_final,
            NEW.fecha,
            v_metodo,
            NEW.peluquero_id
        )
        ON CONFLICT (cita_id) DO UPDATE SET
            monto = EXCLUDED.monto,
            fecha = EXCLUDED.fecha,
            metodo_pago = EXCLUDED.metodo_pago,
            peluquero_id = EXCLUDED.peluquero_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cita_completada_ingreso
AFTER INSERT OR UPDATE ON public.citas
FOR EACH ROW
EXECUTE FUNCTION public.fn_registrar_ingreso_cita_completada();

-- ============================================================================
-- 3. FUNCIONES RPC PÚBLICAS (SEGURAS PARA RESERVAS ONLINE)
-- ============================================================================

-- Devuelve únicamente los bloques horarios libres sin exponer datos de clientes ni otras citas
CREATE OR REPLACE FUNCTION public.horarios_disponibles(
    peluquero UUID,
    fecha DATE,
    servicio UUID
)
RETURNS TABLE (
    hora_inicio TIME,
    hora_fin TIME
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_dia_semana SMALLINT;
    v_duracion_min INT;
    v_jornada_inicio TIME;
    v_jornada_fin TIME;
    v_cursor TIME;
    v_slot_fin TIME;
    v_paso INTERVAL := INTERVAL '30 minutes';
BEGIN
    -- No permitir reservas en fechas pasadas
    IF fecha < CURRENT_DATE THEN
        RETURN;
    END IF;

    -- Verificar que el estilista esté activo y habilitado para el servicio
    SELECT s.duracion_min
    INTO v_duracion_min
    FROM public.servicios s
    JOIN public.peluquero_servicios ps ON ps.servicio_id = s.id
    JOIN public.peluqueros p ON p.id = ps.peluquero_id
    WHERE s.id = servicio
      AND s.activo = TRUE
      AND p.id = peluquero
      AND p.activo = TRUE;

    IF v_duracion_min IS NULL THEN
        RETURN;
    END IF;

    -- Obtener jornada laboral del estilista para ese día (0=Dom..6=Sáb)
    v_dia_semana := EXTRACT(DOW FROM fecha)::SMALLINT;

    SELECT hp.hora_inicio, hp.hora_fin
    INTO v_jornada_inicio, v_jornada_fin
    FROM public.horarios_peluquero hp
    WHERE hp.peluquero_id = peluquero
      AND hp.dia_semana = v_dia_semana;

    IF v_jornada_inicio IS NULL OR v_jornada_fin IS NULL THEN
        RETURN;
    END IF;

    -- Iterar bloques de 30 minutos verificando traslapes con citas no canceladas
    v_cursor := v_jornada_inicio;

    WHILE (v_cursor + (v_duracion_min || ' minutes')::INTERVAL) <= v_jornada_fin LOOP
        v_slot_fin := v_cursor + (v_duracion_min || ' minutes')::INTERVAL;

        -- Si es hoy, filtrar horas que ya pasaron (con 30 min de margen)
        IF fecha > CURRENT_DATE OR v_cursor > (LOCALTIME + INTERVAL '30 minutes') THEN
            IF NOT EXISTS (
                SELECT 1
                FROM public.citas c
                WHERE c.peluquero_id = peluquero
                  AND c.fecha = horarios_disponibles.fecha
                  AND c.estado <> 'cancelada'
                  AND c.hora_inicio < v_slot_fin
                  AND c.hora_fin > v_cursor
            ) THEN
                hora_inicio := v_cursor;
                hora_fin := v_slot_fin;
                RETURN NEXT;
            END IF;
        END IF;

        v_cursor := v_cursor + v_paso;
    END LOOP;
END;
$$;

-- Función RPC atómica para crear reserva pública sin exponer lectura de tablas sensibles
CREATE OR REPLACE FUNCTION public.crear_reserva_publica(
    p_nombre TEXT,
    p_telefono TEXT,
    p_email TEXT,
    p_servicio_id UUID,
    p_peluquero_id UUID,
    p_fecha DATE,
    p_hora_inicio TIME,
    p_notas TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_duracion_min INT;
    v_precio NUMERIC(10, 2);
    v_hora_fin TIME;
    v_cliente_id UUID;
    v_cita_id UUID;
    v_disponible BOOLEAN;
BEGIN
    IF TRIM(COALESCE(p_nombre, '')) = '' OR TRIM(COALESCE(p_telefono, '')) = '' THEN
        RAISE EXCEPTION 'Nombre y teléfono son obligatorios';
    END IF;

    -- Obtener duración y precio vigentes del servicio
    SELECT duracion_min, precio
    INTO v_duracion_min, v_precio
    FROM public.servicios
    WHERE id = p_servicio_id AND activo = TRUE;

    IF v_duracion_min IS NULL THEN
        RAISE EXCEPTION 'El servicio seleccionado no está disponible';
    END IF;

    v_hora_fin := p_hora_inicio + (v_duracion_min || ' minutes')::INTERVAL;

    -- Validar disponibilidad real en el instante de la reserva (evita doble reserva)
    SELECT EXISTS (
        SELECT 1
        FROM public.horarios_disponibles(p_peluquero_id, p_fecha, p_servicio_id) hd
        WHERE hd.hora_inicio = p_hora_inicio
    ) INTO v_disponible;

    IF NOT v_disponible THEN
        RAISE EXCEPTION 'El horario seleccionado ya no está disponible';
    END IF;

    -- Buscar cliente existente por teléfono o crear uno nuevo
    SELECT id INTO v_cliente_id
    FROM public.clientes
    WHERE telefono = TRIM(p_telefono)
    LIMIT 1;

    IF v_cliente_id IS NULL THEN
        INSERT INTO public.clientes (nombre, telefono, email, notas)
        VALUES (TRIM(p_nombre), TRIM(p_telefono), NULLIF(TRIM(COALESCE(p_email, '')), ''), p_notas)
        RETURNING id INTO v_cliente_id;
    ELSE
        UPDATE public.clientes
        SET nombre = TRIM(p_nombre),
            email = COALESCE(NULLIF(TRIM(COALESCE(p_email, '')), ''), email)
        WHERE id = v_cliente_id;
    END IF;

    -- Insertar la cita en estado pendiente
    INSERT INTO public.citas (
        cliente_id,
        servicio_id,
        peluquero_id,
        fecha,
        hora_inicio,
        hora_fin,
        estado,
        precio_cobrado
    )
    VALUES (
        v_cliente_id,
        p_servicio_id,
        p_peluquero_id,
        p_fecha,
        p_hora_inicio,
        v_hora_fin,
        'pendiente',
        v_precio
    )
    RETURNING id INTO v_cita_id;

    RETURN v_cita_id;
END;
$$;

-- ============================================================================
-- 4. VISTAS Y FUNCIONES RPC PARA REPORTES Y CONTABILIDAD (SOLO ADMIN)
-- ============================================================================

-- Vista consolidada de movimientos financieros (Ingresos vs Gastos)
CREATE OR REPLACE VIEW public.vw_flujo_financiero
WITH (security_invoker = true) AS
SELECT
    id,
    'ingreso'::TEXT AS tipo,
    concepto,
    'Servicios'::TEXT AS categoria,
    monto,
    fecha,
    metodo_pago,
    peluquero_id,
    cita_id
FROM public.ingresos
UNION ALL
SELECT
    id,
    'gasto'::TEXT AS tipo,
    concepto,
    categoria,
    monto,
    fecha,
    NULL::TEXT AS metodo_pago,
    NULL::UUID AS peluquero_id,
    NULL::UUID AS cita_id
FROM public.gastos;

-- Reporte financiero agrupado por período ('day', 'month', 'year')
CREATE OR REPLACE FUNCTION public.reporte_financiero_periodo(
    p_agrupacion TEXT DEFAULT 'day',
    p_fecha_inicio DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
    p_fecha_fin DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    periodo DATE,
    total_ingresos NUMERIC(12, 2),
    total_gastos NUMERIC(12, 2),
    utilidad_neta NUMERIC(12, 2)
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF p_agrupacion NOT IN ('day', 'month', 'year') THEN
        p_agrupacion := 'day';
    END IF;

    RETURN QUERY
    WITH fechas AS (
        SELECT DISTINCT DATE_TRUNC(p_agrupacion, f.fecha)::DATE AS p
        FROM public.vw_flujo_financiero f
        WHERE f.fecha BETWEEN p_fecha_inicio AND p_fecha_fin
    ),
    ing AS (
        SELECT DATE_TRUNC(p_agrupacion, fecha)::DATE AS p, COALESCE(SUM(monto), 0) AS total
        FROM public.ingresos
        WHERE fecha BETWEEN p_fecha_inicio AND p_fecha_fin
        GROUP BY 1
    ),
    gas AS (
        SELECT DATE_TRUNC(p_agrupacion, fecha)::DATE AS p, COALESCE(SUM(monto), 0) AS total
        FROM public.gastos
        WHERE fecha BETWEEN p_fecha_inicio AND p_fecha_fin
        GROUP BY 1
    )
    SELECT
        fechas.p AS periodo,
        COALESCE(ing.total, 0)::NUMERIC(12, 2) AS total_ingresos,
        COALESCE(gas.total, 0)::NUMERIC(12, 2) AS total_gastos,
        (COALESCE(ing.total, 0) - COALESCE(gas.total, 0))::NUMERIC(12, 2) AS utilidad_neta
    FROM fechas
    LEFT JOIN ing ON ing.p = fechas.p
    LEFT JOIN gas ON gas.p = fechas.p
    ORDER BY fechas.p ASC;
END;
$$;

-- Reporte de ingresos por servicio
CREATE OR REPLACE FUNCTION public.reporte_ingresos_servicio(
    p_fecha_inicio DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
    p_fecha_fin DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    servicio_id UUID,
    servicio_nombre TEXT,
    categoria_nombre TEXT,
    cantidad_citas BIGINT,
    total_ingresos NUMERIC(12, 2)
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT
        s.id AS servicio_id,
        s.nombre AS servicio_nombre,
        cat.nombre AS categoria_nombre,
        COUNT(i.id) AS cantidad_citas,
        COALESCE(SUM(i.monto), 0)::NUMERIC(12, 2) AS total_ingresos
    FROM public.ingresos i
    JOIN public.citas c ON c.id = i.cita_id
    JOIN public.servicios s ON s.id = c.servicio_id
    JOIN public.categorias cat ON cat.id = s.categoria_id
    WHERE i.fecha BETWEEN p_fecha_inicio AND p_fecha_fin
    GROUP BY s.id, s.nombre, cat.nombre
    ORDER BY total_ingresos DESC;
$$;

-- Reporte de ingresos y comisiones por peluquero
CREATE OR REPLACE FUNCTION public.reporte_ingresos_peluquero(
    p_fecha_inicio DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
    p_fecha_fin DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    peluquero_id UUID,
    peluquero_nombre TEXT,
    comision_pct NUMERIC(5, 2),
    servicios_realizados BIGINT,
    total_facturado NUMERIC(12, 2),
    comision_generada NUMERIC(12, 2)
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT
        p.id AS peluquero_id,
        p.nombre AS peluquero_nombre,
        p.comision_pct,
        COUNT(i.id) AS servicios_realizados,
        COALESCE(SUM(i.monto), 0)::NUMERIC(12, 2) AS total_facturado,
        ROUND(COALESCE(SUM(i.monto), 0) * (p.comision_pct / 100.0), 2)::NUMERIC(12, 2) AS comision_generada
    FROM public.peluqueros p
    LEFT JOIN public.ingresos i
        ON i.peluquero_id = p.id
        AND i.fecha BETWEEN p_fecha_inicio AND p_fecha_fin
    GROUP BY p.id, p.nombre, p.comision_pct
    ORDER BY total_facturado DESC;
$$;

-- Reporte de ingresos por método de pago
CREATE OR REPLACE FUNCTION public.reporte_ingresos_metodo_pago(
    p_fecha_inicio DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
    p_fecha_fin DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    metodo_pago TEXT,
    transacciones BIGINT,
    total_ingresos NUMERIC(12, 2)
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT
        i.metodo_pago,
        COUNT(i.id) AS transacciones,
        COALESCE(SUM(i.monto), 0)::NUMERIC(12, 2) AS total_ingresos
    FROM public.ingresos i
    WHERE i.fecha BETWEEN p_fecha_inicio AND p_fecha_fin
    GROUP BY i.metodo_pago
    ORDER BY total_ingresos DESC;
$$;