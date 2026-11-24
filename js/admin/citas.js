// ============================================================================
// AGENDA DE CITAS
// Archivo: js/admin/citas.js  (usa admin/citas.html)
// ============================================================================
import { supabase } from '../supabaseClient.js';
import { checkAdminAuth } from '../auth.js';
import {
    escapeHTML, formatMoney, formatDate, formatTime, toISODate,
    showToast, confirmDialog, setLoading, debounce, renderSidebar
} from './utils.js';

const $ = (id) => document.getElementById(id);

const ESTADOS = {
    pendiente: { texto: 'Pendiente', color: '#878787' },
    confirmada: { texto: 'Confirmada', color: '#5E5E5E' },
    completada: { texto: 'Completada', color: '#363636' },
    cancelada: { texto: 'Cancelada', color: '#878787' }
};
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const PASO_SLOTS = 30; // minutos entre horas sugeridas

const state = {
    vista: 'semana',
    fechaRef: new Date(),
    filtroPeluquero: '',
    filtroEstado: '',
    citas: [],
    pendientes: [],
    clientes: new Map(),
    servicios: [],
    peluqueros: [],
    relaciones: new Map(), // peluquero_id -> Set(servicio_id)
    convDias: 'dow',
    horariosCache: new Map(),
    slotToken: 0,
    busquedaToken: 0,
    modoCliente: 'buscar', // 'buscar' | 'seleccionado' | 'nuevo'
    clienteId: null
};
state.fechaRef.setHours(0, 0, 0, 0);

// ---------------------------------------------------------------------------
// Utilidades de fecha y hora (siempre en hora local)
// ---------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
const fechaLocal = (s) => {
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
};
const sumarDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const inicioSemana = (d) => sumarDias(d, -((d.getDay() + 6) % 7)); // lunes
const aMin = (h) => {
    const [hh, mm] = String(h).split(':').map(Number);
    return hh * 60 + mm;
};
const deMin = (n) => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;

function waLink(telefono) {
    let d = String(telefono || '').replace(/\D/g, '');
    if (d.length < 8) return null;
    if (d.startsWith('0')) d = '593' + d.slice(1);
    return `https://wa.me/${d}`;
}

// ---------------------------------------------------------------------------
// Utilidades generales
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

window.cerrarModalCita = () => cerrarModal($('modal-cita'));
window.cerrarModalDetalle = () => cerrarModal($('modal-detalle'));
window.cerrarModalCompletar = () => cerrarModal($('modal-completar'));

