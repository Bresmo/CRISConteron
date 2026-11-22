// ============================================================================
// FLUJO DE RESERVA EN 4 PASOS CON SUPABASE RPC
// ============================================================================
import { supabase } from '../supabaseClient.js';

let state = {
    servicioId: null,
    servicioObj: null,
    peluqueroId: null, // null o 'cualquiera'
    peluqueroObj: null,
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

    // Detectar si viene un servicio preseleccionado por URL
    const urlParams = new URLSearchParams(window.location.search);
    const srvParam = urlParams.get('servicio');
    if (srvParam) {
        state.servicioId = srvParam;
    }

    setupStepsNavigation();
    await cargarPaso1Servicios();
}

function setupStepsNavigation() {
    // Botones Siguiente / Anterior manejados dinámicamente
    window.irPaso = async (paso) => {
        if (paso === 2 && !state.servicioId) {
            alert('Por favor selecciona un servicio.');
            return;
        }
        if (paso === 3 && !state.peluqueroId) {
            alert('Por favor selecciona un peluquero o especialista.');
            return;
        }
        if (paso === 4 && (!state.fecha || !state.horaInicio)) {
            alert('Por favor selecciona una fecha y hora disponibles.');
            return;
        }

        if (paso === 3) await cargarPaso3PeluquerosYSအတွက်Fechas();
        if (paso === 4) prepararResumenFinal();

        document.querySelectorAll('.booking-step-content').forEach(el => el.classList.remove('active'));
        document.getElementById(`step-${paso}-content`).classList.add('active');

        document.querySelectorAll('.step').forEach(el => {
            const stepNum = parseInt(el.getAttribute('data-step'));
            el.classList.remove('active', 'completed');
            if (stepNum === paso) el.classList.add('active');
            if (stepNum < paso) el.classList.add('completed');
        });

        window.scrollTo({ top: 200, behavior: 'smooth' });
    };
}

async function cargarPaso1Servicios() {
    const grid = document.getElementById('step-1-grid');
    const { data: servicios, error } = await supabase.from('servicios').select('*, categorias(nombre)').eq('activo', true);
    
    if (error) {
        grid.innerHTML = '<p>Error al cargar servicios.</p>';
        return;
    }

    grid.innerHTML = servicios.map(s => `
        <div class="booking-option-card ${state.servicioId === s.id ? 'selected' : ''}" data-id="${s.id}">
            <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem;">${s.nombre}</h4>
            <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-bottom: 1rem;">${s.duracion_min} min</p>
            <span style="font-family: var(--font-serif); font-size: 1.2rem; color: var(--color-accent);">$${Number(s.precio).toFixed(2)}</span>
        </div>
    `).join('');

    grid.querySelectorAll('.booking-option-card').forEach(card => {
        card.addEventListener('click', () => {
            grid.querySelectorAll('.booking-option-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            state.servicioId = card.getAttribute('data-id');
            state.servicioObj = servicios.find(s => s.id === state.servicioId);
            document.getElementById('btn-step-1-next').removeAttribute('disabled');
        });
    });

    if (state.servicioId) {
        state.servicioObj = servicios.find(s => s.id === state.servicioId);
        document.getElementById('btn-step-1-next').removeAttribute('disabled');
    }
}

async function cargarPaso3PeluquerosYSအတွက်Fechas() {
    const grid = document.getElementById('step-2-grid');
    
    // Obtener peluqueros que realizan el servicio
    const { data: rels, error } = await supabase
        .from('peluquero_servicios')
        .select('peluqueros(*)')
        .eq('servicio_id', state.servicioId);

    if (error) {
        grid.innerHTML = '<p>Error al cargar estilistas.</p>';
        return;
    }

    const peluqueros = rels.map(r => r.peluqueros).filter(p => p.activo);

    grid.innerHTML = `
        <div class="booking-option-card ${state.peluqueroId === 'cualquiera' ? 'selected' : ''}" data-id="cualquiera">
            <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem;">Cualquier Profesional</h4>
            <p style="font-size: 0.85rem; color: var(--color-text-secondary);">Asignación automática al mejor disponible</p>
        </div>
    ` + peluqueros.map(p => `
        <div class="booking-option-card ${state.peluqueroId === p.id ? 'selected' : ''}" data-id="${p.id}">
            <h4 style="font-size: 1.1rem; margin-bottom: 0.5rem;">${p.nombre}</h4>
            <p style="font-size: 0.85rem; color: var(--color-accent);">${p.especialidad || 'Estilista'}</p>
        </div>
    `).join('');

    grid.querySelectorAll('.booking-option-card').forEach(card => {
        card.addEventListener('click', () => {
            grid.querySelectorAll('.booking-option-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            state.peluqueroId = card.getAttribute('data-id');
            state.peluqueroObj = state.peluqueroId === 'cualquiera' ? null : peluqueros.find(p => p.id === state.peluqueroId);
            document.getElementById('btn-step-2-next').removeAttribute('disabled');
        });
    });

    // Configurar input de fecha mínima (hoy)
    const dateInput = document.getElementById('reserva-fecha');
    const todayStr = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', todayStr);
    if (!dateInput.value) dateInput.value = todayStr;
    state.fecha = dateInput.value;

    dateInput.addEventListener('change', async (e) => {
        state.fecha = e.target.value;
        await cargarHorariosDisponibles();
    });

    await cargarHorariosDisponibles();
}

async function cargarHorariosDisponibles() {
    const slotsContainer = document.getElementById('slots-container');
    slotsContainer.innerHTML = '<p style="color: var(--color-text-secondary);">Consultando horarios disponibles...</p>';

    let peluqueroAConsultar = state.peluqueroId;
    if (!peluqueroAConsultar || peluqueroAConsultar === 'cualquiera') {
        // Tomar el primer peluquero disponible para el servicio si eligió "cualquiera"
        const { data: rels } = await supabase.from('peluquero_servicios').select('peluquero_id').eq('servicio_id', state.servicioId).limit(1);
        if (!rels || rels.length === 0) {
            slotsContainer.innerHTML = '<p>No hay profesionales disponibles para este servicio.</p>';
            return;
        }
        peluqueroAConsultar = rels[0].peluquero_id;
        state.peluqueroId = peluqueroAConsultar; // Fijar temporalmente para la RPC
    }

    // Llamar RPC horarios_disponibles
    const { data: slots, error } = await supabase.rpc('horarios_disponibles', {
        peluquero: peluqueroAConsultar,
        fecha: state.fecha,
        servicio: state.servicioId
    });

    if (error || !slots || slots.length === 0) {
        slotsContainer.innerHTML = '<p style="color: var(--color-text-secondary);">No hay horarios disponibles para esta fecha. Selecciona otro día.</p>';
        return;
    }

    slotsContainer.innerHTML = slots.map(slot => `
        <button class="slot-btn" data-hora="${slot.hora_inicio}">${slot.hora_inicio.slice(0, 5)}</button>
    `).join('');

    slotsContainer.querySelectorAll('.slot-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            slotsContainer.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.horaInicio = btn.getAttribute('data-hora');
            document.getElementById('btn-step-3-next').removeAttribute('disabled');
        });
    });
}

