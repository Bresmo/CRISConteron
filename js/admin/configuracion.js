// ============================================================================
// CONFIGURACIÓN DEL NEGOCIO
// Archivo: js/admin/configuracion.js  (usa admin/configuracion.html)
// Tabla: configuracion (clave text, valor text)
// ============================================================================
import { supabase } from '../supabaseClient.js';
import { checkAdminAuth } from '../auth.js';
import {
    escapeHTML, showToast, confirmDialog, setLoading, renderSidebar
} from './utils.js';

const $ = (id) => document.getElementById(id);

const state = {
    ajustes: [],            // [{ clave, valor }]
    originales: new Map()   // clave -> valor guardado
};

// Etiquetas amigables para claves comunes; las demas se "humanizan".
const ETIQUETAS = {
    nombre_negocio: 'Nombre del negocio',
    eslogan: 'Eslogan',
    telefono: 'Teléfono',
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    direccion: 'Dirección',
    horario_semana: 'Horario de lunes a viernes',
    horario_fin_semana: 'Horario de fin de semana'
};

function etiquetaDe(clave) {
    if (ETIQUETAS[clave]) return ETIQUETAS[clave];
    const texto = clave.replace(/_/g, ' ');
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// ---------------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------------
async function init() {
    renderSidebar('configuracion');
    const user = await checkAdminAuth();
    if (!user) return;

    $('form-config').addEventListener('submit', guardarCambios);
    $('form-ajuste').addEventListener('submit', agregarAjuste);
    $('form-password').addEventListener('submit', cambiarPassword);
    $('config-lista').addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-eliminar]');
        if (btn) eliminarAjuste(btn.dataset.eliminar);
    });

    await cargar();
}

init().catch((err) => {
    console.error('Error al iniciar la configuración:', err);
    showToast('Error al iniciar la página.', 'error');
});

// ---------------------------------------------------------------------------
// Carga y render
// ---------------------------------------------------------------------------
async function cargar() {
    const cont = $('config-lista');
    cont.innerHTML = '<p style="opacity:.7;">Cargando ajustes...</p>';
    try {
        const { data, error } = await supabase.from('configuracion').select('clave, valor').order('clave');
        if (error) throw error;
        state.ajustes = data || [];
        state.originales = new Map(state.ajustes.map((a) => [a.clave, a.valor ?? '']));
        render();
    } catch (err) {
        console.error('Error al cargar la configuración:', err);
        cont.innerHTML = '<p style="color:var(--color-text-secondary);font-weight:600;">No se pudo cargar la configuración. Revisa la consola (F12).</p>';
    }
}

function render() {
    const cont = $('config-lista');
    if (state.ajustes.length === 0) {
        cont.innerHTML = '<p style="opacity:.7;">Aún no hay ajustes guardados. Agrega el primero en la sección de abajo.</p>';
        return;
    }
    cont.innerHTML = state.ajustes.map((a) => {
        const valor = a.valor ?? '';
        const largo = valor.length > 60 || valor.includes('\n');
        const campo = largo
            ? `<textarea class="form-control" rows="3" data-clave="${escapeHTML(a.clave)}">${escapeHTML(valor)}</textarea>`
            : `<input type="text" class="form-control" data-clave="${escapeHTML(a.clave)}" value="${escapeHTML(valor)}">`;
        return `
            <div class="form-group" style="display:grid;grid-template-columns:1fr auto;gap:.75rem;align-items:end;">
                <div>
                    <label>${escapeHTML(etiquetaDe(a.clave))} <small style="opacity:.5;text-transform:none;letter-spacing:0;">(${escapeHTML(a.clave)})</small></label>
                    ${campo}
                </div>
                <button type="button" class="btn-outline" data-eliminar="${escapeHTML(a.clave)}" title="Eliminar ajuste" style="padding:.55rem .75rem;">
                    <i class="ph ph-trash"></i>
                </button>
            </div>`;
    }).join('');
}