function injectStyles() {
    if (document.getElementById('citas-styles')) return;
    const style = document.createElement('style');
    style.id = 'citas-styles';
    style.textContent = `
    .cal-toolbar{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;justify-content:space-between;margin-bottom:1rem}
    .cal-nav{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}
    .cal-titulo{font-family:var(--font-serif,serif);font-size:1.1rem;min-width:200px;text-transform:capitalize;padding-left:.5rem}
    .cal-vistas{display:flex;gap:.25rem}
    .cal-vistas button.activa{background:rgba(94,94,94,.18);color:#363636;border-color:#363636}
    .cal-semana{display:grid;grid-template-columns:repeat(7,minmax(135px,1fr));gap:.5rem;overflow-x:auto}
    .cal-mes{display:grid;grid-template-columns:repeat(7,minmax(95px,1fr));gap:.4rem;overflow-x:auto}
    .cal-mes-cab{font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;opacity:.6;text-align:center;padding:.25rem}
    .cal-dia{background:#878787;border:1px solid #363636;border-radius:8px;min-height:170px;padding:.5rem;display:flex;flex-direction:column;gap:.35rem}
    .cal-celda{min-height:110px}
    .cal-dia.hoy{border-color:#363636}
    .cal-dia.fuera{opacity:.4}
    .cal-dia-cab{font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;opacity:.85;cursor:pointer;display:flex;justify-content:space-between}
    .cal-chip{display:block;width:100%;text-align:left;font-size:.74rem;line-height:1.3;padding:.3rem .45rem;border-radius:5px;border:0;border-left:3px solid var(--c,#878787);background:#D3D3D3;color:#000000;cursor:pointer;font-family:inherit}
    .cal-chip:hover{background:#5E5E5E;color:#D3D3D3}
    .cal-chip.cancelada{opacity:.55;text-decoration:line-through}
    .cal-mas{font-size:.7rem;opacity:.75;background:none;border:0;color:inherit;cursor:pointer;text-align:left;padding:0 .3rem;font-family:inherit}
    .cal-lista{display:flex;flex-direction:column;gap:.6rem}
    .cal-item{display:flex;gap:1rem;align-items:center;flex-wrap:wrap;padding:.8rem 1rem;border-radius:8px;background:#878787;border-left:4px solid var(--c,#878787)}
    .cal-item[data-cita]{cursor:pointer}
    .cal-item[data-cita]:hover{background:#5E5E5E;color:#D3D3D3}
    .cal-item .hora{min-width:120px;font-weight:600}
    .cal-item .info{flex:1;font-size:.9rem;min-width:180px}
    .cal-item .info small{opacity:.65;display:block}
    .cal-item .acciones{display:flex;gap:.4rem;flex-wrap:wrap}
    .cal-badge{font-size:.72rem;padding:.15rem .55rem;border-radius:999px;border:1px solid var(--c,#888);color:var(--c,#888);white-space:nowrap}
    .cal-vacio{text-align:center;padding:1.8rem;opacity:.65}
    .cal-chips-horas{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.3rem}
    .cal-hora-btn{padding:.3rem .7rem;font-size:.78rem;border-radius:999px;border:1px solid #363636;background:#D3D3D3;color:#000000;cursor:pointer;font-family:inherit}
    .cal-hora-btn:hover,.cal-hora-btn.sel{border-color:#5E5E5E;color:#5E5E5E}
    .cal-cliente-res{display:flex;flex-direction:column;gap:.25rem;margin-top:.4rem}
    .cal-cliente-res button{text-align:left;padding:.45rem .7rem;border-radius:6px;border:1px solid #363636;background:#D3D3D3;color:#000000;cursor:pointer;font-family:inherit;font-size:.85rem}
    .cal-cliente-res button:hover{border-color:#5E5E5E}
    .cal-detalle dl{display:grid;grid-template-columns:130px 1fr;gap:.6rem 1rem;margin:0}
    .cal-detalle dt{opacity:.6;font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;padding-top:.15rem}
    .cal-detalle dd{margin:0}
    `;
    document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Busquedas en memoria
// ---------------------------------------------------------------------------
const servicioDe = (id) => state.servicios.find((s) => s.id === id);
const peluqueroDe = (id) => state.peluqueros.find((p) => p.id === id);
const nombreCliente = (id) => (state.clientes.get(id) && state.clientes.get(id).nombre) || 'Cliente';
const buscarCita = (id) =>
    state.citas.find((c) => c.id === id) || state.pendientes.find((c) => c.id === id);

// ---------------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------------
async function init() {
    injectStyles();
    renderSidebar('citas');
    const user = await checkAdminAuth();
    if (!user) return;

    bindEventos();
    await cargarReferencias();
    await refrescar();
}

init().catch((err) => {
    console.error('Error al iniciar la agenda:', err);
    showToast('Error al iniciar la página.', 'error');
});

// ---------------------------------------------------------------------------
// Carga de datos
// ---------------------------------------------------------------------------
async function cargarReferencias() {
    const [servicios, peluqueros, relaciones, dias] = await Promise.all([
        fetchAll(() => supabase.from('servicios').select('id, nombre, precio, duracion_min, activo, orden').order('orden').order('id')),
        fetchAll(() => supabase.from('peluqueros').select('id, nombre, activo').order('nombre').order('id')),
        fetchAll(() => supabase.from('peluquero_servicios').select('peluquero_id, servicio_id').order('peluquero_id').order('servicio_id')),
        supabase.from('horarios_peluquero').select('dia_semana').limit(1000)
    ]);

    state.servicios = servicios;
    state.peluqueros = peluqueros;
    state.relaciones = new Map();
    for (const r of relaciones) {
        if (!state.relaciones.has(r.peluquero_id)) state.relaciones.set(r.peluquero_id, new Set());
        state.relaciones.get(r.peluquero_id).add(r.servicio_id);
    }

    // Convencion de dias: si aparece el 7 es ISO (domingo = 7); si no, 0..6.
    const valores = new Set((dias.data || []).map((d) => d.dia_semana));
    state.convDias = valores.has(7) ? 'iso' : 'dow';

    $('filtro-peluquero-cita').innerHTML = '<option value="">Todos los especialistas</option>' +
        peluqueros.map((p) => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.nombre)}${p.activo ? '' : ' (inactivo)'}</option>`).join('');
}

async function asegurarClientes(ids) {
    const faltan = [...new Set(ids.filter(Boolean))].filter((id) => !state.clientes.has(id));
    for (let i = 0; i < faltan.length; i += 100) {
        const lote = faltan.slice(i, i + 100);
        const { data, error } = await supabase.from('clientes').select('id, nombre, telefono, email').in('id', lote);
        if (error) throw error;
        data.forEach((c) => state.clientes.set(c.id, c));
    }
}

function rango() {
    const ref = state.fechaRef;
    if (state.vista === 'dia') return { desde: ref, hasta: ref };
    if (state.vista === 'semana') {
        const ini = inicioSemana(ref);
        return { desde: ini, hasta: sumarDias(ini, 6) };
    }
    const primero = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const ultimo = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    return { desde: inicioSemana(primero), hasta: sumarDias(inicioSemana(ultimo), 6) };
}

async function cargarCitas() {
    const { desde, hasta } = rango();
    state.citas = await fetchAll(() => {
        let q = supabase.from('citas').select('*')
            .gte('fecha', toISODate(desde)).lte('fecha', toISODate(hasta))
            .order('fecha').order('hora_inicio').order('id');
        if (state.filtroPeluquero) q = q.eq('peluquero_id', state.filtroPeluquero);
        if (state.filtroEstado) q = q.eq('estado', state.filtroEstado);
        return q;
    });
    await asegurarClientes(state.citas.map((c) => c.cliente_id));
}

async function cargarPendientes() {
    let q = supabase.from('citas').select('*')
        .eq('estado', 'pendiente').gte('fecha', toISODate())
        .order('fecha').order('hora_inicio').limit(50);
    if (state.filtroPeluquero) q = q.eq('peluquero_id', state.filtroPeluquero);
    const { data, error } = await q;
    if (error) throw error;
    state.pendientes = data || [];
    await asegurarClientes(state.pendientes.map((c) => c.cliente_id));
}

async function refrescar() {
    const cont = $('calendario');
    cont.innerHTML = '<div class="cal-vacio">Cargando citas...</div>';
    try {
        await Promise.all([cargarCitas(), cargarPendientes()]);
        render();
    } catch (err) {
        console.error('Error al cargar las citas:', err);
        cont.innerHTML = '<div class="cal-vacio" style="color:#363636;font-weight:600;">No se pudieron cargar las citas. Revisa la consola (F12).</div>';
    }
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function render() {
    renderTitulo();
    const cont = $('calendario');
    if (state.vista === 'dia') renderDia(cont);
    else if (state.vista === 'semana') renderSemana(cont);
    else renderMes(cont);
    renderPendientes();
}

function renderTitulo() {
    const { desde, hasta } = rango();
    let titulo;
    if (state.vista === 'dia') {
        titulo = state.fechaRef.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } else if (state.vista === 'semana') {
        titulo = `${desde.toLocaleDateString('es-EC', { day: 'numeric', month: 'short' })} – ${hasta.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else {
        titulo = state.fechaRef.toLocaleDateString('es-EC', { month: 'long', year: 'numeric' });
    }
    $('cal-titulo').textContent = titulo;
    document.querySelectorAll('.cal-vistas button').forEach((b) => {
        b.classList.toggle('activa', b.dataset.vista === state.vista);
    });

    const mes = toISODate(state.fechaRef).slice(0, 7);
    const lista = state.vista === 'mes' ? state.citas.filter((c) => String(c.fecha).slice(0, 7) === mes) : state.citas;
    const pend = lista.filter((c) => c.estado === 'pendiente').length;
    $('cal-resumen').textContent = `${lista.length} cita${lista.length === 1 ? '' : 's'} en el periodo` +
        (pend ? ` · ${pend} pendiente${pend === 1 ? '' : 's'}` : '');
}

function chip(c) {
    const e = ESTADOS[c.estado] || ESTADOS.pendiente;
    const s = servicioDe(c.servicio_id);
    return `<button type="button" class="cal-chip ${escapeHTML(c.estado)}" style="--c:${e.color}" data-cita="${escapeHTML(c.id)}">
        <strong>${formatTime(c.hora_inicio)}</strong> ${escapeHTML(nombreCliente(c.cliente_id))}<br>
        <span style="opacity:.7;">${escapeHTML(s ? s.nombre : '')}</span>
    </button>`;
}

function itemDia(c) {
    const e = ESTADOS[c.estado] || ESTADOS.pendiente;
    const s = servicioDe(c.servicio_id);
    const p = peluqueroDe(c.peluquero_id);
    return `<div class="cal-item" style="--c:${e.color}" data-cita="${escapeHTML(c.id)}">
        <div class="hora">${formatTime(c.hora_inicio)} – ${formatTime(c.hora_fin)}</div>
        <div class="info"><strong>${escapeHTML(nombreCliente(c.cliente_id))}</strong>
            <small>${escapeHTML(s ? s.nombre : 'Servicio')} · ${escapeHTML(p ? p.nombre : 'Sin asignar')}</small></div>
        <span class="cal-badge" style="--c:${e.color}">${e.texto}</span>
    </div>`;
}

function agruparPorFecha() {
    const mapa = new Map();
    for (const c of state.citas) {
        const f = String(c.fecha).slice(0, 10);
        if (!mapa.has(f)) mapa.set(f, []);
        mapa.get(f).push(c);
    }
    return mapa;
}

function renderDia(cont) {
    const delDia = state.citas.filter((c) => String(c.fecha).slice(0, 10) === toISODate(state.fechaRef));
    if (delDia.length === 0) {
        cont.innerHTML = '<div class="cal-vacio">No hay citas para este día.</div>';
        return;
    }
    cont.innerHTML = `<div class="cal-lista">${delDia.map(itemDia).join('')}</div>`;
}

function renderSemana(cont) {
    const ini = inicioSemana(state.fechaRef);
    const hoy = toISODate();
    const porFecha = agruparPorFecha();
    let html = '<div class="cal-semana">';
    for (let i = 0; i < 7; i++) {
        const d = sumarDias(ini, i);
        const iso = toISODate(d);
        const citas = porFecha.get(iso) || [];
        html += `<div class="cal-dia ${iso === hoy ? 'hoy' : ''}">
            <div class="cal-dia-cab" data-dia="${iso}"><span>${DIAS_CORTOS[i]}</span><span>${d.getDate()}</span></div>
            ${citas.map(chip).join('')}
        </div>`;
    }
    cont.innerHTML = html + '</div>';
}

function renderMes(cont) {
    const { desde, hasta } = rango();
    const total = Math.round((hasta - desde) / 86400000) + 1;
    const hoy = toISODate();
    const mesActual = state.fechaRef.getMonth();
    const porFecha = agruparPorFecha();

    let html = '<div class="cal-mes">' + DIAS_CORTOS.map((d) => `<div class="cal-mes-cab">${d}</div>`).join('');
    for (let i = 0; i < total; i++) {
        const d = sumarDias(desde, i);
        const iso = toISODate(d);
        const citas = porFecha.get(iso) || [];
        html += `<div class="cal-dia cal-celda ${iso === hoy ? 'hoy' : ''} ${d.getMonth() !== mesActual ? 'fuera' : ''}">
            <div class="cal-dia-cab" data-dia="${iso}"><span></span><span>${d.getDate()}</span></div>
            ${citas.slice(0, 3).map(chip).join('')}
            ${citas.length > 3 ? `<button type="button" class="cal-mas" data-dia="${iso}">+${citas.length - 3} más</button>` : ''}
        </div>`;
    }
    cont.innerHTML = html + '</div>';
}

function renderPendientes() {
    const cont = $('pendientes-lista');
    const n = state.pendientes.length;
    $('pendientes-contador').textContent = n ? `(${n})` : '';

    if (n === 0) {
        cont.innerHTML = '<div class="cal-vacio">No hay citas pendientes por confirmar.</div>';
        return;
    }
    cont.innerHTML = state.pendientes.map((c) => {
        const e = ESTADOS.pendiente;
        const s = servicioDe(c.servicio_id);
        const p = peluqueroDe(c.peluquero_id);
        const cli = state.clientes.get(c.cliente_id);
        const wa = waLink(cli && cli.telefono);
        const b = (accion, texto, clase = 'btn-outline') =>
            `<button type="button" class="${clase}" data-accion="${accion}" data-id="${escapeHTML(c.id)}" style="padding:.35rem .8rem;font-size:.74rem;">${texto}</button>`;
        return `<div class="cal-item" style="--c:${e.color}">
            <div class="hora">${escapeHTML(formatDate(c.fecha))}<br><small style="opacity:.7;font-weight:400;">${formatTime(c.hora_inicio)} – ${formatTime(c.hora_fin)}</small></div>
            <div class="info"><strong>${escapeHTML(nombreCliente(c.cliente_id))}</strong>
                <small>${escapeHTML(s ? s.nombre : 'Servicio')} · ${escapeHTML(p ? p.nombre : 'Sin asignar')}${cli && cli.telefono ? ' · ' + escapeHTML(cli.telefono) : ''}</small></div>
            <div class="acciones">
                ${b('confirmar', 'Confirmar', 'btn-gold')}
                ${wa ? `<a class="btn-outline" href="${wa}" target="_blank" rel="noopener" style="padding:.35rem .8rem;font-size:.74rem;text-decoration:none;">WhatsApp</a>` : ''}
                ${b('ver', 'Ver')}
                ${b('cancelar', 'Cancelar')}
            </div>
        </div>`;
    }).join('');
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------
function navegar(delta) {
    const r = state.fechaRef;
    if (state.vista === 'dia') state.fechaRef = sumarDias(r, delta);
    else if (state.vista === 'semana') state.fechaRef = sumarDias(r, 7 * delta);
    else state.fechaRef = new Date(r.getFullYear(), r.getMonth() + delta, 1);
    refrescar();
}

function bindEventos() {
    $('cal-prev').addEventListener('click', () => navegar(-1));
    $('cal-next').addEventListener('click', () => navegar(1));
    $('cal-hoy').addEventListener('click', () => {
        state.fechaRef = new Date();
        state.fechaRef.setHours(0, 0, 0, 0);
        refrescar();
    });
    document.querySelectorAll('.cal-vistas button').forEach((b) => {
        b.addEventListener('click', () => { state.vista = b.dataset.vista; refrescar(); });
    });
    $('filtro-peluquero-cita').addEventListener('change', (e) => { state.filtroPeluquero = e.target.value; refrescar(); });
    $('filtro-estado-cita').addEventListener('change', (e) => { state.filtroEstado = e.target.value; refrescar(); });
    $('btn-nueva-cita').addEventListener('click', () => abrirFormulario(null));

    $('calendario').addEventListener('click', (e) => {
        const cita = e.target.closest('[data-cita]');
        if (cita) { abrirDetalle(cita.dataset.cita); return; }
        const dia = e.target.closest('[data-dia]');
        if (dia) {
            state.fechaRef = fechaLocal(dia.dataset.dia);
            state.vista = 'dia';
            refrescar();
        }
    });

    const despachar = (e) => {
        const btn = e.target.closest('button[data-accion]');
        if (btn) manejarAccion(btn.dataset.accion, btn.dataset.id);
    };
    $('pendientes-lista').addEventListener('click', despachar);
    $('detalle-acciones').addEventListener('click', despachar);

    $('form-cita').addEventListener('submit', guardarCita);
    $('form-completar').addEventListener('submit', completarCita);

    // Cliente
    $('cli-buscar').addEventListener('input', debounce(buscarClientes, 300));
    $('cli-resultados').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-cliente]');
        if (btn) modoCliente('seleccionado', state.clientes.get(btn.dataset.cliente));
    });
    $('btn-cli-nuevo').addEventListener('click', () => modoCliente('nuevo'));
    $('btn-cli-volver').addEventListener('click', () => modoCliente('buscar'));
    $('btn-cli-cambiar').addEventListener('click', () => modoCliente('buscar'));

    // Servicio, especialista, fecha y hora
    $('cita-servicio').addEventListener('change', () => {
        const s = servicioDe($('cita-servicio').value);
        llenarPeluqueros(s ? s.id : '', $('cita-peluquero').value);
        if (s) $('cita-precio').value = s.precio;
        actualizarFin();
        actualizarSlots();
    });
    $('cita-peluquero').addEventListener('change', actualizarSlots);
    $('cita-fecha').addEventListener('change', actualizarSlots);
    $('cita-hora').addEventListener('input', () => { actualizarFin(); marcarSlot(); });
    $('cita-slots').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-hora]');
        if (!btn) return;
        $('cita-hora').value = btn.dataset.hora;
        actualizarFin();
        marcarSlot();
    });

    ['modal-cita', 'modal-detalle', 'modal-completar'].forEach((id) => {
        $(id).addEventListener('click', (e) => { if (e.target === $(id)) cerrarModal($(id)); });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cerrarModal($('modal-cita'));
            cerrarModal($('modal-detalle'));
            cerrarModal($('modal-completar'));
        }
    });
}

