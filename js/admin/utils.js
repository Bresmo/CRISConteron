// ============================================================================
// UTILIDADES COMPARTIDAS DEL PANEL ADMINISTRATIVO
// Archivo: js/admin/utils.js
// ============================================================================
import { supabase } from '../supabaseClient.js';

// ---------------------------------------------------------------------------
// Texto y formato
// ---------------------------------------------------------------------------
export function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, (t) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[t]));
}

export function formatMoney(numero) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
        .format(Number(numero) || 0);
}

// Convierte 'YYYY-MM-DD', 'YYYY-MM', 'YYYY' o Date en una fecha LOCAL
// (evita el desfase de un dia que provoca interpretar fechas como UTC).
function parseLocalDate(valor) {
    if (valor instanceof Date) return new Date(valor.getTime());
    if (typeof valor === 'number') return new Date(valor, 0, 1);
    const s = String(valor || '').trim();
    let m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return new Date(+m[1], +m[2] - 1, +m[3]);
    if ((m = s.match(/^(\d{4})-(\d{2})$/))) return new Date(+m[1], +m[2] - 1, 1);
    if ((m = s.match(/^(\d{4})$/))) return new Date(+m[1], 0, 1);
    return new Date(s);
}

const pad = (n) => String(n).padStart(2, '0');

