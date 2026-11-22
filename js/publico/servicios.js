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

        const categorias = catRes.data;
        const servicios = srvRes.data;

        // Renderizar pestañas
        tabsContainer.innerHTML = `<button class="tab-btn active" data-category="all">Todos</button>` +
            categorias.map(cat => `<button class="tab-btn" data-category="${cat.id}">${cat.nombre}</button>`).join('');

        // Renderizar listado de servicios
        renderizarCards(servicios, gridContainer);

        // Eventos de filtrado por categoría
        tabsContainer.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                tabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                const catId = e.target.getAttribute('data-category');
                const filtrados = catId === 'all' 
                    ? servicios 
                    : servicios.filter(s => s.categoria_id === catId);
                
                renderizarCards(filtrados, gridContainer);
            });
        });

    } catch (err) {
        console.error('Error cargando servicios:', err);
        gridContainer.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--color-error);">Error al cargar el catálogo de servicios.</p>`;
    }
}

function renderizarCards(servicios, container) {
    if (servicios.length === 0) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-secondary);">No hay servicios disponibles en esta categoría.</p>`;
        return;
    }

    container.innerHTML = servicios.map(s => `
        <div class="service-card reveal">
            ${s.imagen_url ? `<img src="${s.imagen_url}" alt="${s.nombre}" class="service-img" loading="lazy">` : ''}
            <div class="service-body">
                <div class="service-info-top">
                    <h3 class="service-title">${escapeHTML(s.nombre)}</h3>
                    <span class="service-price">$${Number(s.precio).toFixed(2)}</span>
                </div>
                <p class="service-desc">${escapeHTML(s.descripcion || '')}</p>
                <div class="service-footer">
                    <span><i class="ph ph-clock"></i> ${s.duracion_min} min</span>
                    <a href="reservar.html?servicio=${s.id}" class="btn-outline" style="padding: 0.4rem 1rem; font-size: 0.75rem;">Reservar</a>
                </div>
            </div>
        </div>
    `).join('');
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}