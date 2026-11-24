// ============================================================================
// GESTIÓN DEL EQUIPO DE ESTILISTAS
// Archivo: js/admin/equipo.js  (usa admin/equipo.html)
// ============================================================================
import { supabase } from '../supabaseClient.js';
import { checkAdminAuth } from '../auth.js';
import {
    escapeHTML, formatMoney, showToast, confirmDialog, setLoading,
    debounce, uploadImage, renderSidebar, getDateRange, toISODate
} from './utils.js';

const BUCKET = 'salon-media';
const PAGE_SIZE = 20;
const $ = (id) => document.getElementById(id);

// Dias de la semana. 'dow' = 0..6 (0 = domingo), 'iso' = 1..7 (7 = domingo).
// Se detecta automaticamente mirando los horarios ya guardados.
const DIAS = [
    { nombre: 'Lunes', dow: 1, iso: 1 },
    { nombre: 'Martes', dow: 2, iso: 2 },
    { nombre: 'Miércoles', dow: 3, iso: 3 },
    { nombre: 'Jueves', dow: 4, iso: 4 },
    { nombre: 'Viernes', dow: 5, iso: 5 },
    { nombre: 'Sábado', dow: 6, iso: 6 },
    { nombre: 'Domingo', dow: 0, iso: 7 }
];

const state = {
    peluqueros: [],
    servicios: [],
    relaciones: new Map(), // peluquero_id -> Set(servicio_id)
    pagina: 1,
    colComision: 'comision_pct', // se detecta al cargar los datos
    convDias: 'dow'
};

// ---------------------------------------------------------------------------
// Utilidades locales
// ---------------------------------------------------------------------------
async function fetchAll(construir) {
    // Supabase devuelve maximo 1000 filas por consulta: se pagina.
    const filas = [];
    const paso = 1000;
    for (let desde = 0; ; desde += paso) {
        const { data, error } = await construir().range(desde, desde + paso - 1);
        if (error) throw error;
        filas.push(...data);
        if (data.length < paso) break;
    }
    return filas;
}

function abrirModal(el) {
    el.classList.add('active', 'open', 'show');
    el.style.display = 'flex';
}

function cerrarModal(el) {
    el.classList.remove('active', 'open', 'show');
    el.style.display = 'none';
}

window.cerrarModalPeluquero = () => cerrarModal($('modal-peluquero'));
window.cerrarModalHorarios = () => cerrarModal($('modal-horarios'));

const buscarPeluquero = (id) => state.peluqueros.find((p) => p.id === id);

// ---------------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------------
async function init() {
    renderSidebar('equipo');
    const user = await checkAdminAuth();
    if (!user) return;

    $('rendimiento-mes').value = toISODate().slice(0, 7);
    bindEventos();
    await cargarDatos();
    render();
    await cargarRendimiento();
}

init().catch((err) => {
    console.error('Error al iniciar la página de equipo:', err);
    showToast('Error al iniciar la página.', 'error');
});

