// ============================================================================
// CLIENTE SUPABASE (MODULO ES)
// ============================================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_CONFIG } from './config.js';

if (!SUPABASE_CONFIG.url || SUPABASE_CONFIG.url.includes('TU-PROYECTO')) {
    console.error('⚠️ Configura correctamente tu archivo js/config.js con las credenciales de Supabase.');
}

export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);