// ---------------------------------------------------------------------------
// Detalle y acciones
// ---------------------------------------------------------------------------
function abrirDetalle(id) {
    const c = buscarCita(id);
    if (!c) return;
    const e = ESTADOS[c.estado] || ESTADOS.pendiente;
    const s = servicioDe(c.servicio_id);
    const p = peluqueroDe(c.peluquero_id);
    const cli = state.clientes.get(c.cliente_id);
    const precio = c.precio_cobrado ?? (s ? s.precio : 0);

    const filas = [
        ['Estado', `<span class="cal-badge" style="--c:${e.color}">${e.texto}</span>`],
        ['Fecha', escapeHTML(formatDate(c.fecha))],
        ['Horario', `${formatTime(c.hora_inicio)} – ${formatTime(c.hora_fin)}`],
        ['Cliente', escapeHTML(cli ? cli.nombre : 'Cliente') +
            (cli && (cli.telefono || cli.email)
                ? `<br><small style="opacity:.7;">${escapeHTML(cli.telefono || '')}${cli.telefono && cli.email ? ' · ' : ''}${escapeHTML(cli.email || '')}</small>`
                : '')],
        ['Servicio', escapeHTML(s ? s.nombre : '—')],
        ['Especialista', escapeHTML(p ? p.nombre : '—')],
        ['Precio', formatMoney(precio)]
    ];
    if (c.estado === 'completada' && c.metodo_pago) filas.push(['Método de pago', escapeHTML(c.metodo_pago)]);

    $('detalle-contenido').innerHTML =
        `<div class="cal-detalle"><dl>${filas.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>`;

    const b = (accion, texto, clase = 'btn-outline') =>
        `<button type="button" class="${clase}" data-accion="${accion}" data-id="${escapeHTML(c.id)}" style="padding:.5rem 1rem;font-size:.78rem;">${texto}</button>`;
    const wa = waLink(cli && cli.telefono);
    let acciones = wa
        ? `<a class="btn-outline" href="${wa}" target="_blank" rel="noopener" style="padding:.5rem 1rem;font-size:.78rem;text-decoration:none;">WhatsApp</a>`
        : '';
    if (c.estado === 'pendiente') {
        acciones += b('cancelar', 'Cancelar cita') + b('editar', 'Editar') + b('confirmar', 'Confirmar', 'btn-gold');
    } else if (c.estado === 'confirmada') {
        acciones += b('cancelar', 'Cancelar cita') + b('editar', 'Editar') + b('completar', 'Completar y cobrar', 'btn-gold');
    } else if (c.estado === 'cancelada') {
        acciones += b('reactivar', 'Reactivar', 'btn-gold');
    } else {
        acciones += '<small style="opacity:.6;align-self:center;">Las citas completadas no se editan para no alterar la contabilidad.</small>';
    }
    $('detalle-acciones').innerHTML = acciones;
    abrirModal($('modal-detalle'));
}

