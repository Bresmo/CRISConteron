// ============================================================================
// DASHBOARD DEL PANEL ADMINISTRATIVO
// Archivo: js/admin/dashboard.js  (usa admin/dashboard.html y Chart.js)
// ============================================================================
import { supabase } from '../supabaseClient.js';
import { checkAdminAuth } from '../auth.js';
import {
    escapeHTML, formatMoney, formatTime, toISODate, getDateRange,
    showToast, setLoading, renderSidebar
} from './utils.js';

const $ = (id) => document.getElementById(id);

const ESTADOS = {
    pendiente: { texto: 'Pendiente', color: '#e0a82e' },
    confirmada: { texto: 'Confirmada', color: '#3b82f6' },
    completada: { texto: 'Completada', color: '#2fb36b' },
    cancelada: { texto: 'Cancelada', color: '#8a8a8a' }
};

const state = {
    rango: 30,
    ingresos: [],
    chart: null
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

function injectStyles() {
    if (document.getElementById('dashboard-styles')) return;
    const style = document.createElement('style');
    style.id = 'dashboard-styles';
    style.textContent = `
    .dash-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:1rem}
    .dash-card{display:flex;flex-direction:column;gap:.35rem}
    .dash-lbl{font-size:.7rem;text-transform:uppercase;letter-spacing:.12em;opacity:.65}
    .dash-num{font-size:1.75rem;font-family:var(--font-serif,serif);line-height:1.2}
    .dash-sub{opacity:.6;font-size:.78rem;min-height:1em}
    .dash-cols{display:grid;grid-template-columns:minmax(0,2fr) minmax(280px,1fr);gap:1rem}
    @media (max-width:980px){.dash-cols{grid-template-columns:1fr}}
    .dash-rango{display:flex;gap:.25rem}
    .dash-rango button.activa{background:rgba(212,175,55,.18);color:var(--color-accent,#d4af37);border-color:var(--color-accent,#d4af37)}
    .dash-lista{display:flex;flex-direction:column;gap:.5rem;max-height:340px;overflow-y:auto}
    .dash-item{display:flex;gap:.75rem;align-items:center;padding:.6rem .8rem;border-radius:8px;background:rgba(255,255,255,.04);border-left:3px solid var(--c,#888)}
    .dash-item .h{min-width:48px;font-weight:600;font-size:.9rem}
    .dash-item .i{flex:1;font-size:.85rem;min-width:0}
    .dash-item .i small{display:block;opacity:.65}
    .dash-item.cancelada{opacity:.45;text-decoration:line-through}
    .dash-vacio{text-align:center;padding:1.5rem;opacity:.65;font-size:.9rem}
    `;
    document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------------
async function init() {
    injectStyles();
    renderSidebar('dashboard');
    const user = await checkAdminAuth();
    if (!user) return;

    document.querySelectorAll('.dash-rango button').forEach((b) => {
        b.addEventListener('click', () => {
            state.rango = Number(b.dataset.rango);
            marcarRango();
            dibujarGrafico();
        });
    });
    $('btn-dash-refrescar').addEventListener('click', cargar);

    marcarRango();
    await cargar();
}

init().catch((err) => {
    console.error('Error al iniciar el dashboard:', err);
    showToast('Error al iniciar la página.', 'error');
});

function marcarRango() {
    document.querySelectorAll('.dash-rango button').forEach((b) => {
        b.classList.toggle('activa', Number(b.dataset.rango) === state.rango);
    });
}

// ---------------------------------------------------------------------------
// Carga de datos
// ---------------------------------------------------------------------------
async function cargar() {
    const btn = $('btn-dash-refrescar');
    setLoading(btn, true, 'Actualizando...');

    const hoy = toISODate();
    const mes = getDateRange('mes', hoy);
    const inicio30 = toISODate(sumarDias(fechaLocal(hoy), -29));
    const inicioIng = inicio30 < mes.desde ? inicio30 : mes.desde;
    const finIng = mes.hasta > hoy ? mes.hasta : hoy;

    try {
        const [ingresos, gastos, citasMes, citasHoyRes, pendRes, cliRes, servRes, pelRes] = await Promise.all([
            fetchAll(() => supabase.from('ingresos').select('monto, fecha').gte('fecha', inicioIng).lte('fecha', finIng).order('fecha').order('id')),
            fetchAll(() => supabase.from('gastos').select('monto, fecha').gte('fecha', mes.desde).lte('fecha', mes.hasta).order('fecha').order('id')),
            fetchAll(() => supabase.from('citas').select('id, servicio_id, peluquero_id, estado, precio_cobrado').gte('fecha', mes.desde).lte('fecha', mes.hasta).order('id')),
            supabase.from('citas').select('id, cliente_id, servicio_id, peluquero_id, hora_inicio, hora_fin, estado').eq('fecha', hoy).order('hora_inicio'),
            supabase.from('citas').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente').gte('fecha', hoy),
            supabase.from('clientes').select('id', { count: 'exact', head: true }),
            supabase.from('servicios').select('id, nombre'),
            supabase.from('peluqueros').select('id, nombre')
        ]);
        for (const r of [citasHoyRes, pendRes, cliRes, servRes, pelRes]) if (r.error) throw r.error;

        state.ingresos = ingresos;
        const servicios = servRes.data || [];
        const peluqueros = pelRes.data || [];
        const citasHoy = citasHoyRes.data || [];

        // Tarjetas
        const ingHoy = suma(ingresos.filter((i) => fechaDe(i) === hoy));
        const ingMes = suma(ingresos.filter((i) => fechaDe(i) >= mes.desde && fechaDe(i) <= mes.hasta));
        const gasMes = suma(gastos);
        const neto = ingMes - gasMes;

        $('dash-ingresos-hoy').textContent = formatMoney(ingHoy);
        $('dash-citas-hoy').textContent = String(citasHoy.filter((c) => c.estado !== 'cancelada').length);
        $('dash-citas-detalle').textContent = detalleEstados(citasHoy);
        $('dash-pendientes').textContent = String(pendRes.count || 0);
        $('dash-neto-mes').textContent = formatMoney(neto);
        $('dash-neto-mes').style.color = neto >= 0 ? '#2fb36b' : '#e5484d';
        $('dash-clientes').textContent = String(cliRes.count || 0);

        // Destacados del mes
        renderDestacados(citasMes, servicios, peluqueros);

        // Citas de hoy
        await renderCitasHoy(citasHoy, servicios, peluqueros);

        dibujarGrafico();
        const ahora = new Date();
        $('dash-actualizado').textContent = `Actualizado a las ${pad(ahora.getHours())}:${pad(ahora.getMinutes())}`;
    } catch (err) {
        console.error('Error al cargar el dashboard:', err);
        showToast('No se pudieron cargar los datos. Revisa la consola (F12).', 'error');
    } finally {
        setLoading(btn, false);
        btn.innerHTML = '<i class="ph ph-arrows-clockwise"></i> Actualizar';
    }
}

function detalleEstados(citas) {
    const conteo = {};
    for (const c of citas) conteo[c.estado] = (conteo[c.estado] || 0) + 1;
    const partes = ['pendiente', 'confirmada', 'completada', 'cancelada']
        .filter((e) => conteo[e])
        .map((e) => `${conteo[e]} ${ESTADOS[e].texto.toLowerCase()}${conteo[e] === 1 ? '' : 's'}`);
    return partes.length ? partes.join(' · ') : 'Sin citas hoy';
}

function renderDestacados(citasMes, servicios, peluqueros) {
    // Servicio mas solicitado: citas no canceladas del mes
    const porServicio = new Map();
    for (const c of citasMes) {
        if (c.estado === 'cancelada' || !c.servicio_id) continue;
        porServicio.set(c.servicio_id, (porServicio.get(c.servicio_id) || 0) + 1);
    }
    const topServ = [...porServicio.entries()].sort((a, b) => b[1] - a[1])[0];
    const nombreServ = topServ ? (servicios.find((s) => s.id === topServ[0]) || {}).nombre : null;
    $('dash-top-servicio').textContent = topServ
        ? `${nombreServ || 'Servicio'} (${topServ[1]} cita${topServ[1] === 1 ? '' : 's'})`
        : 'Aún sin datos este mes';

    // Especialista con mas ventas: citas completadas del mes
    const porPeluquero = new Map();
    for (const c of citasMes) {
        if (c.estado !== 'completada' || !c.peluquero_id) continue;
        porPeluquero.set(c.peluquero_id, (porPeluquero.get(c.peluquero_id) || 0) + (Number(c.precio_cobrado) || 0));
    }
    const topPel = [...porPeluquero.entries()].sort((a, b) => b[1] - a[1])[0];
    const nombrePel = topPel ? (peluqueros.find((p) => p.id === topPel[0]) || {}).nombre : null;
    $('dash-top-peluquero').textContent = topPel
        ? `${nombrePel || 'Especialista'} (${formatMoney(topPel[1])})`
        : 'Aún sin ventas este mes';
}

async function renderCitasHoy(citas, servicios, peluqueros) {
    const cont = $('dash-hoy-lista');
    if (citas.length === 0) {
        cont.innerHTML = '<div class="dash-vacio">No hay citas registradas para hoy.</div>';
        return;
    }

    // Nombres de clientes de las citas de hoy
    const ids = [...new Set(citas.map((c) => c.cliente_id).filter(Boolean))];
    const clientes = new Map();
    for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await supabase.from('clientes').select('id, nombre').in('id', ids.slice(i, i + 100));
        if (error) throw error;
        data.forEach((c) => clientes.set(c.id, c.nombre));
    }

    cont.innerHTML = citas.map((c) => {
        const e = ESTADOS[c.estado] || ESTADOS.pendiente;
        const s = servicios.find((x) => x.id === c.servicio_id);
        const p = peluqueros.find((x) => x.id === c.peluquero_id);
        return `<a href="citas.html" class="dash-item ${escapeHTML(c.estado)}" style="--c:${e.color};text-decoration:none;color:inherit;">
            <span class="h">${formatTime(c.hora_inicio)}</span>
            <span class="i">${escapeHTML(clientes.get(c.cliente_id) || 'Cliente')}
                <small>${escapeHTML(s ? s.nombre : 'Servicio')} · ${escapeHTML(p ? p.nombre : 'Sin asignar')}</small></span>
            <span style="font-size:.7rem;color:${e.color};white-space:nowrap;">${e.texto}</span>
        </a>`;
    }).join('');
}

// ---------------------------------------------------------------------------
// Grafico de ingresos (ultimos 7 o 30 dias)
// ---------------------------------------------------------------------------
function dibujarGrafico() {
    $('dash-chart-titulo').textContent = `· últimos ${state.rango} días`;
    if (typeof Chart === 'undefined') {
        console.error('Chart.js no se cargó. Revisa la etiqueta <script> en dashboard.html.');
        return;
    }
    Chart.defaults.color = '#a0a0a0';
    Chart.defaults.borderColor = 'rgba(255,255,255,.08)';

    const hoy = fechaLocal(toISODate());
    const claves = [];
    const etiquetas = [];
    for (let i = state.rango - 1; i >= 0; i--) {
        const d = sumarDias(hoy, -i);
        claves.push(toISODate(d));
        etiquetas.push(state.rango === 7
            ? d.toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric' })
            : `${d.getDate()}/${d.getMonth() + 1}`);
    }
    const totales = new Map(claves.map((k) => [k, 0]));
    for (const i of state.ingresos) {
        const k = fechaDe(i);
        if (totales.has(k)) totales.set(k, totales.get(k) + (Number(i.monto) || 0));
    }
    const datos = claves.map((k) => Math.round(totales.get(k) * 100) / 100);

    if (state.chart) state.chart.destroy();
    state.chart = new Chart($('dash-chart'), {
        type: 'bar',
        data: {
            labels: etiquetas,
            datasets: [{ label: 'Ingresos', data: datos, backgroundColor: '#d4af37', borderRadius: 4 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (ctx) => `Ingresos: ${formatMoney(ctx.parsed.y)}` } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: (v) => '$' + v } },
                x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: state.rango === 7 ? 7 : 10 } }
            }
        }
    });
}