// ---------------------------------------------------------------------------
// Carga de datos
// ---------------------------------------------------------------------------
async function cargarDatos() {
    const tbody = $('peluqueros-tbody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;opacity:.7;">Cargando equipo...</td></tr>';

    try {
        const [peluqueros, servicios, relaciones, dias] = await Promise.all([
            fetchAll(() => supabase.from('peluqueros').select('*').order('nombre').order('id')),
            fetchAll(() => supabase.from('servicios').select('id, nombre, activo, orden, categorias(nombre)').order('orden').order('id')),
            fetchAll(() => supabase.from('peluquero_servicios').select('peluquero_id, servicio_id').order('peluquero_id').order('servicio_id')),
            supabase.from('horarios_peluquero').select('dia_semana').limit(1000)
        ]);

        state.peluqueros = peluqueros;
        state.servicios = servicios;
        state.relaciones = new Map();
        for (const r of relaciones) {
            if (!state.relaciones.has(r.peluquero_id)) state.relaciones.set(r.peluquero_id, new Set());
            state.relaciones.get(r.peluquero_id).add(r.servicio_id);
        }

        // Nombre real de la columna de comision (comision_pct, comision, etc.)
        const muestra = peluqueros[0] || {};
        const col = Object.keys(muestra).find((k) => k.toLowerCase().startsWith('comision'));
        if (col) state.colComision = col;

        // Convencion de dias: si aparece el 7, es ISO (domingo = 7); si no, 0..6.
        const valores = new Set((dias.data || []).map((d) => d.dia_semana));
        state.convDias = valores.has(7) ? 'iso' : 'dow';

        // Filtro por servicio
        const select = $('filtro-servicio-peluquero');
        const actual = select.value;
        select.innerHTML = '<option value="">Filtrar por servicio...</option>' +
            servicios.map((s) => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.nombre)}</option>`).join('');
        select.value = actual;
    } catch (err) {
        console.error('Error al cargar el equipo:', err);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:#363636;font-weight:600;">No se pudo cargar el equipo. Revisa la consola (F12).</td></tr>';
        throw err;
    }
}

// ---------------------------------------------------------------------------
// Listado
// ---------------------------------------------------------------------------
function filtrados() {
    const q = $('search-peluqueros').value.trim().toLowerCase();
    const estado = $('filtro-estado-peluquero').value;
    const servicio = $('filtro-servicio-peluquero').value;
    return state.peluqueros.filter((p) => {
        if (q && !`${p.nombre || ''} ${p.especialidad || ''}`.toLowerCase().includes(q)) return false;
        if (estado !== '' && String(!!p.activo) !== estado) return false;
        if (servicio && !(state.relaciones.get(p.id) && state.relaciones.get(p.id).has(servicio))) return false;
        return true;
    });
}

const boton = (accion, id, icono, titulo) =>
    `<button type="button" class="btn-outline" data-accion="${accion}" data-id="${escapeHTML(id)}" title="${titulo}" style="padding:.35rem .6rem;font-size:.8rem;"><i class="ph ph-${icono}"></i></button>`;

function filaPeluquero(p) {
    const pct = Number(p[state.colComision]);
    const cantServicios = state.relaciones.get(p.id) ? state.relaciones.get(p.id).size : 0;
    const inicial = escapeHTML((p.nombre || '?').trim().charAt(0).toUpperCase());
    const foto = p.foto_url
        ? `<img src="${escapeHTML(p.foto_url)}" alt="" style="width:44px;height:44px;border-radius:50%;object-fit:cover;">`
        : `<div style="width:44px;height:44px;border-radius:50%;background:rgba(94,94,94,.15);color:#363636;display:flex;align-items:center;justify-content:center;font-weight:600;">${inicial}</div>`;
    const estado = p.activo
        ? '<span style="color:#363636;font-size:.8rem;font-weight:600;">● Activo</span>'
        : '<span style="color:#878787;font-size:.8rem;">● Inactivo</span>';

    return `
        <tr>
            <td>${foto}</td>
            <td>${escapeHTML(p.nombre)}<br><small style="opacity:.6;">${cantServicios} servicio${cantServicios === 1 ? '' : 's'}</small></td>
            <td>${escapeHTML(p.especialidad || '—')}</td>
            <td>${Number.isFinite(pct) ? pct + ' %' : '—'}</td>
            <td>${estado}</td>
            <td>
                <div style="display:flex;justify-content:flex-end;gap:.4rem;">
                    ${boton('editar', p.id, 'pencil-simple', 'Editar')}
                    ${boton('horario', p.id, 'clock', 'Horario semanal')}
                    ${boton('estado', p.id, p.activo ? 'eye-slash' : 'eye', p.activo ? 'Desactivar' : 'Activar')}
                    ${boton('eliminar', p.id, 'trash', 'Eliminar')}
                </div>
            </td>
        </tr>`;
}

function render() {
    const tbody = $('peluqueros-tbody');
    const lista = filtrados();
    const visibles = lista.slice(0, state.pagina * PAGE_SIZE);

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;opacity:.7;">No hay especialistas que coincidan.</td></tr>';
        return;
    }

    let html = visibles.map(filaPeluquero).join('');
    if (lista.length > visibles.length) {
        html += `<tr><td colspan="6" style="text-align:center;padding:1rem;">
            <button type="button" class="btn-outline" data-mas="1">Mostrar más (${lista.length - visibles.length} restantes)</button>
        </td></tr>`;
    }
    tbody.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------
function bindEventos() {
    $('btn-nuevo-peluquero').addEventListener('click', () => abrirFormulario(null));

    const refrescar = () => { state.pagina = 1; render(); };
    $('search-peluqueros').addEventListener('input', debounce(refrescar, 250));
    $('filtro-estado-peluquero').addEventListener('change', refrescar);
    $('filtro-servicio-peluquero').addEventListener('change', refrescar);
    $('rendimiento-mes').addEventListener('change', cargarRendimiento);

    $('peluqueros-tbody').addEventListener('click', (e) => {
        if (e.target.closest('[data-mas]')) {
            state.pagina += 1;
            render();
            return;
        }
        const btn = e.target.closest('button[data-accion]');
        if (!btn) return;
        const id = btn.dataset.id;
        switch (btn.dataset.accion) {
            case 'editar': abrirFormulario(buscarPeluquero(id)); break;
            case 'horario': abrirHorarios(id); break;
            case 'estado': alternarEstado(id); break;
            case 'eliminar': eliminarPeluquero(id); break;
        }
    });

    $('form-peluquero').addEventListener('submit', guardarPeluquero);
    $('form-horarios').addEventListener('submit', guardarHorarios);

    $('pel-foto-file').addEventListener('change', () => {
        const archivo = $('pel-foto-file').files[0];
        mostrarPreview(archivo ? URL.createObjectURL(archivo) : $('pel-foto-url').value);
    });

    // Marcar / desmarcar todos los servicios
    $('pel-servicios-checkboxes').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-marcar]');
        if (!btn) return;
        const marcar = btn.dataset.marcar === 'todos';
        $('pel-servicios-checkboxes').querySelectorAll('input[type="checkbox"]').forEach((c) => { c.checked = marcar; });
    });

    // Tramos y dias del horario
    const cont = $('horarios-dias-container');
    cont.addEventListener('click', (e) => {
        const fila = e.target.closest('.hd-fila');
        if (!fila) return;
        if (e.target.closest('.hd-add')) {
            fila.querySelector('.hd-tramos').insertAdjacentHTML('beforeend', htmlTramo('14:00', '18:00'));
            actualizarEstadoFila(fila);
        } else if (e.target.closest('.hd-del')) {
            const tramos = fila.querySelectorAll('.hd-tramo');
            if (tramos.length > 1) e.target.closest('.hd-tramo').remove();
            else showToast('Cada día necesita al menos un tramo. Desmarca el día si no trabaja.', 'info');
        }
    });
    cont.addEventListener('change', (e) => {
        if (e.target.classList.contains('hd-trabaja')) actualizarEstadoFila(e.target.closest('.hd-fila'));
    });

    // Cerrar modales con clic en el fondo o con Escape
    ['modal-peluquero', 'modal-horarios'].forEach((id) => {
        $(id).addEventListener('click', (e) => { if (e.target === $(id)) cerrarModal($(id)); });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cerrarModal($('modal-peluquero'));
            cerrarModal($('modal-horarios'));
        }
    });
}

// ---------------------------------------------------------------------------
// Formulario de especialista
// ---------------------------------------------------------------------------
function mostrarPreview(src) {
    const img = $('pel-foto-preview');
    if (src) {
        img.src = src;
        img.style.display = 'block';
    } else {
        img.removeAttribute('src');
        img.style.display = 'none';
    }
}

function renderCheckboxesServicios(seleccion) {
    const cont = $('pel-servicios-checkboxes');
    if (state.servicios.length === 0) {
        cont.innerHTML = '<p style="opacity:.7;font-size:.85rem;">Aún no hay servicios creados.</p>';
        return;
    }
    const grupos = new Map();
    for (const s of state.servicios) {
        const categoria = (s.categorias && s.categorias.nombre) || 'Sin categoría';
        if (!grupos.has(categoria)) grupos.set(categoria, []);
        grupos.get(categoria).push(s);
    }
    const acciones = `
        <div style="display:flex;gap:.5rem;margin-bottom:.75rem;">
            <button type="button" class="btn-outline" data-marcar="todos" style="padding:.25rem .6rem;font-size:.7rem;">Marcar todos</button>
            <button type="button" class="btn-outline" data-marcar="ninguno" style="padding:.25rem .6rem;font-size:.7rem;">Desmarcar todos</button>
        </div>`;
    cont.innerHTML = acciones + [...grupos].map(([categoria, items]) => `
        <div style="margin-bottom:.75rem;">
            <div style="font-size:.7rem;text-transform:uppercase;letter-spacing:.12em;color:#363636;margin-bottom:.4rem;">${escapeHTML(categoria)}</div>
            ${items.map((s) => `
                <label style="display:flex;gap:.5rem;align-items:center;padding:.2rem 0;font-size:.85rem;cursor:pointer;">
                    <input type="checkbox" value="${escapeHTML(s.id)}" ${seleccion.has(s.id) ? 'checked' : ''}>
                    ${escapeHTML(s.nombre)}${s.activo === false ? ' <em style="opacity:.6;">(oculto)</em>' : ''}
                </label>`).join('')}
        </div>`).join('');
}

function abrirFormulario(p) {
    $('form-peluquero').reset();
    $('modal-peluquero-titulo').textContent = p ? 'Editar Especialista' : 'Nuevo Especialista';
    $('pel-id').value = p ? p.id : '';
    $('pel-nombre').value = p ? (p.nombre || '') : '';
    $('pel-especialidad').value = p ? (p.especialidad || '') : '';
    $('pel-telefono').value = p ? (p.telefono || '') : '';
    $('pel-bio').value = p ? (p.bio || '') : '';
    $('pel-comision').value = p ? (p[state.colComision] ?? 0) : 40;
    $('pel-activo').value = p ? String(!!p.activo) : 'true';
    $('pel-foto-url').value = p ? (p.foto_url || '') : '';
    mostrarPreview(p ? p.foto_url : '');
    renderCheckboxesServicios(p ? (state.relaciones.get(p.id) || new Set()) : new Set());
    abrirModal($('modal-peluquero'));
    $('pel-nombre').focus();
}

async function guardarPeluquero(e) {
    e.preventDefault();
    const btn = e.submitter || $('form-peluquero').querySelector('[type="submit"]');
    const id = $('pel-id').value;
    const nombre = $('pel-nombre').value.trim();
    const comision = parseFloat($('pel-comision').value);

    if (!nombre) { showToast('El nombre es obligatorio.', 'error'); return; }
    if (Number.isNaN(comision) || comision < 0 || comision > 100) {
        showToast('La comisión debe estar entre 0 y 100.', 'error');
        return;
    }

    setLoading(btn, true, 'Guardando...');
    try {
        let fotoUrl = $('pel-foto-url').value || null;
        const archivo = $('pel-foto-file').files[0];
        if (archivo) fotoUrl = await uploadImage(BUCKET, 'equipo', archivo);

        const datos = {
            nombre,
            especialidad: $('pel-especialidad').value.trim() || null,
            telefono: $('pel-telefono').value.trim() || null,
            bio: $('pel-bio').value.trim() || null,
            activo: $('pel-activo').value === 'true',
            foto_url: fotoUrl,
            [state.colComision]: comision
        };

        let pelId = id;
        if (id) {
            const { data, error } = await supabase.from('peluqueros').update(datos).eq('id', id).select('id');
            if (error) throw error;
            if (!data || data.length === 0) throw new Error('No se actualizó ninguna fila (revisa tus permisos de administrador).');
        } else {
            pelId = crypto.randomUUID();
            const { error } = await supabase.from('peluqueros').insert([{ id: pelId, ...datos }]);
            if (error) throw error;
        }

        await guardarServiciosDe(pelId);

        cerrarModal($('modal-peluquero'));
        showToast('Especialista guardado.', 'exito');
        await cargarDatos();
        render();
        await cargarRendimiento();
    } catch (err) {
        console.error('Error al guardar especialista:', err);
        showToast('No se pudo guardar: ' + (err.message || 'error desconocido'), 'error');
    } finally {
        setLoading(btn, false);
    }
}

async function guardarServiciosDe(pelId) {
    const marcados = new Set(
        [...$('pel-servicios-checkboxes').querySelectorAll('input[type="checkbox"]:checked')].map((c) => c.value)
    );
    const actuales = state.relaciones.get(pelId) || new Set();
    const borrar = [...actuales].filter((s) => !marcados.has(s));
    const agregar = [...marcados].filter((s) => !actuales.has(s));

    if (borrar.length) {
        const { error } = await supabase.from('peluquero_servicios')
            .delete().eq('peluquero_id', pelId).in('servicio_id', borrar);
        if (error) throw error;
    }
    if (agregar.length) {
        const { error } = await supabase.from('peluquero_servicios')
            .insert(agregar.map((servicio_id) => ({ peluquero_id: pelId, servicio_id })));
        if (error) throw error;
    }
}

// ---------------------------------------------------------------------------
// Activar / desactivar y eliminar
// ---------------------------------------------------------------------------
async function alternarEstado(id) {
    const p = buscarPeluquero(id);
    if (!p) return;
    const nuevo = !p.activo;
    try {
        const { data, error } = await supabase.from('peluqueros').update({ activo: nuevo }).eq('id', id).select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No se actualizó ninguna fila (revisa tus permisos).');
        p.activo = nuevo;
        render();
        showToast(nuevo ? `${p.nombre} ahora está activo.` : `${p.nombre} fue desactivado y ya no aparece en el sitio.`, 'exito');
    } catch (err) {
        console.error('Error al cambiar el estado:', err);
        showToast('No se pudo cambiar el estado: ' + (err.message || 'error'), 'error');
    }
}

async function eliminarPeluquero(id) {
    const p = buscarPeluquero(id);
    if (!p) return;

    try {
        const { count, error: errCount } = await supabase
            .from('citas').select('id', { count: 'exact', head: true }).eq('peluquero_id', id);
        if (errCount) throw errCount;

        if (count > 0) {
            const desactivar = await confirmDialog(
                `${p.nombre} tiene ${count} cita(s) registradas. Para conservar el historial no se puede eliminar, pero puedes desactivarlo para que deje de aparecer en el sitio y en las reservas.`,
                { textoOk: 'Desactivar' }
            );
            if (desactivar && p.activo) await alternarEstado(id);
            return;
        }

        const ok = await confirmDialog(
            `¿Eliminar definitivamente a ${p.nombre}? Esta acción no se puede deshacer.`,
            { textoOk: 'Eliminar' }
        );
        if (!ok) return;

        await supabase.from('peluquero_servicios').delete().eq('peluquero_id', id);
        await supabase.from('horarios_peluquero').delete().eq('peluquero_id', id);
        const { data, error } = await supabase.from('peluqueros').delete().eq('id', id).select('id');
        if (error) {
            if (error.code === '23503') {
                showToast('Tiene registros asociados (por ejemplo ingresos). Desactívalo en lugar de eliminarlo.', 'error');
                return;
            }
            throw error;
        }
        if (!data || data.length === 0) throw new Error('No se eliminó ninguna fila (revisa tus permisos).');

        showToast('Especialista eliminado.', 'exito');
        await cargarDatos();
        render();
        await cargarRendimiento();
    } catch (err) {
        console.error('Error al eliminar especialista:', err);
        showToast('No se pudo eliminar: ' + (err.message || 'error'), 'error');
    }
}

// ---------------------------------------------------------------------------
// Horario semanal
// ---------------------------------------------------------------------------
const valorDia = (d) => (state.convDias === 'iso' ? d.iso : d.dow);

function htmlTramo(inicio, fin) {
    return `
        <div class="hd-tramo" style="display:flex;gap:.5rem;align-items:center;">
            <input type="time" class="form-control hd-ini" value="${inicio}" style="width:auto;">
            <span>a</span>
            <input type="time" class="form-control hd-fin" value="${fin}" style="width:auto;">
            <button type="button" class="btn-outline hd-del" title="Quitar tramo" style="padding:.3rem .6rem;">×</button>
        </div>`;
}

function actualizarEstadoFila(fila) {
    const trabaja = fila.querySelector('.hd-trabaja').checked;
    fila.querySelectorAll('.hd-ini, .hd-fin, .hd-del, .hd-add').forEach((el) => { el.disabled = !trabaja; });
    fila.querySelector('.hd-tramos').style.opacity = trabaja ? '1' : '.4';
}

async function abrirHorarios(id) {
    const p = buscarPeluquero(id);
    if (!p) return;

    try {
        const { data, error } = await supabase
            .from('horarios_peluquero')
            .select('dia_semana, hora_inicio, hora_fin')
            .eq('peluquero_id', id)
            .order('hora_inicio');
        if (error) throw error;

        const porDia = new Map();
        for (const h of data) {
            if (!porDia.has(h.dia_semana)) porDia.set(h.dia_semana, []);
            porDia.get(h.dia_semana).push(h);
        }

        $('horario-peluquero-id').value = id;
        $('horario-modal-titulo').textContent = `Horario semanal · ${p.nombre}`;
        $('horarios-dias-container').innerHTML = DIAS.map((d) => {
            const tramos = porDia.get(valorDia(d)) || [];
            const trabaja = tramos.length > 0;
            const html = (trabaja ? tramos : [{ hora_inicio: '09:00', hora_fin: '18:00' }])
                .map((t) => htmlTramo(String(t.hora_inicio).slice(0, 5), String(t.hora_fin).slice(0, 5)))
                .join('');
            return `
                <div class="hd-fila" data-dia="${valorDia(d)}" data-nombre="${d.nombre}" style="display:flex;gap:1rem;align-items:flex-start;padding:.6rem 0;border-bottom:1px solid #878787;">
                    <label style="width:120px;display:flex;gap:.5rem;align-items:center;padding-top:.45rem;cursor:pointer;">
                        <input type="checkbox" class="hd-trabaja" ${trabaja ? 'checked' : ''}> ${d.nombre}
                    </label>
                    <div class="hd-tramos" style="flex:1;display:flex;flex-direction:column;gap:.4rem;">${html}</div>
                    <button type="button" class="btn-outline hd-add" style="padding:.3rem .7rem;font-size:.75rem;white-space:nowrap;">+ Tramo</button>
                </div>`;
        }).join('');

        $('horarios-dias-container').querySelectorAll('.hd-fila').forEach(actualizarEstadoFila);
        abrirModal($('modal-horarios'));
    } catch (err) {
        console.error('Error al cargar los horarios:', err);
        showToast('No se pudieron cargar los horarios: ' + (err.message || 'error'), 'error');
    }
}

async function guardarHorarios(e) {
    e.preventDefault();
    const btn = e.submitter || $('form-horarios').querySelector('[type="submit"]');
    const id = $('horario-peluquero-id').value;
    const nuevas = [];

    for (const fila of $('horarios-dias-container').querySelectorAll('.hd-fila')) {
        if (!fila.querySelector('.hd-trabaja').checked) continue;
        const nombreDia = fila.dataset.nombre;
        const dia = Number(fila.dataset.dia);
        const tramos = [...fila.querySelectorAll('.hd-tramo')].map((t) => ({
            ini: t.querySelector('.hd-ini').value,
            fin: t.querySelector('.hd-fin').value
        }));

        for (const t of tramos) {
            if (!t.ini || !t.fin || t.ini >= t.fin) {
                showToast(`${nombreDia}: la hora de fin debe ser posterior a la de inicio.`, 'error');
                return;
            }
        }
        tramos.sort((a, b) => a.ini.localeCompare(b.ini));
        for (let i = 1; i < tramos.length; i++) {
            if (tramos[i].ini < tramos[i - 1].fin) {
                showToast(`${nombreDia}: los tramos se cruzan entre sí.`, 'error');
                return;
            }
        }
        tramos.forEach((t) => nuevas.push({
            id: crypto.randomUUID(),
            peluquero_id: id,
            dia_semana: dia,
            hora_inicio: t.ini,
            hora_fin: t.fin
        }));
    }

    setLoading(btn, true, 'Guardando...');
    try {
        // Respaldo para restaurar si la insercion falla
        const { data: previos, error: errPrevios } = await supabase
            .from('horarios_peluquero').select('*').eq('peluquero_id', id);
        if (errPrevios) throw errPrevios;

        const { error: errDel } = await supabase.from('horarios_peluquero').delete().eq('peluquero_id', id);
        if (errDel) throw errDel;

        if (nuevas.length) {
            const { error: errIns } = await supabase.from('horarios_peluquero').insert(nuevas);
            if (errIns) {
                if (previos && previos.length) await supabase.from('horarios_peluquero').insert(previos);
                throw errIns;
            }
        }

        cerrarModal($('modal-horarios'));
        showToast('Horario guardado.', 'exito');
    } catch (err) {
        console.error('Error al guardar horarios:', err);
        showToast('No se pudo guardar el horario: ' + (err.message || 'error'), 'error');
    } finally {
        setLoading(btn, false);
    }
}

// ---------------------------------------------------------------------------
// Rendimiento por especialista (citas completadas del mes elegido)
// ---------------------------------------------------------------------------
async function cargarRendimiento() {
    const tbody = $('rendimiento-tbody');
    const mes = $('rendimiento-mes').value || toISODate().slice(0, 7);
    const { desde, hasta } = getDateRange('mes', mes);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1.5rem;opacity:.7;">Calculando...</td></tr>';

    try {
        const citas = await fetchAll(() => supabase
            .from('citas')
            .select('peluquero_id, precio_cobrado')
            .eq('estado', 'completada')
            .gte('fecha', desde)
            .lte('fecha', hasta)
            .order('id'));

        const acumulado = new Map();
        for (const c of citas) {
            if (!c.peluquero_id) continue;
            const a = acumulado.get(c.peluquero_id) || { n: 0, total: 0 };
            a.n += 1;
            a.total += Number(c.precio_cobrado) || 0;
            acumulado.set(c.peluquero_id, a);
        }

        const filas = state.peluqueros
            .map((p) => {
                const a = acumulado.get(p.id) || { n: 0, total: 0 };
                const pct = Number(p[state.colComision]) || 0;
                return { p, n: a.n, total: a.total, pct, comision: (a.total * pct) / 100 };
            })
            .filter((f) => f.n > 0 || f.p.activo)
            .sort((x, y) => y.total - x.total);

        if (filas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1.5rem;opacity:.7;">Sin datos para este mes.</td></tr>';
            return;
        }

        const totalGeneral = filas.reduce((s, f) => s + f.total, 0);
        const comisionGeneral = filas.reduce((s, f) => s + f.comision, 0);
        const cantGeneral = filas.reduce((s, f) => s + f.n, 0);

        tbody.innerHTML = filas.map((f) => `
            <tr>
                <td>${escapeHTML(f.p.nombre)}</td>
                <td>${f.pct} %</td>
                <td>${f.n}</td>
                <td>${formatMoney(f.total)}</td>
                <td>${formatMoney(f.comision)}</td>
            </tr>`).join('') + `
            <tr style="font-weight:600;border-top:1px solid #878787;">
                <td>Total</td><td></td><td>${cantGeneral}</td>
                <td>${formatMoney(totalGeneral)}</td><td>${formatMoney(comisionGeneral)}</td>
            </tr>`;
    } catch (err) {
        console.error('Error al calcular el rendimiento:', err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:#363636;font-weight:600;">No se pudo calcular el rendimiento. Revisa la consola (F12).</td></tr>';
    }
}