async function manejarAccion(accion, id) {
    const c = buscarCita(id);
    if (!c) return;
    switch (accion) {
        case 'ver':
            abrirDetalle(id);
            break;
        case 'confirmar':
            await cambiarEstado(c, 'confirmada', 'Cita confirmada.');
            break;
        case 'cancelar': {
            const ok = await confirmDialog(
                `¿Cancelar la cita de ${nombreCliente(c.cliente_id)} del ${formatDate(c.fecha)} a las ${formatTime(c.hora_inicio)}?`,
                { textoOk: 'Cancelar cita', textoCancelar: 'Volver' }
            );
            if (ok) await cambiarEstado(c, 'cancelada', 'Cita cancelada.');
            break;
        }
        case 'reactivar':
            await cambiarEstado(c, 'pendiente', 'Cita reactivada como pendiente.');
            break;
        case 'editar':
            cerrarModal($('modal-detalle'));
            abrirFormulario(c);
            break;
        case 'completar':
            cerrarModal($('modal-detalle'));
            abrirCompletar(c);
            break;
    }
}

async function cambiarEstado(c, estado, mensaje) {
    try {
        const { data, error } = await supabase.from('citas').update({ estado }).eq('id', c.id).select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No se actualizó ninguna fila (revisa tus permisos de administrador).');
        cerrarModal($('modal-detalle'));
        showToast(mensaje, 'exito');
        await refrescar();
    } catch (err) {
        console.error('Error al cambiar el estado de la cita:', err);
        showToast('No se pudo actualizar: ' + (err.message || 'error'), 'error');
    }
}

