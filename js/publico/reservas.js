// ============================================================================
// FLUJO DE RESERVA EN 4 PASOS CON SUPABASE (MÓDULO ES - SEGURO)
// ============================================================================
import { supabase } from '../supabaseClient.js';

let state = {
    servicioId: null,
    servicioObj: null,
    peluqueroId: null,
    peluqueroObj: null,
    peluquerosElegibles: [],
    fecha: null,
    horaInicio: null,
    nombre: '',
    telefono: '',
    email: '',
    notas: ''
};

export async function initReservaFlujo() {
    const container = document.getElementById('booking-container');
    if (!container) return;

    // Detectar servicio preseleccionado por URL si existe
    const urlParams = new URLSearchParams(window.location.search);
    const srvParam = urlParams.get('servicio');
    if (srvParam) {
        state.servicioId = srvParam;
    }

    setupStepsNavigation();
    await cargarPaso1Servicios();
}

function setupStepsNavigation() {
    window.irPaso = async (paso) => {
        if (paso === 2 && !state.servicioId) {
            alert('Por favor selecciona un servicio.');
            return;
        }
        if (paso === 3 && !state.peluqueroId) {
            alert('Por favor selecciona un profesional o especialista.');
            return;
        }
        if (paso === 4 && (!state.fecha || !state.horaInicio)) {
            alert('Por favor selecciona una fecha y un horario disponible.');
            return;
        }

        if (paso === 2) {
    await cargarPaso3PeluquerosYFechas();
        }
        if (paso === 4) {
            prepararResumenFinal();
        }

        // Cambiar pestañas y contenido visual
        document.querySelectorAll('.booking-step-content').forEach(el => el.classList.remove('active'));
        const stepContent = document.getElementById(`step-${paso}-content`);
        if (stepContent) stepContent.classList.add('active');

        document.querySelectorAll('.step').forEach(el => {
            const stepNum = parseInt(el.getAttribute('data-step'), 10);
            el.classList.remove('active', 'completed');
            if (stepNum === paso) el.classList.add('active');
            if (stepNum < paso) el.classList.add('completed');
        });

        window.scrollTo({ top: 200, behavior: 'smooth' });
    };
}

