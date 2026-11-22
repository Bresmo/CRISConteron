-- ============================================================================
-- DATOS DE EJEMPLO (SEED) - PELUQUERÍA BOUTIQUE DE LUJO
-- Ejecutar en el SQL Editor de Supabase (Etapa 1 - Parte 3)
-- ============================================================================

-- ============================================================================
-- 1. CONFIGURACIÓN INICIAL DEL NEGOCIO
-- ============================================================================

INSERT INTO public.configuracion (clave, valor) VALUES
('nombre_salon', 'MAISON AURUM · Haute Coiffure'),
('eslogan', 'El arte de la alta peluquería y el ritual capilar contemporáneo.'),
('descripcion_corta', 'Un espacio íntimo donde la precisión técnica, la colorimetría de autor y los tratamientos botánicos de lujo convergen para realzar tu identidad.'),
('telefono', '+593 99 845 3210'),
('whatsapp', '593998453210'),
('email', 'concierge@maisonaurum.com'),
('direccion', 'Av. República de El Salvador N36-140 y Suecia, Edificio Aura, Local 2'),
('ciudad', 'Quito, Ecuador'),
('horario_texto', 'Lunes a Sábado: 09:00 – 20:00 | Domingos: Cerrado'),
('instagram_url', 'https://instagram.com'),
('moneda', '$'),
('politica_cancelacion', 'Agradecemos notificar cualquier cambio o cancelación con al menos 12 horas de antelación.')
ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor;

-- ============================================================================
-- 2. CATEGORÍAS (6 CATEGORÍAS)
-- ============================================================================