// ---------------------------------------------------------------------------
// Completar y cobrar (el trigger de la base crea el ingreso)
// ---------------------------------------------------------------------------
function abrirCompletar(c) {
    const s = servicioDe(c.servicio_id);
    $('form-completar').reset();
    $('comp-id').value = c.id;
    $('comp-resumen').textContent =
        `${nombreCliente(c.cliente_id)} · ${s ? s.nombre : 'Servicio'} · ${formatDate(c.fecha)} ${formatTime(c.hora_inicio)}`;
    $('comp-precio').value = c.precio_cobrado ?? (s ? s.precio : 0);
    $('comp-metodo').value = 'efectivo';
    abrirModal($('modal-completar'));
    $('comp-precio').focus();
}

async function completarCita(e) {
    e.preventDefault();
    const btn = e.submitter || $('form-completar').querySelector('[type="submit"]');
    const id = $('comp-id').value;
    const precio = parseFloat($('comp-precio').value);
    if (Number.isNaN(precio) || precio < 0) { showToast('Ingresa un precio válido.', 'error'); return; }

    setLoading(btn, true, 'Guardando...');
    try {
        // IMPORTANTE: no se inserta el ingreso desde aqui; lo crea el trigger de la base de datos.
        const datos = { estado: 'completada', precio_cobrado: precio, metodo_pago: $('comp-metodo').value };
        let res = await supabase.from('citas').update(datos).eq('id', id).select('id');

        // Si la tabla no tiene columna metodo_pago, reintenta sin ella.
        if (res.error && /metodo_pago/i.test(res.error.message || '')) {
            delete datos.metodo_pago;
            res = await supabase.from('citas').update(datos).eq('id', id).select('id');
            if (!res.error) showToast('Aviso: la tabla citas no tiene método de pago; no se guardó ese dato.', 'info');
        }
        if (res.error) throw res.error;
        if (!res.data || res.data.length === 0) throw new Error('No se actualizó ninguna fila (revisa tus permisos).');

        cerrarModal($('modal-completar'));
        showToast('Cita completada. El ingreso quedó registrado en la contabilidad.', 'exito');
        await refrescar();
    } catch (err) {
        console.error('Error al completar la cita:', err);
        showToast('No se pudo completar: ' + (err.message || 'error'), 'error');
    } finally {
        setLoading(btn, false);
    }
}