// ---------------------------------------------------------------------------
// Guardar cambios (solo los campos modificados)
// ---------------------------------------------------------------------------
async function guardarCambios(e) {
    e.preventDefault();
    const btn = $('btn-guardar-config');

    const cambios = [];
    $('config-lista').querySelectorAll('[data-clave]').forEach((campo) => {
        const clave = campo.dataset.clave;
        const nuevo = campo.value.trim();
        if (nuevo !== String(state.originales.get(clave) ?? '').trim()) cambios.push({ clave, valor: nuevo });
    });

    if (cambios.length === 0) {
        showToast('No hay cambios que guardar.', 'info');
        return;
    }

    setLoading(btn, true, 'Guardando...');
    try {
        for (const c of cambios) {
            const { data, error } = await supabase.from('configuracion')
                .update({ valor: c.valor }).eq('clave', c.clave).select('clave');
            if (error) throw error;
            if (!data || data.length === 0) throw new Error(`No se pudo actualizar "${c.clave}" (revisa tus permisos de administrador).`);
        }
        showToast(`${cambios.length} ajuste${cambios.length === 1 ? '' : 's'} guardado${cambios.length === 1 ? '' : 's'}. Recarga el sitio público para verlo.`, 'exito');
        await cargar();
    } catch (err) {
        console.error('Error al guardar la configuración:', err);
        showToast('No se pudo guardar: ' + (err.message || 'error desconocido'), 'error');
    } finally {
        setLoading(btn, false);
    }
}

// ---------------------------------------------------------------------------
// Agregar y eliminar ajustes
// ---------------------------------------------------------------------------
async function agregarAjuste(e) {
    e.preventDefault();
    const btn = e.submitter || $('form-ajuste').querySelector('[type="submit"]');
    const clave = $('aj-clave').value.trim().toLowerCase();
    const valor = $('aj-valor').value.trim();

    if (!/^[a-z0-9_]+$/.test(clave)) {
        showToast('La clave solo admite minúsculas, números y guion bajo (sin espacios ni tildes).', 'error');
        return;
    }
    if (!valor) { showToast('Escribe un valor.', 'error'); return; }
    if (state.originales.has(clave)) {
        showToast('Esa clave ya existe. Edita su valor en la lista de arriba.', 'info');
        return;
    }

    setLoading(btn, true, 'Agregando...');
    try {
        const { error } = await supabase.from('configuracion').insert([{ clave, valor }]);
        if (error) throw error;
        $('form-ajuste').reset();
        showToast('Ajuste agregado.', 'exito');
        await cargar();
    } catch (err) {
        console.error('Error al agregar el ajuste:', err);
        showToast('No se pudo agregar: ' + (err.message || 'error desconocido'), 'error');
    } finally {
        setLoading(btn, false);
    }
}

async function eliminarAjuste(clave) {
    const ok = await confirmDialog(
        `¿Eliminar el ajuste "${clave}"? Si el sitio público lo usa, dejará de mostrarse ese dato.`,
        { textoOk: 'Eliminar' }
    );
    if (!ok) return;
    try {
        const { data, error } = await supabase.from('configuracion').delete().eq('clave', clave).select('clave');
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('No se eliminó ninguna fila (revisa tus permisos).');
        showToast('Ajuste eliminado.', 'exito');
        await cargar();
    } catch (err) {
        console.error('Error al eliminar el ajuste:', err);
        showToast('No se pudo eliminar: ' + (err.message || 'error'), 'error');
    }
}

// ---------------------------------------------------------------------------
// Cambio de contraseña del administrador
// ---------------------------------------------------------------------------
async function cambiarPassword(e) {
    e.preventDefault();
    const btn = e.submitter || $('form-password').querySelector('[type="submit"]');
    const nueva = $('pw-nueva').value;
    const confirmar = $('pw-confirmar').value;

    if (nueva.length < 8) { showToast('La contraseña debe tener al menos 8 caracteres.', 'error'); return; }
    if (nueva !== confirmar) { showToast('Las contraseñas no coinciden.', 'error'); return; }

    setLoading(btn, true, 'Actualizando...');
    try {
        const { error } = await supabase.auth.updateUser({ password: nueva });
        if (error) throw error;
        $('form-password').reset();
        showToast('Contraseña actualizada. Úsala la próxima vez que inicies sesión.', 'exito');
    } catch (err) {
        console.error('Error al cambiar la contraseña:', err);
        showToast('No se pudo cambiar la contraseña: ' + (err.message || 'error'), 'error');
    } finally {
        setLoading(btn, false);
    }
}