// ============================================================================
// GESTIÓN DE SERVICIOS Y CATEGORÍAS
// Archivo: js/admin/servicios.js  (usa admin/servicios.html)
// ============================================================================
import { supabase } from '../supabaseClient.js';
import { checkAdminAuth } from '../auth.js';
import {
    escapeHTML, formatMoney, showToast, confirmDialog, setLoading,
    debounce, uploadImage, renderSidebar
} from './utils.js';

const BUCKET = 'salon-media';
const PAGE_SIZE = 25;
const $ = (id) => document.getElementById(id);

const state = {
    servicios: [],
    categorias: [],
    pagina: 1,
    colImagen: 'imagen_url' // se detecta al cargar los datos
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

window.cerrarModalServicio = () => cerrarModal($('modal-servicio'));
window.cerrarModalCategoria = () => cerrarModal($('modal-categoria'));

const buscarServicio = (id) => state.servicios.find((s) => s.id === id);
const buscarCategoria = (id) => state.categorias.find((c) => c.id === id);
const nombreCategoria = (id) => (buscarCategoria(id) ? buscarCategoria(id).nombre : 'Sin categoría');

// ---------------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------------
async function init() {
    renderSidebar('servicios');
    const user = await checkAdminAuth();
    if (!user) return;

    bindEventos();
    await cargarDatos();
    render();
}

init().catch((err) => {
    console.error('Error al iniciar la página de servicios:', err);
    showToast('Error al iniciar la página.', 'error');
});

// ---------------------------------------------------------------------------
// Carga de datos
// ---------------------------------------------------------------------------
async function cargarDatos() {
    $('servicios-tbody').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:1.5rem;opacity:.7;">Cargando servicios...</td></tr>';
    $('categorias-tbody').innerHTML = '<tr><td colspan="4" style="text-align:center;padding:1.5rem;opacity:.7;">Cargando categorías...</td></tr>';

    try {
        const [categorias, servicios] = await Promise.all([
            fetchAll(() => supabase.from('categorias').select('*').order('orden').order('id')),
            fetchAll(() => supabase.from('servicios').select('*').order('orden').order('id'))
        ]);

        state.categorias = categorias;
        state.servicios = servicios;

        // Nombre real de la columna de imagen (imagen_url, foto_url, etc.)
        const muestra = servicios[0] || {};
        const col = Object.keys(muestra).find((k) => /^(imagen|foto)/i.test(k));
        if (col) state.colImagen = col;

        llenarSelectsCategoria();
    } catch (err) {
        console.error('Error al cargar servicios y categorías:', err);
        $('servicios-tbody').innerHTML = '<tr><td colspan="7" style="text-align:center;padding:1.5rem;color:#363636;font-weight:600;">No se pudo cargar el catálogo. Revisa la consola (F12).</td></tr>';
        throw err;
    }
}

function llenarSelectsCategoria() {
    const filtro = $('filtro-categoria-servicio');
    const valorFiltro = filtro.value;
    filtro.innerHTML = '<option value="">Todas las categorías</option>' +
        state.categorias.map((c) => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.nombre)}</option>`).join('');
    filtro.value = valorFiltro;

    const modal = $('srv-categoria');
    const valorModal = modal.value;
    modal.innerHTML = state.categorias.map((c) => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.nombre)}</option>`).join('');
    if (valorModal) modal.value = valorModal;
}

// ---------------------------------------------------------------------------
// Listado de servicios
// ---------------------------------------------------------------------------
function ordenados(lista) {
    const posCategoria = new Map(state.categorias.map((c, i) => [c.id, i]));
    return [...lista].sort((a, b) =>
        ((posCategoria.get(a.categoria_id) ?? 999) - (posCategoria.get(b.categoria_id) ?? 999)) ||
        ((a.orden ?? 0) - (b.orden ?? 0)) ||
        String(a.nombre).localeCompare(String(b.nombre))
    );
}

function filtrados() {
    const q = $('search-servicios').value.trim().toLowerCase();
    const categoria = $('filtro-categoria-servicio').value;
    const estado = $('filtro-estado-servicio').value;
    return ordenados(state.servicios.filter((s) => {
        if (q && !`${s.nombre || ''} ${s.descripcion || ''}`.toLowerCase().includes(q)) return false;
        if (categoria && s.categoria_id !== categoria) return false;
        if (estado !== '' && String(!!s.activo) !== estado) return false;
        return true;
    }));
}

const boton = (accion, id, icono, titulo) =>
    `<button type="button" class="btn-outline" data-accion="${accion}" data-id="${escapeHTML(id)}" title="${titulo}" style="padding:.35rem .6rem;font-size:.8rem;"><i class="ph ph-${icono}"></i></button>`;