// ---------------------------------------------------------------------------
// Formulario de cita: cliente
// ---------------------------------------------------------------------------
function modoCliente(modo, cliente = null) {
    state.modoCliente = modo;
    $('cli-seleccionado').style.display = modo === 'seleccionado' ? 'flex' : 'none';
    $('cli-buscador').style.display = modo === 'buscar' ? 'block' : 'none';
    $('cli-nuevo-box').style.display = modo === 'nuevo' ? 'block' : 'none';

    if (modo === 'seleccionado' && cliente) {
        state.clienteId = cliente.id;
        $('cli-seleccionado-texto').textContent = `${cliente.nombre}${cliente.telefono ? ' · ' + cliente.telefono : ''}`;
    } else {
        state.clienteId = null;
    }
}

async function buscarClientes() {
    const q = $('cli-buscar').value.trim().replace(/[,()%*\\]/g, ' ').trim();
    const cont = $('cli-resultados');
    if (q.length < 2) { cont.innerHTML = ''; return; }

    const token = ++state.busquedaToken;
    const { data, error } = await supabase.from('clientes')
        .select('id, nombre, telefono, email')
        .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,email.ilike.%${q}%`)
        .order('nombre').limit(8);
    if (token !== state.busquedaToken) return;

    if (error) {
        console.error('Error al buscar clientes:', error);
        cont.innerHTML = '<small style="opacity:.7;">No se pudo buscar clientes.</small>';
        return;
    }
    data.forEach((c) => state.clientes.set(c.id, c));
    cont.innerHTML = data.length
        ? data.map((c) => `<button type="button" data-cliente="${escapeHTML(c.id)}">${escapeHTML(c.nombre)}<small style="opacity:.6;"> · ${escapeHTML(c.telefono || 'sin teléfono')}</small></button>`).join('')
        : '<small style="opacity:.7;">Sin resultados. Puedes crear un cliente nuevo.</small>';
}

async function resolverClienteNuevo() {
    const nombre = $('cli-nombre').value.trim();
    const telefono = $('cli-telefono').value.trim();
    const email = $('cli-email').value.trim() || null;

    // Si ya existe un cliente con ese telefono, se reutiliza para no duplicar.
    const { data: existentes, error: errBuscar } = await supabase.from('clientes')
        .select('id, nombre, telefono, email').eq('telefono', telefono).limit(1);
    if (errBuscar) throw errBuscar;
    if (existentes && existentes.length) {
        state.clientes.set(existentes[0].id, existentes[0]);
        showToast(`Ya existía un cliente con ese teléfono (${existentes[0].nombre}); se usó ese registro.`, 'info');
        return existentes[0].id;
    }

    const nuevo = { id: crypto.randomUUID(), nombre, telefono, email };
    const { error } = await supabase.from('clientes').insert([nuevo]);
    if (error) throw error;
    state.clientes.set(nuevo.id, nuevo);
    return nuevo.id;
}

// ---------------------------------------------------------------------------
// Formulario de cita: servicio, especialista, horas
// ---------------------------------------------------------------------------
function llenarServicios(seleccionado) {
    const lista = state.servicios.filter((s) => s.activo || s.id === seleccionado);
    $('cita-servicio').innerHTML = '<option value="">Elige un servicio</option>' +
        lista.map((s) => `<option value="${escapeHTML(s.id)}">${escapeHTML(s.nombre)} · ${formatMoney(s.precio)} · ${s.duracion_min} min</option>`).join('');
}

function llenarPeluqueros(servicioId, seleccionado) {
    const sel = $('cita-peluquero');
    if (!servicioId) {
        sel.innerHTML = '<option value="">Primero elige un servicio</option>';
        return;
    }
    const permitidos = state.peluqueros.filter((p) =>
        (p.activo && state.relaciones.get(p.id) && state.relaciones.get(p.id).has(servicioId)) || p.id === seleccionado
    );
    sel.innerHTML = '<option value="">Elige un especialista</option>' +
        permitidos.map((p) => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.nombre)}${p.activo ? '' : ' (inactivo)'}</option>`).join('');
    if (permitidos.some((p) => p.id === seleccionado)) sel.value = seleccionado;
}