export function toISODate(fecha = new Date()) {
    const d = parseLocalDate(fecha);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(valor) {
    if (!valor) return '';
    return parseLocalDate(valor).toLocaleDateString('es-EC', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

export function formatTime(hora) {
    return hora ? String(hora).slice(0, 5) : '';
}

export function formatDateTime(valor) {
    if (!valor) return '';
    return new Date(valor).toLocaleString('es-EC', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

// periodo: 'dia' | 'mes' | 'anio'. referencia: Date, 'YYYY-MM-DD', 'YYYY-MM' o 'YYYY'.
// Devuelve { desde, hasta } en YYYY-MM-DD para filtrar con gte/lte en Supabase.
export function getDateRange(periodo, referencia = new Date()) {
    const base = parseLocalDate(referencia);
    let desde;
    let hasta;
    if (periodo === 'dia') {
        desde = new Date(base);
        hasta = new Date(base);
    } else if (periodo === 'mes') {
        desde = new Date(base.getFullYear(), base.getMonth(), 1);
        hasta = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    } else {
        desde = new Date(base.getFullYear(), 0, 1);
        hasta = new Date(base.getFullYear(), 11, 31);
    }
    return { desde: toISODate(desde), hasta: toISODate(hasta) };
}

export function debounce(fn, ms = 300) {
    let temporizador;
    return (...args) => {
        clearTimeout(temporizador);
        temporizador = setTimeout(() => fn(...args), ms);
    };
}

// ---------------------------------------------------------------------------
// Estilos propios (toast, confirmacion y menu lateral) para no depender de admin.css
// ---------------------------------------------------------------------------
function injectStyles() {
    if (document.getElementById('admin-utils-styles')) return;
    const style = document.createElement('style');
    style.id = 'admin-utils-styles';
    style.textContent = `
    #toast-container{position:fixed;top:1rem;right:1rem;z-index:10000;display:flex;flex-direction:column;gap:.5rem;max-width:min(92vw,360px)}
    .toast{padding:.8rem 1rem;border-radius:8px;font-size:.85rem;color:var(--color-text-primary);background:var(--color-bg-card);border-left:4px solid var(--color-accent);box-shadow:0 8px 24px rgba(0,0,0,.35);opacity:0;transform:translateY(-6px);animation:toast-in .25s forwards}
    .toast-exito{border-left-color:var(--color-success)}
    .toast-error{border-left-color:var(--color-error)}
    .toast-info{border-left-color:var(--color-accent-dark)}
    .toast-out{opacity:0!important;transition:opacity .3s}
    @keyframes toast-in{to{opacity:1;transform:none}}

    .cfm-overlay{position:fixed;inset:0;background:var(--color-bg-overlay);display:flex;align-items:center;justify-content:center;z-index:10001;padding:1rem}
    .cfm-box{background:var(--color-bg-card);border:1px solid var(--color-border);border-radius:10px;padding:1.5rem;max-width:420px;width:100%;color:var(--color-text-primary)}
    .cfm-msg{margin:0 0 1.25rem;line-height:1.5;color:var(--color-text-secondary);font-size:.95rem}
    .cfm-actions{display:flex;justify-content:flex-end;gap:.75rem}

    .sb-brand{padding:1.5rem 1.25rem;font-family:var(--font-brand,'Josefin Sans','Century Gothic',sans-serif);letter-spacing:.05em;font-weight:300;font-size:1.35rem;color:var(--color-text-primary);border-bottom:1px solid var(--color-border-subtle)}
    .sb-brand span{color:var(--color-accent)}
    .sb-nav{display:flex;flex-direction:column;gap:.25rem;padding:1rem .75rem}
    .sb-link{display:flex;align-items:center;gap:.75rem;padding:.7rem .9rem;border-radius:6px;color:var(--color-text-secondary);text-decoration:none;font-size:.85rem;background:none;border:0;cursor:pointer;width:100%;text-align:left;font-family:inherit}
    .sb-link:hover{background:var(--color-accent-glow);color:var(--color-accent)}
    .sb-link.active{background:var(--color-accent-glow);color:var(--color-accent)}
    .sb-footer{margin-top:auto;padding:1rem .75rem;border-top:1px solid var(--color-border-subtle);display:flex;flex-direction:column;gap:.25rem}
    `;
    document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Notificaciones y confirmaciones
// ---------------------------------------------------------------------------
// tipo: 'exito' | 'error' | 'info'
export function showToast(mensaje, tipo = 'info') {
    injectStyles();
    let contenedor = document.getElementById('toast-container');
    if (!contenedor) {
        contenedor = document.createElement('div');
        contenedor.id = 'toast-container';
        document.body.appendChild(contenedor);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensaje;
    contenedor.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 3800);
}

// Devuelve una Promise<boolean>. Reemplaza a window.confirm.
export function confirmDialog(mensaje, { textoOk = 'Confirmar', textoCancelar = 'Cancelar' } = {}) {
    injectStyles();
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'cfm-overlay';
        overlay.innerHTML = `
            <div class="cfm-box" role="dialog" aria-modal="true">
                <p class="cfm-msg"></p>
                <div class="cfm-actions">
                    <button type="button" class="btn-outline"></button>
                    <button type="button" class="btn-gold"></button>
                </div>
            </div>`;
        overlay.querySelector('.cfm-msg').textContent = mensaje;
        const [btnCancelar, btnOk] = overlay.querySelectorAll('button');
        btnCancelar.textContent = textoCancelar;
        btnOk.textContent = textoOk;

        const onKey = (e) => { if (e.key === 'Escape') cerrar(false); };
        const cerrar = (resultado) => {
            document.removeEventListener('keydown', onKey);
            overlay.remove();
            resolve(resultado);
        };
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(false); });
        btnCancelar.addEventListener('click', () => cerrar(false));
        btnOk.addEventListener('click', () => cerrar(true));
        document.addEventListener('keydown', onKey);
        document.body.appendChild(overlay);
        btnOk.focus();
    });
}

export function setLoading(elemento, cargando, texto = 'Cargando...') {
    if (!elemento) return;
    if (cargando) {
        if (elemento.dataset.textoOriginal === undefined) {
            elemento.dataset.textoOriginal = elemento.textContent;
        }
        elemento.textContent = texto;
        elemento.disabled = true;
    } else {
        if (elemento.dataset.textoOriginal !== undefined) {
            elemento.textContent = elemento.dataset.textoOriginal;
            delete elemento.dataset.textoOriginal;
        }
        elemento.disabled = false;
    }
}

// ---------------------------------------------------------------------------
// Exportar CSV (compatible con Excel: BOM UTF-8 para tildes)
// ---------------------------------------------------------------------------
export function downloadCSV(nombreArchivo, filas) {
    if (!filas || filas.length === 0) {
        showToast('No hay datos para exportar.', 'info');
        return;
    }
    const columnas = Object.keys(filas[0]);
    const escapar = (v) => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
        columnas.join(','),
        ...filas.map((f) => columnas.map((c) => escapar(f[c])).join(','))
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo.endsWith('.csv') ? nombreArchivo : `${nombreArchivo}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Subida de imagenes a Supabase Storage. Devuelve la URL publica.
// ---------------------------------------------------------------------------
export async function uploadImage(bucket, carpeta, archivo) {
    if (!archivo) throw new Error('No se seleccionó ningún archivo.');
    const permitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!permitidos.includes(archivo.type)) {
        throw new Error('La imagen debe ser JPG, PNG, WEBP o GIF.');
    }
    if (archivo.size > 3 * 1024 * 1024) {
        throw new Error('La imagen no debe superar los 3 MB.');
    }
    const ext = (archivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const ruta = `${carpeta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage.from(bucket).upload(ruta, archivo, {
        cacheControl: '3600',
        upsert: false,
        contentType: archivo.type
    });
    if (error) throw error;

    const { data } = supabase.storage.from(bucket).getPublicUrl(ruta);
    return data.publicUrl;
}

// ---------------------------------------------------------------------------
// Menu lateral del panel. Llamar ANTES de checkAdminAuth() para que el
// boton #btn-logout exista cuando auth.js le asigne su evento.
// Si el <aside class="admin-sidebar"> ya trae contenido, no lo toca.
// ---------------------------------------------------------------------------
export function renderSidebar(paginaActiva) {
    injectStyles();
    const aside = document.querySelector('.admin-sidebar');
    if (!aside || aside.children.length > 0) return;

    const items = [
        { id: 'dashboard', texto: 'Dashboard', icono: 'squares-four' },
        { id: 'servicios', texto: 'Servicios', icono: 'scissors' },
        { id: 'equipo', texto: 'Equipo', icono: 'users-three' },
        { id: 'citas', texto: 'Citas', icono: 'calendar-check' },
        { id: 'contabilidad', texto: 'Contabilidad', icono: 'chart-line-up' },
        { id: 'clientes', texto: 'Clientes', icono: 'address-book' },
        { id: 'configuracion', texto: 'Configuración', icono: 'gear' }
    ];

    aside.style.display = 'flex';
    aside.style.flexDirection = 'column';
    aside.innerHTML = `
        <div class="admin-mobile-header">
            <div class="sb-brand">CRIS <span>Conterón</span></div>
            <button type="button" class="admin-menu-toggle" aria-label="Abrir menú" aria-expanded="false">
                <span class="admin-menu-lines" aria-hidden="true"><i></i><i></i><i></i></span>
            </button>
        </div>
        <div class="admin-mobile-menu">
            <nav class="admin-mobile-links">
                ${items.map((i) => `
                    <a class="admin-mobile-link ${i.id === paginaActiva ? 'active' : ''}" href="${i.id}.html">
                        <i class="ph ph-${i.icono}"></i> ${i.texto}
                    </a>`).join('')}
                <a class="admin-mobile-link" href="../index.html" target="_blank" rel="noopener">
                    <i class="ph ph-arrow-square-out"></i> Ver sitio público
                </a>
            </nav>
            <button type="button" class="admin-mobile-logout" id="btn-mobile-logout">
                <i class="ph ph-sign-out"></i> Cerrar Sesión
            </button>
        </div>
        <div class="sb-brand">CRIS <span>Conterón</span></div>
        <nav class="sb-nav">
            ${items.map((i) => `
                <a class="sb-link ${i.id === paginaActiva ? 'active' : ''}" href="${i.id}.html">
                    <i class="ph ph-${i.icono}"></i> ${i.texto}
                </a>`).join('')}
        </nav>
        <div class="sb-footer">
            <a class="sb-link" href="../index.html" target="_blank" rel="noopener">
                <i class="ph ph-arrow-square-out"></i> Ver sitio público
            </a>
            <button type="button" class="sb-link" id="btn-logout">
                <i class="ph ph-sign-out"></i> Cerrar sesión
            </button>
        </div>`;

    const toggle = aside.querySelector('.admin-menu-toggle');
    const menu = aside.querySelector('.admin-mobile-menu');
    const closeMenu = () => {
        if (!toggle || !menu) return;
        toggle.setAttribute('aria-expanded', 'false');
        menu.classList.remove('open');
    };
    if (toggle && menu) {
        toggle.addEventListener('click', () => {
            const open = menu.classList.toggle('open');
            toggle.setAttribute('aria-expanded', String(open));
        });
        menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
        document.addEventListener('click', (event) => {
            if (!aside.contains(event.target)) closeMenu();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeMenu();
        });
    }
}