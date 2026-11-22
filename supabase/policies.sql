-- ============================================================================
-- POLÍTICAS DE SEGURIDAD (ROW LEVEL SECURITY - RLS)
-- Ejecutar en el SQL Editor de Supabase (Etapa 1 - Parte 2)
-- ============================================================================

-- ============================================================================
-- 1. FUNCIÓN VERIFICADORA DE ROL ADMINISTRADOR
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.perfiles
        WHERE id = auth.uid()
          AND rol = 'admin'
    );
$$;

-- ============================================================================
-- 2. ACTIVAR RLS EN TODAS LAS TABLAS
-- ============================================================================

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peluqueros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.peluquero_servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios_peluquero ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingresos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. POLÍTICAS POR TABLA
-- ============================================================================

-- PERFILES: Cada usuario puede leer su propio perfil; admin gestiona todos
CREATE POLICY "Usuarios leen su propio perfil"
    ON public.perfiles FOR SELECT
    TO authenticated
    USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Solo admin gestiona perfiles"
    ON public.perfiles FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- CATEGORÍAS: Público lee activas; admin CRUD completo
CREATE POLICY "Publico lee categorias activas"
    ON public.categorias FOR SELECT
    TO anon, authenticated
    USING (activa = TRUE OR public.is_admin());

CREATE POLICY "Admin gestiona categorias"
    ON public.categorias FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- SERVICIOS: Público lee activos; admin CRUD completo
CREATE POLICY "Publico lee servicios activos"
    ON public.servicios FOR SELECT
    TO anon, authenticated
    USING (activo = TRUE OR public.is_admin());

CREATE POLICY "Admin gestiona servicios"
    ON public.servicios FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- PELUQUEROS: Público lee activos; admin CRUD completo
CREATE POLICY "Publico lee peluqueros activos"
    ON public.peluqueros FOR SELECT
    TO anon, authenticated
    USING (activo = TRUE OR public.is_admin());

CREATE POLICY "Admin gestiona peluqueros"
    ON public.peluqueros FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- PELUQUERO_SERVICIOS: Público lee relaciones de activos; admin CRUD completo
CREATE POLICY "Publico lee peluquero_servicios"
    ON public.peluquero_servicios FOR SELECT
    TO anon, authenticated
    USING (
        public.is_admin() OR (
            EXISTS (SELECT 1 FROM public.peluqueros p WHERE p.id = peluquero_id AND p.activo = TRUE)
            AND EXISTS (SELECT 1 FROM public.servicios s WHERE s.id = servicio_id AND s.activo = TRUE)
        )
    );

CREATE POLICY "Admin gestiona peluquero_servicios"
    ON public.peluquero_servicios FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- HORARIOS_PELUQUERO: Público lee horarios para calcular disponibilidad; admin CRUD completo
CREATE POLICY "Publico lee horarios de peluqueros activos"
    ON public.horarios_peluquero FOR SELECT
    TO anon, authenticated
    USING (
        public.is_admin() OR
        EXISTS (SELECT 1 FROM public.peluqueros p WHERE p.id = peluquero_id AND p.activo = TRUE)
    );

CREATE POLICY "Admin gestiona horarios_peluquero"
    ON public.horarios_peluquero FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- CLIENTES: Público NO puede leer; se permite INSERT controlado y admin CRUD completo
CREATE POLICY "Publico puede registrar datos de cliente al reservar"
    ON public.clientes FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        TRIM(COALESCE(nombre, '')) <> ''
        AND TRIM(COALESCE(telefono, '')) <> ''
    );

CREATE POLICY "Solo admin lee clientes"
    ON public.clientes FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "Solo admin actualiza clientes"
    ON public.clientes FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Solo admin elimina clientes"
    ON public.clientes FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- CITAS: Público puede CREAR citas en estado 'pendiente', pero NO leer, editar ni borrar
CREATE POLICY "Publico crea citas pendientes"
    ON public.citas FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        estado = 'pendiente'
        AND fecha >= CURRENT_DATE
    );

CREATE POLICY "Solo admin lee citas"
    ON public.citas FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "Solo admin actualiza citas"
    ON public.citas FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "Solo admin elimina citas"
    ON public.citas FOR DELETE
    TO authenticated
    USING (public.is_admin());

-- INGRESOS: Acceso exclusivo de lectura y escritura para admin
CREATE POLICY "Solo admin gestiona ingresos"
    ON public.ingresos FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- GASTOS: Acceso exclusivo de lectura y escritura para admin
CREATE POLICY "Solo admin gestiona gastos"
    ON public.gastos FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- CONFIGURACIÓN: Público puede leer textos/horarios/datos del salón; admin edita
CREATE POLICY "Publico lee configuracion del salon"
    ON public.configuracion FOR SELECT
    TO anon, authenticated
    USING (TRUE);

CREATE POLICY "Solo admin gestiona configuracion"
    ON public.configuracion FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================================
-- 4. PERMISOS DE EJECUCIÓN DE FUNCIONES RPC
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.horarios_disponibles(UUID, DATE, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_reserva_publica(TEXT, TEXT, TEXT, UUID, UUID, DATE, TIME, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reporte_financiero_periodo(TEXT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reporte_ingresos_servicio(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reporte_ingresos_peluquero(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reporte_ingresos_metodo_pago(DATE, DATE) TO authenticated;

-- ============================================================================
-- 5. BUCKET DE STORAGE PARA IMÁGENES DE SERVICIOS Y EQUIPO
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('salon-media', 'salon-media', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Lectura publica de imagenes del salon"
    ON storage.objects FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'salon-media');

CREATE POLICY "Admin sube imagenes del salon"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'salon-media' AND public.is_admin());

CREATE POLICY "Admin actualiza imagenes del salon"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'salon-media' AND public.is_admin());

CREATE POLICY "Admin elimina imagenes del salon"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'salon-media' AND public.is_admin());
    