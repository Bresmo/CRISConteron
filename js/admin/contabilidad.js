// ============================================================================
// CONTABILIDAD DEL NEGOCIO
// Archivo: js/admin/contabilidad.js  (usa admin/contabilidad.html y Chart.js)
// ============================================================================
import { supabase } from '../supabaseClient.js';
import { checkAdminAuth } from '../auth.js';
import {
    escapeHTML, formatMoney, formatDate, toISODate, getDateRange,
    showToast, confirmDialog, setLoading, downloadCSV, renderSidebar
} from './utils.js';

const $ = (id) => document.getElementById(id);
const MAX_FILAS = 100; // filas visibles por tabla de movimientos (el CSV exporta todo)
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const state = {
    periodo: 'mes', // 'dia' | 'mes' | 'anio'
    ingresos: [],
    gastos: [],
    graf: { ingresos: [], gastos: [], desde: '', hasta: '' },
    citasMap: new Map(), // cita_id -> { servicio_id, peluquero_id }
    servicios: [],
    peluqueros: [],
    colComision: 'comision_pct',
    charts: { barras: null, linea: null },
    cierre: null
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
const fechaLocal = (s) => {
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
};
const sumarDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const fechaDe = (fila) => String(fila.fecha).slice(0, 10);
const suma = (filas) => filas.reduce((t, f) => t + (Number(f.monto) || 0), 0);
const redondear = (n) => Math.round(n * 100) / 100;
const capitalizar = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

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

window.cerrarModalIngreso = () => cerrarModal($('modal-ingreso'));
window.cerrarModalGasto = () => cerrarModal($('modal-gasto'));
window.cerrarModalCierre = () => cerrarModal($('modal-cierre'));

function injectStyles() {
    if (document.getElementById('contabilidad-styles')) return;
    const style = document.createElement('style');
    style.id = 'contabilidad-styles';
    style.textContent = `
    .ctb-barra{display:flex;flex-wrap:wrap;gap:1rem;align-items:center;justify-content:space-between}
    .ctb-periodos{display:flex;gap:.25rem}
    .ctb-periodos button{padding:.45rem 1rem;font-size:.78rem}
    .ctb-periodos button.activa{background:rgba(212,175,55,.18);color:var(--color-accent,#d4af37);border-color:var(--color-accent,#d4af37)}
    .ctb-acciones{display:flex;gap:.5rem;flex-wrap:wrap}
    .ctb-resumen{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem}
    .ctb-tarjeta{display:flex;flex-direction:column;gap:.3rem}
    .ctb-tarjeta strong{font-size:1.7rem;font-family:var(--font-serif,serif)}
    .ctb-tarjeta small{opacity:.6;min-height:1em}
    .ctb-etq{font-size:.7rem;text-transform:uppercase;letter-spacing:.12em;opacity:.65}
    .ctb-graficos{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:1rem}
    .ctb-vacio{text-align:center;padding:1.2rem;opacity:.65}
    .cierre-tabla{width:100%;border-collapse:collapse;margin:.75rem 0}
    .cierre-tabla td,.cierre-tabla th{padding:.45rem .3rem;border-bottom:1px solid rgba(255,255,255,.1);text-align:left;font-size:.9rem}
    .cierre-tabla td:last-child,.cierre-tabla th:last-child{text-align:right}
    .cierre-total td{font-weight:600}
    #print-area{display:none}
    @media print{
        body.imprimiendo > *:not(#print-area){display:none!important}
        body.imprimiendo #print-area{display:block!important;background:#fff;color:#000;padding:1.5rem;position:static}
        body.imprimiendo #print-area *{color:#000!important;border-color:#999!important;background:transparent!important}
    }
    `;
    document.head.appendChild(style);
}

const servicioDe = (id) => state.servicios.find((s) => s.id === id);
const peluqueroDe = (id) => state.peluqueros.find((p) => p.id === id);

function nombreServicioDeIngreso(i) {
    if (!i.cita_id) return 'Otros ingresos (manuales)';
    const cita = state.citasMap.get(i.cita_id);
    const s = cita ? servicioDe(cita.servicio_id) : null;
    return s ? s.nombre : 'Servicio (cita)';
}

// ---------------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------------
async function init() {
    injectStyles();
    renderSidebar('contabilidad');
    const user = await checkAdminAuth();
    if (!user) return;

    const hoy = toISODate();
    $('ctb-fecha').value = hoy;
    $('ctb-mes').value = hoy.slice(0, 7);
    $('ctb-anio').value = hoy.slice(0, 4);
    mostrarInputs();
    bindEventos();

    const [servicios, peluqueros] = await Promise.all([
        fetchAll(() => supabase.from('servicios').select('id, nombre').order('id')),
        fetchAll(() => supabase.from('peluqueros').select('*').order('id'))
    ]);
    state.servicios = servicios;
    state.peluqueros = peluqueros;
    const col = Object.keys(peluqueros[0] || {}).find((k) => k.toLowerCase().startsWith('comision'));
    if (col) state.colComision = col;

    await cargar();
}

init().catch((err) => {
    console.error('Error al iniciar la contabilidad:', err);
    showToast('Error al iniciar la página.', 'error');
});

function mostrarInputs() {
    $('ctb-fecha').style.display = state.periodo === 'dia' ? '' : 'none';
    $('ctb-mes').style.display = state.periodo === 'mes' ? '' : 'none';
    $('ctb-anio').style.display = state.periodo === 'anio' ? '' : 'none';
    document.querySelectorAll('.ctb-periodos button').forEach((b) => {
        b.classList.toggle('activa', b.dataset.periodo === state.periodo);
    });
}

function referencia() {
    const hoy = toISODate();
    if (state.periodo === 'dia') return $('ctb-fecha').value || hoy;
    if (state.periodo === 'mes') return $('ctb-mes').value || hoy.slice(0, 7);
    return String($('ctb-anio').value || hoy.slice(0, 4));
}

// ---------------------------------------------------------------------------
// Carga
// ---------------------------------------------------------------------------
async function cargar() {
    const { desde, hasta } = getDateRange(state.periodo, referencia());
    // Para el dia se grafican los 7 dias previos como contexto.
    const grafDesde = state.periodo === 'dia' ? toISODate(sumarDias(fechaLocal(desde), -6)) : desde;

    try {
        const [ing, gas] = await Promise.all([
            fetchAll(() => supabase.from('ingresos').select('*').gte('fecha', grafDesde).lte('fecha', hasta).order('fecha').order('id')),
            fetchAll(() => supabase.from('gastos').select('*').gte('fecha', grafDesde).lte('fecha', hasta).order('fecha').order('id'))
        ]);
        state.graf = { ingresos: ing, gastos: gas, desde: grafDesde, hasta };
        state.ingresos = ing.filter((f) => fechaDe(f) >= desde && fechaDe(f) <= hasta);
        state.gastos = gas.filter((f) => fechaDe(f) >= desde && fechaDe(f) <= hasta);
        await cargarCitasDe(state.ingresos);

        $('ctb-periodo-texto').textContent =
            `Mostrando del ${formatDate(desde)} al ${formatDate(hasta)}.` +
            (state.periodo === 'dia' ? ' El gráfico incluye los 6 días anteriores como referencia.' : '');
        render();
    } catch (err) {
        console.error('Error al cargar la contabilidad:', err);
        showToast('No se pudo cargar la contabilidad. Revisa la consola (F12).', 'error');
    }
}

async function cargarCitasDe(ingresos) {
    const faltan = [...new Set(ingresos.map((i) => i.cita_id).filter(Boolean))].filter((id) => !state.citasMap.has(id));
    for (let i = 0; i < faltan.length; i += 100) {
        const lote = faltan.slice(i, i + 100);
        const { data, error } = await supabase.from('citas').select('id, servicio_id, peluquero_id').in('id', lote);
        if (error) throw error;
        data.forEach((c) => state.citasMap.set(c.id, c));
    }
}

// ---------------------------------------------------------------------------
// Calculos y render
// ---------------------------------------------------------------------------
function acumular(mapa, clave, monto) {
    const v = mapa.get(clave) || { n: 0, total: 0 };
    v.n += 1;
    v.total += monto;
    mapa.set(clave, v);
}

function filasDesglose(mapa, base) {
    const filas = [...mapa.entries()].sort((a, b) => b[1].total - a[1].total);
    if (filas.length === 0) return '<tr><td colspan="4" class="ctb-vacio">Sin datos en este periodo.</td></tr>';
    return filas.map(([k, v]) => `
        <tr>
            <td>${escapeHTML(k)}</td>
            <td>${v.n}</td>
            <td>${formatMoney(v.total)}</td>
            <td>${base ? ((v.total / base) * 100).toFixed(1) : '0.0'}%</td>
        </tr>`).join('');
}

function render() {
    const totalIng = suma(state.ingresos);
    const totalGas = suma(state.gastos);
    const neto = totalIng - totalGas;

    $('ctb-ingresos').textContent = formatMoney(totalIng);
    $('ctb-ingresos-n').textContent = `${state.ingresos.length} movimiento${state.ingresos.length === 1 ? '' : 's'}`;
    $('ctb-gastos').textContent = formatMoney(totalGas);
    $('ctb-gastos-n').textContent = `${state.gastos.length} movimiento${state.gastos.length === 1 ? '' : 's'}`;
    $('ctb-neto').textContent = formatMoney(neto);
    $('ctb-neto').style.color = neto >= 0 ? '#2fb36b' : '#e5484d';
    $('ctb-margen').textContent = totalIng > 0 ? `Margen: ${((neto / totalIng) * 100).toFixed(1)}%` : '';

    // Desgloses
    const porServicio = new Map();
    const porMetodo = new Map();
    const porPeluquero = new Map();
    for (const i of state.ingresos) {
        const monto = Number(i.monto) || 0;
        acumular(porServicio, nombreServicioDeIngreso(i), monto);
        acumular(porMetodo, capitalizar(i.metodo_pago || 'sin especificar'), monto);
        const cita = i.cita_id ? state.citasMap.get(i.cita_id) : null;
        if (cita && cita.peluquero_id) acumular(porPeluquero, cita.peluquero_id, monto);
    }
    $('ctb-por-servicio').innerHTML = filasDesglose(porServicio, totalIng);
    $('ctb-por-metodo').innerHTML = filasDesglose(porMetodo, totalIng);
    renderPeluqueros(porPeluquero);

    renderIngresos();
    renderGastos();
    dibujarGraficos();
}

function renderPeluqueros(mapa) {
    const tbody = $('ctb-por-peluquero');
    const filas = [...mapa.entries()].sort((a, b) => b[1].total - a[1].total);
    if (filas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="ctb-vacio">Sin servicios completados en este periodo.</td></tr>';
        return;
    }
    let totalN = 0;
    let totalFact = 0;
    let totalCom = 0;
    const html = filas.map(([id, v]) => {
        const p = peluqueroDe(id);
        const pct = p ? Number(p[state.colComision]) || 0 : 0;
        const comision = (v.total * pct) / 100;
        totalN += v.n;
        totalFact += v.total;
        totalCom += comision;
        return `<tr>
            <td>${escapeHTML(p ? p.nombre : 'Especialista eliminado')}</td>
            <td>${v.n}</td>
            <td>${formatMoney(v.total)}</td>
            <td>${pct} %</td>
            <td>${formatMoney(comision)}</td>
        </tr>`;
    }).join('');
    tbody.innerHTML = html + `
        <tr style="font-weight:600;border-top:1px solid rgba(255,255,255,.15);">
            <td>Total</td><td>${totalN}</td><td>${formatMoney(totalFact)}</td><td></td><td>${formatMoney(totalCom)}</td>
        </tr>`;
}

const botonFila = (accion, id, icono, titulo) =>
    `<button type="button" class="btn-outline" data-accion="${accion}" data-id="${escapeHTML(id)}" title="${titulo}" style="padding:.3rem .55rem;font-size:.78rem;"><i class="ph ph-${icono}"></i></button>`;

function renderIngresos() {
    const tbody = $('ctb-ingresos-tbody');
    const lista = [...state.ingresos].sort((a, b) => fechaDe(b).localeCompare(fechaDe(a)));
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="ctb-vacio">No hay ingresos en este periodo.</td></tr>';
        return;
    }
    let html = lista.slice(0, MAX_FILAS).map((i) => `
        <tr>
            <td>${escapeHTML(formatDate(i.fecha))}</td>
            <td>${escapeHTML(i.concepto || '—')}</td>
            <td>${escapeHTML(capitalizar(i.metodo_pago || '—'))}</td>
            <td>${i.cita_id
                ? '<span style="font-size:.75rem;color:#2fb36b;">Cita</span>'
                : '<span style="font-size:.75rem;opacity:.7;">Manual</span>'}</td>
            <td style="text-align:right;">${formatMoney(i.monto)}</td>
            <td><div style="display:flex;justify-content:flex-end;gap:.4rem;">${i.cita_id
                ? '<i class="ph ph-lock-simple" title="Generado automáticamente por una cita; se gestiona desde Citas" style="opacity:.5;padding:.3rem;"></i>'
                : botonFila('ing-editar', i.id, 'pencil-simple', 'Editar') + botonFila('ing-eliminar', i.id, 'trash', 'Eliminar')}</div></td>
        </tr>`).join('');
    if (lista.length > MAX_FILAS) {
        html += `<tr><td colspan="6" class="ctb-vacio">Mostrando ${MAX_FILAS} de ${lista.length} ingresos. Exporta el CSV para ver todos.</td></tr>`;
    }
    tbody.innerHTML = html;
}