async function cargarPaso1Servicios() {
    const grid = document.getElementById('step-1-grid');
    if (!grid) return;

    grid.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; grid-column: 1/-1;">Cargando servicios...</p>';

    try {
        const { data: servicios, error } = await supabase
            .from('servicios')
            .select('*, categorias(nombre)')
            .eq('activo', true)
            .order('orden');

        if (error) throw error;

        if (!servicios || servicios.length === 0) {
            grid.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; grid-column: 1/-1;">No hay servicios disponibles en este momento.</p>';
            return;
        }

        grid.innerHTML = servicios.map(s => `
            <div class="booking-option-card ${state.servicioId === s.id ? 'selected' : ''}" data-id="${s.id}">
                <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem;">${escapeHTML(s.nombre)}</h4>
                <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-bottom: 1rem;"><i class="ph ph-clock"></i> ${s.duracion_min} min</p>
                <span style="font-family: var(--font-serif); font-size: 1.2rem; color: var(--color-accent);">$${Number(s.precio).toFixed(2)}</span>
            </div>
        `).join('');

        grid.querySelectorAll('.booking-option-card').forEach(card => {
            card.addEventListener('click', () => {
                grid.querySelectorAll('.booking-option-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                state.servicioId = card.getAttribute('data-id');
                state.servicioObj = servicios.find(s => s.id === state.servicioId);
                state.peluqueroId = null;
                state.peluqueroObj = null;
                state.horaInicio = null;
                console.log('Servicio seleccionado:', state.servicioObj);

                const btnNext = document.getElementById('btn-step-1-next');
                if (btnNext) btnNext.removeAttribute('disabled');
            });
        });

        if (state.servicioId) {
            state.servicioObj = servicios.find(s => s.id === state.servicioId);
            state.horaInicio = null;
            const btnStep3 = document.getElementById('btn-step-3-next');
            if (btnStep3) btnStep3.setAttribute('disabled', 'true');
            const btnNext = document.getElementById('btn-step-1-next');
            if (btnNext && state.servicioObj) btnNext.removeAttribute('disabled');
        }

    } catch (err) {
        console.error('Error detallado al cargar servicios en paso 1:', err);
        grid.innerHTML = '<p style="color: var(--color-error); text-align: center; grid-column: 1/-1;">Error al cargar el catálogo de servicios.</p>';
    }
}

async function cargarPaso3PeluquerosYFechas() {
    const grid = document.getElementById('step-2-grid');
    if (!grid) return;

    console.log('Cargando peluqueros para servicio_id:', state.servicioId);
    grid.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; grid-column: 1/-1;">Cargando especialistas...</p>';

    try {
        // Consulta en dos pasos para evitar fallos de claves foráneas anidadas en PostgREST
        const { data: rels, error: relError } = await supabase
            .from('peluquero_servicios')
            .select('peluquero_id')
            .eq('servicio_id', state.servicioId);

        if (relError) throw relError;

        const peluqueroIds = rels ? rels.map(r => r.peluquero_id) : [];
        console.log('IDs de peluqueros vinculados:', peluqueroIds);

        if (peluqueroIds.length === 0) {
            grid.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; grid-column: 1/-1;">No hay especialistas disponibles para este servicio.</p>';
            return;
        }

        const { data: peluqueros, error: pelError } = await supabase
            .from('peluqueros')
            .select('*')
            .in('id', peluqueroIds)
            .eq('activo', true);

        if (pelError) throw pelError;

        state.peluquerosElegibles = peluqueros || [];
        console.log('Peluqueros elegibles recibidos:', state.peluquerosElegibles);

        if (state.peluquerosElegibles.length === 0) {
            grid.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center; grid-column: 1/-1;">No hay especialistas disponibles para este servicio.</p>';
            return;
        }

        // Renderizar opción "Cualquiera disponible" + listado de especialistas
        grid.innerHTML = `
            <div class="booking-option-card ${state.peluqueroId === 'cualquiera' ? 'selected' : ''}" data-id="cualquiera">
                <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem;">Cualquiera disponible</h4>
                <p style="font-size: 0.85rem; color: var(--color-text-secondary);">Asignación automática al primer profesional libre</p>
            </div>
        ` + state.peluquerosElegibles.map(p => `
            <div class="booking-option-card ${state.peluqueroId === p.id ? 'selected' : ''}" data-id="${p.id}">
                <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem;">${escapeHTML(p.nombre)}</h4>
                <p style="font-size: 0.85rem; color: var(--color-accent);">${escapeHTML(p.especialidad || 'Estilista')}</p>
            </div>
        `).join('');

        grid.querySelectorAll('.booking-option-card').forEach(card => {
            card.addEventListener('click', async () => {
                grid.querySelectorAll('.booking-option-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                state.peluqueroId = card.getAttribute('data-id');
                state.peluqueroObj = state.peluqueroId === 'cualquiera' ? null : state.peluquerosElegibles.find(p => p.id === state.peluqueroId);
                
                console.log('Especialista seleccionado:', state.peluqueroId);

                const btnNext = document.getElementById('btn-step-2-next');
                if (btnNext) btnNext.removeAttribute('disabled');

                await inicializarSelectorFechaYHorarios();
            });
        });

        // Configurar fecha mínima (hoy) y restricciones
        const dateInput = document.getElementById('reserva-fecha');
        if (dateInput) {
            const todayStr = new Date().toISOString().split('T')[0];
            dateInput.setAttribute('min', todayStr);
            if (!dateInput.value) dateInput.value = todayStr;
            state.fecha = dateInput.value;

            dateInput.onchange = async (e) => {
                state.fecha = e.target.value;
                await cargarHorariosDisponibles();
            };
        }

        if (state.peluqueroId) {
            await cargarHorariosDisponibles();
        }

    } catch (err) {
        console.error('Error detallado al cargar especialistas en paso 2:', err);
        grid.innerHTML = '<p style="color: var(--color-error); text-align: center; grid-column: 1/-1;">Error al cargar el equipo de especialistas.</p>';
    }
}

async function inicializarSelectorFechaYHorarios() {
    const dateInput = document.getElementById('reserva-fecha');
    if (dateInput && !state.fecha) {
        const todayStr = new Date().toISOString().split('T')[0];
        dateInput.value = todayStr;
        state.fecha = todayStr;
    }
    await cargarHorariosDisponibles();
}

async function cargarHorariosDisponibles() {
    const slotsContainer = document.getElementById('slots-container');
    if (!slotsContainer) return;

    slotsContainer.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center;">Consultando horarios disponibles...</p>';

    try {
        let horariosMap = new Map();

        if (state.peluqueroId === 'cualquiera') {
            for (let peluquero of state.peluquerosElegibles) {
                const { data: slots, error } = await supabase.rpc('horarios_disponibles', {
                    peluquero: peluquero.id,
                    fecha: state.fecha,
                    servicio: state.servicioId
                });

                if (!error && slots) {
                    slots.forEach(slot => {
                        if (!horariosMap.has(slot.hora_inicio)) {
                            horariosMap.set(slot.hora_inicio, []);
                        }
                        horariosMap.get(slot.hora_inicio).push(peluquero.id);
                    });
                }
            }
        } else if (state.peluqueroId) {
            const { data: slots, error } = await supabase.rpc('horarios_disponibles', {
                peluquero: state.peluqueroId,
                fecha: state.fecha,
                servicio: state.servicioId
            });

            if (error) throw error;
            if (slots) {
                slots.forEach(slot => {
                    horariosMap.set(slot.hora_inicio, [state.peluqueroId]);
                });
            }
        }

        const horasUnicas = Array.from(horariosMap.keys()).sort();
        console.log('Horarios disponibles encontrados:', horasUnicas);

        if (horasUnicas.length === 0) {
            slotsContainer.innerHTML = '<p style="color: var(--color-text-secondary); text-align: center;">No hay horarios libres para esta fecha. Selecciona otro día.</p>';
            return;
        }

        slotsContainer.innerHTML = horasUnicas.map(hora => `
            <button type="button" class="slot-btn" data-hora="${hora}">${hora.slice(0, 5)}</button>
        `).join('');

        slotsContainer.querySelectorAll('.slot-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                slotsContainer.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                state.horaInicio = btn.getAttribute('data-hora');
                
                const btnNext = document.getElementById('btn-step-3-next');
                if (btnNext) btnNext.removeAttribute('disabled');
            });
        });

    } catch (err) {
        console.error('Error detallado al consultar horarios:', err);
        slotsContainer.innerHTML = '<p style="color: var(--color-error); text-align: center;">Error al consultar la disponibilidad horaria.</p>';
    }
}