function actualizarFin() {
    const s = servicioDe($('cita-servicio').value);
    const h = $('cita-hora').value;
    $('cita-fin').textContent = s && h ? `· termina a las ${deMin(aMin(h) + s.duracion_min)}` : '';
}

function marcarSlot() {
    const h = $('cita-hora').value;
    $('cita-slots').querySelectorAll('button[data-hora]').forEach((b) => {
        b.classList.toggle('sel', b.dataset.hora === h);
    });
}

async function obtenerHorarios(pelId) {
    if (state.horariosCache.has(pelId)) return state.horariosCache.get(pelId);
    const { data, error } = await supabase.from('horarios_peluquero')
        .select('dia_semana, hora_inicio, hora_fin').eq('peluquero_id', pelId);
    if (error) throw error;
    state.horariosCache.set(pelId, data || []);
    return data || [];
}

async function citasDelDia(pelId, fecha, excluirId) {
    const { data, error } = await supabase.from('citas')
        .select('id, cliente_id, hora_inicio, hora_fin, estado')
        .eq('peluquero_id', pelId).eq('fecha', fecha).neq('estado', 'cancelada');
    if (error) throw error;
    return (data || []).filter((c) => c.id !== excluirId);
}

async function actualizarSlots() {
    const cont = $('cita-slots');
    const pelId = $('cita-peluquero').value;
    const fecha = $('cita-fecha').value;
    const servicio = servicioDe($('cita-servicio').value);

    if (!pelId || !fecha || !servicio) {
        cont.innerHTML = '<small style="opacity:.6;">Elige servicio, especialista y fecha para ver las horas libres.</small>';
        return;
    }

    const token = ++state.slotToken;
    cont.innerHTML = '<small style="opacity:.6;">Buscando horas libres...</small>';
    try {
        const [horarios, citas] = await Promise.all([
            obtenerHorarios(pelId),
            citasDelDia(pelId, fecha, $('cita-id').value)
        ]);
        if (token !== state.slotToken) return;

        const dow = fechaLocal(fecha).getDay();
        const dia = state.convDias === 'iso' ? (dow === 0 ? 7 : dow) : dow;
        const tramos = horarios.filter((h) => h.dia_semana === dia);
        if (tramos.length === 0) {
            cont.innerHTML = '<small style="opacity:.7;">Este especialista no trabaja ese día. Puedes escribir una hora manualmente.</small>';
            return;
        }

        const ahora = new Date();
        const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes();
        const esHoy = fecha === toISODate();
        const dur = servicio.duracion_min;
        const libres = [];
        for (const t of tramos) {
            for (let m = aMin(t.hora_inicio); m + dur <= aMin(t.hora_fin); m += PASO_SLOTS) {
                const choca = citas.some((c) => m < aMin(c.hora_fin) && m + dur > aMin(c.hora_inicio));
                if (!choca && !(esHoy && m <= ahoraMin)) libres.push(m);
            }
        }

        cont.innerHTML = libres.length
            ? libres.map((m) => `<button type="button" class="cal-hora-btn" data-hora="${deMin(m)}">${deMin(m)}</button>`).join('')
            : '<small style="opacity:.7;">No quedan horas libres ese día con este especialista. Puedes escribir una hora manualmente.</small>';
        marcarSlot();
    } catch (err) {
        console.error('Error al calcular las horas libres:', err);
        cont.innerHTML = '<small style="color:#363636;font-weight:600;">No se pudieron calcular las horas libres. Puedes escribir la hora manualmente.</small>';
    }
}