function filaServicio(s) {
    const imagen = s[state.colImagen];
    const miniatura = imagen
        ? `<img src="${escapeHTML(imagen)}" alt="" style="width:56px;height:40px;border-radius:6px;object-fit:cover;">`
        : '<div style="width:56px;height:40px;border-radius:6px;background:#878787;border:1px solid #363636;display:flex;align-items:center;justify-content:center;"><i class="ph ph-image"></i></div>';
    const estado = s.activo
        ? '<span style="color:#363636;font-size:.8rem;font-weight:600;">● Visible</span>'
        : '<span style="color:#878787;font-size:.8rem;">● Oculto</span>';
    const descripcion = s.descripcion
        ? `<br><small style="opacity:.6;">${escapeHTML(String(s.descripcion).slice(0, 70))}${String(s.descripcion).length > 70 ? '…' : ''}</small>`
        : '';

    return `
        <tr>
            <td>${miniatura}</td>
            <td>${escapeHTML(s.nombre)}${descripcion}</td>
            <td>${escapeHTML(nombreCategoria(s.categoria_id))}</td>
            <td>${s.duracion_min} min</td>
            <td>${formatMoney(s.precio)}</td>
            <td>${estado}</td>
            <td>
                <div style="display:flex;justify-content:flex-end;gap:.4rem;">
                    ${boton('subir', s.id, 'arrow-up', 'Subir en su categoría')}
                    ${boton('bajar', s.id, 'arrow-down', 'Bajar en su categoría')}
                    ${boton('editar', s.id, 'pencil-simple', 'Editar')}
                    ${boton('visible', s.id, s.activo ? 'eye-slash' : 'eye', s.activo ? 'Ocultar' : 'Mostrar')}
                    ${boton('eliminar', s.id, 'trash', 'Eliminar')}
                </div>
            </td>
        </tr>`;
}

function renderServicios() {
    const tbody = $('servicios-tbody');
    const lista = filtrados();
    const visibles = lista.slice(0, state.pagina * PAGE_SIZE);

    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:1.5rem;opacity:.7;">No hay servicios que coincidan.</td></tr>';
        return;
    }

    let html = visibles.map(filaServicio).join('');
    if (lista.length > visibles.length) {
        html += `<tr><td colspan="7" style="text-align:center;padding:1rem;">
            <button type="button" class="btn-outline" data-mas="1">Mostrar más (${lista.length - visibles.length} restantes)</button>
        </td></tr>`;
    }
    tbody.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Listado de categorías
// ---------------------------------------------------------------------------
function renderCategorias() {
    const tbody = $('categorias-tbody');
    if (state.categorias.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:1.5rem;opacity:.7;">Aún no hay categorías. Crea la primera.</td></tr>';
        return;
    }
    tbody.innerHTML = state.categorias.map((c) => {
        const cantidad = state.servicios.filter((s) => s.categoria_id === c.id).length;
        const estado = c.activa
            ? '<span style="color:#363636;font-size:.8rem;font-weight:600;">● Activa</span>'
            : '<span style="color:#878787;font-size:.8rem;">● Inactiva</span>';
        return `
            <tr>
                <td>${escapeHTML(c.nombre)}</td>
                <td>${cantidad}</td>
                <td>${estado}</td>
                <td>
                    <div style="display:flex;justify-content:flex-end;gap:.4rem;">
                        ${boton('cat-subir', c.id, 'arrow-up', 'Subir')}
                        ${boton('cat-bajar', c.id, 'arrow-down', 'Bajar')}
                        ${boton('cat-editar', c.id, 'pencil-simple', 'Renombrar')}
                        ${boton('cat-activa', c.id, c.activa ? 'eye-slash' : 'eye', c.activa ? 'Desactivar' : 'Activar')}
                        ${boton('cat-eliminar', c.id, 'trash', 'Eliminar')}
                    </div>
                </td>
            </tr>`;
    }).join('');
}