function renderGastos() {
    const tbody = $('ctb-gastos-tbody');
    const lista = [...state.gastos].sort((a, b) => fechaDe(b).localeCompare(fechaDe(a)));
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="ctb-vacio">No hay gastos en este periodo.</td></tr>';
        return;
    }
    let html = lista.slice(0, MAX_FILAS).map((g) => `
        <tr>
            <td>${escapeHTML(formatDate(g.fecha))}</td>
            <td>${escapeHTML(g.categoria || '—')}</td>
            <td>${escapeHTML(g.concepto || '—')}</td>
            <td><small style="opacity:.7;">${escapeHTML(String(g.nota || '').slice(0, 60))}</small></td>
            <td style="text-align:right;">${formatMoney(g.monto)}</td>
            <td><div style="display:flex;justify-content:flex-end;gap:.4rem;">
                ${botonFila('gas-editar', g.id, 'pencil-simple', 'Editar')}
                ${botonFila('gas-eliminar', g.id, 'trash', 'Eliminar')}
            </div></td>
        </tr>`).join('');
    if (lista.length > MAX_FILAS) {
        html += `<tr><td colspan="6" class="ctb-vacio">Mostrando ${MAX_FILAS} de ${lista.length} gastos. Exporta el CSV para ver todos.</td></tr>`;
    }
    tbody.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Graficos (Chart.js)