function prepararResumenFinal() {
    document.getElementById('sum-servicio').textContent = state.servicioObj?.nombre || 'Servicio';
    document.getElementById('sum-peluquero').textContent = state.peluqueroObj?.nombre || 'Profesional Asignado';
    document.getElementById('sum-fecha').textContent = `${state.fecha} a las ${state.horaInicio?.slice(0, 5)}`;
    document.getElementById('sum-total').textContent = `$${Number(state.servicioObj?.precio || 0).toFixed(2)}`;

    const form = document.getElementById('booking-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        state.nombre = document.getElementById('cli-nombre').value;
        state.telefono = document.getElementById('cli-telefono').value;
        state.email = document.getElementById('cli-email').value;
        state.notas = document.getElementById('cli-notas').value;

        const btnSubmit = document.getElementById('btn-confirmar-reserva');
        btnSubmit.textContent = 'Procesando reserva...';
        btnSubmit.setAttribute('disabled', 'true');

        // Llamar RPC crear_reserva_publica
        const { data: citaId, error } = await supabase.rpc('crear_reserva_publica', {
            p_nombre: state.nombre,
            p_telefono: state.telefono,
            p_email: state.email || null,
            p_servicio_id: state.servicioId,
            p_peluquero_id: state.peluqueroId,
            p_fecha: state.fecha,
            p_hora_inicio: state.horaInicio,
            p_notas: state.notas || null
        });

        if (error) {
            alert('Error al procesar la reserva: ' + error.message);
            btnSubmit.textContent = 'Confirmar Reserva';
            btnSubmit.removeAttribute('disabled');
            return;
        }

        // Mostrar éxito
        document.getElementById('booking-container').innerHTML = `
            <div style="text-align: center; padding: 3rem 0;">
                <i class="ph ph-check-circle" style="font-size: 4rem; color: var(--color-success); margin-bottom: 1rem;"></i>
                <h2 style="margin-bottom: 1rem;">¡Reserva Confirmada con Éxito!</h2>
                <p style="color: var(--color-text-secondary); max-width: 500px; margin: 0 auto 2rem auto;">
                    Hemos registrado tu cita en <strong>MAISON AURUM</strong>. Te hemos enviado los detalles a tu WhatsApp / Teléfono. ¡Te esperamos!
                </p>
                <a href="index.html" class="btn-gold">Volver al Inicio</a>
            </div>
        `;
    };
}