function render() {
    renderServicios();
    renderCategorias();
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------
function bindEventos() {
    $('btn-nuevo-servicio').addEventListener('click', () => abrirFormularioServicio(null));
    $('btn-nueva-categoria').addEventListener('click', () => abrirFormularioCategoria(null));

    const refrescar = () => { state.pagina = 1; renderServicios(); };
    $('search-servicios').addEventListener('input', debounce(refrescar, 250));
    $('filtro-categoria-servicio').addEventListener('change', refrescar);
    $('filtro-estado-servicio').addEventListener('change', refrescar);

    $('servicios-tbody').addEventListener('click', (e) => {
        if (e.target.closest('[data-mas]')) {
            state.pagina += 1;
            renderServicios();
            return;
        }
        const btn = e.target.closest('button[data-accion]');
        if (!btn) return;
        const id = btn.dataset.id;
        switch (btn.dataset.accion) {
            case 'editar': abrirFormularioServicio(buscarServicio(id)); break;
            case 'visible': alternarVisibilidad(id); break;
            case 'eliminar': eliminarServicio(id); break;
            case 'subir': moverServicio(id, -1); break;
            case 'bajar': moverServicio(id, 1); break;
        }
    });

    $('categorias-tbody').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-accion]');
        if (!btn) return;
        const id = btn.dataset.id;
        switch (btn.dataset.accion) {
            case 'cat-editar': abrirFormularioCategoria(buscarCategoria(id)); break;
            case 'cat-activa': alternarCategoria(id); break;
            case 'cat-eliminar': eliminarCategoria(id); break;
            case 'cat-subir': moverCategoria(id, -1); break;
            case 'cat-bajar': moverCategoria(id, 1); break;
        }
    });

    $('form-servicio').addEventListener('submit', guardarServicio);
    $('form-categoria').addEventListener('submit', guardarCategoria);

    $('srv-imagen-file').addEventListener('change', () => {
        const archivo = $('srv-imagen-file').files[0];
        mostrarPreview(archivo ? URL.createObjectURL(archivo) : $('srv-imagen-url').value);
    });

    ['modal-servicio', 'modal-categoria'].forEach((id) => {
        $(id).addEventListener('click', (e) => { if (e.target === $(id)) cerrarModal($(id)); });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cerrarModal($('modal-servicio'));
            cerrarModal($('modal-categoria'));
        }
    });
}

// ---------------------------------------------------------------------------
// Orden (subir / bajar)
// ---------------------------------------------------------------------------
async function aplicarOrden(tabla, items) {
    const resultados = await Promise.all(items.map((it) =>
        supabase.from(tabla).update({ orden: it.orden }).eq('id', it.id).select('id')
    ));
    const fallo = resultados.find((r) => r.error || !r.data || r.data.length === 0);
    if (fallo) throw fallo.error || new Error('No se actualizó el orden (revisa tus permisos).');
}

// Intercambia dos elementos conservando los "huecos" de orden que ya existen.
// Si hay empates o valores vacios, renumera desde 1.
function calcularNuevoOrden(grupo, i, j) {
    const valores = grupo.map((x) => x.orden);
    const sinEmpates = valores.every((v) => v !== null && v !== undefined) && new Set(valores).size === valores.length;
    const nuevos = sinEmpates ? valores : grupo.map((_, k) => k + 1);
    const copia = [...grupo];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    return copia.map((x, k) => ({ id: x.id, orden: nuevos[k] }));
}

async function moverServicio(id, delta) {
    const s = buscarServicio(id);
    if (!s) return;
    const grupo = ordenados(state.servicios.filter((x) => x.categoria_id === s.categoria_id));
    const i = grupo.findIndex((x) => x.id === id);
    const j = i + delta;
    if (j < 0 || j >= grupo.length) return;

    try {
        await aplicarOrden('servicios', calcularNuevoOrden(grupo, i, j));
        await cargarDatos();
        render();
    } catch (err) {
        console.error('Error al reordenar servicios:', err);
        showToast('No se pudo cambiar el orden: ' + (err.message || 'error'), 'error');
    }
}

async function moverCategoria(id, delta) {
    const grupo = [...state.categorias];
    const i = grupo.findIndex((c) => c.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= grupo.length) return;

    try {
        await aplicarOrden('categorias', calcularNuevoOrden(grupo, i, j));
        await cargarDatos();
        render();
    } catch (err) {
        console.error('Error al reordenar categorías:', err);
        showToast('No se pudo cambiar el orden: ' + (err.message || 'error'), 'error');
    }
}

// ---------------------------------------------------------------------------
// Formulario de servicio
// ---------------------------------------------------------------------------
function mostrarPreview(src) {
    const img = $('srv-imagen-preview');
    if (src) {
        img.src = src;
        img.style.display = 'block';
    } else {
        img.removeAttribute('src');
        img.style.display = 'none';
    }
}