// ---------------------------------------------------------------------------
function construirSerie() {
    const { desde, hasta, ingresos, gastos } = state.graf;
    const claves = [];
    const etiquetas = [];

    if (state.periodo === 'anio') {
        const anio = desde.slice(0, 4);
        MESES.forEach((m, i) => { claves.push(`${anio}-${pad(i + 1)}`); etiquetas.push(m); });
    } else {
        for (let d = fechaLocal(desde); d <= fechaLocal(hasta); d = sumarDias(d, 1)) {
            claves.push(toISODate(d));
            etiquetas.push(state.periodo === 'dia'
                ? d.toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric' })
                : String(d.getDate()));
        }
    }

    const largo = state.periodo === 'anio' ? 7 : 10;
    const sumar = (filas) => {
        const m = new Map(claves.map((k) => [k, 0]));
        for (const f of filas) {
            const k = String(f.fecha).slice(0, largo);
            if (m.has(k)) m.set(k, m.get(k) + (Number(f.monto) || 0));
        }
        return claves.map((k) => redondear(m.get(k)));
    };
    const ing = sumar(ingresos);
    const gas = sumar(gastos);
    return { etiquetas, ing, gas, neto: ing.map((v, i) => redondear(v - gas[i])) };
}

function dibujarGraficos() {
    if (typeof Chart === 'undefined') {
        console.error('Chart.js no se cargó. Revisa la etiqueta <script> en contabilidad.html.');
        return;
    }
    Chart.defaults.color = '#a0a0a0';
    Chart.defaults.borderColor = 'rgba(255,255,255,.08)';

    const s = construirSerie();
    const tooltip = { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatMoney(ctx.parsed.y)}` } };
    const escalaY = (empiezaEnCero) => ({
        y: { beginAtZero: empiezaEnCero, ticks: { callback: (v) => '$' + v } }
    });

    if (state.charts.barras) state.charts.barras.destroy();
    if (state.charts.linea) state.charts.linea.destroy();

    state.charts.barras = new Chart($('ctb-chart-barras'), {
        type: 'bar',
        data: {
            labels: s.etiquetas,
            datasets: [
                { label: 'Ingresos', data: s.ing, backgroundColor: '#2fb36b' },
                { label: 'Gastos', data: s.gas, backgroundColor: '#e5484d' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip }, scales: escalaY(true) }
    });

    state.charts.linea = new Chart($('ctb-chart-linea'), {
        type: 'line',
        data: {
            labels: s.etiquetas,
            datasets: [{
                label: 'Ganancia neta',
                data: s.neto,
                borderColor: '#d4af37',
                backgroundColor: 'rgba(212,175,55,.15)',
                fill: true,
                tension: 0.3,
                pointRadius: 3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip }, scales: escalaY(false) }
    });
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------
function bindEventos() {
    document.querySelectorAll('.ctb-periodos button').forEach((b) => {
        b.addEventListener('click', () => {
            state.periodo = b.dataset.periodo;
            mostrarInputs();
            cargar();
        });
    });
    ['ctb-fecha', 'ctb-mes', 'ctb-anio'].forEach((id) => $(id).addEventListener('change', cargar));

    $('btn-nuevo-ingreso').addEventListener('click', () => abrirIngreso(null));
    $('btn-nuevo-gasto').addEventListener('click', () => abrirGasto(null));
    $('btn-exportar').addEventListener('click', exportar);
    $('btn-cierre').addEventListener('click', abrirCierre);
    $('btn-imprimir-cierre').addEventListener('click', imprimirCierre);
    $('cierre-fecha').addEventListener('change', renderCierre);

    $('ctb-ingresos-tbody').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-accion]');
        if (!btn) return;
        if (btn.dataset.accion === 'ing-editar') abrirIngreso(state.ingresos.find((i) => i.id === btn.dataset.id));
        else if (btn.dataset.accion === 'ing-eliminar') eliminarIngreso(btn.dataset.id);
    });
    $('ctb-gastos-tbody').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-accion]');
        if (!btn) return;
        if (btn.dataset.accion === 'gas-editar') abrirGasto(state.gastos.find((g) => g.id === btn.dataset.id));
        else if (btn.dataset.accion === 'gas-eliminar') eliminarGasto(btn.dataset.id);
    });

    $('form-ingreso').addEventListener('submit', guardarIngreso);
    $('form-gasto').addEventListener('submit', guardarGasto);

    ['modal-ingreso', 'modal-gasto', 'modal-cierre'].forEach((id) => {
        $(id).addEventListener('click', (e) => { if (e.target === $(id)) cerrarModal($(id)); });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cerrarModal($('modal-ingreso'));
            cerrarModal($('modal-gasto'));
            cerrarModal($('modal-cierre'));
        }
    });
}

const fechaPorDefecto = () => (state.periodo === 'dia' ? ($('ctb-fecha').value || toISODate()) : toISODate());

// ---------------------------------------------------------------------------
// Ingresos manuales
// ---------------------------------------------------------------------------
function abrirIngreso(i) {
    $('form-ingreso').reset();
    $('modal-ingreso-titulo').textContent = i ? 'Editar ingreso' : 'Nuevo ingreso';
    $('ing-id').value = i ? i.id : '';
    $('ing-concepto').value = i ? (i.concepto || '') : '';
    $('ing-monto').value = i ? i.monto : '';
    $('ing-fecha').value = i ? fechaDe(i) : fechaPorDefecto();
    $('ing-metodo').value = i && i.metodo_pago ? i.metodo_pago : 'efectivo';
    abrirModal($('modal-ingreso'));
    $('ing-concepto').focus();
}

async function guardarIngreso(e) {
    e.preventDefault();
    const btn = e.submitter || $('form-ingreso').querySelector('[type="submit"]');
    const id = $('ing-id').value;
    const concepto = $('ing-concepto').value.trim();
    const monto = parseFloat($('ing-monto').value);
    const fecha = $('ing-fecha').value;
    if (!concepto || !fecha) { showToast('Completa el concepto y la fecha.', 'error'); return; }
    if (Number.isNaN(monto) || monto <= 0) { showToast('El monto debe ser mayor a 0.', 'error'); return; }

    const datos = { concepto, monto, fecha, metodo_pago: $('ing-metodo').value };
    setLoading(btn, true, 'Guardando...');
    try {
        if (id) {
            const { data, error } = await supabase.from('ingresos').update(datos).eq('id', id).select('id');
            if (error) throw error;
            if (!data || data.length === 0) throw new Error('No se actualizó ninguna fila (revisa tus permisos de administrador).');
        } else {
            const { error } = await supabase.from('ingresos').insert([{ id: crypto.randomUUID(), ...datos }]);
            if (error) throw error;
        }
        cerrarModal($('modal-ingreso'));
        showToast('Ingreso guardado.', 'exito');
        await cargar();
    } catch (err) {
        console.error('Error al guardar el ingreso:', err);
        showToast('No se pudo guardar: ' + (err.message || 'error desconocido'), 'error');
    } finally {
        setLoading(btn, false);
    }
}

async function eliminarIngreso(id) {
    const i = state.ingresos.find((x) => x.id === id);
    if (!i) return;
    const ok = await confirmDialog(`¿Eliminar el ingreso "${i.concepto}" por ${formatMoney(i.monto)}?`, { textoOk: 'Eliminar' });
    if (!ok) return;
    try {
        const { data, error } = await supabase.from('ingresos').delete().eq('id', id).select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No se eliminó ninguna fila (revisa tus permisos).');
        showToast('Ingreso eliminado.', 'exito');
        await cargar();
    } catch (err) {
        console.error('Error al eliminar el ingreso:', err);
        showToast('No se pudo eliminar: ' + (err.message || 'error'), 'error');
    }
}

// ---------------------------------------------------------------------------
// Gastos
// ---------------------------------------------------------------------------
function abrirGasto(g) {
    $('form-gasto').reset();
    $('modal-gasto-titulo').textContent = g ? 'Editar gasto' : 'Nuevo gasto';
    $('gas-id').value = g ? g.id : '';
    $('gas-categoria').value = g ? (g.categoria || '') : '';
    $('gas-concepto').value = g ? (g.concepto || '') : '';
    $('gas-monto').value = g ? g.monto : '';
    $('gas-fecha').value = g ? fechaDe(g) : fechaPorDefecto();
    $('gas-nota').value = g ? (g.nota || '') : '';
    abrirModal($('modal-gasto'));
    $('gas-categoria').focus();
}

async function guardarGasto(e) {
    e.preventDefault();
    const btn = e.submitter || $('form-gasto').querySelector('[type="submit"]');
    const id = $('gas-id').value;
    const categoria = $('gas-categoria').value.trim();
    const concepto = $('gas-concepto').value.trim();
    const monto = parseFloat($('gas-monto').value);
    const fecha = $('gas-fecha').value;
    if (!categoria || !concepto || !fecha) { showToast('Completa categoría, concepto y fecha.', 'error'); return; }
    if (Number.isNaN(monto) || monto <= 0) { showToast('El monto debe ser mayor a 0.', 'error'); return; }

    const datos = { categoria, concepto, monto, fecha, nota: $('gas-nota').value.trim() || null };
    setLoading(btn, true, 'Guardando...');
    try {
        if (id) {
            const { data, error } = await supabase.from('gastos').update(datos).eq('id', id).select('id');
            if (error) throw error;
            if (!data || data.length === 0) throw new Error('No se actualizó ninguna fila (revisa tus permisos de administrador).');
        } else {
            const { error } = await supabase.from('gastos').insert([{ id: crypto.randomUUID(), ...datos }]);
            if (error) throw error;
        }
        cerrarModal($('modal-gasto'));
        showToast('Gasto guardado.', 'exito');
        await cargar();
    } catch (err) {
        console.error('Error al guardar el gasto:', err);
        showToast('No se pudo guardar: ' + (err.message || 'error desconocido'), 'error');
    } finally {
        setLoading(btn, false);
    }
}

async function eliminarGasto(id) {
    const g = state.gastos.find((x) => x.id === id);
    if (!g) return;
    const ok = await confirmDialog(`¿Eliminar el gasto "${g.concepto}" por ${formatMoney(g.monto)}?`, { textoOk: 'Eliminar' });
    if (!ok) return;
    try {
        const { data, error } = await supabase.from('gastos').delete().eq('id', id).select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No se eliminó ninguna fila (revisa tus permisos).');
        showToast('Gasto eliminado.', 'exito');
        await cargar();
    } catch (err) {
        console.error('Error al eliminar el gasto:', err);
        showToast('No se pudo eliminar: ' + (err.message || 'error'), 'error');
    }
}

// ---------------------------------------------------------------------------
// Exportar CSV (todos los movimientos del periodo)
// ---------------------------------------------------------------------------
function exportar() {
    const filas = [
        ...state.ingresos.map((i) => ({
            tipo: 'Ingreso',
            fecha: fechaDe(i),
            concepto: i.concepto || '',
            categoria_o_servicio: nombreServicioDeIngreso(i),
            metodo_pago: i.metodo_pago || '',
            monto: (Number(i.monto) || 0).toFixed(2)
        })),
        ...state.gastos.map((g) => ({
            tipo: 'Gasto',
            fecha: fechaDe(g),
            concepto: g.concepto || '',
            categoria_o_servicio: g.categoria || '',
            metodo_pago: '',
            monto: (Number(g.monto) || 0).toFixed(2)
        }))
    ].sort((a, b) => a.fecha.localeCompare(b.fecha));
    downloadCSV(`contabilidad-${state.periodo}-${referencia()}`, filas);
}

// ---------------------------------------------------------------------------
// Cierre de caja
// ---------------------------------------------------------------------------
async function abrirCierre() {
    $('cierre-fecha').value = fechaPorDefecto();
    abrirModal($('modal-cierre'));
    await renderCierre();
}

async function renderCierre() {
    const fecha = $('cierre-fecha').value;
    const cont = $('cierre-contenido');
    if (!fecha) { cont.innerHTML = ''; return; }
    cont.innerHTML = '<div class="ctb-vacio">Calculando...</div>';

    try {
        const [ing, gas] = await Promise.all([
            fetchAll(() => supabase.from('ingresos').select('*').eq('fecha', fecha).order('id')),
            fetchAll(() => supabase.from('gastos').select('*').eq('fecha', fecha).order('id'))
        ]);

        const porMetodo = new Map();
        for (const i of ing) acumular(porMetodo, capitalizar(i.metodo_pago || 'sin especificar'), Number(i.monto) || 0);
        const totalIng = suma(ing);
        const totalGas = suma(gas);
        const efectivo = suma(ing.filter((i) => String(i.metodo_pago || '').toLowerCase() === 'efectivo'));

        const filasMetodo = [...porMetodo.entries()].map(([k, v]) =>
            `<tr><td>${escapeHTML(k)}</td><td>${v.n}</td><td>${formatMoney(v.total)}</td></tr>`).join('') ||
            '<tr><td colspan="3" style="opacity:.6;">Sin ingresos este día.</td></tr>';

        const html = `
            <table class="cierre-tabla">
                <thead><tr><th>Método de pago</th><th>Cant.</th><th>Total</th></tr></thead>
                <tbody>${filasMetodo}</tbody>
                <tfoot><tr class="cierre-total"><td>Total ingresos</td><td>${ing.length}</td><td>${formatMoney(totalIng)}</td></tr></tfoot>
            </table>
            <table class="cierre-tabla">
                <tbody>
                    <tr><td>Gastos del día (${gas.length})</td><td>${formatMoney(totalGas)}</td></tr>
                    <tr class="cierre-total"><td>Ganancia neta del día</td><td>${formatMoney(totalIng - totalGas)}</td></tr>
                    <tr><td>Efectivo cobrado</td><td>${formatMoney(efectivo)}</td></tr>
                    <tr><td>Efectivo estimado en caja (cobrado − gastos)</td><td>${formatMoney(efectivo - totalGas)}</td></tr>
                </tbody>
            </table>
            <p style="font-size:.75rem;opacity:.6;margin:.5rem 0 0;">El efectivo estimado asume que los gastos del día se pagaron en efectivo.</p>`;

        state.cierre = { fecha, html };
        cont.innerHTML = html;
    } catch (err) {
        console.error('Error al calcular el cierre de caja:', err);
        cont.innerHTML = '<div class="ctb-vacio" style="color:#e5484d;">No se pudo calcular el cierre. Revisa la consola (F12).</div>';
    }
}

function imprimirCierre() {
    if (!state.cierre) { showToast('Primero elige una fecha para el cierre.', 'info'); return; }
    let area = document.getElementById('print-area');
    if (!area) {
        area = document.createElement('div');
        area.id = 'print-area';
        document.body.appendChild(area);
    }
    area.innerHTML = `
        <h2 style="margin:0 0 .25rem;">Maison Aurum</h2>
        <h3 style="margin:0 0 1rem;font-weight:400;">Cierre de caja · ${escapeHTML(formatDate(state.cierre.fecha))}</h3>
        ${state.cierre.html}
        <p style="margin-top:3rem;font-size:.85rem;">Firma del responsable: ______________________________</p>`;

    document.body.classList.add('imprimiendo');
    const limpiar = () => {
        document.body.classList.remove('imprimiendo');
        window.removeEventListener('afterprint', limpiar);
    };
    window.addEventListener('afterprint', limpiar);
    window.print();
}