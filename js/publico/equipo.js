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

        teamGrid.innerHTML = peluqueros.map(p => `
            <div class="team-card reveal">
                <div class="team-img-wrapper">
                    <img src="${p.foto_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=80'}" alt="${p.nombre}" class="team-img" loading="lazy">
                </div>
                <div class="team-body">
                    <h3 class="team-name">${escapeHTML(p.nombre)}</h3>
                    <p class="team-role">${escapeHTML(p.especialidad || 'Estilista Senior')}</p>
                    <p class="team-bio">${escapeHTML(p.bio || '')}</p>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error('Error cargando equipo:', err);
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}