function abrirFormularioServicio(s) {
    if (state.categorias.length === 0) {
        showToast('Primero crea al menos una categoría.', 'info');
        return;
    }
    $('form-servicio').reset();
    llenarSelectsCategoria();
    $('modal-servicio-titulo').textContent = s ? 'Editar Servicio' : 'Nuevo Servicio';
    $('srv-id').value = s ? s.id : '';
    $('srv-nombre').value = s ? (s.nombre || '') : '';
    if (s && s.categoria_id) $('srv-categoria').value = s.categoria_id;
    $('srv-precio').value = s ? (s.precio ?? '') : '';
    $('srv-duracion').value = s ? (s.duracion_min ?? 60) : 60;
    $('srv-descripcion').value = s ? (s.descripcion || '') : '';
    $('srv-activo').value = s ? String(!!s.activo) : 'true';
    $('srv-imagen-url').value = s ? (s[state.colImagen] || '') : '';
    mostrarPreview(s ? s[state.colImagen] : '');
    abrirModal($('modal-servicio'));
    $('srv-nombre').focus();
}

async function guardarServicio(e) {
    e.preventDefault();
    const btn = e.submitter || $('form-servicio').querySelector('[type="submit"]');
    const id = $('srv-id').value;
    const nombre = $('srv-nombre').value.trim();
    const categoriaId = $('srv-categoria').value;
    const precio = parseFloat($('srv-precio').value);
    const duracion = parseInt($('srv-duracion').value, 10);

    if (!nombre) { showToast('El nombre es obligatorio.', 'error'); return; }
    if (!categoriaId) { showToast('Elige una categoría.', 'error'); return; }
    if (Number.isNaN(precio) || precio < 0) { showToast('Ingresa un precio válido.', 'error'); return; }
    if (Number.isNaN(duracion) || duracion < 5) { showToast('La duración mínima es de 5 minutos.', 'error'); return; }

    setLoading(btn, true, 'Guardando...');
    try {
        let imagenUrl = $('srv-imagen-url').value || null;
        const archivo = $('srv-imagen-file').files[0];
        if (archivo) imagenUrl = await uploadImage(BUCKET, 'servicios', archivo);

        const datos = {
            nombre,
            categoria_id: categoriaId,
            descripcion: $('srv-descripcion').value.trim() || null,
            precio,
            duracion_min: duracion,
            activo: $('srv-activo').value === 'true',
            [state.colImagen]: imagenUrl
        };

        if (id) {
            const { data, error } = await supabase.from('servicios').update(datos).eq('id', id).select('id');
            if (error) throw error;
            if (!data || data.length === 0) throw new Error('No se actualizó ninguna fila (revisa tus permisos de administrador).');
        } else {
            const mismos = state.servicios.filter((s) => s.categoria_id === categoriaId);
            const siguiente = mismos.reduce((max, s) => Math.max(max, Number(s.orden) || 0), 0) + 1;
            const { error } = await supabase.from('servicios')
                .insert([{ id: crypto.randomUUID(), orden: siguiente, ...datos }]);
            if (error) throw error;
        }

        cerrarModal($('modal-servicio'));
        showToast('Servicio guardado. Ya se refleja en el sitio público.', 'exito');
        await cargarDatos();
        render();
    } catch (err) {
        console.error('Error al guardar servicio:', err);
        showToast('No se pudo guardar: ' + (err.message || 'error desconocido'), 'error');
    } finally {
        setLoading(btn, false);
    }
}

async function alternarVisibilidad(id) {
    const s = buscarServicio(id);
    if (!s) return;
    const nuevo = !s.activo;
    try {
        const { data, error } = await supabase.from('servicios').update({ activo: nuevo }).eq('id', id).select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No se actualizó ninguna fila (revisa tus permisos).');
        s.activo = nuevo;
        renderServicios();
        showToast(nuevo ? 'Servicio visible en el sitio.' : 'Servicio oculto del sitio y de las reservas.', 'exito');
    } catch (err) {
        console.error('Error al cambiar la visibilidad:', err);
        showToast('No se pudo cambiar: ' + (err.message || 'error'), 'error');
    }
}

async function eliminarServicio(id) {
    const s = buscarServicio(id);
    if (!s) return;

    try {
        const { count, error: errCount } = await supabase
            .from('citas').select('id', { count: 'exact', head: true }).eq('servicio_id', id);
        if (errCount) throw errCount;

        if (count > 0) {
            const ocultar = await confirmDialog(
                `"${s.nombre}" tiene ${count} cita(s) registradas. Para conservar el historial no se puede eliminar, pero puedes ocultarlo para que no aparezca en el sitio ni en las reservas.`,
                { textoOk: 'Ocultar' }
            );
            if (ocultar && s.activo) await alternarVisibilidad(id);
            return;
        }

        const ok = await confirmDialog(
            `¿Eliminar definitivamente "${s.nombre}"? Esta acción no se puede deshacer.`,
            { textoOk: 'Eliminar' }
        );
        if (!ok) return;

        await supabase.from('peluquero_servicios').delete().eq('servicio_id', id);
        const { data, error } = await supabase.from('servicios').delete().eq('id', id).select('id');
        if (error) {
            if (error.code === '23503') {
                showToast('Tiene registros asociados. Ocúltalo en lugar de eliminarlo.', 'error');
                return;
            }
            throw error;
        }
        if (!data || data.length === 0) throw new Error('No se eliminó ninguna fila (revisa tus permisos).');

        showToast('Servicio eliminado.', 'exito');
        await cargarDatos();
        render();
    } catch (err) {
        console.error('Error al eliminar servicio:', err);
        showToast('No se pudo eliminar: ' + (err.message || 'error'), 'error');
    }
}