// ---------------------------------------------------------------------------
// Formulario de cita: abrir y guardar
// ---------------------------------------------------------------------------
function abrirFormulario(c) {
    $('form-cita').reset();
    $('modal-cita-titulo').textContent = c ? 'Editar Cita' : 'Nueva Cita';
    $('cita-id').value = c ? c.id : '';

    $('cli-buscar').value = '';
    $('cli-resultados').innerHTML = '';
    $('cli-nombre').value = '';
    $('cli-telefono').value = '';
    $('cli-email').value = '';
    if (c) {
        modoCliente('seleccionado', state.clientes.get(c.cliente_id) || { id: c.cliente_id, nombre: 'Cliente' });
    } else {
        modoCliente('buscar');
    }

    llenarServicios(c ? c.servicio_id : '');
    $('cita-servicio').value = c ? c.servicio_id : '';
    llenarPeluqueros(c ? c.servicio_id : '', c ? c.peluquero_id : '');
    $('cita-fecha').value = c ? String(c.fecha).slice(0, 10) : toISODate(state.fechaRef);
    $('cita-hora').value = c ? formatTime(c.hora_inicio) : '';
    $('cita-estado').value = c ? (c.estado === 'completada' ? 'confirmada' : c.estado) : 'confirmada';
    $('cita-precio').value = c ? (c.precio_cobrado ?? '') : '';

    actualizarFin();
    actualizarSlots();
    abrirModal($('modal-cita'));
}

async function guardarCita(e) {
    e.preventDefault();
    const btn = e.submitter || $('form-cita').querySelector('[type="submit"]');
    const id = $('cita-id').value;
    const servicio = servicioDe($('cita-servicio').value);
    const peluqueroId = $('cita-peluquero').value;
    const fecha = $('cita-fecha').value;
    const hora = $('cita-hora').value;
    const estadoDeseado = $('cita-estado').value;
    const precio = $('cita-precio').value === ''
        ? Number(servicio ? servicio.precio : 0)
        : parseFloat($('cita-precio').value);

    if (state.modoCliente === 'buscar') { showToast('Elige un cliente o crea uno nuevo.', 'error'); return; }
    if (state.modoCliente === 'nuevo' && (!$('cli-nombre').value.trim() || !$('cli-telefono').value.trim())) {
        showToast('El cliente nuevo necesita nombre y teléfono.', 'error');
        return;
    }
    if (!servicio) { showToast('Elige un servicio.', 'error'); return; }
    if (!peluqueroId) { showToast('Elige un especialista.', 'error'); return; }
    if (!fecha) { showToast('Elige una fecha.', 'error'); return; }
    if (!hora) { showToast('Elige la hora de inicio.', 'error'); return; }
    if (Number.isNaN(precio) || precio < 0) { showToast('Ingresa un precio válido.', 'error'); return; }

    const ini = aMin(hora);
    const fin = ini + servicio.duracion_min;
    if (fin >= 24 * 60) { showToast('La cita no puede terminar después de la medianoche.', 'error'); return; }

    setLoading(btn, true, 'Guardando...');
    try {
        // Aviso si se cruza con otra cita del mismo especialista
        const delDia = await citasDelDia(peluqueroId, fecha, id);
        const choque = delDia.find((x) => ini < aMin(x.hora_fin) && fin > aMin(x.hora_inicio));
        if (choque) {
            await asegurarClientes([choque.cliente_id]);
            const seguir = await confirmDialog(
                `Ese horario se cruza con la cita de ${nombreCliente(choque.cliente_id)} (${formatTime(choque.hora_inicio)} – ${formatTime(choque.hora_fin)}). ¿Guardar de todos modos?`,
                { textoOk: 'Guardar igual' }
            );
            if (!seguir) return;
        }

        const clienteId = state.modoCliente === 'nuevo' ? await resolverClienteNuevo() : state.clienteId;
        const datos = {
            cliente_id: clienteId,
            servicio_id: servicio.id,
            peluquero_id: peluqueroId,
            fecha,
            hora_inicio: `${hora}:00`,
            hora_fin: `${deMin(fin)}:00`,
            precio_cobrado: precio
        };

        if (id) {
            const { data, error } = await supabase.from('citas')
                .update({ ...datos, estado: estadoDeseado }).eq('id', id).select('id');
            if (error) throw error;
            if (!data || data.length === 0) throw new Error('No se actualizó ninguna fila (revisa tus permisos de administrador).');
        } else {
            // Se inserta como 'pendiente' (lo que permite la politica de la base) y luego se actualiza el estado.
            const nuevoId = crypto.randomUUID();
            const { error } = await supabase.from('citas')
                .insert([{ id: nuevoId, ...datos, estado: 'pendiente' }]);
            if (error) throw error;
            if (estadoDeseado !== 'pendiente') {
                const { data, error: errEstado } = await supabase.from('citas')
                    .update({ estado: estadoDeseado }).eq('id', nuevoId).select('id');
                if (errEstado) throw errEstado;
                if (!data || data.length === 0) throw new Error('La cita se creó como pendiente, pero no se pudo cambiar su estado.');
            }
        }

        cerrarModal($('modal-cita'));
        showToast('Cita guardada.', 'exito');
        state.fechaRef = fechaLocal(fecha); // para ver la cita recien guardada
        await refrescar();
    } catch (err) {
        console.error('Error al guardar la cita:', err);
        showToast('No se pudo guardar: ' + (err.message || 'error desconocido'), 'error');
    } finally {
        setLoading(btn, false);
    }
}