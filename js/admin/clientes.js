// ============================================================================
// GESTIÓN DE CLIENTES
// Archivo: js/admin/clientes.js  (usa admin/clientes.html)
// ============================================================================
import { supabase } from '../supabaseClient.js';
import { checkAdminAuth } from '../auth.js';
import {
    escapeHTML, formatMoney, formatDate, formatTime, toISODate,
    showToast, confirmDialog, setLoading, debounce, downloadCSV, renderSidebar
} from './utils.js';

const $ = (id) => document.getElementById(id);
const PAGE_SIZE = 25;

const ESTADOS = {
    pendiente: { texto: 'Pendiente', color: '#878787' },
    confirmada: { texto: 'Confirmada', color: '#5E5E5E' },
    completada: { texto: 'Completada', color: '#363636' },
    cancelada: { texto: 'Cancelada', color: '#878787' }
};

const state = {
    clientes: [],
    stats: new Map(), // cliente_id -> { visitas, gasto, ultima, citas }
    servicios: [],
    peluqueros: [],
    pagina: 1,
    detalleId: null
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

window.cerrarModalCliente = () => cerrarModal($('modal-cliente'));
window.cerrarModalClienteDetalle = () => cerrarModal($('modal-cliente-detalle'));

const buscarCliente = (id) => state.clientes.find((c) => c.id === id);
const statsDe = (id) => state.stats.get(id) || { visitas: 0, gasto: 0, ultima: null, citas: 0 };

// ---------------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------------
async function init() {
    renderSidebar('clientes');
    const user = await checkAdminAuth();
    if (!user) return;

    bindEventos();
    await cargarDatos();
    render();
}

init().catch((err) => {
    console.error('Error al iniciar la página de clientes:', err);
    showToast('Error al iniciar la página.', 'error');
});

// ---------------------------------------------------------------------------
// Carga de datos
// ---------------------------------------------------------------------------
async function cargarDatos() {
    $('clientes-tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;opacity:.7;">Cargando clientes...</td></tr>';
    try {
        const [clientes, citas, servicios, peluqueros] = await Promise.all([
            fetchAll(() => supabase.from('clientes').select('*').order('nombre').order('id')),
            fetchAll(() => supabase.from('citas').select('id, cliente_id, fecha, estado, precio_cobrado').order('id')),
            fetchAll(() => supabase.from('servicios').select('id, nombre').order('id')),
            fetchAll(() => supabase.from('peluqueros').select('id, nombre').order('id'))
        ]);

        state.clientes = clientes;
        state.servicios = servicios;
        state.peluqueros = peluqueros;
        state.stats = new Map();
        for (const c of citas) {
            if (!c.cliente_id) continue;
            const s = state.stats.get(c.cliente_id) || { visitas: 0, gasto: 0, ultima: null, citas: 0 };
            s.citas += 1;
            if (c.estado === 'completada') {
                s.visitas += 1;
                s.gasto += Number(c.precio_cobrado) || 0;
                const f = String(c.fecha).slice(0, 10);
                if (!s.ultima || f > s.ultima) s.ultima = f;
            }
            state.stats.set(c.cliente_id, s);
        }
    } catch (err) {
        console.error('Error al cargar los clientes:', err);
        $('clientes-tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:#363636;font-weight:600;">No se pudieron cargar los clientes. Revisa la consola (F12).</td></tr>';
        throw err;
    }
}

// ---------------------------------------------------------------------------
// Listado
// ---------------------------------------------------------------------------
function filtradosOrdenados() {
    const q = $('search-clientes').value.trim().toLowerCase();
    const lista = state.clientes.filter((c) =>
        !q || `${c.nombre || ''} ${c.telefono || ''} ${c.email || ''}`.toLowerCase().includes(q)
    );
    const orden = $('orden-clientes').value;
    const porNombre = (a, b) => String(a.nombre).localeCompare(String(b.nombre));

    lista.sort((a, b) => {
        const sa = statsDe(a.id);
        const sb = statsDe(b.id);
        if (orden === 'gasto') return (sb.gasto - sa.gasto) || porNombre(a, b);
        if (orden === 'visitas') return (sb.visitas - sa.visitas) || porNombre(a, b);
        if (orden === 'ultima') return String(sb.ultima || '').localeCompare(String(sa.ultima || '')) || porNombre(a, b);
        if (orden === 'registro') return String(b.created_at || '').localeCompare(String(a.created_at || '')) || porNombre(a, b);
        return porNombre(a, b);
    });
    return lista;
}

const boton = (accion, id, icono, titulo) =>
    `<button type="button" class="btn-outline" data-accion="${accion}" data-id="${escapeHTML(id)}" title="${titulo}" style="padding:.35rem .6rem;font-size:.8rem;"><i class="ph ph-${icono}"></i></button>`;

function filaCliente(c) {
    const s = statsDe(c.id);
    return `
        <tr>
            <td>${escapeHTML(c.nombre)}${c.email ? `<br><small style="opacity:.6;">${escapeHTML(c.email)}</small>` : ''}</td>
            <td>${escapeHTML(c.telefono || '—')}</td>
            <td>${s.visitas}</td>
            <td>${formatMoney(s.gasto)}</td>
            <td>${s.ultima ? escapeHTML(formatDate(s.ultima)) : '—'}</td>
            <td>
                <div style="display:flex;justify-content:flex-end;gap:.4rem;">
                    ${boton('ver', c.id, 'clock-counter-clockwise', 'Ver historial')}
                    ${boton('editar', c.id, 'pencil-simple', 'Editar')}
                    ${boton('eliminar', c.id, 'trash', 'Eliminar')}
                </div>
            </td>
        </tr>`;
}

function render() {
    const tbody = $('clientes-tbody');
    const lista = filtradosOrdenados();
    const visibles = lista.slice(0, state.pagina * PAGE_SIZE);
    $('clientes-resumen').textContent = `(${lista.length}${lista.length !== state.clientes.length ? ' de ' + state.clientes.length : ''})`;

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;opacity:.7;">No hay clientes que coincidan.</td></tr>';
        return;
    }
    let html = visibles.map(filaCliente).join('');
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
    $('btn-nuevo-cliente').addEventListener('click', () => abrirFormulario(null));
    $('btn-exportar-clientes').addEventListener('click', exportarCSV);

    const refrescar = () => { state.pagina = 1; render(); };
    $('search-clientes').addEventListener('input', debounce(refrescar, 250));
    $('orden-clientes').addEventListener('change', refrescar);

    $('clientes-tbody').addEventListener('click', (e) => {
        if (e.target.closest('[data-mas]')) {
            state.pagina += 1;
            render();
            return;
        }
        const btn = e.target.closest('button[data-accion]');
        if (!btn) return;
        const id = btn.dataset.id;
        if (btn.dataset.accion === 'ver') abrirDetalle(id);
        else if (btn.dataset.accion === 'editar') abrirFormulario(buscarCliente(id));
        else if (btn.dataset.accion === 'eliminar') eliminarCliente(id);
    });

    $('form-cliente').addEventListener('submit', guardarCliente);
    $('btn-detalle-editar').addEventListener('click', () => {
        const c = buscarCliente(state.detalleId);
        cerrarModal($('modal-cliente-detalle'));
        if (c) abrirFormulario(c);
    });

    ['modal-cliente', 'modal-cliente-detalle'].forEach((id) => {
        $(id).addEventListener('click', (e) => { if (e.target === $(id)) cerrarModal($(id)); });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cerrarModal($('modal-cliente'));
            cerrarModal($('modal-cliente-detalle'));
        }
    });
}

// ---------------------------------------------------------------------------
// Detalle e historial
// ---------------------------------------------------------------------------
async function abrirDetalle(id) {
    const c = buscarCliente(id);
    if (!c) return;
    state.detalleId = id;
    const s = statsDe(id);
    const ticket = s.visitas ? s.gasto / s.visitas : 0;

    $('detalle-cliente-titulo').textContent = c.nombre;
    $('detalle-cliente-resumen').innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.75rem;margin-bottom:1rem;">
            ${[['Visitas', s.visitas], ['Gasto total', formatMoney(s.gasto)], ['Ticket promedio', formatMoney(ticket)], ['Última visita', s.ultima ? formatDate(s.ultima) : '—']]
                .map(([k, v]) => `<div style="padding:.7rem .9rem;border:1px solid #878787;border-radius:8px;background:#D3D3D3;">
                    <div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;opacity:.6;">${k}</div>
                    <div style="font-size:1.05rem;margin-top:.2rem;">${escapeHTML(v)}</div></div>`).join('')}
        </div>
        <p style="margin:.25rem 0;font-size:.9rem;"><span style="opacity:.6;">Teléfono:</span> ${escapeHTML(c.telefono || '—')}
            &nbsp;·&nbsp; <span style="opacity:.6;">Correo:</span> ${escapeHTML(c.email || '—')}</p>
        <p style="margin:.25rem 0;font-size:.9rem;"><span style="opacity:.6;">Notas:</span> ${escapeHTML(c.notas || '—')}</p>`;

    const tbody = $('detalle-cliente-historial');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1rem;opacity:.7;">Cargando historial...</td></tr>';
    abrirModal($('modal-cliente-detalle'));

    try {
        const { data, error } = await supabase.from('citas').select('*')
            .eq('cliente_id', id)
            .order('fecha', { ascending: false }).order('hora_inicio', { ascending: false })
            .limit(200);
        if (error) throw error;

        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1rem;opacity:.7;">Este cliente aún no tiene citas.</td></tr>';
            return;
        }
        const nombreServicio = (sid) => (state.servicios.find((x) => x.id === sid) || {}).nombre || '—';
        const nombrePeluquero = (pid) => (state.peluqueros.find((x) => x.id === pid) || {}).nombre || '—';
        tbody.innerHTML = data.map((cita) => {
            const e = ESTADOS[cita.estado] || ESTADOS.pendiente;
            return `<tr>
                <td>${escapeHTML(formatDate(cita.fecha))}<br><small style="opacity:.6;">${formatTime(cita.hora_inicio)}</small></td>
                <td>${escapeHTML(nombreServicio(cita.servicio_id))}</td>
                <td>${escapeHTML(nombrePeluquero(cita.peluquero_id))}</td>
                <td><span style="color:${e.color};font-size:.8rem;">● ${e.texto}</span></td>
                <td style="text-align:right;">${cita.precio_cobrado != null ? formatMoney(cita.precio_cobrado) : '—'}</td>
            </tr>`;
        }).join('');
    } catch (err) {
        console.error('Error al cargar el historial del cliente:', err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1rem;color:#363636;font-weight:600;">No se pudo cargar el historial.</td></tr>';
    }
}

// ---------------------------------------------------------------------------
// Alta y edición
// ---------------------------------------------------------------------------
function abrirFormulario(c) {
    $('form-cliente').reset();
    $('modal-cliente-titulo').textContent = c ? 'Editar Cliente' : 'Nuevo Cliente';
    $('cli-id').value = c ? c.id : '';
    $('cli-nombre').value = c ? (c.nombre || '') : '';
    $('cli-telefono').value = c ? (c.telefono || '') : '';
    $('cli-email').value = c ? (c.email || '') : '';
    $('cli-notas').value = c ? (c.notas || '') : '';
    abrirModal($('modal-cliente'));
    $('cli-nombre').focus();
}

async function guardarCliente(e) {
    e.preventDefault();
    const btn = e.submitter || $('form-cliente').querySelector('[type="submit"]');
    const id = $('cli-id').value;
    const nombre = $('cli-nombre').value.trim();
    const telefono = $('cli-telefono').value.trim();
    const email = $('cli-email').value.trim() || null;
    const notas = $('cli-notas').value.trim() || null;

    if (!nombre || !telefono) { showToast('Nombre y teléfono son obligatorios.', 'error'); return; }

    setLoading(btn, true, 'Guardando...');
    try {
        const repetido = state.clientes.find((c) => c.id !== id && c.telefono === telefono);
        if (repetido) {
            const seguir = await confirmDialog(
                `Ya existe un cliente con ese teléfono (${repetido.nombre}). ¿Guardar de todos modos?`,
                { textoOk: 'Guardar igual' }
            );
            if (!seguir) return;
        }

        if (id) {
            const { data, error } = await supabase.from('clientes')
                .update({ nombre, telefono, email, notas }).eq('id', id).select('id');
            if (error) throw error;
            if (!data || data.length === 0) throw new Error('No se actualizó ninguna fila (revisa tus permisos de administrador).');
        } else {
            const { error } = await supabase.from('clientes')
                .insert([{ id: crypto.randomUUID(), nombre, telefono, email, notas }]);
            if (error) throw error;
        }

        cerrarModal($('modal-cliente'));
        showToast('Cliente guardado.', 'exito');
        await cargarDatos();
        render();
    } catch (err) {
        console.error('Error al guardar el cliente:', err);
        showToast('No se pudo guardar: ' + (err.message || 'error desconocido'), 'error');
    } finally {
        setLoading(btn, false);
    }
}

async function eliminarCliente(id) {
    const c = buscarCliente(id);
    if (!c) return;
    const s = statsDe(id);

    if (s.citas > 0) {
        showToast(`${c.nombre} tiene ${s.citas} cita(s) registradas. Para conservar el historial y la contabilidad no se puede eliminar.`, 'info');
        return;
    }
    const ok = await confirmDialog(`¿Eliminar definitivamente a ${c.nombre}? Esta acción no se puede deshacer.`, { textoOk: 'Eliminar' });
    if (!ok) return;

    try {
        const { data, error } = await supabase.from('clientes').delete().eq('id', id).select('id');
        if (error) {
            if (error.code === '23503') {
                showToast('Tiene registros asociados y no se puede eliminar.', 'error');
                return;
            }
            throw error;
        }
        if (!data || data.length === 0) throw new Error('No se eliminó ninguna fila (revisa tus permisos).');
        showToast('Cliente eliminado.', 'exito');
        await cargarDatos();
        render();
    } catch (err) {
        console.error('Error al eliminar el cliente:', err);
        showToast('No se pudo eliminar: ' + (err.message || 'error'), 'error');
    }
}

// ---------------------------------------------------------------------------
// Exportar
// ---------------------------------------------------------------------------
function exportarCSV() {
    const filas = filtradosOrdenados().map((c) => {
        const s = statsDe(c.id);
        return {
            nombre: c.nombre,
            telefono: c.telefono || '',
            correo: c.email || '',
            visitas: s.visitas,
            gasto_total: s.gasto.toFixed(2),
            ultima_visita: s.ultima || '',
            notas: c.notas || ''
        };
    });
    downloadCSV(`clientes-${toISODate()}`, filas);
}