INSERT INTO public.categorias (id, nombre, orden, activa) VALUES
('11111111-1111-1111-1111-111111111101', 'Corte & Estilismo', 1, TRUE),
('11111111-1111-1111-1111-111111111102', 'Colorimetría de Autor', 2, TRUE),
('11111111-1111-1111-1111-111111111103', 'Rituales Capilares & Spa', 3, TRUE),
('11111111-1111-1111-1111-111111111104', 'Barbería & Grooming', 4, TRUE),
('11111111-1111-1111-1111-111111111105', 'Alisados & Texturas', 5, TRUE),
('11111111-1111-1111-1111-111111111106', 'Novias & Alta Gala', 6, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. SERVICIOS (15 SERVICIOS)
-- ============================================================================

INSERT INTO public.servicios (id, categoria_id, nombre, descripcion, precio, duracion_min, imagen_url, orden, activo) VALUES
-- Corte & Estilismo (3)
('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'Corte de Autor & Visagismo', 'Diagnóstico morfológico personalizado, lavado sensorial con aromaterapia, corte de precisión y brushing de acabado sedoso.', 45.00, 60, 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=900&q=80', 1, TRUE),
('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', 'Brushing Couture & Ondas', 'Moldeado con cepillo de cerdas naturales o tenaza cerámica para volumen duradero y brillo espejo.', 32.00, 45, 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=80', 2, TRUE),
('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111101', 'Corte Caballero Ejecutivo', 'Corte clásico o contemporáneo a tijera y máquina, ritual de lavado revitalizante y peinado con ceras mate.', 28.00, 45, 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=900&q=80', 3, TRUE),

-- Colorimetría de Autor (3)
('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111102', 'Balayage Lumière a Mano Alzada', 'Iluminación orgánica degradada con transición imperceptible, matiz personalizado y sellador de cutícula.', 145.00, 180, 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=format&fit=crop&w=900&q=80', 1, TRUE),
('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111102', 'Coloración Global Sin Amoníaco', 'Cobertura impecable y reflejos multidimensionales con pigmentos botánicos de bajo impacto.', 75.00, 90, 'https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=900&q=80', 2, TRUE),
('22222222-2222-2222-2222-222222222206', '11111111-1111-1111-1111-111111111102', 'Gloss & Matización Cristal', 'Baño de brillo ácido que neutraliza tonos indeseados y devuelve luminosidad extrema entre coloraciones.', 55.00, 60, 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=900&q=80', 3, TRUE),

-- Rituales Capilares & Spa (3)
('22222222-2222-2222-2222-222222222207', '11111111-1111-1111-1111-111111111103', 'Ritual Kérastase Caviar Chronologiste', 'Regeneración profunda del cuero cabelludo y la fibra capilar con perlas miméticas de caviar y masaje craneal.', 85.00, 60, 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=900&q=80', 1, TRUE),
('22222222-2222-2222-2222-222222222208', '11111111-1111-1111-1111-111111111103', 'Head Spa Japonés & Vapor Ozono', 'Exfoliación folicular, vaporización con micro-bruma y acupresión relajante de 60 minutos.', 70.00, 60, 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=900&q=80', 2, TRUE),
('22222222-2222-2222-2222-222222222209', '11111111-1111-1111-1111-111111111103', 'Reconstrucción Molecular Bond-Repair', 'Reparación intensiva de enlaces disulfuro para cabellos sensibilizados por decoloración o calor.', 65.00, 60, 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=900&q=80', 3, TRUE),

-- Barbería & Grooming (2)
('22222222-2222-2222-2222-222222222210', '11111111-1111-1111-1111-111111111104', 'Ritual de Barba Toalla Caliente', 'Perfilado a navaja tradicional, compresas aromáticas calientes, aceites esenciales de sándalo y bálsamo hidratante.', 24.00, 30, 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=900&q=80', 1, TRUE),
('22222222-2222-2222-2222-222222222211', '11111111-1111-1111-1111-111111111104', 'Experiencia Dúo: Corte + Barba Imperial', 'Servicio integral de corte masculino de precisión combinado con ritual completo de barba y mascarilla facial.', 46.00, 75, 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=900&q=80', 2, TRUE),

-- Alisados & Texturas (2)
('22222222-2222-2222-2222-222222222212', '11111111-1111-1111-1111-111111111105', 'Alisado Orgánico de Seda & Taninos', 'Reducción total del frizz y alisado natural libre de formol con duración de hasta 4 meses.', 160.00, 180, 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=900&q=80', 1, TRUE),
('22222222-2222-2222-2222-222222222213', '11111111-1111-1111-1111-111111111105', 'Definición & Hidratación Rizos Couture', 'Corte en seco especializado para rizos y ondas, hidratación profunda y definición sin peso.', 58.00, 75, 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?auto=format&fit=crop&w=900&q=80', 2, TRUE),

-- Novias & Alta Gala (2)
('22222222-2222-2222-2222-222222222214', '11111111-1111-1111-1111-111111111106', 'Recogido Alta Gala & Editorial', 'Diseño escultórico o romántico adaptado al vestuario y joyería para eventos de etiqueta.', 68.00, 75, 'https://images.unsplash.com/photo-1522337094846-8a818192de1f?auto=format&fit=crop&w=900&q=80', 1, TRUE),
('22222222-2222-2222-2222-222222222215', '11111111-1111-1111-1111-111111111106', 'Pack Novia Maison Aurum (Prueba + Día B)', 'Incluye sesión de diseño y prueba previa más peinado nupcial el día de la ceremonia con preparación capilar.', 190.00, 120, 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=80', 2, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 4. EQUIPO DE PELUQUEROS (8 ESPECIALISTAS)
-- ============================================================================

INSERT INTO public.peluqueros (id, nombre, foto_url, especialidad, bio, telefono, comision_pct, activo) VALUES
('33333333-3333-3333-3333-333333333301', 'Valeria Montalvo', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=700&q=80', 'Directora Artística & Visagismo', 'Formada en París y Milán con 12 años de experiencia en cortes arquitectónicos y transformación de imagen.', '+593 99 101 2001', 45.00, TRUE),
('33333333-3333-3333-3333-333333333302', 'Sebastián Villavicencio', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=700&q=80', 'Maestro Colorista & Balayage', 'Especialista en rubios dimensionales, técnicas a mano alzada y corrección de color de alta complejidad.', '+593 99 101 2002', 45.00, TRUE),
('33333333-3333-3333-3333-333333333303', 'Camila Santamaría', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=80', 'Estilista Editorial & Novias', 'Creadora de recogidos atemporales y ondas de pasarela para bodas y editoriales de moda.', '+593 99 101 2003', 40.00, TRUE),
('33333333-3333-3333-3333-333333333304', 'Mateo Benalcázar', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=700&q=80', 'Master Barber & Grooming', 'Experto en sastrería capilar masculina, corte a tijera clásica y rituales tradicionales de navaja.', '+593 99 101 2004', 40.00, TRUE),
('33333333-3333-3333-3333-333333333305', 'Isabella Cordero', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=700&q=80', 'Especialista en Tricología & Head Spa', 'Certificada en salud del cuero cabelludo, rituales botánicos japoneses y recuperación de fibra capilar.', '+593 99 101 2005', 38.00, TRUE),
('33333333-3333-3333-3333-333333333306', 'Julián Espinosa', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=700&q=80', 'Colorista & Texturas', 'Especialista en alisados orgánicos sin formol, baños de brillo y diseño de rizos naturales.', '+593 99 101 2006', 40.00, TRUE),
('33333333-3333-3333-3333-333333333307', 'Sofía Larrea', 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=700&q=80', 'Senior Stylist & Brushing', 'Maestra del acabado sedoso, cortes en capas ligeras y tratamientos de reconstrucción molecular.', '+593 99 101 2007', 38.00, TRUE),
('33333333-3333-3333-3333-333333333308', 'Nicolás Andrade', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=700&q=80', 'Estilista & Barber Contemporáneo', 'Fusión de técnicas europeas de corte masculino y estilismo moderno de bajo mantenimiento.', '+593 99 101 2008', 35.00, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 5. ASIGNACIÓN DE SERVICIOS POR PELUQUERO
-- ============================================================================

INSERT INTO public.peluquero_servicios (peluquero_id, servicio_id) VALUES
-- Valeria (Corte, Brushing, Novias)
('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201'),
('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222202'),
('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222214'),
('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222215'),
-- Sebastián (Colorimetría + Corte)
('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222201'),
('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222204'),
('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222205'),
('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222206'),
-- Camila (Novias, Brushing, Corte)
('33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222201'),
('33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222202'),
('33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222214'),
('33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222215'),
-- Mateo (Barbería & Corte Caballero)
('33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222203'),
('33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222210'),
('33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222211'),
-- Isabella (Rituales & Spa)
('33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222207'),
('33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222208'),
('33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222209'),
-- Julián (Alisados, Rizos, Color)
('33333333-3333-3333-3333-333333333306', '22222222-2222-2222-2222-222222222205'),
('33333333-3333-3333-3333-333333333306', '22222222-2222-2222-2222-222222222206'),
('33333333-3333-3333-3333-333333333306', '22222222-2222-2222-2222-222222222212'),
('33333333-3333-3333-3333-333333333306', '22222222-2222-2222-2222-222222222213'),
-- Sofía (Corte, Brushing, Tratamientos)
('33333333-3333-3333-3333-333333333307', '22222222-2222-2222-2222-222222222201'),
('33333333-3333-3333-3333-333333333307', '22222222-2222-2222-2222-222222222202'),
('33333333-3333-3333-3333-333333333307', '22222222-2222-2222-2222-222222222207'),
('33333333-3333-3333-3333-333333333307', '22222222-2222-2222-2222-222222222209'),
-- Nicolás (Barbería & Corte Caballero)
('33333333-3333-3333-3333-333333333308', '22222222-2222-2222-2222-222222222203'),
('33333333-3333-3333-3333-333333333308', '22222222-2222-2222-2222-222222222210'),
('33333333-3333-3333-3333-333333333308', '22222222-2222-2222-2222-222222222211')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. HORARIOS SEMANALES DE TODOS LOS PELUQUEROS (Lunes a Sábado: 09:00 - 20:00)
-- ============================================================================

INSERT INTO public.horarios_peluquero (peluquero_id, dia_semana, hora_inicio, hora_fin)
SELECT p.id, d.dia, '09:00'::TIME, '20:00'::TIME
FROM public.peluqueros p
CROSS JOIN (SELECT generate_series(1, 6) AS dia) d
ON CONFLICT (peluquero_id, dia_semana) DO NOTHING;

-- ============================================================================
-- 7. CLIENTES DE EJEMPLO
-- ============================================================================

INSERT INTO public.clientes (id, nombre, telefono, email, notas) VALUES
('44444444-4444-4444-4444-444444444401', 'María Fernanda Palacios', '+593 98 412 5501', 'mf.palacios@email.com', 'Prefiere café expreso sin azúcar. Cuero cabelludo sensible.'),
('44444444-4444-4444-4444-444444444402', 'Andrés Felipe Maldonado', '+593 99 734 8812', 'afmaldonado@email.com', 'Cliente frecuente cada 3 semanas. Corte ejecutivo con Mateo.'),
('44444444-4444-4444-4444-444444444403', 'Daniela Alejandra Viteri', '+593 98 220 9943', 'dani.viteri@email.com', 'Balayage tonos miel frío. Matización cada 6 semanas.'),
('44444444-4444-4444-4444-444444444404', 'Carlos Eduardo Zambrano', '+593 99 501 3340', 'czambrano@email.com', 'Pack Corte + Barba los viernes por la tarde.'),
('44444444-4444-4444-4444-444444444405', 'Gabriela Sofía Chiriboga', '+593 98 991 1204', 'gaby.chiriboga@email.com', 'Alisado orgánico semestral y ritual Kérastase.'),
('44444444-4444-4444-4444-444444444406', 'Lucía Carolina Salgado', '+593 99 615 7788', 'lucia.salgado@email.com', 'Boda programada para diciembre. En seguimiento nupcial.'),
('44444444-4444-4444-4444-444444444407', 'Martín Alejandro Dávila', '+593 98 304 6611', 'martin.davila@email.com', 'Corte clásico a tijera, sin máquina en laterales.'),
('44444444-4444-4444-4444-444444444408', 'Valentina Reyes Moncayo', '+593 99 882 4419', 'val.reyes@email.com', 'Cabello rizado tipo 3B, usa línea hidratante sin sulfatos.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 8. CITAS HISTÓRICAS (ÚLTIMOS 60 DÍAS -> DISPARAN TRIGGER DE INGRESOS) Y FUTURAS
-- ============================================================================

INSERT INTO public.citas (cliente_id, servicio_id, peluquero_id, fecha, hora_inicio, hora_fin, estado, precio_cobrado, metodo_pago) VALUES
-- Hace 55 días
('44444444-4444-4444-4444-444444444401', '22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333301', CURRENT_DATE - 55, '10:00', '11:00', 'completada', 45.00, 'tarjeta'),
('44444444-4444-4444-4444-444444444403', '22222222-2222-2222-2222-222222222204', '33333333-3333-3333-3333-333333333302', CURRENT_DATE - 52, '11:00', '14:00', 'completada', 145.00, 'tarjeta'),
('44444444-4444-4444-4444-444444444402', '22222222-2222-2222-2222-222222222211', '33333333-3333-3333-3333-333333333304', CURRENT_DATE - 49, '16:00', '17:15', 'completada', 46.00, 'efectivo'),
('44444444-4444-4444-4444-444444444405', '22222222-2222-2222-2222-222222222212', '33333333-3333-3333-3333-333333333306', CURRENT_DATE - 45, '09:30', '12:30', 'completada', 160.00, 'transferencia'),
('44444444-4444-4444-4444-444444444406', '22222222-2222-2222-2222-222222222207', '33333333-3333-3333-3333-333333333305', CURRENT_DATE - 41, '15:00', '16:00', 'completada', 85.00, 'tarjeta'),
-- Hace 38 - 20 días
('44444444-4444-4444-4444-444444444404', '22222222-2222-2222-2222-222222222203', '33333333-3333-3333-3333-333333333308', CURRENT_DATE - 38, '12:00', '12:45', 'completada', 28.00, 'efectivo'),
('44444444-4444-4444-4444-444444444408', '22222222-2222-2222-2222-222222222213', '33333333-3333-3333-3333-333333333306', CURRENT_DATE - 34, '10:30', '11:45', 'completada', 58.00, 'tarjeta'),
('44444444-4444-4444-4444-444444444401', '22222222-2222-2222-2222-222222222205', '33333333-3333-3333-3333-333333333302', CURRENT_DATE - 30, '14:00', '15:30', 'completada', 75.00, 'transferencia'),
('44444444-4444-4444-4444-444444444407', '22222222-2222-2222-2222-222222222210', '33333333-3333-3333-3333-333333333304', CURRENT_DATE - 27, '17:00', '17:30', 'completada', 24.00, 'efectivo'),
('44444444-4444-4444-4444-444444444406', '22222222-2222-2222-2222-222222222215', '33333333-3333-3333-3333-333333333303', CURRENT_DATE - 22, '10:00', '12:00', 'completada', 190.00, 'tarjeta'),
-- Últimos 20 días
('44444444-4444-4444-4444-444444444402', '22222222-2222-2222-2222-222222222211', '33333333-3333-3333-3333-333333333304', CURRENT_DATE - 18, '11:00', '12:15', 'completada', 46.00, 'tarjeta'),
('44444444-4444-4444-4444-444444444403', '22222222-2222-2222-2222-222222222206', '33333333-3333-3333-3333-333333333302', CURRENT_DATE - 14, '15:00', '16:00', 'completada', 55.00, 'transferencia'),
('44444444-4444-4444-4444-444444444405', '22222222-2222-2222-2222-222222222208', '33333333-3333-3333-3333-333333333305', CURRENT_DATE - 10, '16:30', '17:30', 'completada', 70.00, 'tarjeta'),
('44444444-4444-4444-4444-444444444401', '22222222-2222-2222-2222-222222222202', '33333333-3333-3333-3333-333333333307', CURRENT_DATE - 6, '11:30', '12:15', 'completada', 32.00, 'efectivo'),
('44444444-4444-4444-4444-444444444408', '22222222-2222-2222-2222-222222222209', '33333333-3333-3333-3333-333333333307', CURRENT_DATE - 3, '13:00', '14:00', 'completada', 65.00, 'tarjeta'),
('44444444-4444-4444-4444-444444444404', '22222222-2222-2222-2222-222222222211', '33333333-3333-3333-3333-333333333308', CURRENT_DATE - 1, '18:00', '19:15', 'completada', 46.00, 'efectivo'),

-- Citas próximas (confirmadas y pendientes para probar agenda)
('44444444-4444-4444-4444-444444444403', '22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333301', CURRENT_DATE + 1, '10:00', '11:00', 'confirmada', 45.00, NULL),
('44444444-4444-4444-4444-444444444406', '22222222-2222-2222-2222-222222222214', '33333333-3333-3333-3333-333333333303', CURRENT_DATE + 2, '14:00', '15:15', 'pendiente', 68.00, NULL),
('44444444-4444-4444-4444-444444444402', '22222222-2222-2222-2222-222222222203', '33333333-3333-3333-3333-333333333304', CURRENT_DATE + 3, '16:00', '16:45', 'pendiente', 28.00, NULL);

-- ============================================================================
-- 9. INGRESOS ADICIONALES (VENTA DE PRODUCTOS EN BOUTIQUE) Y GASTOS OPERATIVOS
-- ============================================================================

INSERT INTO public.ingresos (cita_id, concepto, monto, fecha, metodo_pago, peluquero_id) VALUES
(NULL, 'Venta Boutique: Elixir Capilar Oro Líquido 100ml', 48.00, CURRENT_DATE - 40, 'tarjeta', '33333333-3333-3333-3333-333333333305'),
(NULL, 'Venta Boutique: Mascarilla Nutritiva Chronologiste', 62.00, CURRENT_DATE - 15, 'tarjeta', '33333333-3333-3333-3333-333333333301'),
(NULL, 'Venta Boutique: Cera Mate & Aceite de Sándalo', 35.00, CURRENT_DATE - 5, 'efectivo', '33333333-3333-3333-3333-333333333304');

INSERT INTO public.gastos (categoria, concepto, monto, fecha, nota) VALUES
('Insumos y Coloración', 'Pedido mensual tintes orgánicos y oxidantes', 240.00, CURRENT_DATE - 50, 'Factura #001-452'),
('Arriendo y Servicios', 'Alícuota y servicios básicos del local', 180.00, CURRENT_DATE - 32, 'Pago mensual edificio'),
('Insumos y Coloración', 'Reposición ampollas Kérastase y toallas desechables', 165.00, CURRENT_DATE - 20, 'Proveedor oficial'),
('Marketing', 'Fotografía editorial campaña otoño', 120.00, CURRENT_DATE - 12, 'Sesión en salón'),
('Amenidades', 'Café de especialidad, infusiones botánicas y espumante', 55.00, CURRENT_DATE - 4, 'Hospitalidad clientes');