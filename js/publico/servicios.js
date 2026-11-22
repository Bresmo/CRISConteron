// ============================================================================
// RENDERIZADO DINÁMICO DE SERVICIOS Y CATEGORÍAS
// ============================================================================
import { supabase } from '../supabaseClient.js';

export async function initServicios() {
    const tabsContainer = document.getElementById('categories-tabs');
    const gridContainer = document.getElementById('services-grid');

    if (!tabsContainer || !gridContainer) return;

    try {
        // Cargar categorías y servicios activos
        const [catRes, srvRes] = await Promise.all([
            supabase.from('categorias').select('*').eq('activa', true).order('orden'),
            supabase.from('servicios').select('*, categorias(nombre)').eq('activo', true).order('orden')
        ]);

        if (catRes.error) throw catRes.error;
        if (srvRes.error) throw srvRes.error;

        const categorias = catRes.data || [];
        const servicios = srvRes.data || [];

        // Renderizar pestañas
        tabsContainer.innerHTML = `<button class="tab-btn active" data-category="all">Todos</button>` +
            categorias.map(cat => `<button class="tab-btn" data-category="${cat.id}">${escapeHTML(cat.nombre)}</button>`).join('');

        // Renderizar listado completo inicial
        renderizarCards(servicios, gridContainer);

        // Eventos de filtrado por categoría
        tabsContainer.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                tabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                const catId = e.currentTarget.getAttribute('data-category');
                const filtrados = (catId === 'all' || !catId) 
                    ? servicios 
                    : servicios.filter(s => s.categoria_id === catId);
                
                renderizarCards(filtrados, gridContainer);
            });
        });

    } catch (err) {
        console.error('Error detallado cargando servicios:', err);
        gridContainer.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--color-error);">Error al cargar el catálogo de servicios.</p>`;
    }
}

function renderizarCards(servicios, container) {
    if (!servicios || servicios.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-secondary);">No hay servicios disponibles en esta categoría.</p>`;
        return;
    }

    const imagenDefault = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=80';

    container.innerHTML = servicios.map(s => {
        const imagen = s.imagen_url ? s.imagen_url : imagenDefault;
        const precio = s.precio !== null && s.precio !== undefined ? Number(s.precio).toFixed(2) : '0.00';
        const duracion = s.duracion_min || 30;
        const nombre = s.nombre || 'Servicio';
        const descripcion = s.descripcion || '';

        return `
            <div class="service-card reveal active">
                <img src="${imagen}" alt="${escapeHTML(nombre)}" class="service-img" loading="lazy" onerror="this.src='${imagenDefault}'">
                <div class="service-body">
                    <div class="service-info-top">
                        <h3 class="service-title">${escapeHTML(nombre)}</h3>
                        <span class="service-price">$${precio}</span>
                    </div>
                    <p class="service-desc">${escapeHTML(descripcion)}</p>
                    <div class="service-footer">
                        <span><i class="ph ph-clock"></i> ${duracion} min</span>
                        <a href="reservar.html?servicio=${s.id}" class="btn-outline" style="padding: 0.4rem 1rem; font-size: 0.75rem;">Reservar</a>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Asegurar visibilidad inmediata de las tarjetas inyectadas dinámicamente
    container.querySelectorAll('.reveal').forEach(el => {
        el.classList.add('active');
    });
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}