// ---------------------------------------------------------------------------
// Categorías: crear, renombrar, activar y eliminar
// ---------------------------------------------------------------------------
function abrirFormularioCategoria(c) {
    $('form-categoria').reset();
    $('modal-categoria-titulo').textContent = c ? 'Renombrar Categoría' : 'Nueva Categoría';
    $('cat-id').value = c ? c.id : '';
    $('cat-nombre').value = c ? (c.nombre || '') : '';
    abrirModal($('modal-categoria'));
    $('cat-nombre').focus();
}

async function guardarCategoria(e) {
    e.preventDefault();
    const btn = e.submitter || $('form-categoria').querySelector('[type="submit"]');
    const id = $('cat-id').value;
    const nombre = $('cat-nombre').value.trim();
    if (!nombre) { showToast('El nombre es obligatorio.', 'error'); return; }

    const repetida = state.categorias.some((c) => c.id !== id && c.nombre.trim().toLowerCase() === nombre.toLowerCase());
    if (repetida) { showToast('Ya existe una categoría con ese nombre.', 'error'); return; }

    setLoading(btn, true, 'Guardando...');
    try {
        if (id) {
            const { data, error } = await supabase.from('categorias').update({ nombre }).eq('id', id).select('id');
            if (error) throw error;
            if (!data || data.length === 0) throw new Error('No se actualizó ninguna fila (revisa tus permisos).');
        } else {
            const siguiente = state.categorias.reduce((max, c) => Math.max(max, Number(c.orden) || 0), 0) + 1;
            const { error } = await supabase.from('categorias')
                .insert([{ id: crypto.randomUUID(), nombre, orden: siguiente, activa: true }]);
            if (error) throw error;
        }
        cerrarModal($('modal-categoria'));
        showToast('Categoría guardada.', 'exito');
        await cargarDatos();
        render();
    } catch (err) {
        console.error('Error al guardar categoría:', err);
        showToast('No se pudo guardar: ' + (err.message || 'error'), 'error');
    } finally {
        setLoading(btn, false);
    }
}

async function alternarCategoria(id) {
    const c = buscarCategoria(id);
    if (!c) return;
    const nueva = !c.activa;
    try {
        const { data, error } = await supabase.from('categorias').update({ activa: nueva }).eq('id', id).select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No se actualizó ninguna fila (revisa tus permisos).');
        c.activa = nueva;
        renderCategorias();
        showToast(nueva ? 'Categoría activada.' : 'Categoría desactivada.', 'exito');
    } catch (err) {
        console.error('Error al cambiar el estado de la categoría:', err);
        showToast('No se pudo cambiar: ' + (err.message || 'error'), 'error');
    }
}

async function eliminarCategoria(id) {
    const c = buscarCategoria(id);
    if (!c) return;

    const cantidad = state.servicios.filter((s) => s.categoria_id === id).length;
    if (cantidad > 0) {
        showToast(`"${c.nombre}" tiene ${cantidad} servicio(s). Muévelos a otra categoría o elimínalos primero.`, 'info');
        return;
    }

    const ok = await confirmDialog(`¿Eliminar la categoría "${c.nombre}"?`, { textoOk: 'Eliminar' });
    if (!ok) return;

    try {
        const { data, error } = await supabase.from('categorias').delete().eq('id', id).select('id');
        if (error) {
            if (error.code === '23503') {
                showToast('La categoría tiene registros asociados. Desactívala en lugar de eliminarla.', 'error');
                return;
            }
            throw error;
        }
        if (!data || data.length === 0) throw new Error('No se eliminó ninguna fila (revisa tus permisos).');
        showToast('Categoría eliminada.', 'exito');
        await cargarDatos();
        render();
    } catch (err) {
        console.error('Error al eliminar categoría:', err);
        showToast('No se pudo eliminar: ' + (err.message || 'error'), 'error');
    }
}