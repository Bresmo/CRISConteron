// ============================================================================
// PROTECCIÓN DE RUTAS ADMINISTRATIVAS Y GESTIÓN DE SESIÓN
// ============================================================================
import { supabase } from './supabaseClient.js';

export async function checkAdminAuth() {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
        window.location.href = 'login.html';
        return null;
    }

    // Verificar si el usuario autenticado tiene perfil con rol 'admin'
    const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', session.user.id)
        .eq('rol', 'admin')
        .single();

    if (perfilError || !perfil) {
        alert('Acceso no autorizado. Se requieren privilegios de administrador.');
        await supabase.auth.signOut();
        window.location.href = 'login.html';
        return null;
    }

    // Renderizar nombre de admin si existe el elemento en el header
    const userSpan = document.getElementById('admin-user-name');
    if (userSpan) {
        userSpan.textContent = perfil.nombre || session.user.email;
    }

    // Configurar botón de logout global
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = 'login.html';
        });
    }

    return session.user;
}