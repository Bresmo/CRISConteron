// ============================================================================
// RENDERIZADO DINÁMICO DE EQUIPO Y TESTIMONIOS
// ============================================================================
import { supabase } from '../supabaseClient.js';

export async function initEquipo() {
    const teamGrid = document.getElementById('team-grid');
    if (!teamGrid) return;

    try {
        const { data: peluqueros, error } = await supabase
            .from('peluqueros')
            .select('*')
            .eq('activo', true);

        if (error) throw error;

        const listaPeluqueros = peluqueros || [];

        if (listaPeluqueros.length === 0) {
            teamGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-secondary);">No hay estilistas disponibles en este momento.</p>`;
            return;
        }

        const fotoDefault = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=80';

        teamGrid.innerHTML = listaPeluqueros.map(p => {
            const foto = p.foto_url ? p.foto_url : fotoDefault;
            const nombre = p.nombre || 'Especialista';
            const especialidad = p.especialidad || 'Estilista Senior';
            const bio = p.bio || '';

            return `
                <div class="team-card reveal active">
                    <div class="team-img-wrapper">
                        <img src="${foto}" alt="${escapeHTML(nombre)}" class="team-img" loading="lazy" onerror="this.src='${fotoDefault}'">
                    </div>
                    <div class="team-body">
                        <h3 class="team-name">${escapeHTML(nombre)}</h3>
                        <p class="team-role">${escapeHTML(especialidad)}</p>
                        <p class="team-bio">${escapeHTML(bio)}</p>
                    </div>
                </div>
            `;
        }).join('');

        // Asegurar visibilidad inmediata de las tarjetas de equipo inyectadas
        teamGrid.querySelectorAll('.reveal').forEach(el => {
            el.classList.add('active');
        });

    } catch (err) {
        console.error('Error detallado cargando equipo:', err);
        teamGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--color-error);">Error al cargar el equipo de especialistas.</p>`;
    }
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}