function prepararResumenFinal() {
    const sumServicio = document.getElementById('sum-servicio');
    const sumPeluquero = document.getElementById('sum-peluquero');
    const sumFecha = document.getElementById('sum-fecha');
    const sumTotal = document.getElementById('sum-total');

    if (sumServicio) sumServicio.textContent = state.servicioObj?.nombre || 'Servicio';
    if (sumPeluquero) sumPeluquero.textContent = state.peluqueroObj?.nombre || 'Cualquier profesional disponible';
    if (sumFecha) sumFecha.textContent = `${state.fecha} a las ${state.horaInicio?.slice(0, 5)}`;
    if (sumTotal) sumTotal.textContent = `$${Number(state.servicioObj?.precio || 0).toFixed(2)}`;

    const form = document.getElementById('booking-form');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            const nombreInput = document.getElementById('cli-nombre');
            const telefonoInput = document.getElementById('cli-telefono');
            const emailInput = document.getElementById('cli-email');
            const notasInput = document.getElementById('cli-notas');

            state.nombre = nombreInput ? nombreInput.value.trim() : '';
            state.telefono = telefonoInput ? telefonoInput.value.trim() : '';
            state.email = emailInput ? emailInput.value.trim() : '';
            state.notas = notasInput ? notasInput.value.trim() : '';

            if (!state.nombre || !state.telefono) {
                alert('Por favor completa tu nombre y número de teléfono.');
                return;
            }

            const btnSubmit = document.getElementById('btn-confirmar-reserva');
            if (btnSubmit) {
                btnSubmit.textContent = 'Procesando reserva...';
                btnSubmit.setAttribute('disabled', 'true');
            }

            try {
                const clienteId = crypto.randomUUID();
                const citaId = crypto.randomUUID();

                const { error: clienteError } = await supabase
                    .from('clientes')
                    .insert([{
                        id: clienteId,
                        nombre: state.nombre,
                        telefono: state.telefono,
                        email: state.email || null,
                        notas: state.notas || null
                    }]);

                if (clienteError) throw clienteError;

                let peluqueroFinalId = state.peluqueroId;
                if (peluqueroFinalId === 'cualquiera') {
                    for (let p of state.peluquerosElegibles) {
                        const { data: slots } = await supabase.rpc('horarios_disponibles', {
                            peluquero: p.id,
                            fecha: state.fecha,
                            servicio: state.servicioId
                        });
                        if (slots && slots.some(s => s.hora_inicio === state.horaInicio)) {
                            peluqueroFinalId = p.id;
                            break;
                        }
                    }
                    if (peluqueroFinalId === 'cualquiera') {
                        throw new Error('Lo sentimos, el horario seleccionado ya no se encuentra disponible. Por favor elige otro.');
                    }
                }

                const duracionMin = state.servicioObj?.duracion_min || 30;
                const [h, m] = state.horaInicio.split(':').map(Number);
                const totalMin = h * 60 + m + duracionMin;
                const horaFin = `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}:00`;

                const { error: citaError } = await supabase
                    .from('citas')
                    .insert([{
                        id: citaId,
                        cliente_id: clienteId,
                        servicio_id: state.servicioId,
                        peluquero_id: peluqueroFinalId,
                        fecha: state.fecha,
                        hora_inicio: state.horaInicio,
                        hora_fin: horaFin,
                        estado: 'pendiente',
                        precio_cobrado: state.servicioObj?.precio || 0
                    }]);

                if (citaError) throw citaError;

                const bookingContainer = document.getElementById('booking-container');
                if (bookingContainer) {
                    bookingContainer.innerHTML = `
                        <div style="text-align: center; padding: 3rem 0;">
                            <i class="ph ph-check-circle" style="font-size: 4rem; color: var(--color-success); margin-bottom: 1rem;"></i>
                            <h2 style="margin-bottom: 1rem;">¡Reserva Registrada con Éxito!</h2>
                            <p style="color: var(--color-text-secondary); max-width: 500px; margin: 0 auto 2rem auto;">
                                Hemos registrado tu cita en estado pendiente. Nos pondremos en contacto vía WhatsApp o teléfono para confirmarla. ¡Te esperamos!
                            </p>
                            <a href="index.html" class="btn-gold">Volver al Inicio</a>
                        </div>
                    `;
                }

            } catch (err) {
                console.error('Error al confirmar la reserva:', err);
                alert('No se pudo completar la reserva: ' + (err.message || 'Error desconocido'));
                if (btnSubmit) {
                    btnSubmit.textContent = 'Confirmar Reserva';
                    btnSubmit.removeAttribute('disabled');
                }
            }
        };
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}
function hoyLocal() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}